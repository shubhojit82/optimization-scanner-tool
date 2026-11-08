#!/usr/bin/env bash
# Runs ON the VM; called by GitHub Actions in two steps:
#   scp deploy/compose.yaml VM:/tmp/geo-compose.yaml ; scp deploy/deploy.sh VM:/tmp/geo-deploy.sh
#   docker save geo-workbench:<tag> | gzip | ssh VM "bash /tmp/geo-deploy.sh <tag>"
# The gzipped image arrives on stdin, so the 1 GB VM never builds anything.
# On an unhealthy start it brings the previous version back.
set -euo pipefail

TAG="${1:?usage: deploy.sh <image-tag>   (image tarball on stdin)}"
ROOT=/opt/geo
[ -f "$ROOT/.env" ] || { echo "missing $ROOT/.env (run bootstrap.sh first)" >&2; exit 1; }

echo "==> loading image geo-workbench:$TAG"
gunzip | docker load

PREV="$(cat "$ROOT/current-tag" 2>/dev/null || true)"
install -m 644 /tmp/geo-compose.yaml "$ROOT/compose.yaml"
dc() { GEO_TAG="$1" docker compose --env-file "$ROOT/host.env" -p geo -f "$ROOT/compose.yaml" "${@:2}" </dev/null; }

# Safety copy of the data before changing production.
if [ -f "$ROOT/data/geo.sqlite" ] && [ -x "$ROOT/backup.sh" ]; then "$ROOT/backup.sh" || echo "WARNING: pre-deploy backup failed" >&2; fi

echo "==> starting $TAG (previous: ${PREV:-none})"
dc "$TAG" up -d --remove-orphans

cid="$(docker ps -q --filter label=com.docker.compose.project=geo --filter label=com.docker.compose.service=app | head -n1)"
status=none
for _ in $(seq 1 36); do
  status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid" 2>/dev/null || echo gone)"
  case "$status" in healthy|unhealthy) break;; esac
  sleep 5
done

if [ "$status" != healthy ]; then
  echo "!! $TAG did not become healthy (status: $status)" >&2
  docker logs --tail 60 "$cid" >&2 || true
  if [ -n "$PREV" ] && docker image inspect "geo-workbench:$PREV" >/dev/null 2>&1; then
    echo "==> rolling back to $PREV" >&2
    dc "$PREV" up -d
  fi
  exit 1
fi

echo "$TAG" > "$ROOT/current-tag"
# Keep the images of the last two deploys for rollback; remove the rest.
docker images geo-workbench --format '{{.Tag}}' | grep -v -x -e "$TAG" -e "${PREV:-none}" | xargs -r -I{} docker rmi geo-workbench:{} >/dev/null 2>&1 || true
docker image prune -f >/dev/null
echo "==> healthy at $TAG"
