#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

docker compose --env-file ../.env down "$@"
