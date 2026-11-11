from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class SchedulerLinkSettings(BaseSettings):
    hash_name: Literal["sha256", "sha384", "sha512"] = "sha256"
    length: int = Field(default=6, ge=6, le=43)

    model_config = SettingsConfigDict(
        env_prefix="SCHEDULER_LINK_", env_file=".env", extra="ignore"
    )
