from pydantic import BaseModel, Field, field_validator


class ContactUpdate(BaseModel):
    phone_number: str | None = Field(default=None, max_length=50)
    notes: str | None = None
    first_name: str | None = Field(default=None, min_length=1, max_length=255)
    last_name: str | None = Field(default=None, min_length=1, max_length=255)
    google_docs_link: str | None = None

    @field_validator("first_name", "last_name")
    @classmethod
    def reject_null_name(cls, value: str | None) -> str:
        if value is None:
            raise ValueError("Contact names cannot be null")
        return value
