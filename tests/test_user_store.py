import unittest

from argon2 import PasswordHasher
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from crm.data import SqlUserStore
from crm.models import UserCreate


class UserStoreTest(unittest.IsolatedAsyncioTestCase):
    async def test_create_user_and_existing_lookups(self):
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        try:
            async with engine.begin() as connection:
                # SQLite has no JSONB type; create the users table with JSON storage.
                await connection.execute(
                    text(
                        "CREATE TABLE users (id INTEGER PRIMARY KEY, "
                        "username VARCHAR(50) NOT NULL UNIQUE, "
                        "email VARCHAR(200) NOT NULL UNIQUE, password VARCHAR, "
                        "settings JSON NOT NULL DEFAULT '{}')"
                    )
                )
            store = SqlUserStore(async_sessionmaker(engine, expire_on_commit=False))
            request = UserCreate(
                username="aya",
                email="aya@example.com",
                password="test-password",
            )
            saved = await store.create_user(request)
            self.assertIsInstance(saved.id, int)
            self.assertEqual(saved.username, request.username)
            self.assertEqual(saved.email, request.email)
            self.assertEqual(saved.settings, {})
            self.assertNotEqual(saved.password, request.password)
            self.assertEqual(request.password, "test-password")
            user = await store.get_user(request.username, with_password=True)
            self.assertIsNotNone(user)
            password_hash = user.password
            self.assertTrue(PasswordHasher().verify(password_hash, request.password))
            self.assertEqual(user, saved)
            self.assertEqual((await store.get_user(request.username)).password, "")
            self.assertIsNone(await store.get_user("missing"))
            self.assertIsNone(await store.get_user("missing", with_password=True))
            with self.assertRaises(IntegrityError):
                await store.create_user(request)
            with self.assertRaises(IntegrityError):
                await store.create_user(
                    request.model_copy(update={"username": "other"})
                )
            self.assertEqual(
                await store.get_user(request.username, with_password=True), saved
            )
        finally:
            await engine.dispose()


if __name__ == "__main__":
    unittest.main()
