import hashlib
import hmac
from datetime import date, datetime
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from pydantic import ValidationError

from crm.data.sql_scheduler_store import SqlSchedulerStore
from crm.dependencies import get_current_user, get_settings
from crm.models.scheduler import (
    BookingCreate,
    BookingCreated,
    BookingMove,
    GuestBooking,
    Scheduler,
    SchedulerCreated,
    SchedulerData,
)
from crm.models.settings import Settings
from crm.models.user import User

router = APIRouter(tags=["scheduler"])
UserInfo = Annotated[User, Depends(get_current_user)]
COOKIE = "crm_guest"
Config = Annotated[Settings, Depends(get_settings)]


def store(request: Request) -> SqlSchedulerStore:
    return request.app.state.scheduler_store


Store = Annotated[SqlSchedulerStore, Depends(store)]


async def guest(
    request: Request, response: Response, db: Store, settings: Config
) -> str:
    # JSON-only mutations + SameSite cookies prevent cross-site form requests.
    if request.method in {"POST", "PATCH", "DELETE"}:
        if request.headers.get("sec-fetch-site") == "cross-site":
            raise HTTPException(403, "Cross-site booking requests are not allowed")
        if not request.headers.get("content-type", "").startswith("application/json"):
            raise HTTPException(415, "Use application/json")
    token, fresh = await db.guest_session(request.cookies.get(COOKIE))
    if fresh:
        response.set_cookie(
            COOKIE,
            token,
            max_age=365 * 86400,
            httponly=True,
            secure=settings.guest_cookie_secure,
            samesite="lax",
            path="/",
        )
    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    return token


Guest = Annotated[str, Depends(guest)]
Management = Annotated[str | None, Header(alias="X-Booking-Token", max_length=200)]


async def throttle(
    request: Request, db: SqlSchedulerStore, token: str, settings: Settings
):
    # Do not trust arbitrary X-Forwarded-For headers. Configure trusted proxy IPs
    # at the ASGI server; request.client then contains the verified peer address.
    if request.client:
        ip = request.client.host
    else:
        ip = "unknown"
    secret = settings.secret_key.encode()
    keys = [
        hmac.new(secret, v.encode(), hashlib.sha256).hexdigest()
        for v in ("ip:" + ip, "guest:" + token)
    ]
    await db.rate_limit(keys)


@router.post("/scheduler", status_code=201)
async def create_scheduler(
    body: SchedulerData, db: Store, user: UserInfo
) -> SchedulerCreated:
    return await db.create(body, user.id)


@router.get("/scheduler")
async def list_schedulers(db: Store, user: UserInfo) -> list[Scheduler]:
    return await db.list_schedulers(user.id)


@router.get("/scheduler/{scheduler_id}")
async def get_scheduler(scheduler_id: int, db: Store, user: UserInfo) -> Scheduler:
    return await db.get(scheduler_id, user.id)


@router.patch("/scheduler/{scheduler_id}")
async def update_scheduler(
    scheduler_id: int, changes: dict, db: Store, user: UserInfo
) -> Scheduler:
    try:
        return await db.update(scheduler_id, changes, user.id)
    except ValidationError as exc:
        raise HTTPException(
            422,
            "Invalid scheduler settings: " + "; ".join(e["msg"] for e in exc.errors()),
        ) from exc


@router.delete("/scheduler/{scheduler_id}", status_code=204)
async def delete_scheduler(scheduler_id: int, db: Store, user: UserInfo) -> None:
    await db.revoke(scheduler_id, user.id)


@router.post("/scheduler/{scheduler_id}/link")
async def rotate_link(scheduler_id: int, db: Store, user: UserInfo) -> dict[str, str]:
    return {"booking_path": await db.revoke(scheduler_id, user.id, rotate=True)}


@router.get("/booking/{code}")
async def public_info(code: str, db: Store, token: Guest, settings: Config) -> dict:
    data = await db.public_info(code)
    return data.model_dump(mode="json") | {
        "captcha_site_key": settings.booking_captcha_site_key
    }


@router.get("/booking/{code}/slots")
async def slots(
    code: str, first: date, last: date, db: Store, token: Guest
) -> list[datetime]:
    return await db.slots(code, first, last)


@router.post("/booking/{code}", status_code=201)
async def book(
    code: str,
    body: BookingCreate,
    request: Request,
    db: Store,
    token: Guest,
    settings: Config,
    captcha: Annotated[str | None, Header(alias="X-Captcha-Token")] = None,
) -> BookingCreated:
    await throttle(request, db, token, settings)
    if settings.booking_captcha_secret:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(
                    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
                    data={
                        "secret": settings.booking_captcha_secret,
                        "response": captcha or "",
                    },
                )
                response.raise_for_status()
                valid = response.json().get("success") is True
        except (httpx.HTTPError, ValueError) as exc:
            raise HTTPException(
                503, "Booking verification unavailable; try again"
            ) from exc
        if not valid:
            raise HTTPException(422, "Complete the booking verification and try again")
    return await db.create_booking(code, body, token)


@router.get("/guest/appointments")
async def guest_bookings(
    db: Store, token: Guest, code: str | None = None
) -> list[GuestBooking]:
    return await db.bookings(token, code)


@router.get("/guest/manage")
async def management_info(
    db: Store, token: Guest, management: Management = None
) -> GuestBooking:
    if not management:
        raise HTTPException(404, "Booking not found")
    return await db.manage_info(token, management)


@router.get("/guest/appointments/{booking_id}/slots")
async def move_slots(
    booking_id: int,
    first: date,
    last: date,
    db: Store,
    token: Guest,
    management: Management = None,
) -> list[datetime]:
    return await db.manage_slots(booking_id, token, management, first, last)


@router.patch("/guest/appointments/{booking_id}")
async def move(
    booking_id: int,
    body: BookingMove,
    request: Request,
    db: Store,
    token: Guest,
    settings: Config,
    management: Management = None,
) -> GuestBooking:
    await throttle(request, db, token, settings)
    return await db.change_booking(booking_id, token, management, body.start_time)


@router.delete("/guest/appointments/{booking_id}", status_code=204)
async def cancel(
    booking_id: int,
    request: Request,
    db: Store,
    token: Guest,
    settings: Config,
    management: Management = None,
) -> None:
    await throttle(request, db, token, settings)
    await db.change_booking(booking_id, token, management, None)
