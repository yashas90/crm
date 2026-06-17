#!/usr/bin/env bash
# Migrate PropNinja Postgres between Railway projects (e.g. US → Mumbai).
# Requires: Railway CLI (logged in), pg_dump, pg_restore on PATH.
#
# Usage:
#   railway link   # source US project
#   ./scripts/migrate-db-railway.sh dump
#
#   railway link   # target Mumbai project
#   ./scripts/migrate-db-railway.sh restore [dump-file]

set -euo pipefail

ACTION="${1:-}"
DUMP_FILE="${2:-propninja-railway-$(date +%Y%m%d).dump}"
SERVICE="${RAILWAY_SERVICE:-Postgres}"

die() {
  echo "ERROR: $*" >&2
  exit 1
}

require_pg() {
  command -v pg_dump >/dev/null 2>&1 || die "pg_dump not found. Install PostgreSQL client tools."
  command -v pg_restore >/dev/null 2>&1 || die "pg_restore not found. Install PostgreSQL client tools."
}

get_public_db_url() {
  local url
  url="$(railway variables --service "$SERVICE" --kv 2>/dev/null | grep '^DATABASE_PUBLIC_URL=' | cut -d= -f2- || true)"
  if [[ -z "$url" ]]; then
    url="$(railway variables --service "$SERVICE" --kv 2>/dev/null | grep '^DATABASE_URL=' | cut -d= -f2- || true)"
  fi
  [[ -n "$url" ]] || die "DATABASE_PUBLIC_URL not found. Link Postgres service: railway service link Postgres"
  echo "$url"
}

cmd_dump() {
  require_pg
  local url
  url="$(get_public_db_url)"
  echo "Dumping from linked Railway project (service: $SERVICE) → $DUMP_FILE"
  pg_dump "$url" -Fc -f "$DUMP_FILE"
  echo "Done. File: $DUMP_FILE ($(du -h "$DUMP_FILE" | awk '{print $1}'))"
  echo "Verify on source:"
  echo "  psql \"\$DATABASE_PUBLIC_URL\" -c \"SELECT COUNT(*) FROM leads;\""
}

cmd_restore() {
  require_pg
  [[ -f "$DUMP_FILE" ]] || die "Dump file not found: $DUMP_FILE"
  local url
  url="$(get_public_db_url)"
  echo "Restoring $DUMP_FILE → linked Railway project (service: $SERVICE)"
  echo "WARNING: This replaces data in the target database."
  read -r -p "Continue? [y/N] " confirm
  [[ "$confirm" == "y" || "$confirm" == "Y" ]] || die "Aborted"
  pg_restore -d "$url" -v --clean --if-exists --no-owner --no-acl "$DUMP_FILE"
  echo "Done. Verify on target:"
  echo "  railway connect Postgres"
  echo "  SELECT COUNT(*) FROM leads;"
}

cmd_counts() {
  local url
  url="$(get_public_db_url)"
  echo "Row counts on linked project:"
  psql "$url" -c "SELECT 'leads' AS tbl, COUNT(*) FROM leads UNION ALL SELECT 'users', COUNT(*) FROM users UNION ALL SELECT 'call_records', COUNT(*) FROM call_records;"
}

case "$ACTION" in
  dump) cmd_dump ;;
  restore) cmd_restore ;;
  counts) cmd_counts ;;
  *)
    echo "Usage: $0 dump | restore [file.dump] | counts"
    exit 1
    ;;
esac
