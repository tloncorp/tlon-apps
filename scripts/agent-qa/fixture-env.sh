#!/usr/bin/env bash
set -euo pipefail
# PR-dependent Rube/actor imports need fixture settings, never CI credentials.
# Use an allowlist so future secrets do not silently reach these processes.
fixture_env=(env -i)
for name in PATH HOME USER LOGNAME SHELL TMPDIR TMP TEMP LANG LC_ALL TERM CI RUNNER_TEMP \
  PROOF_OUTPUT MAESTRO_RUN_TAG QA_PR_MODE QA_FIXTURE_PLAN PROOF_PUBLIC_URL \
  NODE_OPTIONS SKIP_DOWNLOAD SKIP_TESTS INCLUDE_OPTIONAL_SHIPS; do
  if [[ ${!name+x} ]]; then fixture_env+=("$name=${!name}"); fi
done
exec "${fixture_env[@]}" "$@"
