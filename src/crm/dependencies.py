from collections.abc import AsyncIterator
from functools import lru_cache
from typing import Annotated

import jwt
from fastapi import HTTPException, Request
from fastapi.params import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from crm.bl import AppointmentService
from crm.data import AbstractContactStore, AbstractUserStore
from crm.models.settings import Settings
from crm.models.user import User


@lru_cache
def get_settings() -> Settings:
    return Settings()


async def get_current_user(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    token: Annotated[str, Depends(OAuth2PasswordBearer(tokenUrl="/auth/login"))],
) -> User:
    try:
        data = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id = int(data["sub"])
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    user = await request.app.state.user_store.get_user(user_id)
    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def get_user_store(request: Request) -> AbstractUserStore:
    return request.app.state.user_store


async def get_contact_store(request: Request) -> AbstractContactStore:
    return request.app.state.contact_store


async def get_appointment_service(request: Request) -> AppointmentService:
    return request.app.state.appointment_service


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    async with request.app.state.session_factory() as session:
        yield session
