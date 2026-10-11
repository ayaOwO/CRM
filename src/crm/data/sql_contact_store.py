from sqlalchemy import delete, insert, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from crm.data.abstract_contact_store import AbstractContactStore
from crm.models.contacts import Contact, ContactCreate
from crm.models.contacts_table import ContactsTable


class SqlContactStore(AbstractContactStore):
    def __init__(self, session_maker: async_sessionmaker):
        super().__init__()
        self.session_maker = session_maker

    async def add_contact(self, contact: ContactCreate) -> None:
        async with self.session_maker() as session:
            insert_contact = insert(ContactsTable).values(
                **contact.model_dump(),
            )
            await session.execute(insert_contact)
            await session.commit()

    async def delete_contact(self, contact_id: int) -> None:
        delete_query = delete(ContactsTable).where(ContactsTable.id == contact_id)
        async with self.session_maker() as session:
            await session.execute(delete_query)
            await session.commit()

    async def get_all_contacts(self) -> list[Contact]:
        contacts_list_query = select(ContactsTable)
        async with self.session_maker() as session:
            res = await session.execute(contacts_list_query)
        return [Contact.model_validate(contact) for contact in res.scalars()]

    async def get_contact_by_id(self, contact_id: int) -> Contact | None:
        async with self.session_maker() as session:
            contact = await session.get(ContactsTable, contact_id)
        return Contact.model_validate(contact) if contact is not None else None

    async def search_contacts(self, term: str) -> list[Contact]:
        search_query = select(ContactsTable).where(
            ContactsTable.phone_number.icontains(term, autoescape=True)
            | ContactsTable.notes.icontains(term, autoescape=True)
            | ContactsTable.first_name.icontains(term, autoescape=True)
            | ContactsTable.last_name.icontains(term, autoescape=True)
            | ContactsTable.google_docs_link.icontains(term, autoescape=True)
        )

        async with self.session_maker() as session:
            res = await session.execute(search_query)

        return [Contact.model_validate(contact) for contact in res.scalars()]
