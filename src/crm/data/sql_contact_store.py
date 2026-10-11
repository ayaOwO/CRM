from sqlalchemy import delete, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from crm.data.abstract_contact_store import AbstractContactStore
from crm.models.contacts import Contact
from crm.models.orm.contacts_table import ContactsTable
from crm.models.requests.contact_create import ContactCreate
from crm.models.requests.contact_update import ContactUpdate


class SqlContactStore(AbstractContactStore):
    def __init__(self, session_maker: async_sessionmaker[AsyncSession]):
        super().__init__()
        self.session_maker = session_maker

    async def add_contact(self, contact: ContactCreate) -> Contact:
        async with self.session_maker() as session:
            insert_contact = (
                insert(ContactsTable)
                .values(
                    **contact.model_dump(),
                )
                .returning(ContactsTable)
            )
            saved = Contact.model_validate(
                (await session.scalars(insert_contact)).one()
            )
            await session.commit()
            return saved

    async def delete_contact(self, contact_id: int) -> bool:
        delete_query = (
            delete(ContactsTable)
            .where(ContactsTable.id == contact_id)
            .returning(ContactsTable.id)
        )
        async with self.session_maker() as session:
            deleted_id = (await session.scalars(delete_query)).one_or_none()
            await session.commit()
            return deleted_id is not None

    async def replace_contact(
        self, contact_id: int, contact: ContactCreate
    ) -> Contact | None:
        replace_query = (
            update(ContactsTable)
            .where(ContactsTable.id == contact_id)
            .values(**contact.model_dump())
            .returning(ContactsTable)
        )
        async with self.session_maker() as session:
            row = (await session.scalars(replace_query)).one_or_none()
            saved = Contact.model_validate(row) if row is not None else None
            await session.commit()
            return saved

    async def update_contact(
        self, contact_id: int, contact: ContactUpdate
    ) -> Contact | None:
        changes = contact.model_dump(exclude_unset=True)
        if not changes:
            return await self.get_contact_by_id(contact_id)
        update_query = (
            update(ContactsTable)
            .where(ContactsTable.id == contact_id)
            .values(**changes)
            .returning(ContactsTable)
        )
        async with self.session_maker() as session:
            row = (await session.scalars(update_query)).one_or_none()
            saved = Contact.model_validate(row) if row is not None else None
            await session.commit()
            return saved

    async def get_all_contacts(self) -> list[Contact]:
        return await self.search_contacts()

    async def get_contact_by_id(self, contact_id: int) -> Contact | None:
        async with self.session_maker() as session:
            contact = await session.get(ContactsTable, contact_id)
        return Contact.model_validate(contact) if contact is not None else None

    async def search_contacts(
        self,
        first_name: str | None = None,
        last_name: str | None = None,
        notes: str | None = None,
    ) -> list[Contact]:
        search_query = select(ContactsTable).where(
            ContactsTable.first_name == first_name.strip()
            if first_name and first_name.strip()
            else True,
            ContactsTable.last_name == last_name.strip()
            if last_name and last_name.strip()
            else True,
            ContactsTable.notes.contains(notes.strip(), autoescape=True)
            if notes and notes.strip()
            else True,
        )

        async with self.session_maker() as session:
            res = await session.execute(search_query.order_by(ContactsTable.id))

        return [Contact.model_validate(contact) for contact in res.scalars()]
