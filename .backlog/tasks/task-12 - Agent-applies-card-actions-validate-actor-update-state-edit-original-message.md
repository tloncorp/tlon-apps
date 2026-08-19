---
id: TASK-12
title: >-
  Agent applies card actions: validate actor, update state, edit original
  message
status: To Do
assignee: []
created_date: '2026-08-19 13:48'
labels:
  - workspaces
  - interactive-cards
  - agent
milestone: m-1
dependencies:
  - TASK-3
  - TASK-9
references:
  - PLAN.md
  - packages/openclaw/src/session-route.ts
priority: high
type: feature
ordinal: 3600
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agent half of the server-authoritative interactive card model from PLAN.md. When an action arrives referencing one of the agent's interactive messages, the agent must: validate the actor against workspace permissions, check the action ID against already-processed actions (idempotency), check the expected revision, compute the new surface state, and edit its original message with the new state and incremented revision using the blob-edit tooling.

This is the step that makes every device re-render from the synchronized post, handling double-taps, concurrent taps from multiple participants, and out-of-date clients.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An action from a workspace member updates the card: the agent edits the original message with new state and an incremented revision
- [ ] #2 An action from a non-member or unauthorized actor is rejected without changing card state
- [ ] #3 A duplicate action ID is acknowledged without applying the change twice
- [ ] #4 An action with a stale expected revision does not corrupt state; the client ends up rendering the current authoritative state
- [ ] #5 Concurrent actions from two participants resolve to one consistent final state
- [ ] #6 Tests cover authorization, idempotency, stale revision, and concurrent-action cases
<!-- AC:END -->
