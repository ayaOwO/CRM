from functools import lru_cache

from fastapi import Request

from crm.data import AbstractAppointmentStore, AbstractContactStore
from crm.models.settings import Settings


@lru_cache
def get_settings() -> Settings:
    return Settings()


async def get_contact_store(request: Request) -> AbstractContactStore:
    return request.app.state.contact_store


async def get_appointment_store(request: Request) -> AbstractAppointmentStore:
    return request.app.state.appointment_store
