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

from crm.data import SqlContactStore, SqlUserStore
from crm.data.sql_appointment_store import SqlAppointmentStore
from crm.dependencies import get_settings
from crm.routers import appointments, contacts, credentials, user


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    url = make_url(get_settings().database_url)
    engine = create_async_engine(url)
    try:
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        app.state.session_factory = session_factory
        app.state.contact_store = SqlContactStore(session_factory)
        app.state.appointment_store = SqlAppointmentStore(session_factory)
        app.state.user_store = SqlUserStore(session_factory)
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
app.include_router(user.router, dependencies=[Depends(oauth2_scheme)])

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_allowed_origins,
    allow_methods=["*"],
    allow_credentials=True,
)


@app.head("/")
async def health_check():
    return Response(status_code=200)


@app.get("/")
@app.get("/health")
async def root() -> dict[str, str]:
    return {"service": "crm"}


add_scalar_reference(app)
