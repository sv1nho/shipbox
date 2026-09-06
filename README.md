# ShipBox

Return label generator for bpost and PostNL, with shipment tracking from drop-off
to refund. React + Vite on the front, Express + Prisma + PostgreSQL on the back.

A paid model (label bundles bought through a payment method still to be decided,
unlocked by a license key sent over email) is planned but set aside for now, while
the focus stays on the frontend and new features. It will come back later.

## Repository layout

| Folder | Role |
|---|---|
| `client/` | React application served by Vite |
| `server/` | Express + Prisma API, binds to `127.0.0.1` |
| `prisma/` | schema, migrations, seed |
| `shared/` | code shared by the frontend and the API (types, carrier config) |

## Local setup

Requires Node >= 20.19 and Docker.

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
| `npm run lint` / `typecheck` / `test` | the same checks CI runs |
| `npm run db:up` / `db:down` | PostgreSQL container |
| `npm run db:migrate` | creates and applies migrations |
| `npm run db:studio` | Prisma database browser |
| `npm run db:backup` | dumps the database to `backups/` |
| `npm run db:restore` | restores a dump, see below |

The PostgreSQL host port is **5433** rather than 5432, so the container can live
alongside a native Postgres install.

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
