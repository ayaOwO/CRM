from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError

from crm.data import AbstractContactStore
from crm.dependencies import get_contact_store
from crm.models.contacts import Contact
from crm.models.requests.contact_create import ContactCreate
from crm.models.requests.contact_update import ContactUpdate

router = APIRouter(prefix="/contacts", tags=["contacts"])
ContactStore = Annotated[AbstractContactStore, Depends(get_contact_store)]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_contact(contact: ContactCreate, store: ContactStore) -> Contact:
    return await store.add_contact(contact)


@router.get("")
async def list_contacts(
    store: ContactStore,
    first_name: str | None = None,
    last_name: str | None = None,
    notes: str | None = None,
) -> list[Contact]:
    return await store.search_contacts(
        first_name=first_name,
        last_name=last_name,
        notes=notes,
    )


@router.get("/{id}")
async def get_contact(id: int, store: ContactStore) -> Contact:
    contact = await store.get_contact_by_id(id)
    if contact is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found"
        )
    return contact


@router.put("/{id}")
async def replace_contact(
    id: int, contact: ContactCreate, store: ContactStore
) -> Contact:
    saved = await store.replace_contact(id, contact)
    if saved is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found"
        )
    return saved


@router.patch("/{id}")
async def update_contact(
    id: int, contact: ContactUpdate, store: ContactStore
) -> Contact:
    saved = await store.update_contact(id, contact)
    if saved is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found"
        )
    return saved


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(id: int, store: ContactStore) -> None:
    try:
        deleted = await store.delete_contact(id)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Contact is referenced by appointments",
        ) from exc
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found"
        )
