import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import logfire
from fastapi import Depends, FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from scalar_fastapi import add_scalar_reference
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from crm.bl import AppointmentService
from crm.data import SqlContactStore, SqlUserStore
from crm.data.sql_scheduler_store import SqlSchedulerStore
from crm.dependencies import get_settings
from crm.routers import appointments, contacts, credentials, scheduler, user


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    url = make_url(settings.database_url)
    engine = create_async_engine(url)
    try:
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        app.state.session_factory = session_factory
        app.state.contact_store = SqlContactStore(session_factory)
        app.state.appointment_service = AppointmentService(session_factory)
        app.state.user_store = SqlUserStore(session_factory)
        app.state.scheduler_store = SqlSchedulerStore(
            session_factory,
            link_settings=settings.scheduler_link,
            link_secret=settings.secret_key,
        )
        yield
    finally:
        await engine.dispose()


app = FastAPI(lifespan=lifespan)

logfire.configure(service_name="crm", environment=get_settings().logfire_environment)
logging.getLogger().addHandler(logfire.LogfireLoggingHandler())
logging.getLogger().setLevel(logging.INFO)
logging.getLogger("crm").setLevel(logging.DEBUG)
logfire.instrument_pydantic_ai(include_content=False, include_binary_content=False)
# Keep patient data out of validated argument and validation error telemetry.
logfire.instrument_fastapi(
    app, request_attributes_mapper=lambda _request, _attributes: None
)
logfire.instrument_system_metrics()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/token")
app.include_router(contacts.router, dependencies=[Depends(oauth2_scheme)])
app.include_router(appointments.router, dependencies=[Depends(oauth2_scheme)])
app.include_router(credentials.router)
app.include_router(scheduler.router)
app.include_router(user.router, dependencies=[Depends(oauth2_scheme)])

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_allowed_origins,
    allow_methods=["*"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "X-Booking-Token",
        "X-Captcha-Token",
    ],
    allow_credentials=True,
)


@app.head("/")
async def health_check():
    return Response(status_code=200)


@app.get("/")
@app.get("/status")
async def root() -> dict[str, str]:
    return {"service": "crm"}


add_scalar_reference(app)
