from datetime import datetime

from sqlalchemy import TIMESTAMP, CheckConstraint, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from crm.models.orm.appointment_guests_table import AppointmentGuestsTable
from crm.models.orm.base import Base


class AppointmentsTable(Base):
    __tablename__ = "appointments"
    __table_args__ = (
        CheckConstraint("end_time > start_time", name="ck_appointments_time_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    location: Mapped[str] = mapped_column(Text)
    start_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), index=True)
    end_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True))
    guest_links: Mapped[list[AppointmentGuestsTable]] = relationship(
        cascade="all, delete-orphan", passive_deletes=True, lazy="selectin"
    )
