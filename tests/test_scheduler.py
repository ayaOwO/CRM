import os
import unittest
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import patch

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import ValidationError
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from user_scope_support import create_schema

from crm.bl import AppointmentService
from crm.data.sql_scheduler_store import SqlSchedulerStore, token_hash
from crm.dependencies import get_current_user, get_settings
from crm.models.orm.contacts_table import ContactsTable
from crm.models.orm.schedulers_table import SchedulersTable
from crm.models.requests.appointment_create import AppointmentCreate
from crm.models.requests.appointment_update import AppointmentUpdate
from crm.models.scheduler import SchedulerData
from crm.models.scheduler_link_settings import SchedulerLinkSettings
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
        self.db = SqlSchedulerStore(
            self.sessions,
            link_settings=SchedulerLinkSettings(_env_file=None),
            link_secret="test-secret",
        )
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

    async def test_stable_short_links_and_configurable_length(self):
        self.assertEqual(self.code, "x4nfpR")
        self.assertEqual(self.db._gen_booking_code("1:1"), self.code)
        self.assertNotEqual(
            self.db._gen_booking_code("1:23"), self.db._gen_booking_code("12:3")
        )
        await self.db.update(self.scheduler["id"], {"title": "Changed"}, 1)
        self.assertEqual((await self.db.public_info(self.code)).title, "Changed")

        longer = SqlSchedulerStore(
            self.sessions,
            link_settings=SchedulerLinkSettings(
                _env_file=None, length=8, hash_name="sha512"
            ),
            link_secret="changed-secret",
        )
        self.assertEqual(longer._gen_booking_code("1:1"), "ChPnabMP")
        # Existing links are looked up by their stored hash, not regenerated.
        self.assertEqual((await longer.public_info(self.code)).title, "Changed")
        created = await longer.create(SchedulerData.model_validate(self.payload), 1)
        code = created.booking_path.rsplit("/", 1)[1]
        self.assertEqual(len(code), 8)
        self.assertRegex(code, r"^[A-Za-z0-9_-]{8}$")
        self.assertEqual((await longer.public_info(code)).title, self.payload["title"])

    async def test_short_link_collision_retry_and_exhaustion(self):
        data = SchedulerData.model_validate(self.payload)
        with patch.object(
            self.db, "_gen_booking_code", side_effect=[self.code, "AbCd_2"]
        ) as generate:
            created = await self.db.create(data, 1)
        self.assertEqual(created.booking_path, "/book/AbCd_2")
        source = f"1:{created.id}"
        self.assertEqual(generate.call_args_list[0].args, (source,))
        self.assertEqual(generate.call_args_list[1].args, (f"{source}:1",))
        self.assertEqual((await self.db.public_info(self.code)).title, data.title)
        self.assertEqual((await self.db.public_info("AbCd_2")).title, data.title)

        with (
            patch.object(self.db, "_gen_booking_code", return_value=self.code),
            self.assertRaises(HTTPException) as error,
        ):
            await self.db.create(data, 1)
        self.assertEqual(error.exception.status_code, 503)
        self.assertEqual(len(await self.db.list_schedulers(1)), 2)

        with (
            patch.object(self.db, "_gen_booking_code", return_value="AbCd_2"),
            self.assertRaises(HTTPException),
        ):
            await self.db.revoke(self.scheduler["id"], 1, rotate=True)
        self.assertEqual((await self.db.public_info(self.code)).title, data.title)

    def test_scheduler_link_settings(self):
        settings = SchedulerLinkSettings(_env_file=None)
        self.assertEqual(settings.length, 6)
        self.assertEqual(settings.hash_name, "sha256")
        with patch.dict(
            os.environ,
            {"SCHEDULER_LINK_LENGTH": "8", "SCHEDULER_LINK_HASH_NAME": "sha512"},
        ):
            settings = SchedulerLinkSettings(_env_file=None)
        self.assertEqual(settings.length, 8)
        self.assertEqual(settings.hash_name, "sha512")
        for invalid in (0, 5, 44):
            with self.assertRaises(ValidationError):
                SchedulerLinkSettings(_env_file=None, length=invalid)
        for invalid in ("unknown", "md5", "sha1", "shake_128"):
            with self.assertRaises(ValidationError):
                SchedulerLinkSettings(_env_file=None, hash_name=invalid)

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
        new_code = rotated.json()["booking_path"].rsplit("/", 1)[1]
        self.assertEqual(len(new_code), 6)
        self.assertNotEqual(new_code, self.code)
        self.assertEqual(
            (await self.client.get(f"/booking/{new_code}")).status_code, 200
        )
        self.assertEqual((await self.client.get(self.path)).status_code, 404)

    async def test_conflicts_buffers_and_failed_move_preserves_booking(self):
        async with self.sessions() as session:
            saved = await self.book()
            other = self.new_client()
            await other.get(self.path)
            for start in ("2027-01-05T09:00:00Z", "2027-01-05T10:00:00Z"):
                self.assertEqual(
                    (
                        await other.post(
                            self.path, json=self.guest | {"start_time": start}
                        )
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
            manual = AppointmentService(self.sessions)
            with self.assertRaises(ValueError):
                await manual.add_appointment(
                    AppointmentCreate(
                        location="Office",
                        start_time="2027-01-05T09:30:00Z",
                        end_time="2027-01-05T10:30:00Z",
                    ),
                    user_id=1,
                    session=session,
                )

    async def test_manual_appointment_rules_and_update_rollback(self):
        async with self.sessions() as session:
            booking = await self.book()
            service = AppointmentService(self.sessions)
            # Updating a guest appointment must exclude that appointment from conflicts.
            updated = await service.update_appointment(
                booking["id"],
                AppointmentUpdate(notes="Changed"),
                user_id=1,
                session=session,
            )
            self.assertEqual(updated.notes, "Changed")
            appointment = AppointmentCreate(
                location="Office",
                start_time="2027-01-05T10:15:00Z",
                end_time="2027-01-05T11:15:00Z",
            )
            # The exact buffer boundary is allowed, as are overlapping manual writes.
            saved = await service.add_appointment(
                appointment, user_id=1, session=session
            )
            await service.add_appointment(appointment, user_id=1, session=session)
            with self.assertRaisesRegex(ValueError, "conflicts with a guest booking"):
                await service.update_appointment(
                    saved.id,
                    AppointmentUpdate(
                        location="Changed", start_time="2027-01-05T10:14:00Z"
                    ),
                    user_id=1,
                    session=session,
                )
            self.assertEqual(
                await service.get_appointment(saved.id, user_id=1, session=session),
                saved,
            )
            # Another owner's guest booking does not block this owner's calendar.
            await service.add_appointment(
                AppointmentCreate(
                    location="Other office",
                    start_time=booking["start_time"],
                    end_time=booking["end_time"],
                ),
                user_id=2,
                session=session,
            )

    async def test_overrides_window_full_overlap_and_policy(self):
        async with self.sessions() as session:
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
            manual = AppointmentService(self.sessions)
            await manual.add_appointment(
                AppointmentCreate(
                    location="Office",
                    start_time="2027-01-04T23:00:00Z",
                    end_time="2027-01-05T10:00:00Z",
                ),
                user_id=1,
                session=session,
            )
            available = (
                await self.client.get(
                    self.path + "/slots?first=2027-01-05&last=2027-01-05"
                )
            ).json()
            self.assertNotIn("2027-01-05T09:00:00Z", available)
            saved = await self.book(start_time="2027-01-05T11:00:00Z")
            await self.client.delete(f"/scheduler/{sid}")
            self.assertEqual((await self.client.get(self.path)).status_code, 404)
            self.assertEqual(
                (await self.client.get("/guest/appointments")).json()[0]["id"],
                saved["id"],
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
