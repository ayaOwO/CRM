# Run

From the repository root, install dependencies:

```sh
uv sync --frozen
```

Create `.env` with your PostgreSQL connection details:

```dotenv
DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/crm
OPENAI_ENDPOINT=
OPENAI_MODEL=
```

Apply migrations and start the server:

```sh
uv run alembic -c pyproject.toml upgrade head
uv run uvicorn crm.main:app --host 127.0.0.1 --port 8000
```

Open [http://127.0.0.1:8000/scalar](http://127.0.0.1:8000/scalar).
