#!/bin/bash
# Backup de la base centros_acopio. Lo corre cron (ver crontab). Guarda los últimos 14 dumps.
set -euo pipefail
cd "$(dirname "$0")/../apps/web"
DB=$(grep -E '^DATABASE_URL=' .env | cut -d= -f2-)
DIR="${BACKUP_DIR:-$PWD/../../backups}"
mkdir -p "$DIR"
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump "$DB" | gzip > "$DIR/centros_acopio_$DATE.sql.gz"
# Retención local: conservar los 14 más recientes
ls -1t "$DIR"/centros_acopio_*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm -f
echo "$(date '+%F %T') backup local OK -> centros_acopio_$DATE.sql.gz"

# Copia off-site a Cloudflare R2 (no fatal: el dump local ya quedó guardado)
RCLONE="${RCLONE:-rclone}"
RCLONE_CONF="${RCLONE_CONF:-$PWD/rclone.conf}"
if command -v "$RCLONE" >/dev/null && [ -f "$RCLONE_CONF" ]; then
  if "$RCLONE" --config "$RCLONE_CONF" copy "$DIR/centros_acopio_$DATE.sql.gz" r2:acopiove-backups/ 2>/dev/null; then
    "$RCLONE" --config "$RCLONE_CONF" delete r2:acopiove-backups/ --min-age 30d 2>/dev/null || true  # retención remota 30 días
    echo "$(date '+%F %T') off-site R2 OK"
  else
    echo "$(date '+%F %T') WARN: fallo subida a R2 (dump local OK)" >&2
  fi
fi
