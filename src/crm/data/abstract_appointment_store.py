from abc import ABC, abstractmethod

from pydantic import AwareDatetime

from crm.models.appointments import Appointment
from crm.models.requests.appointment_create import AppointmentCreate
from crm.models.requests.appointment_update import AppointmentUpdate


class AbstractAppointmentStore(ABC):
    @abstractmethod
    async def add_appointment(
        self, appointment: AppointmentCreate, *, user_id: int
    ) -> Appointment:
        pass

    @abstractmethod
    async def get_appointment(
        self, appointment_id: int, *, user_id: int
    ) -> Appointment | None:
        pass

    @abstractmethod
    async def list_appointments(
        self,
        start_time: AwareDatetime,
        end_time: AwareDatetime,
        *,
        user_id: int,
    ) -> list[Appointment]:
        pass

    @abstractmethod
    async def update_appointment(
        self, appointment_id: int, update: AppointmentUpdate, *, user_id: int
    ) -> Appointment | None:
        pass

    @abstractmethod
    async def delete_appointment(self, appointment_id: int, *, user_id: int) -> bool:
        pass
