---
id: TASK-30
title: 'Kit cron schedules never register: payload kind does not match sessionTarget'
status: To Do
assignee: []
created_date: '2026-08-20 21:01'
labels:
  - openclaw
  - kits
  - workspaces
dependencies: []
priority: high
type: bug
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`reconcileKitCronJobs` cannot register any kit schedule. Observed live on the walkthrough rig — installing meal-plan logged the failure twice:

    kits: cron reconcile failed: Error: isolated/current/session cron jobs require payload.kind="agentTurn"

The host enforces a pairing between `sessionTarget` and `payload.kind` (`node_modules/openclaw/dist/jobs-CCfRfpGG.js:439-440`):

- `sessionTarget === "main"` requires `payload.kind === "systemEvent"`
- isolated / current / session targets require `payload.kind === "agentTurn"`

`packages/openclaw/src/kits/schedules.ts` violates it: `buildDesiredKitCronJobs` sets `sessionTarget: \`session:${sessionKey}\`` (line 86) so the kit's turn lands in the place's own session, while `toCronInput` (line 162) unconditionally emits `payload: { kind: 'systemEvent', text: job.payloadText }`. Every kit schedule therefore throws at creation.

The `systemEvent`/`agentTurn` choice is not cosmetic — it decides how the scheduled turn is delivered — so this needs the `agentTurn` payload shape filled in properly (model, delivery context) rather than the kind swapped and the text left where it is. Note `enqueueSystemEvent` in `src/kits/setup.ts` is a different mechanism and works; only the cron path is broken.

Invisible until now because the meal-plan kit declares its `weekly-plan` schedule `enabled: false` (TASK-13), so nothing was expected to fire — but the reconcile errors regardless of `enabled`, on every install and every reconcile pass. TASK-23 (offering the schedule contextually) would land on plumbing that has never worked.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Installing a kit that declares a schedule produces no cron reconcile error
- [ ] #2 A registered kit cron job's payload kind matches its sessionTarget, per the host's constraint
- [ ] #3 The scheduled turn is delivered into the kit's primary place when it fires, with the kit's on-trigger instruction as its content
- [ ] #4 A test covers the sessionTarget/payload pairing so the wrong combination fails in CI rather than at runtime on a ship
- [ ] #5 Reconcile failures are surfaced rather than logged and swallowed — a schedule that cannot register should be visible
<!-- AC:END -->
