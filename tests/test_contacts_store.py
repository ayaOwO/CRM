import unittest

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from crm.data import SqlContactStore
from crm.models.orm.base import Base
from crm.models.requests.contact_create import ContactCreate


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
            saved = await store.add_contact(contact)
            contacts = await store.get_all_contacts()
            self.assertEqual(len(contacts), 1)
            self.assertEqual(saved, contacts[0])
            self.assertEqual(
                saved.model_dump(exclude={"id", "created_at"}), contact.model_dump()
            )
            self.assertEqual(await store.get_contact_by_id(saved.id), saved)
            for field, term in (
                ("phone_number", "+972"),
                ("notes", "100%"),
                ("first_name", "ADA"),
                ("last_name", "lovelace"),
                ("google_docs_link", "docs.google.com"),
                ("name", "ada lovelace"),
            ):
                self.assertEqual(await store.search_contacts(**{field: term}), [saved])
            self.assertEqual(await store.search_contacts(notes="_"), [])
            replacement = ContactCreate(first_name="Grace", last_name="Hopper")
            updated = await store.replace_contact(saved.id, replacement)
            self.assertIsNotNone(updated)
            assert updated is not None
            self.assertEqual(updated.id, saved.id)
            self.assertEqual(updated.created_at, saved.created_at)
            self.assertEqual(await store.get_contact_by_id(saved.id), updated)
            self.assertEqual(
                updated.model_dump(exclude={"id", "created_at"}),
                replacement.model_dump(),
            )
            self.assertTrue(await store.delete_contact(saved.id))
            self.assertEqual(await store.get_all_contacts(), [])
            self.assertIsNone(await store.get_contact_by_id(saved.id))
            self.assertFalse(await store.delete_contact(saved.id))
            self.assertIsNone(await store.replace_contact(saved.id, replacement))
        finally:
            await engine.dispose()


if __name__ == "__main__":
    unittest.main()
