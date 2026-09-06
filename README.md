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

The PostgreSQL host port is **5433** rather than 5432, so the container can live
alongside a native Postgres install.

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

When the app is deployed, register the production URLs the same way and update
`BETTER_AUTH_URL` and `WEB_ORIGIN`.
