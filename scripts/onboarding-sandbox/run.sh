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
SANDBOX_DIR="$HERE/.sandbox-prompts"

[ -d "$TLONBOT_DIR" ] || { echo "ERROR: tlonbot checkout not found at $TLONBOT_DIR — set TLONBOT_DIR." >&2; exit 1; }
[ -x "$CONTROL" ]     || { echo "ERROR: control plane not found/executable: $CONTROL" >&2; exit 1; }

# Editable sandbox copies of tlonbot/prompts. Private content in a public repo,
# so the path MUST be gitignored — the initializer refuses otherwise.
ensure_sandbox_prompts() {
  if ! git -C "$REPO_ROOT" check-ignore -q "$SANDBOX_DIR"; then
    echo "ERROR: $SANDBOX_DIR is not gitignored — refusing to copy private prompts" >&2
    echo "       into a tracked path. Add it to .gitignore first." >&2
    exit 1
  fi
  if [ ! -d "$SANDBOX_DIR" ] || [ -z "$(ls -A "$SANDBOX_DIR" 2>/dev/null)" ]; then
    echo "Initializing sandbox prompt copies from $TLONBOT_DIR/prompts ..."
    mkdir -p "$SANDBOX_DIR"
    cp "$TLONBOT_DIR"/prompts/*.md "$SANDBOX_DIR"/
  fi
}

case "${1:-}" in
  start|"")
    ensure_sandbox_prompts
    "$CONTROL" start "$SANDBOX_DIR"
    ;;
  reset)
    ensure_sandbox_prompts
    "$CONTROL" reset "$SANDBOX_DIR"
    ;;
  logs)   "$CONTROL" logs ;;
  status) "$CONTROL" status ;;
  down)   "$CONTROL" down ;;
  *) echo "usage: pnpm onboarding | onboarding:reset | onboarding:logs | onboarding:down" >&2; exit 1 ;;
esac
