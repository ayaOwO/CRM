from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crm.models.orm.users_table import UsersTable


async def lock_calendar(session: AsyncSession, user_id: int) -> None:
    """Serialize all calendar writes for an owner, including empty calendars."""
    await session.scalar(
        select(UsersTable.id).where(UsersTable.id == user_id).with_for_update()
    )
