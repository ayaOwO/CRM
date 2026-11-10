from datetime import timedelta

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    guest_cookie_secure: bool = True
    booking_captcha_site_key: str = ""
    booking_captcha_secret: str = ""
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

    @model_validator(mode="after")
    def captcha_keys(self):
        if bool(self.booking_captcha_site_key) != bool(self.booking_captcha_secret):
            raise ValueError("Configure both booking CAPTCHA keys or leave both empty")
        return self
