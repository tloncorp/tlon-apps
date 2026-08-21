#!/bin/bash
#
# dev-workspaces.sh — reset the agentic-workspace demo rig to a clean start.
#
# One command (`pnpm dev:workspaces`) brings the whole demo stack to the same
# known-good state: both dev ships running with fresh %groups state and the
# kit library seeded, the openclaw gateway restarted with cleared agent state,
# and the simulator app reinstalled and sitting at the sign-up screen.
#
# Prerequisites (one-time, not this script's job):
#   - Piers extracted under apps/tlon-web/rube/dist (run `pnpm e2e` or
#     ./start-playwright-dev.sh once, or the rube extraction).
#   - The openclaw dev container created (packages/openclaw: `pnpm dev`).
#   - The iOS dev build installed at least once (`pnpm dev:ios`), so an app
#     bundle exists to cache; Metro is started here if it is not running.
#
# The ships' state is wiped with kiln-nuke/revive — the desk (and any
# committed patches) is untouched. Re-extracting piers would LOSE desk
# patches; this script never does that.
#
# Env overrides: TEN_PORT, ZOD_PORT, SIM_UDID, METRO_URL, BUN.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUBE="$ROOT/apps/tlon-web/rube"
DIST="$RUBE/dist"
URBIT="$DIST/urbit_extracted/urbit"

TEN_PORT="${TEN_PORT:-38473}"
ZOD_PORT="${ZOD_PORT:-35453}"
TEN_CODE="lapseg-nolmel-riswen-hopryc"
ZOD_CODE="lidlut-tabwed-pillex-ridrup"

BUNDLE_ID="io.tlon.groups"
CONTAINER="dev-openclaw-1"
STATE_VOLUME="dev_openclaw-state"
# The iPhone 17 Pro this rig uses; override for another machine.
SIM_UDID="${SIM_UDID:-D9AE8178-0DCC-497B-9471-54CA91AE5DD9}"
METRO_URL="${METRO_URL:-http://localhost:8081}"
APP_CACHE="$HOME/.cache/tlon-dev-workspaces/Landscape.app"

BUN="${BUN:-$(command -v bun || echo "$HOME/.bun/bin/bun")}"

# click's newt codec shells out to python3; the asdf shim in rube/ resolves to
# nothing and the failure is a cryptic "corrupted newt passed to cue".
export PATH="/usr/bin:$PATH"

log() { printf '\n==> %s\n' "$*"; }
die() {
  printf '\nerror: %s\n' "$*" >&2
  exit 1
}

wait_for() { # seconds "description" command...
  local secs="$1" what="$2"
  shift 2
  local waited=0
  until "$@" >/dev/null 2>&1; do
    sleep 2
    waited=$((waited + 2))
    if [ "$waited" -ge "$secs" ]; then
      die "timed out waiting for $what"
    fi
  done
}

# ---------------------------------------------------------------------------
# Sanity
# ---------------------------------------------------------------------------
[ -x "$URBIT" ] || die "urbit binary missing at $URBIT — extract the rube piers first"
[ -d "$DIST/ten/ten" ] || die "ten pier missing at $DIST/ten/ten"
[ -d "$DIST/zod/zod" ] || die "zod pier missing at $DIST/zod/zod"
[ -x "$RUBE/click" ] || die "click missing at $RUBE/click"
[ -x "$BUN" ] || die "bun not found (set BUN=/path/to/bun)"
command -v docker >/dev/null || die "docker not found"
command -v xcrun >/dev/null || die "xcrun not found"

# ---------------------------------------------------------------------------
# Ship helpers
# ---------------------------------------------------------------------------
ship_http_up() { curl -s -o /dev/null -m 3 "http://localhost:$1/"; }

ensure_ship() { # name relative-pier port
  local name="$1" pier="$2" port="$3"
  if ship_http_up "$port"; then
    log "$name is up on :$port"
    return
  fi
  if pgrep -f "urbit $pier" >/dev/null 2>&1 || pgrep -f "urbit_extracted/urbit $pier" >/dev/null 2>&1; then
    log "$name process exists; waiting for HTTP on :$port"
  else
    log "booting $name (daemon, :$port) — event-log replay can take a minute"
    (cd "$DIST" && ./urbit_extracted/urbit "$pier" -d --http-port "$port" >/dev/null 2>&1)
  fi
  wait_for 300 "$name HTTP on :$port" ship_http_up "$port"
  log "$name is up on :$port"
}

click_poke() { # pier-path-relative-to-rube hoon-source description
  # The pier path must stay RELATIVE to the rube dir: click talks to
  # <pier>/.urb/conn.sock, and an absolute path under this worktree exceeds
  # the AF_UNIX socket path limit ("Socket error: AF_UNIX path too long").
  local pier="$1" hoon="$2" what="$3" tmp out
  tmp="$(mktemp /tmp/dev-workspaces-XXXXXX.hoon)"
  printf '%s' "$hoon" >"$tmp"
  out="$(cd "$RUBE" && ./click -b "$URBIT" -k -i "$tmp" "$pier" 2>&1 | tail -1)"
  rm -f "$tmp"
  case "$out" in
  *27503*) ;; # %ok
  *) die "$what failed: $out" ;;
  esac
}

poke_hood() { # ship-sigil pier action noun description
  local ship="$1" pier="$2" mark="$3" noun="$4" what="$5"
  click_poke "$pier" \
    "=/  m  (strand ,vase)  ;<  ~  bind:m  (poke [$ship %hood] $mark !>($noun))  (pure:m !>(%ok))" \
    "$what"
}

# ---------------------------------------------------------------------------
# 1. Gateway down while we operate on the ships
# ---------------------------------------------------------------------------
log "stopping the gateway"
docker stop "$CONTAINER" >/dev/null 2>&1 || true

# ---------------------------------------------------------------------------
# 2. Ships up, state from nil
# ---------------------------------------------------------------------------
ensure_ship '~ten' ten/ten "$TEN_PORT"
ensure_ship '~zod' zod/zod "$ZOD_PORT"

log "wiping %groups state (nuke + revive; the desk itself is untouched)"
poke_hood '~ten' dist/ten/ten '%kiln-nuke' '[%groups %.y]' 'nuke on ~ten'
poke_hood '~zod' dist/zod/zod '%kiln-nuke' '[%groups %.y]' 'nuke on ~zod'
poke_hood '~ten' dist/ten/ten '%kiln-revive' '%groups' 'revive on ~ten'
poke_hood '~zod' dist/zod/zod '%kiln-revive' '%groups' 'revive on ~zod'

# A commit or heavy event has been seen to take a ship's process down; make
# sure both survived before moving on.
ship_http_up "$TEN_PORT" || die '~ten went down after the wipe — restart it and re-run'
ship_http_up "$ZOD_PORT" || die '~zod went down after the wipe — restart it and re-run'

log "seeding the kit library on both ships"
for kit in "$ROOT"/packages/tlon-kits/kits/*/; do
  kit_name="$(basename "$kit")"
  (cd "$ROOT/packages/tlon-skill" &&
    "$BUN" scripts/main.ts --url "http://localhost:$TEN_PORT" --ship '~ten' --code "$TEN_CODE" \
      kits add "../tlon-kits/kits/$kit_name" >/dev/null)
  (cd "$ROOT/packages/tlon-skill" &&
    "$BUN" scripts/main.ts --url "http://localhost:$ZOD_PORT" --ship '~zod' --code "$ZOD_CODE" \
      kits add "../tlon-kits/kits/$kit_name" >/dev/null)
  printf '    seeded %s on both ships\n' "$kit_name"
done

# ---------------------------------------------------------------------------
# 3. Gateway: clear agent state, start, wait for activation
# ---------------------------------------------------------------------------
log "clearing gateway agent state (sessions, cron, delivery queue, workspace)"
docker run --rm -v "$STATE_VOLUME":/state alpine sh -c '
  rm -rf /state/agents/dev/sessions/* /state/delivery-queue/* \
    /state/cron/jobs.json /state/cron/jobs.json.bak /state/cron/jobs-state.json \
    /state/cron/runs /state/tasks/* 2>/dev/null
  find /state/workspace -mindepth 1 -maxdepth 1 ! -name ".openclaw" -exec rm -rf {} + 2>/dev/null
  true' >/dev/null

log "starting the gateway"
# The trailing Z matters: docker parses a bare timestamp as LOCAL time, so a
# UTC value without it points hours into the future and matches nothing.
GATEWAY_SINCE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
docker start "$CONTAINER" >/dev/null 2>&1 ||
  die "could not start $CONTAINER — create it once via packages/openclaw (pnpm dev)"

gateway_activated() {
  docker logs "$CONTAINER" --since "$GATEWAY_SINCE" 2>&1 | grep -q 'gateway-status] activated'
}
log "waiting for gateway activation (plugin copy + npm install on first boot takes a while)"
wait_for 420 'gateway activation' gateway_activated
log "gateway activated"

# ---------------------------------------------------------------------------
# 4. Metro
# ---------------------------------------------------------------------------
metro_up() { curl -s -o /dev/null -m 2 "$METRO_URL/status"; }
if metro_up; then
  log "Metro is up at $METRO_URL"
else
  log "starting Metro (expo) in the background"
  (cd "$ROOT/apps/tlon-mobile" &&
    nohup npx expo start --port "${METRO_URL##*:}" \
      >"$HOME/.cache/tlon-dev-workspaces/metro.log" 2>&1 &)
  wait_for 120 "Metro at $METRO_URL" metro_up
fi

# ---------------------------------------------------------------------------
# 5. Simulator: boot, reinstall the app (clean local db), launch
# ---------------------------------------------------------------------------
booted_udid() { xcrun simctl list devices booted | grep -oE '[0-9A-F-]{36}' | head -1; }

DEVICE="$(booted_udid || true)"
if [ -z "$DEVICE" ]; then
  log "booting simulator $SIM_UDID"
  xcrun simctl boot "$SIM_UDID" >/dev/null 2>&1 || true
  open -a Simulator >/dev/null 2>&1 || true
  wait_for 120 'simulator boot' xcrun simctl list devices booted
  DEVICE="$(booted_udid)"
fi
log "simulator booted: $DEVICE"

# Refresh the app-bundle cache from the installed copy when there is one, so
# uninstall/reinstall (which is what clears the local database) always has a
# bundle to put back.
mkdir -p "$(dirname "$APP_CACHE")"
INSTALLED_APP="$(xcrun simctl get_app_container "$DEVICE" "$BUNDLE_ID" app 2>/dev/null || true)"
if [ -n "$INSTALLED_APP" ] && [ -d "$INSTALLED_APP" ]; then
  rm -rf "$APP_CACHE"
  cp -R "$INSTALLED_APP" "$APP_CACHE"
fi
[ -d "$APP_CACHE" ] || die "no app bundle cached and none installed — run pnpm dev:ios once first"

log "reinstalling the app (clears its local database)"
xcrun simctl terminate "$DEVICE" "$BUNDLE_ID" >/dev/null 2>&1 || true
xcrun simctl uninstall "$DEVICE" "$BUNDLE_ID" >/dev/null 2>&1 || true
xcrun simctl install "$DEVICE" "$APP_CACHE"
xcrun simctl launch "$DEVICE" "$BUNDLE_ID" >/dev/null

# The fresh install lands on the expo dev-client launcher; deep-link it to
# Metro so it loads the bundle without needing a tap (sim tap injection is
# unreliable on this rig).
sleep 6
ENCODED_METRO="$(printf '%s' "$METRO_URL" | sed 's|:|%3A|g; s|/|%2F|g')"
xcrun simctl openurl "$DEVICE" "$BUNDLE_ID://expo-development-client/?url=$ENCODED_METRO" >/dev/null 2>&1 || true

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
log "demo rig is ready"
cat <<EOF

  ships    ~ten http://localhost:$TEN_PORT (code $TEN_CODE)
           ~zod http://localhost:$ZOD_PORT (code $ZOD_CODE)
  gateway  $CONTAINER (owner ~ten), agent state cleared
  kits     $(ls "$ROOT/packages/tlon-kits/kits" | tr '\n' ' ')
  sim      $DEVICE — app reinstalled, loading from $METRO_URL

  Walkthrough: log in as ~ten with the code above; onboarding provisions the
  workspace, seats the agent, and lands you in the conversation. First bundle
  build can take a minute — the sim shows the splash logo while it loads.

  Note: FORCE_SPLASH_SEQUENCE in apps/tlon-mobile/.env replays onboarding on
  every JS reload while it is set to true.
EOF
