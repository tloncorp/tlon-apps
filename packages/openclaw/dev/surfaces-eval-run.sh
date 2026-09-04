#!/bin/bash
set -euo pipefail

# Drive ONE corpus request at the bot and collect the evidence the scoreboard
# reads. This is the bot-harness half of the eval harness.
#
#   SURFACES_ALLOWED_GROUPS='~zod/surface-eval' \
#     ./dev/surfaces-eval-run.sh --request poll-movie-night --run-dir dev/surfaces-eval-out/luna-1
#
# ── What this is, and what it is not ────────────────────────────────────
#
# This is `dev/surfaces-run.sh` with a collection step bolted on. It does NOT
# reimplement the preflights: it invokes that script, which owns the desk
# check, the runtime check, the write fence and the session reset, and refuses
# to send a prompt when any of them fails. A second copy of that logic would
# drift, and the copy that drifted would be the one measuring.
#
# Two differences from `surfaces-run.sh`, both deliberate:
#
#   1. The sentence comes out of `dev/surfaces-corpus/<id>.json` rather than
#      `dev/surfaces-requests/<id>.json`. Same rule, different record set:
#      generation requests are not revision requests and have no `witness`,
#      because there is no prior app for them to be unsatisfied against.
#
#   2. `surfaces-assert-unsatisfied.ts` does not run. It answers "does this
#      app already do the thing", which is meaningless for a request that
#      creates the app. Generation runs are bound by the group allowlist
#      alone; there is no pre-state to bind to because there is no channel
#      yet.
#
# ── The collection step ─────────────────────────────────────────────────
#
# After the turn ends this copies, out of the container, exactly the files
# `dev/surfaces-score.mjs` reads:
#
#   <run-dir>/<id>/transcript.jsonl  the session jsonl for the turn
#   <run-dir>/<id>/artifacts/{app.js,spec.json}
#   <run-dir>/<id>/preview/{manifest.json,rubric.json}
#   <run-dir>/<id>/publish.json
#   <run-dir>/<id>/meta.json         written here: the turn cap, the turn's
#                                    wall clock, and exit statuses
#
# Every one of them is optional and every absence is scored as a named
# `unscored` reason rather than as a pass. A request whose turn produced
# nothing therefore lands as a row full of `unscored`, which is the truth.
#
# `preview/rubric.json` is the screenshot-scoring INPUT. It is the sheet the
# BOT filled while looking at the twelve captures — `rubric.template.json`
# with the blanks filled in — and it is copied verbatim. Nothing here writes
# or repairs it: a sheet this script filled in would be the harness scoring
# its own screenshots, which is the confabulated-rubric failure with an extra
# step. If the bot published without one, `surface publish` refused, and the
# absence is the finding.
#
# ── Not run in a build session ──────────────────────────────────────────
#
# The full corpus run is the M2 exit measurement and belongs to the bot
# harness with a live container. This script exists so that run is one loop
# over `dev/surfaces-corpus/*.json` rather than thirty-three improvisations.

DEV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORPUS_DIR="$DEV_DIR/surfaces-corpus"

REQUEST_ID=""
RUN_DIR=""
CONTAINER="${SURFACES_CONTAINER:-openclaw-surfaces-6a}"
WORKDIR="${SURFACES_CONTAINER_WORKDIR:-/workspace}"
SETTLE="${SURFACES_SETTLE_SECONDS:-20}"

# The turn cap the container enforces, recorded into meta.json so the
# scoreboard can score a cap kill as a RESULT rather than lose it.
#
# 300s is the current cap and it is BINDING for generation, not a tail risk.
# The verdict run measured generation-from-nothing at roughly twice the cost
# of revising an existing board: median around 160s, five turns past the
# previous session's longest, and one killed outright at 300. Session 6a.5's
# reading that "the budget is not the constraint" came from a sample that was
# almost entirely revisions and does not transfer to generation.
#
# Set this to whatever the container is actually configured with. A wrong
# number here scores every turn against a cap nobody enforced, which is a
# fabricated result in either direction.
CAP_SECONDS="${SURFACES_TURN_CAP_SECONDS:-300}"

while [ $# -gt 0 ]; do
  case "$1" in
    --request)
      REQUEST_ID="${2:-}"
      shift 2
      ;;
    --run-dir)
      RUN_DIR="${2:-}"
      shift 2
      ;;
    *)
      echo "unknown argument: $1" >&2
      exit 64
      ;;
  esac
done

if [ -z "$REQUEST_ID" ] || [ -z "$RUN_DIR" ]; then
  echo "usage: $0 --request <id> --run-dir <dir>" >&2
  echo "" >&2
  echo "available requests:" >&2
  ls "$CORPUS_DIR"/*.json 2>/dev/null |
    xargs -n1 basename 2>/dev/null | sed 's/\.json$//' | sed 's/^/  /' >&2
  exit 64
fi

RECORD="$CORPUS_DIR/$REQUEST_ID.json"
if [ ! -f "$RECORD" ]; then
  echo "no corpus record at $RECORD" >&2
  exit 64
fi

# The sentence, out of the record. Never out of a command line, and never out
# of a shell variable someone edited between reading the record and sending
# the prompt — the rule `dev/surfaces-requests/README.md` explains at length,
# applied to the corpus for the same reason.
PROMPT=$(node -e '
  const record = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
  if (typeof record.request !== "string" || record.request.trim() === "") {
    console.error("record has no `request` string");
    process.exit(1);
  }
  process.stdout.write(record.request);
' "$RECORD")

OUT="$RUN_DIR/$REQUEST_ID"
mkdir -p "$OUT/artifacts" "$OUT/preview"

# The session file the turn will land in. Captured BEFORE the prompt goes out
# so the collector can tell a session this run wrote from one that was already
# there — a transcript picked by mtime after the fact attributes whatever was
# most recently touched, which on a busy container is not necessarily this run.
SESSIONS_BEFORE=$(docker exec "$CONTAINER" sh -c \
  'ls -1 /root/.openclaw/agents/dev/sessions/*.jsonl 2>/dev/null || true' | sort)

STARTED_AT=$(date -u +%s)

set +e
"$DEV_DIR/surfaces-run.sh" "$PROMPT"
SEND_STATUS=$?
set -e

# The turn is asynchronous: the prompt returns as soon as it is delivered.
# Nothing here reads the run back live (same posture as surfaces-run.sh), so
# the collector waits a fixed settle period and then takes what is there.
sleep "$SETTLE"
ENDED_AT=$(date -u +%s)

echo ""
echo "==> collecting evidence into $OUT"

SESSIONS_AFTER=$(docker exec "$CONTAINER" sh -c \
  'ls -1 /root/.openclaw/agents/dev/sessions/*.jsonl 2>/dev/null || true' | sort)
NEW_SESSION=$(comm -13 <(echo "$SESSIONS_BEFORE") <(echo "$SESSIONS_AFTER") | tail -1)

if [ -n "$NEW_SESSION" ]; then
  docker cp "$CONTAINER:$NEW_SESSION" "$OUT/transcript.jsonl" || true
else
  echo "    no new session file; the routing axis will score unscored" >&2
fi

# Artifacts, preview output and the publish document, if the turn wrote them.
# `|| true` throughout: a missing file is evidence, and a collector that exits
# non-zero on one turns "the bot produced nothing" into "the harness broke",
# which are opposite findings.
for pair in \
  "app.js:artifacts/app.js" \
  "spec.json:artifacts/spec.json" \
  "surface-preview/manifest.json:preview/manifest.json" \
  "surface-preview/rubric.template.json:preview/rubric.json" \
  "publish.json:publish.json"; do
  src="${pair%%:*}"
  dst="${pair##*:}"
  docker cp "$CONTAINER:$WORKDIR/$src" "$OUT/$dst" 2>/dev/null || true
done

node -e '
  const fs = require("node:fs");
  const [out, id, started, ended, sendStatus, prompt, container, cap, settle] =
    process.argv.slice(1);
  // The settle wait is subtracted: it is this script sleeping, not the bot
  // thinking, and leaving it in would make every turn look `settle` seconds
  // closer to the cap than it actually came.
  const turnSeconds = Number(ended) - Number(started) - Number(settle);
  fs.writeFileSync(
    `${out}/meta.json`,
    JSON.stringify(
      {
        requestId: id,
        prompt,
        container,
        startedAt: new Date(Number(started) * 1000).toISOString(),
        endedAt: new Date(Number(ended) * 1000).toISOString(),
        turnSeconds,
        capSeconds: Number(cap),
        settleSeconds: Number(settle),
        // A wall-clock reading, not a witness. The scorer derives the cap kill
        // from turnSeconds >= capSeconds and takes either as sufficient; this
        // script sits outside the turn and cannot watch the container kill it,
        // so it never sets this true. It is here for a runner that can.
        killedAtCap: false,
        sendExitStatus: Number(sendStatus),
        // Per-phase seconds are NOT written here. The scorer derives them from
        // the transcript'"'"' own timestamps, on the same re-derive-do-not-trust
        // rule as the gate: this script can only see the turn'"'"' two ends.
        note: "turnSeconds is wall clock minus the settle wait; the phase split comes from the transcript",
      },
      null,
      2
    ) + "\n"
  );
' "$OUT" "$REQUEST_ID" "$STARTED_AT" "$ENDED_AT" "$SEND_STATUS" "$PROMPT" "$CONTAINER" "$CAP_SECONDS" "$SETTLE"

echo "    $OUT"
ls -1 "$OUT" | sed 's/^/      /'
echo ""
echo "Score the run when every request is in:"
echo "  node $DEV_DIR/surfaces-score.mjs --run $RUN_DIR --baseline $DEV_DIR/surfaces-eval-baseline.json"
