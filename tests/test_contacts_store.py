import unittest

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from crm.data import SqlContactStore
from crm.models.contacts import ContactCreate
from crm.models.contacts_table import Base


class ContactStoreTest(unittest.IsolatedAsyncioTestCase):
    async def test_contact_persistence_search_and_delete(self):
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        try:
            async with engine.begin() as connection:
                await connection.run_sync(Base.metadata.create_all)
            store = SqlContactStore(async_sessionmaker(engine, expire_on_commit=False))
            contact = ContactCreate(
                phone_number="+9720500123456",
                notes="Manual notes: 100% complete",
                first_name="Ada",
                last_name="Lovelace",
                google_docs_link="https://docs.google.com/document/d/example/edit",
            )
            await store.add_contact(contact)
            contacts = await store.get_all_contacts()
            self.assertEqual(len(contacts), 1)
            saved = contacts[0]
            self.assertEqual(
                saved.model_dump(exclude={"id", "created_at"}), contact.model_dump()
            )
            self.assertEqual(await store.get_contact_by_id(saved.id), saved)
            for term in ("+972", "100%", "ADA", "lovelace", "docs.google.com"):
                self.assertEqual(await store.search_contacts(term), [saved])
            self.assertEqual(await store.search_contacts("_"), [])
            await store.delete_contact(saved.id)
            self.assertEqual(await store.get_all_contacts(), [])
            self.assertIsNone(await store.get_contact_by_id(saved.id))
        finally:
            await engine.dispose()


if __name__ == "__main__":
    unittest.main()
