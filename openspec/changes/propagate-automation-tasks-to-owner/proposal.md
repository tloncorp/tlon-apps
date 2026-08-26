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

- `%steward` gains a single automation feed at
  `/v1/automation/tasks`: subscribing yields one complete ship-keyed
  snapshot fact followed by ship-attributed per-task deltas and
  entry removals, fed by accepted `%project` actions and applied bot
  updates alike. Clients subscribe to the same feed on the owner.
- The owner's `%steward` subscribes to each trusted bot's automation
  path, stores a per-bot mirror of task state, replaces the mirror
  atomically from snapshot facts, and applies delta facts so the
  owner-side store stays in sync on task create/update/delete.
  Subscription lifecycle is managed (subscribe on trust, leave and
  clear on untrust, resubscribe on kick; a resubscribe self-heals via
  the snapshot fact). A self-owned bot (owner == our) serves both
  roles locally without a network hop.
- A single versioned automation update mark carries the snapshot,
  task deltas, and entry removals with one JSON representation
  shared by the feed and the scry. The wire format remains
  harness-agnostic (it reuses the existing harness-neutral `task`
  type; nothing OpenClaw-specific is added).
- `on-watch` authorization becomes per-path: the bot's automation path
  admits the configured owner cross-ship (and local subscribers);
  every existing path stays local-only.
- The branch-only agent state replaces the flat task map with a
  single per-ship mirror (the local projection stored under the
  local ship) — no new state version and no migration changes.
  Released-state migration handling (including subscribing
  already-trusted bots on upgrade) is deferred to follow-up work on
  this branch.
- The automation scry at `/x/v1/automation/tasks` returns the
  complete ship-keyed state in the feed's snapshot form (cache-miss
  reads for clients); the flat bot-local shape and the separate
  mirror scry are retired.

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

- `steward-automation-projection`: the "JSON task scry" requirement
  is reshaped — `/x/v1/automation/tasks` now returns the ship-keyed
  task state in the automation update mark's snapshot form instead
  of the flat bot-local `tasks` object.

The bot-side `%project` requirements are otherwise untouched, and
the released-state migration requirement is deliberately left as-is
— migration work is deferred to follow-up on this branch.

## Impact

- `desk/sur/steward/automation.hoon` — a `$tasks` alias and a single
  attributed update union; state becomes the per-ship task map.
- `desk/app/steward.hoon` — `au-core` grows watch/fact/mirror logic;
  `on-watch` auth moves per-path; new subscription wires and
  kick/nack handling in `++agent`; the branch-only state shape gains
  the mirror field (no migration changes).
- `desk/mar/steward/automation/update-1.hoon` and
  `desk/lib/steward/automation-json.hoon` — the single automation
  update mark with JSON grow/grab; `task-map-1`, `mirror-1`, and
  `mirror-map-1` are retired.
- `desk/tests/app/steward.hoon` — coverage for facts, mirror sync,
  auth, lifecycle, and the state reshape.
- `docs/backend/desk/app/steward.md` — module doc updates (the
  "automation has no subscription" statements become stale).
- No harness (openclaw-tlon TypeScript) changes: the harness→bot leg
  is untouched.
