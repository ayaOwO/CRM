from abc import ABC, abstractmethod
from typing import Any

from crm.models.requests.user_create import UserCreate
from crm.models.user import User


class AbstractUserStore(ABC):
    @abstractmethod
    async def create_user(self, user: UserCreate) -> User:
        pass

    @abstractmethod
    async def get_user(self, identifier: str | int, with_password=False) -> User | None:
        pass

    @abstractmethod
    async def set_user_settings(
        self, user_id: int, settings: dict[str, Any]
    ) -> dict[str, Any] | None:
        pass
