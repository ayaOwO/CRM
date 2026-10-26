import logging
from typing import Any

from argon2 import PasswordHasher
from sqlalchemy import Select, insert, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from crm.data.abstract_user_store import AbstractUserStore
from crm.models import User, UserCreate, UsersTable
from crm.models.orm import users_table


class SqlUserStore(AbstractUserStore):
    def __init__(self, session_maker: async_sessionmaker[AsyncSession]):
        self.session_maker = session_maker

    async def create_user(self, user: UserCreate) -> User:
        values = user.model_dump()
        values["password"] = PasswordHasher().hash(user.password)
        async with self.session_maker() as session:
            query = insert(UsersTable).values(**values).returning(UsersTable)
            saved = User.model_validate((await session.scalars(query)).one())
            await session.commit()
            return saved

    async def get_user(self, identifier: str | int, with_password=False) -> User | None:
        if isinstance(identifier, int):
            column = UsersTable.id
        else:
            column = UsersTable.username
            identifier = identifier.lower()
        logging.debug("Looking up user by %s", column.key)
        async with self.session_maker() as session:
            query = Select(UsersTable).where(column == identifier)
            user = await session.scalar(query)
        logging.debug("User lookup found=%s", user is not None)
        if user is not None:
            model = User.model_validate(user)
            if not with_password:
                model.password = ""
            return model
        else:
            return None

    async def set_user_settings(
        self, user_id: int, settings: dict[str, Any]
    ) -> dict[str, Any] | None:
        async with self.session_maker() as session:
            query = (
                update(UsersTable)
                .where(UsersTable.id == user_id)
                .values(settings=settings)
                .returning(UsersTable.settings)
            )
            saved = await session.scalar(query)
            await session.commit()
            return saved
