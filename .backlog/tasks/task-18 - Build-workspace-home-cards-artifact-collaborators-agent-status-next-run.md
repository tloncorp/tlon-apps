---
id: TASK-18
title: 'Build workspace home cards (artifact, collaborators, agent status, next run)'
status: To Do
assignee: []
created_date: '2026-08-19 13:49'
labels:
  - workspaces
  - navigation
  - ui
milestone: m-2
dependencies:
  - TASK-14
references:
  - PLAN.md
priority: medium
type: feature
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PLAN.md: workspace home cards should show the artifact summary, collaborators, agent status, and next scheduled action — not the latest chat line. This is the card users see in the Workspaces destination for each workspace they belong to.

The data comes from the workspace descriptor (kit, schedules, setup status), group membership, and the durable artifact place. A workspace still provisioning or with a failed agent should read honestly rather than pretending readiness.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each workspace card shows an artifact summary, collaborator avatars/names, agent status, and the next scheduled action
- [ ] #2 Cards never show the latest chat message as their summary line
- [ ] #3 A still-provisioning workspace shows its setup state; a workspace whose agent is unavailable indicates that
- [ ] #4 Card content updates when the underlying artifact, membership, or schedule changes
- [ ] #5 Tests cover the ready, provisioning, and agent-unavailable card states
<!-- AC:END -->
