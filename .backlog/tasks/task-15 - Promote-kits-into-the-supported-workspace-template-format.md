---
id: TASK-15
title: Promote kits into the supported workspace-template format
status: To Do
assignee: []
created_date: '2026-08-19 13:48'
labels:
  - workspaces
  - platform
  - kits
milestone: m-3
dependencies:
  - TASK-2
references:
  - PLAN.md
priority: low
type: enhancement
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Platform-milestone hardening from PLAN.md: after the activation loop proves out with the internally-built meal-planning kit, promote the kit format from an internal mechanism into the supported workspace-template format that third parties can author, share, and install.

This covers format stabilization and versioning, authoring documentation, validation of untrusted kit definitions, and an install/share flow that does not require the recipient to trust the author's code (signing and capability grants are a separate dependent task).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The kit format is versioned and documented well enough for a third party to author a working kit from docs alone
- [ ] #2 An externally-authored kit definition is validated before install; invalid or hostile definitions are rejected with a clear error
- [ ] #3 A kit can be shared to and installed by another ship/user
- [ ] #4 Format changes are backward compatible or carry an explicit migration path for installed kits
- [ ] #5 Tests cover validation, install, share, and version-mismatch handling
<!-- AC:END -->
