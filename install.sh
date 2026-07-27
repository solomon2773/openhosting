#!/usr/bin/env bash
#
# OpenHosting installer, updater and recovery tool
#
#   curl -fsSL https://raw.githubusercontent.com/solomon2773/openhosting/main/install.sh | bash
#
# Run it once to install. Run it again to manage that install: on a terminal it
# asks what you want to do (upgrade, rebuild, reset the admin password, change
# the port or domain, reinstall, uninstall); without a terminal it upgrades in
# place, which is what a re-run has always done.
#
# A first install:
#   1. Installs Docker if missing (Linux, via get.docker.com — asks first)
#   2. Asks for the install directory, port, domain and admin login
#      (every answer can also come from a flag or environment variable)
#   3. Downloads OpenHosting into /opt/openhosting (or ~/openhosting)
#   4. Generates database / cron secrets into .env
#   5. Builds and starts the docker-compose stack (app + PostgreSQL + cron)
#   6. Seeds the database with your admin account and a sample catalog
#   7. Installs nginx as a reverse proxy and, when you give it a domain,
#      obtains a Let's Encrypt certificate — HTTPS with automatic renewal
#
# The port is checked before anything is built: if it is taken, the installer
# offers the free ports nearby instead of failing halfway through.
#
# Safe to re-run: secrets and data are kept, and the seed only ever adds what
# is missing — it never overwrites data you have changed.
#
# Actions (behind a pipe, pass flags with `bash -s -- <flag>`):
#   --upgrade           update an existing install in place (default re-run)
#   --rebuild           rebuild and recreate the containers, keep all data
#   --reset-password    set a new password for an admin account
#   --reconfigure       change the port and/or the domain
#   --status            show what is installed, running and reachable
#   --reinstall         start over — deletes the database (asks first)
#   --uninstall         stop and remove the stack (asks what to keep)
#
# Options (each has an environment variable equivalent):
#   --dir <path>          install directory   OH_DIR   (default /opt/openhosting
#                         as root, ~/openhosting otherwise)
#   --ref <branch|tag>    version to install  OH_REF   (default main)
#   --port <number>       host port for the app        OH_PORT  (default 3000)
#   --domain <domain>     public domain, enables HTTPS OH_DOMAIN
#   --email <address>     Let's Encrypt account email  OH_EMAIL
#   --admin-email <addr>  first admin account          OH_ADMIN_EMAIL
#   --admin-password <pw> its password (generated when unset) OH_ADMIN_PASSWORD
#   --disable-2fa         with --reset-password: also clear two-factor auth
#   --no-nginx            skip the nginx / HTTPS setup  OH_SKIP_NGINX=1
#   --wipe                with --uninstall: delete the database volume too
#   -y, --yes             never prompt; take the defaults OH_YES=1
#   -h, --help            show this help
#
#   OH_REPO               git URL or local path of the source
#   OH_INSTALL_DOCKER=1   install Docker without asking

set -euo pipefail

# ── Output ──────────────────────────────────────────────────────────────────

if [ -t 1 ]; then
  BOLD=$'\e[1m'; DIM=$'\e[2m'; GREEN=$'\e[32m'; RED=$'\e[31m'; YELLOW=$'\e[33m'; RESET=$'\e[0m'
else
  BOLD=''; DIM=''; GREEN=''; RED=''; YELLOW=''; RESET=''
fi
info() { printf '%s==>%s %s%s%s\n' "$GREEN" "$RESET" "$BOLD" "$*" "$RESET"; }
step() { printf '    %s\n' "$*"; }
warn() { printf '%sWarning:%s %s\n' "$YELLOW" "$RESET" "$*" >&2; }
die()  { printf '%sError:%s %s\n' "$RED" "$RESET" "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
OpenHosting installer, updater and recovery tool.

  curl -fsSL https://raw.githubusercontent.com/solomon2773/openhosting/main/install.sh | bash

Run it once to install; run it again to manage that install. On a terminal it
asks what to do; without one it upgrades in place. Behind a pipe, pass flags
with `bash -s -- <flag>`.

Actions:
  --upgrade            update an existing install in place (default re-run)
  --rebuild            rebuild and recreate the containers, keep all data
  --reset-password     set a new password for an admin account
  --reconfigure        change the port and/or the domain
  --status             show what is installed, running and reachable
  --reinstall          start over — deletes the database (asks first)
  --uninstall          stop and remove the stack (asks what to keep)

Options (environment variable in brackets):
  --dir <path>            install directory [OH_DIR]
  --ref <branch|tag>      version to install [OH_REF], default main
  --port <number>         host port for the app [OH_PORT], default 3000
  --domain <domain>       public domain, enables HTTPS [OH_DOMAIN]
  --email <address>       Let's Encrypt account email [OH_EMAIL]
  --admin-email <addr>    first admin account [OH_ADMIN_EMAIL]
  --admin-password <pw>   its password, generated when unset [OH_ADMIN_PASSWORD]
  --disable-2fa           with --reset-password: also clear two-factor auth
  --no-nginx              skip the nginx / HTTPS setup [OH_SKIP_NGINX=1]
  --wipe                  with --uninstall: delete the database volume too
  -y, --yes               never prompt; take the defaults [OH_YES=1]
  -h, --help              show this help

  [OH_REPO]               git URL or local path of the source
  [OH_INSTALL_DOCKER=1]   install Docker without asking

Examples:
  curl -fsSL …/install.sh | bash -s -- --domain billing.example.com --yes
  curl -fsSL …/install.sh | bash -s -- --reset-password
EOF
}

# ── Options ─────────────────────────────────────────────────────────────────

ACTION="${OH_ACTION:-}"
ASSUME_YES="${OH_YES:-0}"
DISABLE_2FA=0
WIPE=0
OH_DIR_SET=0
[ -n "${OH_DIR:-}" ] && OH_DIR_SET=1

need_arg() { [ -n "${2:-}" ] || die "$1 needs a value (try --help)."; }

while [ $# -gt 0 ]; do
  case "$1" in
    --install)                      ACTION=install ;;
    --upgrade|--update)             ACTION=upgrade ;;
    --rebuild|--repair)             ACTION=rebuild ;;
    --reset-password|--reset-admin) ACTION=reset-password ;;
    --reconfigure|--configure)      ACTION=reconfigure ;;
    --status)                       ACTION=status ;;
    --reinstall|--fresh)            ACTION=reinstall ;;
    --uninstall|--remove)           ACTION=uninstall ;;
    --dir)            need_arg "$1" "${2:-}"; OH_DIR="$2"; OH_DIR_SET=1; shift ;;
    --dir=*)          OH_DIR="${1#*=}"; OH_DIR_SET=1 ;;
    --ref)            need_arg "$1" "${2:-}"; OH_REF="$2"; shift ;;
    --ref=*)          OH_REF="${1#*=}" ;;
    --port)           need_arg "$1" "${2:-}"; OH_PORT="$2"; shift ;;
    --port=*)         OH_PORT="${1#*=}" ;;
    --domain)         need_arg "$1" "${2:-}"; OH_DOMAIN="$2"; shift ;;
    --domain=*)       OH_DOMAIN="${1#*=}" ;;
    --email)          need_arg "$1" "${2:-}"; OH_EMAIL="$2"; shift ;;
    --email=*)        OH_EMAIL="${1#*=}" ;;
    --admin-email)    need_arg "$1" "${2:-}"; OH_ADMIN_EMAIL="$2"; shift ;;
    --admin-email=*)  OH_ADMIN_EMAIL="${1#*=}" ;;
    --admin-password) need_arg "$1" "${2:-}"; OH_ADMIN_PASSWORD="$2"; shift ;;
    --admin-password=*) OH_ADMIN_PASSWORD="${1#*=}" ;;
    --disable-2fa)    DISABLE_2FA=1 ;;
    --no-nginx)       OH_SKIP_NGINX=1 ;;
    --wipe)           WIPE=1 ;;
    -y|--yes)         ASSUME_YES=1 ;;
    -h|--help)        usage; exit 0 ;;
    *) die "Unknown option: $1 (try --help)" ;;
  esac
  shift
done

OH_REPO="${OH_REPO:-https://github.com/solomon2773/openhosting.git}"
OH_REF="${OH_REF:-main}"
DEFAULT_PORT=3000
if [ "$OH_DIR_SET" -eq 0 ]; then
  if [ "$(id -u)" -eq 0 ]; then OH_DIR="/opt/openhosting"; else OH_DIR="$HOME/openhosting"; fi
fi
DOMAIN="${OH_DOMAIN:-}"
ADMIN_EMAIL="${OH_ADMIN_EMAIL:-}"
ADMIN_PASSWORD="${OH_ADMIN_PASSWORD:-}"
APP_PORT=""            # the port number this install publishes, resolved below
APP_BIND=""            # optional "127.0.0.1:" prefix kept from APP_PORT in .env
CURRENT_PORT=""        # the port it published before this run
# What the closing summary says about the admin password. Only a password the
# installer generated is ever printed back.
PASSWORD_NOTE="unchanged  (forgot it? re-run this installer → reset the admin password)"
NGINX_OK=""
HTTPS_OK=""

# ── Prompts ─────────────────────────────────────────────────────────────────
#
# The script is normally piped into bash, so stdin is the script itself and all
# prompting goes through /dev/tty. Without one (cloud-init, CI, cron) every
# question falls back to its default and the run stays unattended.

INTERACTIVE=""
if [ "$ASSUME_YES" != "1" ] && [ -e /dev/tty ] && (exec 3</dev/tty) 2>/dev/null; then
  INTERACTIVE=1
fi

TTY_ECHO_OFF=""
restore_tty() {
  if [ -n "$TTY_ECHO_OFF" ]; then
    stty echo </dev/tty 2>/dev/null || true
    TTY_ECHO_OFF=""
  fi
  return 0
}
trap restore_tty EXIT INT TERM

say() { [ -n "$INTERACTIVE" ] && printf '%s\n' "$*" >/dev/tty; return 0; }

ask() { # ask <question> [default] → answer on stdout
  local question="$1" default="${2:-}" reply=""
  if [ -z "$INTERACTIVE" ]; then printf '%s' "$default"; return 0; fi
  if [ -n "$default" ]; then
    printf '%s [%s]: ' "$question" "$default" >/dev/tty
  else
    printf '%s: ' "$question" >/dev/tty
  fi
  IFS= read -r reply </dev/tty || reply=""
  printf '%s' "${reply:-$default}"
}

ask_secret() { # ask_secret <question> → answer on stdout, nothing echoed
  local question="$1" reply=""
  [ -n "$INTERACTIVE" ] || return 0
  printf '%s: ' "$question" >/dev/tty
  TTY_ECHO_OFF=1
  stty -echo </dev/tty 2>/dev/null || true
  IFS= read -r reply </dev/tty || reply=""
  restore_tty
  printf '\n' >/dev/tty
  printf '%s' "$reply"
}

confirm() { # confirm <question> [y|n default] → exit status
  local question="$1" default="${2:-y}" reply=""
  if [ -z "$INTERACTIVE" ]; then [ "$default" = y ]; return; fi
  case "$default" in
    y) printf '%s [Y/n] ' "$question" >/dev/tty ;;
    *) printf '%s [y/N] ' "$question" >/dev/tty ;;
  esac
  IFS= read -r reply </dev/tty || reply=""
  reply="${reply:-$default}"
  case "$reply" in [Yy]*) return 0 ;; *) return 1 ;; esac
}

# ── Preflight ───────────────────────────────────────────────────────────────

case "$(uname -s)" in
  Linux)  OS=linux ;;
  Darwin) OS=darwin ;;
  *) die "Unsupported OS: $(uname -s). OpenHosting installs on Linux or macOS." ;;
esac

command -v curl >/dev/null 2>&1 || die "curl is required."

SUDO=""
if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then SUDO="sudo"; fi

gen_hex() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$1"
  else
    od -vN "$1" -An -tx1 /dev/urandom | tr -d ' \n'
  fi
}

# ── Docker ──────────────────────────────────────────────────────────────────

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    if [ "$OS" = darwin ]; then
      die "Docker is required. Install Docker Desktop (https://docs.docker.com/desktop/setup/install/mac-install/) and re-run."
    fi
    if [ "${OH_INSTALL_DOCKER:-0}" != "1" ]; then
      if [ -n "$INTERACTIVE" ]; then
        confirm "Docker is not installed. Install it now from get.docker.com?" y \
          || die "Docker is required. Install it and re-run."
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
}

# `docker compose exec/run` attach stdin by default, and under `curl … | bash`
# stdin is the script itself — a command that reads it swallows the rest of the
# installer (or the answers meant for the next prompt). So compose never sees
# stdin unless a caller deliberately hands it some.
compose() { (cd "$OH_DIR" && $COMPOSE "$@" </dev/null); }
compose_stdin() { (cd "$OH_DIR" && $COMPOSE "$@"); }

container_running() { # container_running <service>
  local id
  id="$(compose ps -q "$1" 2>/dev/null | head -n1)"
  [ -n "$id" ] || return 1
  [ "$($DOCKER inspect -f '{{.State.Running}}' "$id" 2>/dev/null)" = "true" ]
}

# ── Ports ───────────────────────────────────────────────────────────────────

listeners() {
  if command -v ss >/dev/null 2>&1; then ss -ltn 2>/dev/null
  elif command -v netstat >/dev/null 2>&1; then netstat -ltn 2>/dev/null
  fi
}

port_in_use() { # port_in_use <port>
  local port="$1" lines
  lines="$(listeners)"
  if [ -n "$lines" ] && printf '%s\n' "$lines" | awk '{print $4}' | grep -qE "[:.]${port}\$"; then
    return 0
  fi
  # Nothing to read the listen table with (or a listener it missed): try to
  # connect. Bash opens /dev/tcp itself, so this needs no extra tooling — the
  # subshell drops the descriptor again.
  if (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then
    return 0
  fi
  return 1
}

port_owner() { # best-effort process name holding <port>, empty when unknown
  local port="$1" who=""
  if command -v ss >/dev/null 2>&1; then
    who="$($SUDO ss -ltnp 2>/dev/null | awk -v p="[:.]${port}$" '$4 ~ p' \
      | sed -n 's/.*users:((\"\([^\"]*\)\".*/\1/p' | head -n1)"
  fi
  if [ -z "$who" ] && command -v lsof >/dev/null 2>&1; then
    who="$($SUDO lsof -iTCP:"$port" -sTCP:LISTEN -Fc -n -P 2>/dev/null | sed -n 's/^c//p' | head -n1)"
  fi
  printf '%s' "$who"
}

port_available() { # free, or already held by this install's own container
  local port="$1"
  port_in_use "$port" || return 0
  [ -n "${CURRENT_PORT:-}" ] && [ "$port" = "$CURRENT_PORT" ] && container_running app
}

valid_port() {
  case "$1" in
    ''|*[!0-9]*) return 1 ;;
  esac
  [ "${#1}" -le 5 ] || return 1
  [ "$1" -ge 1 ] && [ "$1" -le 65535 ]
}

first_free_port() { # first free port at or above <port>, empty if none nearby
  local p="$1" limit=$(( $1 + 50 ))
  [ "$limit" -gt 65535 ] && limit=65535
  while [ "$p" -le "$limit" ]; do
    if port_available "$p"; then printf '%s' "$p"; return 0; fi
    p=$((p + 1))
  done
  printf ''
}

suggest_ports() { # up to three free ports to offer, starting at <port>
  local want="$1" p out="" n=0
  for p in "$(first_free_port "$want")" 8080 8000 8888 9000; do
    [ -n "$p" ] || continue
    case " $out " in *" $p "*) continue ;; esac
    port_available "$p" || continue
    out="${out:+$out }$p"
    n=$((n + 1))
    [ "$n" -ge 3 ] && break
  done
  printf '%s' "$out"
}

choose_port() { # resolve APP_PORT from <wanted port>
  local want="$1" owner suggestions default reply

  # Unattended: keep the requested port when it is free, otherwise move to the
  # nearest free one rather than failing during `compose up`.
  if [ -z "$INTERACTIVE" ]; then
    if port_available "$want"; then APP_PORT="$want"; return 0; fi
    owner="$(port_owner "$want")"
    warn "Port $want is already in use${owner:+ (by $owner)}."
    APP_PORT="$(first_free_port "$((want + 1))")"
    [ -n "$APP_PORT" ] || die "No free port near $want — pass --port <number>."
    warn "Using port $APP_PORT instead (pass --port to choose)."
    return 0
  fi

  default="$want"
  if ! port_available "$want"; then
    owner="$(port_owner "$want")"
    suggestions="$(suggest_ports "$((want + 1))")"
    warn "Port $want is already in use${owner:+ (by $owner)}."
    say "    Free ports: $(printf '%s' "${suggestions:-none nearby}" | sed 's/ /, /g')"
    default="${suggestions%% *}"
  fi

  while :; do
    reply="$(ask "    Port to publish OpenHosting on" "$default")"
    if ! valid_port "$reply"; then
      warn "Enter a port number between 1 and 65535."
      continue
    fi
    if port_available "$reply"; then APP_PORT="$reply"; return 0; fi
    owner="$(port_owner "$reply")"
    warn "Port $reply is in use${owner:+ by $owner}."
    if confirm "    Use it anyway (the app will not start until that port is free)?" n; then
      APP_PORT="$reply"; return 0
    fi
  done
}

# ── .env ────────────────────────────────────────────────────────────────────

# APP_PORT may carry a bind address ("127.0.0.1:3000" publishes to localhost
# only, the usual hardening behind a reverse proxy). Everything here works with
# the port number; the prefix is remembered and written back untouched.
parse_port_spec() {
  case "$1" in
    *:*) APP_BIND="${1%:*}:"; APP_PORT="${1##*:}" ;;
    *)   APP_BIND="";         APP_PORT="$1" ;;
  esac
}

port_spec() { printf '%s%s' "$APP_BIND" "$APP_PORT"; }

# Localhost-bound installs are only reachable through the proxy in front.
port_is_local_only() {
  case "$APP_BIND" in
    127.0.0.1:|localhost:|::1:|"[::1]":) return 0 ;;
    *) return 1 ;;
  esac
}

env_get() { sed -n "s/^$1=//p" "$OH_DIR/.env" 2>/dev/null | head -n1; }

env_set() { # env_set <key> <value> — creates or replaces the line, keeps perms
  local key="$1" value="$2" file="$OH_DIR/.env" tmp
  tmp="$(mktemp)"
  if [ -f "$file" ] && grep -q "^${key}=" "$file"; then
    awk -v k="$key" -v v="$value" -F= '$1 == k && !seen { print k "=" v; seen = 1; next } { print }' \
      "$file" >"$tmp"
  else
    [ -f "$file" ] && cat "$file" >"$tmp"
    printf '%s=%s\n' "$key" "$value" >>"$tmp"
  fi
  cat "$tmp" >"$file"
  rm -f "$tmp"
  chmod 600 "$file"
}

write_fresh_env() {
  info "Generating secrets in $OH_DIR/.env"
  cat >"$OH_DIR/.env" <<EOF
# Generated by the OpenHosting installer — keep this file private.
# docker-compose.yml reads these values; DB_PASSWORD must not change once the
# database volume exists.
DB_PASSWORD=$(gen_hex 16)
CRON_SECRET=$(gen_hex 32)
APP_PORT=$(port_spec)
# Address of the first admin account, used by the seed only.
SEED_ADMIN_EMAIL=$ADMIN_EMAIL
EOF
  chmod 600 "$OH_DIR/.env"
}

# ── Source ──────────────────────────────────────────────────────────────────

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

fetch_source() {
  if [ -d "$OH_DIR/.git" ] && command -v git >/dev/null 2>&1; then
    info "Fetching the latest code in $OH_DIR"
    if ! git -C "$OH_DIR" pull --ff-only; then
      warn "Could not fast-forward $OH_DIR — keeping the current version."
    fi
  elif [ -f "$OH_DIR/docker-compose.yml" ]; then
    info "Refreshing the code in $OH_DIR"
    download_tarball
  elif command -v git >/dev/null 2>&1; then
    info "Downloading OpenHosting ($OH_REF) to $OH_DIR"
    git clone --depth 1 --branch "$OH_REF" "$OH_REPO" "$OH_DIR"
  else
    info "Downloading OpenHosting ($OH_REF) to $OH_DIR"
    download_tarball
  fi
}

installed_version() {
  local v
  v="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$OH_DIR/package.json" 2>/dev/null | head -n1)"
  printf '%s' "${v:-unknown}"
}

# ── Stack ───────────────────────────────────────────────────────────────────

start_stack() { # start_stack [extra compose up flags…]
  info "Building and starting containers (the first build takes a few minutes)…"
  compose up -d --build "$@"
}

wait_for_app() {
  local i
  info "Waiting for the app on port $APP_PORT…"
  for i in $(seq 1 90); do
    # -S is left off deliberately: connection refused is expected while the
    # container boots and should not print anything.
    if curl -fs -o /dev/null "http://127.0.0.1:$APP_PORT/"; then return 0; fi
    if [ "$i" -gt 3 ] && ! container_running app; then
      warn "The app container is not running. Last log lines:"
      compose logs --tail 30 app >&2 || true
      return 1
    fi
    sleep 2
  done
  return 1
}

# Runs a command in the app image: inside the running container when there is
# one, otherwise as a throwaway container so recovery still works when the app
# will not boot. app_run closes stdin; app_run_stdin forwards it (that is how
# passwords reach the tools without ever appearing in `ps`).
app_run() { app_run_stdin "$@" </dev/null; }

app_run_stdin() {
  if container_running app; then
    compose_stdin exec -T app "$@"
  else
    # No running container (a crash loop, say): a throwaway one runs the command
    # through the entrypoint. busybox `timeout` is always in the image and stops
    # an image older than that entrypoint from booting the server and hanging.
    compose_stdin run --rm -T app timeout 300 "$@"
  fi
}

app_has_recovery_tool() { app_run test -f prisma/reset-admin.mjs >/dev/null 2>&1; }

staff_emails() { # one address per line; empty when the tool is unavailable
  app_run node prisma/reset-admin.mjs --list 2>/dev/null \
    | sed -n 's/^  \([^ ]*@[^ ]*\).*/\1/p'
}

staff_status() { # none | some | unknown
  local out
  if ! out="$(app_run node prisma/reset-admin.mjs --list 2>/dev/null)"; then
    printf 'unknown'; return 0
  fi
  case "$out" in
    *"No staff accounts yet"*) printf 'none' ;;
    *"Staff accounts:"*)       printf 'some' ;;
    *)                         printf 'unknown' ;;
  esac
}

run_seed() { # run_seed [initial admin password]
  local password="${1:-}" log rc=0 app_url=""
  # With a domain we know the site's real address, so the seed can replace the
  # localhost placeholder that would otherwise end up in emails, payment
  # redirects and referral links.
  [ -n "$DOMAIN" ] && app_url="https://$DOMAIN"
  log="$(mktemp)"
  info "Seeding the database (admin account, sample catalog)…"
  if [ -n "$password" ]; then
    # The password arrives on stdin so it never shows up in `ps` or in the
    # container's environment.
    printf '%s' "$password" | compose_stdin exec -T \
      -e SEED_ADMIN_EMAIL="$ADMIN_EMAIL" -e APP_URL="$app_url" app \
      sh -c 'SEED_ADMIN_PASSWORD="$(cat)" exec node prisma/seed.mjs' >"$log" 2>&1 || rc=$?
  else
    compose exec -T -e SEED_ADMIN_EMAIL="$ADMIN_EMAIL" -e APP_URL="$app_url" app \
      node prisma/seed.mjs >"$log" 2>&1 || rc=$?
  fi
  if [ "$rc" -ne 0 ]; then
    warn "The seed failed:"
    tail -n 20 "$log" >&2 || true
    rm -f "$log"
    die "Fix the error above, then re-run this installer."
  fi
  rm -f "$log"
}

apply_password() { # apply_password <email> <password> — returns the tool's status
  local email="$1" password="$2" extra=""
  [ "$DISABLE_2FA" -eq 1 ] && extra="--disable-2fa"
  # shellcheck disable=SC2086 # $extra is an intentional word split
  printf '%s' "$password" | app_run_stdin node prisma/reset-admin.mjs \
    --email "$email" --password-stdin $extra
}

# ── nginx + HTTPS ───────────────────────────────────────────────────────────

# A vhost that already proxies to this install, whatever it is called. Sites
# written by hand (or by an older installer) are then updated in place instead
# of being shadowed by a second server block.
nginx_site_for_app() {
  local dir f
  [ -n "$APP_PORT" ] || return 1
  for dir in /etc/nginx/sites-enabled /etc/nginx/conf.d /etc/nginx/sites-available; do
    [ -d "$dir" ] || continue
    for f in "$dir"/*; do
      [ -e "$f" ] || continue
      if $SUDO grep -qsE "proxy_pass +http://(127\.0\.0\.1|localhost):$APP_PORT;" "$f"; then
        readlink -f "$f" 2>/dev/null || printf '%s' "$f"
        return 0
      fi
    done
  done
  return 1
}

nginx_conf_path() {
  local existing
  if existing="$(nginx_site_for_app)" && [ -n "$existing" ]; then
    printf '%s' "$existing"
  elif [ -d /etc/nginx/sites-available ]; then
    printf '/etc/nginx/sites-available/openhosting.conf'
  else
    printf '/etc/nginx/conf.d/openhosting.conf'
  fi
}

nginx_configured_domain() {
  local conf; conf="$(nginx_conf_path)"
  [ -f "$conf" ] || return 0
  $SUDO sed -n 's/^[[:space:]]*server_name[[:space:]]\{1,\}\([^;[:space:]]\{1,\}\).*/\1/p' "$conf" \
    | grep -v '^_$' | head -n1 || true
}

nginx_reload() {
  if ! $SUDO nginx -t >/dev/null 2>&1; then
    warn "nginx config test failed — fix $(nginx_conf_path), then run: nginx -t && systemctl reload nginx"
    return 1
  fi
  if command -v systemctl >/dev/null 2>&1; then
    $SUDO systemctl enable --now nginx >/dev/null 2>&1 || true
    $SUDO systemctl reload nginx 2>/dev/null || $SUDO systemctl restart nginx
  else
    $SUDO nginx -s reload 2>/dev/null || $SUDO nginx
  fi
}

nginx_sync_port() { # point an existing site at the current APP_PORT
  local conf; conf="$(nginx_conf_path)"
  [ -f "$conf" ] || return 0
  if $SUDO grep -q "proxy_pass http://127.0.0.1:$APP_PORT;" "$conf"; then
    NGINX_OK=1
    return 0
  fi
  info "Pointing nginx at port $APP_PORT"
  $SUDO sed -i -E "s|proxy_pass http://127\.0\.0\.1:[0-9]+;|proxy_pass http://127.0.0.1:$APP_PORT;|g" "$conf"
  if nginx_reload; then NGINX_OK=1; fi
  return 0
}

public_url() {
  local ip
  if [ -n "$HTTPS_OK" ] && [ -n "$DOMAIN" ]; then
    printf 'https://%s' "$DOMAIN"
  elif [ -n "$NGINX_OK" ] && [ -n "$DOMAIN" ]; then
    printf 'http://%s' "$DOMAIN"
  elif port_is_local_only; then
    # Published to loopback only: the LAN address would not answer.
    printf 'http://127.0.0.1:%s' "$APP_PORT"
  else
    ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
    [ -n "$ip" ] || ip="localhost"
    printf 'http://%s:%s' "$ip" "$APP_PORT"
  fi
}

domain_resolves_here() { # rough sanity check before bothering Let's Encrypt
  local domain="$1" ips resolved ip
  command -v getent >/dev/null 2>&1 || return 0
  resolved="$(getent ahostsv4 "$domain" 2>/dev/null | awk '{print $1}' | sort -u)"
  [ -n "$resolved" ] || return 1
  ips="$(hostname -I 2>/dev/null || true)"
  for ip in $resolved; do
    case " $ips " in *" $ip "*) return 0 ;; esac
  done
  return 2  # resolves, but not to a local address (normal behind NAT)
}

setup_nginx() {
  local pkg="" conf default_flag="" mail_args
  if command -v apt-get >/dev/null 2>&1; then pkg=apt
  elif command -v dnf >/dev/null 2>&1; then pkg=dnf
  elif command -v yum >/dev/null 2>&1; then pkg=yum
  else
    warn "No supported package manager (apt/dnf/yum) — skipping nginx setup."
    return 1
  fi

  if ! command -v nginx >/dev/null 2>&1; then
    info "Installing nginx…"
    case "$pkg" in
      apt) $SUDO apt-get update -qq && $SUDO apt-get install -y -qq nginx ;;
      *)   $SUDO "$pkg" install -y nginx ;;
    esac || { warn "Could not install nginx — skipping HTTPS setup."; return 1; }
  fi

  conf="$(nginx_conf_path)"

  # On re-runs, reuse the domain already configured (possibly by certbot).
  [ -n "$DOMAIN" ] || DOMAIN="$(nginx_configured_domain)"

  if [ ! -f "$conf" ]; then
    info "Configuring nginx → 127.0.0.1:$APP_PORT"
    if [ -d /etc/nginx/sites-enabled ]; then
      # Replace the stock welcome site so requests reach the app.
      [ -L /etc/nginx/sites-enabled/default ] && $SUDO rm -f /etc/nginx/sites-enabled/default
      grep -rqs default_server /etc/nginx/sites-enabled/ || default_flag=" default_server"
    fi
    $SUDO tee "$conf" >/dev/null <<EOF
# Managed by the OpenHosting installer. certbot rewrites this file when HTTPS
# is enabled; the installer only ever updates the proxied port afterwards.
map \$http_upgrade \$connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 80$default_flag;
    server_name ${DOMAIN:-_};

    client_max_body_size 32m;

    location / {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
    if [ -d /etc/nginx/sites-enabled ]; then
      $SUDO ln -sf "$conf" /etc/nginx/sites-enabled/openhosting.conf
    fi
  else
    # A domain supplied after a domainless install: fill in server_name.
    if [ -n "$DOMAIN" ]; then
      $SUDO sed -i "s/server_name _;/server_name $DOMAIN;/" "$conf"
    fi
    $SUDO sed -i -E "s|proxy_pass http://127\.0\.0\.1:[0-9]+;|proxy_pass http://127.0.0.1:$APP_PORT;|g" "$conf"
  fi

  # SELinux blocks nginx from proxying to the app port unless allowed.
  if command -v getenforce >/dev/null 2>&1 && [ "$(getenforce 2>/dev/null)" = "Enforcing" ]; then
    $SUDO setsebool -P httpd_can_network_connect 1 \
      || warn "Could not set SELinux httpd_can_network_connect — nginx may answer 502."
  fi
  if command -v firewall-cmd >/dev/null 2>&1 && $SUDO firewall-cmd --state >/dev/null 2>&1; then
    $SUDO firewall-cmd -q --permanent --add-service=http --add-service=https 2>/dev/null \
      && $SUDO firewall-cmd -q --reload 2>/dev/null || true
  elif command -v ufw >/dev/null 2>&1 && $SUDO ufw status 2>/dev/null | grep -q '^Status: active'; then
    $SUDO ufw allow 80/tcp >/dev/null 2>&1 || true
    $SUDO ufw allow 443/tcp >/dev/null 2>&1 || true
  fi

  nginx_reload || return 1
  NGINX_OK=1

  if [ -z "$DOMAIN" ]; then
    warn "No domain given — serving plain HTTP. Re-run with --domain your.domain to enable HTTPS."
    return 0
  fi

  # Already covered by a certificate? certbot's own config is the source of truth.
  if $SUDO test -d "/etc/letsencrypt/live/$DOMAIN"; then
    HTTPS_OK=1
    return 0
  fi

  # certbot --nginx edits the config in place and installs a renewal timer.
  if ! command -v certbot >/dev/null 2>&1; then
    info "Installing certbot…"
    case "$pkg" in
      apt) $SUDO apt-get install -y -qq certbot python3-certbot-nginx ;;
      *)   $SUDO "$pkg" install -y certbot python3-certbot-nginx ;;
    esac || { warn "Could not install certbot (on RHEL-likes it needs EPEL). HTTPS not enabled — see docs/getting-started/reverse-proxy-ssl.md"; return 0; }
  fi

  mail_args="--register-unsafely-without-email"
  [ -n "${OH_EMAIL:-}" ] && mail_args="-m $OH_EMAIL"

  info "Requesting a Let's Encrypt certificate for $DOMAIN…"
  # shellcheck disable=SC2086 # mail_args is an intentional word split
  if $SUDO certbot --nginx -d "$DOMAIN" --redirect --agree-tos --non-interactive $mail_args; then
    HTTPS_OK=1
  else
    warn "certbot failed — usually the DNS A record for $DOMAIN does not point at this server yet."
    warn "Once DNS resolves here, run: certbot --nginx -d $DOMAIN --redirect"
  fi
}

nginx_enabled() { [ "$OS" = linux ] && [ "${OH_SKIP_NGINX:-0}" != "1" ]; }

run_nginx_setup() {
  nginx_enabled || return 0
  if [ "$(id -u)" -ne 0 ] && [ -z "$SUDO" ]; then
    warn "Not root and no sudo available — skipping the nginx / HTTPS setup."
    return 0
  fi
  setup_nginx || true
}

# ── Existing install ────────────────────────────────────────────────────────

is_installed() { [ -f "$1/.env" ] && [ -f "$1/docker-compose.yml" ]; }

locate_install() {
  local candidate
  is_installed "$OH_DIR" && return 0
  [ "$OH_DIR_SET" -eq 1 ] && return 1
  for candidate in /opt/openhosting "$HOME/openhosting"; do
    if [ "$candidate" != "$OH_DIR" ] && is_installed "$candidate"; then
      info "Found an existing install in $candidate — using it (override with --dir)."
      OH_DIR="$candidate"
      return 0
    fi
  done
  return 1
}

load_install() { # read the settings of the install in $OH_DIR
  parse_port_spec "$(env_get APP_PORT)"
  APP_PORT="${APP_PORT:-$DEFAULT_PORT}"
  CURRENT_PORT="$APP_PORT"
  [ -n "$ADMIN_EMAIL" ] || ADMIN_EMAIL="$(env_get SEED_ADMIN_EMAIL)"
  [ -n "$ADMIN_EMAIL" ] || ADMIN_EMAIL="admin@example.com"
  if nginx_enabled && [ -z "$DOMAIN" ]; then DOMAIN="$(nginx_configured_domain)"; fi
  if [ -n "$DOMAIN" ] && $SUDO test -d "/etc/letsencrypt/live/$DOMAIN" 2>/dev/null; then HTTPS_OK=1; fi
  [ -f "$(nginx_conf_path)" ] && NGINX_OK=1
  return 0
}

# ── Interactive setup questions ─────────────────────────────────────────────

ask_install_dir() {
  local reply
  [ -n "$INTERACTIVE" ] || return 0
  [ "$OH_DIR_SET" -eq 1 ] && return 0
  reply="$(ask "    Install directory" "$OH_DIR")"
  [ -n "$reply" ] && OH_DIR="$reply"
  return 0
}

ask_domain() {
  local reply status
  nginx_enabled || return 0
  [ -n "$DOMAIN" ] && return 0
  [ -n "$INTERACTIVE" ] || return 0
  say ""
  say "  A domain gets you nginx + a free Let's Encrypt certificate (HTTPS)."
  say "  Leave it empty to serve plain HTTP for now — you can add it later."
  while :; do
    reply="$(ask "    Domain (e.g. billing.example.com)" "")"
    [ -z "$reply" ] && return 0
    case "$reply" in
      *" "*|*://*|*/*) warn "Enter just the hostname, e.g. billing.example.com."; continue ;;
      *.*) ;;
      *) warn "That does not look like a domain."; continue ;;
    esac
    DOMAIN="$reply"
    set +e; domain_resolves_here "$DOMAIN"; status=$?; set -e
    case "$status" in
      1) warn "$DOMAIN does not resolve yet — the certificate request will fail until DNS is set." ;;
      2) warn "$DOMAIN does not resolve to an address on this server (normal behind NAT or a proxy)." ;;
    esac
    if [ -z "${OH_EMAIL:-}" ]; then
      OH_EMAIL="$(ask "    Email for certificate expiry notices (optional)" "")"
    fi
    return 0
  done
}

ask_admin_account() {
  local reply pw1 pw2
  [ -n "$INTERACTIVE" ] || return 0
  say ""
  say "  The first administrator account."
  if [ -z "$ADMIN_EMAIL" ]; then
    while :; do
      reply="$(ask "    Admin email" "admin@example.com")"
      case "$reply" in
        *@*.*) ADMIN_EMAIL="$reply"; break ;;
        *) warn "Enter a valid email address." ;;
      esac
    done
  fi
  [ -n "$ADMIN_PASSWORD" ] && return 0
  while :; do
    pw1="$(ask_secret "    Admin password (Enter to generate one)")"
    if [ -z "$pw1" ]; then return 0; fi
    if [ "${#pw1}" -lt 8 ]; then
      warn "Use at least 8 characters."
      continue
    fi
    pw2="$(ask_secret "    Repeat the password")"
    if [ "$pw1" != "$pw2" ]; then
      warn "The passwords do not match."
      continue
    fi
    ADMIN_PASSWORD="$pw1"
    return 0
  done
}

# ── Actions ─────────────────────────────────────────────────────────────────

action_install() {
  local fresh_db="" status generated="" created="" emails=""
  say ""
  info "Installing OpenHosting"
  ask_install_dir

  # Everything that needs an answer is asked before the long work starts.
  choose_port "${OH_PORT:-$DEFAULT_PORT}"
  ask_domain
  ask_admin_account
  ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"

  if [ -n "$INTERACTIVE" ]; then
    say ""
    say "  Directory:  $OH_DIR"
    say "  Port:       $APP_PORT"
    say "  Domain:     ${DOMAIN:-none (plain HTTP)}"
    say "  Admin:      $ADMIN_EMAIL"
    if [ -n "$ADMIN_PASSWORD" ]; then
      say "  Password:   the one you typed"
    else
      say "  Password:   generated for you"
    fi
    say ""
    confirm "  Install with these settings?" y || die "Nothing was installed."
  fi

  if [ -z "$ADMIN_PASSWORD" ]; then
    ADMIN_PASSWORD="$(gen_hex 8)"
    generated=1
  fi

  fetch_source
  if [ -f "$OH_DIR/.env" ]; then
    info "Keeping existing secrets in $OH_DIR/.env"
    env_set APP_PORT "$(port_spec)"
    env_set SEED_ADMIN_EMAIL "$ADMIN_EMAIL"
  else
    write_fresh_env
    fresh_db=1
  fi

  start_stack
  wait_for_app || die "The app did not respond within 3 minutes. Check the logs: cd $OH_DIR && $COMPOSE_HINT logs app"

  # Only send a password to the seed when there is no admin yet; on a database
  # that already has one the seed would ignore it anyway.
  status="$(staff_status)"
  if [ "$status" = some ]; then
    run_seed
  else
    [ -n "$fresh_db" ] || info "No admin account found — creating $ADMIN_EMAIL"
    run_seed "$ADMIN_PASSWORD"
    # Name the account that actually exists: an older --ref can ship a seed
    # that ignores SEED_ADMIN_EMAIL.
    emails="$(staff_emails)"
    if [ -n "$emails" ] && ! printf '%s\n' "$emails" | grep -qxF "$ADMIN_EMAIL"; then
      created="$(printf '%s\n' "$emails" | head -n1)"
      warn "This version's seed created $created rather than $ADMIN_EMAIL."
      ADMIN_EMAIL="$created"
    fi
    if [ -n "$generated" ]; then
      PASSWORD_NOTE="$ADMIN_PASSWORD   (generated — change it after signing in)"
    else
      PASSWORD_NOTE="the one you chose"
    fi
  fi

  run_nginx_setup
  summary
}

action_upgrade() { # also used for --rebuild, with $1 = "rebuild"
  local mode="${1:-upgrade}" setup_https="" configured=""
  load_install
  configured="$(nginx_configured_domain)"

  if [ "$mode" = upgrade ]; then
    info "Upgrading the install in $OH_DIR (v$(installed_version), port $APP_PORT)"
  else
    info "Rebuilding the install in $OH_DIR (v$(installed_version), port $APP_PORT)"
  fi

  # The port may have been taken while the stack was down.
  if ! port_available "$APP_PORT"; then
    choose_port "$APP_PORT"
    env_set APP_PORT "$(port_spec)"
  fi

  # Offer HTTPS to installs that predate the nginx setup, before the long work.
  if [ -n "$INTERACTIVE" ] && nginx_enabled && [ -z "$NGINX_OK" ] && [ -z "$DOMAIN" ] \
     && { [ "$(id -u)" -eq 0 ] || [ -n "$SUDO" ]; }; then
    if confirm "  Set up nginx and a free HTTPS certificate now?" n; then
      setup_https=1
      ask_domain
    fi
  fi

  env_set SEED_ADMIN_EMAIL "$ADMIN_EMAIL"
  if [ "$mode" = upgrade ]; then fetch_source; fi
  if [ "$mode" = rebuild ]; then
    start_stack --force-recreate
  else
    start_stack
  fi
  wait_for_app || die "The app did not respond within 3 minutes. Check the logs: cd $OH_DIR && $COMPOSE_HINT logs app"
  run_seed
  # A working vhost is left alone — an upgrade only makes sure it still points
  # at the app. Packages, certificates and firewall rules are touched again
  # only when HTTPS is being set up or a different domain was asked for.
  if [ -n "$setup_https" ] || { [ -n "${OH_DOMAIN:-}" ] && [ "$OH_DOMAIN" != "$configured" ]; }; then
    run_nginx_setup
  elif [ -n "$NGINX_OK" ]; then
    nginx_sync_port
  fi
  summary
}

action_reset_password() {
  local email pw1 pw2 generated=""
  load_install
  info "Resetting an admin password for the install in $OH_DIR"

  if ! container_running app; then
    info "Starting the stack…"
    compose up -d >/dev/null
    wait_for_app || warn "The app is not answering — trying the reset anyway."
  fi

  if ! app_has_recovery_tool; then
    info "This install predates the recovery tool — rebuilding the app image first…"
    fetch_source
    start_stack
    wait_for_app || die "The app did not come back up. Check: cd $OH_DIR && $COMPOSE_HINT logs app"
    app_has_recovery_tool || die "Could not run the recovery tool. Reset from the app instead: Admin → Users."
  fi

  if [ -n "$INTERACTIVE" ]; then
    say ""
    app_run node prisma/reset-admin.mjs --list 2>/dev/null | sed 's/^/  /' >/dev/tty || true
    say ""
  fi

  email="$(ask "    Account to reset" "$ADMIN_EMAIL")"
  [ -n "$email" ] || die "No account given (pass --admin-email)."

  if [ -n "$ADMIN_PASSWORD" ]; then
    pw1="$ADMIN_PASSWORD"
  elif [ -n "$INTERACTIVE" ]; then
    while :; do
      pw1="$(ask_secret "    New password (Enter to generate one)")"
      if [ -z "$pw1" ]; then pw1="$(gen_hex 8)"; generated=1; break; fi
      if [ "${#pw1}" -lt 8 ]; then warn "Use at least 8 characters."; continue; fi
      pw2="$(ask_secret "    Repeat the password")"
      [ "$pw1" = "$pw2" ] && break
      warn "The passwords do not match."
    done
    if [ "$DISABLE_2FA" -eq 0 ] && confirm "    Also turn off two-factor authentication for this account?" n; then
      DISABLE_2FA=1
    fi
  else
    pw1="$(gen_hex 8)"; generated=1
  fi

  apply_password "$email" "$pw1" || die "The password was not changed."
  ADMIN_EMAIL="$email"

  printf '\n'
  info "Password updated"
  step "Sign in at $(public_url) as $email"
  if [ -n "$generated" ]; then
    step "Password: $pw1"
  else
    step "Password: the one you typed"
  fi
  step "Other sessions for this account were signed out."
  printf '\n'
}

action_reconfigure() {
  local want reply configured changed="" domain_changed=""
  load_install
  configured="$(nginx_configured_domain)"
  info "Reconfiguring the install in $OH_DIR"

  want="${OH_PORT:-}"
  if [ -z "$want" ] && [ -n "$INTERACTIVE" ]; then
    want="$(ask "    Host port for the app" "$APP_PORT")"
  fi
  want="${want:-$APP_PORT}"
  if [ "$want" != "$APP_PORT" ]; then
    valid_port "$want" || die "Invalid port: $want"
    choose_port "$want"
    env_set APP_PORT "$(port_spec)"
    changed=1
  fi

  if nginx_enabled; then
    if [ -n "$INTERACTIVE" ]; then
      reply="$(ask "    Domain (empty = plain HTTP)" "$DOMAIN")"
    else
      reply="${OH_DOMAIN:-$DOMAIN}"
    fi
    if [ -n "$reply" ] && [ "$reply" != "$configured" ]; then
      DOMAIN="$reply"
      changed=1
      domain_changed=1
      if [ -z "${OH_EMAIL:-}" ] && [ -n "$INTERACTIVE" ]; then
        OH_EMAIL="$(ask "    Email for certificate expiry notices (optional)" "")"
      fi
    fi
  fi

  if [ -z "$changed" ]; then
    info "Nothing to change."
    summary
    return 0
  fi

  info "Applying the new settings…"
  compose up -d >/dev/null
  wait_for_app || warn "The app is not answering on port $APP_PORT yet."
  nginx_sync_port
  # Only touch nginx when this install already has a site or a domain was asked
  # for: changing the port must not install a web server behind your back.
  if [ -n "$NGINX_OK" ] || [ -n "$domain_changed" ]; then
    run_nginx_setup
  fi
  summary
}

action_status() {
  local code
  load_install
  code="$(curl -s -o /dev/null -m 5 -w '%{http_code}' "http://127.0.0.1:$APP_PORT/" 2>/dev/null || true)"
  case "${code:-000}" in 000) code="no answer" ;; esac
  printf '\n'
  info "OpenHosting in $OH_DIR"
  step "Version:    $(installed_version)"
  step "URL:        $(public_url)"
  step "Port:       $APP_PORT  (127.0.0.1:$APP_PORT → $code)"
  step "Domain:     ${DOMAIN:-none}${HTTPS_OK:+  (HTTPS enabled)}"
  step "Admin:      $ADMIN_EMAIL"
  printf '\n'
  compose ps || true
  printf '\n'
  step "Logs:    cd $OH_DIR && $COMPOSE_HINT logs -f app"
  step "Manage:  re-run this installer"
  printf '\n'
}

action_reinstall() {
  local reply backup
  load_install
  warn "A reinstall deletes the OpenHosting database volume: every account,"
  warn "order, invoice and ticket in $OH_DIR is removed."
  if [ -n "$INTERACTIVE" ]; then
    reply="$(ask "    Type DELETE to confirm" "")"
    [ "$reply" = "DELETE" ] || die "Nothing was changed."
  elif [ "$ASSUME_YES" != "1" ]; then
    die "Refusing to wipe data without --yes."
  fi

  info "Removing containers and the database volume…"
  compose down -v --remove-orphans || true

  backup="$OH_DIR/.env.backup-$(date +%Y%m%d%H%M%S)"
  if [ -f "$OH_DIR/.env" ]; then
    mv "$OH_DIR/.env" "$backup"
    step "Old secrets saved to $backup"
  fi

  # Fresh secrets, fresh answers — but keep the port as the default this time.
  ADMIN_EMAIL="${OH_ADMIN_EMAIL:-}"
  OH_PORT="${OH_PORT:-$APP_PORT}"
  CURRENT_PORT=""
  action_install
}

action_uninstall() {
  local conf link
  load_install
  info "Uninstalling the OpenHosting stack in $OH_DIR"
  if [ -n "$INTERACTIVE" ]; then
    confirm "  Stop and remove the containers?" y || die "Nothing was changed."
  elif [ "$ASSUME_YES" != "1" ]; then
    die "Refusing to remove the stack without --yes."
  fi

  if [ "$WIPE" -eq 1 ] || { [ -n "$INTERACTIVE" ] && confirm "  Delete the database volume too (all data)?" n; }; then
    compose down -v --remove-orphans || true
    step "Containers and data removed."
  else
    compose down --remove-orphans || true
    step "Containers removed — the database volume was kept."
  fi

  conf="$(nginx_conf_path)"
  if [ -f "$conf" ] && [ -n "$INTERACTIVE" ] && confirm "  Remove the nginx site ($conf)?" n; then
    $SUDO rm -f "$conf"
    for link in /etc/nginx/sites-enabled/*; do
      if [ -L "$link" ] && [ "$(readlink -f "$link" 2>/dev/null)" = "$conf" ]; then
        $SUDO rm -f "$link"
      fi
    done
    nginx_reload || true
    step "nginx site removed (certificates under /etc/letsencrypt were kept)."
  fi

  if [ -n "$INTERACTIVE" ] && confirm "  Delete the install directory $OH_DIR?" n; then
    if [ -f "$OH_DIR/docker-compose.yml" ]; then
      rm -rf "$OH_DIR"
      step "$OH_DIR deleted."
    else
      warn "$OH_DIR does not look like an OpenHosting install — leaving it alone."
    fi
  else
    step "Kept $OH_DIR (re-run this installer to bring the stack back)."
  fi
  printf '\n'
}

# ── Menu ────────────────────────────────────────────────────────────────────

choose_action() {
  local reply
  printf '\n'
  info "OpenHosting is already installed in $OH_DIR"
  step "version $(installed_version) · port $APP_PORT${DOMAIN:+ · $DOMAIN}$([ -n "$HTTPS_OK" ] && printf ' (HTTPS)')"
  printf '\n'
  printf '   1) Upgrade to the latest version      %skeeps all data%s\n' "$DIM" "$RESET"
  printf '   2) Rebuild the containers             %skeeps all data%s\n' "$DIM" "$RESET"
  printf '   3) Reset the admin password\n'
  printf '   4) Change the port or domain\n'
  printf '   5) Show status\n'
  printf '   6) Reinstall from scratch             %sdeletes the database%s\n' "$YELLOW" "$RESET"
  printf '   7) Uninstall                          %sremoves the stack%s\n' "$YELLOW" "$RESET"
  printf '   q) Quit\n'
  printf '\n'
  reply="$(ask "   What would you like to do?" "1")"
  case "$reply" in
    1) ACTION=upgrade ;;
    2) ACTION=rebuild ;;
    3) ACTION=reset-password ;;
    4) ACTION=reconfigure ;;
    5) ACTION=status ;;
    6) ACTION=reinstall ;;
    7) ACTION=uninstall ;;
    q|Q) info "Nothing to do."; exit 0 ;;
    *) die "Unknown choice: $reply" ;;
  esac
}

# ── Summary ─────────────────────────────────────────────────────────────────

summary() {
  local url
  url="$(public_url)"

  printf '\n'
  printf '%s────────────────────────────────────────────────────────────────%s\n' "$DIM" "$RESET"
  printf ' %s%s✅ OpenHosting is running%s\n\n' "$BOLD" "$GREEN" "$RESET"
  printf '   URL:       %s\n' "$url"
  printf '   Admin:     %s\n' "$ADMIN_EMAIL"
  printf '   Password:  %s\n' "$PASSWORD_NOTE"
  printf '\n'
  printf '   Install:   %s  (secrets in .env — keep that file safe)\n' "$OH_DIR"
  printf '   Manage:    re-run this installer (upgrade, ports, password, uninstall)\n'
  printf '   Logs:      cd %s && %s logs -f app\n' "$OH_DIR" "$COMPOSE_HINT"
  printf '\n'
  printf ' Next steps\n'
  if [ -n "$HTTPS_OK" ]; then
    printf '   • Set Admin → Settings → Public URL to %s\n' "$url"
    printf '   • Certificate renewal is automatic (certbot timer)\n'
  elif [ -n "$NGINX_OK" ] && [ -n "$DOMAIN" ]; then
    printf '   • Point the DNS A record for %s at this server, then run:\n' "$DOMAIN"
    printf '       certbot --nginx -d %s --redirect\n' "$DOMAIN"
    printf '   • Then set Admin → Settings → Public URL to https://%s\n' "$DOMAIN"
  elif [ -n "$NGINX_OK" ]; then
    printf '   • Re-run this installer with --domain billing.example.com to enable HTTPS\n'
    printf '   • Then set Admin → Settings → Public URL to your https:// domain\n'
  else
    printf '   • Put a reverse proxy with TLS in front of port %s:\n' "$APP_PORT"
    printf '     https://github.com/solomon2773/openhosting/blob/main/docs/getting-started/reverse-proxy-ssl.md\n'
    printf '   • Set Admin → Settings → Public URL to your https:// domain\n'
  fi
  printf '   • Docs: https://github.com/solomon2773/openhosting/tree/main/docs\n'
  printf '%s────────────────────────────────────────────────────────────────%s\n' "$DIM" "$RESET"
}

# ── Run ─────────────────────────────────────────────────────────────────────

require_docker

if locate_install; then
  parse_port_spec "$(env_get APP_PORT)"
  APP_PORT="${APP_PORT:-$DEFAULT_PORT}"
  CURRENT_PORT="$APP_PORT"
  if [ -z "$ACTION" ]; then
    if [ -n "$INTERACTIVE" ]; then
      DOMAIN="${DOMAIN:-$(nginx_configured_domain)}"
      [ -n "$DOMAIN" ] && $SUDO test -d "/etc/letsencrypt/live/$DOMAIN" 2>/dev/null && HTTPS_OK=1
      choose_action
    else
      ACTION=upgrade   # what a plain re-run has always done
    fi
  fi
else
  case "$ACTION" in
    ""|install) ACTION=install ;;
    upgrade|rebuild) ACTION=install ;;  # nothing to upgrade yet
    reinstall) ACTION=install ;;
    *) die "No OpenHosting install found in $OH_DIR. Run the installer without --$ACTION to create one, or pass --dir to point at an existing install." ;;
  esac
fi

case "$ACTION" in
  install)        action_install ;;
  upgrade)        action_upgrade upgrade ;;
  rebuild)        action_upgrade rebuild ;;
  reset-password) action_reset_password ;;
  reconfigure)    action_reconfigure ;;
  status)         action_status ;;
  reinstall)      action_reinstall ;;
  uninstall)      action_uninstall ;;
  *) die "Unknown action: $ACTION" ;;
esac
