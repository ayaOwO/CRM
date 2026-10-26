import unittest
from types import SimpleNamespace

import httpx
import jwt
from fastapi import FastAPI
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from crm.data import SqlUserStore
from crm.dependencies import get_settings
from crm.models import UserCreate
from crm.routers import user


class UserSettingsTest(unittest.IsolatedAsyncioTestCase):
    async def test_authenticated_settings_are_durable_and_user_scoped(self):
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        try:
            async with engine.begin() as connection:
                # SQLite uses JSON instead of PostgreSQL's JSONB.
                await connection.execute(
                    text(
                        "CREATE TABLE users (id INTEGER PRIMARY KEY, "
                        "username VARCHAR(50) NOT NULL UNIQUE, "
                        "email VARCHAR(200) NOT NULL UNIQUE, password VARCHAR, "
                        "settings JSON NOT NULL DEFAULT '{}')"
                    )
                )
            factory = async_sessionmaker(engine, expire_on_commit=False)
            store = SqlUserStore(factory)
            first = await store.create_user(
                UserCreate(
                    username="first",
                    email="first@example.com",
                    password="test-password",
                )
            )
            second = await store.create_user(
                UserCreate(
                    username="second",
                    email="second@example.com",
                    password="test-password",
                )
            )
            settings = SimpleNamespace(
                secret_key="synthetic-user-settings-test-key-123456", algorithm="HS256"
            )

            async def test_settings():
                return settings

            app = FastAPI()
            app.include_router(user.router)
            app.state.user_store = store
            app.dependency_overrides[get_settings] = test_settings
            token = jwt.encode(
                {"sub": str(first.id)},
                settings.secret_key,
                algorithm=settings.algorithm,
            )
            headers = {"Authorization": f"Bearer {token}"}
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app), base_url="http://test"
            ) as client:
                self.assertEqual(
                    (await client.put("/user/settings", json={})).status_code, 401
                )
                payload = {
                    "themeColor": "#663399",
                    "locale": "he",
                    "user_id": second.id,
                }
                response = await client.put(
                    "/user/settings", json=payload, headers=headers
                )
                self.assertEqual(response.status_code, 200, response.text)
                self.assertEqual(response.json(), payload)
                # Read through a new store/session to prove the update committed.
                self.assertEqual(
                    (await SqlUserStore(factory).get_user(first.id)).settings, payload
                )
                self.assertEqual((await store.get_user(second.id)).settings, {})
                self.assertEqual(
                    (await client.get("/user/settings", headers=headers)).json(),
                    payload,
                )
                for invalid in (None, "red", "#123", "#1234567", 123):
                    response = await client.put(
                        "/user/settings", json={"themeColor": invalid}, headers=headers
                    )
                    self.assertEqual(response.status_code, 422)
                self.assertEqual((await store.get_user(first.id)).settings, payload)
                self.assertEqual(
                    (
                        await client.put("/user/settings", json={}, headers=headers)
                    ).json(),
                    {},
                )
            self.assertIsNone(await store.set_user_settings(99999, {}))
        finally:
            await engine.dispose()


if __name__ == "__main__":
    unittest.main()
