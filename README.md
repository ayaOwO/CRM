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

## Appointment scheduling (issue #8)

Open **תיאום פגישות** after signing in to create a meeting type, weekly hours,
date overrides, booking window and cancellation policy. Days use Monday=0 through
Sunday=6. An override replaces the complete day; an empty interval list closes it.
Hours use the meeting type's IANA timezone. DST gaps are skipped; repeated wall
times use their first occurrence. The appointment must fit entirely in the window.

Creation returns a reusable `/book/<code>` link. Save it when shown: only the hash
is stored. **יצירת קישור חדש** rotates the code and invalidates the previous link.
New codes are derived from the user and scheduler IDs using HMAC and `SECRET_KEY`.
`SchedulerLinkSettings` groups the hash algorithm and code length:
`SCHEDULER_LINK_HASH_NAME` defaults to `sha256` (also supports `sha384` and `sha512`),
and `SCHEDULER_LINK_LENGTH` defaults to `6` (range `6`–`43`).
The unique database constraint rejects collisions, which retry with a deterministic
counter. Settings edits preserve the link; changing the hash, length or secret affects
only newly created or explicitly replaced links. Short public booking codes are
easier to guess; private management tokens remain long and random.
Deleting a meeting type disables new bookings and rescheduling, while preserving
existing appointments and their original cancellation policy.

Guests need no account. An HttpOnly, SameSite cookie restores their upcoming
bookings for the organizer. Each new appointment also returns a private
`/manage#<token>` link; save it for another device or after cookie loss. This link
is a bearer credential. Its token is sent in a header, not a query parameter, and
only its hash is stored. Phone numbers match contacts within an organizer and
never authorize appointment access. Supply country codes consistently; formatted
variants are matched but local numbers are not automatically country-converted.

The backend enforces one upcoming appointment per guest session per organizer,
rechecks availability transactionally, and serializes calendar writes using the
owner's PostgreSQL row lock. Manual writes honor guest-booking conflicts and
buffers. Existing manual-to-manual overlap behavior is retained. Failed moves
leave the original appointment intact. Changing meeting settings does not alter
existing appointments or their accepted cancellation policy. Calendar export is
an ICS download, not a live calendar subscription.

Production requires HTTPS. `GUEST_COOKIE_SECURE` defaults to `true`; set it to
`false` only for local HTTP development. Prefer same-origin frontend/API hosting.
The Nginx and Vite configs route `/scheduler`, `/booking`, and `/guest` to the API
and serve `/book/<code>` and `/manage` as frontend pages.

Booking and management writes have database-backed limits (15 attempts per hour
per session and per IP), with a hidden spam field on booking. Configure the ASGI
server's trusted proxy addresses explicitly so IP limits use the actual visitor,
not a shared proxy. Cookie deletion can bypass the per-session appointment limit;
this is spam reduction, not verified identity. For CAPTCHA, configure both
`BOOKING_CAPTCHA_SITE_KEY` and `BOOKING_CAPTCHA_SECRET` with Cloudflare Turnstile
keys. No SMS or email service is required. Configure a retention policy for guest
sessions/bookings appropriate to your deployment; rate counters self-prune.

Run normal backend tests as above. To additionally exercise real simultaneous
requests, supply a **disposable** PostgreSQL URL (the test creates synthetic rows):

```sh
CRM_SCHEDULER_TEST_DATABASE_URL=postgresql+psycopg://... \
  uv run python -m unittest discover -s tests -p test_scheduler_postgres.py -v
```
