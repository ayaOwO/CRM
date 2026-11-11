from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import AwareDatetime
from sqlalchemy.ext.asyncio import AsyncSession

from crm.bl import AppointmentService
from crm.dependencies import get_appointment_service, get_current_user, get_session
from crm.models import User
from crm.models.appointments import Appointment
from crm.models.requests.appointment_create import AppointmentCreate
from crm.models.requests.appointment_update import AppointmentUpdate

router = APIRouter(
    prefix="/appointments",
    tags=["appointments"],
)
Appointments = Annotated[AppointmentService, Depends(get_appointment_service)]
UserInfo = Annotated[User, Depends(get_current_user)]
DatabaseSession = Annotated[AsyncSession, Depends(get_session)]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_appointment(
    appointment: AppointmentCreate,
    service: Appointments,
    user: UserInfo,
    session: DatabaseSession,
) -> Appointment:
    try:
        return await service.add_appointment(
            appointment, user_id=user.id, session=session
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("")
async def list_appointments(
    service: Appointments,
    user: UserInfo,
    session: DatabaseSession,
    start_time: AwareDatetime,
    end_time: AwareDatetime,
) -> list[Appointment]:
    try:
        return await service.list_appointments(
            start_time, end_time, user_id=user.id, session=session
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/{appointment_id}")
async def get_appointment(
    appointment_id: int, service: Appointments, user: UserInfo, session: DatabaseSession
) -> Appointment:
    appointment = await service.get_appointment(
        appointment_id, user_id=user.id, session=session
    )
    if appointment is None:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appointment


@router.patch("/{appointment_id}")
async def update_appointment(
    appointment_id: int,
    appointment: AppointmentUpdate,
    service: Appointments,
    user: UserInfo,
    session: DatabaseSession,
) -> Appointment:
    try:
        saved = await service.update_appointment(
            appointment_id, appointment, user_id=user.id, session=session
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if saved is None:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return saved


@router.delete("/{appointment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_appointment(
    appointment_id: int, service: Appointments, user: UserInfo, session: DatabaseSession
) -> None:
    if not await service.delete_appointment(
        appointment_id, user_id=user.id, session=session
    ):
        raise HTTPException(status_code=404, detail="Appointment not found")
