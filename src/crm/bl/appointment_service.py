from datetime import timedelta

from pydantic import AwareDatetime
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from crm.data.sql_appointment_store import SqlAppointmentStore
from crm.models.appointments import Appointment
from crm.models.requests.appointment_create import AppointmentCreate
from crm.models.requests.appointment_update import AppointmentUpdate


class AppointmentService:
    def __init__(self, session_maker: async_sessionmaker[AsyncSession]):
        self.store = SqlAppointmentStore(session_maker)

    @staticmethod
    async def _validate_guests(
        store: SqlAppointmentStore,
        guests: list[int],
        user_id: int,
        session: AsyncSession,
    ) -> None:
        if not guests:
            return
        found = await store.get_contact_ids(guests, user_id=user_id, session=session)
        missing = set(guests) - found
        if missing:
            raise ValueError(f"Unknown contact IDs: {missing}")

    @staticmethod
    async def _validate_guest_conflicts(
        store: SqlAppointmentStore,
        appointment: AppointmentCreate,
        user_id: int,
        session: AsyncSession,
        exclude: int | None = None,
    ) -> None:
        # Manual writes may overlap each other, but must honor guest bookings.
        for start, end, policy in await store.get_guest_bookings(
            user_id=user_id, exclude=exclude, session=session
        ):
            buffer = timedelta(minutes=policy.get("buffer_minutes", 0))
            if (
                start < appointment.end_time + buffer
                and end > appointment.start_time - buffer
            ):
                raise ValueError("Appointment conflicts with a guest booking")

    async def add_appointment(
        self, appointment: AppointmentCreate, *, user_id: int, session: AsyncSession
    ) -> Appointment:
        async with session.begin():
            store = self.store
            await store.lock_calendar(user_id, session=session)
            await self._validate_guest_conflicts(store, appointment, user_id, session)
            await self._validate_guests(store, appointment.guests, user_id, session)
            return await store.add_appointment(
                appointment, user_id=user_id, session=session
            )

    async def get_appointment(
        self, appointment_id: int, *, user_id: int, session: AsyncSession
    ) -> Appointment | None:
        async with session.begin():
            return await self.store.get_appointment(
                appointment_id, user_id=user_id, session=session
            )

    async def list_appointments(
        self,
        start_time: AwareDatetime,
        end_time: AwareDatetime,
        *,
        user_id: int,
        session: AsyncSession,
    ) -> list[Appointment]:
        if end_time <= start_time:
            raise ValueError("end_time must be after start_time")
        async with session.begin():
            return await self.store.list_appointments(
                start_time, end_time, user_id=user_id, session=session
            )

    async def update_appointment(
        self,
        appointment_id: int,
        update: AppointmentUpdate,
        *,
        user_id: int,
        session: AsyncSession,
    ) -> Appointment | None:
        async with session.begin():
            store = self.store
            await store.lock_calendar(user_id, session=session)
            current = await store.get_appointment(
                appointment_id, user_id=user_id, for_update=True, session=session
            )
            if current is None:
                return None
            changes = update.model_dump(exclude_unset=True)
            merged = AppointmentCreate.model_validate(
                current.model_dump(exclude={"id"}) | changes
            )
            await self._validate_guest_conflicts(
                store, merged, user_id, session, appointment_id
            )
            if "guests" in changes:
                await self._validate_guests(store, merged.guests, user_id, session)
            return await store.update_appointment(
                appointment_id, merged, user_id=user_id, session=session
            )

    async def delete_appointment(
        self, appointment_id: int, *, user_id: int, session: AsyncSession
    ) -> bool:
        async with session.begin():
            store = self.store
            await store.lock_calendar(user_id, session=session)
            return await store.delete_appointment(
                appointment_id, user_id=user_id, session=session
            )
