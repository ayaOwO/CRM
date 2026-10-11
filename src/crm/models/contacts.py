from datetime import datetime

from pydantic import ConfigDict

from crm.models.requests.contact_create import ContactCreate


class Contact(ContactCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
