from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import AwareDatetime

from crm.data import AbstractAppointmentStore
from crm.dependencies import get_appointment_store
from crm.models.appointments import Appointment
from crm.models.requests.appointment_create import AppointmentCreate
from crm.models.requests.appointment_update import AppointmentUpdate

router = APIRouter(prefix="/appointments", tags=["appointments"])
AppointmentStore = Annotated[AbstractAppointmentStore, Depends(get_appointment_store)]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_appointment(
    appointment: AppointmentCreate, store: AppointmentStore
) -> Appointment:
    try:
        return await store.add_appointment(appointment)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("")
async def list_appointments(
    store: AppointmentStore,
    start_time: AwareDatetime | None = None,
    end_time: AwareDatetime | None = None,
) -> list[Appointment]:
    if start_time is not None and end_time is not None and end_time <= start_time:
        raise HTTPException(status_code=422, detail="end_time must be after start_time")
    return await store.list_appointments(start_time, end_time)


@router.get("/{id}")
async def get_appointment(id: int, store: AppointmentStore) -> Appointment:
    appointment = await store.get_appointment(id)
    if appointment is None:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appointment


@router.patch("/{id}")
async def update_appointment(
    id: int, appointment: AppointmentUpdate, store: AppointmentStore
) -> Appointment:
    try:
        saved = await store.update_appointment(id, appointment)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if saved is None:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return saved


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_appointment(id: int, store: AppointmentStore) -> None:
    if not await store.delete_appointment(id):
        raise HTTPException(status_code=404, detail="Appointment not found")
