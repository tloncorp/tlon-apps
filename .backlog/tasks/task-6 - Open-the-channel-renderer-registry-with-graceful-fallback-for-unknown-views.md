---
id: TASK-6
title: Open the channel renderer registry with graceful fallback for unknown views
status: To Do
assignee: []
created_date: '2026-08-19 13:47'
updated_date: '2026-08-19 13:50'
labels:
  - workspaces
  - platform
  - renderer
milestone: m-3
dependencies: []
references:
  - PLAN.md
  - packages/api/src/types/models.ts
  - packages/app/ui/contexts/componentsKits/ComponentsKitProvider.tsx
priority: low
type: enhancement
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PLAN.md notes the renderer architecture is conceptually ready for extension but its channel types (packages/api/src/types/models.ts) and component registry (packages/app/ui/contexts/componentsKits/ComponentsKitProvider.tsx) are closed and hard-coded. The platform milestone requires opening the registry so kits can contribute views, with graceful fallback when a client encounters a view it does not recognize.

This unblocks kit-defined surfaces without requiring an app release per new view type.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A kit or workspace descriptor can declare a view/renderer that is not hard-coded in the static registry
- [ ] #2 Encountering an unknown view renders a graceful fallback (not a crash or blank screen) with a path to upgrade
- [ ] #3 Existing hard-coded channel renderers continue to work unchanged
- [ ] #4 Tests cover registered, unregistered, and malformed view declarations
- [ ] #5 docs/ describes how a kit registers a view and what the fallback contract is
<!-- AC:END -->
