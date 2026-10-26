from sqlalchemy import JSON, insert, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncConnection
from sqlalchemy.ext.compiler import compiles

from crm.models import UsersTable
from crm.models.orm.base import Base


@compiles(JSONB, "sqlite")
def compile_sqlite_jsonb(type_, compiler, **kwargs):
    return compiler.visit_JSON(JSON(), **kwargs)


async def create_schema(connection: AsyncConnection) -> None:
    await connection.run_sync(Base.metadata.create_all)
    existing = set((await connection.scalars(select(UsersTable.id))).all())
    for user_id in (1, 2):
        if user_id not in existing:
            await connection.execute(
                insert(UsersTable).values(
                    id=user_id,
                    username=f"test-user-{user_id}",
                    email=f"test-user-{user_id}@example.com",
                    settings={},
                )
            )
