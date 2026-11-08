import unittest
from unittest.mock import AsyncMock, Mock

from argon2 import PasswordHasher
from psycopg.errors import NotNullViolation, UniqueViolation
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from crm.data import SqlUserStore
from crm.models import UserCreate
from crm.models.errors import UserAlreadyExistsError


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
            self.assertEqual(await store.get_user(saved.id, with_password=True), saved)
            self.assertEqual((await store.get_user(saved.id)).password, "")
            self.assertIsNone(await store.get_user(saved.id + 1))
            self.assertIsNone(await store.get_user(saved.id + 1, with_password=True))
            numeric_name = await store.create_user(
                request.model_copy(
                    update={"username": str(saved.id), "email": "numeric@example.com"}
                )
            )
            self.assertEqual(
                await store.get_user(str(saved.id), with_password=True), numeric_name
            )
            self.assertEqual(await store.get_user(saved.id, with_password=True), saved)
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
            with self.assertRaises(IntegrityError):
                await store.create_user(
                    request.model_copy(
                        update={"username": None, "email": "new@example.com"}
                    )
                )
        finally:
            await engine.dispose()

    async def test_postgres_duplicate_and_unexpected_failures(self):
        request = UserCreate(username="aya", email="aya@example.com", password="test")
        for original, expected in (
            (UniqueViolation("duplicate"), UserAlreadyExistsError),
            (NotNullViolation("missing value"), IntegrityError),
        ):
            with self.subTest(original=type(original).__name__):
                error = IntegrityError("insert", {}, original)
                session = AsyncMock()
                session.scalars.side_effect = error
                context = AsyncMock()
                context.__aenter__.return_value = session
                store = SqlUserStore(Mock(return_value=context))
                with self.assertRaises(expected):
                    await store.create_user(request)


if __name__ == "__main__":
    unittest.main()
