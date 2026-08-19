---
id: TASK-25
title: >-
  Instrument the activation funnel (time to workspace, first action, first
  artifact, invitation)
status: To Do
assignee: []
created_date: '2026-08-19 13:50'
labels:
  - workspaces
  - analytics
milestone: m-1
dependencies:
  - TASK-16
  - TASK-22
references:
  - PLAN.md
  - branch agent-onboarding-v2
priority: medium
type: task
ordinal: 6600
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PLAN.md activation milestone requires instrumentation for four funnel measures: time to workspace (interstitials + provisioning complete), time to first user action, time to first durable artifact, and invitation (offered/sent/accepted). These are the numbers that decide whether the 90-second target and the activation loop are working.

Reuse the telemetry patterns retained from the agent-onboarding-v2 work where applicable, and follow the app's existing analytics conventions rather than inventing a parallel event system.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Events fire for onboarding start, each interstitial completion, provisioning completion, landing, first user action, first artifact completion, and invitation offered/sent/accepted
- [ ] #2 Each event carries enough context to compute the four funnel durations per user without joining external data
- [ ] #3 Failure and abandonment paths (provisioning failure, app killed mid-flow) are distinguishable from success in the funnel
- [ ] #4 No message content or artifact content is included in analytics payloads
- [ ] #5 A dashboard or documented query exists for the four funnel measures
<!-- AC:END -->
