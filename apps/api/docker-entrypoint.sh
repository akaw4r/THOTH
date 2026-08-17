#!/bin/sh
# Runs from /app (monorepo layout preserved).
set -e

# MIGRATE_ON_BOOT=true (default): applies migrations + seed on boot — suitable
# for local dev (docker compose, 1 replica). In production with multiple replicas, set
# MIGRATE_ON_BOOT=false and run migrations in a separate Job BEFORE the
# rollout: with multiple replicas, migrating on boot makes the pods contend for
# Prisma's advisory lock and applies the new schema while old code is still live.
if [ "${MIGRATE_ON_BOOT:-true}" = "true" ]; then
  echo "[thoth-api] applying migrations..."
  node_modules/.bin/prisma migrate deploy --schema apps/api/prisma/schema.prisma

  echo "[thoth-api] idempotent seed (default design + templates)..."
  node apps/api/dist/cli/seed.js
else
  echo "[thoth-api] MIGRATE_ON_BOOT=false — migrations/seed delegated (PreRollout hook)."
fi

echo "[thoth-api] starting API..."
exec node apps/api/dist/main.js
