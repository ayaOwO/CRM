from datetime import UTC, date, time
from itertools import pairwise
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)


class TimeSpan(BaseModel):
    start: time
    end: time

    @model_validator(mode="after")
    def valid(self):
        if self.start.tzinfo or self.end.tzinfo or self.end <= self.start:
            raise ValueError(
                "Use local times with end after start; split overnight hours by day"
            )
        return self


class WeeklySpan(TimeSpan):
    day: int = Field(ge=0, le=6, description="Monday=0, Sunday=6")


class DateOverride(BaseModel):
    date: date
    intervals: list[TimeSpan] = Field(default_factory=list, max_length=12)


class SchedulerData(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=120)
    location: str = Field(min_length=1, max_length=500)
    timezone: str = "Asia/Jerusalem"
    duration_minutes: int = Field(default=90, ge=5, le=1440)
    buffer_minutes: int = Field(default=15, ge=0, le=1440)
    slot_minutes: int = Field(default=30, ge=5, le=1440)
    min_notice_hours: int = Field(default=24, ge=0, le=8760)
    max_advance_days: int = Field(default=60, ge=1, le=365)
    window_start: AwareDatetime | None = None
    window_end: AwareDatetime | None = None
    cancel_notice_hours: int = Field(default=24, ge=0, le=8760)
    allow_cancel: bool = True
    allow_reschedule: bool = True
    price: str = Field(default="", max_length=120)
    terms: str = Field(default="", max_length=4000)
    repeat: list[WeeklySpan] = Field(default_factory=list, max_length=84)
    overrides: list[DateOverride] = Field(default_factory=list, max_length=366)

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise ValueError("Unknown IANA timezone") from exc
        return value

    @field_validator("window_start", "window_end")
    @classmethod
    def utc(cls, value):
        return value.astimezone(UTC) if value else None

    @model_validator(mode="after")
    def valid(self):
        if (
            self.window_start
            and self.window_end
            and self.window_end <= self.window_start
        ):
            raise ValueError("Booking window end must follow its start")
        if len({o.date for o in self.overrides}) != len(self.overrides):
            raise ValueError("Only one override is allowed per date")
        groups = [[r for r in self.repeat if r.day == day] for day in range(7)]
        groups += [o.intervals for o in self.overrides]
        for group in groups:
            spans = sorted(group, key=lambda s: s.start)
            if any(a.end > b.start for a, b in pairwise(spans)):
                raise ValueError("Availability intervals must not overlap")
        return self


class Scheduler(SchedulerData):
    id: int


class SchedulerCreated(Scheduler):
    booking_path: str


class GuestDetails(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    phone_number: str = Field(min_length=7, max_length=30)

    @field_validator("first_name", "last_name")
    @classmethod
    def clean_name(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Name is required")
        return value

    @field_validator("phone_number")
    @classmethod
    def phone(cls, value):
        # Match formatting variants; country codes must be supplied consistently.
        value = "".join(c for c in value if c.isascii() and c.isdigit())
        if not 7 <= len(value) <= 15:
            raise ValueError("Phone number must contain 7 to 15 digits")
        return value


class BookingCreate(GuestDetails):
    model_config = ConfigDict(extra="forbid")
    start_time: AwareDatetime
    notes: str = Field(default="", max_length=2000)
    website: str = Field(default="", max_length=200, description="Leave empty")


class BookingMove(BaseModel):
    model_config = ConfigDict(extra="forbid")
    start_time: AwareDatetime


class GuestBooking(BaseModel):
    id: int
    title: str
    location: str
    timezone: str
    start_time: AwareDatetime
    end_time: AwareDatetime
    cancel_notice_hours: int
    allow_cancel: bool
    allow_reschedule: bool
    scheduler_available: bool


class BookingCreated(GuestBooking):
    management_path: str
