from datetime import datetime
from typing import Any

from sqlalchemy import JSON, TIMESTAMP, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from crm.models.orm.base import Base


class SchedulersTable(Base):
    __tablename__ = "schedulers"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    code_hash: Mapped[str | None] = mapped_column(String(64), unique=True)
    data: Mapped[dict[str, Any]] = mapped_column(JSON)


class GuestSessionsTable(Base):
    __tablename__ = "guest_sessions"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    expires_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True))


class GuestBookingsTable(Base):
    __tablename__ = "guest_bookings"
    appointment_id: Mapped[int] = mapped_column(
        ForeignKey("appointments.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    scheduler_id: Mapped[int | None] = mapped_column(
        ForeignKey("schedulers.id", ondelete="SET NULL")
    )
    session_hash: Mapped[str] = mapped_column(
        ForeignKey("guest_sessions.token_hash"), index=True
    )
    management_hash: Mapped[str] = mapped_column(String(64), unique=True)
    policy: Mapped[dict[str, Any]] = mapped_column(JSON)


class BookingRateLimitsTable(Base):
    __tablename__ = "booking_rate_limits"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    window: Mapped[int]
    attempts: Mapped[int]
