#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# The repo root runs `pnpm run -r test run`; ignore that extra vitest-style arg.
if [ "${1:-}" = "run" ]; then
  shift
fi

PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover . -p 'test_*.py' "$@"
