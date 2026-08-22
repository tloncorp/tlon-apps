---
id: TASK-19
title: 'Workspace interior: app surface first, conversation second, channels hidden'
status: To Do
assignee: []
created_date: '2026-08-19 13:49'
updated_date: '2026-08-22 13:01'
labels:
  - workspaces
  - navigation
  - ui
milestone: m-2
dependencies:
  - TASK-14
references:
  - PLAN.md
  - packages/app/ui/components/GroupChannelsScreenView.tsx
priority: medium
type: feature
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PLAN.md: inside a workspace, show the app surface first and the conversation second, and hide the raw channel list unless advanced management is needed. Users should never need to understand that "Discussion" and "Meal Plan" are channels — they are views inside the workspace.

Today's group screen exposes a channel list (packages/app/ui/components/GroupChannelsScreenView.tsx). For descriptor-carrying groups, replace that with the workspace layout driven by the descriptor's named places; communities keep the existing channel-list screen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Opening a workspace lands on the app surface (pinned card/canvas summarizing current state) with the conversation one step away
- [ ] #2 Named places from the descriptor render as views without channel terminology anywhere in the primary UI
- [ ] #3 The raw channel list is reachable only through an advanced management affordance
- [ ] #4 Communities (no descriptor) keep the existing group channel-list screen unchanged
- [ ] #5 Works on both mobile and desktop/web layouts, with E2E coverage for the web workspace interior
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-08-21: The core of this landed via TASK-35 and TASK-38, ahead of this task's plan: kit channels declare tlon.r0.collection.pinnedSurface, the agent's interactive card owns the channel body full-bleed, and the conversation lives in a pull-up sheet over it (chat as the programming interface), with the composer docked below. What remains of this task is the 'channels hidden' third: the workspace still opens through the normal group shell (channel list sidebar on web, group screen on mobile) rather than presenting as a single app surface. Re-scope this task to that navigation/shell work when picked up.
<!-- SECTION:NOTES:END -->
