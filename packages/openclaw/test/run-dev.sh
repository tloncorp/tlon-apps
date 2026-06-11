#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Load .env file - use eval to handle ~ in values
if [ -f .env ]; then
  set -a
  eval "$(grep -v '^#' .env | grep -v '^$' | sed 's/~/\\~/g')"
  set +a
fi

if [ -n "${TEST_GATEWAY_URL:-}" ]; then
  GATEWAY_URL="$TEST_GATEWAY_URL"
else
  GATEWAY_PORT="${OPENCLAW_GATEWAY_PORT:-18789}"
  GATEWAY_URL="http://localhost:${GATEWAY_PORT}"
fi
MAX_WAIT=120

echo "Waiting for gateway at $GATEWAY_URL..."

for i in $(seq 1 $MAX_WAIT); do
  # Check if gateway is responding (control UI serves HTML)
  if curl -s "$GATEWAY_URL/" | grep -q "openclaw" 2>/dev/null; then
    echo "Gateway ready!"
    break
  fi
  if [ $i -eq $MAX_WAIT ]; then
    echo "Timeout waiting for gateway after ${MAX_WAIT}s"
    echo "Is the dev container running? Try: pnpm dev"
    exit 1
  fi
  sleep 1
done

# Debug: show loaded env vars
echo "Env vars loaded:"
echo "  TLON_URL=$TLON_URL"
echo "  TLON_SHIP=$TLON_SHIP"
echo "  TEST_USER_SHIP=$TEST_USER_SHIP"

# Run integration test files sequentially to avoid overlapping DM prompts.
# If a specific file is passed as an argument, run only that file.
if [ $# -gt 0 ] && [[ "$1" == *.test.ts || "$1" == test/* ]]; then
  echo "Running $1..."
  pnpm vitest run "$@" || exit $?
else
  for test_file in test/cases/*.test.ts; do
    echo "Running $test_file..."
    pnpm vitest run "$test_file" "$@" || exit $?
  done
fi
