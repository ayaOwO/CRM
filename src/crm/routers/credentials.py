from datetime import datetime, timezone, timedelta
from typing import Annotated, Any

import jwt
from argon2 import PasswordHasher
from fastapi import APIRouter, Depends, status, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from crm.data import AbstractUserStore
from crm.dependencies import get_user_store, get_settings
from crm.models import UserCreate, Settings

router = APIRouter(prefix="/auth")
UserStore = Annotated[AbstractUserStore, Depends(get_user_store)]


@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def create_contact(create_request: UserCreate, store: UserStore):
    await store.create_user(create_request)


@router.post("/login", status_code=status.HTTP_200_OK)
async def login(settings: Annotated[Settings, get_settings], form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
                store: UserStore) -> tuple[dict[str, Any], Any]:
    user = await store.get_user(form_data.username, with_password=True)
    hasher = PasswordHasher()
    if not user or user.password is None:
        hasher.verify(form_data.password, hasher.hash("dummy"))
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    hasher.verify(user.password, form_data.password)

    current_utc_time = datetime.now(tz=timezone.utc)
    token = jwt.encode(
        {"sub": user.id, "iat": current_utc_time, "exp": current_utc_time + settings.access_token_expire_minutes},
        settings.secret_key,
        settings.algorithm)
    return user.settings, token
