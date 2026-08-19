---
id: TASK-13
title: Build the meal-planning workspace kit
status: To Do
assignee: []
created_date: '2026-08-19 13:48'
labels:
  - workspaces
  - kits
milestone: m-1
dependencies:
  - TASK-1
  - TASK-2
  - TASK-8
references:
  - PLAN.md
priority: high
type: feature
ordinal: 2800
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The hero activation kit from PLAN.md: weekly meals and grocery list. Meal planning is the recommended first wedge because it is immediately generative, naturally collaborative, produces a visible durable artifact, and supports recurring behavior without integrations. If the capability-matrix spike selected a different hero, build that instead — the shape is the same.

The kit (in the format landed by the kit-foundation task) defines the workspace's purpose and agent behavior, its named places (one primary conversation, one durable artifact store initially backed by %notes), the starter artifact the agent produces on first run, and the recurring schedule that is offered only after the first result — never during onboarding.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Kit installs into a workspace group and writes its configuration into the workspace descriptor
- [ ] #2 Kit defines a primary conversation and a durable artifact place backed by notes
- [ ] #3 On first run the agent produces a durable starter artifact (a meal plan / grocery list) visible in the workspace
- [ ] #4 A recurring schedule is defined by the kit but not activated until offered after the first result
- [ ] #5 Kit content (prompts, copy, artifact templates) contains no provider- or model-specific configuration
- [ ] #6 Tests cover kit installation and descriptor contents
<!-- AC:END -->
