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
  # Sync the prompt SET with the source (tlonbot) on every run, preserving the
  # tester's edits: add source files missing from the sandbox, quarantine sandbox
  # files removed upstream (never delete — these gitignored copies are the only
  # copy of the tester's edits), and leave files present in both untouched.
  mkdir -p "$SANDBOX_DIR"
  local f base added=0 orphaned=0 orphan_dir="$SANDBOX_DIR/.orphaned"
  for f in "$TLONBOT_DIR"/prompts/*.md; do
    [ -f "$f" ] || continue
    base="$(basename "$f")"
    if [ ! -f "$SANDBOX_DIR/$base" ]; then cp "$f" "$SANDBOX_DIR/$base"; added=$((added + 1)); fi
  done
  for f in "$SANDBOX_DIR"/*.md; do
    [ -f "$f" ] || continue
    base="$(basename "$f")"
    if [ ! -f "$TLONBOT_DIR/prompts/$base" ]; then
      mkdir -p "$orphan_dir"; mv "$f" "$orphan_dir/$base"; orphaned=$((orphaned + 1))
    fi
  done
  [ "$added" -gt 0 ]    && echo "sandbox prompts: added $added new file(s) from $TLONBOT_DIR/prompts"
  [ "$orphaned" -gt 0 ] && echo "sandbox prompts: moved $orphaned removed-upstream file(s) to $orphan_dir (preserved, not deleted)"
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
