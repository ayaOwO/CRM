# קליניקה — Therapy CRM frontend

A Hebrew RTL therapist workspace built with React, TypeScript, MUI, FullCalendar, and Vite.
The output is static HTML/CSS/JavaScript. FastAPI serves only the API.

## Local development

Start the existing API on port 8000 using the repository README, then:

```sh
cd frontend
npm ci
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`). Requests to
`/auth`, `/user`, `/contacts`, and `/appointments` are proxied to `http://127.0.0.1:8000`.

```sh
npm test
npm run build
npm run preview
```

Preview serves the production bundle at `http://localhost:4173`, using the
same local API proxy. Upload `dist/` to a static host for deployment. No
Node server or Python static-file mount is required. Frontend navigation
uses local state rather than path routing, so an SPA fallback is unnecessary.

## Separate Render subdomains

For a frontend and API on different `*.onrender.com` subdomains, set
`VITE_API_BASE_URL=https://YOUR-API.onrender.com` in the static site environment
before building. Rebuild after changing it. Allow the exact frontend origin
in the backend CORS configuration. These are separate origins even though
they share the `onrender.com` suffix. This value is public; keep secrets
out of frontend environment variables.

The calendar uses [FullCalendar's MUI components](https://fullcalendar.io/docs/mui)
with Hebrew RTL month/week/day views, local times, and the saved MUI theme color.
Click a time slot to create a meeting or an existing meeting to edit it.
Only the day-grid, time-grid, and interaction plugins are loaded.
Month navigation loads the entire displayed date range, including adjacent-month days.

## Frontend organization

- `src/main.tsx`: React entrypoint.
- `src/app/`: providers, page navigation, and dialog wiring.
- `src/hooks/`: CRM data/history loading and form save/delete handlers.
- `src/views/`: dashboard, clients, and FullCalendar views.
- `src/components/`: shared components and dialogs.
- `src/lib/`: API transport, contact helpers, and calendar utilities.
- `src/types.ts`: shared data types.
- `src/theme/`: MUI theme, RTL setup, and saved color preferences.
- `src/tests/`: frontend utility, API, and component tests.

Run `npm run format` to format frontend files, or `npm run format:check`
to check formatting without changing files.

## Same-domain static hosting

Keep `VITE_API_BASE_URL` unset. The static host must proxy these API paths,
including their query strings and POST/PUT/PATCH/DELETE methods, to your
separately running backend. Browser requests then remain same-origin.
This proxy setup does not require browser CORS access to the backend.

### Vercel

Uses [Vercel external rewrites](https://vercel.com/docs/routing/rewrites).

- Set the project root directory to `frontend`, framework to Vite, build
  command to `npm run build`, and output directory to `dist`.
- Copy `vercel.example.json` to `vercel.json` within `frontend` and replace
  every `https://YOUR-BACKEND.example` with the backend's real HTTPS origin.
- Deploy the frontend as a static Vite project. The external rewrites
  preserve the public frontend domain for API calls.

### Render

Uses [Render static-site rewrite rules](https://render.com/docs/redirects-rewrites).

- Create a **Static Site**, root directory `frontend`, build command
  `npm ci && npm run build`, and publish directory `dist`.
- Configure these **Rewrite** rules in the static site's Redirects/Rewrites:

| Source            | Destination                                   |
| ----------------- | --------------------------------------------- |
| `/auth/*`         | `https://YOUR-BACKEND.example/auth/*`         |
| `/user/*`         | `https://YOUR-BACKEND.example/user/*`         |
| `/contacts`       | `https://YOUR-BACKEND.example/contacts`       |
| `/contacts/*`     | `https://YOUR-BACKEND.example/contacts/*`     |
| `/appointments`   | `https://YOUR-BACKEND.example/appointments`   |
| `/appointments/*` | `https://YOUR-BACKEND.example/appointments/*` |

Replace the backend origin and verify list/create/edit/delete through the
public site after deployment. Do not use redirects for API requests.

If a host cannot proxy external API requests, place a reverse proxy in
front of the static host and backend to retain one public domain. An
alternative is a separate API origin configured through
`VITE_API_BASE_URL` at build time; that requires an explicit backend CORS
allowlist as described above. Frontend environment
variables are public: never put secrets in them.

## What works

- Dashboard with client and appointment counts and today's appointments.
- Client search by name, full-record edits, notes, phone, document links, and deletion.
- Sunday–Saturday calendar with overlapping appointments, local-time forms,
  multi-client selection, and a mobile daily agenda.
- Client cards show their full appointment history.
- Requests are not cached in browser storage. Failed saves retain form contents.

The calendar timezone is the browser's timezone and is displayed above the
calendar. Timestamps sent to the API include a timezone (normalized to UTC).
The API currently filters appointments by start time, so the calendar fetches
appointments starting before the range end and filters overlaps locally to
include overnight appointments. Large datasets will need an overlap query
and pagination in a future backend iteration.

## Authentication

The MUI login/signup screens use the existing Hebrew RTL theme. Signup sends
`{username, email, password}` as JSON to `POST /auth/signup`, then returns to
login with a success message. Login sends multipart `FormData` containing `username` and `password`
to `POST /auth/login` and expects a JSON token string. It then fetches
`GET /user/settings` with that bearer token and expects a settings object.
The session is created only after both requests succeed; failures leave the
login form available for retry.
The token is sent as `Authorization: Bearer ...` on CRM requests. The workspace
mounts only after login; logout or a CRM 401 unmounts it and clears its data.

Credentials use tab-scoped `sessionStorage` (memory only if storage is blocked).
They survive refresh and are removed on logout; passwords are never persisted.
The theme color comes from the account's `themeColor` setting (a six-digit hex
color, default `#245c50`). Sliders preview immediately; the Settings dialog's Save
button sends `PUT /user/settings` with the existing preferences and the new
color. The endpoint replaces the authenticated user's settings object and
returns the committed settings. Save failures retain the preview for retry.
The color is restored from the server on the next login, including on another
browser. There is no refresh-token or password-reset endpoint in the current API.

Proxy `/auth/*` and `/user/*` alongside the CRM routes on same-domain hosts.
Nginx, Vite, and the Vercel example include both routes.

Frontend checks mock this API contract. Live authentication requires the backend
to provide these responses and accept the token on protected requests.

Project-level guidance is installed under `.agents/skills/`:
`vercel-react-best-practices`, `material-ui-styling`, and `material-ui-theming`.
Official source revisions are tracked in the repository's `skills-lock.json`.
