import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, patch

import httpx
import logfire
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from crm.main import app
from crm.models.orm.base import Base
from crm.models.settings import Settings


class ContactRoutesTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.directory = TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        url = f"sqlite+aiosqlite:///{Path(self.directory.name) / 'contacts.db'}"
        settings = Settings.model_validate({"STORAGE_DATABASE_URL": url})
        settings_patch = patch("crm.main.get_settings", return_value=settings)
        settings_patch.start()
        self.addCleanup(settings_patch.stop)
        self.lifespan = app.router.lifespan_context(app)
        await self.lifespan.__aenter__()
        self.addAsyncCleanup(self.lifespan.__aexit__, None, None, None)
        async with app.state.engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        )
        self.addAsyncCleanup(self.client.aclose)

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
        self.assertEqual((await self.client.patch(path, json={})).status_code, 501)
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
        for method in ("GET", "PUT", "DELETE"):
            response = await self.client.request(method, path, json=replacement)
            self.assertEqual(response.status_code, 404)
        self.assertEqual((await self.client.get("/contacts")).json(), [])

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
            ({"name": "a LoVe"}, [saved[0]]),
            ({"name": "ada"}, saved[:2]),
            ({"first_name": "AD", "last_name": "LOVE"}, [saved[0]]),
            ({"first_name": "ada", "last_name": "hopper"}, []),
            ({"phone_number": "+972"}, [saved[0]]),
            ({"notes": "%"}, [saved[0]]),
            ({"notes": "_"}, [saved[0]]),
            ({"notes": "with/SLASH"}, [saved[0]]),
            ({"google_docs_link": "DOCS.google"}, [saved[0]]),
            (
                {
                    "name": "ada",
                    "notes": "%",
                    "phone_number": "050",
                    "google_docs_link": "alpha",
                },
                [saved[0]],
            ),
            (
                {
                    "name": "",
                    "first_name": "  ",
                    "last_name": "\t",
                    "notes": "\n",
                    "phone_number": " ",
                    "google_docs_link": "",
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

    async def test_postgresql_driver_and_shutdown(self):
        settings = Settings.model_validate(
            {"STORAGE_DATABASE_URL": "postgresql://unused:unused@localhost/unused"}
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
