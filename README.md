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

GitHub Actions runs backend lint, formatting, and unit tests plus frontend
formatting, tests, and the production build on pushes and pull requests.
Backend tests use SQLite and dummy settings; no repository secrets are required.

## Docker Compose

Compose runs only the backend and frontend. Set `DATABASE_URL` in `.env` to
your existing PostgreSQL database. For a database on the Docker host, use
`host.docker.internal` instead of `localhost` in the connection URL.
The backend receives `.env` at runtime; it is excluded from image builds.

```sh
docker compose build
docker compose run --rm --no-deps backend alembic -c pyproject.toml upgrade head
docker compose up -d
```

Open the frontend at [http://localhost:8081](http://localhost:8081) and API docs
at [http://localhost:8000/scalar](http://localhost:8000/scalar).
The frontend proxies `/contacts` and `/appointments` to the backend, so no
frontend API URL or browser CORS configuration is needed. Both published ports
listen on localhost. Set `FRONTEND_PORT` or `BACKEND_PORT` in `.env` to change them.

```sh
docker compose down
```
