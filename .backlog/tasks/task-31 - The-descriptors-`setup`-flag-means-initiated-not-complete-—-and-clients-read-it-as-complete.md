---
id: TASK-31
title: >-
  The descriptor's `setup` flag means "initiated", not "complete" — and clients
  read it as complete
status: To Do
assignee: []
created_date: '2026-08-20 21:02'
updated_date: '2026-08-22 13:01'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-08-21: Two adjacent fixes landed, but the semantic wart this task names still stands. 6cb1e2b25d means the flag now actually FLIPS (before, the setup-done poke crashed on the host lookup and every install stayed pending forever) — which immediately exposed this task's misread in the wild: the empty-workspace notice showed 'Nothing here yet' during the agent's working window because setup:done arrives at schedule time. 032cfe07aa patches the client symptom (the in-session provisioning task rows now win over the ledger while a live run exists) — but a client with no in-memory run (relaunch mid-setup, second device) still misreads the flag. The real fix remains: mark setup done when the agent's turn COMPLETES, which needs a turn-completion hook in the openclaw kits runtime; the relay protocol to carry it to the host now exists.
<!-- SECTION:NOTES:END -->
