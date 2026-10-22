#!/usr/bin/env bash
# Nightly: take a consistent copy of the SQLite database, compress it, upload it to Object Storage.
# Credentials come from /etc/geo-backup.env (root-only), written once during deployment.
set -euo pipefail

# shellcheck disable=SC1091
source /etc/geo-backup.env   # COS_ENDPOINT COS_BUCKET COS_ACCESS_KEY COS_SECRET_KEY

APP_DIR=/opt/geo
DATA_DIR=/srv/geo-data/app
stamp=$(date -u +%Y%m%dT%H%M%SZ)
name="geo-$stamp.sqlite"

cd "$APP_DIR"
# VACUUM INTO produces a transactionally consistent copy while the app keeps running.
docker compose -f compose.ibm.yaml exec -T app node -e \
  "const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync('/app/data/geo.sqlite');d.exec(\"VACUUM INTO '/app/data/$name'\");d.close();"

gzip -9 "$DATA_DIR/$name"

export RCLONE_S3_PROVIDER=IBMCOS
export RCLONE_S3_ENDPOINT="$COS_ENDPOINT"
export RCLONE_S3_ACCESS_KEY_ID="$COS_ACCESS_KEY"
export RCLONE_S3_SECRET_ACCESS_KEY="$COS_SECRET_KEY"

rclone copyto "$DATA_DIR/$name.gz" ":s3:$COS_BUCKET/$name.gz"
# Fail loudly if the object is not there with the same size.
local_size=$(stat -c %s "$DATA_DIR/$name.gz")
remote_size=$(rclone size --json ":s3:$COS_BUCKET/$name.gz" | sed -n 's/.*"bytes":\([0-9]*\).*/\1/p')
if [ "$local_size" != "$remote_size" ]; then
  echo "backup size mismatch: local=$local_size remote=$remote_size" >&2
  exit 1
fi

rm -f "$DATA_DIR/$name.gz"
logger -t geo-backup "uploaded $name.gz ($remote_size bytes)"
echo "ok $name.gz $remote_size"
