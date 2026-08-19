---
id: TASK-23
title: Offer the recurring schedule contextually after the first result
status: To Do
assignee: []
created_date: '2026-08-19 13:50'
labels:
  - workspaces
  - onboarding
  - agent
milestone: m-1
dependencies:
  - TASK-22
references:
  - PLAN.md
priority: medium
type: feature
ordinal: 6200
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PLAN.md: the recurring schedule is offered only after the first result — never during onboarding. Scheduled agent work already exists but is "not activation-friendly."

After the first durable artifact completes, the workspace offers to activate the kit's recurring schedule (e.g., weekly meal-plan refresh) in context. Accepting activates the schedule defined by the kit and records it in the workspace descriptor; declining leaves the workspace fully functional. The live review checklist also requires scheduling a test follow-up a few minutes out, so the offer flow must support a near-term run for verification.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The schedule offer appears in the workspace conversation only after the first artifact completes, never before or during onboarding
- [ ] #2 Accepting activates the kit-defined schedule and the next scheduled action becomes visible in the workspace
- [ ] #3 Declining or dismissing leaves the workspace working normally and does not re-prompt aggressively
- [ ] #4 A scheduled run actually executes at the scheduled time and produces/updates the artifact (verifiable with a near-term test schedule)
- [ ] #5 Tests cover offer timing, accept, and decline paths
<!-- AC:END -->
