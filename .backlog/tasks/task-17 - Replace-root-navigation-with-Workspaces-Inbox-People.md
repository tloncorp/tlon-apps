---
id: TASK-17
title: Replace root navigation with Workspaces / Inbox / People
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
  - packages/app/features/chat-list/ChatListTabs.tsx
  - packages/app/navigation/RootStack.tsx
  - packages/app/navigation/desktop/TopLevelDrawer.tsx
priority: medium
type: feature
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PLAN.md Workspace IA milestone: replace the current home organization ("All / Groups / Messages" tabs in packages/app/features/chat-list/ChatListTabs.tsx) with three top-level destinations — Workspaces, Inbox, People.

Note the platform split in CLAUDE.md: mobile navigation lives in packages/app/navigation/RootStack.tsx and feature screens, while desktop/web uses packages/app/navigation/desktop/TopLevelDrawer.tsx and the desktop navigators. Both platforms must present the new IA. Existing communities/chats remain reachable (they surface through these destinations, not a hidden fourth tab).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Top-level navigation presents Workspaces, Inbox, and People on both mobile and desktop/web
- [ ] #2 Workspaces destination lists the user's workspaces; communities and chats remain reachable from the new IA without data loss
- [ ] #3 Inbox aggregates activity/messages previously reachable from the old tabs
- [ ] #4 Deep links and notification taps that targeted old destinations resolve correctly in the new IA
- [ ] #5 E2E coverage exercises the new top-level navigation on web (desktop navigation components per CLAUDE.md)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-08-21: Partial steps landed via TASK-37/TASK-38 while driving the end-to-end demo: all user-facing 'Group' copy is now 'Workspace' (146866d934), the Home chat-list filter tabs are gone (412082670c), and the create flow produces agent-seated kit workspaces. The actual root-navigation replacement (Workspaces / Inbox / People as the top-level structure) has not started — Home is still the mixed chat list with the existing bottom tabs.
<!-- SECTION:NOTES:END -->
