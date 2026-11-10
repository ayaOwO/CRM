from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crm.models.orm.appointments_table import AppointmentsTable
from crm.models.orm.schedulers_table import GuestBookingsTable
from crm.models.orm.users_table import UsersTable


async def lock_calendar(session: AsyncSession, user_id: int) -> None:
    """Serialize all calendar writes for an owner, including empty calendars."""
    await session.scalar(
        select(UsersTable.id).where(UsersTable.id == user_id).with_for_update()
    )


async def validate_guest_conflicts(
    session: AsyncSession, user_id: int, start, end, exclude: int | None = None
) -> None:
    """Manual writes may overlap each other, but must honor guest bookings."""
    rows = await session.execute(
        select(AppointmentsTable, GuestBookingsTable)
        .join(GuestBookingsTable)
        .where(
            AppointmentsTable.user_id == user_id,
            AppointmentsTable.id != exclude if exclude is not None else True,
        )
    )
    for appointment, booking in rows:
        buffer = timedelta(minutes=booking.policy.get("buffer_minutes", 0))
        if (
            appointment.start_time < end + buffer
            and appointment.end_time > start - buffer
        ):
            raise ValueError("Appointment conflicts with a guest booking")
