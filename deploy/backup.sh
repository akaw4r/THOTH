#!/usr/bin/env bash
# THOTH backup: Postgres dump. Attachments/PDFs live in the database (encrypted),
# so the Postgres dump already covers all application data.
#
# Usage:  ./deploy/backup.sh [destination-directory]
# Restore with deploy/restore.sh.
set -euo pipefail

DEST="${1:-backups}"
TS="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEST"

DB_USER="${POSTGRES_USER:-thoth}"
DB_NAME="${POSTGRES_DB:-thoth}"
OUT="$DEST/thoth-db-$TS.sql.gz"

echo "[backup] dumping '$DB_NAME' → $OUT"
docker compose exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists \
  | gzip > "$OUT"

echo "[backup] done: $OUT ($(du -h "$OUT" | cut -f1))"
echo "[backup] REMEMBER: without the ENCRYPTION_KEY, encrypted fields (TOTP, attachments, PDFs) are unrecoverable."
