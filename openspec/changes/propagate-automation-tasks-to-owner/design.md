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
- One wire format for the whole automation surface (feed and scry),
  usable directly by HTTP clients as JSON.
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

### 1. One feed under the module namespace

- `/v1/automation/tasks` — the single automation feed, pairing 1:1
  with the `/x/v1/automation/tasks` scry. Admits the local ship and
  the configured owner. Initial fact: exactly one `%tasks` snapshot
  of the complete ship-keyed map, empty map included. Subsequent
  facts: ship-attributed `%set`/`%del`/`%gone`. An entry appearing
  (inexpressible as task deltas, tasks or not) is conveyed by a
  fresh full snapshot; snapshots are always full replacements.
- Bare `/v1/automation` binds nothing; `/v1/automation/mirror` no
  longer exists.

Merging the legs revisits the earlier transitive-relay rejection:
the producer-side structural guarantee is replaced by a
consumer-side rule — the owner applies only content attributed to
the subscription's wire ship (decision 5). In practice a bot's feed
carries only its own entry (bots trust no bots), so the merged feed
leaks nothing; the rule turns that from an accident into an
invariant. The full-map initial snapshot is what makes
reconciliation sound: absence of an entry in the snapshot means
deletion, which per-entry initial facts could never express.

### 2. One attributed update union, one mark

In `sur/steward/automation.hoon`:

```hoon
::  $tasks: one ship's task map
+$  tasks  (map @t task)
::  $update: the single automation feed; every variant names the
::  ship whose entry it touches, and %tasks is always the complete
::  ship-keyed state
+$  update
  $%  [%tasks tasks=(map ship tasks)]   ::  complete snapshot
      [%set =ship id=@t =task]          ::  task added/changed
      [%del =ship id=@t]                ::  task removed
      [%gone =ship]                     ::  entry removed (untrust)
  ==
```

`%gone` exists because presence semantics distinguish an empty entry
("synced, zero tasks") from an absent one. The `task-map` and
`mirror-map` aliases and the `mirror-update` union are retired; the
field is `ship`, not `bot` — entries belong to ships (the local one
included), "bot" is a role.

One mark, `%steward-automation-update-1`, serves the feed and the
scry: the scry returns the `%tasks` variant, lens-style, so clients
share a single parser for reads and subscriptions. Its JSON wraps
the ship-keyed object under the `tasks` variant key — the wrapper is
the union tag, kept because other variants exist (the same argument
as the `%project` action JSON). Attribution moving back into the
payload trades the producer-side relay guarantee for one endpoint;
the receiver-side wire-ship check in decision 5 covers it.

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
`%untrust-bot` it leaves the subscription unconditionally — a
`%leave` with no live subscription is harmless, and simpler than
guarding — and deletes that bot's entry, emitting `%gone` on the
feed. Untrusting the local ship is a set-only no-op for automation:
there is no subscription to leave and the `our` entry is
`%project`-owned, never deleted by trust changes. Deleting a remote
entry matters because a stale mirror of
an untrusted bot would misrepresent "bots we manage"; lens keeps runs
on untrust because runs are history — the mirror is current state,
so it goes. Wire: `/automation/tasks/(scot %p bot)`, matching the
watched path with the target bot appended. On `%kick`:
resubscribe only if the bot is still trusted. On watch-nack: slog and
keep existing mirrored state.

Alternative considered: a separate automation-specific bot registry.
Rejected — `bots` already means "ships whose steward data I accept",
and a second admin surface would drift from it.

There is deliberately no self-subscription. Subscription machinery
pays for transport and gap-repair across ships; the local projection
already lives in the same agent state, so a self-watch would only
round-trip through Gall to rewrite state it already owns.
`%trust-bot` of the local ship creates no watch — a self-owned bot
works with `%configure owner=our` alone; `%project` writes its
mirror entry directly (decision 6).

### 5. Scoped snapshot replace, wire-ship guard

On a `%tasks` fact from a bot, the owner replaces that bot's entry
with the bot's entry in the received map — deleting its entry when
the snapshot lacks it (this is what repairs a wiped bot after
kick/resubscribe). Content attributed to any ship other than the
subscription's wire ship is ignored: the receiver-side transitive
relay guard (decision 1). On `%set`/`%del` it upserts/deletes;
`%del` of an unknown ID is a no-op, and a delta for a ship with no
entry is ignored rather than creating one. Every applied change
re-emits on the same `/v1/automation/tasks` feed, ship-attributed.
`%project` is simply the local writer of the `our` entry — a
snapshot-replace with delta computation, exactly parallel to a
received snapshot fact. An entry appearing is
inexpressible as task deltas, so it emits a fresh full snapshot
(snapshots are always full replacements to subscribers). A snapshot
or projection that leaves stored state unchanged emits nothing.

### 6. Reshape branch-only `state-1`; defer migration work

`state:v1:sa` is a single `tasks=(map ship tasks)`: the local
projection lives under `our`, mirrored bots under their ships. The writers are disjoint by
construction — `%project` writes only `our`; subscription facts
write only the subscribed bot, never `our` — which is what dissolves
the original tasks/mirror separation rationale (authority split and
writer collision). Unifying also gives every entry one presence
rule (absent until first projection/snapshot, possibly-empty after)
with no tracking flag. The feed and the scry both serve the whole
map; `%project` reads and writes the `our` entry (empty map when
absent). The agent's
`versioned-state` stays `$%(state-1 state-0)` and the existing
`state-0-to-1` migration needs no edit: it initializes the automation
module from the bunt (`*state:v1:sa`), which yields an empty
mirror. Beyond that incidental effect,
this change makes no released-state migration commitments: the
migration spec requirement is untouched, and upgraded owner ships are
not auto-subscribed to previously trusted bots — mirroring starts
only from an explicit `%trust-bot` poke. Migration behavior is
finalized in follow-up work on this branch, once the module's state
shape stops moving.

### 7. Marks and scry

- `desk/mar/steward/automation/update-1.hoon` — the single
  automation mark, carrying `update`; noun grad; JSON grow and grab
  via `desk/lib/steward/automation-json.hoon`, reusing the task
  codecs. Ships as `s+(scot %p ship)` / `(se %p)` in delta variants
  and as object keys in `%tasks`; tagged-union JSON via
  `of`/`ot`/`frond`. Example shapes:
  `{ "tasks": { "~zod": { "<id>": { ... } } } }` (empty:
  `{ "tasks": {} }`), `{ "set": { "ship": "~zod", "id": "...",
  "task": { ... } } }`, `{ "del": { "ship": "~zod", "id": "..." } }`,
  `{ "gone": { "ship": "~zod" } }`.
- The scry `/x/v1/automation/tasks` returns this mark's `%tasks`
  variant (lens-style: scries reuse the update mark). `task-map-1`,
  `mirror-1`, and `mirror-map-1` are retired along with
  `/x/v1/automation/mirror`.

### 8. Per-path `on-watch` authorization

The agent door's blanket `?> =(src our)` moves into the path
dispatch: lens and gateway keep
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
