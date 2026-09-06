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
