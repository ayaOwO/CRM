"""Optional concurrency check. Use only a disposable PostgreSQL database."""

import asyncio
import os
import unittest
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from user_scope_support import create_schema

from crm.data.sql_scheduler_store import SqlSchedulerStore
from crm.models.orm.users_table import UsersTable
from crm.models.scheduler import BookingCreate, SchedulerData
from crm.models.scheduler_link_settings import SchedulerLinkSettings


@unittest.skipUnless(
    os.environ.get("CRM_SCHEDULER_TEST_DATABASE_URL"),
    "Disposable PostgreSQL URL not supplied",
)
class SchedulerConcurrencyTest(unittest.IsolatedAsyncioTestCase):
    async def test_same_slot_and_one_upcoming_booking_are_atomic(self):
        engine = create_async_engine(os.environ["CRM_SCHEDULER_TEST_DATABASE_URL"])
        self.addAsyncCleanup(engine.dispose)
        self.assertEqual(engine.dialect.name, "postgresql")
        async with engine.begin() as connection:
            await create_schema(connection)
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        store = SqlSchedulerStore(
            sessions,
            link_settings=SchedulerLinkSettings(_env_file=None),
            link_secret="test-secret",
        )
        async with sessions() as session, session.begin():
            name = "concurrency-" + uuid4().hex[:16]
            owner = UsersTable(
                id=1000 + uuid4().int % 1_000_000_000,
                username=name,
                email=f"{name}@example.test",
                settings={},
            )
            session.add(owner)
            await session.flush()
            owner_id = owner.id
        tomorrow = (datetime.now(UTC) + timedelta(days=2)).date()
        data = SchedulerData(
            title="Concurrency test",
            location="Office",
            timezone="UTC",
            duration_minutes=30,
            min_notice_hours=0,
            cancel_notice_hours=0,
            buffer_minutes=0,
            repeat=[{"day": tomorrow.weekday(), "start": "09:00", "end": "17:00"}],
        )
        scheduler = await store.create(data, owner_id)
        code = scheduler.booking_path.rsplit("/", 1)[1]
        tokens = [(await store.guest_session(None))[0] for _ in range(2)]
        body = BookingCreate(
            first_name="Concurrent",
            last_name="Test",
            phone_number="972501111111",
            start_time=datetime.combine(tomorrow, datetime.min.time(), UTC)
            + timedelta(hours=9),
        )

        async def attempt(token, payload):
            try:
                return await store.create_booking(code, payload, token)
            except HTTPException as exc:
                return exc.status_code

        results = await asyncio.gather(*(attempt(token, body) for token in tokens))
        winners = [r for r in results if not isinstance(r, int)]
        self.assertEqual(len(winners), 1)
        self.assertEqual(results.count(409), 1)
        # A single session concurrently requests different slots: only one wins.
        token = (await store.guest_session(None))[0]
        results = await asyncio.gather(
            *(
                attempt(
                    token,
                    body.model_copy(
                        update={"start_time": body.start_time + timedelta(hours=h)}
                    ),
                )
                for h in (2, 3)
            )
        )
        self.assertEqual(sum(not isinstance(r, int) for r in results), 1)
        self.assertEqual(results.count(409), 1)
