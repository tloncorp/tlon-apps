#!/bin/bash
# Best-effort capture of orphaned tlon-bot-e2e compose stacks after a failed
# or cancelled E2E step (a step/job timeout kills the CLI before its own
# teardown runs, leaving containers behind). Every command is tolerated —
# this script must never fail the CI step — and text capture files record
# stderr plus exit status so a silently empty capture is distinguishable
# from a clean one.

set -u

OUTDIR="${1:?usage: capture-docker-state.sh <outdir>}"

mkdir -p "$OUTDIR" || true

{
  echo "captured-at: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo "GITHUB_RUN_ID: ${GITHUB_RUN_ID:-}"
  echo "GITHUB_RUN_ATTEMPT: ${GITHUB_RUN_ATTEMPT:-}"
  echo "GITHUB_JOB: ${GITHUB_JOB:-}"
} >"$OUTDIR/capture-meta.txt" 2>&1 || true

# dmesg first: it needs no docker, and a hung docker daemon must not starve
# the kernel-side OOM evidence. Best-effort — sudo/dmesg access can fail, and
# the ring buffer may have rotated an early kill out.
sudo dmesg 2>&1 | tail -300 >"$OUTDIR/dmesg.txt" || true

# Bound each docker command when GNU timeout exists (Linux CI); a hung daemon
# must not consume the whole capture step on its first command. macOS dev
# machines may lack `timeout` — there the step-level CI timeout is absent
# anyway and an unbounded call only affects a manual invocation.
DOCKER_TIMEOUT=""
if command -v timeout >/dev/null 2>&1; then
  DOCKER_TIMEOUT="timeout 20"
fi
d() {
  # shellcheck disable=SC2086 -- intentional word split of "timeout 20"
  $DOCKER_TIMEOUT docker "$@"
}

# Per-command timeouts alone can't bound the total (container count is
# unbounded — concurrent stacks are captured too), so docker work also stops
# at a script-level deadline, safely inside the 5-min CI step cap. Truncation
# is stamped into the meta file — a silent cap would read as full coverage.
BUDGET_SECONDS=240
budget_ok() {
  if [ "$SECONDS" -ge "$BUDGET_SECONDS" ]; then
    echo "capture-truncated: docker budget exhausted after ${SECONDS}s" \
      >>"$OUTDIR/capture-meta.txt" || true
    return 1
  fi
  return 0
}

# Runs a command, capturing stdout+stderr and the exit status into a file.
capture() {
  local outfile="$1"
  shift
  local status=0
  "$@" >"$outfile" 2>&1 || status=$?
  # Leading newline so a final log entry without one can't swallow the marker.
  printf '\nexit-status: %s\n' "$status" >>"$outfile" || true
}

# Like capture, but stamps the exit status only on failure, so a successful
# .state.json stays valid JSON for jq and friends.
capture_json() {
  local outfile="$1"
  shift
  local status=0
  "$@" >"$outfile" 2>&1 || status=$?
  if [ "$status" -ne 0 ]; then
    printf '\nexit-status: %s\n' "$status" >>"$outfile" || true
  fi
}

# The cheap overview first, so per-container captures can't starve it.
capture "$OUTDIR/docker-ps.txt" d ps -a

# Docker's label filter supports only presence or exact equality — no prefix
# matching — so list every compose-project container and prefix-match ours
# in the shell.
listing=""
if budget_ok; then
  listing="$(d container ls --all \
    --filter label=com.docker.compose.project \
    --format '{{.ID}}\t{{.Label "com.docker.compose.project"}}\t{{.Names}}' 2>/dev/null)" || true
fi

while IFS=$'\t' read -r id project name; do
  [ -n "$id" ] || continue
  case "$project" in
    tlon-bot-e2e-*) ;;
    *) continue ;;
  esac
  budget_ok || break
  capture_json "$OUTDIR/$name.state.json" d inspect --format '{{json .State}}' "$id"
  capture "$OUTDIR/$name.top.txt" d top "$id" -eo pid,ppid,comm,args
  capture "$OUTDIR/$name.log" d logs "$id"
done <<EOF
$listing
EOF

exit 0
