from abc import ABC, abstractmethod

from crm.models.contacts import Contact
from crm.models.requests.contact_create import ContactCreate


class AbstractContactStore(ABC):
    @abstractmethod
    async def add_contact(self, contact: ContactCreate) -> Contact:
        pass

    @abstractmethod
    async def delete_contact(self, contact_id: int) -> bool:
        pass

    @abstractmethod
    async def replace_contact(
        self, contact_id: int, contact: ContactCreate
    ) -> Contact | None:
        pass

    @abstractmethod
    async def get_all_contacts(self) -> list[Contact]:
        pass

    @abstractmethod
    async def get_contact_by_id(self, contact_id: int) -> Contact | None:
        pass

    @abstractmethod
    async def search_contacts(
        self,
        *,
        first_name: str | None = None,
        last_name: str | None = None,
        phone_number: str | None = None,
        notes: str | None = None,
    ) -> list[Contact]:
        pass
