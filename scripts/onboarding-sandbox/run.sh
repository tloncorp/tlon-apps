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
  # Sync the prompt SET with the source (tlonbot) on every run. A hidden .base/
  # records the source content at copy time, so we can tell the tester's edits
  # from unedited-but-stale copies:
  #   - new file              -> copy to sandbox + base
  #   - unedited & src changed -> refresh sandbox + base (fixes staleness AND the
  #                               false "modified" flag for files the user never touched)
  #   - edited (!= base)      -> preserve, never clobber
  #   - legacy (no base yet)  -> record current source as base, leave the copy (self-heals next change)
  #   - removed upstream      -> quarantine (never delete) + drop its base
  local src_dir="$TLONBOT_DIR/prompts"
  local base_dir="$SANDBOX_DIR/.base" orphan_dir="$SANDBOX_DIR/.orphaned"
  mkdir -p "$SANDBOX_DIR" "$base_dir"
  local f name sbx bse dest n2 added=0 refreshed=0 orphaned=0
  for f in "$src_dir"/*.md; do
    [ -f "$f" ] || continue
    name="$(basename "$f")"; sbx="$SANDBOX_DIR/$name"; bse="$base_dir/$name"
    if [ ! -f "$sbx" ]; then
      cp "$f" "$sbx"; cp "$f" "$bse"; added=$((added + 1))
    elif cmp -s "$sbx" "$f"; then
      cmp -s "$bse" "$f" || cp "$f" "$bse"                 # sandbox already matches source: rebaseline (e.g. the edit was merged upstream)
    elif [ ! -f "$bse" ]; then
      cp "$f" "$bse"                                       # legacy copy: start tracking
    elif cmp -s "$sbx" "$bse" && ! cmp -s "$f" "$bse"; then
      cp "$f" "$sbx"; cp "$f" "$bse"; refreshed=$((refreshed + 1))   # unedited + upstream changed
    fi
  done
  for f in "$SANDBOX_DIR"/*.md; do
    [ -f "$f" ] || continue
    name="$(basename "$f")"
    if [ ! -f "$src_dir/$name" ]; then
      mkdir -p "$orphan_dir"
      dest="$orphan_dir/$name"; n2=1
      while [ -e "$dest" ]; do dest="$orphan_dir/$name.$n2"; n2=$((n2 + 1)); done  # don't clobber an earlier quarantine
      mv "$f" "$dest"; rm -f "$base_dir/$name"; orphaned=$((orphaned + 1))
    fi
  done
  [ "$added" -gt 0 ]     && echo "sandbox prompts: added $added new file(s) from $src_dir"
  [ "$refreshed" -gt 0 ] && echo "sandbox prompts: refreshed $refreshed unedited file(s) from upstream"
  [ "$orphaned" -gt 0 ]  && echo "sandbox prompts: moved $orphaned removed-upstream file(s) to $orphan_dir (preserved, not deleted)"
  # intro: same base-tracking as the prompts (single file)
  local intro_base="$base_dir/.intro"
  if [ ! -f "$SANDBOX_INTRO" ] && [ -f "$SRC_INTRO" ]; then
    echo "Initializing sandbox intro copy from $SRC_INTRO ..."
    cp "$SRC_INTRO" "$SANDBOX_INTRO"; cp "$SRC_INTRO" "$intro_base"
  elif [ -f "$SANDBOX_INTRO" ] && [ -f "$SRC_INTRO" ]; then
    if cmp -s "$SANDBOX_INTRO" "$SRC_INTRO"; then
      cmp -s "$intro_base" "$SRC_INTRO" || cp "$SRC_INTRO" "$intro_base"   # sandbox matches source: rebaseline
    elif [ ! -f "$intro_base" ]; then
      cp "$SRC_INTRO" "$intro_base"
    elif cmp -s "$SANDBOX_INTRO" "$intro_base" && ! cmp -s "$SRC_INTRO" "$intro_base"; then
      cp "$SRC_INTRO" "$SANDBOX_INTRO"; cp "$SRC_INTRO" "$intro_base"
      echo "sandbox intro: refreshed from upstream (unedited)"
    fi
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
