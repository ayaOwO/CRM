from abc import ABC, abstractmethod
from datetime import datetime

from crm.models.appointments import Appointment
from crm.models.requests.appointment_create import AppointmentCreate
from crm.models.requests.appointment_update import AppointmentUpdate


class AbstractAppointmentStore(ABC):
    @abstractmethod
    async def add_appointment(self, appointment: AppointmentCreate) -> Appointment:
        pass

    @abstractmethod
    async def get_appointment(self, id: int) -> Appointment | None:
        pass

    @abstractmethod
    async def list_appointments(
        self, start_time: datetime | None = None, end_time: datetime | None = None
    ) -> list[Appointment]:
        pass

    @abstractmethod
    async def update_appointment(
        self, id: int, update: AppointmentUpdate
    ) -> Appointment | None:
        pass

    @abstractmethod
    async def delete_appointment(self, id: int) -> bool:
        pass
