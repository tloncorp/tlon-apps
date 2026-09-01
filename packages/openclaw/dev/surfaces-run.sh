#!/bin/bash
set -euo pipefail

# Drive ONE measurement prompt at the 6a bot, as the owner ship, with every
# preflight in front of it.
#
#   ./dev/surfaces-run.sh "poll for Friday movie night — three options"
#   ./dev/surfaces-run.sh --request potluck-vegetarian
#
# No preflight is optional and there is no flag to skip one. That is the entire
# reason this script exists: a preflight nobody invokes is the same defect one
# level up, and session 6a spent a whole measurement round scoring runs whose
# preconditions had silently stopped holding. If a preflight fails this script
# exits without sending anything, so a bad container — or an already-satisfied
# request — cannot quietly produce a scored run.
#
# What it does, in order:
#   1. dev/surfaces-preflight.mjs   — the runtime model accepts images (D111),
#                                     and the system prompt lists `surfaces`
#                                     (D112). Exits 1 on a failed assertion,
#                                     2 if it could not run.
#   2. dev/surfaces-assert-unsatisfied.ts — REVISION MODE ONLY. The app does
#                                     not already do the thing being asked
#                                     for. Exits 1 on PRESENT or ABSTAIN.
#   3. /new                         — reset the owner DM session, so the
#                                     measurement does not inherit the probe
#                                     turn. Destructive to anything else using
#                                     this session; see the note in
#                                     surfaces-preflight.mjs.
#   4. the prompt                   — sent as ~ten via packages/shared/seed.
#
# ── Why revision prompts come from a FILE ───────────────────────────────
#
# In `--request` mode the sentence sent to the bot is read out of the same
# record `surfaces-assert-unsatisfied.ts` just asserted against. It is never
# retyped here or on a command line.
#
# 6a.5's measurement failed because four of its five revision requests were
# already satisfied before the run. A preflight fixes that only if the sentence
# it cleared is the sentence that gets sent; a preflight run against one
# phrasing while a slightly different one goes down the wire is the same defect
# wearing a hat. Reading both out of one file makes the two unable to drift.
#
# Nothing here reads the run back. Timing and transcripts come from the
# container (`docker logs`, /root/.openclaw/agents/dev/sessions), as in 6a.

DEV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$DEV_DIR/../../.." && pwd)"

if [ $# -lt 1 ]; then
  echo "usage: $0 \"<prompt>\"" >&2
  echo "       $0 --request <id>     (revision; id names dev/surfaces-requests/<id>.json)" >&2
  exit 64
fi

REQUEST_ID=""
if [ "$1" = "--request" ]; then
  if [ $# -lt 2 ]; then
    echo "usage: $0 --request <id>" >&2
    exit 64
  fi
  REQUEST_ID="$2"
  RECORD="$DEV_DIR/surfaces-requests/$REQUEST_ID.json"
  if [ ! -f "$RECORD" ]; then
    echo "no request record at $RECORD" >&2
    echo "available:" >&2
    ls "$DEV_DIR/surfaces-requests"/*.json 2>/dev/null |
      xargs -n1 basename 2>/dev/null | sed 's/\.json$//' | sed 's/^/  /' >&2
    exit 64
  fi
  # The sentence, out of the record. Not out of $2, and not out of a shell
  # variable someone edited between the assertion and the send.
  PROMPT=$(node -e '
    const record = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
    if (typeof record.request !== "string" || record.request.trim() === "") {
      console.error("record has no `request` string");
      process.exit(1);
    }
    process.stdout.write(record.request);
  ' "$RECORD")
else
  PROMPT="$1"
fi

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

if [ -n "$REQUEST_ID" ]; then
  echo ""
  echo "==> assert-unsatisfied ($REQUEST_ID)"
  if [ -z "${TLON_URL:-}" ] || [ -z "${TLON_SHIP:-}" ] || [ -z "${TLON_CODE:-}" ]; then
    echo "" >&2
    echo "TLON_URL, TLON_SHIP and TLON_CODE must be set: the assertion reads the" >&2
    echo "live channel. Point them at the rube fakeships (~zod is 35453), never" >&2
    echo "at a real ship, and never via the CLI's --ship flag." >&2
    exit 2
  fi
  set +e
  bun "$DEV_DIR/surfaces-assert-unsatisfied.ts" --request "$REQUEST_ID"
  assert_status=$?
  set -e
  if [ "$assert_status" -ne 0 ]; then
    echo "" >&2
    echo "REFUSING TO SEND THE REVISION REQUEST: assert-unsatisfied exited $assert_status." >&2
    if [ "$assert_status" -eq 1 ]; then
      echo "The app already does this, or the preflight could not tell. Either way the" >&2
      echo "request is REPLACED, not waved through — a no-op measured against an" >&2
      echo "already-satisfied request is what made 6a.5's regeneration column empty." >&2
    fi
    exit "$assert_status"
  fi
fi

echo ""
echo "==> resetting the owner DM session"
(cd "$REPO_ROOT" && pnpm --filter @tloncorp/shared exec vite-node \
  --config seed/vite.config.ts seed/probe-dm.ts -- "/new" >/dev/null)
sleep 6

echo "==> sending: $PROMPT"
(cd "$REPO_ROOT" && pnpm --filter @tloncorp/shared exec vite-node \
  --config seed/vite.config.ts seed/probe-dm.ts -- "$PROMPT")
