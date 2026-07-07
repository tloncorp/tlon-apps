#!/bin/bash
# Start fake ships + OpenClaw gateway for manual testing
#
# Usage:
#   pnpm test:manual              # start everything, attach to logs
#   pnpm test:manual --stop       # tear down
#
# Ships:
#   ~zod (bot)  — http://localhost:8080  code: lidlut-tabwed-pillex-ridrup
#   ~ten (user) — http://localhost:8081  code: lapseg-nolmel-riswen-hopryc
#   ~mug (3rd)  — http://localhost:8082  code: ravsut-bolryd-hapsum-pastul
#
# Gateway:
#   http://localhost:18789

set -euo pipefail

cd "$(dirname "$0")/.."

# Load .env
if [ -f .env ]; then
  set -a
  eval "$(grep -v '^#' .env | grep -v '^$' | sed 's/~/\\~/g')"
  set +a
fi

ZOD_PORT="${ZOD_PORT:-8080}"
TEN_PORT="${TEN_PORT:-8081}"
MUG_PORT="${MUG_PORT:-8082}"
GATEWAY_PORT="${OPENCLAW_GATEWAY_PORT:-18789}"

export ZOD_PORT TEN_PORT MUG_PORT

# Default tlonbot checkout location: sibling of the tlon-apps monorepo root.
TLONBOT_DIR="${TLONBOT_DIR:-$(pwd)/../../../tlonbot}"
export TLONBOT_DIR
COMPOSE_FILES="-f dev/docker-compose.test.yml"
if [ -f "dev/docker-compose.local.yml" ] && [ -d "$TLONBOT_DIR" ]; then
  COMPOSE_FILES="$COMPOSE_FILES -f dev/docker-compose.local.yml"
fi

# Handle --stop flag
if [ "${1:-}" = "--stop" ]; then
  echo "==> Stopping containers..."
  docker compose $COMPOSE_FILES down -v
  exit 0
fi

# Check for port conflicts
for port in $ZOD_PORT $TEN_PORT $MUG_PORT $GATEWAY_PORT; do
  if lsof -Pi ":$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "Error: Port $port is already in use"
    exit 1
  fi
done

# Stop previous run if any
docker compose $COMPOSE_FILES down -v 2>/dev/null || true

echo "==> Starting ships..."
docker compose $COMPOSE_FILES up -d ships

echo "==> Building openclaw image..."
docker compose $COMPOSE_FILES build openclaw

check_urbit_ready() {
  local url=$1 code=$2
  curl -sf -c - -X POST "$url/~/login" -d "password=$code" 2>/dev/null | grep -q "urbauth"
}

for ship in "zod:$ZOD_PORT:lidlut-tabwed-pillex-ridrup" "ten:$TEN_PORT:lapseg-nolmel-riswen-hopryc" "mug:$MUG_PORT:ravsut-bolryd-hapsum-pastul"; do
  IFS=: read -r name port code <<< "$ship"
  echo -n "==> Waiting for ~$name (port $port)..."
  for i in $(seq 1 60); do
    if check_urbit_ready "http://localhost:$port" "$code"; then
      echo " ready"
      break
    fi
    if [ $i -eq 60 ]; then
      echo " TIMEOUT"
      docker compose $COMPOSE_FILES logs ships | tail -20
      exit 1
    fi
    sleep 3
  done
done

echo "==> Starting OpenClaw gateway..."
docker compose $COMPOSE_FILES up -d openclaw

echo -n "==> Waiting for gateway (port $GATEWAY_PORT)..."
for i in $(seq 1 90); do
  if curl -s "http://localhost:$GATEWAY_PORT/" | grep -qi openclaw; then
    echo " ready"
    break
  fi
  if [ $i -eq 90 ]; then
    echo " TIMEOUT"
    docker compose $COMPOSE_FILES logs openclaw | tail -200
    exit 1
  fi
  sleep 2
done

print_info() {
  echo ""
  echo "============================================"
  echo "  Manual test environment running"
  echo "============================================"
  echo ""
  echo "  Ships:"
  echo "    ~zod (bot)   http://localhost:$ZOD_PORT   code: lidlut-tabwed-pillex-ridrup"
  echo "    ~ten (user)  http://localhost:$TEN_PORT   code: lapseg-nolmel-riswen-hopryc"
  echo "    ~mug (3rd)   http://localhost:$MUG_PORT   code: ravsut-bolryd-hapsum-pastul"
  echo ""
  echo "  Gateway:       http://localhost:$GATEWAY_PORT"
  echo ""
  echo "  Stop with:     pnpm test:manual --stop"
  echo "                 (or Ctrl+C)"
  echo "============================================"
  echo ""
}

echo -n "==> Waiting for SSE subscriptions..."
for i in $(seq 1 120); do
  if docker compose $COMPOSE_FILES logs openclaw 2>/dev/null | grep -q "\[tlon\] Connected! Firehose subscriptions active"; then
    echo " ready"
    break
  fi
  if [ $i -eq 120 ]; then
    echo " TIMEOUT (gateway running but SSE not connected)"
    break
  fi
  sleep 1
done

# Cleanup on Ctrl+C, timeout, or other failure
trap 'echo ""; echo "==> Stopping..."; docker compose $COMPOSE_FILES down -v 2>/dev/null || true' EXIT INT TERM

# Show recent startup logs then re-print info
docker compose $COMPOSE_FILES logs --tail=50 openclaw 2>/dev/null || true
print_info
echo "==> Tailing openclaw logs (Ctrl+C to stop)..."
echo ""
docker compose $COMPOSE_FILES logs -f --tail=0 openclaw
