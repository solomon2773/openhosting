# Deploying with Docker

The repository ships a production `Dockerfile` (multi-stage, Next.js
standalone output, runs migrations on boot) and a `docker-compose.yml` with
Postgres and an hourly billing cron.

## docker-compose (single host / VPS)

```bash
git clone https://github.com/solomon2773/openhosting.git
cd openhosting

# strongly recommended:
export DB_PASSWORD="$(openssl rand -hex 16)"
export CRON_SECRET="$(openssl rand -hex 32)"

docker compose up -d --build
```

Seed the first admin account:

```bash
DATABASE_URL="postgresql://openhosting:${DB_PASSWORD}@localhost:5432/openhosting" \
SEED_ADMIN_PASSWORD="a-strong-password" npm run db:seed
```

Put a reverse proxy (Caddy, nginx, Traefik) in front of port 3000 for TLS,
then set **Admin → Settings → Public URL** to your https URL so emails and
payment redirects use it.

## Standalone image

```bash
docker build -t openhosting .
docker run -d -p 3000:3000 \
  -e DATABASE_URL="postgresql://…" \
  -e DIRECT_URL="postgresql://…" \
  -e CRON_SECRET="…" \
  openhosting
```

The entrypoint runs `prisma migrate deploy` before starting; set
`SKIP_MIGRATIONS=true` to disable (e.g. when migrations run elsewhere).

Schedule the billing tick from any scheduler if you don't use the compose
`cron` service:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-host/api/cron
```

## Managed container platforms

The image runs unmodified on Fly.io, Railway, Render, Google Cloud Run, AWS
App Runner / ECS and Azure Container Apps — provide the three environment
variables above and point them at any managed Postgres (or
[Supabase](supabase.md)).
