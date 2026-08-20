---
id: TASK-26
title: Run the live iOS activation review on physical devices
status: To Do
assignee: []
created_date: '2026-08-19 13:50'
updated_date: '2026-08-20 16:27'
labels:
  - workspaces
  - qa
milestone: m-1
dependencies:
  - TASK-10
  - TASK-12
  - TASK-22
  - TASK-23
  - TASK-24
references:
  - PLAN.md
priority: medium
type: task
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The acceptance gate for the activation milestone, from PLAN.md ("Galen's live iOS review"): run the full loop on a fresh physical iPhone with screen mirroring and a second real account, exercising the failure modes that kill activation.

The decisive test is not whether onboarding completes — it is whether a reviewer can say within two minutes: "We now have a useful shared thing, it remembers, and the agent is already doing work inside it." Findings become new bug tasks; this task is the structured pass itself.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Kill and reopen the app after each interstitial: flow resumes correctly both times
- [ ] #2 Background the app during provisioning: workspace completes intact
- [ ] #3 Tap a card action twice: state changes exactly once
- [ ] #4 Open the same card on a second physical device: state is identical after sync
- [ ] #5 Create, share, accept, and collaborate in a workspace across the two accounts
- [ ] #6 First durable artifact appears in under 90 seconds
- [ ] #7 Schedule a test follow-up a few minutes out and observe it run
- [ ] #8 All findings are filed as Backlog tasks and the pass/fail per checklist item is recorded on this task
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Carried acceptance criteria from earlier tasks

Running list of ACs closed elsewhere as "built and tested, not observed". Each is code that exists with tests at every layer, whose criterion asks for behaviour on real devices. This is the list to work through here — not a list of suspected bugs.

**TASK-10 — interactive cards** (client `5fafe613cd`, agent `b860aecdb2`)
- AC #3: a tap's optimistic spinner reconciling against a *real* agent edit. Never seen clearing on a real edit — in cosmos there is no ship, so `sendReply` 404s and pending clears instantly.
- AC #5: two devices showing identical card state after the agent's edit syncs. Every test on both sides runs in one process with mocked I/O. `pnpm test:integration` in `packages/openclaw` spins ephemeral fakezods and is the thing that would demonstrate it.

**TASK-27 — kit places on third-party hosts** (`e9ebb3675c`)
- AC #3: a second ship reading a `%notes`-backed place created by an install. Single-ship verification only.

**TASK-13 — meal-plan kit** (`253ef711ee`)
- AC #3: the starter artifact actually arriving — a plan and grocery list in the notebook, one message in the kitchen — which needs a live agent following `instructions/setup.md`. The kit content is asserted by tests; nothing has executed it.

**TASK-16 — background provisioning**
- AC #4: backgrounding the app mid-provisioning. An OS lifecycle behaviour with no unit-test analogue. What *is* tested is that the state machine has no step that is only safe if the process stays alive — every transition is a durable write followed by an idempotent action — but that is an argument, not an observation.
- AC #3's real-device half: killing and reopening the app mid-provisioning. The resume decision table is exhaustively unit-tested against a faked ledger; nobody has killed a real app mid-install.
<!-- SECTION:NOTES:END -->
