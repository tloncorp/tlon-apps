#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# The repo root runs `pnpm run -r test run`; ignore that extra vitest-style arg.
if [ "${1:-}" = "run" ]; then
  shift
fi

# hermes-agent v0.22.6 supports only Python 3.14, so the adapter's tests run
# there too. uv fetches the interpreter if it isn't installed; the suite needs
# only the standard library, so --no-project skips any dependency resolution.
PYTHONDONTWRITEBYTECODE=1 exec uv run --no-project --python 3.14 \
  python -m unittest discover . -p 'test_*.py' "$@"
