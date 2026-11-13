import unittest
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import patch

import httpx
from fastapi import FastAPI
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from user_scope_support import create_schema

from crm.data.sql_appointment_store import SqlAppointmentStore
from crm.data.sql_scheduler_store import SqlSchedulerStore, token_hash
from crm.dependencies import get_current_user, get_settings
from crm.models.orm.contacts_table import ContactsTable
from crm.models.orm.schedulers_table import SchedulersTable
from crm.models.requests.appointment_create import AppointmentCreate
from crm.models.user import User
from crm.routers.scheduler import router


class SchedulerTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        # Always disposable; never load the application database from .env.
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        self.addAsyncCleanup(self.engine.dispose)

        @event.listens_for(self.engine.sync_engine, "connect")
        def foreign_keys(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")

        async with self.engine.begin() as connection:
            await create_schema(connection)
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)
        self.db = SqlSchedulerStore(self.sessions)
        self.app = FastAPI()
        self.app.state.scheduler_store = self.db
        self.app.include_router(router)
        self.owner = User(id=1, username="owner", email="owner@test.test")
        self.app.dependency_overrides[get_current_user] = lambda: self.owner
        self.app.dependency_overrides[get_settings] = lambda: SimpleNamespace(
            secret_key="test-secret",
            guest_cookie_secure=False,
            booking_captcha_secret="",
            booking_captcha_site_key="",
        )
        self.client = self.new_client()
        self.now = datetime(2027, 1, 4, 6, tzinfo=UTC)  # Monday
        patcher = patch("crm.data.sql_scheduler_store.now_utc", return_value=self.now)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.payload = {
            "title": "Advice",
            "location": "Office",
            "timezone": "UTC",
            "duration_minutes": 60,
            "slot_minutes": 30,
            "buffer_minutes": 15,
            "min_notice_hours": 0,
            "cancel_notice_hours": 0,
            "repeat": [{"day": d, "start": "09:00", "end": "17:00"} for d in range(7)],
        }
        response = await self.client.post("/scheduler", json=self.payload)
        self.assertEqual(response.status_code, 201, response.text)
        self.scheduler = response.json()
        self.code = self.scheduler["booking_path"].split("/")[-1]
        self.path = f"/booking/{self.code}"
        self.guest = {
            "first_name": "Ada",
            "last_name": "Test",
            "phone_number": "+972 50-1234567",
            "start_time": "2027-01-05T09:00:00Z",
        }

    def new_client(self):
        client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=self.app), base_url="http://test"
        )
        self.addAsyncCleanup(client.aclose)
        return client

    async def book(self, client=None, **changes):
        client = client or self.client
        await client.get(self.path)
        response = await client.post(self.path, json=self.guest | changes)
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    async def test_public_booking_cookie_private_token_and_cancellation(self):
        info = await self.client.get(self.path)
        self.assertNotIn("user_id", info.json())
        self.assertNotIn("code_hash", info.json())
        self.assertIn("HttpOnly", info.headers["set-cookie"])
        saved = await self.book()
        self.assertEqual(len((await self.client.get("/guest/appointments")).json()), 1)
        self.assertEqual(
            (
                await self.client.post(
                    self.path, json=self.guest | {"start_time": "2027-01-06T09:00:00Z"}
                )
            ).status_code,
            409,
        )
        stranger = self.new_client()
        self.assertEqual((await stranger.get("/guest/appointments")).json(), [])
        self.assertEqual(
            (
                await stranger.patch(
                    f"/guest/appointments/{saved['id']}",
                    json={"start_time": "2027-01-06T09:00:00Z"},
                    headers={"phone_number": self.guest["phone_number"]},
                )
            ).status_code,
            404,
        )
        token = saved["management_path"].split("#")[1]
        headers = {"X-Booking-Token": token}
        self.assertEqual(
            (await stranger.get("/guest/manage", headers=headers)).json()["id"],
            saved["id"],
        )
        response = await stranger.patch(
            f"/guest/appointments/{saved['id']}",
            json={"start_time": "2027-01-06T09:00:00Z"},
            headers=headers,
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["start_time"], "2027-01-06T09:00:00Z")
        response = await stranger.request(
            "DELETE", f"/guest/appointments/{saved['id']}", json={}, headers=headers
        )
        self.assertEqual(response.status_code, 204, response.text)
        self.assertEqual((await self.client.get("/guest/appointments")).json(), [])
        self.assertEqual(
            (await stranger.get("/guest/manage", headers=headers)).status_code, 404
        )
        async with self.sessions() as session:
            contact = await session.scalar(select(ContactsTable))
            self.assertEqual(contact.phone_number, "972501234567")

    async def test_ownership_validation_and_link_rotation(self):
        sid = self.scheduler["id"]
        async with self.sessions() as session:
            row = await session.get(SchedulersTable, sid)
            self.assertEqual(row.code_hash, token_hash(self.code))
            self.assertNotIn(self.code, str(row.data))
        self.owner = User(id=2, username="other", email="other@test.test")
        self.assertEqual((await self.client.get("/scheduler")).json(), [])
        for method in ("GET", "PATCH", "DELETE"):
            self.assertEqual(
                (
                    await self.client.request(method, f"/scheduler/{sid}", json={})
                ).status_code,
                404,
            )
        self.owner = User(id=1, username="owner", email="owner@test.test")
        for invalid in (
            {"duration_minutes": 0},
            {"timezone": "invalid"},
            {"user_id": 2},
            {"title": None},
            {"repeat": [{"day": 0, "start": "17:00", "end": "09:00"}]},
        ):
            self.assertEqual(
                (
                    await self.client.patch(f"/scheduler/{sid}", json=invalid)
                ).status_code,
                422,
            )
        response = await self.client.patch(
            f"/scheduler/{sid}", json={"title": "Updated"}
        )
        self.assertEqual(response.json()["duration_minutes"], 60)
        self.assertEqual(response.json()["title"], "Updated")
        rotated = await self.client.post(f"/scheduler/{sid}/link")
        self.assertEqual(rotated.status_code, 200)
        self.assertEqual((await self.client.get(self.path)).status_code, 404)

    async def test_conflicts_buffers_and_failed_move_preserves_booking(self):
        saved = await self.book()
        other = self.new_client()
        await other.get(self.path)
        for start in ("2027-01-05T09:00:00Z", "2027-01-05T10:00:00Z"):
            self.assertEqual(
                (
                    await other.post(self.path, json=self.guest | {"start_time": start})
                ).status_code,
                409,
            )
        second = await self.book(other, start_time="2027-01-05T10:30:00Z")
        response = await self.client.patch(
            f"/guest/appointments/{saved['id']}",
            json={"start_time": second["start_time"]},
        )
        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            (await self.client.get("/guest/appointments")).json()[0]["start_time"],
            saved["start_time"],
        )
        manual = SqlAppointmentStore(self.sessions)
        with self.assertRaises(ValueError):
            await manual.add_appointment(
                AppointmentCreate(
                    location="Office",
                    start_time="2027-01-05T09:30:00Z",
                    end_time="2027-01-05T10:30:00Z",
                ),
                user_id=1,
            )

    async def test_overrides_window_full_overlap_and_policy(self):
        sid = self.scheduler["id"]
        response = await self.client.patch(
            f"/scheduler/{sid}",
            json={"overrides": [{"date": "2027-01-05", "intervals": []}]},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            (
                await self.client.get(
                    self.path + "/slots?first=2027-01-05&last=2027-01-05"
                )
            ).json(),
            [],
        )
        await self.client.patch(f"/scheduler/{sid}", json={"overrides": []})
        manual = SqlAppointmentStore(self.sessions)
        await manual.add_appointment(
            AppointmentCreate(
                location="Office",
                start_time="2027-01-04T23:00:00Z",
                end_time="2027-01-05T10:00:00Z",
            ),
            user_id=1,
        )
        available = (
            await self.client.get(self.path + "/slots?first=2027-01-05&last=2027-01-05")
        ).json()
        self.assertNotIn("2027-01-05T09:00:00Z", available)
        saved = await self.book(start_time="2027-01-05T11:00:00Z")
        await self.client.delete(f"/scheduler/{sid}")
        self.assertEqual((await self.client.get(self.path)).status_code, 404)
        self.assertEqual(
            (await self.client.get("/guest/appointments")).json()[0]["id"], saved["id"]
        )
        response = await self.client.request(
            "DELETE", f"/guest/appointments/{saved['id']}", json={}
        )
        self.assertEqual(response.status_code, 204, response.text)

    async def test_limits_bad_requests_and_auth(self):
        self.assertEqual(
            (
                await self.client.get(
                    self.path + "/slots?first=2027-01-01&last=2027-04-01"
                )
            ).status_code,
            422,
        )
        await self.client.get(self.path)
        self.assertEqual(
            (
                await self.client.post(self.path, json=self.guest | {"website": "spam"})
            ).status_code,
            422,
        )
        self.assertEqual(
            (
                await self.client.post(
                    self.path, json=self.guest, headers={"Sec-Fetch-Site": "cross-site"}
                )
            ).status_code,
            403,
        )
        self.assertEqual(
            (
                await self.client.post(
                    self.path, content="{}", headers={"Content-Type": "text/plain"}
                )
            ).status_code,
            415,
        )
        for _ in range(16):
            response = await self.client.post(
                self.path, json=self.guest | {"start_time": "2020-01-01T00:00:00Z"}
            )
        self.assertEqual(response.status_code, 429)
        self.app.dependency_overrides.pop(get_current_user)
        self.assertEqual((await self.client.get("/scheduler")).status_code, 401)

    async def test_daylight_saving_gap_and_repeated_hour(self):
        sid = self.scheduler["id"]
        await self.client.patch(
            f"/scheduler/{sid}",
            json={
                "timezone": "America/New_York",
                "max_advance_days": 365,
                "duration_minutes": 30,
                "slot_minutes": 30,
                "repeat": [{"day": 6, "start": "01:00", "end": "04:00"}],
            },
        )
        spring = await self.client.get(
            self.path + "/slots?first=2027-03-14&last=2027-03-14"
        )
        self.assertEqual(spring.status_code, 200, spring.text)
        self.assertEqual(
            spring.json(),
            [
                "2027-03-14T06:00:00Z",
                "2027-03-14T06:30:00Z",
                "2027-03-14T07:00:00Z",
                "2027-03-14T07:30:00Z",
            ],
        )
        autumn = (
            await self.client.get(self.path + "/slots?first=2027-11-07&last=2027-11-07")
        ).json()
        self.assertIn("2027-11-07T05:00:00Z", autumn)
        self.assertNotIn("2027-11-07T06:00:00Z", autumn)
