# Tasks: Propagate Automation Tasks to Owner

## 1. Types and state

- [x] 1.1 Add the un-attributed projection `update` union
      (`%tasks`/`%set`/`%del`) and the bot-attributed `mirror-update`
      union (`%tasks`/`%set`/`%del`/`%gone`)
      to `desk/sur/steward/automation.hoon` and replace the automation
      `state`'s flat task map with `mirror=(map ship (map @t task))`
      (local projection under `our`, mirrored bots under their ships)
- [x] 1.2 Verify the reshaped state needs no migration edits: confirm
      the projection leg is still unreleased on `develop` (else stop
      and revisit the design) and that `state-0-to-1` still initializes
      the automation module from the bunt, now with an empty `mirror`

## 2. Bot-side broadcast

- [x] 2.1 In `au-core`, write an accepted `%project` to `mirror[our]`,
      diffing old vs new to emit un-attributed `%set`/`%del` facts on
      `/v1/automation/tasks` (nothing when equal); point the existing
      `/x/v1/automation/tasks` scry at `mirror[our]` (empty map when
      absent)
- [x] 2.2 Add the `/v1/automation/tasks` watch handler giving one
      initial `%tasks` snapshot fact
- [x] 2.3 Move `on-watch` auth per-path: lens, gateway, and
      `/v1/automation/mirror` stay `=(src our)`;
      `/v1/automation/tasks` admits local ship and configured owner,
      rejecting others; kick stale subscribers on
      `/v1/automation/tasks` when core `%configure` changes the owner

## 3. Owner-side mirror

- [x] 3.1 Subscribe to a bot's `/v1/automation/tasks` on `%trust-bot`
      on wire `/automation/tasks/(scot %p bot)`, guarding on a live
      subscription in `wex.bowl` (not trust-set membership) so a
      re-poke repairs a nacked watch without duplicating a live one;
      never self-subscribe — trusting the local ship creates no watch
      and no mirror entry; on `%untrust-bot`, leave the subscription
      unconditionally, delete that bot's mirror entry, and emit
      `%gone` on the client feed (local ship: set-only no-op, no
      leave, `mirror[our]` untouched); a mirror entry is created only
      by a bot's first snapshot fact, never by subscribing
- [x] 3.2 Handle the subscription in `++agent`, attributing each fact
      to the bot on the subscription wire (never a payload field):
      `%tasks` atomically replaces the per-bot mirror, `%set` upserts,
      `%del` removes (no-op on unknown ID); resubscribe on `%kick`
      only while the bot is still trusted; slog on watch-nack without
      touching state
- [x] 3.3 Serve the mirror on `/v1/automation/mirror` as
      `mirror-update` facts: re-emit every mirror mutation, emit
      accepted `%project` changes attributed to `our`, and give one
      `%tasks` snapshot fact per mirror entry as the initial state on
      subscribe

## 4. Marks and scry

- [x] 4.1 Add per-feed update JSON codecs to
      `desk/lib/steward/automation-json.hoon` (ships via
      `scot %p`/`se %p` in mirror-update only; tagged union via
      `of`/`ot`/`frond`; reuse existing task codecs) and create
      `desk/mar/steward/automation/update-1.hoon` and
      `desk/mar/steward/automation/mirror-1.hoon`
- [x] 4.2 Create `desk/mar/steward/automation/mirror-map-1.hoon` growing
      the bare ship-keyed object `{ "~ship": { "<id>": ... } }` (empty
      mirror: `{}`) and add the `/x/v1/automation/mirror` scry to
      `au-peek`, growing the mirror directly

## 5. Tests

- [x] 5.1 Bot side: subscribe yields the current snapshot;
      changed/equal `%project` emits correct deltas/nothing; watch
      auth exercised under real sources via `do-as` — owner admitted
      cross-ship, stranger and owner-less remote rejected — plus the
      local baseline (a local-src watch alone proves nothing about
      the owner relaxation)
- [x] 5.2 Owner side: trust subscribes and untrust leaves+clears;
      snapshot replace, `%set`/`%del` application, unknown-ID `%del`
      no-op; kick resubscribes and snapshot repairs the mirror;
      re-poked `%trust-bot` resubscribes after a nack and does not
      duplicate a live subscription;
      client path delivers initial per-bot snapshots then deltas;
      self-owned: local projection served on the client path
      attributed to `our` with no self-subscription, and
      `%trust-bot`/`%untrust-bot` of the local ship are automation
      no-ops; untrust emits `%gone` and untrust-before-first-snapshot
      leaves without ever creating an entry; kick after untrust does
      not resubscribe; equal local `%project` emits nothing on either
      feed and a first empty `%project` creates the `our` entry with
      an empty snapshot fact to clients
- [x] 5.3 State: fresh init has an empty mirror and the existing
      released-state migration test still passes with the reshaped
      automation state (no new migration behavior)
- [x] 5.4 Marks: JSON grow/grab round-trips for every variant of
      both update marks (projection un-attributed; mirror feed
      bot-attributed including `%gone`) and for the mirror scry mark,
      including the empty-mirror shape

## 6. Docs and validation

- [x] 6.1 Update `docs/backend/desk/app/steward.md`: automation
      subscription surface, update/mirror marks and JSON shapes,
      mirror scry, per-path watch auth, state model — removing the
      now-stale "automation has no subscription" statements
- [x] 6.2 Run the agent test suite and `openspec validate --strict`
      for this change

## 7. Unified automation surface

- [x] 7.1 sur: add `+$ tasks (map @t task)`; state becomes
      `tasks=(map ship tasks)`; single attributed `update` union
      (`%tasks` full ship-keyed map, `%set`/`%del`/`%gone` naming
      `ship`); retire `task-map`, `mirror-map`, and `mirror-update`
- [x] 7.2 app: single `/v1/automation/tasks` watch (local +
      configured owner) giving exactly one full-map `%tasks` initial
      fact (empty included); all deltas emitted there
      ship-attributed; an entry appearing empty emits a fresh full
      snapshot; equal `%project` silent; remove
      `/v1/automation/mirror`; owner apply becomes wire-ship-scoped —
      apply only wire-ship-attributed content, snapshot replaces that
      ship's entry (deleting it when the snapshot lacks it), deltas
      ignored for absent entries
- [x] 7.3 marks/lib: reshape `update-1` codecs to the new union
      (ships as object keys in `%tasks`, `ship` field in deltas);
      scry `/x/v1/automation/tasks` returns the mark's `%tasks`
      variant; delete `/x/v1/automation/mirror` and marks
      `task-map-1`, `mirror-1`, `mirror-map-1`
- [x] 7.4 tests: rework the suite to the unified surface; add
      wiped-entry repair (snapshot lacking the entry clears it) and
      foreign-attributed-content-ignored coverage; update mark
      round-trip fixtures
- [x] 7.5 docs: update `docs/backend/desk/app/steward.md` automation
      sections to the single feed/scry/mark
- [x] 7.6 Revalidate: agent suite on the ship, `openspec validate
      --strict`, owner-first deploy
