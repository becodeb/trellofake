#!/bin/sh
set -e

DB_PATH="${DATABASE_URL#file:}"
STORAGE_DIR="${STORAGE_DIR:-/app/storage}"

mkdir -p "$(dirname "$DB_PATH")" "$STORAGE_DIR"

if [ ! -f "$DB_PATH" ]; then
  echo "=> Fresh database at $DB_PATH: applying migrations and seeding sample data"
  npx prisma migrate deploy
  npm run db:seed
else
  echo "=> Existing database at $DB_PATH: bootstrapping migration history, then applying pending migrations"
  # Las bases creadas con `db push` no tienen historial: se marca el baseline
  # como aplicado y `migrate deploy` aplica lo que falte (0001_single_team).
  # Si ya estaba en el historial, el error se tolera y deploy decide.
  npx prisma migrate resolve --applied 0000_baseline || true
  npx prisma migrate deploy
fi

exec "$@"