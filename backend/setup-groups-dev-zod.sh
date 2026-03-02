#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SHIP_NAME="${SHIP_NAME:-zod}"
URBIT_HOME="${URBIT_HOME:-$HOME}"
URBIT_BIN="${URBIT_BIN:-$URBIT_HOME/urbit}"
WORKTREE_NAME="${WORKTREE_NAME:-$(basename "$REPO_ROOT")}"
PIER_NAME="${PIER_NAME:-$WORKTREE_NAME}"
PIER_DIR="${PIER_DIR:-$URBIT_HOME/$PIER_NAME}"
GROUPS_DIR="${GROUPS_DIR:-$PIER_DIR/groups}"
LOG_FILE="${LOG_FILE:-$URBIT_HOME/.${SHIP_NAME}-setup.log}"
BOOT_TIMEOUT_SECONDS="${BOOT_TIMEOUT_SECONDS:-180}"
PROMPT_TIMEOUT_SECONDS="${PROMPT_TIMEOUT_SECONDS:-180}"
HTTP_PORT="${HTTP_PORT:-8080}"
HEALTH_HOST="${HEALTH_HOST:-127.0.0.1}"
SHIP_MANIFEST_PATH="${SHIP_MANIFEST_PATH:-$REPO_ROOT/apps/tlon-web/e2e/shipManifest.json}"
SHIP_CACHE_DIR="${SHIP_CACHE_DIR:-$URBIT_HOME/.cache/tlon-rube-ships}"
URBIT_PID=""

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

check_urbit_process_alive() {
  if [ -n "$URBIT_PID" ] && ! kill -0 "$URBIT_PID" 2>/dev/null; then
    echo "Urbit process exited unexpectedly while waiting for readiness." >&2
    if [ -f "$LOG_FILE" ]; then
      echo "Last 80 lines of $LOG_FILE:" >&2
      tail -n 80 "$LOG_FILE" >&2
    fi
    return 1
  fi
  return 0
}

get_snapshot_url() {
  local key="~${SHIP_NAME}"

  if [ ! -f "$SHIP_MANIFEST_PATH" ]; then
    return 1
  fi

  python3 - "$SHIP_MANIFEST_PATH" "$key" <<'PY'
import json
import sys

manifest_path = sys.argv[1]
key = sys.argv[2]

try:
    with open(manifest_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    url = data.get(key, {}).get("downloadUrl", "")
    if isinstance(url, str) and url:
        print(url)
except Exception:
    pass
PY
}

bootstrap_from_rube_snapshot() {
  local snapshot_url archive_name archive_path tmp_extract source_dir
  snapshot_url="$(get_snapshot_url || true)"

  if [ -z "$snapshot_url" ]; then
    echo "Rube snapshot URL not found for ~$SHIP_NAME in $SHIP_MANIFEST_PATH"
    return 1
  fi

  mkdir -p "$SHIP_CACHE_DIR"
  archive_name="$(basename "$snapshot_url")"
  archive_path="$SHIP_CACHE_DIR/$archive_name"

  if [ ! -f "$archive_path" ]; then
    echo "Downloading Rube snapshot: $snapshot_url"
    curl -fL --retry 3 --retry-delay 2 -o "$archive_path" "$snapshot_url"
  else
    echo "Using cached Rube snapshot: $archive_path"
  fi

  tmp_extract="$(mktemp -d)"

  tar -xzf "$archive_path" -C "$tmp_extract"
  source_dir="$tmp_extract/$SHIP_NAME"

  if [ ! -d "$source_dir" ]; then
    echo "Snapshot archive missing expected ship dir: $source_dir"
    rm -rf "$tmp_extract"
    return 1
  fi

  rm -rf "$PIER_DIR"
  mkdir -p "$(dirname "$PIER_DIR")"
  mv "$source_dir" "$PIER_DIR"
  rm -f "$PIER_DIR/.http.ports"
  rm -rf "$tmp_extract"

  echo "Bootstrapped pier from Rube snapshot into: $PIER_DIR"
  return 0
}

wait_for_ship_boot() {
  local start now
  local loopback_port
  start=$(date +%s)
  while true; do
    check_urbit_process_alive || return 1

    loopback_port="$(get_loopback_port 2>/dev/null || true)"

    if [ -S "$PIER_DIR/.urb/conn.sock" ] && [ -n "$loopback_port" ] && is_http_ready "$loopback_port"; then
      echo "Ship boot ready via loopback ${loopback_port}."
      return 0
    fi

    if [ -S "$PIER_DIR/.urb/conn.sock" ] && is_http_ready "$HTTP_PORT"; then
      echo "Ship boot ready via http-port ${HTTP_PORT}."
      return 0
    fi

    now=$(date +%s)
    if [ $((now - start)) -ge "$BOOT_TIMEOUT_SECONDS" ]; then
      echo "Timed out waiting for ship readiness at $PIER_DIR" >&2
      echo "Last checked loopback port: ${loopback_port:-<none>}" >&2
      echo "Last checked http-port: ${HTTP_PORT}" >&2
      return 1
    fi
    sleep 1
  done
}

get_loopback_port() {
  local http_ports_file="$PIER_DIR/.http.ports"

  if [ ! -f "$http_ports_file" ]; then
    return 1
  fi

  awk '
    $3 == "loopback" && $1 ~ /^[0-9]+$/ {
      print $1;
      found = 1;
      exit;
    }
    END {
      if (!found) {
        exit 1;
      }
    }
  ' "$http_ports_file"
}

get_loopback_port_from_log() {
  if [ ! -f "$LOG_FILE" ]; then
    return 1
  fi

  grep -Eo 'http: loopback live on http://localhost:[0-9]+' "$LOG_FILE" \
    | tail -n 1 \
    | sed -E 's#.*:([0-9]+)$#\1#'
}

resolve_loopback_port() {
  local port
  port="$(get_loopback_port 2>/dev/null || true)"
  if [ -n "$port" ]; then
    echo "$port"
    return 0
  fi

  port="$(get_loopback_port_from_log 2>/dev/null || true)"
  if [ -n "$port" ]; then
    echo "$port"
    return 0
  fi

  return 1
}

wait_for_loopback_port() {
  local start now port
  start=$(date +%s)
  while true; do
    check_urbit_process_alive || return 1
    port="$(resolve_loopback_port || true)"
    if [ -n "$port" ]; then
      echo "Loopback port detected: $port"
      return 0
    fi
    now=$(date +%s)
    if [ $((now - start)) -ge "$BOOT_TIMEOUT_SECONDS" ]; then
      echo "Timed out waiting for loopback port discovery." >&2
      return 1
    fi
    sleep 1
  done
}

run_hood_command() {
  local command="$1"
  local max_attempts="${2:-10}"
  local delay_seconds="${3:-2}"
  local attempt port payload status_code

  for ((attempt = 1; attempt <= max_attempts; attempt += 1)); do
    check_urbit_process_alive || return 1

    port="$(resolve_loopback_port || true)"
    if [ -z "$port" ]; then
      if [ "$attempt" -lt "$max_attempts" ]; then
        sleep "$delay_seconds"
        continue
      fi
      echo "Unable to resolve loopback port for hood command: $command" >&2
      return 1
    fi

    payload="$(printf '{"source":{"dojo":"+hood/%s"},"sink":{"app":"hood"}}' "$command")"
    status_code="$(
      curl -s -m 10 -o /dev/null -w '%{http_code}' \
        -H 'Content-Type: application/json' \
        -d "$payload" \
        "http://${HEALTH_HOST}:${port}" \
        2>/dev/null || true
    )"

    if [[ "$status_code" =~ ^[0-9]+$ ]] && [ "$status_code" -ge 200 ] && [ "$status_code" -lt 300 ]; then
      return 0
    fi

    echo "hood command attempt ${attempt}/${max_attempts} failed for '$command' (status: ${status_code:-none})"
    if [ "$attempt" -lt "$max_attempts" ]; then
      sleep "$delay_seconds"
    fi
  done

  echo "hood command failed after ${max_attempts} attempts: $command" >&2
  return 1
}

is_http_ready() {
  local port="$1"
  local code

  # Mirrors rube readiness checks: any non-5xx response means the ship is up.
  code="$(curl -s -m 5 -o /dev/null -w '%{http_code}' "http://${HEALTH_HOST}:${port}/~/scry/hood/kiln/pikes.json" 2>/dev/null || true)"

  [ "$code" != "000" ] && [ "$code" -lt 500 ]
}

wait_for_post_commit_readiness() {
  local start now loopback_port
  start=$(date +%s)

  while true; do
    check_urbit_process_alive || return 1

    loopback_port="$(get_loopback_port 2>/dev/null || true)"

    if [ -n "$loopback_port" ] && is_http_ready "$loopback_port"; then
      echo "Ship is ready (HTTP) on loopback ${loopback_port}."
      return 0
    fi

    if is_http_ready "$HTTP_PORT"; then
      echo "Ship is ready (HTTP) on http-port ${HTTP_PORT}."
      return 0
    fi

    now=$(date +%s)
    if [ $((now - start)) -ge "$PROMPT_TIMEOUT_SECONDS" ]; then
      echo "Timed out waiting for post-commit ship readiness." >&2
      echo "Last checked loopback port: ${loopback_port:-<none>}" >&2
      echo "Last checked http-port: ${HTTP_PORT}" >&2
      return 1
    fi

    sleep 1
  done
}

require_cmd curl
require_cmd rsync
require_cmd awk
require_cmd tar
require_cmd python3
require_cmd grep

if [ ! -x "$URBIT_BIN" ]; then
  echo "Urbit binary not found or not executable: $URBIT_BIN" >&2
  echo "Expected to run from ~ with ./urbit installed at $URBIT_BIN" >&2
  exit 1
fi

if is_http_ready "$HTTP_PORT" || (pgrep -f "urbit.*[ /]${PIER_NAME}([ /]|$)" >/dev/null 2>&1 && [ -S "$PIER_DIR/.urb/conn.sock" ]); then
  echo "Ship appears to already be running at $PIER_DIR; reusing it."
else
  if [ -d "$PIER_DIR" ]; then
    echo "Starting existing pier from $URBIT_HOME with: ./urbit -t --http-port $HTTP_PORT $PIER_NAME"
    rm -f "$PIER_DIR/.http.ports"
    (
      cd "$URBIT_HOME"
      ./urbit -t --http-port "$HTTP_PORT" "$PIER_NAME"
    ) >"$LOG_FILE" 2>&1 &
    URBIT_PID=$!
  else
    echo "Attempting Rube snapshot bootstrap for ~$SHIP_NAME ..."
    if ! bootstrap_from_rube_snapshot; then
      echo "Snapshot bootstrap failed. Aborting (no fake fallback)." >&2
      exit 1
    fi
    echo "Starting snapshot-backed pier from $URBIT_HOME with: ./urbit -t --http-port $HTTP_PORT $PIER_NAME"
    (
      cd "$URBIT_HOME"
      ./urbit -t --http-port "$HTTP_PORT" "$PIER_NAME"
    ) >"$LOG_FILE" 2>&1 &
    URBIT_PID=$!
  fi

  echo "Urbit started in background. Logging to $LOG_FILE"
fi

echo "Waiting for ship readiness..."
wait_for_ship_boot

echo "Waiting for loopback port for hood commands..."
wait_for_loopback_port

echo "Mounting %groups via hood command..."
run_hood_command "mount %groups"

echo "Syncing desk files into $GROUPS_DIR ..."
mkdir -p "$GROUPS_DIR"
rsync -avL "$REPO_ROOT/desk/" "$GROUPS_DIR/"

if [ -d "$REPO_ROOT/landscape-dev" ]; then
  echo "Syncing landscape-dev files into $GROUPS_DIR ..."
  rsync -avL "$REPO_ROOT/landscape-dev/" "$GROUPS_DIR/"
fi

echo "Committing %groups via hood command..."
run_hood_command "commit %groups"

echo "Waiting for ship readiness after commit (rube-style kiln readiness check) ..."
wait_for_post_commit_readiness

echo "Setup complete."
