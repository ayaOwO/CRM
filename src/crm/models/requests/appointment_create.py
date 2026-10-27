from datetime import UTC
from typing import Self

from pydantic import AwareDatetime, BaseModel, Field, field_validator, model_validator


class AppointmentCreate(BaseModel):
    guests: list[int] = Field(default_factory=list)
    location: str = Field(min_length=1)
    start_time: AwareDatetime
    end_time: AwareDatetime

    @field_validator("start_time", "end_time")
    @classmethod
    def normalize_time(cls, value: AwareDatetime) -> AwareDatetime:
        return value.astimezone(UTC)

    @field_validator("guests")
    @classmethod
    def unique_guests(cls, value: list[int]) -> list[int]:
        return list(dict.fromkeys(value))

    @model_validator(mode="after")
    def validate_time_range(self) -> Self:
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self
