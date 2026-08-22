---
id: TASK-14
title: Distinguish workspaces from communities across existing surfaces
status: To Do
assignee: []
created_date: '2026-08-19 13:48'
updated_date: '2026-08-22 13:01'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-08-21: Deliberate drift to flag before picking this up — TASK-37 renamed ALL user-facing 'group' copy to 'workspace' (146866d934), including plain communities, to make the demo read coherently. That is the opposite of this task's premise (workspaces and communities as distinct concepts with distinct labels). When this task starts, the rename needs revisiting: either communities get their own label back on descriptor-less groups, or the product decision is that everything is a workspace and this task collapses into presentation differences (kit-backed vs plain). The detection helper (readWorkspaceDescriptor/isWorkspace) is in place and already drives the pinned-surface interior, the setup notice, and the landing flow.
<!-- SECTION:NOTES:END -->
