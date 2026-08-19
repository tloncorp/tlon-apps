---
id: TASK-3
title: >-
  Define the interactive surface protocol (surface ID, revision, state, action
  IDs)
status: To Do
assignee: []
created_date: '2026-08-19 13:46'
updated_date: '2026-08-19 13:50'
labels:
  - workspaces
  - interactive-cards
milestone: m-1
dependencies: []
references:
  - PLAN.md
  - docs/tlon-apps/post-blobs.md
  - packages/api/src/lib/content-helpers.ts
  - packages/api/src/client/postsApi.ts
priority: high
type: feature
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PLAN.md fixes interactive card state by making the bot message the source of truth. The current A2UI model attaches a surface to one post and never updates earlier surfaces (docs/tlon-apps/post-blobs.md), while the post-edit transport already accepts a replacement blob (packages/api/src/client/postsApi.ts).

Define and document the protocol that the agent and all clients will implement: every interactive message carries a stable surface ID, a revision number, current state, and the set of processed action IDs; taps emit actions referencing the original message and expected revision; the agent edits its original message with new state and an incremented revision; clients re-render from the synchronized post.

Deliverable is the schema/types and spec, registered per the post-blob checklist in CLAUDE.md — implementation of agent and client behavior are separate dependent tasks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A named schema for the interactive surface entry (surface ID, revision, state, processed action IDs) is registered in postBlobDataEntryDefinitions with an inferred type
- [ ] #2 An action payload format referencing source message, surface ID, and expected revision is defined and typed
- [ ] #3 The spec is documented in docs/tlon-apps/ covering idempotency (duplicate action IDs), revision conflicts, and unknown-entry fallback
- [ ] #4 Tests cover valid and malformed payloads for the new entry type
- [ ] #5 Unknown or future entries still degrade to the existing upgrade-your-app blockquote
<!-- AC:END -->
