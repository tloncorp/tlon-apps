# Design: Propagate Automation Tasks to Owner

## Context

See proposal.md — Why. Relevant current state:
- `au-core` in `desk/app/steward.hoon` stores the harness projection
  in `tasks.automation.state` (a flat `(map @t task)`), replaced
  atomically by `%project` (local-source only), and serves the
  `/x/v1/automation/tasks` scry. Automation has no subscription
  surface today.
- `on-watch` asserts `=(src our)` globally in the agent door, so
  every existing watch path is local-only.
- The core config already carries the two relationship anchors this
  change needs: `owner=(unit ship)` on the bot side and the
  owner-side trusted-bots set `bots=(set ship)` (managed via
  `%trust-bot`/`%untrust-bot`).
- The lens module establishes the repo's cross-ship precedent (poke
  fan-out with per-variant auth); the gateway module establishes the
  fact-on-change + initial-fact-on-subscribe precedent
  (`ga-give-status-update` on `/v1/gateway`).
- The automation module and agent `state-1` exist only on this
  branch; the released shape is `state-0`. Per the repo rule against
  shipping migrations for branch-only state, `state-1` can be
  reshaped in place.
- TLON-6271 fixes the transport: propagation is by subscription
  ("Update fact"), bot → owner → client, confirmed by the user.

## Goals / Non-Goals

**Goals:**

- A converging owner-side mirror: after any (re)subscribe plus
  in-order deltas, the owner's per-bot map equals the bot's stored
  projection.
- Independently versioned wire formats per feed (bot→owner and
  owner→client), each usable directly by HTTP clients as JSON.
- Self-owned bots (owner == our) work with no extra configuration
  and no state duplication — the client surface serves the local
  projection directly.

**Non-Goals:**

- No client→owner→bot→harness modify path (TLON-6271's second
  diagram; a later change).
- No automatic retry loop for a *nacked* watch (kick-resubscribe
  only) — parity with the existing `%activity` watch, which has the
  same known TODO.
- No multi-owner fan-out: one configured owner per bot, as
  everywhere else in `%steward`.
- No harness (openclaw-tlon) changes.

## Decisions

### 1. Two sibling watch paths under the module namespace

- `/v1/automation/tasks` — the **bot-side broadcast**: the module's
  own projection feed, pairing 1:1 with the `/x/v1/automation/tasks`
  scry. Admits the local ship and the configured owner. Initial
  fact: one `%tasks` snapshot of the local projection.
- `/v1/automation/mirror` — the **client feed**, local-only, pairing
  1:1 with the `/x/v1/automation/mirror` scry. Serves
  the combined view: the local projection when non-empty (attributed
  to `our`) plus one entry per mirrored bot. Initial facts: one
  `%tasks` snapshot per bot in that view. Subsequent facts re-emit
  whatever changed it — a mirror mutation, or an accepted `%project`
  attributed to `our`.

Bare `/v1/automation` binds nothing: the feeds are distinct
resources, so neither may sit at the namespace root with the other
as a false child. (`/v1/lens` and `/v1/gateway` stay flat because
those modules each expose a single feed.)

Alternative considered: a single automation path serving both
roles. Rejected: the two feeds carry different things — the bot path
is one ship's raw projection (what the owner leg consumes), the
client path is the aggregated per-bot view. Merging them would make
an owner's re-broadcasts indistinguishable from its own projection
feed and invite accidental transitive relay.

### 2. Two update types — the feeds version independently

In `sur/steward/automation.hoon`:

```hoon
::  projection feed (/v1/automation/tasks): attribution is the
::  subscription source, never a payload field
+$  update
  $%  [%tasks tasks=(map @t task)]            ::  complete snapshot
      [%set id=@t =task]                      ::  task added/changed
      [%del id=@t]                            ::  task removed
  ==
::  client feed (/v1/automation/mirror): one feed carries many
::  bots, so each update names its bot
+$  mirror-update
  $%  [%tasks bot=ship tasks=(map @t task)]
      [%set bot=ship id=@t =task]
      [%del bot=ship id=@t]
  ==
```

Separate marks (`%steward-automation-update-1`,
`%steward-automation-mirror-1` — "update" is implied for a feed
mark) follow the module's existing doctrine — the action and task-map marks are already split so JSON
shapes can evolve separately — and these two feeds serve different
consumers with different futures: the owner leg is internal
protocol, the client leg is a product surface. Un-attributing the
projection feed is also a correctness win: the owner attributes
facts by the subscription that delivered them, which Gall
authenticates, instead of trusting a `bot` field a peer could fill
arbitrarily.

Alternatives considered: one shared attributed union for both legs
("the owner relays facts unmodified") — rejected: it couples the
feeds' wire evolution to skip one re-wrap, and puts a spoofable
attribution field on the cross-ship leg that the receiver would have
to validate against `src` anyway. Snapshot-only facts — rejected:
fails the ticket's "current state followed by deltas" and is
chattier for large task sets.

### 3. Deltas computed on the bot at `%project` commit

When an accepted `%project` replaces the map, `au-core` diffs old vs
new: `%set` for every added or changed ID, `%del` for every removed
ID, nothing when equal. The diff runs on the bot once, downstream
consumers just apply. The duplicate-ID crash in `au-build-task-map`
fires before any state change or fact, so a rejected projection emits
nothing — unchanged from today.

### 4. Mirror driven by the trusted-bots set

The owner subscribes on `%trust-bot`, guarding the watch on
subscription liveness in `wex.bowl` — not on trust-set membership —
so the poke is an idempotent "ensure subscribed": a no-op while a
subscription is live, a repair after a nacked watch. On
`%untrust-bot` it leaves the subscription (if live per `wex.bowl`)
and deletes that bot's mirror entry (a stale mirror of
an untrusted bot would misrepresent "bots we manage"; lens keeps runs
on untrust because runs are history — the mirror is current state,
so it goes). Wire: `/automation/tasks/(scot %p bot)`, matching the
watched path with the target bot appended. On `%kick`:
resubscribe only if the bot is still trusted. On watch-nack: slog and
keep existing mirrored state.

Alternative considered: a separate automation-specific bot registry.
Rejected — `bots` already means "ships whose steward data I accept",
and a second admin surface would drift from it.

There is deliberately no self-subscription. Subscription machinery
pays for transport and gap-repair across ships; the local projection
already lives in the same agent state, so a self-watch would only
round-trip through Gall to duplicate a map. `%trust-bot` of the
local ship creates no watch and no mirror entry — a self-owned bot
works with `%configure owner=our` alone, its tasks served on the
client feed straight from `tasks.automation.state` (decision 1).

### 5. Snapshot replaces, deltas apply

On a `%tasks` fact the owner atomically replaces that bot's mirror
entry (converges after any missed-delta window: kick, revive,
upgrade). On `%set`/`%del` it upserts/deletes; `%del` of an unknown
ID is a no-op (the snapshot-replace path can legitimately race a
delta already in flight). Every mirror mutation re-emits on
`/v1/automation/mirror` as a `mirror-update` whose `bot` comes from
the subscription wire, and an accepted `%project` that changes the
local projection emits `mirror-update`s attributed to `our` there
alongside the un-attributed `/v1/automation/tasks` broadcast. The mirror map
itself never contains the local ship — the client view composes it
with `tasks.automation.state` at read/emit time.

### 6. Reshape branch-only `state-1`; defer migration work

`state:v1:sa` gains `mirror=(map ship (map @t task))`. The agent's
`versioned-state` stays `$%(state-1 state-0)` and the existing
`state-0-to-1` migration needs no edit: it initializes the automation
module from the bunt (`*state:v1:sa`), which now yields an empty
mirror alongside the empty task map. Beyond that incidental effect,
this change makes no released-state migration commitments: the
migration spec requirement is untouched, and upgraded owner ships are
not auto-subscribed to previously trusted bots — mirroring starts
only from an explicit `%trust-bot` poke. Migration behavior is
finalized in follow-up work on this branch, once the module's state
shape stops moving.

### 7. Marks and scry

- `desk/mar/steward/automation/update-1.hoon` (projection feed) and
  `desk/mar/steward/automation/mirror-1.hoon` (client feed, carrying
  `mirror-update`) — noun grad; JSON grow and grab via
  `desk/lib/steward/automation-json.hoon`, reusing the existing task
  codecs. Ships as `s+(scot %p bot)` / `(se %p)` (mirror feed only);
  tagged-union JSON via `of`/`ot`/`frond` per repo mark conventions.
- `desk/mar/steward/automation/mirror-map-1.hoon` — the scry mark,
  named for its shape in parallel with `task-map-1`; grows the full
  `(map ship (map @t task))` to
  `{ "mirror": { "~zod": { "<id>": { ... } } } }`, empty mirror as
  `{ "mirror": {} }`.
- New scry `/x/v1/automation/mirror` returns that mark; the peek
  composes the mirror with the local projection (under `our`, when
  non-empty) before growing, matching the client feed's combined
  view. The existing `/x/v1/automation/tasks` (bot-local projection)
  is unchanged.

### 8. Per-path `on-watch` authorization

The agent door's blanket `?> =(src our)` moves into the path
dispatch: lens, gateway, and `/v1/automation/mirror` keep
`=(src our)`; `/v1/automation/tasks` accepts
`|(=(src our) =(`src owner.state))`. Rejection stays a crash (watch
nack), matching existing behavior.

## Risks / Trade-offs

- **Missed facts between kick and resubscribe** → the initial
  `%tasks` snapshot on resubscribe replaces the whole per-bot mirror,
  so gaps self-heal; deltas are an optimization, not the correctness
  mechanism.
- **Nacked watch leaves a bot unmirrored indefinitely** → visible
  slog. No kick can ever arrive on a dead subscription, so the manual
  recovery is re-poking `%trust-bot` (idempotent ensure-subscribed,
  guarded on `wex.bowl`); an automatic retry/backoff loop remains
  future work, same known gap as the `%activity` watch TODO.
- **Owner changes on the bot don't kick the old owner's
  subscription** → a replaced owner keeps receiving facts until
  kicked. Mitigation: `%configure` with a different owner kicks
  subscribers on `/v1/automation/tasks` that no longer match.
- **Fact volume on busy task sets** → deltas carry single tasks;
  equal-projection suppression stops harness re-submissions (the
  reconciler re-reads on every `cron_changed`, including
  execution-only events) from producing any facts at all.
- **Cross-ship exposure of task definitions** → only the configured
  owner is admitted; task definitions already flow to the owner
  conceptually (they own the bot), and no runtime/session data is in
  the type.

## Migration Plan

Deliberately minimal — released-state migration is follow-up work on
this branch:

1. Ships upgrade via normal desk update; released `state-0` migrates
   through the unchanged `state-0-to-1` path (empty mirror via the
   bunt).
2. Owner ships begin mirroring when `%trust-bot` establishes the
   watch and the bot's initial snapshot arrives; a ship whose
   trusted-bot set predates the upgrade re-pokes `%trust-bot` to
   start mirroring.
3. Rollback: standard desk rollback. The mirror is derived state —
   losing it costs nothing; it repopulates on the next subscribe.

## Open Questions

None — remaining unknowns (exact wire spellings, fixture shapes) are
implementation detail that doesn't affect specs or task breakdown.
