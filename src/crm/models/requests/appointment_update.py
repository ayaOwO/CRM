from pydantic import AwareDatetime, BaseModel, Field, field_validator


class AppointmentUpdate(BaseModel):
    guests: list[int] | None = None
    location: str | None = Field(default=None, min_length=1)
    start_time: AwareDatetime | None = None
    end_time: AwareDatetime | None = None

    @field_validator("guests", "location", "start_time", "end_time")
    @classmethod
    def reject_null(cls, value):
        if value is None:
            raise ValueError("Appointment fields cannot be null")
        return value
