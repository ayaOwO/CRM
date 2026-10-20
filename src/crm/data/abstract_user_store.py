from abc import ABC, abstractmethod

from crm.models.requests.user_create import UserCreate
from crm.models.user import User


class AbstractUserStore(ABC):
    @abstractmethod
    async def create_user(self, user: UserCreate) -> User:
        pass

    @abstractmethod
    async def get_user(self, username: str, with_password=False) -> User | None:
        pass
