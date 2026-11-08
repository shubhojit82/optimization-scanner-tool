#!/usr/bin/env bash
# Deploy one commit to one environment on the VM. Called by GitHub Actions:
#   scp deploy/deploy.sh VM:/tmp/geo-deploy.sh && ssh VM "bash /tmp/geo-deploy.sh <staging|prod> <git-sha>"
# Copied to /tmp first so that checking out a new commit cannot change the script while it runs.
# Safe to re-run. On a failed health check it restarts the previous version.
set -euo pipefail

ENVNAME="${1:?usage: deploy.sh <staging|prod> <git-sha>}"
REF="${2:?usage: deploy.sh <staging|prod> <git-sha>}"
case "$ENVNAME" in staging|prod) ;; *) echo "env must be staging or prod" >&2; exit 2;; esac

ROOT="/opt/geo/$ENVNAME"
cd "$ROOT/app"
git fetch --tags --prune origin
git checkout --force --detach "$REF"

export GEO_ENV="$ENVNAME"
export GEO_TAG="$(git rev-parse --short=12 HEAD)"
export GEO_ENV_FILE="$ROOT/.env"
export GEO_DATA_PATH="$ROOT/data"
PREV="$(cat "$ROOT/current-tag" 2>/dev/null || true)"
dc() { docker compose -p "geo-$ENVNAME" -f deploy/compose.app.yaml "$@" </dev/null; }

[ -f "$GEO_ENV_FILE" ] || { echo "missing $GEO_ENV_FILE (run bootstrap.sh)" >&2; exit 1; }

# Take a safety copy of the data before changing production.
if [ "$ENVNAME" = prod ] && [ -f "$GEO_DATA_PATH/geo.sqlite" ]; then
  bash deploy/backup.sh prod || echo "WARNING: pre-deploy backup failed" >&2
fi

echo "==> building and starting $ENVNAME at $GEO_TAG (previous: ${PREV:-none})"
dc up -d --build

cid="$(dc ps -q app)"
for _ in $(seq 1 30); do
  status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid" 2>/dev/null || echo gone)"
  [ "$status" = healthy ] && break
  [ "$status" = unhealthy ] && break
  sleep 5
done

if [ "$status" != healthy ]; then
  echo "!! $ENVNAME did not become healthy (status: $status)" >&2
  dc logs --tail 60 app >&2 || true
  if [ -n "$PREV" ] && docker image inspect "geo-workbench:$ENVNAME-$PREV" >/dev/null 2>&1; then
    echo "==> rolling back to $PREV" >&2
    GEO_TAG="$PREV" dc up -d --no-build
  fi
  exit 1
fi

echo "$GEO_TAG" > "$ROOT/current-tag"
# Keep the images of the last two deploys (for rollback), drop the rest.
docker image prune -f >/dev/null
docker images "geo-workbench" --format '{{.Repository}}:{{.Tag}}' | grep ":$ENVNAME-" | tail -n +3 | xargs -r docker rmi >/dev/null 2>&1 || true
echo "==> $ENVNAME is healthy at $GEO_TAG"
