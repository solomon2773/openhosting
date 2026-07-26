#!/bin/sh
set -e

# A command passed to the container runs instead of the server, without
# touching migrations — how the installer recovers an install whose app is
# down (`docker compose run --rm app node prisma/reset-admin.mjs …`).
if [ "$#" -gt 0 ]; then
  exec "$@"
fi

if [ "${SKIP_MIGRATIONS:-false}" != "true" ]; then
  echo "Applying database migrations…"
  node prisma-cli/node_modules/prisma/build/index.js migrate deploy
fi

exec node server.js
