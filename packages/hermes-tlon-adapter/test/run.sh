#!/usr/bin/env bash
# Run Hermes Tlon integration tests with ephemeral fakezod ships.

set -euo pipefail

cd "$(dirname "$0")/.."

# Fakezod credentials are the standard deterministic codes for ephemeral ships.
ZOD_PORT="${ZOD_PORT:-8080}"
TEN_PORT="${TEN_PORT:-8081}"
MUG_PORT="${MUG_PORT:-8082}"
FAKE_MODEL_PORT="${FAKE_MODEL_PORT:-4000}"

ZOD_URL="http://localhost:$ZOD_PORT"
ZOD_CODE="lidlut-tabwed-pillex-ridrup"
TEN_URL="http://localhost:$TEN_PORT"
TEN_CODE="lapseg-nolmel-riswen-hopryc"
MUG_URL="http://localhost:$MUG_PORT"
MUG_CODE="ravsut-bolryd-hapsum-pastul"

for port in $ZOD_PORT $TEN_PORT $MUG_PORT $FAKE_MODEL_PORT; do
  if lsof -Pi ":$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "Error: Port $port is already in use"
    if [ "$port" = "$FAKE_MODEL_PORT" ]; then
      echo "  Hint: override with FAKE_MODEL_PORT=4100 pnpm test:integration"
    fi
    exit 1
  fi
done

export ZOD_PORT TEN_PORT MUG_PORT FAKE_MODEL_PORT

COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-hermes-tlon-test}"
export COMPOSE_PROJECT_NAME
COMPOSE_FILES="-f dev/docker-compose.test.yml"

cleanup() {
  echo ""
  echo "==> Cleaning up containers..."
  docker compose $COMPOSE_FILES down -v 2>/dev/null || true
}

trap cleanup EXIT
trap 'echo ""; echo "==> Interrupted."; exit 130' INT
trap 'echo ""; echo "==> Terminated."; exit 143' TERM

echo "==> Stopping any existing containers..."
docker compose $COMPOSE_FILES down -v 2>/dev/null || true

echo "==> Starting ships container..."
docker compose $COMPOSE_FILES up -d ships

echo "==> Starting fake-model container..."
docker compose $COMPOSE_FILES up -d fake-model

echo "==> Waiting for fake-model (port $FAKE_MODEL_PORT)..."
for i in $(seq 1 30); do
  if curl -fsS "http://localhost:$FAKE_MODEL_PORT/health" >/dev/null 2>&1; then
    echo "fake-model ready"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "Timeout waiting for fake-model after 30s"
    docker compose $COMPOSE_FILES logs fake-model
    exit 1
  fi
  sleep 1
done

echo "==> Building hermes-tlon image..."
docker compose $COMPOSE_FILES build hermes-tlon

check_urbit_ready() {
  local url=$1
  local code=$2
  curl -sf -c - -X POST "$url/~/login" -d "password=$code" 2>/dev/null | grep -q "urbauth"
}

echo "==> Waiting for ~zod (port $ZOD_PORT)..."
for i in $(seq 1 60); do
  if check_urbit_ready "$ZOD_URL" "$ZOD_CODE"; then
    echo "~zod ready"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "Timeout waiting for ~zod"
    docker compose $COMPOSE_FILES logs ships
    exit 1
  fi
  sleep 3
done

echo "==> Waiting for ~ten (port $TEN_PORT)..."
for i in $(seq 1 60); do
  if check_urbit_ready "$TEN_URL" "$TEN_CODE"; then
    echo "~ten ready"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "Timeout waiting for ~ten"
    docker compose $COMPOSE_FILES logs ships
    exit 1
  fi
  sleep 3
done

echo "==> Waiting for ~mug (port $MUG_PORT)..."
for i in $(seq 1 60); do
  if check_urbit_ready "$MUG_URL" "$MUG_CODE"; then
    echo "~mug ready"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "Timeout waiting for ~mug"
    docker compose $COMPOSE_FILES logs ships
    exit 1
  fi
  sleep 3
done

echo "==> Starting Hermes Tlon gateway..."
docker compose $COMPOSE_FILES up -d hermes-tlon

echo ""
echo "==> Waiting for Hermes Tlon adapter connection..."
CONNECT_TIMEOUT_SECONDS=240
for i in $(seq 1 "$CONNECT_TIMEOUT_SECONDS"); do
  if docker compose $COMPOSE_FILES logs hermes-tlon 2>/dev/null | grep -q "\[tlon\] connected to"; then
    echo "Hermes Tlon adapter connected"
    break
  fi
  if [ "$i" -eq "$CONNECT_TIMEOUT_SECONDS" ]; then
    echo "Timeout waiting for Hermes Tlon adapter after ${CONNECT_TIMEOUT_SECONDS}s"
    docker compose $COMPOSE_FILES logs --tail=200 hermes-tlon
    exit 1
  fi
  sleep 1
done

echo ""
echo "==> Running integration tests..."
echo ""

export TLON_URL="$ZOD_URL"
export TLON_SHIP="~zod"
export TLON_CODE="$ZOD_CODE"
export TEST_USER_URL="$TEN_URL"
export TEST_USER_SHIP="~ten"
export TEST_USER_CODE="$TEN_CODE"
export TEST_THIRD_PARTY_URL="$MUG_URL"
export TEST_THIRD_PARTY_SHIP="~mug"
export TEST_THIRD_PARTY_CODE="$MUG_CODE"
export TEST_MODE="tlon"
export TEST_COMPOSE_FILE="dev/docker-compose.test.yml"
export FAKE_MODEL_BASE_URL="http://localhost:$FAKE_MODEL_PORT"

if [ "${1:-}" = "--" ]; then
  shift
fi

TEST_EXIT=0
SUITE_START=$(date +%s)
FILE_TIMINGS=()

run_one() {
  local test_file=$1
  local start end elapsed
  start=$(date +%s)
  echo "Running $test_file..."
  pnpm exec vitest run --config vitest.integration.config.ts "$test_file" || TEST_EXIT=$?
  end=$(date +%s)
  elapsed=$((end - start))
  FILE_TIMINGS+=("$(printf '%4ds  %s\n' "$elapsed" "$test_file")")
  echo "==> $test_file finished in ${elapsed}s"
}

if [ "$#" -gt 0 ]; then
  for test_file in "$@"; do
    run_one "$test_file"
    if [ "$TEST_EXIT" -ge 128 ]; then
      echo "==> Test runner killed by signal (exit $TEST_EXIT), stopping suite."
      break
    fi
  done
else
  for test_file in test/cases/*.test.ts; do
    run_one "$test_file"
    if [ "$TEST_EXIT" -ge 128 ]; then
      echo "==> Test runner killed by signal (exit $TEST_EXIT), stopping suite."
      break
    fi
  done
fi

SUITE_END=$(date +%s)
SUITE_TOTAL=$((SUITE_END - SUITE_START))

echo ""
echo "==> Suite timing"
if [ "${#FILE_TIMINGS[@]}" -gt 0 ]; then
  for line in "${FILE_TIMINGS[@]}"; do
    echo "    $line"
  done
fi
printf "    ----\n    %4ds  total (test execution wall time)\n" "$SUITE_TOTAL"
echo ""

if [ "$TEST_EXIT" -ne 0 ] || [ "${DUMP_LOGS:-0}" = "1" ]; then
  echo ""
  echo "==> Hermes Tlon container logs (last 200 lines):"
  docker compose $COMPOSE_FILES logs --tail=200 hermes-tlon 2>/dev/null || true

  echo ""
  echo "==> fake-model container logs (last 100 lines):"
  docker compose $COMPOSE_FILES logs --tail=100 fake-model 2>/dev/null || true
fi

exit "$TEST_EXIT"
