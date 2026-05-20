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
NATIVE_BUILD_LOG="$OUT_DIR/${TS}-${MODE}-${PLATFORM}.native_build.log"
NATIVE_BUILD_PHASES="$OUT_DIR/${TS}-${MODE}-${PLATFORM}.native_build.phases"

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

step_pnpm_install() {
  cd "$WT_DIR"
  local rc=0
  pnpm install --prefer-offline --frozen-lockfile || rc=$?
  # pnpm exits non-zero when a patch fails to apply, even if all packages
  # installed. Verify by checking key paths.
  if [[ $rc -ne 0 ]]; then
    if [[ -d "node_modules/.pnpm" && -d "node_modules/expo" ]]; then
      echo "[pnpm_install] rc=$rc but install appears complete — treating as success (likely a patch-apply warning)"
      return 0
    fi
    echo "[pnpm_install] rc=$rc and key packages missing — real failure"
    return $rc
  fi
}

step_pod_install() {
  cd "$WT_DIR/apps/tlon-mobile/ios"
  # CocoaPods on Ruby 3.4 crashes with "Unicode Normalization not appropriate
  # for ASCII-8BIT" unless the locale is UTF-8.
  export LANG=en_US.UTF-8
  export LC_ALL=en_US.UTF-8
  bundle install
  bundle exec pod install
}

step_native_build_ios() {
  cd "$WT_DIR/apps/tlon-mobile"
  # CocoaPods on Ruby 3.4 crashes with "Unicode Normalization not appropriate
  # for ASCII-8BIT" unless the locale is UTF-8. `expo run:ios` invokes pod
  # install internally when needed, so we set LANG here.
  export LANG=en_US.UTF-8
  export LC_ALL=en_US.UTF-8
  # EXPO_DEBUG=1 enables `log.debug(...)` in the build cache provider AND
  # emits timestamped phase markers from across expo CLI — used by the
  # phase-parser below to compute per-substep timings.
  EXPO_DEBUG="${EXPO_DEBUG:-1}" pnpm exec expo run:ios --no-bundler 2>&1 \
    | tee "$NATIVE_BUILD_LOG"
  # tee succeeds — preserve the pipe's first exit code (expo's rc)
  return ${PIPESTATUS[0]}
}

step_native_build_android() {
  cd "$WT_DIR/apps/tlon-mobile"
  # Android SDK + JDK must be on PATH for `expo run:android` → gradlew.
  export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
  export JAVA_HOME="${JAVA_HOME:-/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home}"
  # EXPO_DEBUG=1 surfaces cache-provider errors AND emits timestamped
  # markers for parse_native_build_phases.
  EXPO_DEBUG="${EXPO_DEBUG:-1}" pnpm exec expo run:android --variant=productionDebug --no-bundler 2>&1 \
    | tee "$NATIVE_BUILD_LOG"
  return ${PIPESTATUS[0]}
}

# Parse the EXPO_DEBUG=1 output from native_build to extract per-phase
# timings. Expo CLI emits ISO-timestamped lines like:
#   2026-05-19T22:04:48.357Z expo:env Loaded environment variables ...
# We bucket those into named phases and time each one. Output goes to
# $NATIVE_BUILD_PHASES (tab-separated: phase \t seconds) and stdout.
parse_native_build_phases() {
  if [[ ! -f "$NATIVE_BUILD_LOG" ]]; then
    return 0
  fi

  python3 - "$NATIVE_BUILD_LOG" "$NATIVE_BUILD_PHASES" <<'PY' | tee -a "$LOG"
import re, sys
from datetime import datetime

log_path, out_path = sys.argv[1], sys.argv[2]
ts_re = re.compile(r'^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\s+(\S+)')

# Markers we track. Each is (substring, label, must-have-timestamp-on-same-line).
# Lines from the cache provider don't have ISO timestamps — we inherit the last
# timestamped line for those. Timestamp-bearing markers anchor the timeline.
markers = [
    # Substring                                           Label
    ('expo:env',                                           'env_load_first'),
    ('expo:run:ios:options:resolveNativeScheme',           'scheme_resolved'),
    ('expo:doctor',                                        'doctor_check_first'),
    ('Searching builds with matching fingerprint',         'cache_search'),
    ('Successfully downloaded cached build',               'cache_hit_downloaded'),
    ('No builds available',                                'cache_miss'),
    ('expo:run:ios Binary path',                           'binary_chosen'),
    ('expo:start:platforms:ios:xcrun Running: xcrun simctl install', 'install_start'),
    ('expo:start:platforms:ios:AppleDeviceManager getApplicationIdFromBundle', 'install_done'),
    ('expo:start:platforms:ios:xcrun Running: xcrun simctl openurl', 'open_url'),
    ('Uploading build to EAS',                             'upload_start'),
    ('Build successfully uploaded',                        'upload_done'),
]

# First-seen timestamps per label
seen = {}
current_ts = None
start_ts = None

with open(log_path, errors='replace') as f:
    for line in f:
        m = ts_re.match(line)
        if m:
            current_ts = datetime.fromisoformat(m.group(1).replace('Z', '+00:00'))
            if start_ts is None:
                start_ts = current_ts
        for text, label in markers:
            if text in line and label not in seen and current_ts is not None:
                seen[label] = current_ts

# Compute named phases as gaps between specific markers we can rely on.
# Only use timestamped markers — the cache provider's "Searching builds…" /
# "Successfully downloaded cached build" lines have no ISO timestamp, so we
# can't use them as anchors. Bracket them via the surrounding expo:* lines.
def gap(a, b):
    if a in seen and b in seen:
        return round((seen[b] - seen[a]).total_seconds(), 1)
    return None

cache_hit = 'cache_hit_downloaded' in seen
cache_miss = 'cache_miss' in seen
cache_outcome = 'HIT' if cache_hit else ('MISS' if cache_miss else 'unknown')

phases = []
# 1. expo CLI startup + fingerprint computation (the eas-cli subprocess that
#    hashes 200+ files and reports back). Dominant cost on cache-hit path.
if 'env_load_first' in seen and 'scheme_resolved' in seen:
    phases.append(('startup_+_fingerprint_compute', gap('env_load_first', 'scheme_resolved')))
# 2. Doctor / simulator picking / cache lookup decision + (if hit) download
#    OR (if miss) full xcodebuild. All bracketed by scheme_resolved →
#    binary_chosen.
if 'scheme_resolved' in seen and 'binary_chosen' in seen:
    if cache_hit:
        phases.append(('doctor_+_lookup_+_download', gap('scheme_resolved', 'binary_chosen')))
    elif cache_miss:
        phases.append(('doctor_+_lookup_+_xcodebuild', gap('scheme_resolved', 'binary_chosen')))
    else:
        phases.append(('doctor_+_lookup_+_???', gap('scheme_resolved', 'binary_chosen')))
# 3. simctl install + launch.
if 'binary_chosen' in seen and 'install_start' in seen:
    phases.append(('prep_install', gap('binary_chosen', 'install_start')))
if 'install_start' in seen and 'install_done' in seen:
    phases.append(('simctl_install', gap('install_start', 'install_done')))
if 'install_done' in seen and 'open_url' in seen:
    phases.append(('launch_+_open_url', gap('install_done', 'open_url')))
# 4. Upload (cache miss path only).
if 'upload_start' in seen and 'upload_done' in seen:
    phases.append(('eas_cache_upload', gap('upload_start', 'upload_done')))

with open(out_path, 'w') as out:
    for label, secs in phases:
        out.write(f"{label}\t{secs}\n")

print()
print(f"=== expo CLI sub-phases (within native_build, cache {cache_outcome}) ===")
if not phases:
    print("  (no recognizable markers — was EXPO_DEBUG=1 set?)")
else:
    total = 0.0
    for label, secs in phases:
        if secs is not None:
            print(f"  {label:<34} {secs:>6.1f}s")
            total += secs
    print(f"  {'-' * 34} {'------'}")
    print(f"  {'sum of phases above':<34} {total:>6.1f}s")
    if start_ts is not None and current_ts is not None:
        print(f"  {'wall-clock first→last expo: line':<34} {(current_ts - start_ts).total_seconds():>6.1f}s")
PY
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

  record pnpm_install      step_pnpm_install
  # Most @tloncorp/* packages resolve to src/ via the `tlon-source`
  # condition (see apps/tlon-mobile/metro.config.js + tsconfig.json),
  # so their dist/ outputs aren't needed. The exception is
  # @tloncorp/editor which has ONE explicit `dist/editorHtml` import
  # in packages/app/ui/components/MessageInput/index.tsx — that file is
  # generated by build:editor (calls @10play/tentap-editor's
  # buildEditor.js to produce dist/index.html). Building editor alone
  # is ~1.7s; full build:packages (api+shared+ui+editor) is ~6-9s.
  record build_editor      pnpm run build:editor
  record generate_tailwind pnpm --filter tlon-mobile run generate:tailwind

  if [[ "$PLATFORM" == "ios" ]]; then
    # No explicit pod_install step — `expo run:ios` handles it internally
    # (and skips entirely when the EAS cache hits). Removing it saves ~25s
    # on the cache-hit path.
    record native_build    step_native_build_ios
  else
    record native_build    step_native_build_android
  fi

  record metro_bundle      step_metro_bundle

  # Parse expo CLI debug output for per-phase timings inside native_build.
  parse_native_build_phases
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
