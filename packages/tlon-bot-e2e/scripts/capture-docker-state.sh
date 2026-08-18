#!/bin/bash
# Best-effort capture of orphaned tlon-bot-e2e compose stacks after a failed
# or cancelled E2E step (a step/job timeout kills the CLI before its own
# teardown runs, leaving containers behind). Every command is tolerated —
# this script must never fail the CI step — and each capture file records
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

# Runs a command, capturing stdout+stderr and the exit status into a file.
capture() {
  local outfile="$1"
  shift
  local status=0
  "$@" >"$outfile" 2>&1 || status=$?
  # Leading newline so a final log entry without one can't swallow the marker.
  printf '\nexit-status: %s\n' "$status" >>"$outfile" || true
}

# Docker's label filter supports only presence or exact equality — no prefix
# matching — so list every compose-project container and prefix-match ours
# in the shell.
listing="$(docker container ls --all \
  --filter label=com.docker.compose.project \
  --format '{{.ID}}\t{{.Label "com.docker.compose.project"}}\t{{.Names}}' 2>/dev/null)" || true

while IFS=$'\t' read -r id project name; do
  [ -n "$id" ] || continue
  case "$project" in
    tlon-bot-e2e-*) ;;
    *) continue ;;
  esac
  capture "$OUTDIR/$name.state.json" docker inspect --format '{{json .State}}' "$id"
  capture "$OUTDIR/$name.top.txt" docker top "$id" -eo pid,ppid,comm,args
  capture "$OUTDIR/$name.log" docker logs "$id"
done <<EOF
$listing
EOF

capture "$OUTDIR/docker-ps.txt" docker ps -a

# Best-effort: sudo/dmesg access can fail, and the ring buffer may have
# rotated an early kill out.
sudo dmesg 2>&1 | tail -300 >"$OUTDIR/dmesg.txt" || true

exit 0
