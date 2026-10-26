import unittest

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from user_scope_support import create_schema

from crm.data import SqlContactStore
from crm.models.requests.contact_create import ContactCreate
from crm.models.requests.contact_update import ContactUpdate


class ContactStoreTest(unittest.IsolatedAsyncioTestCase):
    async def test_contact_persistence_search_and_delete(self):
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        try:
            async with engine.begin() as connection:
                await create_schema(connection)
            store = SqlContactStore(async_sessionmaker(engine, expire_on_commit=False))
            contact = ContactCreate(
                phone_number="+9720500123456",
                notes="Manual notes: 100% complete",
                first_name="Ada",
                last_name="Lovelace",
                google_docs_link="https://docs.google.com/document/d/example/edit",
            )
            saved = await store.add_contact(contact, user_id=1)
            self.assertEqual(await store.get_all_contacts(user_id=2), [])
            self.assertIsNone(await store.get_contact_by_id(saved.id, user_id=2))
            self.assertIsNone(
                await store.update_contact(saved.id, ContactUpdate(), user_id=2)
            )
            self.assertIsNone(
                await store.update_contact(
                    saved.id, ContactUpdate(notes="other"), user_id=2
                )
            )
            self.assertIsNone(await store.replace_contact(saved.id, contact, user_id=2))
            self.assertFalse(await store.delete_contact(saved.id, user_id=2))
            contacts = await store.get_all_contacts(user_id=1)
            self.assertEqual(len(contacts), 1)
            self.assertEqual(saved, contacts[0])
            self.assertEqual(
                saved.model_dump(exclude={"id", "created_at"}), contact.model_dump()
            )
            self.assertEqual(await store.get_contact_by_id(saved.id, user_id=1), saved)
            for field, term in (
                ("notes", "100%"),
                ("first_name", "Ada"),
                ("last_name", "Lovelace"),
            ):
                self.assertEqual(
                    await store.search_contacts(**{field: term}, user_id=1), [saved]
                )
            self.assertEqual(await store.search_contacts(notes="_", user_id=1), [])
            patched = await store.update_contact(
                saved.id, ContactUpdate(first_name="Augusta", notes=None), user_id=1
            )
            self.assertIsNotNone(patched)
            assert patched is not None
            self.assertEqual(patched.first_name, "Augusta")
            self.assertIsNone(patched.notes)
            self.assertEqual(patched.last_name, saved.last_name)
            self.assertEqual(patched.phone_number, saved.phone_number)
            self.assertEqual(patched.created_at, saved.created_at)
            self.assertEqual(
                await store.get_contact_by_id(saved.id, user_id=1), patched
            )
            self.assertEqual(
                await store.update_contact(saved.id, ContactUpdate(), user_id=1),
                patched,
            )
            replacement = ContactCreate(first_name="Grace", last_name="Hopper")
            updated = await store.replace_contact(saved.id, replacement, user_id=1)
            self.assertIsNotNone(updated)
            assert updated is not None
            self.assertEqual(updated.id, saved.id)
            self.assertEqual(updated.created_at, saved.created_at)
            self.assertEqual(
                await store.get_contact_by_id(saved.id, user_id=1), updated
            )
            self.assertEqual(
                updated.model_dump(exclude={"id", "created_at"}),
                replacement.model_dump(),
            )
            self.assertTrue(await store.delete_contact(saved.id, user_id=1))
            self.assertEqual(await store.get_all_contacts(user_id=1), [])
            self.assertIsNone(await store.get_contact_by_id(saved.id, user_id=1))
            self.assertFalse(await store.delete_contact(saved.id, user_id=1))
            self.assertIsNone(
                await store.replace_contact(saved.id, replacement, user_id=1)
            )
            self.assertIsNone(
                await store.update_contact(saved.id, ContactUpdate(), user_id=1)
            )
            self.assertIsNone(
                await store.update_contact(
                    saved.id, ContactUpdate(notes="Missing"), user_id=1
                )
            )
        finally:
            await engine.dispose()


if __name__ == "__main__":
    unittest.main()
