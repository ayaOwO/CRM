from datetime import UTC, datetime

from pydantic import AwareDatetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from crm.data.abstract_appointment_store import AbstractAppointmentStore
from crm.data.booking_lock import lock_calendar
from crm.models.appointments import Appointment
from crm.models.orm.appointment_guests_table import AppointmentGuestsTable
from crm.models.orm.appointments_table import AppointmentsTable
from crm.models.orm.contacts_table import ContactsTable
from crm.models.orm.schedulers_table import GuestBookingsTable
from crm.models.requests.appointment_create import AppointmentCreate


class SqlAppointmentStore(AbstractAppointmentStore):
    def __init__(self, session_maker: async_sessionmaker[AsyncSession]):
        self.session_maker = session_maker

    @staticmethod
    def _extract_response(row: AppointmentsTable) -> Appointment:
        return Appointment(
            id=row.id,
            notes=row.notes,
            location=row.location,
            start_time=row.start_time,
            end_time=row.end_time,
            guests=[link.contact_id for link in row.guest_links],
        )

    async def lock_calendar(self, user_id: int, *, session: AsyncSession) -> None:
        await lock_calendar(session, user_id)

    async def get_contact_ids(
        self, guests: list[int], *, user_id: int, session: AsyncSession | None = None
    ) -> set[int]:
        if session is None:
            async with self.session_maker() as new_session, new_session.begin():
                return await self.get_contact_ids(
                    guests, user_id=user_id, session=new_session
                )

        return set(
            await session.scalars(
                select(ContactsTable.id)
                .where(ContactsTable.id.in_(guests), ContactsTable.user_id == user_id)
                .with_for_update(read=True, key_share=True)
            )
        )

    async def get_guest_bookings(
        self,
        *,
        user_id: int,
        exclude: int | None = None,
        session: AsyncSession | None = None,
    ) -> list[tuple[datetime, datetime, dict]]:
        if session is None:
            async with self.session_maker() as new_session, new_session.begin():
                return await self.get_guest_bookings(
                    user_id=user_id, exclude=exclude, session=new_session
                )

        query = (
            select(
                AppointmentsTable.start_time,
                AppointmentsTable.end_time,
                GuestBookingsTable.policy,
            )
            .join(GuestBookingsTable)
            .where(
                AppointmentsTable.user_id == user_id,
            )
        )
        if exclude is not None:
            query = query.where(AppointmentsTable.id != exclude)
        rows = await session.execute(query)
        return [(start, end, policy) for start, end, policy in rows]

    async def add_appointment(
        self,
        appointment: AppointmentCreate,
        *,
        user_id: int,
        session: AsyncSession | None = None,
    ) -> Appointment:
        if session is None:
            async with self.session_maker() as new_session, new_session.begin():
                return await self.add_appointment(
                    appointment, user_id=user_id, session=new_session
                )

        row = AppointmentsTable(
            user_id=user_id,
            **appointment.model_dump(exclude={"guests"}),
            guest_links=[
                AppointmentGuestsTable(contact_id=contact_id)
                for contact_id in appointment.guests
            ],
        )
        session.add(row)
        await session.flush()
        return self._extract_response(row)

    async def _get_row(
        self,
        appointment_id: int,
        user_id: int,
        *,
        session: AsyncSession,
        for_update: bool = False,
    ) -> AppointmentsTable | None:
        query = select(AppointmentsTable).where(
            AppointmentsTable.id == appointment_id,
            AppointmentsTable.user_id == user_id,
        )
        if for_update:
            query = query.with_for_update()
        return (await session.scalars(query)).one_or_none()

    async def get_appointment(
        self,
        appointment_id: int,
        *,
        user_id: int,
        for_update: bool = False,
        session: AsyncSession | None = None,
    ) -> Appointment | None:
        if session is None:
            async with self.session_maker() as new_session, new_session.begin():
                return await self.get_appointment(
                    appointment_id,
                    user_id=user_id,
                    for_update=for_update,
                    session=new_session,
                )

        row = await self._get_row(
            appointment_id, user_id, session=session, for_update=for_update
        )
        if row is None:
            return None
        return self._extract_response(row)

    async def list_appointments(
        self,
        start_time: AwareDatetime,
        end_time: AwareDatetime,
        *,
        user_id: int,
        session: AsyncSession | None = None,
    ) -> list[Appointment]:
        if session is None:
            async with self.session_maker() as new_session, new_session.begin():
                return await self.list_appointments(
                    start_time, end_time, user_id=user_id, session=new_session
                )

        query = (
            select(AppointmentsTable)
            .where(
                AppointmentsTable.user_id == user_id,
                start_time.astimezone(UTC) <= AppointmentsTable.start_time,
                AppointmentsTable.start_time < end_time.astimezone(UTC),
            )
            .order_by(AppointmentsTable.start_time, AppointmentsTable.id)
        )
        return [self._extract_response(row) for row in await session.scalars(query)]

    async def update_appointment(
        self,
        appointment_id: int,
        update: AppointmentCreate,
        *,
        user_id: int,
        session: AsyncSession | None = None,
    ) -> Appointment | None:
        if session is None:
            async with self.session_maker() as new_session, new_session.begin():
                return await self.update_appointment(
                    appointment_id, update, user_id=user_id, session=new_session
                )

        row = await self._get_row(
            appointment_id, user_id, session=session, for_update=True
        )
        if row is None:
            return None
        existing = {link.contact_id: link for link in row.guest_links}
        guest_links = []
        for contact_id in update.guests:
            if contact_id in existing:
                guest = existing[contact_id]
            else:
                guest = AppointmentGuestsTable(contact_id=contact_id)
            guest_links.append(guest)
        row.guest_links = guest_links
        row.notes = update.notes
        row.location = update.location
        row.start_time = update.start_time
        row.end_time = update.end_time
        await session.flush()
        return self._extract_response(row)

    async def delete_appointment(
        self, appointment_id: int, *, user_id: int, session: AsyncSession | None = None
    ) -> bool:
        if session is None:
            async with self.session_maker() as new_session, new_session.begin():
                return await self.delete_appointment(
                    appointment_id, user_id=user_id, session=new_session
                )

        row = await self._get_row(
            appointment_id, user_id, session=session, for_update=True
        )
        if row is None:
            return False
        await session.delete(row)
        return True
