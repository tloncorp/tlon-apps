#!/bin/bash
set -euo pipefail

# Drive ONE measurement prompt at the 6a bot, as the owner ship, with the
# harness preflight in front of it.
#
#   ./dev/surfaces-run.sh "poll for Friday movie night — three options"
#
# The preflight is not optional and there is no flag to skip it. That is the
# entire reason this script exists: a preflight nobody invokes is the same
# defect one level up, and session 6a spent a whole measurement round scoring
# runs whose preconditions had silently stopped holding. If the preflight fails
# this script exits without sending anything, so a bad container cannot quietly
# produce a scored run.
#
# What it does, in order:
#   1. dev/surfaces-preflight.mjs   — the runtime model accepts images (D111),
#                                     and the system prompt lists `surfaces`
#                                     (D112). Exits 1 on a failed assertion,
#                                     2 if it could not run.
#   2. /new                         — reset the owner DM session, so the
#                                     measurement does not inherit the probe
#                                     turn. Destructive to anything else using
#                                     this session; see the note in
#                                     surfaces-preflight.mjs.
#   3. the prompt                   — sent as ~ten via packages/shared/seed.
#
# Nothing here reads the run back. Timing and transcripts come from the
# container (`docker logs`, /root/.openclaw/agents/dev/sessions), as in 6a.

DEV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$DEV_DIR/../../.." && pwd)"

if [ $# -lt 1 ]; then
  echo "usage: $0 \"<prompt>\"" >&2
  exit 64
fi
PROMPT="$1"

echo "==> preflight"
# Not `if ! node ...`: inside the then-branch of a negated test $? is the
# NEGATED status, so the refusal would report and exit 0 and a caller checking
# the exit code would read a refusal as a success. Demonstrated, then fixed.
set +e
node "$DEV_DIR/surfaces-preflight.mjs"
status=$?
set -e
if [ "$status" -ne 0 ]; then
  echo "" >&2
  echo "REFUSING TO SEND THE MEASUREMENT PROMPT: preflight exited $status." >&2
  echo "A run taken now would be scored against preconditions that do not hold." >&2
  exit "$status"
fi

echo ""
echo "==> resetting the owner DM session"
(cd "$REPO_ROOT" && pnpm --filter @tloncorp/shared exec vite-node \
  --config seed/vite.config.ts seed/probe-dm.ts -- "/new" >/dev/null)
sleep 6

echo "==> sending: $PROMPT"
(cd "$REPO_ROOT" && pnpm --filter @tloncorp/shared exec vite-node \
  --config seed/vite.config.ts seed/probe-dm.ts -- "$PROMPT")
