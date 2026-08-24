# Propagate Automation Tasks to Owner

## Why

The first leg of the task-sync pipeline (TLON-6370, archived as
`mirror-openclaw-automations-to-steward`) mirrors OpenClaw cron task
definitions into the bot ship's `%steward`, but the mirror is stranded
there: the owner ship has no copy and clients have no way to observe
task changes. TLON-6371 adds the second leg — propagating the bot's
task state to the owner ship and exposing a subscription that
broadcasts task changes for client use, per the pipeline design in
TLON-6271 ("Bot →→ Owner: Update fact", then "Owner →→ Client: Update
fact").

## What Changes

- The bot's `%steward` gains an automation subscription surface: a
  watch path that yields the current task projection as an initial
  snapshot fact followed by per-task delta facts whenever an accepted
  `%project` changes the stored map.
- The owner's `%steward` subscribes to each trusted bot's automation
  path, stores a per-bot mirror of task state, replaces the mirror
  atomically from snapshot facts, and applies delta facts so the
  owner-side store stays in sync on task create/update/delete.
  Subscription lifecycle is managed (subscribe on trust, leave and
  clear on untrust, resubscribe on kick; a resubscribe self-heals via
  the snapshot fact). A self-owned bot (owner == our) serves both
  roles locally without a network hop.
- The owner's `%steward` re-broadcasts automation updates to local
  clients on its own watch path: subscribing yields the current
  mirrored state followed by deltas, with each update attributed to
  its bot ship.
- New versioned automation update types and marks — an un-attributed
  projection update for the bot feed and a bot-attributed mirror
  update for the client feed — carry snapshots and deltas with JSON
  representations for HTTP clients. The two feeds are versioned
  independently so they can evolve separately. The wire format
  remains harness-agnostic (it reuses the existing harness-neutral
  `task` type; nothing OpenClaw-specific is added).
- `on-watch` authorization becomes per-path: the bot's automation path
  admits the configured owner cross-ship (and local subscribers);
  every existing path stays local-only.
- The branch-only agent state shape gains the owner-side per-bot
  mirror in place — no new state version and no migration changes.
  Released-state migration handling (including subscribing
  already-trusted bots on upgrade) is deferred to follow-up work on
  this branch.
- An owner-side scry exposes the mirrored per-bot task state for
  client backfill.

Out of scope (per TLON-6371): client UI; task edits flowing from
client back to the harness (the modify path in TLON-6271's second
diagram).

## Capabilities

### New Capabilities

- `steward-automation-sync`: propagation of the automation task mirror
  from the bot ship to the owner ship over a Gall subscription, and
  the owner-side client-facing subscription and scry surface —
  snapshot-then-deltas semantics, subscription lifecycle, per-bot
  attribution, and authorization.

### Modified Capabilities

None. The bot-side `%project` requirements are untouched (update
facts on commit are new behavior specified in
`steward-automation-sync`), and the released-state migration
requirement is deliberately left as-is — migration work is deferred
to follow-up on this branch.

## Impact

- `desk/sur/steward/automation.hoon` — new per-feed update types;
  state gains the per-bot mirror.
- `desk/app/steward.hoon` — `au-core` grows watch/fact/mirror logic;
  `on-watch` auth moves per-path; new subscription wires and
  kick/nack handling in `++agent`; the branch-only state shape gains
  the mirror field (no migration changes).
- `desk/mar/steward/automation/update-1.hoon` and
  `desk/mar/steward/automation/mirror-1.hoon` (new) and
  `desk/lib/steward/automation-json.hoon` — per-feed update marks
  with JSON grow/grab.
- `desk/tests/app/steward.hoon` — coverage for facts, mirror sync,
  auth, lifecycle, and the state reshape.
- `docs/backend/desk/app/steward.md` — module doc updates (the
  "automation has no subscription" statements become stale).
- No harness (openclaw-tlon TypeScript) changes: the harness→bot leg
  is untouched.
