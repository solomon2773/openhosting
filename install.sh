#!/usr/bin/env bash
#
# OpenHosting one-line installer
#
#   curl -fsSL https://raw.githubusercontent.com/solomon2773/openhosting/main/install.sh | bash
#
# What it does:
#   1. Installs Docker if missing (Linux, via get.docker.com — asks first)
#   2. Downloads OpenHosting into /opt/openhosting (or ~/openhosting)
#   3. Generates database / cron / admin secrets into .env
#   4. Builds and starts the docker-compose stack (app + PostgreSQL + cron)
#   5. Seeds the database and prints the admin login
#
# Safe to re-run: an existing install is updated in place, secrets are kept,
# and the seed never overwrites data you have changed.
#
# Options (set as environment variables before running):
#   OH_DIR             install directory (default: /opt/openhosting as root,
#                      ~/openhosting otherwise)
#   OH_REF             branch or tag to install (default: main)
#   OH_PORT            host port to publish the app on (default: 3000;
#                      applies to the first install only — edit .env after)
#   OH_REPO            git URL or local path of the source (default: the
#                      official GitHub repository)
#   OH_INSTALL_DOCKER  1 = install Docker without prompting (unattended)

set -euo pipefail

OH_REPO="${OH_REPO:-https://github.com/solomon2773/openhosting.git}"
OH_REF="${OH_REF:-main}"
OH_PORT="${OH_PORT:-3000}"
if [ -z "${OH_DIR:-}" ]; then
  if [ "$(id -u)" -eq 0 ]; then OH_DIR="/opt/openhosting"; else OH_DIR="$HOME/openhosting"; fi
fi

if [ -t 1 ]; then
  BOLD=$'\e[1m'; DIM=$'\e[2m'; GREEN=$'\e[32m'; RED=$'\e[31m'; YELLOW=$'\e[33m'; RESET=$'\e[0m'
else
  BOLD=''; DIM=''; GREEN=''; RED=''; YELLOW=''; RESET=''
fi
info() { printf '%s==>%s %s%s%s\n' "$GREEN" "$RESET" "$BOLD" "$*" "$RESET"; }
warn() { printf '%sWarning:%s %s\n' "$YELLOW" "$RESET" "$*" >&2; }
die()  { printf '%sError:%s %s\n' "$RED" "$RESET" "$*" >&2; exit 1; }

# ── Preflight ───────────────────────────────────────────────────────────────

case "$(uname -s)" in
  Linux)  OS=linux ;;
  Darwin) OS=darwin ;;
  *) die "Unsupported OS: $(uname -s). OpenHosting installs on Linux or macOS." ;;
esac

command -v curl >/dev/null 2>&1 || die "curl is required."

SUDO=""
if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then SUDO="sudo"; fi

# ── Docker ──────────────────────────────────────────────────────────────────

if ! command -v docker >/dev/null 2>&1; then
  if [ "$OS" = darwin ]; then
    die "Docker is required. Install Docker Desktop (https://docs.docker.com/desktop/setup/install/mac-install/) and re-run."
  fi
  if [ "${OH_INSTALL_DOCKER:-0}" != "1" ]; then
    if [ -e /dev/tty ] && printf 'Docker is not installed. Install it now from get.docker.com? [Y/n] ' >/dev/tty 2>/dev/null \
        && IFS= read -r reply </dev/tty 2>/dev/null; then
      case "$reply" in [Nn]*) die "Docker is required. Install it and re-run." ;; esac
    else
      die "Docker is not installed. Install it first, or re-run with OH_INSTALL_DOCKER=1 to install it automatically."
    fi
  fi
  info "Installing Docker (get.docker.com)…"
  curl -fsSL https://get.docker.com | $SUDO sh
fi

if docker info >/dev/null 2>&1; then
  DOCKER="docker"
elif [ -n "$SUDO" ] && $SUDO docker info >/dev/null 2>&1; then
  DOCKER="$SUDO docker"
else
  die "Cannot talk to the Docker daemon. Is it running? (try: systemctl start docker)"
fi

if $DOCKER compose version >/dev/null 2>&1; then
  COMPOSE="$DOCKER compose"; COMPOSE_HINT="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  if [ "$DOCKER" = "docker" ]; then COMPOSE="docker-compose"; else COMPOSE="$SUDO docker-compose"; fi
  COMPOSE_HINT="docker-compose"
else
  die "Docker Compose is required (it ships with modern Docker). Update Docker or install the compose plugin."
fi

# ── Fetch the source ────────────────────────────────────────────────────────

download_tarball() {
  local base url
  base="${OH_REPO%.git}"
  case "$base" in
    https://github.com/*/*) url="$base/archive/$OH_REF.tar.gz" ;;
    *) die "git is required to install from $OH_REPO" ;;
  esac
  mkdir -p "$OH_DIR"
  curl -fsSL "$url" | tar -xz --strip-components=1 -C "$OH_DIR"
}

if [ -d "$OH_DIR/.git" ] && command -v git >/dev/null 2>&1; then
  info "Updating existing install in $OH_DIR"
  if ! git -C "$OH_DIR" pull --ff-only; then
    warn "Could not fast-forward $OH_DIR — keeping the current version."
  fi
elif [ -f "$OH_DIR/docker-compose.yml" ]; then
  info "Refreshing existing install in $OH_DIR"
  download_tarball
elif command -v git >/dev/null 2>&1; then
  info "Downloading OpenHosting ($OH_REF) to $OH_DIR"
  git clone --depth 1 --branch "$OH_REF" "$OH_REPO" "$OH_DIR"
else
  info "Downloading OpenHosting ($OH_REF) to $OH_DIR"
  download_tarball
fi

# ── Secrets ─────────────────────────────────────────────────────────────────

gen_hex() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$1"
  else
    od -vN "$1" -An -tx1 /dev/urandom | tr -d ' \n'
  fi
}

env_get() { sed -n "s/^$1=//p" "$OH_DIR/.env" 2>/dev/null | head -n1; }

if [ -f "$OH_DIR/.env" ]; then
  info "Keeping existing secrets in $OH_DIR/.env"
  ADMIN_PASSWORD="$(env_get SEED_ADMIN_PASSWORD)"
  APP_PORT="$(env_get APP_PORT)"
  APP_PORT="${APP_PORT:-3000}"
else
  info "Generating secrets in $OH_DIR/.env"
  ADMIN_PASSWORD="$(gen_hex 8)"
  APP_PORT="$OH_PORT"
  cat > "$OH_DIR/.env" <<EOF
# Generated by the OpenHosting installer — keep this file private.
# docker-compose.yml reads these values; DB_PASSWORD must not change once the
# database volume exists.
DB_PASSWORD=$(gen_hex 16)
CRON_SECRET=$(gen_hex 32)
APP_PORT=$APP_PORT
# Initial password for admin@example.com, applied on the first seed only.
SEED_ADMIN_PASSWORD=$ADMIN_PASSWORD
EOF
  chmod 600 "$OH_DIR/.env"
fi

# ── Build, start, seed ──────────────────────────────────────────────────────

info "Building and starting containers (the first build takes a few minutes)…"
(cd "$OH_DIR" && $COMPOSE up -d --build)

info "Waiting for the app on port $APP_PORT…"
up=""
for _ in $(seq 1 90); do
  if curl -fsS -o /dev/null "http://localhost:$APP_PORT/"; then up=1; break; fi
  sleep 2
done
[ -n "$up" ] || die "The app did not respond within 3 minutes. Check the logs: cd $OH_DIR && $COMPOSE_HINT logs app"

info "Seeding the database (admin account, sample catalog)…"
if [ -n "$ADMIN_PASSWORD" ]; then
  (cd "$OH_DIR" && $COMPOSE exec -T -e SEED_ADMIN_PASSWORD="$ADMIN_PASSWORD" app node prisma/seed.mjs)
else
  (cd "$OH_DIR" && $COMPOSE exec -T app node prisma/seed.mjs)
fi

# ── Summary ─────────────────────────────────────────────────────────────────

ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
[ -n "$ip" ] || ip="localhost"

printf '\n'
printf '%s────────────────────────────────────────────────────────────────%s\n' "$DIM" "$RESET"
printf ' %s%s✅ OpenHosting is running%s\n\n' "$BOLD" "$GREEN" "$RESET"
printf '   URL:       http://%s:%s\n' "$ip" "$APP_PORT"
printf '   Admin:     admin@example.com\n'
if [ -n "$ADMIN_PASSWORD" ]; then
  printf '   Password:  %s   (initial password — change it after signing in)\n' "$ADMIN_PASSWORD"
fi
printf '\n'
printf '   Install:   %s  (secrets in .env — keep that file safe)\n' "$OH_DIR"
printf '   Update:    re-run this installer\n'
printf '   Logs:      cd %s && %s logs -f app\n' "$OH_DIR" "$COMPOSE_HINT"
printf '\n'
printf ' Next steps\n'
printf '   • Put a reverse proxy with TLS in front of port %s:\n' "$APP_PORT"
printf '     https://github.com/solomon2773/openhosting/blob/main/docs/getting-started/reverse-proxy-ssl.md\n'
printf '   • Set Admin → Settings → Public URL to your https:// domain\n'
printf '   • Docs: https://github.com/solomon2773/openhosting/tree/main/docs\n'
printf '%s────────────────────────────────────────────────────────────────%s\n' "$DIM" "$RESET"
