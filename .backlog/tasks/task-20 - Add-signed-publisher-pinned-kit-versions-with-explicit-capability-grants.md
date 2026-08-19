---
id: TASK-20
title: 'Add signed, publisher-pinned kit versions with explicit capability grants'
status: To Do
assignee: []
created_date: '2026-08-19 13:49'
labels:
  - workspaces
  - platform
  - security
milestone: m-3
dependencies:
  - TASK-15
references:
  - PLAN.md
priority: low
type: feature
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Platform-milestone security hardening from PLAN.md: before third-party kits circulate broadly, kit versions must be signed and pinned to a publisher, and installation must surface explicit capability grants (what the kit's agent behavior may read, write, and schedule) that the installer approves.

This is the trust story PLAN.md says the mini-app demo lacked; it gates any future move toward client-executed kit code.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A kit version carries a publisher signature that is verified at install time; tampered or unsigned kits are rejected
- [ ] #2 Kit upgrades are accepted only from the pinned publisher; a publisher change requires explicit user re-approval
- [ ] #3 Install and upgrade flows display the kit's requested capabilities and require approval before granting
- [ ] #4 A kit cannot exercise capabilities beyond its approved grant
- [ ] #5 Tests cover signature verification, publisher pinning, grant approval, and grant enforcement
<!-- AC:END -->
