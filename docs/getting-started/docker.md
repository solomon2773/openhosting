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
generates secrets into `.env`, starts the compose stack and seeds your admin
account. It then sets up **nginx as a reverse proxy** and — when you give it a
domain — obtains a free **Let's Encrypt certificate** with certbot, so the
install comes up on `https://` with automatic renewal.

### What it asks

On a terminal, everything is asked up front — nothing is built until you
confirm, so a wrong answer costs seconds, not a half-finished install:

```
==> Installing OpenHosting
    Install directory [/opt/openhosting]:
    Port to publish OpenHosting on [3000]:

  A domain gets you nginx + a free Let's Encrypt certificate (HTTPS).
  Leave it empty to serve plain HTTP for now — you can add it later.
    Domain (e.g. billing.example.com): billing.example.com
    Email for certificate expiry notices (optional):

  The first administrator account.
    Admin email [admin@example.com]: you@example.com
    Admin password (Enter to generate one):

  Directory:  /opt/openhosting
  Port:       3000
  Domain:     billing.example.com
  Admin:      you@example.com
  Password:   generated for you

  Install with these settings? [Y/n]
```

The password is typed blind and confirmed; press Enter instead and the
installer generates a strong one and prints it at the end. A password you
typed yourself is never echoed back.

Every answer also has a flag and an environment variable, so the same install
runs unattended (see [below](#unattended-installs)). Without a terminal —
cloud-init, CI, cron — each question falls back to its default silently.

### Managing an install

Re-run the same command later and the installer recognises the existing install
and asks what to do:

```
==> OpenHosting is already installed in /opt/openhosting
    version 0.4.0 · port 3000 · billing.example.com (HTTPS)

   1) Upgrade to the latest version      keeps all data
   2) Rebuild the containers             keeps all data
   3) Reset the admin password
   4) Change the port or domain
   5) Show status
   6) Reinstall from scratch             deletes the database
   7) Uninstall                          removes the stack
   q) Quit
```

The same actions are available as flags for scripted use. Behind a pipe, pass
them after `bash -s --`:

```bash
curl -fsSL https://raw.githubusercontent.com/solomon2773/openhosting/main/install.sh \
  | bash -s -- --upgrade
```

| Flag | What it does |
|---|---|
| `--upgrade` | Pulls the new code, rebuilds, restarts, re-runs the seed. Keeps data. This is what a non-interactive re-run does. |
| `--rebuild` | Recreates the containers from the current code — the first thing to try when something is stuck. Keeps data. |
| `--reset-password` | Sets a new password for an admin account. See [below](#resetting-the-admin-password). |
| `--reconfigure` | Changes the host port and/or the domain, updates nginx to match, requests a certificate if needed. |
| `--status` | Prints the install directory, version, URL, port, domain and `docker compose ps`. |
| `--reinstall` | Deletes the database volume and installs from scratch. Asks for confirmation (`--yes` to skip). |
| `--uninstall` | Stops and removes the stack, then asks whether to also delete the data, the nginx site and the install directory. Non-interactively it needs `--yes`, keeps everything but the containers, and takes `--wipe` to drop the database volume too. |

Upgrades keep your secrets, data and nginx/certbot configuration, and the seed
only adds what is missing — it never overwrites data you have changed.
Installed without a domain first? Re-run with `--domain …` (or pick
**Change the port or domain**) to switch to HTTPS.

### Ports

The installer checks the port **before** building anything. If it is taken it
says what is holding it and offers the free ports nearby:

```
Warning: Port 3000 is already in use (by nginx).
    Free ports: 3001, 8080, 8000
    Port to publish OpenHosting on [3001]:
```

Non-interactive runs take the first free port and print a warning; pass
`--port 8080` to decide yourself. To change the port later, use
`--reconfigure` — it rewrites `APP_PORT` in `.env`, recreates the container and
repoints the nginx site at the new port in one step.

### Resetting the admin password

Locked out? The installer can set a new password without the web UI:

```bash
curl -fsSL https://raw.githubusercontent.com/solomon2773/openhosting/main/install.sh \
  | bash -s -- --reset-password
```

It lists the staff accounts, asks which one to reset and takes the new password
(or generates one), and can clear two-factor auth on that account at the same
time — useful when the authenticator app is gone. Resetting signs the account
out everywhere, voids pending reset links, and is recorded in the audit log.

Unattended:

```bash
… | bash -s -- --reset-password --admin-email you@example.com \
    --admin-password 'a-strong-password' --disable-2fa --yes
```

The same tool is in the app image, so you can also run it directly:

```bash
cd /opt/openhosting
docker compose exec -T app node prisma/reset-admin.mjs --list
printf '%s' 'a-strong-password' | docker compose exec -T app \
  node prisma/reset-admin.mjs --email you@example.com --password-stdin
```

Passing the password on stdin keeps it out of `ps` output and shell history.

### Options

Every flag has an environment-variable equivalent:

| Flag | Variable | Default | Purpose |
|---|---|---|---|
| `--dir` | `OH_DIR` | `/opt/openhosting` (root) / `~/openhosting` | Install directory |
| `--ref` | `OH_REF` | `main` | Branch or tag to install — applies when the directory is first created |
| `--port` | `OH_PORT` | `3000` | Host port the app container publishes |
| `--domain` | `OH_DOMAIN` | — | Public domain (e.g. `billing.example.com`) — configures nginx and enables HTTPS |
| `--email` | `OH_EMAIL` | — | Let's Encrypt account email for expiry notices (optional) |
| `--admin-email` | `OH_ADMIN_EMAIL` | `admin@example.com` | Address of the first admin account |
| `--admin-password` | `OH_ADMIN_PASSWORD` | generated | Password for it (a random one is printed when unset) |
| `--disable-2fa` | — | — | With `--reset-password`: also clear two-factor auth on that account |
| `--no-nginx` | `OH_SKIP_NGINX=1` | — | Skip the nginx / HTTPS setup and bring your own proxy |
| `--wipe` | — | — | With `--uninstall`: delete the database volume too |
| `--yes` | `OH_YES=1` | — | Never prompt; take every default |
| — | `OH_INSTALL_DOCKER=1` | — | Install Docker without asking |
| — | `OH_REPO` | GitHub | git URL or local path of the source |

Upgrading pulls the branch the install was created from, so to move a running
install to a pinned tag, check it out in the install directory and re-run:

```bash
cd /opt/openhosting && git fetch --tags && git checkout v0.4.0
curl -fsSL https://raw.githubusercontent.com/solomon2773/openhosting/main/install.sh \
  | bash -s -- --rebuild
```

### Unattended installs

```bash
curl -fsSL https://raw.githubusercontent.com/solomon2773/openhosting/main/install.sh \
  | bash -s -- --yes --domain billing.example.com --email you@example.com \
      --admin-email ops@example.com --port 8080
```

`--yes` disables every prompt, so this is safe in cloud-init or a CI job. The
generated admin password is printed at the end; set `--admin-password` to pick
your own.

For the certificate to be issued, the domain's DNS A record must already point
at the server. If it doesn't yet, the installer configures nginx anyway and
prints the one `certbot` command to run once DNS resolves.

After signing in, set **Admin → Settings → Public URL** to your `https://`
address so emails and payment redirects use it.

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
docker compose exec \
  -e SEED_ADMIN_EMAIL="you@example.com" \
  -e SEED_ADMIN_PASSWORD="a-strong-password" \
  app node prisma/seed.mjs
```

Both are applied only when the account is created — put `SEED_ADMIN_EMAIL` in
the `.env` file next to the compose file and later seeds reuse it instead of
adding a second `admin@example.com`. To change a password afterwards, use
[`prisma/reset-admin.mjs`](#resetting-the-admin-password).

The seed is idempotent — it only creates what's missing and never overwrites
data you have changed. The app publishes on port `3000` by default; set
`APP_PORT` in the same `.env` file to change it.

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
