# Tasks: Propagate Automation Tasks to Owner

## 1. Types and state

- [ ] 1.1 Add the un-attributed projection `update` union and the
      bot-attributed `mirror-update` union (`%tasks`/`%set`/`%del`)
      to `desk/sur/steward/automation.hoon` and extend the automation
      `state` with `mirror=(map ship (map @t task))`
- [ ] 1.2 Verify the reshaped state needs no migration edits: confirm
      the projection leg is still unreleased on `develop` (else stop
      and revisit the design) and that `state-0-to-1` still initializes
      the automation module from the bunt, now with an empty `mirror`

## 2. Bot-side broadcast

- [ ] 2.1 In `au-core`, diff old vs new task maps on an accepted
      `%project` and emit un-attributed `%set`/`%del` facts on
      `/v1/automation/tasks`; emit nothing when the maps are equal
- [ ] 2.2 Add the `/v1/automation/tasks` watch handler giving one
      initial `%tasks` snapshot fact
- [ ] 2.3 Move `on-watch` auth per-path: lens, gateway, and
      `/v1/automation/mirror` stay `=(src our)`;
      `/v1/automation/tasks` admits local ship and configured owner,
      rejecting others; kick stale subscribers on
      `/v1/automation/tasks` when core `%configure` changes the owner

## 3. Owner-side mirror

- [ ] 3.1 Subscribe to a bot's `/v1/automation/tasks` on `%trust-bot`
      on wire `/automation/tasks/(scot %p bot)`, guarding on a live
      subscription in `wex.bowl` (not trust-set membership) so a
      re-poke repairs a nacked watch without duplicating a live one;
      never self-subscribe — trusting the local ship creates no watch
      and no mirror entry; on `%untrust-bot`, leave the subscription
      if live and delete that bot's mirror entry
- [ ] 3.2 Handle the subscription in `++agent`, attributing each fact
      to the bot on the subscription wire (never a payload field):
      `%tasks` atomically replaces the per-bot mirror, `%set` upserts,
      `%del` removes (no-op on unknown ID); resubscribe on `%kick`
      only while the bot is still trusted; slog on watch-nack without
      touching state
- [ ] 3.3 Serve the combined view on `/v1/automation/mirror` as
      `mirror-update` facts: re-emit every mirror mutation, emit
      accepted `%project` changes attributed to `our`, and give
      per-bot `%tasks` snapshot facts (local projection when
      non-empty, plus each mirrored bot) as the initial state on
      subscribe

## 4. Marks and scry

- [ ] 4.1 Add per-feed update JSON codecs to
      `desk/lib/steward/automation-json.hoon` (ships via
      `scot %p`/`se %p` in mirror-update only; tagged union via
      `of`/`ot`/`frond`; reuse existing task codecs) and create
      `desk/mar/steward/automation/update-1.hoon` and
      `desk/mar/steward/automation/mirror-1.hoon`
- [ ] 4.2 Create `desk/mar/steward/automation/mirror-map-1.hoon` growing
      `{ "mirror": { "~ship": { "<id>": ... } } }` and add the
      `/x/v1/automation/mirror` scry to `au-peek`, composing the
      mirror with the local projection (under `our`, when non-empty)

## 5. Tests

- [ ] 5.1 Bot side: subscribe yields the current snapshot;
      changed/equal `%project` emits correct deltas/nothing; watch
      auth exercised under real sources via `do-as` — owner admitted
      cross-ship, stranger and owner-less remote rejected — plus the
      local baseline (a local-src watch alone proves nothing about
      the owner relaxation)
- [ ] 5.2 Owner side: trust subscribes and untrust leaves+clears;
      snapshot replace, `%set`/`%del` application, unknown-ID `%del`
      no-op; kick resubscribes and snapshot repairs the mirror;
      re-poked `%trust-bot` resubscribes after a nack and does not
      duplicate a live subscription;
      client path delivers initial per-bot snapshots then deltas;
      self-owned: local projection served on the client path
      attributed to `our` with no self-subscription, and
      `%trust-bot` of the local ship is a no-op
- [ ] 5.3 State: fresh init has an empty mirror and the existing
      released-state migration test still passes with the reshaped
      automation state (no new migration behavior)
- [ ] 5.4 Marks: JSON grow/grab round-trips for all three variants of
      both update marks (projection un-attributed, mirror-update
      bot-attributed) and for the mirror scry mark, including the
      empty-mirror shape

## 6. Docs and validation

- [ ] 6.1 Update `docs/backend/desk/app/steward.md`: automation
      subscription surface, update/mirror marks and JSON shapes,
      mirror scry, per-path watch auth, state model — removing the
      now-stale "automation has no subscription" statements
- [ ] 6.2 Run the agent test suite and `openspec validate --strict`
      for this change
