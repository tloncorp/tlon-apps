#!/usr/bin/env bash
# Build-perf harness for the agentic-loop prototype.
#
# Always creates a fresh git worktree (off HEAD of the repo you invoke it from),
# copies gitignored secrets into it (.env files), runs the timed build steps,
# and removes the worktree on exit. This mirrors the loop an autonomous agent
# would run: brand-new working tree every iteration, isolated from the dev's
# main checkout.
#
# Usage:
#   ./scripts/build-perf-harness.sh cold [ios|android]
#   ./scripts/build-perf-harness.sh warm [ios|android]
#   ./scripts/build-perf-harness.sh diff [ios|android]   # diff latest cold vs warm
#
# Modes:
#   cold  Purge SHARED machine-level caches (Metro shared cache, ccache),
#         set EXPO_NO_CACHE=1 so Expo bypasses the remote EAS cache lookup,
#         then build. This is the "no caching anywhere" baseline.
#   warm  Keep all shared caches intact, let Expo consult the EAS cache.
#         Run AFTER cold to populate everything; the delta is what the
#         caches actually save us.
#   diff  Read the most recent cold + warm summary files for this platform
#         and print a side-by-side delta. Does NOT build.
#
# Worktree-per-run is by design: the per-project caches that live inside the
# repo (ios/Pods, ios/build, android/.gradle, .expo/cache, node_modules) are
# fresh by construction because the worktree itself is fresh. The deltas we
# care about come from MACHINE-level caches that survive worktree churn:
#   - Metro shared cache  ~/.cache/tlon-metro-shared
#   - pnpm content store  ~/.local/share/pnpm/store
#   - ccache              ~/Library/Caches/ccache  (if installed)
#   - Gradle              ~/.gradle/caches
#   - CocoaPods           ~/Library/Caches/CocoaPods
#   - EAS remote cache    (Expo buildCacheProvider: 'eas')
#
# Environment variables:
#   TLON_PERF_WORKTREE_DIR  Parent dir for worktrees (default: sibling of repo)
#   TLON_PERF_KEEP_WORKTREE Set to 1 to skip cleanup (for debugging a failure)
#   EXPO_NO_CACHE           Set to 1 to bypass EAS cache lookup (cold sets this)
#
# Remote EAS cache deletion:
#   `eas-cli` doesn't expose "delete cached binary by fingerprint". To force a
#   true cache miss: (a) set EXPO_NO_CACHE=1 (what cold mode does), or (b)
#   modify any fingerprint-included file (Podfile, package.json, native dirs).
#
# Output files:
#   /tmp/build-perf/<ts>-<mode>-<platform>.log
#   /tmp/build-perf/<ts>-<mode>-<platform>.summary  (tab-sep: step \t secs \t rc)
#   /tmp/build-perf/latest-<mode>-<platform>.{log,summary}  (symlinks)

set -uo pipefail

MODE="${1:-}"
PLATFORM="${2:-ios}"

if [[ -z "$MODE" || ! "$MODE" =~ ^(cold|warm|diff)$ ]]; then
  sed -n '/^# Usage:/,/^$/p' "$0" | sed 's/^# \{0,1\}//'
  exit 1
fi

if [[ ! "$PLATFORM" =~ ^(ios|android)$ ]]; then
  echo "Platform must be 'ios' or 'android' (got: $PLATFORM)" >&2
  exit 1
fi

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [[ -z "$ROOT" ]]; then
  echo "Not inside a git repository." >&2
  exit 1
fi

TS="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="/tmp/build-perf"
mkdir -p "$OUT_DIR"

LOG="$OUT_DIR/${TS}-${MODE}-${PLATFORM}.log"
SUMMARY="$OUT_DIR/${TS}-${MODE}-${PLATFORM}.summary"

ts() { date +%H:%M:%S; }
log() { printf '[%s] %s\n' "$(ts)" "$*" | tee -a "$LOG"; }
section() { printf '\n=== %s ===\n' "$*" | tee -a "$LOG"; }

# record <name> <cmd>...
record() {
  local name="$1"; shift
  log "BEGIN  $name"
  local start end secs rc
  start=$(date +%s)
  if "$@" >> "$LOG" 2>&1; then
    rc=0
  else
    rc=$?
  fi
  end=$(date +%s)
  secs=$((end - start))
  log "END    $name (${secs}s, rc=$rc)"
  printf '%s\t%d\t%d\n' "$name" "$secs" "$rc" >> "$SUMMARY"
  if [[ $rc -ne 0 ]]; then
    log "FAIL  $name returned $rc — see $LOG"
    return "$rc"
  fi
}

# ---------------------------------------------------------------------------
# diff mode (no worktree, no build)
# ---------------------------------------------------------------------------
if [[ "$MODE" == "diff" ]]; then
  cold_sum="$OUT_DIR/latest-cold-${PLATFORM}.summary"
  warm_sum="$OUT_DIR/latest-warm-${PLATFORM}.summary"
  if [[ ! -f "$cold_sum" || ! -f "$warm_sum" ]]; then
    echo "Need latest cold + warm runs for platform=$PLATFORM." >&2
    echo "  Looked for: $cold_sum" >&2
    echo "  and:        $warm_sum" >&2
    exit 1
  fi
  printf '%-20s %8s %8s %8s\n' "Step" "Cold(s)" "Warm(s)" "Delta(s)"
  printf '%-20s %8s %8s %8s\n' "--------------------" "--------" "--------" "--------"
  cold_total=0
  warm_total=0
  while IFS=$'\t' read -r name cold_secs _; do
    warm_secs=$(awk -F'\t' -v n="$name" '$1==n {print $2; exit}' "$warm_sum")
    [[ -z "$warm_secs" ]] && warm_secs=0
    delta=$((cold_secs - warm_secs))
    printf '%-20s %8d %8d %+8d\n' "$name" "$cold_secs" "$warm_secs" "$delta"
    cold_total=$((cold_total + cold_secs))
    warm_total=$((warm_total + warm_secs))
  done < "$cold_sum"
  printf '%-20s %8s %8s %8s\n' "--------------------" "--------" "--------" "--------"
  printf '%-20s %8d %8d %+8d\n' "TOTAL" "$cold_total" "$warm_total" "$((cold_total - warm_total))"
  exit 0
fi

# ---------------------------------------------------------------------------
# build modes (cold / warm) — always in a fresh worktree
# ---------------------------------------------------------------------------

WT_PARENT="${TLON_PERF_WORKTREE_DIR:-$(dirname "$ROOT")/.tlon-perf-worktrees}"
WT_DIR="$WT_PARENT/wt-${TS}-${MODE}-${PLATFORM}"

cleanup_worktree() {
  local rc=$?
  if [[ "${TLON_PERF_KEEP_WORKTREE:-0}" == "1" ]]; then
    log "TLON_PERF_KEEP_WORKTREE=1 — leaving worktree at $WT_DIR"
    exit $rc
  fi
  if [[ -n "${WT_DIR:-}" && -d "$WT_DIR" ]]; then
    log "Removing worktree: $WT_DIR"
    cd "$ROOT" 2>/dev/null || cd /tmp
    git -C "$ROOT" worktree remove --force "$WT_DIR" 2>/dev/null \
      || rm -rf "$WT_DIR"
    git -C "$ROOT" worktree prune 2>/dev/null || true
  fi
  exit $rc
}
trap cleanup_worktree EXIT INT TERM

create_worktree() {
  mkdir -p "$WT_PARENT"
  log "Creating worktree at $WT_DIR (detached @ HEAD)"
  git -C "$ROOT" worktree add --detach "$WT_DIR" HEAD
}

# Copy gitignored .env-style secrets from the main repo into the worktree.
# Tracked files (e.g., apps/tlon-mobile/ios/GoogleService-Info-*.plist,
# apps/tlon-mobile/android/app/google-services.json, .env.sample) are already
# in the worktree.
copy_local_secrets() {
  log "Copying local secrets (.env*) into worktree:"
  local patterns=(
    '.env'
    '.env.local'
    '.env.local.*'
    '.env.development'
    '.env.production'
    '.env.staging'
    '.env.test'
    '.env.profile'
  )
  local count=0
  for p in "${patterns[@]}"; do
    while IFS= read -r src; do
      [[ -z "$src" ]] && continue
      local rel="${src#$ROOT/}"
      mkdir -p "$(dirname "$WT_DIR/$rel")"
      cp "$src" "$WT_DIR/$rel"
      log "  $rel"
      count=$((count + 1))
    done < <(find "$ROOT" -name "$p" -type f \
      -not -path "$ROOT/.git/*" \
      -not -path "$ROOT/node_modules/*" \
      -not -path "*/node_modules/*" \
      -not -path "$WT_PARENT/*" 2>/dev/null)
  done
  log "Copied $count secret file(s)"
}

purge_shared_caches() {
  log "Purging machine-level caches (cold mode):"

  log "  Metro shared cache (~/.cache/tlon-metro-shared)"
  rm -rf "$HOME/.cache/tlon-metro-shared"

  log "  Metro tmp caches"
  rm -rf "${TMPDIR:-/tmp}/metro-cache" 2>/dev/null || true
  find "${TMPDIR:-/tmp}" -maxdepth 1 \
    \( -name 'haste-map-*' -o -name 'metro-*' \) \
    -prune -exec rm -rf {} + 2>/dev/null || true

  if command -v ccache >/dev/null 2>&1; then
    log "  ccache -C"
    ccache -C >/dev/null 2>&1 || true
  fi

  # NOTE: deliberately NOT nuking:
  #   - pnpm content store (~/.local/share/pnpm/store) — network-bound
  #   - Xcode DerivedData global — per-project-path, won't be reused by worktree
  #   - CocoaPods spec cache  — re-downloading specs adds noise unrelated to build time
  #   - Gradle download cache — same reason
}

# ---------------------------------------------------------------------------
# steps run inside the worktree
# ---------------------------------------------------------------------------

step_pod_install() {
  cd "$WT_DIR/apps/tlon-mobile/ios"
  bundle install
  bundle exec pod install
}

step_native_build_ios() {
  cd "$WT_DIR/apps/tlon-mobile"
  pnpm exec expo run:ios --no-bundler
}

step_native_build_android() {
  cd "$WT_DIR/apps/tlon-mobile"
  pnpm exec expo run:android --variant=productionDebug --no-bundler
}

step_metro_bundle() {
  cd "$WT_DIR/apps/tlon-mobile"
  local outdir="/tmp/build-perf-bundle-${TS}"
  mkdir -p "$outdir/assets"
  # Dev-mode bundle (what `expo run:*` actually serves to the sim).
  # Uses the same Metro transform path & cache as the dev server.
  pnpm exec expo export:embed \
    --platform "$PLATFORM" \
    --dev true \
    --minify false \
    --bundle-output "$outdir/index.bundle" \
    --assets-dest "$outdir/assets"
}

run_steps() {
  cd "$WT_DIR"

  if [[ "$MODE" == "cold" ]]; then
    record purge_shared_caches purge_shared_caches
    export EXPO_NO_CACHE=1
    log "Cold mode: EXPO_NO_CACHE=1 set (bypass EAS cache lookup for build)"
  fi

  record pnpm_install      pnpm install --prefer-offline --frozen-lockfile
  record build_packages    pnpm run build:packages
  record generate_tailwind pnpm --filter tlon-mobile run generate:tailwind

  if [[ "$PLATFORM" == "ios" ]]; then
    record pod_install     step_pod_install
    record native_build    step_native_build_ios
  else
    record native_build    step_native_build_android
  fi

  record metro_bundle      step_metro_bundle
}

print_summary() {
  section "Summary ($MODE / $PLATFORM)"
  printf '%-20s %8s %4s\n' "Step" "Seconds" "RC" | tee -a "$LOG"
  printf '%-20s %8s %4s\n' "--------------------" "--------" "----" | tee -a "$LOG"
  local total=0
  while IFS=$'\t' read -r name secs rc; do
    printf '%-20s %8d %4d\n' "$name" "$secs" "$rc" | tee -a "$LOG"
    total=$((total + secs))
  done < "$SUMMARY"
  printf '%-20s %8d\n' "TOTAL" "$total" | tee -a "$LOG"

  ln -sf "$(basename "$SUMMARY")" "$OUT_DIR/latest-${MODE}-${PLATFORM}.summary"
  ln -sf "$(basename "$LOG")"     "$OUT_DIR/latest-${MODE}-${PLATFORM}.log"

  log ""
  log "Summary: $SUMMARY"
  log "Log:     $LOG"
}

# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------
section "mode=$MODE platform=$PLATFORM"
log "Main repo: $ROOT"
log "Worktree:  $WT_DIR"

if [[ -n "$(git -C "$ROOT" status --porcelain 2>/dev/null)" ]]; then
  log "WARNING: main repo has uncommitted changes."
  log "         Worktree will reflect HEAD only — commit first to include them."
fi

create_worktree
copy_local_secrets
run_steps
print_summary
