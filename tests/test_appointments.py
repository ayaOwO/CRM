import os
import unittest
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import httpx
import jwt
from fastapi import FastAPI
from sqlalchemy import delete, event, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from user_scope_support import create_schema

from crm.data.sql_appointment_store import SqlAppointmentStore
from crm.dependencies import get_current_user, get_settings
from crm.models.orm.appointment_guests_table import AppointmentGuestsTable
from crm.models.orm.appointments_table import AppointmentsTable
from crm.models.orm.contacts_table import ContactsTable
from crm.models.user import User
from crm.routers.appointments import router


class AppointmentsTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.window = {
            "start_time": "2026-01-01T00:00:00Z",
            "end_time": "2028-01-01T00:00:00Z",
        }
        # Set this only to a disposable PostgreSQL database: tests clear their rows.
        url = os.environ.get("CRM_TEST_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
        self.engine = create_async_engine(url)
        self.addAsyncCleanup(self.engine.dispose)
        if self.engine.dialect.name == "sqlite":

            @event.listens_for(self.engine.sync_engine, "connect")
            def enable_foreign_keys(connection, _):
                connection.execute("PRAGMA foreign_keys=ON")

        async with self.engine.begin() as connection:
            await create_schema(connection)
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)
        async with self.sessions() as session, session.begin():
            await session.execute(delete(AppointmentGuestsTable))
            await session.execute(delete(AppointmentsTable))
            await session.execute(delete(ContactsTable))
            contacts = [
                ContactsTable(first_name=name, last_name="Test", user_id=1)
                for name in ("Ada", "Grace")
            ]
            session.add_all(contacts)
            await session.flush()
            self.guests = [contact.id for contact in contacts]
        app = FastAPI()
        self.app = app
        app.state.appointment_store = SqlAppointmentStore(self.sessions)
        app.include_router(router)
        app.dependency_overrides[get_current_user] = lambda: User(
            id=1, username="owner", email="owner@example.com"
        )
        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://test",
            headers={"Authorization": "Bearer test"},
        )
        self.addAsyncCleanup(self.client.aclose)
        self.payload = {
            "guests": self.guests,
            "location": "Office",
            "start_time": "2026-10-11T12:00:00+03:00",
            "end_time": "2026-10-11T13:00:00+03:00",
        }

    async def test_authenticated_user_id(self):
        self.app.dependency_overrides.pop(get_current_user)
        settings = SimpleNamespace(
            secret_key="test-signing-key-at-least-32-bytes", algorithm="HS256"
        )
        self.app.dependency_overrides[get_settings] = lambda: settings
        user = User(id=1, username="owner", email="owner@example.com")
        self.app.state.user_store = SimpleNamespace(
            get_user=AsyncMock(return_value=user)
        )
        response = await self.client.get(
            "/appointments", headers={"Authorization": "Bearer invalid"}
        )
        self.assertEqual(response.status_code, 401)
        response = await self.client.get("/appointments", headers={"Authorization": ""})
        self.assertEqual(response.status_code, 401)
        token = jwt.encode(
            {"sub": "1"}, settings.secret_key, algorithm=settings.algorithm
        )
        headers = {"Authorization": f"Bearer {token}"}
        response = await self.client.post(
            "/appointments", json=self.payload, headers=headers
        )
        self.assertEqual(response.status_code, 201, response.text)
        self.app.state.user_store.get_user.assert_awaited_once_with(1)
        self.app.state.user_store.get_user.return_value = None
        self.assertEqual(
            (await self.client.get("/appointments", headers=headers)).status_code, 401
        )

    async def test_user_isolation(self):
        saved = (await self.client.post("/appointments", json=self.payload)).json()
        self.app.dependency_overrides[get_current_user] = lambda: User(
            id=2, username="other", email="other@example.com"
        )
        self.assertEqual(
            (await self.client.get("/appointments", params=self.window)).json(), []
        )
        path = f"/appointments/{saved['id']}"
        for method, payload in (
            ("GET", {}),
            ("PATCH", {"location": "Changed"}),
            ("DELETE", {}),
        ):
            response = await self.client.request(method, path, json=payload)
            self.assertEqual(response.status_code, 404, response.text)
        self.assertEqual(
            (await self.client.post("/appointments", json=self.payload)).status_code,
            422,
        )
        other = await self.client.post(
            "/appointments", json=self.payload | {"guests": []}
        )
        self.assertEqual(other.status_code, 201, other.text)
        self.assertEqual(
            (
                await self.client.patch(
                    f"/appointments/{other.json()['id']}", json={"guests": self.guests}
                )
            ).status_code,
            422,
        )
        self.app.dependency_overrides[get_current_user] = lambda: User(
            id=1, username="owner", email="owner@example.com"
        )
        self.assertEqual((await self.client.get(path)).json(), saved)
        self.assertEqual(
            (await self.client.get("/appointments", params=self.window)).json(), [saved]
        )

    async def test_main_lifespan_wiring(self):
        from crm.main import app

        app.dependency_overrides[get_current_user] = lambda: User(
            id=1, username="owner", email="owner@example.com"
        )
        self.addCleanup(app.dependency_overrides.pop, get_current_user)
        settings = SimpleNamespace(database_url=self.engine.url)
        with (
            patch("crm.main.get_settings", return_value=settings),
            patch("crm.main.create_async_engine", return_value=self.engine),
        ):
            async with app.router.lifespan_context(app):
                async with app.state.session_factory() as session:
                    await session.connection()
                async with httpx.AsyncClient(
                    transport=httpx.ASGITransport(app=app),
                    base_url="http://test",
                    headers={"Authorization": "Bearer test"},
                ) as client:
                    response = await client.post("/appointments", json=self.payload)
                    self.assertEqual(response.status_code, 201, response.text)
                    path = f"/appointments/{response.json()['id']}"
                    self.assertEqual((await client.get(path)).json(), response.json())

    async def test_database_constraints_and_cascade(self):
        saved = (await self.client.post("/appointments", json=self.payload)).json()
        async with self.sessions() as session, session.begin():
            for row in (
                AppointmentGuestsTable(
                    appointment_id=saved["id"], contact_id=self.guests[0]
                ),
                AppointmentGuestsTable(appointment_id=saved["id"], contact_id=999999),
                AppointmentsTable(
                    location="Invalid",
                    start_time=datetime.fromisoformat(saved["end_time"]),
                    end_time=datetime.fromisoformat(saved["start_time"]),
                ),
            ):
                with self.assertRaises(IntegrityError):
                    async with session.begin_nested():
                        session.add(row)
                        await session.flush()
            await session.execute(
                delete(AppointmentsTable).where(AppointmentsTable.id == saved["id"])
            )
        async with self.sessions() as session:
            self.assertEqual(
                await session.scalar(
                    select(func.count()).select_from(AppointmentGuestsTable)
                ),
                0,
            )

    async def test_crud_guests_and_rollback(self):
        response = await self.client.post("/appointments", json=self.payload)
        self.assertEqual(response.status_code, 201, response.text)
        saved = response.json()
        path = f"/appointments/{saved['id']}"
        self.assertEqual(saved["start_time"], "2026-10-11T09:00:00Z")
        self.assertEqual((await self.client.get(path)).json(), saved)
        self.assertEqual(
            (await self.client.get("/appointments", params=self.window)).json(), [saved]
        )
        async with self.sessions() as session, session.begin():
            with self.assertRaises(IntegrityError):
                async with session.begin_nested():
                    await session.execute(
                        delete(ContactsTable).where(ContactsTable.id == self.guests[0])
                    )
        for invalid in (
            {"location": "Changed", "guests": [999999]},
            {"end_time": "2026-10-11T08:00:00Z"},
            {"start_time": "2026-10-11T11:00:00Z"},
            {"location": None},
            {"guests": None},
            {"start_time": None},
            {"end_time": None},
        ):
            response = await self.client.patch(path, json=invalid)
            self.assertEqual(response.status_code, 422, response.text)
            self.assertEqual((await self.client.get(path)).json(), saved)
        response = await self.client.patch(
            path,
            json={
                "location": "Home",
                "guests": [self.guests[0], self.guests[0]],
                "start_time": "2027-01-01T09:00:00Z",
                "end_time": "2027-01-01T10:00:00Z",
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["guests"], self.guests[:1])
        self.assertEqual(response.json()["location"], "Home")
        self.assertEqual((await self.client.patch(path, json={})).status_code, 200)
        self.assertEqual(
            (await self.client.patch(path, json={"guests": []})).json()["guests"], []
        )
        await self.client.patch(path, json={"guests": self.guests})
        response = await self.client.delete(path)
        self.assertEqual(response.status_code, 204)
        self.assertEqual(response.content, b"")
        async with self.sessions() as session:
            self.assertEqual(
                await session.scalar(
                    select(func.count()).select_from(AppointmentGuestsTable)
                ),
                0,
            )
            self.assertEqual(
                await session.scalar(select(func.count()).select_from(ContactsTable)), 2
            )
        for method in ("GET", "PATCH", "DELETE"):
            response = await self.client.request(method, path, json={})
            self.assertEqual(response.status_code, 404)

    async def test_validation_and_time_filters(self):
        for invalid in (
            {},
            self.payload | {"location": ""},
            self.payload | {"guests": [999999]},
            self.payload | {"start_time": "2026-10-11T12:00:00"},
            self.payload | {"end_time": self.payload["start_time"]},
        ):
            response = await self.client.post("/appointments", json=invalid)
            self.assertEqual(response.status_code, 422, response.text)
        self.assertEqual(
            (await self.client.get("/appointments", params=self.window)).json(), []
        )
        saved = []
        for hour in (11, 9, 10):
            response = await self.client.post(
                "/appointments",
                json=self.payload
                | {
                    "start_time": f"2026-10-11T{hour:02}:00:00Z",
                    "end_time": f"2026-10-11T{hour + 1:02}:00:00Z",
                },
            )
            self.assertEqual(response.status_code, 201, response.text)
            saved.append(response.json())
        cases = (
            ({}, [saved[1], saved[2], saved[0]]),
            ({"start_time": "2026-10-11T13:00:00+03:00"}, [saved[2], saved[0]]),
            ({"end_time": "2026-10-11T10:00:00Z"}, [saved[1]]),
            (
                {
                    "start_time": "2026-10-11T09:00:00Z",
                    "end_time": "2026-10-11T10:00:00Z",
                },
                [saved[1]],
            ),
            ({"start_time": "2027-01-01T00:00:00Z"}, []),
        )
        for params, expected in cases:
            response = await self.client.get(
                "/appointments", params=self.window | params
            )
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.json(), expected)
        for params in (
            {},
            {"start_time": self.window["start_time"]},
            {"end_time": self.window["end_time"]},
            self.window | {"start_time": "2026-10-11T09:00:00"},
            {"start_time": "2026-10-11T10:00:00Z", "end_time": "2026-10-11T09:00:00Z"},
            {"start_time": "2026-10-11T10:00:00Z", "end_time": "2026-10-11T10:00:00Z"},
        ):
            self.assertEqual(
                (await self.client.get("/appointments", params=params)).status_code, 422
            )


if __name__ == "__main__":
    unittest.main()
