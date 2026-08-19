---
id: TASK-4
title: Land agent task-progress rows in conversation
status: To Do
assignee: []
created_date: '2026-08-19 13:47'
updated_date: '2026-08-19 13:50'
labels:
  - workspaces
  - agent
  - ui
milestone: m-1
dependencies: []
references:
  - PLAN.md
  - commit 6ee72347e
priority: medium
type: feature
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PLAN.md calls for live task rows in conversation showing agent progress (e.g., "Drafting plan → Saving grocery list → Ready") as the post-onboarding engagement hook, and identifies the unmerged agent task rows work (commit 6ee72347e) as ready to use.

Bring the task-rows prototype onto develop so an agent working in a workspace conversation shows visible progress rows that update as work advances and resolve when done. This is what makes the 90-second first-artifact target feel alive rather than silent.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Agent work in a conversation renders as progress rows with distinct in-progress and completed states
- [ ] #2 Rows update live as the agent advances through steps and reach a terminal state when work completes or fails
- [ ] #3 State survives app restart: reopening the conversation shows the correct current row state
- [ ] #4 Rendering degrades gracefully on clients that do not recognize the row content
- [ ] #5 Tests cover row rendering for in-progress, completed, and failed states
<!-- AC:END -->
