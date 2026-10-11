from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    openai_api_key: str = Field(default="")
    openai_endpoint: str = Field()
    openai_model: str = Field()
    database_url: str = Field()
    logfire_environment: str = Field()
    cors_allowed_origins: list[str] = Field()
    model_config = SettingsConfigDict(env_file=".env")
