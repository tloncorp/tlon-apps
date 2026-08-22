---
id: TASK-31
title: >-
  The descriptor's `setup` flag means "initiated", not "complete" — and clients
  read it as complete
status: To Do
assignee: []
created_date: '2026-08-20 21:02'
updated_date: '2026-08-22 20:39'
labels:
  - openclaw
  - workspaces
  - kits
  - onboarding
dependencies: []
priority: high
type: bug
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`setup` in the kit install descriptor carries two meanings that have drifted apart, and the client half assumes the wrong one.

`packages/openclaw/src/kits/setup.ts:120` pokes `setup-done` immediately after `enqueueSystemEvent`, before the enqueued turn has run. Its module comment is explicit that this is deliberate: the poke is the **durable fire-once guard** ("the `setup-done` poke closes the loop durably on the ship"), complementing an in-process `sharedMap`. So `setup: "done"` means "setup was initiated and will not fire again", not "the agent has produced anything".

Observed live: installing meal-plan on the walkthrough rig left `setup: "done"` in the ledger with an **empty notebook** and nothing posted to the chat place.

`isWorkspaceSetupComplete` (`packages/shared/src/logic/workspaceDescriptor.ts`) reads it as completion, and TASK-22's landing notice branches on it — so a user landing while setup is genuinely in flight sees "Nothing here yet" instead of "Setting up your workspace…". That is my wrong assumption in TASK-22, not openclaw misbehaving.

The design question this carries: one flag cannot serve as both an idempotency guard and a progress signal. Moving the poke to after the turn completes would fix the meaning but lose the durable guard — a process restart between enqueue and completion would re-fire setup and double-post the starter artifact. So the options are roughly:

1. **Separate the two.** Keep a durable "initiated" marker for idempotency and add a distinct completion signal the client can read. Most correct; needs a new field or marker and a decision about where it lives.
2. **Stop reading `setup` as completion on the client.** An empty workspace conversation already means "the agent has not posted yet" — the landing notice only renders when the channel is empty, so the `setup` branch may be redundant. Smallest change; loses the ability to distinguish "setup coming" from "setup failed".
3. **Rename the field** to match what it means (`setupInitiated`) so no future reader repeats the mistake, whichever of the above is chosen.

Worth noting the failure mode option 1 protects against: if the enqueued turn never runs, nothing retries, because both guards have already closed. A workspace can sit permanently with `setup: "done"` and no artifact.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A reader can distinguish "setup has not started", "setup is in flight", and "setup produced its artifact"
- [ ] #2 The landing notice says setup is in progress while it genuinely is, and says something honest when it has failed
- [ ] #3 Setup still cannot double-fire across a process restart
- [ ] #4 A workspace whose setup turn never ran is detectable rather than indistinguishable from a completed one
- [ ] #5 Whatever the field ends up meaning, its name says so
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation plan (researched 2026-08-22)

**Design: split the flag into a real three-state lifecycle — `%pending → %fired → %done` — with the completion edge driven by the gateway's own turn-completion signal, not the model.**

The missing piece the task's option 1 needed now exists in-tree: the plugin already subscribes to gateway diagnostic events (`onDiagnosticEvent` in packages/openclaw/index.ts), and `message.processed` fires at the end of every turn carrying the turn's `sessionKey` and `outcome`. A kit setup turn runs in a known session (`agent:…:tlon:group:<primary nest>`), so the kits runtime can mark completion when THAT event arrives — deterministic, no reliance on the model remembering a final step. Note: outcome is deliberately ignored for this edge — setup turns currently end `outcome=error` from the cron delivery-sink wart (TASK-33) even when all work landed, and "the turn finished executing" is what %done should mean; delivery-sink health is TASK-33's problem.

### Protocol / desk (`desk/sur/kits.hoon`, `desk/app/kits.hoon`, `desk/lib/kits-json.hoon`)
1. `setup=?(%pending %done)` → `?(%pending %fired %done)`; versioned state bump with an on-load migration (the state-0/install-0 pattern from TASK-32 is already in place; existing `%pending`/`%done` values carry unchanged).
2. New action `[%setup-fired =flag:g]`: same relay + agent-acceptance shape as `%setup-done` (relay to host when `our ≠ p.flag`, host accepts src ∈ agents, missing ledger no-ops). Sets `%fired` only from `%pending` (idempotent; a late-arriving `%fired` never demotes `%done`).
3. `%setup-done` unchanged except it also accepts the `%fired → %done` edge (and `%pending → %done` for compatibility with harnesses that never learned `%setup-fired`).
4. kits-json enjs/dejs: encode/decode the third value; tests in tests/lib/kits-json.

### Harness (`packages/openclaw/src/kits/setup.ts`, runtime wiring)
5. `maybeFireSetup`: the poke sent immediately after scheduling becomes `setup-fired` (this was always its true meaning — the durable fire-once guard). `shouldFireSetup` fires only on `%pending`, so `%fired` keeps guarding replays across restarts exactly as `%done` does today.
6. New: the kits runtime records fired setups (`sessionKey → flag`) and subscribes to `message.processed`; on the first event matching a fired session, poke `setup-done` (the relay carries it to the host). Persist the pending fired→done watchlist in the same shared-slot/config-reader machinery so a gateway restart between fire and completion re-arms the watch rather than losing the edge; a restart mid-turn leaves `%fired` — visible, not replayed (AC #4: a stuck workspace is distinguishable from a completed one).

### Client (`packages/shared`, `packages/app`)
7. `workspaceDescriptor.ts`: `isWorkspaceSetupComplete` reads `%done` only; new `isWorkspaceSetupUnderway` reads `%fired`. tlon-kits `groupConfig.ts` zod schema accepts the third value.
8. `EmptyChannelNotice`/`WorkspaceSetup` notice: `%fired` → the working state (live rows when this session ran provisioning, honest "agent is working" text otherwise — this finally fixes the cross-device/relaunch gap 032cfe07aa could not); `%pending` → "setting up" static; `%done` + empty channel → "Nothing here yet".

### Tests
9. Hoon: fired/done transitions, relay of both actions, fired-never-demotes-done, stranger rejection for `%setup-fired` (extend the TASK-32 arms; run via the screen-dojo recipe).
10. TS: setup.ts fire-poke is `setup-fired`; completion watch pokes `setup-done` on a matching `message.processed`; notice states for all three values.

### ACs → steps
- #1 three distinguishable states → protocol (1–3) + client (7)
- #2 honest landing notice → (8)
- #3 no double-fire across restart → (5): `%fired` is the durable guard
- #4 never-ran setup detectable → stuck `%fired` is visible and distinct from `%done`
- #5 name says what it means → `%fired` says initiated; `%done` now actually means done

Scope: desk (3 files + tests), kits-json, tlon-kits schema, openclaw setup/runtime (2 files + tests), shared logic + notice (2 files + tests). The largest of the three plans — protocol change with migration — but each layer follows an existing pattern.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-08-21: Two adjacent fixes landed, but the semantic wart this task names still stands. 6cb1e2b25d means the flag now actually FLIPS (before, the setup-done poke crashed on the host lookup and every install stayed pending forever) — which immediately exposed this task's misread in the wild: the empty-workspace notice showed 'Nothing here yet' during the agent's working window because setup:done arrives at schedule time. 032cfe07aa patches the client symptom (the in-session provisioning task rows now win over the ledger while a live run exists) — but a client with no in-memory run (relaunch mid-setup, second device) still misreads the flag. The real fix remains: mark setup done when the agent's turn COMPLETES, which needs a turn-completion hook in the openclaw kits runtime; the relay protocol to carry it to the host now exists.
<!-- SECTION:NOTES:END -->
