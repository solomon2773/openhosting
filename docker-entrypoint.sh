#!/bin/sh
set -e

if [ "${SKIP_MIGRATIONS:-false}" != "true" ]; then
  echo "Applying database migrations…"
  node node_modules/prisma/build/index.js migrate deploy --schema=prisma/schema.prisma
fi

exec node server.js
