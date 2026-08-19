---
id: TASK-2
title: Land the kits prototype as the workspace behavior-package foundation
status: To Do
assignee: []
created_date: '2026-08-19 13:46'
updated_date: '2026-08-19 13:50'
labels:
  - workspaces
  - kits
milestone: m-1
dependencies: []
references:
  - PLAN.md
  - commit 0f5ebfc28
  - commit 12c2ae54b
priority: high
type: feature
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PLAN.md designates the unmerged kits prototype work (commits 0f5ebfc28 and 12c2ae54b) as the foundation of the workspace shift. It already models behavior packages, abstract places, schedules, setup, policy, group-blob configuration, installation, and sharing.

Bring this work onto develop as a reviewed, tested foundation: rebase/extract the kit model, installation flow, and group-blob configuration so later tasks (workspace descriptor, meal-planning kit, provisioning) can build on it. Discard prototype-only scaffolding that does not serve the workspace model.

This is infrastructure only — no user-facing onboarding or navigation changes belong in this task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Kit model (behavior package, places, schedules, setup, policy) is available on develop as importable shared code
- [ ] #2 A kit can be installed into a group and its configuration persists in the group blob
- [ ] #3 Unit tests cover kit parsing, installation, and configuration persistence including malformed input
- [ ] #4 A docs/ page describes the kit format and installation lifecycle
- [ ] #5 No user-facing UI changes ship in this task
<!-- AC:END -->
