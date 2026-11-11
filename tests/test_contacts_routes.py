import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, patch

import httpx
import logfire
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from user_scope_support import create_schema

from crm.dependencies import get_current_user
from crm.main import app
from crm.models.requests.appointment_create import AppointmentCreate
from crm.models.settings import Settings
from crm.models.user import User


class ContactRoutesTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.directory = TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        url = f"sqlite+aiosqlite:///{Path(self.directory.name) / 'contacts.db'}"
        settings = Settings(
            database_url=url,
            openai_endpoint="",
            openai_model="",
            logfire_environment="test",
        )
        settings_patch = patch("crm.main.get_settings", return_value=settings)
        settings_patch.start()
        self.addCleanup(settings_patch.stop)
        self.lifespan = app.router.lifespan_context(app)
        await self.lifespan.__aenter__()
        self.addAsyncCleanup(self.lifespan.__aexit__, None, None, None)
        engine = app.state.session_factory.kw["bind"]

        @event.listens_for(engine.sync_engine, "connect")
        def enable_foreign_keys(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")

        async with engine.begin() as connection:
            await create_schema(connection)
        app.dependency_overrides[get_current_user] = lambda: User(
            id=1, username="owner", email="owner@example.com"
        )
        self.addCleanup(app.dependency_overrides.pop, get_current_user)
        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://test",
            headers={"Authorization": "Bearer test"},
        )
        self.addAsyncCleanup(self.client.aclose)

    async def test_user_isolation(self):
        saved = (
            await self.client.post(
                "/contacts", json={"first_name": "Private", "last_name": "Contact"}
            )
        ).json()
        app.dependency_overrides[get_current_user] = lambda: User(
            id=2, username="other", email="other@example.com"
        )
        self.assertEqual((await self.client.get("/contacts")).json(), [])
        self.assertEqual(
            (
                await self.client.get("/contacts", params={"first_name": "Private"})
            ).json(),
            [],
        )
        path = f"/contacts/{saved['id']}"
        for method, payload in (
            ("GET", {}),
            ("PUT", {"first_name": "Stolen", "last_name": "Contact"}),
            ("PATCH", {}),
            ("PATCH", {"notes": "changed"}),
            ("DELETE", {}),
        ):
            response = await self.client.request(method, path, json=payload)
            self.assertEqual(response.status_code, 404, response.text)
        app.dependency_overrides[get_current_user] = lambda: User(
            id=1, username="owner", email="owner@example.com"
        )
        self.assertEqual((await self.client.get(path)).json(), saved)

    async def test_crud_and_validation(self):
        self.assertEqual((await self.client.get("/contacts")).json(), [])
        payload = {
            "first_name": "Ada",
            "last_name": "Lovelace",
            "phone_number": "+9720500123456",
            "notes": "100% ready_with/slash",
            "google_docs_link": "https://docs.google.com/document/d/synthetic/edit",
        }
        response = await self.client.post("/contacts", json=payload)
        self.assertEqual(response.status_code, 201)
        saved = response.json()
        path = f"/contacts/{saved['id']}"
        self.assertTrue(saved["created_at"])
        self.assertEqual({key: saved[key] for key in payload}, payload)
        self.assertEqual((await self.client.get(path)).json(), saved)
        self.assertEqual((await self.client.get("/contacts")).json(), [saved])
        for invalid in (
            {},
            {"first_name": "", "last_name": "Test"},
            {"first_name": "A", "last_name": "B", "phone_number": "0" * 51},
        ):
            for method, url in (("POST", "/contacts"), ("PUT", path)):
                response = await self.client.request(method, url, json=invalid)
                self.assertEqual(response.status_code, 422)
        self.assertEqual((await self.client.get("/contacts/invalid")).status_code, 422)
        self.assertEqual((await self.client.patch(path, json={})).json(), saved)
        replacement = {"first_name": "Grace", "last_name": "Hopper"}
        response = await self.client.put(path, json=replacement)
        self.assertEqual(response.status_code, 200)
        updated = response.json()
        self.assertEqual(updated["id"], saved["id"])
        self.assertEqual(updated["created_at"], saved["created_at"])
        self.assertEqual(updated["first_name"], "Grace")
        self.assertEqual(updated["last_name"], "Hopper")
        for field in ("phone_number", "notes", "google_docs_link"):
            self.assertIsNone(updated[field])
        self.assertEqual((await self.client.get(path)).json(), updated)
        response = await self.client.delete(path)
        self.assertEqual(response.status_code, 204)
        self.assertEqual(response.content, b"")
        for method in ("GET", "PUT", "PATCH", "DELETE"):
            response = await self.client.request(method, path, json=replacement)
            self.assertEqual(response.status_code, 404)
        self.assertEqual((await self.client.get("/contacts")).json(), [])

    async def test_partial_update_persistence_and_validation(self):
        payload = {
            "first_name": "Ada",
            "last_name": "Lovelace",
            "phone_number": "+972050",
            "notes": "Keep these notes",
            "google_docs_link": "https://docs.google.com/example",
        }
        saved = (await self.client.post("/contacts", json=payload)).json()
        path = f"/contacts/{saved['id']}"
        changes = {"first_name": "Grace", "phone_number": None}
        response = await self.client.patch(path, json=changes)
        self.assertEqual(response.status_code, 200, response.text)
        expected = saved | changes
        self.assertEqual(response.json(), expected)
        self.assertEqual((await self.client.get(path)).json(), expected)
        for invalid in (
            {"first_name": None},
            {"last_name": None},
            {"first_name": ""},
            {"last_name": ""},
            {"first_name": "A" * 256},
            {"phone_number": "0" * 51},
        ):
            response = await self.client.patch(path, json=invalid)
            self.assertEqual(response.status_code, 422, response.text)
            self.assertEqual((await self.client.get(path)).json(), expected)
        changes = {"notes": None, "google_docs_link": None, "last_name": "Hopper"}
        expected |= changes
        self.assertEqual((await self.client.patch(path, json=changes)).json(), expected)
        self.assertEqual((await self.client.get(path)).json(), expected)
        self.assertEqual((await self.client.patch(path, json={})).json(), expected)
        self.assertEqual(
            (await self.client.patch("/contacts/999999", json={})).status_code, 404
        )

    async def test_filters(self):
        payloads = (
            {
                "first_name": "Ada",
                "last_name": "Lovelace",
                "phone_number": "+972050",
                "notes": "100% ready_with/slash",
                "google_docs_link": "https://docs.google.com/alpha",
            },
            {
                "first_name": "Ada",
                "last_name": "Byron",
                "notes": "100X readyXwithXslash",
            },
            {"first_name": "Grace", "last_name": "Hopper"},
        )
        saved = [(await self.client.post("/contacts", json=p)).json() for p in payloads]
        cases = (
            ({"first_name": "Ada"}, [saved[0], saved[1]]),
            ({"last_name": "Lovelace"}, [saved[0]]),
            ({"first_name": "Ada", "last_name": "Lovelace"}, [saved[0]]),
            ({"first_name": "Ad"}, []),
            ({"first_name": "Ada", "last_name": "Hopper"}, []),
            ({"notes": "%"}, [saved[0]]),
            ({"notes": "_"}, [saved[0]]),
            ({"notes": "with/slash"}, [saved[0]]),
            (
                {
                    "notes": "%",
                    "first_name": "Ada",
                    "last_name": "Lovelace",
                },
                [saved[0]],
            ),
            (
                {
                    "first_name": "  ",
                    "last_name": "\t",
                    "notes": "\n",
                },
                saved,
            ),
            ({"notes": "missing"}, []),
        )
        for params, expected in cases:
            with self.subTest(params=params):
                response = await self.client.get("/contacts", params=params)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json(), expected)

    async def test_search_parameters(self):
        parameters = app.openapi()["paths"]["/contacts"]["get"]["parameters"]
        self.assertEqual(
            {parameter["name"] for parameter in parameters},
            {"first_name", "last_name", "notes"},
        )

    async def test_linked_client_deletion_conflict(self):
        async with app.state.session_factory() as session:
            contact = (
                await self.client.post(
                    "/contacts", json={"first_name": "Test", "last_name": "Client"}
                )
            ).json()
            appointment = await app.state.appointment_service.add_appointment(
                AppointmentCreate.model_validate(
                    {
                        "guests": [contact["id"]],
                        "location": "Office",
                        "start_time": "2026-10-11T09:00:00Z",
                        "end_time": "2026-10-11T10:00:00Z",
                    }
                ),
                user_id=1,
                session=session,
            )
            response = await self.client.delete(f"/contacts/{contact['id']}")
            self.assertEqual(response.status_code, 409)
            self.assertEqual(
                (await self.client.get(f"/contacts/{contact['id']}")).status_code, 200
            )
            await app.state.appointment_service.delete_appointment(
                appointment.id, user_id=1, session=session
            )
            self.assertEqual(
                (await self.client.delete(f"/contacts/{contact['id']}")).status_code,
                204,
            )

    async def test_engine_configuration_and_shutdown(self):
        settings = Settings(
            database_url="postgresql+psycopg://unused:unused@localhost/unused",
            openai_endpoint="",
            openai_model="",
            logfire_environment="test",
        )
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        with (
            patch("crm.main.get_settings", return_value=settings),
            patch("crm.main.create_async_engine", return_value=engine) as create,
            patch.object(AsyncEngine, "dispose", new_callable=AsyncMock) as dispose,
        ):
            async with app.router.lifespan_context(app):
                self.assertEqual(
                    create.call_args.args[0].drivername, "postgresql+psycopg"
                )
                self.assertIs(app.state.session_factory.kw["bind"], engine)
            dispose.assert_awaited_once()
        await engine.dispose()

    async def test_telemetry_excludes_contact_bodies(self):
        exporter = InMemorySpanExporter()
        logfire.configure(
            service_name="crm",
            send_to_logfire=False,
            console=False,
            additional_span_processors=[SimpleSpanProcessor(exporter)],
        )
        marker = "synthetic-private-contact-body"
        try:
            response = await self.client.post(
                "/contacts",
                json={"first_name": marker, "last_name": "Test", "notes": marker},
            )
            self.assertEqual(response.status_code, 201)
            response = await self.client.post("/contacts", json={"notes": marker})
            self.assertEqual(response.status_code, 422)
            logfire.force_flush()
            spans = exporter.get_finished_spans()
            self.assertTrue(spans)
            for span in spans:
                self.assertNotIn(marker, str(span.attributes))
                self.assertNotIn(marker, str(span.events))
                self.assertNotIn("fastapi.arguments.values", span.attributes or {})
                self.assertNotIn("fastapi.arguments.errors", span.attributes or {})
        finally:
            logfire.configure(service_name="crm", send_to_logfire=False, console=False)


if __name__ == "__main__":
    unittest.main()
