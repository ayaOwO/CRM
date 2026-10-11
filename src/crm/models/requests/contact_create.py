from pydantic import BaseModel, Field


class ContactCreate(BaseModel):
    phone_number: str | None = Field(default=None, max_length=50)
    notes: str | None = None
    first_name: str = Field(min_length=1, max_length=255)
    last_name: str = Field(min_length=1, max_length=255)
    google_docs_link: str | None = None
