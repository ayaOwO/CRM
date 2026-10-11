import logfire
from fastapi import FastAPI

from crm.routers import contacts

app = FastAPI()

logfire.configure(service_name="crm")
logfire.instrument_pydantic_ai(include_content=False, include_binary_content=False)
logfire.instrument_fastapi(app)

app.include_router(contacts.router)


@app.get("/")
async def root() -> dict[str, str]:
    return {"service": "crm"}
