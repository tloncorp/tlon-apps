---
id: TASK-7
title: Add a dedicated third-party app channel type for structured state
status: To Do
assignee: []
created_date: '2026-08-19 13:47'
updated_date: '2026-08-19 13:50'
labels:
  - workspaces
  - platform
  - hoon
milestone: m-3
dependencies: []
references:
  - PLAN.md
  - desk/app/groups.hoon
  - packages/shared/src/store/channelActions.ts
priority: low
type: feature
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PLAN.md: the backend already supports third-party channel agents via generic channel-host routing (desk/app/groups.hoon), and Notes demonstrates the pattern while inheriting group permissions (packages/shared/src/store/channelActions.ts). The platform milestone calls for a dedicated app channel type so a mini-app can have its own data model where Notes is insufficient, without being forced into chat posts.

Scope is the channel type itself — creation inside a workspace group, permission inheritance, and structured read/write from the client API layer. Kit-defined UI on top of it is covered by the open-renderer-registry task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A workspace group can create an app channel hosted by a third-party channel agent, inheriting group membership and permissions
- [ ] #2 Client API layer can read and write structured state to the channel
- [ ] #3 A non-member cannot read or write the channel state
- [ ] #4 Agent (Hoon) tests cover channel creation, permission checks, and state round-trip
- [ ] #5 docs/ describes the channel contract for third-party channel agents
<!-- AC:END -->
