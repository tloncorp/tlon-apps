---
id: TASK-9
title: Extend agent post-edit tooling to write blobs
status: To Do
assignee: []
created_date: '2026-08-19 13:47'
labels:
  - workspaces
  - interactive-cards
  - agent
milestone: m-1
dependencies:
  - TASK-3
references:
  - PLAN.md
  - packages/api/src/client/postsApi.ts
  - docs/tlon-apps/post-blobs.md
priority: high
type: feature
ordinal: 3200
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PLAN.md's server-authoritative card model requires the agent to edit its own original message with new surface state. The post-edit transport already accepts a replacement blob (packages/api/src/client/postsApi.ts), but the agent's CLI edit path only edits message text.

Extend the agent's post-edit tooling so it can replace a post's blob (carrying the interactive surface entry defined by the protocol task) alongside or independently of text edits. Note the current frontend policy in docs/tlon-apps/post-blobs.md — frontend edit flows preserve the original blob; that policy stays for human edit flows, this change is for the agent's own tooling.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Agent tooling can edit one of its own posts replacing the blob with a new interactive surface payload
- [ ] #2 Text-only edits from human frontend flows continue to preserve the existing blob unchanged
- [ ] #3 Editing with a stale expected revision is rejected or safely ignored rather than clobbering newer state
- [ ] #4 Tests cover blob edit success, stale-revision rejection, and text-edit blob preservation
<!-- AC:END -->
