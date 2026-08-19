---
id: TASK-8
title: Add the workspace descriptor to the group blob and detection helpers
status: To Do
assignee: []
created_date: '2026-08-19 13:47'
labels:
  - workspaces
  - kits
milestone: m-1
dependencies:
  - TASK-2
references:
  - PLAN.md
priority: high
type: feature
ordinal: 2500
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PLAN.md defines a workspace as a secret group carrying a workspace descriptor stored in the group blob: kit identity, agent identities, named places, setup status, schedules, and permissions. Only groups carrying this descriptor receive the new app-shaped treatment; existing social groups remain Communities/Chats untouched, avoiding a disruptive migration.

Building on the kit foundation's group-blob configuration, define the descriptor schema and shared helpers so any client surface can ask "is this group a workspace?" and read its kit, places, agents, setup status, and schedules. This descriptor is what onboarding provisioning writes and what the Workspace IA milestone keys off.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Workspace descriptor schema (kit identity, agent identities, named places, setup status, schedules, permissions) is defined and typed in shared code
- [ ] #2 Shared helpers exist to detect whether a group is a workspace and to read/update descriptor fields
- [ ] #3 Groups without a descriptor are completely unaffected — no behavior or rendering change for existing groups
- [ ] #4 A malformed or partial descriptor fails safe: the group is treated as a plain group, not a broken workspace
- [ ] #5 Tests cover descriptor round-trip, detection, and malformed-descriptor handling
<!-- AC:END -->
