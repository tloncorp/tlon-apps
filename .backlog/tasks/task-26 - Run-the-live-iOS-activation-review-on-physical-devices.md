---
id: TASK-26
title: Run the live iOS activation review on physical devices
status: To Do
assignee: []
created_date: '2026-08-19 13:50'
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
