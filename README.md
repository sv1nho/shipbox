# ShipBox

Return label generator for bpost and PostNL, with shipment tracking from drop-off
to refund. React + Vite on the front, Express + Prisma + PostgreSQL on the back.

## What it does

- **Labels** — fills in a bpost or PostNL return label and downloads it as a PDF,
  in French, Dutch or English. No account needed.
- **Tracking** — once signed in, each return is followed from the request to the
  store's decision, with the dates recorded at each step and a warning when a
  label is about to expire or a store sits on a parcel too long.
- **Chasing a store** — writes the reminder email for you, in French or English,
  and remembers when it was sent.
- **Dashboard** — how much was refunded, lost or still pending, and how long each
  store takes to decide.
- **Import and export** — CSV or JSON, the same layout both ways.
- **French or English** — the interface and the API's error messages follow the
  language picked in the navigation bar, which is remembered for the next visit.

## Repository layout

| Folder | Role |
|---|---|
| `client/` | React application served by Vite |
| `server/` | Express + Prisma API, binds to `127.0.0.1` |
| `prisma/` | schema, migrations, seed |
| `shared/` | code shared by the frontend and the API (types, carrier config) |

## Local setup

Requires Node 24 or newer, and Docker.

```bash
cp .env.example .env      # then fill it in
npm install               # also generates the Prisma client
npm run db:up             # starts PostgreSQL (container, host port 5433)
npm run dev               # frontend on :5173, API on :3000
```

The frontend calls `/api` on its own origin: the Vite dev proxy forwards to the
API, which avoids CORS and cross-origin cookies during development.

### Scripts

| Script | Effect |
|---|---|
| `npm run dev` | frontend and API together |
| `npm run dev:web` / `dev:api` | either one on its own |
| `npm run start:api` | the API without file watching |
| `npm run build` | the frontend into `dist/web`, then the server into `dist/api` |
| `npm run build:web` / `build:api` | either half on its own |
| `npm start` | the compiled server, the way production runs it |
| `npm run preview` | a local preview of the built frontend |
| `npm run lint` / `typecheck` / `test` | three of the checks CI runs |
| `npm run lint:fix` | lint and fix what can be fixed automatically |
| `npm run knip` | reports unused files, exports and dependencies |
| `npm run size` | weighs what the first page load downloads, against a budget |
| `npm run e2e` | drives a real browser through the journeys, against a real database |
| `npm run e2e:shots` | with `SHOTS=true`, photographs every page at four widths |
| `npm run fuzz` | throws generated hostile bodies and queries at every route |
| `npm run advisories` | takes the smallest bump that closes each npm advisory, and writes `advisories.md` |
| `npm run measure` | fills `<your database>_perf` and times the list query on it |
| `npm run measure:api` | times the same routes through Express, alone and under load |
| `npm run db:up` / `db:down` | PostgreSQL container |
| `npm run db:migrate` | creates and applies migrations |
| `npm run db:deploy` | applies existing migrations without creating new ones |
| `npm run db:reset` | **drops the development database** and replays every migration |
| `npm run db:generate` | regenerates the Prisma client |
| `npm run db:studio` | Prisma database browser |
| `npm run db:seed` | fills the database with sample shipments |
| `npm run db:backup` | dumps the database to `backups/` |
| `npm run db:restore` | restores a dump, see below |
| `npm run clear` | deletes `node_modules`, the builds, the Prisma client **and `package-lock.json`** |

A production install is `npm ci --omit=dev --omit=optional --ignore-scripts`,
and `npm run build` then `npm start` on top of it. The flags each earn their
place. `--omit=optional` matters because Better Auth declares vitest, vite and
typescript as optional peers, and without it npm installs the whole test
toolchain beside the server — 435 MB instead of 122 MB, with advisories that
belong to tooling. `--ignore-scripts` matters because `postinstall` generates the
Prisma client through a CLI that lives in devDependencies; the build does that
step instead, and no dependency gets to run code on the server during install.

`npm run build` writes two trees. The frontend lands in `dist/web`, which is the
only one the API serves. The compiled server lands in `dist/api`, out of reach of
`express.static`, and `npm start` runs `dist/api/server/index.js` with plain Node —
production carries no transpiler. CI installs exactly this way, boots the result
and calls `/api/health`, so the path cannot rot unnoticed.

In production the API also serves the built frontend from `dist/`, so both live on
one origin and no CORS is needed. Hashed assets are cached for a year, `index.html`
never. Security headers are set on every response, including a content security
policy, and the API documentation is not served at all.

Every `/api` route is rate limited per caller, 120 requests a minute by default,
answering 429 with the same error shape as any other refusal. Behind a proxy that
terminates TLS, set `TRUSTED_PROXY_HOPS`, or every visitor is counted as one.

`npm run e2e` builds the app, serves it on port 3100 against a `<your database>_e2e`
database it creates and empties, signs an account in once, then drives Chromium
through it. That sign-in needs `E2E_AUTH=true`, which the API refuses to start
with in production.

`npm test` runs three suites: `client` and `server` need nothing, while `db`
checks the constraints against a real PostgreSQL. That one creates and migrates
`<your database>_test` on its own, so the development data is never touched.

It also prints a coverage report, and fails below 100% on any of the four
figures. Keeping it there is the point: it is what makes the suite worth
trusting when it stays green.

In development the API prints every refused request, with the route, the code
and the field at fault, for example
`POST /api/shipments -> 422 VALIDATION_ERROR: …`. Tests and production keep them
quiet, so a test run only shows what actually went wrong.

The Prisma client is generated into `server/generated`, which is gitignored.
`npm install` recreates it. If the editor reports unresolved Prisma types
(`Unsafe call of a type that could not be resolved`), that folder is missing or
stale: run `npm run db:generate` and reload the TypeScript server.

The PostgreSQL host port is **5433** rather than 5432, so the container can live
alongside a native Postgres install.

## API documentation

With the API running, the full document is browsable at
<http://localhost:5173/api/docs> and served as JSON at `/api/openapi.json`. Both
answer without a session, so they are public once the app is deployed; they
describe the shape of the API, never any data.

The request bodies are generated from the same Zod schemas the routes validate
with, so they cannot drift. The rest is kept honest by `server/__tests__/openapi.test.ts`,
which fails when a route is added without being documented, when the document
lists one that does not exist, or when the dashboard figures and error codes it
describes stop matching what the server sends.

Every refusal comes back in the same shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [{ "path": "store", "message": "…" }] } }
```

`details` names the field at fault, so a form can put each message beside it.
Send `Accept-Language: fr` to get the messages in French.

## Languages

English is the source language: every string in the code is written in English
and wrapped in `t('…')` on the frontend. French lives in two catalogues keyed by
that English phrase, `client/i18n/fr.ts` for the interface and `server/i18n/fr.ts`
for the API's error messages. A phrase missing from a catalogue falls back to
English rather than showing a blank or a key.

`client/__tests__/i18n/coverage.test.ts` reads the frontend sources and fails if
a phrase passed to `t()` has no French line, or if a translation drops one of the
`{placeholders}` its English phrase carries. Adding text to the interface
therefore means adding its French line in the same change.

The label PDF has its own language setting, chosen in the form, which is
independent of the interface language.

## Backups

Everything lives in a local container, so a stray `docker compose down -v` wipes
it. `pg_dump` and `psql` run inside the container, nothing extra to install.

```bash
npm run db:backup
```

Writes `backups/shipbox-YYYY-MM-DD-HHmmss.sql` (Europe/Brussels), a folder that
is gitignored. The dump drops and recreates every object, so restoring works on
a database that already has tables.

```bash
npm run db:restore -- backups/shipbox-2026-09-07-001000.sql confirm
```

Without the trailing `confirm` the script refuses and explains what it would
destroy. The word is a positional argument rather than a `--flag` because npm
swallows unknown flags before they reach the script.

Prisma's migration history is part of the dump, so `npx prisma migrate status`
stays accurate after a restore.

## Authentication setup

Sign-in is OAuth only, no email and password. Without a Google client the app
still runs, only sign-in is disabled and the API logs a warning at startup.

### 1. Session secret

```bash
openssl rand -base64 32
```

Put the result in `BETTER_AUTH_SECRET`. Without it sessions do not work and the
OAuth callback fails with a CSRF error.

### 2. Google client

1. Open <https://console.cloud.google.com/> and create a project, `ShipBox`.
2. Go to **APIs & Services → OAuth consent screen**.
   - User type **External**.
   - Fill in app name, support email and developer email.
   - Leave the app in **Testing** mode and add your own Google account under
     **Test users**. Publishing would require Google's review, which is
     pointless for private use.
   - Scopes: the defaults (`email`, `profile`, `openid`) are enough.
3. Go to **APIs & Services → Credentials → Create credentials → OAuth client ID**.
   - Application type **Web application**.
   - **Authorised JavaScript origins**, copy exactly:

     ```
     http://localhost:5173
     ```

   - **Authorised redirect URIs**, copy exactly:

     ```
     http://localhost:5173/api/auth/callback/google
     ```

4. Copy the client ID and client secret into `GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_SECRET`, then restart the API.

The redirect URI points at the **frontend** port, not the API port. The browser
only ever talks to `localhost:5173`; the Vite proxy forwards `/api` to the API.
A single character of difference between this URI and `BETTER_AUTH_URL` breaks
the whole flow, and it is the most common cause of failure.

### 3. GitHub client

1. Open <https://github.com/settings/developers> → **OAuth Apps** → **New OAuth App**.
2. Fill in:
   - **Application name**: `ShipBox`
   - **Homepage URL**, copy exactly:

     ```
     http://localhost:5173
     ```

   - **Authorization callback URL**, copy exactly:

     ```
     http://localhost:5173/api/auth/callback/github
     ```

3. Create the app, then **Generate a new client secret**.
4. Copy both values into `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`, then
   restart the API.

GitHub OAuth Apps take a single callback URL, so a deployed app needs its own
OAuth App separate from the local one.

Signing in with Google and with GitHub on the same verified email address lands
on the same account, rather than failing or creating a duplicate.

When the app is deployed, register the production URLs the same way and update
`BETTER_AUTH_URL` and `WEB_ORIGIN`.
