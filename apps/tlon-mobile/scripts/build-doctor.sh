#!/bin/bash
# Checks that this machine is set up for the fastest possible native builds.
# Run from anywhere: pnpm --filter tlon-mobile doctor  (or ./scripts/build-doctor.sh)
#
# Fast builds rely on two caches:
#   1. EAS remote build cache (buildCacheProvider: "eas" in app.config.ts) —
#      skips the entire native build when a build with a matching fingerprint
#      exists. Requires being logged in to EAS; when logged out the cache is
#      silently skipped.
#   2. ccache for cold builds — caches C/C++/ObjC compilation across rebuilds
#      and worktrees. Requires ccache installed and apple.ccacheEnabled in
#      ios/Podfile.properties.json.

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(cd "$MOBILE_DIR/../.." && pwd)"

PASS=0
WARN=0
FAIL=0

ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; PASS=$((PASS + 1)); }
warn() { printf '  \033[33m⚠\033[0m %s\n' "$1"; [ -n "${2:-}" ] && printf '      fix: %s\n' "$2"; WARN=$((WARN + 1)); }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1"; [ -n "${2:-}" ] && printf '      fix: %s\n' "$2"; FAIL=$((FAIL + 1)); }

echo "tlon-mobile build doctor"
echo

# --- Toolchain ---------------------------------------------------------------
echo "Toolchain:"

WANT_NODE="$(cat "$REPO_ROOT/.nvmrc" 2>/dev/null | tr -d 'v[:space:]')"
HAVE_NODE="$(node -v 2>/dev/null | tr -d 'v')"
if [ -z "$HAVE_NODE" ]; then
  fail "node not found" "install Node $WANT_NODE (nvm install $WANT_NODE)"
elif [ "$HAVE_NODE" != "$WANT_NODE" ]; then
  warn "node $HAVE_NODE (repo pins $WANT_NODE in .nvmrc)" "nvm use"
else
  ok "node $HAVE_NODE matches .nvmrc"
fi

if command -v pnpm > /dev/null 2>&1; then
  ok "pnpm $(pnpm --version)"
else
  fail "pnpm not found" "corepack enable, or npm install -g pnpm"
fi

if command -v watchman > /dev/null 2>&1; then
  ok "watchman installed"
else
  warn "watchman not installed (Metro falls back to slower file watching)" "brew install watchman"
fi

# --- EAS remote build cache ---------------------------------------------------
echo
echo "EAS build cache (skips native builds entirely on fingerprint match):"

if [ "${TLON_EAS_CACHE_DISABLED:-}" = "1" ]; then
  warn "TLON_EAS_CACHE_DISABLED=1 is set — remote build cache is off for this shell"
fi

EAS_USER="$(cd "$MOBILE_DIR" && npx --no-install eas-cli whoami 2>/dev/null | head -1)"
if [ -n "$EAS_USER" ]; then
  ok "eas-cli logged in ($EAS_USER)"
else
  fail "eas-cli is not logged in — the build cache is SILENTLY skipped and every build compiles from source" \
    "cd apps/tlon-mobile && npx eas-cli login"
fi

# --- ccache (cold builds) ------------------------------------------------------
echo
echo "ccache (speeds up cold/native rebuilds):"

if command -v ccache > /dev/null 2>&1; then
  ok "ccache $(ccache --version | head -1 | awk '{print $3}') installed"

  MAX_SIZE="$(ccache -s 2>/dev/null | grep -i 'cache size' | head -1 | sed 's/.*\/ *//;s/(.*//' | tr -d ' ')"
  ok "ccache stats: $(ccache -s 2>/dev/null | grep -E 'Hits:' | head -1 | sed 's/^ *//')${MAX_SIZE:+ (max $MAX_SIZE)}"

  if grep -q '"apple.ccacheEnabled": *"true"' "$MOBILE_DIR/ios/Podfile.properties.json" 2>/dev/null; then
    ok "apple.ccacheEnabled=true in ios/Podfile.properties.json"
  else
    warn "apple.ccacheEnabled not enabled in ios/Podfile.properties.json" \
      'add "apple.ccacheEnabled": "true" and re-run pod install'
  fi

else
  warn "ccache not installed — cold builds recompile everything every time" "brew install ccache"
fi

# --- iOS ----------------------------------------------------------------------
echo
echo "iOS:"

if xcode-select -p > /dev/null 2>&1; then
  ok "Xcode at $(xcode-select -p) ($(xcodebuild -version 2>/dev/null | head -1))"
else
  fail "Xcode command line tools not configured" "xcode-select --install, or set with sudo xcode-select -s /Applications/Xcode.app"
fi

if command -v pod > /dev/null 2>&1; then
  ok "CocoaPods $(pod --version 2>/dev/null)"
else
  warn "CocoaPods (pod) not on PATH" "gem install cocoapods (or brew install cocoapods)"
fi

case "${LANG:-}${LC_ALL:-}" in
  *UTF-8* | *utf8*) ok "UTF-8 locale set (CocoaPods needs this)" ;;
  *) warn "no UTF-8 locale — pod install can crash with ASCII-8BIT unicode errors" \
    "export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8" ;;
esac

# --- Android --------------------------------------------------------------------
echo
echo "Android:"

ANDROID_SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
if [ -d "$ANDROID_SDK" ]; then
  if [ -n "${ANDROID_HOME:-}" ]; then
    ok "ANDROID_HOME=$ANDROID_HOME"
  else
    warn "ANDROID_HOME unset (SDK exists at $ANDROID_SDK)" "export ANDROID_HOME=\"$ANDROID_SDK\" in your shell profile"
  fi
else
  warn "Android SDK not found — Android builds unavailable" "install via Android Studio"
fi

if command -v java > /dev/null 2>&1 || [ -x "/usr/libexec/java_home" ] && /usr/libexec/java_home > /dev/null 2>&1; then
  ok "JDK available"
else
  warn "no JDK found" "brew install --cask zulu@17"
fi

# --- Disk ----------------------------------------------------------------------
echo
echo "Disk:"

AVAIL_GB="$(df -g "$HOME" 2>/dev/null | awk 'NR==2 {print $4}')"
if [ -n "$AVAIL_GB" ] && [ "$AVAIL_GB" -lt 30 ]; then
  warn "only ${AVAIL_GB}GB free — DerivedData + simulators + ccache need room" "clear old DerivedData: rm -rf ~/Library/Developer/Xcode/DerivedData"
else
  ok "${AVAIL_GB:-?}GB free"
fi

# --- Summary --------------------------------------------------------------------
echo
echo "$PASS ok, $WARN warnings, $FAIL failures"
[ "$FAIL" -eq 0 ]
