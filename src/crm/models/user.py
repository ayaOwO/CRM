from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class User(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str = Field(max_length=50)
    email: str = Field(max_length=200)
    password: str | None = None
    settings: dict[str, Any] = Field(default_factory=dict)
