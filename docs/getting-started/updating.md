# Updating

OpenHosting follows a simple update model: pull the new code (or image), apply
any new database migrations, and restart.

## Docker / docker-compose

If you used the one-line installer, just re-run it — it pulls the new code,
rebuilds and restarts while keeping your `.env` and data:

```bash
curl -fsSL https://raw.githubusercontent.com/solomon2773/openhosting/main/install.sh | bash
```

Or manually:

```bash
cd openhosting
git pull
docker compose up -d --build
```

The container applies new migrations automatically on boot (via
`prisma migrate deploy` in the entrypoint), so there's nothing else to run.

## Standalone image

```bash
docker pull ghcr.io/<you>/openhosting:latest
docker stop openhosting && docker rm openhosting
docker run -d ... ghcr.io/<you>/openhosting:latest   # same env as before
```

## Kubernetes

Push a new image tag and roll the deployment:

```bash
kubectl -n openhosting set image deployment/openhosting app=ghcr.io/<you>/openhosting:<newtag>
```

The migration init-container runs before the new pods start, so the schema is
updated exactly once per rollout.

## Manual / from source

```bash
git pull
npm install
npm run db:migrate     # apply new migrations
npm run build
# restart your process manager (systemd, pm2, …)
```

## Before a major upgrade

- **Back up your database.** Migrations are forward-only.
- Read the release notes on the
  [Releases page](https://github.com/solomon2773/openhosting/releases) for any
  breaking changes or new required settings.
- On a staging copy first if you run a large install.

## Version pinning

Production deployments should pin a released tag (e.g. `v0.1.0`) rather than
tracking `main`, and upgrade deliberately. Releases are published on GitHub.
