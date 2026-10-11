from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import logfire
from fastapi import FastAPI
from scalar_fastapi import add_scalar_reference
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from crm.data import SqlContactStore
from crm.dependencies import get_settings
from crm.routers import contacts


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    url = make_url(get_settings().database_url)
    engine = create_async_engine(url)
    try:
        engine = engine
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        app.state.contact_store = SqlContactStore(session_factory)
        yield
    finally:
        await engine.dispose()


app = FastAPI(lifespan=lifespan)

logfire.configure(service_name="crm")
logfire.instrument_pydantic_ai(include_content=False, include_binary_content=False)
logfire.instrument_fastapi(app)
logfire.instrument_system_metrics()

app.include_router(contacts.router)


@app.get("/")
async def root() -> dict[str, str]:
    return {"service": "crm"}

add_scalar_reference(app)
