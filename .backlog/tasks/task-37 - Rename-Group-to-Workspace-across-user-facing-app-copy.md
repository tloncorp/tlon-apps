---
id: TASK-37
title: Rename Group to Workspace across user-facing app copy
status: Done
assignee: []
created_date: '2026-08-21 15:23'
updated_date: '2026-08-21 15:23'
labels:
  - workspace
  - ui-copy
dependencies: []
modified_files:
  - packages/app/ui/components/ChatOptionsSheet.tsx
  - packages/app/ui/components/GroupPreviewSheet.tsx
  - packages/app/ui/components/listItems/GroupListItem.tsx
  - packages/app/features/top/ChatDetailsScreen.tsx
  - packages/app/features/top/chatDetails.tsx
  - packages/app/features/chat-list/ChatListTabs.tsx
  - packages/app/ui/components/MetaEditorScreenView.tsx
  - packages/app/ui/components/ProfileSheet.tsx
type: enhancement
ordinal: 34000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the word "group" with "workspace" in every user-visible string in packages/app (create/join/leave flows, detail screens, sheets, list items, notices, notification copy, empty states), while leaving code identifiers, wire/settings values, analytics/log strings, and group-DM labels untouched. Part of the agentic-workspace product shift on james/agentic-workspace.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 No user-visible 'group' copy remains in packages/app (verified by string/template/JSX sweep with apostrophe-tolerant patterns)
- [x] #2 Group DM ('Group chat' for groupDm channels), analytics/log labels, wire values (TalkSidebarFilter 'Group Channels'), type unions, ids, and testIDs are unchanged
- [x] #3 prettier, tsc --noEmit (packages/app), and the packages/app vitest suite (569 tests) all pass
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Done in commit 146866d934 (35 files, +130/-122). Two-phase approach: exact multi-word string map (~60 entries) across packages/app/ui and packages/app/features, then a context-classified pass over bare/ambiguous literals ('Group', 'group' fallback titles, template literals, JSX text). Sweep lessons: single-line string regexes missed template literals containing apostrophes ("invitations you've sent") and multi-word JSX text ("Group invitation") — final sweep used apostrophe-tolerant per-quote-style patterns. One over-rename caught by tsc: TalkSidebarFilter 'Group Channels' is a persisted settings wire value, reverted (its visible label was already 'Chat Channels'). Kept as-is: groupDm 'Group chat' labels (multiparty DMs, not the groups product), analytics/log strings, protocol names ('groups' negotiation), ids ('group-deleted', 'group-ask', 'basic-group'), tab name="groups" (label now 'Workspaces'), $group-press tamagui token.

FOLLOW-UP NEEDED: apps/tlon-web e2e specs still assert old copy ("Leave group", "Group info & settings", etc.) and will fail until updated.
<!-- SECTION:FINAL_SUMMARY:END -->
