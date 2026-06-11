#!/bin/bash
set -e

cd "$(dirname "$0")"

# Start container in background
docker compose --env-file ../.env up --build -d

# Wait for gateway to be ready and extract token
echo "Waiting for gateway..."
for i in {1..30}; do
  TOKEN=$(docker logs dev-openclaw-1 2>&1 | grep -o 'token=[^"]*' | head -1 | cut -d= -f2)
  if [ -n "$TOKEN" ]; then
    HOST_PORT=$(docker compose --env-file ../.env port openclaw 18789 2>/dev/null | tail -1 | awk -F: '{print $NF}')
    HOST_PORT="${HOST_PORT:-18789}"
    URL="http://localhost:${HOST_PORT}/?token=$TOKEN"
    echo "Opening: $URL"
    open "$URL" 2>/dev/null || xdg-open "$URL" 2>/dev/null || echo "Open manually: $URL"
    break
  fi
  sleep 1
done

# Attach to logs
docker compose --env-file ../.env logs -f
