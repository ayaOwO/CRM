from functools import lru_cache
from typing import Annotated, Any

from argon2 import PasswordHasher
from fastapi import Request
from fastapi.params import Depends
from fastapi.security import OAuth2PasswordBearer

from crm.data import AbstractAppointmentStore, AbstractContactStore, AbstractUserStore
from crm.models.settings import Settings


@lru_cache
def get_settings() -> Settings:
    return Settings()


async def get_current_user(
        request: Request, token: Annotated[str, Depends(OAuth2PasswordBearer)]
) -> Any | None:
    user = await request.app.state.user_store.get_user(token, with_password=True)
    if user is None or not user.password:
        return None
    stored_token = user.password
    ph = PasswordHasher()
    if ph.verify(stored_token, token):
        return await request.app.state.user_store.get_user(token)
    return None


async def get_user_store(request: Request) -> AbstractUserStore:
    return request.app.state.user_store


async def get_contact_store(request: Request) -> AbstractContactStore:
    return request.app.state.contact_store


async def get_appointment_store(request: Request) -> AbstractAppointmentStore:
    return request.app.state.appointment_store
