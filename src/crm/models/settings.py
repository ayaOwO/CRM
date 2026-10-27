from datetime import timedelta

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    openai_api_key: str = Field(default="")
    openai_endpoint: str = Field()
    openai_model: str = Field()
    database_url: str = Field()
    logfire_environment: str = Field()
    cors_allowed_origins: list[str] = Field()
    google_client_id: str = Field()
    google_client_secret: str = Field()
    secret_key: str = Field()
    algorithm: str = Field(default="HS256")
    access_token_expire_minutes: timedelta = Field(
        default=timedelta(minutes=60 * 24 * 7)
    )
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
