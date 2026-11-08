import unittest
from unittest.mock import AsyncMock

import httpx
from fastapi import FastAPI

from crm.dependencies import get_user_store
from crm.models.errors import UserAlreadyExistsError
from crm.routers.credentials import router


class SignupRoutesTest(unittest.IsolatedAsyncioTestCase):
    async def test_signup_status_codes(self):
        store = AsyncMock()

        async def override_store():
            return store

        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_user_store] = override_store
        transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            for error, expected in (
                (None, 201),
                (UserAlreadyExistsError(), 409),
                (RuntimeError("unexpected failure"), 500),
            ):
                with self.subTest(status=expected):
                    store.create_user.side_effect = error
                    response = await client.post(
                        "/auth/signup",
                        json={
                            "username": "aya",
                            "email": "aya@example.com",
                            "password": "test-password",
                        },
                    )
                    self.assertEqual(response.status_code, expected)
                    if expected == 409:
                        self.assertEqual(
                            response.json()["detail"],
                            "Username or email is already in use",
                        )
