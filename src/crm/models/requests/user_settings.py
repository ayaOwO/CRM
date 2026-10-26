from pydantic import BaseModel, ConfigDict, Field


class UserSettings(BaseModel):
    model_config = ConfigDict(extra="allow")

    theme_color: str = Field(
        default="#245c50", alias="themeColor", pattern=r"^#[0-9a-fA-F]{6}$"
    )
