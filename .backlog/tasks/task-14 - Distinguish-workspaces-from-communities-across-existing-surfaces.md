---
id: TASK-14
title: Distinguish workspaces from communities across existing surfaces
status: To Do
assignee: []
created_date: '2026-08-19 13:48'
labels:
  - workspaces
  - navigation
milestone: m-2
dependencies:
  - TASK-8
references:
  - PLAN.md
priority: medium
type: feature
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PLAN.md: existing social groups remain as Communities or Chats; only groups carrying the workspace descriptor receive the new app-shaped treatment. This avoids a disruptive migration.

Make the workspace/community split real in the client: everywhere groups are listed, routed, or previewed, descriptor-carrying groups are classified and routed as workspaces while all other groups keep today's exact behavior. This classification is the substrate the Workspace IA tasks (root navigation, home cards, workspace interior) build on.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A group carrying a workspace descriptor is classified and routed as a workspace wherever groups appear (lists, search, deep links, previews)
- [ ] #2 Groups without a descriptor are visually and behaviorally identical to today
- [ ] #3 Receiving an invitation to a workspace and to a community each route to the appropriate experience
- [ ] #4 A descriptor appearing or disappearing on a synced group updates its classification without requiring app restart
- [ ] #5 Tests cover classification, routing, and the no-descriptor unchanged path
<!-- AC:END -->
