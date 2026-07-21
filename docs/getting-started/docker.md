# Deploy with Docker

OpenHosting ships a production `Dockerfile` (multi-stage, Next.js standalone
output, runs migrations on boot) and a `docker-compose.yml` with PostgreSQL
and an hourly billing cron.

## One-line install (recommended)

On a fresh Linux server:

```bash
curl -fsSL https://raw.githubusercontent.com/solomon2773/openhosting/main/install.sh | bash
```

The script installs Docker if it's missing (it asks first), downloads
OpenHosting to `/opt/openhosting` (or `~/openhosting` as a non-root user),
generates secrets into `.env`, starts the compose stack and seeds the first
admin account — then prints the URL and login. It is idempotent: re-running it
updates an existing install and keeps your secrets and data.

Options via environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `OH_DIR` | `/opt/openhosting` (root) / `~/openhosting` | Install directory |
| `OH_REF` | `main` | Branch or tag to install |
| `OH_PORT` | `3000` | Host port (first install only; edit `.env` later) |
| `OH_INSTALL_DOCKER` | — | `1` = install Docker without prompting (unattended) |

Example: `OH_PORT=8080 OH_REF=v0.3.1 bash -c "$(curl -fsSL https://raw.githubusercontent.com/solomon2773/openhosting/main/install.sh)"`

## docker-compose (manual)

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

Seed the first admin account (the image bundles the seed, so no Node.js is
needed on the host):

```bash
docker compose exec -e SEED_ADMIN_PASSWORD="a-strong-password" app node prisma/seed.mjs
```

The seed is idempotent — it only creates what's missing and never overwrites
data you have changed. The app publishes on port `3000` by default; set
`APP_PORT` in a `.env` file next to the compose file to change it.

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
