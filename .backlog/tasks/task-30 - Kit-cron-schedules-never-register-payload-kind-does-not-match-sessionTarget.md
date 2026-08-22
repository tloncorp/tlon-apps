---
id: TASK-30
title: 'Kit cron schedules never register: payload kind does not match sessionTarget'
status: Done
assignee: []
created_date: '2026-08-20 21:01'
updated_date: '2026-08-22 13:00'
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
- [x] #1 Installing a kit that declares a schedule produces no cron reconcile error
- [x] #2 A registered kit cron job's payload kind matches its sessionTarget, per the host's constraint
- [x] #3 The scheduled turn is delivered into the kit's primary place when it fires, with the kit's on-trigger instruction as its content
- [x] #4 A test covers the sessionTarget/payload pairing so the wrong combination fails in CI rather than at runtime on a ship
- [ ] #5 Reconcile failures are surfaced rather than logged and swallowed — a schedule that cannot register should be visible
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed on the branch (session-targeted kit cron jobs now carry agentTurn payloads with the kit's on-trigger instruction as the message; schedules.test.ts:167 asserts the host's pairing rule so the wrong combination fails in CI). Verified live 2026-08-21 on the dev rig: every meal-plan install logs "kits: added cron job tlon:kit:…:weekly-plan" and "cron reconcile added=1" with no pairing error, the jobs land enabled in the gateway's cron store (0 17 * * 5), and the same session-targeted cron mechanism (the one-shot 'at' variant used for kit setup) demonstrably delivers turns into the kit's primary place — today's setup conversations all arrived that way. AC #5 (surfacing reconcile failures beyond error logs) deliberately not done — reconcile errors still log-and-continue; fold that visibility work into TASK-23 when schedules become user-facing.
<!-- SECTION:FINAL_SUMMARY:END -->
