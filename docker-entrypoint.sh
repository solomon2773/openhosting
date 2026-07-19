#!/bin/sh
set -e

if [ "${SKIP_MIGRATIONS:-false}" != "true" ]; then
  echo "Applying database migrations…"
  node prisma-cli/node_modules/prisma/build/index.js migrate deploy
fi

exec node server.js
