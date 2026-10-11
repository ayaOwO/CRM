import contextlib
from pathlib import Path

import logfire
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from starlette.responses import HTMLResponse

from knowledgesystem.data import SqlDocumentStore
from knowledgesystem.dependencies import get_settings
from knowledgesystem.routers import knowledge_store


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    engine = create_async_engine(settings.database_url)
    session_factory: async_sessionmaker = async_sessionmaker(
        engine, expire_on_commit=False
    )
    app.state.session_factory = session_factory
    app.state.document_store = SqlDocumentStore(session_factory)
    yield
    await engine.dispose()


app = FastAPI(lifespan=lifespan)

logfire.configure()
logfire.instrument_pydantic_ai()
logfire.instrument_fastapi(app)

app.include_router(knowledge_store.router)


@app.get("/")
async def root():
    return HTMLResponse((Path(__file__).parent / "front" / "index.html").read_text())
