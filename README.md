# CRM

Run the FastAPI service from the repository root:

```sh
uv run uvicorn crm.main:app --host 127.0.0.1 --port 8000
```

`GET /` returns the service identity. Contact routes are currently placeholders
and return HTTP 501.

Logfire instruments FastAPI requests and Pydantic AI under service name `crm`.
AI prompts, responses, and binary content are not captured. Local development
uses the saved, gitignored `.logfire/` SDK credential for the EU `books/crm`
project. Keep credentials out of source control.

The SQL store uses the `contacts` table with `phone_number`, `notes`,
`first_name`, `last_name`, and `google_docs_link`, plus an ID and creation time.
First and last names are required; the other contact fields are optional.

Run the local persistence check with temporary SQLite async support:

```sh
uv run --frozen --with aiosqlite python -m unittest discover -s tests
```
