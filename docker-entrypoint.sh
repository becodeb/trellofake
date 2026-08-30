#!/bin/sh
set -e

DB_PATH="${DATABASE_URL#file:}"
STORAGE_DIR="${STORAGE_DIR:-/app/storage}"
BACKUP_DIR="$(dirname "$DB_PATH")/backups"
KEEP_BACKUPS=5

mkdir -p "$(dirname "$DB_PATH")" "$STORAGE_DIR"

# Copia de la base antes de migrarla.
#
# Este es el único momento del ciclo de vida del contenedor en que la base está
# quieta: el entrypoint corre antes del `exec` que arranca Next, así que nadie
# la tiene abierta y una copia tal cual es consistente. No hace falta `sqlite3`
# ni `VACUUM INTO`, que no están en la imagen.
#
# Protege contra una migración que salga mal, que es el riesgo real de cada
# deploy. No reemplaza a una copia fuera del servidor: vive en el mismo volumen
# que la base, así que si se pierde el volumen se pierden las dos.
backup_database() {
  stamp=$(date +%Y%m%d-%H%M%S)
  target="$BACKUP_DIR/prod-$stamp.db"

  mkdir -p "$BACKUP_DIR"

  if ! cp "$DB_PATH" "$target"; then
    echo "!! No se pudo copiar la base antes de migrar. Se aborta el arranque:" >&2
    echo "!! migrar sin copia es peor que no desplegar." >&2
    exit 1
  fi

  # Si quedó un journal a medio cerrar de un apagón anterior, viaja con la copia.
  for suffix in -wal -shm; do
    if [ -f "$DB_PATH$suffix" ]; then
      cp "$DB_PATH$suffix" "$target$suffix"
    fi
  done

  echo "=> Copia previa: $target ($(wc -c < "$target" | tr -d ' ') bytes)"

  # Se conservan las últimas KEEP_BACKUPS y se borran las demás.
  ls -1t "$BACKUP_DIR"/prod-*.db 2>/dev/null | awk -v keep="$KEEP_BACKUPS" 'NR > keep' |
    while read -r old; do
      echo "=> Se descarta la copia vieja: $old"
      rm -f "$old" "$old-wal" "$old-shm"
    done
}

if [ ! -f "$DB_PATH" ]; then
  echo "=> Fresh database at $DB_PATH: applying migrations and seeding sample data"
  npx prisma migrate deploy
  npm run db:seed
else
  echo "=> Existing database at $DB_PATH: backing up, then applying pending migrations"
  backup_database
  # Las bases creadas con `db push` no tienen historial: se marca el baseline
  # como aplicado y `migrate deploy` aplica lo que falte (0001_single_team).
  # Si ya estaba en el historial, el error se tolera y deploy decide.
  npx prisma migrate resolve --applied 0000_baseline || true
  npx prisma migrate deploy
fi

exec "$@"
