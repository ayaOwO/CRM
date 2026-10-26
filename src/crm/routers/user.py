from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status

from crm.data import AbstractUserStore
from crm.dependencies import get_current_user, get_user_store
from crm.models import User
from crm.models.requests.user_settings import UserSettings

router = APIRouter(prefix="/user")


@router.get("/settings", status_code=status.HTTP_200_OK)
async def get_user_settings(user: Annotated[User, Depends(get_current_user)]):
    return user.settings


@router.put("/settings")
async def set_user_settings(
    settings: UserSettings,
    user: Annotated[User, Depends(get_current_user)],
    store: Annotated[AbstractUserStore, Depends(get_user_store)],
) -> dict[str, Any]:
    saved = await store.set_user_settings(
        user.id, settings.model_dump(by_alias=True, exclude_unset=True)
    )
    if saved is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    return saved
