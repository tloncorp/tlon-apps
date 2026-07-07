#!/bin/bash
# dev/trigger-nudge.sh — prime the bot's %settings so the next nudge-runner
# tick sends a fresh stage-1 nudge to the configured owner ship.
#
# Reads TLON_SHIP/TLON_CODE from the repo's .env. Overrides the
# host.docker.internal URL with the host-side localhost mapping so the CLI
# can talk to the bot from outside the container.
#
# Usage:
#   dev/trigger-nudge.sh [--days N] [--stage 1|2|3] [--reset]
#
# Examples:
#   dev/trigger-nudge.sh                  # prime for stage-1 nudge (10 days idle)
#   dev/trigger-nudge.sh --days 20        # 20 days idle, still stage 1 unless --stage given
#   dev/trigger-nudge.sh --reset          # clear all priming settings
#
# After priming, wait for the next runner tick (≤60s by default) and watch
# bot logs for: [tlon] nudge: sent stage 1 to <ownerShip>

set -euo pipefail

DAYS=10
STAGE=""
RESET=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --days) DAYS="$2"; shift 2 ;;
    --stage) STAGE="$2"; shift 2 ;;
    --reset) RESET=true; shift ;;
    -h|--help)
      sed -n '2,18p' "$0" | sed 's/^# \?//'
      exit 0 ;;
    *) echo "Unknown flag: $1" >&2; exit 1 ;;
  esac
done

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TLON_BIN="$REPO_DIR/node_modules/.bin/tlon"

if [[ ! -x "$TLON_BIN" ]]; then
  echo "tlon CLI not found at $TLON_BIN" >&2
  echo "Run 'pnpm install' in $REPO_DIR first." >&2
  exit 1
fi

# Load .env if present (TLON_SHIP, TLON_CODE, TLON_URL, etc.)
if [[ -f "$REPO_DIR/.env" ]]; then
  set -a; source "$REPO_DIR/.env"; set +a
fi

# .env sets TLON_URL=http://host.docker.internal:8083 for the container. From
# the host shell we need localhost. Override both URBIT_URL and TLON_URL so
# whichever the resolver prefers gets the right value.
HOST_URL="${URBIT_URL:-${TLON_URL:-http://localhost:8083}}"
HOST_URL="${HOST_URL//host.docker.internal/localhost}"
export URBIT_URL="$HOST_URL"
export TLON_URL="$HOST_URL"

# Sanity check: bot reachable?
if ! "$TLON_BIN" settings get >/dev/null 2>&1; then
  echo "Could not reach bot ship at $URBIT_URL with ship=${TLON_SHIP:-<unset>}." >&2
  echo "Is the dev container running and the URL/ship/code correct?" >&2
  exit 1
fi

if $RESET; then
  echo "==> Clearing nudge priming settings on $TLON_SHIP..."
  for key in lastOwnerMessageAt lastNudgeStage nudgeActiveHoursStart nudgeActiveHoursEnd nudgeActiveHoursTimezone; do
    "$TLON_BIN" settings delete "$key" >/dev/null 2>&1 || true
    echo "    deleted $key"
  done
  echo "Done."
  exit 0
fi

# Compute N days ago in unix ms.
NOW_MS=$(($(date +%s) * 1000))
IDLE_MS=$((NOW_MS - DAYS * 86400 * 1000))

echo "==> Priming nudge settings on $TLON_SHIP via $URBIT_URL"
echo "    lastOwnerMessageAt = $IDLE_MS  (~$DAYS days ago)"
"$TLON_BIN" settings set lastOwnerMessageAt "$IDLE_MS"

if [[ -n "$STAGE" ]]; then
  # Force the bot to act as if the *previous* stage was already sent, so the
  # next tick produces the requested stage. e.g. --stage 2 sets the shadow
  # to 1; the runner then advances to 2.
  case "$STAGE" in
    1) PREV=0 ;;
    2) PREV=1 ;;
    3) PREV=2 ;;
    *) echo "--stage must be 1, 2, or 3" >&2; exit 1 ;;
  esac
  if [[ "$PREV" == "0" ]]; then
    "$TLON_BIN" settings delete lastNudgeStage >/dev/null 2>&1 || true
    echo "    lastNudgeStage = (deleted, runner targets stage 1)"
  else
    "$TLON_BIN" settings set lastNudgeStage "$PREV"
    echo "    lastNudgeStage = $PREV (runner targets stage $STAGE)"
  fi
else
  "$TLON_BIN" settings delete lastNudgeStage >/dev/null 2>&1 || true
  echo "    lastNudgeStage = (deleted, runner targets stage 1)"
fi

# Override active hours to 24h UTC so the test isn't gated by NY office hours.
"$TLON_BIN" settings set nudgeActiveHoursStart '"00:00"'
"$TLON_BIN" settings set nudgeActiveHoursEnd   '"23:59"'
"$TLON_BIN" settings set nudgeActiveHoursTimezone '"UTC"'
echo "    nudgeActiveHours = 00:00–23:59 UTC"

echo ""
echo "Next runner tick (≤60s by default) should fire a nudge."
echo "Watch bot logs for: [tlon] nudge: sent stage ${STAGE:-1} to <ownerShip>"
echo "When done testing: $0 --reset"
