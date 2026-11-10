import hashlib
import secrets
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from crm.data.booking_lock import lock_calendar
from crm.models.orm.appointment_guests_table import AppointmentGuestsTable
from crm.models.orm.appointments_table import AppointmentsTable
from crm.models.orm.contacts_table import ContactsTable
from crm.models.orm.schedulers_table import (
    BookingRateLimitsTable,
    GuestBookingsTable,
    GuestSessionsTable,
    SchedulersTable,
)
from crm.models.scheduler import (
    BookingCreate,
    BookingCreated,
    GuestBooking,
    Scheduler,
    SchedulerCreated,
    SchedulerData,
)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def now_utc() -> datetime:
    return datetime.now(UTC)


class SqlSchedulerStore:
    def __init__(self, sessions: async_sessionmaker[AsyncSession]):
        self.sessions = sessions

    @staticmethod
    def scheduler(row: SchedulersTable) -> Scheduler:
        return Scheduler(id=row.id, **row.data)

    async def list_schedulers(self, user_id: int) -> list[Scheduler]:
        async with self.sessions() as session:
            rows = await session.scalars(
                select(SchedulersTable)
                .where(SchedulersTable.user_id == user_id)
                .order_by(SchedulersTable.id)
            )
            return [self.scheduler(row) for row in rows]

    async def create(self, data: SchedulerData, user_id: int) -> SchedulerCreated:
        code = secrets.token_urlsafe(32)
        async with self.sessions() as session, session.begin():
            row = SchedulersTable(
                user_id=user_id,
                code_hash=token_hash(code),
                data=data.model_dump(mode="json"),
            )
            session.add(row)
            await session.flush()
            return SchedulerCreated(
                **self.scheduler(row).model_dump(), booking_path=f"/book/{code}"
            )

    async def owned(
        self, session: AsyncSession, scheduler_id: int, user_id: int
    ) -> SchedulersTable:
        row = await session.scalar(
            select(SchedulersTable).where(
                SchedulersTable.id == scheduler_id, SchedulersTable.user_id == user_id
            )
        )
        if row is None:
            raise HTTPException(404, "Scheduler not found")
        return row

    async def get(self, scheduler_id: int, user_id: int) -> Scheduler:
        async with self.sessions() as session:
            return self.scheduler(await self.owned(session, scheduler_id, user_id))

    async def update(self, scheduler_id: int, changes: dict, user_id: int) -> Scheduler:
        async with self.sessions() as session, session.begin():
            await lock_calendar(session, user_id)
            row = await self.owned(session, scheduler_id, user_id)
            row.data = SchedulerData.model_validate(row.data | changes).model_dump(
                mode="json"
            )
            return self.scheduler(row)

    async def revoke(
        self, scheduler_id: int, user_id: int, rotate: bool = False
    ) -> str | None:
        async with self.sessions() as session, session.begin():
            await lock_calendar(session, user_id)
            row = await self.owned(session, scheduler_id, user_id)
            if rotate:
                code = secrets.token_urlsafe(32)
                row.code_hash = token_hash(code)
                return f"/book/{code}"
            # Keep appointments and their policy snapshot after deleting a scheduler.
            await session.delete(row)
        return None

    async def public(self, session: AsyncSession, code: str) -> SchedulersTable:
        row = await session.scalar(
            select(SchedulersTable)
            .where(SchedulersTable.code_hash == token_hash(code))
            .execution_options(populate_existing=True)
        )
        if row is None:
            raise HTTPException(404, "Scheduling link is unavailable")
        return row

    async def public_info(self, code: str) -> SchedulerData:
        async with self.sessions() as session:
            return SchedulerData.model_validate((await self.public(session, code)).data)

    async def guest_session(self, token: str | None) -> tuple[str, bool]:
        async with self.sessions() as session, session.begin():
            row = (
                await session.get(GuestSessionsTable, token_hash(token))
                if token
                else None
            )
            if row and row.expires_at > now_utc():
                return token, False
            token = secrets.token_urlsafe(32)
            session.add(
                GuestSessionsTable(
                    token_hash=token_hash(token),
                    expires_at=now_utc() + timedelta(days=365),
                )
            )
            return token, True

    async def rate_limit(self, keys: list[str], limit: int = 15) -> None:
        """Database counters work across workers; count failed attempts as well."""
        window = int(now_utc().timestamp()) // 3600
        exceeded = False
        async with self.sessions() as session, session.begin():
            # Bound retention without depending on a background cleanup worker.
            await session.execute(
                delete(BookingRateLimitsTable).where(
                    BookingRateLimitsTable.window < window - 24
                )
            )
            insert = (
                pg_insert
                if session.bind.dialect.name == "postgresql"
                else sqlite_insert
            )
            for key in sorted(keys):
                stmt = (
                    insert(BookingRateLimitsTable)
                    .values(key=key, window=window, attempts=0)
                    .on_conflict_do_nothing()
                )
                await session.execute(stmt)
                row = await session.scalar(
                    select(BookingRateLimitsTable)
                    .where(BookingRateLimitsTable.key == key)
                    .with_for_update()
                )
                if row.window != window:
                    row.window, row.attempts = window, 0
                row.attempts += 1
                exceeded |= row.attempts > limit
        if exceeded:
            raise HTTPException(
                429,
                "Too many booking attempts; try again later",
                headers={"Retry-After": "3600"},
            )

    async def available(
        self,
        session: AsyncSession,
        row: SchedulersTable,
        first: date,
        last: date,
        exclude: int | None = None,
    ) -> list[datetime]:
        if last < first or (last - first).days > 31:
            raise HTTPException(422, "Request at most 31 days of availability")
        data = SchedulerData.model_validate(row.data)
        zone = ZoneInfo(data.timezone)
        now = now_utc()
        lower = max(
            now + timedelta(hours=data.min_notice_hours), data.window_start or now
        )
        upper = min(
            now + timedelta(days=data.max_advance_days),
            data.window_end or now + timedelta(days=366),
        )
        buffer = timedelta(minutes=data.buffer_minutes)
        duration = timedelta(minutes=data.duration_minutes)
        start = datetime.combine(first, datetime.min.time(), zone).astimezone(UTC)
        end = datetime.combine(
            last + timedelta(days=1), datetime.min.time(), zone
        ).astimezone(UTC)
        busy = await session.execute(
            select(AppointmentsTable, GuestBookingsTable.policy)
            .outerjoin(GuestBookingsTable)
            .where(
                AppointmentsTable.user_id == row.user_id,
                AppointmentsTable.start_time < end + duration + timedelta(days=1),
                AppointmentsTable.end_time > start - timedelta(days=1),
                AppointmentsTable.id != exclude if exclude is not None else True,
            )
        )
        blocks = [
            (
                a.start_time,
                a.end_time,
                max(buffer, timedelta(minutes=(policy or {}).get("buffer_minutes", 0))),
            )
            for a, policy in busy
        ]
        overrides = {o.date: o.intervals for o in data.overrides}
        result = []
        day = first
        while day <= last:
            intervals = overrides.get(
                day, [r for r in data.repeat if r.day == day.weekday()]
            )
            for interval in intervals:
                wall = datetime.combine(day, interval.start)
                wall_end = datetime.combine(day, interval.end)
                while wall < wall_end:
                    local = wall.replace(tzinfo=zone, fold=0)
                    instant = local.astimezone(UTC)
                    finish = instant + duration
                    # Skip DST gaps, choose first occurrence in a repeated hour.
                    valid_local = instant.astimezone(zone).replace(tzinfo=None) == wall
                    if (
                        valid_local
                        and lower <= instant
                        and finish <= upper
                        and finish <= wall_end.replace(tzinfo=zone).astimezone(UTC)
                    ) and not any(
                        a < finish + gap and b > instant - gap for a, b, gap in blocks
                    ):
                        result.append(instant)
                    wall += timedelta(minutes=data.slot_minutes)
            day += timedelta(days=1)
        return sorted(set(result))

    async def slots(self, code: str, first: date, last: date) -> list[datetime]:
        async with self.sessions() as session:
            return await self.available(
                session, await self.public(session, code), first, last
            )

    @staticmethod
    def booking(
        row: GuestBookingsTable, appointment: AppointmentsTable
    ) -> GuestBooking:
        data = SchedulerData.model_validate(row.policy)
        return GuestBooking(
            id=appointment.id,
            title=data.title,
            location=appointment.location,
            timezone=data.timezone,
            start_time=appointment.start_time,
            end_time=appointment.end_time,
            cancel_notice_hours=data.cancel_notice_hours,
            allow_cancel=data.allow_cancel,
            allow_reschedule=data.allow_reschedule,
            scheduler_available=row.scheduler_id is not None,
        )

    async def create_booking(
        self, code: str, body: BookingCreate, guest_token: str
    ) -> BookingCreated:
        if body.website:
            raise HTTPException(422, "Invalid booking request")
        management = secrets.token_urlsafe(32)
        async with self.sessions() as session, session.begin():
            row = await self.public(session, code)
            await lock_calendar(session, row.user_id)
            # Re-read under the owner lock in case settings or token changed.
            row = await self.public(session, code)
            data = SchedulerData.model_validate(row.data)
            existing = await session.scalar(
                select(GuestBookingsTable.appointment_id)
                .join(AppointmentsTable)
                .where(
                    GuestBookingsTable.user_id == row.user_id,
                    GuestBookingsTable.session_hash == token_hash(guest_token),
                    AppointmentsTable.end_time > now_utc(),
                )
            )
            if existing is not None:
                raise HTTPException(
                    409, "You already have an upcoming appointment; manage it below"
                )
            start = body.start_time.astimezone(UTC)
            day = start.astimezone(ZoneInfo(data.timezone)).date()
            if start not in await self.available(session, row, day, day):
                raise HTTPException(
                    409, "This time is no longer available; choose another time"
                )
            contacts = await session.scalars(
                select(ContactsTable).where(
                    ContactsTable.user_id == row.user_id,
                    ContactsTable.phone_number.is_not(None),
                )
            )
            contact = next(
                (
                    c
                    for c in contacts
                    if "".join(
                        ch for ch in c.phone_number if ch.isascii() and ch.isdigit()
                    )
                    == body.phone_number
                ),
                None,
            )
            if contact is None:
                contact = ContactsTable(
                    user_id=row.user_id,
                    **body.model_dump(
                        include={"first_name", "last_name", "phone_number"}
                    ),
                )
                session.add(contact)
                await session.flush()
            appointment = AppointmentsTable(
                user_id=row.user_id,
                location=data.location,
                notes=body.notes or None,
                start_time=start,
                end_time=start + timedelta(minutes=data.duration_minutes),
                guest_links=[AppointmentGuestsTable(contact_id=contact.id)],
            )
            session.add(appointment)
            await session.flush()
            booking = GuestBookingsTable(
                appointment_id=appointment.id,
                user_id=row.user_id,
                scheduler_id=row.id,
                session_hash=token_hash(guest_token),
                management_hash=token_hash(management),
                policy=row.data,
            )
            session.add(booking)
            return BookingCreated(
                **self.booking(booking, appointment).model_dump(),
                management_path=f"/manage#{management}",
            )

    async def bookings(
        self, guest_token: str, code: str | None = None
    ) -> list[GuestBooking]:
        async with self.sessions() as session:
            owner = (await self.public(session, code)).user_id if code else None
            rows = await session.execute(
                select(GuestBookingsTable, AppointmentsTable)
                .join(AppointmentsTable)
                .where(
                    GuestBookingsTable.session_hash == token_hash(guest_token),
                    GuestBookingsTable.user_id == owner if owner is not None else True,
                    AppointmentsTable.end_time > now_utc(),
                )
                .order_by(AppointmentsTable.start_time)
            )
            return [self.booking(b, a) for b, a in rows]

    async def authorized(
        self,
        session: AsyncSession,
        booking_id: int | None,
        guest_token: str,
        management: str | None,
    ):
        query = select(GuestBookingsTable, AppointmentsTable).join(AppointmentsTable)
        if management:
            query = query.where(
                GuestBookingsTable.management_hash == token_hash(management)
            )
        else:
            query = query.where(
                GuestBookingsTable.session_hash == token_hash(guest_token)
            )
        if booking_id is not None:
            query = query.where(GuestBookingsTable.appointment_id == booking_id)
        pair = (
            await session.execute(query.execution_options(populate_existing=True))
        ).first()
        if pair is None:
            raise HTTPException(404, "Booking not found")
        return pair

    async def manage_info(self, guest: str, management: str) -> GuestBooking:
        async with self.sessions() as session:
            return self.booking(
                *await self.authorized(session, None, guest, management)
            )

    async def manage_slots(
        self,
        booking_id: int,
        guest: str,
        management: str | None,
        first: date,
        last: date,
    ) -> list[datetime]:
        async with self.sessions() as session:
            booking, appointment = await self.authorized(
                session, booking_id, guest, management
            )
            self.check_policy(booking, appointment, False)
            row = (
                await session.get(SchedulersTable, booking.scheduler_id)
                if booking.scheduler_id
                else None
            )
            if row is None:
                raise HTTPException(
                    409, "Scheduling link was removed; contact the organizer"
                )
            return await self.available(session, row, first, last, booking_id)

    @staticmethod
    def check_policy(
        booking: GuestBookingsTable, appointment: AppointmentsTable, cancel: bool
    ):
        data = SchedulerData.model_validate(booking.policy)
        if not (data.allow_cancel if cancel else data.allow_reschedule):
            raise HTTPException(409, "This action is disabled; contact the organizer")
        if appointment.start_time <= now_utc() + timedelta(
            hours=data.cancel_notice_hours
        ):
            raise HTTPException(
                409, "The change deadline has passed; contact the organizer"
            )

    async def change_booking(
        self,
        booking_id: int,
        guest: str,
        management: str | None,
        start: datetime | None,
    ) -> GuestBooking | None:
        async with self.sessions() as session, session.begin():
            booking, appointment = await self.authorized(
                session, booking_id, guest, management
            )
            await lock_calendar(session, booking.user_id)
            booking, appointment = await self.authorized(
                session, booking_id, guest, management
            )
            self.check_policy(booking, appointment, start is None)
            if start is None:
                await session.delete(appointment)
                return None
            row = (
                await session.get(SchedulersTable, booking.scheduler_id)
                if booking.scheduler_id
                else None
            )
            if row is None:
                raise HTTPException(
                    409, "Scheduling link was removed; contact the organizer"
                )
            data = SchedulerData.model_validate(row.data)
            start = start.astimezone(UTC)
            day = start.astimezone(ZoneInfo(data.timezone)).date()
            if start not in await self.available(session, row, day, day, booking_id):
                raise HTTPException(
                    409, "This time is no longer available; choose another time"
                )
            appointment.start_time = start
            appointment.end_time = start + timedelta(minutes=data.duration_minutes)
            appointment.location = data.location
            # Preserve the terms accepted when booking.
            return self.booking(booking, appointment)
