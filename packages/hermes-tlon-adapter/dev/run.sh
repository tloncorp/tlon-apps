#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f ../.env ]; then
  echo "ERROR: packages/hermes-tlon-adapter/.env is missing."
  echo "Copy .env.example to .env and fill in TLON_* plus Hermes model credentials."
  exit 1
fi

docker compose --env-file ../.env up --build
