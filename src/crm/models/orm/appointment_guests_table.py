from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from crm.models.orm.base import Base


class AppointmentGuestsTable(Base):
    __tablename__ = "appointment_guests"

    appointment_id: Mapped[int] = mapped_column(
        ForeignKey("appointments.id", ondelete="CASCADE"), primary_key=True
    )
    contact_id: Mapped[int] = mapped_column(
        ForeignKey("contacts.id", ondelete="RESTRICT"), primary_key=True, index=True
    )
