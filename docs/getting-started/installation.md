# Installation (local development)

This guide gets OpenHosting running on your machine for development. For a
production server, use the [one-line installer](docker.md#one-line-install-recommended)
(`curl -fsSL https://raw.githubusercontent.com/solomon2773/openhosting/main/install.sh | bash`)
or see [Docker](docker.md) / [Kubernetes](kubernetes.md).

## Requirements

- **Node.js 24+** and npm
- **PostgreSQL 14+** (18 recommended) — or a [Supabase](supabase.md) project
- **git**

## Steps

```bash
# 1. Clone
git clone https://github.com/solomon2773/openhosting.git
cd openhosting

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
#    edit .env and point DATABASE_URL / DIRECT_URL at your Postgres
```

Start a throwaway Postgres if you don't have one:

```bash
docker run -d --name oh-db -p 5432:5432 \
  -e POSTGRES_USER=openhosting -e POSTGRES_PASSWORD=openhosting \
  -e POSTGRES_DB=openhosting postgres:18-alpine
```

```bash
# 4. Create the schema and seed demo data
npm run db:push
npm run db:seed

# 5. Run the dev server
npm run dev
```

Open <http://localhost:3000>.

## Default logins

After seeding:

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@example.com` | `admin12345` |
| Customer | `demo@example.com` | `demo12345` |

**Change the admin password immediately** on a real deployment — or seed with
your own via `SEED_ADMIN_PASSWORD` (see the [environment reference](environment.md)).

## What the seed creates

- Two roles (Administrator, Support) and the two users above
- Three categories (Game Servers, VPS, Web Hosting) with sample products
- A `WELCOME10` coupon, a US sales-tax rate, and a EUR currency
- All payment gateways, server modules and resale modules as **disabled**
  extension rows, ready to configure under **Admin → Extensions**
- A demo order, service, paid + pending invoice, and a support ticket

## Useful scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run typecheck` | TypeScript check |
| `npm run db:push` | Sync schema to the database (dev) |
| `npm run db:migrate` | Apply migrations (production) |
| `npm run db:seed` | Seed demo data |

See [CLI & scripts](../cli.md) for the full list.

## Troubleshooting

- **`Can't reach database server`** — check `DATABASE_URL` in `.env` and that
  Postgres is running and reachable on that host/port.
- **Prisma client errors after pulling changes** — run `npm run db:generate`
  (or `npx prisma generate`) to regenerate the client.
- **Port 3000 in use** — set `PORT=3001` in your environment.
