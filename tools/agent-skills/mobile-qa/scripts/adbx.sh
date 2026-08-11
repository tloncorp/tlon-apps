#!/bin/bash
# adbx.sh — thin wrapper for driving an Android device during a QA pass.
#
# Locates adb (it is usually not on PATH), and wraps the gestures that come up
# constantly plus the two that have sharp edges: `drag` (a slow, controlled
# motionevent drag for React Native rows that ignore `input swipe`) and `bounds`
# (read an element's real coordinates when a tap keeps missing).
#
# Screenshots go to $QA_SHOT_DIR (default: a temp dir outside the repo, so
# real-account captures never land in the worktree / get committed).
#
# Usage:
#   A=.claude/skills/mobile-qa/scripts/adbx.sh
#   "$A" shot home            # capture -> $QA_SHOT_DIR/home.png (path printed)
#   "$A" tap 540 750          # device-native coords (same as the screenshot)
#   "$A" swipe 540 1900 540 600 400
#   "$A" longpress 540 750    # long-press (opens context sheets)
#   "$A" drag 540 452 540 760 # slow drag for RN reorder / swipe-to-reveal rows
#   "$A" text hello           # NOTE: spaces break `input text` (see below)
#   "$A" bounds "Save"        # print bounds of elements matching text/desc
#   "$A" launch io.tlon.groups.preview
set -uo pipefail

find_adb() {
  if command -v adb >/dev/null 2>&1; then command -v adb; return; fi
  for p in \
    "$HOME/Library/Android/sdk/platform-tools/adb" \
    "/opt/homebrew/share/android-commandlinetools/platform-tools/adb" \
    "/usr/local/share/android-commandlinetools/platform-tools/adb" \
    "/usr/local/bin/adb"; do
    [ -x "$p" ] && { echo "$p"; return; }
  done
  echo "adb not found on PATH or in common SDK locations" >&2
  exit 127
}

ADB="$(find_adb)"
# Default to a temp dir OUTSIDE the repo — screenshots can contain real-account
# content (private chats, member lists), and Phase 4 commits from the worktree,
# so a repo-relative default risks accidentally committing them.
SS="${QA_SHOT_DIR:-${TMPDIR:-/tmp}/tlon-qa-screens}"
mkdir -p "$SS"

cmd="${1:-}"; shift || true
case "$cmd" in
  tap)       "$ADB" shell input tap "$1" "$2" ;;
  swipe)     "$ADB" shell input swipe "$1" "$2" "$3" "$4" "${5:-300}" ;;
  # long-press = zero-distance swipe held for N ms (default 800)
  longpress) "$ADB" shell input swipe "$1" "$2" "$1" "$2" "${3:-800}" ;;
  # drag x1 y1 x2 y2 — controlled motionevent drag with per-step holds.
  # Use this for RN reorderable lists and swipe-action rows: a plain
  # `input swipe` is treated as a fling and snaps back without revealing/moving.
  drag)
    x1="$1"; y1="$2"; x2="$3"; y2="$4"
    seq="input motionevent DOWN $x1 $y1;"
    for i in 1 2 3 4 5 6 7 8; do
      mx=$(( x1 + (x2 - x1) * i / 8 ))
      my=$(( y1 + (y2 - y1) * i / 8 ))
      seq="$seq input motionevent MOVE $mx $my; sleep 0.06;"
    done
    seq="$seq sleep 0.4; input motionevent UP $x2 $y2"
    "$ADB" shell "$seq" ;;
  # `input text` sends a space as a word break and TRUNCATES the rest. For text
  # with spaces, call once per word or substitute %s. This wrapper passes through
  # a single token; keep tokens space-free.
  text)      "$ADB" shell input text "$1" ;;
  key)       "$ADB" shell input keyevent "$1" ;;
  back)      "$ADB" shell input keyevent 4 ;;
  home)      "$ADB" shell input keyevent 3 ;;
  wake)      "$ADB" shell input keyevent 224 ;;
  stayon)    "$ADB" shell svc power stayon true ;;   # don't sleep while charging
  shot)
    # Only advertise the path if capture actually succeeded — a disconnected /
    # unauthorized / ambiguous (multiple) device makes screencap fail and would
    # otherwise leave an empty PNG that looks like valid evidence.
    out="$SS/${1:-shot}.png"
    if "$ADB" exec-out screencap -p > "$out" && [ -s "$out" ]; then
      echo "$out"
    else
      echo "screencap failed (no authorized device? disconnected? multiple devices?)" >&2
      rm -f "$out"
      exit 1
    fi ;;
  ui)        "$ADB" shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; "$ADB" shell cat /sdcard/ui.xml ;;
  # bounds "<needle>" — fresh ui dump, print bounds= of nodes whose line matches
  # the needle (text or content-desc). Center = midpoint of [x1,y1][x2,y2].
  bounds)
    "$ADB" shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
    "$ADB" shell cat /sdcard/ui.xml | tr '>' '\n' | grep -i -- "$1" \
      | grep -oE '(text|content-desc)="[^"]*"|bounds="[^"]+"' | paste - - - 2>/dev/null \
      || "$ADB" shell cat /sdcard/ui.xml | tr '>' '\n' | grep -i -- "$1" ;;
  focus)     "$ADB" shell dumpsys window | grep -iE 'mCurrentFocus' | head -1 ;;
  launch)    "$ADB" shell monkey -p "$1" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 ;;
  stop)      "$ADB" shell am force-stop "$1" ;;
  adb)       "$ADB" "$@" ;;
  *)
    echo "usage: adbx.sh {tap|swipe|longpress|drag|text|key|back|home|wake|stayon|shot|ui|bounds|focus|launch|stop|adb} ..." >&2
    exit 2 ;;
esac
