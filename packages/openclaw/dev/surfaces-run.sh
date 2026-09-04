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
#   1. dev/surfaces-desk-preflight.mjs — the fakeships are running THIS
#                                     branch's %groups desk. The "proven end
#                                     to end on fakeships" claim silently
#                                     expired for weeks on a stale desk; this
#                                     makes that a loud failure.
#   2. dev/surfaces-preflight.mjs   — the runtime model accepts images (D111),
#                                     and the system prompt lists `surfaces`
#                                     (D112). Exits 1 on a failed assertion,
#                                     2 if it could not run.
#   3. dev/surfaces-assert-unsatisfied.ts — REVISION MODE ONLY. The app does
#                                     not already do the thing being asked
#                                     for. Exits 1 on PRESENT or ABSTAIN.
#   4. the write fence              — the container's scope file is narrowed to
#                                     the channel and pre-state the assertion
#                                     just cleared, and widened back after.
#   5. /new                         — reset the owner DM session, so the
#                                     measurement does not inherit the probe
#                                     turn. Destructive to anything else using
#                                     this session; see the note in
#                                     surfaces-preflight.mjs.
#   6. the prompt                   — sent as ~ten via packages/shared/seed.
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
#
# ── Why the TARGET comes from the same file ─────────────────────────────
#
# Binding the sentence closed one drift and left its twin open. In the verdict
# run a revision was asserted against one board and published to a different,
# similarly-named one in a group the run had no business touching — preflight
# 0, CLI 0, gate clean, rubric complete, publish read its own write back. Every
# check asked whether the definition landed; none asked whether it landed HERE.
#
# So the assertion now emits `binding.json` — the channel it read, that
# channel's group, and the sha256 of its raw definition cell — and this script
# copies that into the container's write-scope file before the prompt goes out.
# `tlon surface publish` refuses any other channel, any group outside
# SURFACES_ALLOWED_GROUPS, and the bound channel if its definition moved since
# the assertion. The file that cleared the request is the file that names the
# target, for the same reason the sentence is read out of the record.
#
# SURFACES_ALLOWED_GROUPS is REQUIRED and has no default. A default would be a
# blast radius nobody chose, and "nobody chose it" is how a fixture in a seed
# group got written to.

DEV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$DEV_DIR/../../.." && pwd)"

# The container sees this file at /workspace/surfaces-6a-out/write-scope.json
# (docker-compose.surfaces-6a.yml mounts ./surfaces-6a-out and names the path
# in TLON_SURFACE_SCOPE_FILE). It is never absent while the container is up:
# the CLI refuses a scope file it cannot read, so an absent one is a stopped
# bot rather than an unfenced one.
SCOPE_FILE="$DEV_DIR/surfaces-6a-out/write-scope.json"

if [ -z "${SURFACES_ALLOWED_GROUPS:-}" ]; then
  echo "SURFACES_ALLOWED_GROUPS is required and has no default." >&2
  echo "" >&2
  echo "It is the comma-separated list of groups this run may write to. The" >&2
  echo "verdict run wrote a revision into a seed-group fixture with every" >&2
  echo "check green, because nothing had ever been asked where writes were" >&2
  echo "allowed to land. Declaring it is the answer; defaulting it would be a" >&2
  echo "blast radius nobody chose." >&2
  echo "" >&2
  echo "  SURFACES_ALLOWED_GROUPS='~zod/surface-6b' $0 ..." >&2
  exit 64
fi

# Widen the fence back to the session default: every declared group, no channel
# bound. Called on the way in and again on the way out, so a run that dies
# mid-flight cannot leave the next one pinned to a stale channel.
write_group_scope() {
  node -e '
    const groups = process.argv[1].split(",").map((g) => g.trim()).filter(Boolean);
    if (groups.length === 0) { console.error("SURFACES_ALLOWED_GROUPS is empty"); process.exit(1); }
    require("node:fs").writeFileSync(process.argv[2], JSON.stringify({ groups }, null, 2) + "\n");
  ' "$SURFACES_ALLOWED_GROUPS" "$SCOPE_FILE"
}

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

echo "==> desk preflight"
set +e
node "$DEV_DIR/surfaces-desk-preflight.mjs"
desk_status=$?
set -e
if [ "$desk_status" -ne 0 ]; then
  echo "" >&2
  echo "REFUSING TO SEND THE MEASUREMENT PROMPT: the fakeships are not running" >&2
  echo "this branch's %groups desk (exit $desk_status). A run taken now measures" >&2
  echo "the loop against a backend the repo no longer describes." >&2
  exit "$desk_status"
fi

echo ""
echo "==> write fence: groups $SURFACES_ALLOWED_GROUPS"
write_group_scope

echo ""
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

  # Narrow the fence to what the assertion just cleared. Not to $REQUEST_ID's
  # record — to the BINDING the assertion emitted, which names the channel it
  # actually read and the sha256 of the definition it actually saw.
  BINDING="$DEV_DIR/surfaces-6a-out/assert-unsatisfied/$REQUEST_ID/binding.json"
  if [ ! -f "$BINDING" ]; then
    echo "" >&2
    echo "assert-unsatisfied passed but wrote no binding at $BINDING." >&2
    echo "Refusing to send an unbound revision request: the target would be" >&2
    echo "whatever the bot picked, which is the failure this exists to close." >&2
    exit 2
  fi
  node -e '
    const fs = require("node:fs");
    const binding = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const declared = process.argv[3].split(",").map((g) => g.trim()).filter(Boolean);
    // The bound channel has to sit inside the blast radius the operator
    // declared. If it does not, the run is pointed somewhere the operator did
    // not authorise and the answer is to stop, not to widen.
    for (const group of binding.groups ?? []) {
      if (!declared.includes(group)) {
        console.error(
          `the assertion cleared ${binding.channel} in ${group}, which is not in ` +
          `SURFACES_ALLOWED_GROUPS (${declared.join(", ")}).`
        );
        process.exit(1);
      }
    }
    fs.writeFileSync(process.argv[2], JSON.stringify({
      channel: binding.channel,
      preState: binding.preState,
      groups: declared,
    }, null, 2) + "\n");
    console.log(`    bound to ${binding.channel} at ${binding.preState}`);
  ' "$BINDING" "$SCOPE_FILE" "$SURFACES_ALLOWED_GROUPS"
fi

# Whatever happens to the prompt, the next run starts from the session default
# rather than from this one's channel bound.
trap write_group_scope EXIT

echo ""
echo "==> resetting the owner DM session"
(cd "$REPO_ROOT" && pnpm --filter @tloncorp/shared exec vite-node \
  --config seed/vite.config.ts seed/probe-dm.ts -- "/new" >/dev/null)
sleep 6

echo "==> sending: $PROMPT"
(cd "$REPO_ROOT" && pnpm --filter @tloncorp/shared exec vite-node \
  --config seed/vite.config.ts seed/probe-dm.ts -- "$PROMPT")
