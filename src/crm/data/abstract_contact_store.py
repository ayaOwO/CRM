from abc import ABC, abstractmethod

from crm.models.contacts import Contact, ContactCreate


class AbstractContactStore(ABC):
    @abstractmethod
    async def add_contact(self, contact: ContactCreate) -> None:
        pass

    @abstractmethod
    async def delete_contact(self, contact_id: int) -> None:
        pass

    @abstractmethod
    async def get_all_contacts(self) -> list[Contact]:
        pass

    @abstractmethod
    async def get_contact_by_id(self, contact_id: int) -> Contact | None:
        pass

    @abstractmethod
    async def search_contacts(self, term: str) -> list[Contact]:
        pass
