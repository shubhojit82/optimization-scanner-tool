#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -f .env ]; then
  echo 'Create the cloud .env configuration before deployment.' >&2
  exit 1
fi
git pull --ff-only origin main
docker compose up -d --build
docker compose ps
