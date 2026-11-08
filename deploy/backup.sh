#!/usr/bin/env bash
# Consistent copy of the SQLite database while the app keeps running.
#   bash deploy/backup.sh <staging|prod>
# Writes /opt/geo/backups/<env>/geo-<timestamp>.sqlite.gz and keeps 14 days.
# Cron (installed by bootstrap.sh) runs this nightly for prod.
set -euo pipefail

ENVNAME="${1:?usage: backup.sh <staging|prod>}"
ROOT="/opt/geo/$ENVNAME"
OUT="/opt/geo/backups/$ENVNAME"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
name="geo-$stamp.sqlite"
mkdir -p "$OUT"

cid="$(docker ps -q --filter "label=com.docker.compose.project=geo-$ENVNAME" --filter "label=com.docker.compose.service=app" | head -n1)"
[ -n "$cid" ] || { echo "app container for $ENVNAME is not running" >&2; exit 1; }

# VACUUM INTO writes a transactionally consistent copy; it lands in the data dir, then moves out.
docker exec "$cid" node -e \
  "const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync('/app/data/geo.sqlite');d.exec(\"VACUUM INTO '/app/data/$name'\");d.close();"
# The file is owned by the container user, so compress and copy it out through docker, then remove it.
docker exec "$cid" gzip -9 "/app/data/$name"
docker cp "$cid:/app/data/$name.gz" "$OUT/$name.gz"
docker exec "$cid" rm -f "/app/data/$name.gz"
find "$OUT" -name 'geo-*.sqlite.gz' -mtime +14 -delete
echo "ok $OUT/$name.gz"
