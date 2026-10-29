import logging
from datetime import UTC, datetime
from typing import Annotated

import argon2.exceptions
import jwt
from argon2 import PasswordHasher
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from crm.data import AbstractUserStore
from crm.dependencies import get_settings, get_user_store
from crm.models import Settings, UserCreate

router = APIRouter(prefix="/auth")
logger = logging.getLogger(__name__)
UserStore = Annotated[AbstractUserStore, Depends(get_user_store)]


@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def create_contact(create_request: UserCreate, store: UserStore):
    try:
        await store.create_user(create_request)
    except Exception as e:
        logger.error(e)
        raise HTTPException(status_code=status.HTTP_409_CONFLICT)


@router.post("/login", status_code=status.HTTP_200_OK)
async def login(
        settings: Annotated[Settings, Depends(get_settings)],
        form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
        store: UserStore,
) -> str:
    logger.debug("Login requested")
    try:
        user = await store.get_user(form_data.username, with_password=True)
        hasher = PasswordHasher()
        if not user or user.password is None:
            hasher.verify(hasher.hash("dummy"), form_data.password)
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
        hasher.verify(user.password, form_data.password)
        logger.debug("user %s has a correct password", user.username)

        current_utc_time = datetime.now(tz=UTC)
        logger.debug("creating jwt")
        token = jwt.encode(
            {
                "sub": str(user.id),
                "iat": current_utc_time,
                "exp": current_utc_time + settings.access_token_expire_minutes,
            },
            settings.secret_key,
            settings.algorithm,
        )
        return token
    except argon2.exceptions.VerifyMismatchError as exc:
        logger.error(exc)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
