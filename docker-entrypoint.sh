#!/bin/sh
set -e

DB_PATH="${DATABASE_URL#file:}"
STORAGE_DIR="${STORAGE_DIR:-/app/storage}"

mkdir -p "$(dirname "$DB_PATH")" "$STORAGE_DIR"

if [ ! -f "$DB_PATH" ]; then
  echo "=> Fresh database at $DB_PATH, creating schema and seeding sample data"
  npx prisma db push --skip-generate
  npm run db:seed
else
  echo "=> Existing database at $DB_PATH, syncing schema"
  npx prisma db push --skip-generate
fi

exec "$@"