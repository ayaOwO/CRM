# מרחב — Therapy CRM frontend

A Hebrew RTL therapist workspace built with React, TypeScript, MUI, and Vite.
The output is static HTML/CSS/JavaScript. FastAPI serves only the API.

## Local development

Start the existing API on port 8000 using the repository README, then:

```sh
cd frontend
npm ci
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`). Requests to
`/contacts` and `/appointments` are proxied to `http://127.0.0.1:8000`.

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

## Frontend organization

- `src/App.tsx`: state, data loading, and save/delete handlers.
- `src/views/`: dashboard, clients, and calendar views with their CSS.
- `src/components/`: shared components and dialogs.
- `src/lib/`: API transport, contact helpers, and calendar utilities.
- `src/types.ts`: shared data types.
- `src/theme/` and `src/styles/`: MUI theme and shared layout styles.
- `src/tests/`: frontend utility and API tests.

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
- Configure these four **Rewrite** rules in the static site's Redirects/Rewrites:

| Source            | Destination                                   |
| ----------------- | --------------------------------------------- |
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

## Work left: Step 2

Settings and Google sign-in are explicitly marked placeholders. This version
has no authentication or approved-user enforcement. Use synthetic data for
an unauthenticated public preview.

Next, configure a Google OAuth web client for the final deployment origins,
verify Google ID tokens on the server (signature, audience, issuer, expiry),
and admit only explicitly approved emails. Use Google's `sub` as the stable
account identity, require an appropriate verified-email policy, establish
secure HttpOnly sessions with CSRF protection, and enforce authentication
on every CRM endpoint. Google login does not grant access to Google Docs;
the current document link simply opens in a new tab.

Still required for deployment: the actual backend HTTPS URL, the chosen
static hosting project, and public request-path verification. Still required
for authentication: the Google client configuration and approved-user list.
Theme/timezone preferences, user management UI, drag-and-drop scheduling,
and calendar synchronization are deferred.

Project-level guidance is installed under `.agents/skills/`:
`vercel-react-best-practices`, `material-ui-styling`, and `material-ui-theming`.
Official source revisions are tracked in the repository's `skills-lock.json`.
