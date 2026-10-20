from argon2 import PasswordHasher
from sqlalchemy import Select, insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from crm.data.abstract_user_store import AbstractUserStore
from crm.models import User, UserCreate, UsersTable


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

    async def get_user(self, username: str, with_password=False) -> User | None:
        async with self.session_maker() as session:
            query = Select(UsersTable).where(UsersTable.username == username)
            user = await session.scalar(query)
        if user is not None:
            model = User.model_validate(user)
            if not with_password:
                model.password = ""
            return model
        else:
            return None
