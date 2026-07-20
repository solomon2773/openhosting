# Deploy with Docker

OpenHosting ships a production `Dockerfile` (multi-stage, Next.js standalone
output, runs migrations on boot) and a `docker-compose.yml` with PostgreSQL
and an hourly billing cron.

## docker-compose (single host / VPS)

```bash
git clone https://github.com/solomon2773/openhosting.git
cd openhosting

# strongly recommended: generate real secrets
export DB_PASSWORD="$(openssl rand -hex 16)"
export CRON_SECRET="$(openssl rand -hex 32)"

docker compose up -d --build
```

The stack starts three services:

| Service | Role |
|---|---|
| `db` | PostgreSQL 18 with a persistent volume |
| `app` | The OpenHosting container (applies migrations on boot) |
| `cron` | Calls the [billing endpoint](../billing/automation.md) hourly |

Seed the first admin account:

```bash
DATABASE_URL="postgresql://openhosting:${DB_PASSWORD}@localhost:5432/openhosting" \
SEED_ADMIN_PASSWORD="a-strong-password" npm run db:seed
```

Then put a [reverse proxy](reverse-proxy-ssl.md) in front of port 3000 for TLS
and set **Admin → Settings → Public URL** to your `https://` URL so emails and
payment redirects use it.

## Standalone image

To run the container against an external database:

```bash
docker build -t openhosting .
docker run -d -p 3000:3000 \
  -e DATABASE_URL="postgresql://…" \
  -e DIRECT_URL="postgresql://…" \
  -e CRON_SECRET="…" \
  openhosting
```

The entrypoint runs `prisma migrate deploy` before starting. Set
`SKIP_MIGRATIONS=true` to disable this (e.g. when migrations run elsewhere).

## Managed container platforms

The image runs unmodified on Fly.io, Railway, Render, Google Cloud Run, AWS
App Runner / ECS and Azure Container Apps. Provide the three environment
variables above and point them at any managed Postgres (or
[Supabase](supabase.md)).

## Building the image only

```bash
docker build -t ghcr.io/<you>/openhosting:latest .
docker push ghcr.io/<you>/openhosting:latest
```

Use this image reference in your [Kubernetes](kubernetes.md) manifests.
