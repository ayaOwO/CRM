from datetime import UTC

from pydantic import AwareDatetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from crm.data.abstract_appointment_store import AbstractAppointmentStore
from crm.models.appointments import Appointment
from crm.models.orm.appointment_guests_table import AppointmentGuestsTable
from crm.models.orm.appointments_table import AppointmentsTable
from crm.models.orm.contacts_table import ContactsTable
from crm.models.requests.appointment_create import AppointmentCreate
from crm.models.requests.appointment_update import AppointmentUpdate


class SqlAppointmentStore(AbstractAppointmentStore):
    def __init__(self, session_maker: async_sessionmaker[AsyncSession]):
        self.session_maker = session_maker

    @staticmethod
    def _response(row: AppointmentsTable) -> Appointment:
        return Appointment(
            id=row.id,
            location=row.location,
            start_time=row.start_time,
            end_time=row.end_time,
            guests=[link.contact_id for link in row.guest_links],
        )

    @staticmethod
    async def _validate_guests(
            session: AsyncSession, guests: list[int], user_id: int
    ) -> None:
        if not guests:
            return
        found = set(
            await session.scalars(
                select(ContactsTable.id)
                .where(ContactsTable.id.in_(guests), ContactsTable.user_id == user_id)
                .with_for_update(read=True, key_share=True)
            )
        )
        missing = set(guests) - found
        if missing:
            raise ValueError(f"Unknown contact IDs: {missing}")

    async def add_appointment(
            self, appointment: AppointmentCreate, *, user_id: int
    ) -> Appointment:
        async with self.session_maker() as session, session.begin():
            await self._validate_guests(session, appointment.guests, user_id)
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
            return self._response(row)

    async def get_appointment(
            self, appointment_id: int, *, user_id: int
    ) -> Appointment | None:
        async with self.session_maker() as session:
            row: AppointmentsTable | None = await session.scalar(
                select(AppointmentsTable).where(
                    AppointmentsTable.id == appointment_id,
                    AppointmentsTable.user_id == user_id,
                )
            )
            return self._response(row) if row is not None else None

    async def list_appointments(
            self,
            start_time: AwareDatetime,
            end_time: AwareDatetime,
            *,
            user_id: int,
    ) -> list[Appointment]:
        query = (
            select(AppointmentsTable)
            .where(
                AppointmentsTable.user_id == user_id,
                start_time.astimezone(UTC) <= AppointmentsTable.start_time,
                AppointmentsTable.start_time < end_time.astimezone(UTC)
            )
            .order_by(AppointmentsTable.start_time, AppointmentsTable.id)
        )

        async with self.session_maker() as session:
            return [self._response(row) for row in await session.scalars(query)]

    async def update_appointment(
            self, appointment_id: int, update: AppointmentUpdate, *, user_id: int
    ) -> Appointment | None:
        async with self.session_maker() as session, session.begin():
            row: AppointmentsTable | None = (
                await session.scalars(
                    select(AppointmentsTable)
                    .where(
                        AppointmentsTable.id == appointment_id,
                        AppointmentsTable.user_id == user_id,
                    )
                    .with_for_update()
                )
            ).one_or_none()
            if row is None:
                return None
            changes = update.model_dump(exclude_unset=True)
            merged = AppointmentCreate.model_validate(
                self._response(row).model_dump(exclude={"id"}) | changes
            )
            if "guests" in changes:
                await self._validate_guests(session, merged.guests, user_id)
                existing = {link.contact_id: link for link in row.guest_links}
                row.guest_links = []
                for contact_id in merged.guests:
                    guest = AppointmentGuestsTable(contact_id=contact_id)
                    if contact_id in existing:
                        guest = existing[contact_id]
                    row.guest_links.append(guest)
            row.location = merged.location
            row.start_time = merged.start_time
            row.end_time = merged.end_time
            await session.flush()
            return self._response(row)

    async def delete_appointment(self, appointment_id: int, *, user_id: int) -> bool:
        async with self.session_maker() as session, session.begin():
            row = (
                await session.scalars(
                    select(AppointmentsTable)
                    .where(
                        AppointmentsTable.id == appointment_id,
                        AppointmentsTable.user_id == user_id,
                    )
                    .with_for_update()
                )
            ).one_or_none()
            if row is None:
                return False
            await session.delete(row)
            return True
