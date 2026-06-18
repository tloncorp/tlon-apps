#!/bin/bash
# tlon-apps onboarding-sandbox orchestrator (Phase 1 CLI).
#
# Thin caller of the tlonbot control plane (tests/dev/onboarding.sh) via the
# sibling checkout. This (public) side owns ONLY: locating the tlonbot checkout,
# the sandbox prompt-copy lifecycle, and the `pnpm onboarding*` command surface.
# It knows NO Urbit/stack internals — all of that lives in tlonbot.
#
# Seam: expects a `tlonbot` checkout (private repo) at $TLONBOT_DIR (default: a
# sibling of this repo), matching the openclaw/dev convention.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
TLONBOT_DIR="${TLONBOT_DIR:-$REPO_ROOT/../tlonbot}"
CONTROL="$TLONBOT_DIR/tests/dev/onboarding.sh"
SANDBOX_DIR="$HERE/.sandbox-prompts"           # editable prompt copies (→ workspace)
SANDBOX_INTRO="$HERE/.sandbox-intro.md"         # editable welcome-DM copy (→ send-intro)
SRC_INTRO="$TLONBOT_DIR/tests/dev/onboarding-intro.md"

[ -d "$TLONBOT_DIR" ] || { echo "ERROR: tlonbot checkout not found at $TLONBOT_DIR — set TLONBOT_DIR." >&2; exit 1; }
[ -x "$CONTROL" ]     || { echo "ERROR: control plane not found/executable: $CONTROL" >&2; exit 1; }

# Editable sandbox copies of the private tlonbot prompts + intro. These hold
# private content in a public repo, so the paths MUST be gitignored — the
# initializer refuses otherwise.
ensure_sandbox() {
  for p in "$SANDBOX_DIR" "$SANDBOX_INTRO"; do
    if ! git -C "$REPO_ROOT" check-ignore -q "$p"; then
      echo "ERROR: $p is not gitignored — refusing to copy private content into a tracked path." >&2
      exit 1
    fi
  done
  if [ ! -d "$SANDBOX_DIR" ] || [ -z "$(ls -A "$SANDBOX_DIR" 2>/dev/null)" ]; then
    echo "Initializing sandbox prompt copies from $TLONBOT_DIR/prompts ..."
    mkdir -p "$SANDBOX_DIR"
    cp "$TLONBOT_DIR"/prompts/*.md "$SANDBOX_DIR"/
  fi
  if [ ! -f "$SANDBOX_INTRO" ] && [ -f "$SRC_INTRO" ]; then
    echo "Initializing sandbox intro copy from $SRC_INTRO ..."
    cp "$SRC_INTRO" "$SANDBOX_INTRO"
  fi
}

case "${1:-}" in
  start|"")
    ensure_sandbox
    TLONBOT_INTRO_FILE="$SANDBOX_INTRO" "$CONTROL" start "$SANDBOX_DIR"
    ;;
  reset)
    ensure_sandbox
    TLONBOT_INTRO_FILE="$SANDBOX_INTRO" "$CONTROL" reset "$SANDBOX_DIR"
    ;;
  init)      ensure_sandbox ;;
  logs)      "$CONTROL" logs ;;
  status)    shift; "$CONTROL" status "$@" ;;
  set-model) shift; "$CONTROL" set-model "$@" ;;
  set-key)   "$CONTROL" set-key ;;   # key arrives on stdin (kept out of argv)
  down)      "$CONTROL" down ;;
  *) echo "usage: pnpm onboarding | onboarding:reset | onboarding:logs | onboarding:down" >&2; exit 1 ;;
esac
