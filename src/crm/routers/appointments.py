from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import AwareDatetime

from crm.data import AbstractAppointmentStore
from crm.dependencies import get_appointment_store, get_current_user
from crm.models import User
from crm.models.appointments import Appointment
from crm.models.requests.appointment_create import AppointmentCreate
from crm.models.requests.appointment_update import AppointmentUpdate

router = APIRouter(
    prefix="/appointments",
    tags=["appointments"],
)
AppointmentStore = Annotated[AbstractAppointmentStore, Depends(get_appointment_store)]
UserInfo = Annotated[User, Depends(get_current_user)]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_appointment(
    appointment: AppointmentCreate, store: AppointmentStore, user: UserInfo
) -> Appointment:
    try:
        return await store.add_appointment(appointment, user_id=user.id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("")
async def list_appointments(
    store: AppointmentStore,
    user: UserInfo,
    start_time: AwareDatetime | None = None,
    end_time: AwareDatetime | None = None,
) -> list[Appointment]:
    if start_time is not None and end_time is not None and end_time <= start_time:
        raise HTTPException(status_code=422, detail="end_time must be after start_time")
    return await store.list_appointments(start_time, end_time, user_id=user.id)


@router.get("/{appointment_id}")
async def get_appointment(
    appointment_id: int, store: AppointmentStore, user: UserInfo
) -> Appointment:
    appointment = await store.get_appointment(appointment_id, user_id=user.id)
    if appointment is None:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appointment


@router.patch("/{appointment_id}")
async def update_appointment(
    appointment_id: int,
    appointment: AppointmentUpdate,
    store: AppointmentStore,
    user: UserInfo,
) -> Appointment:
    try:
        saved = await store.update_appointment(
            appointment_id, appointment, user_id=user.id
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if saved is None:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return saved


@router.delete("/{appointment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_appointment(
    appointment_id: int, store: AppointmentStore, user: UserInfo
) -> None:
    if not await store.delete_appointment(appointment_id, user_id=user.id):
        raise HTTPException(status_code=404, detail="Appointment not found")
