---
id: TASK-12
title: >-
  Agent applies card actions: validate actor, update state, edit original
  message
status: To Do
assignee: []
created_date: '2026-08-19 13:48'
updated_date: '2026-08-20 14:20'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Carried over from TASK-10 (its AC #3 reconcile half and AC #5).

TASK-10 (`5fafe613cd`) shipped the client half: a tap emits an `interactive-action` reply carrying the target post, surface id, action id, and expected revision, shows pending feedback on the control, and reconciles when the post changes. What it cannot demonstrate is the other side of the round trip — nothing applies an action or edits a card, so:

- **TASK-10 AC #3's reconcile path** is unit-tested against a simulated post update but has never run against a real edit.
- **TASK-10 AC #5** ("a second device shows identical state after the agent's edit syncs") has no counterparty at all.

Both close when this task lands. The client needs no further change for them — post reads declare a `posts` table dep, so an edit invalidates and re-renders.

What the client already guarantees, so this task can rely on it:

- The **actor is the action post's author**. The payload carries no actor field and must never be given one.
- `actionId` is minted per tap and reused verbatim on retry. The client suppresses a second tap while one is in flight, so two presses are one action.
- `expectedRevision` is **omitted** when the card carried no surface entry yet — the protocol's opt-in to last-write-wins. Treat absent as "apply against current", not as an error.

Two obligations worth restating from `docs/tlon-apps/interactive-surfaces.md`, because the client depends on both:

1. **A no-change must not bump the revision**, but the action id must still be recorded in `processedActionIds`. The client reconciles on either signal precisely because of this; recording neither would leave a card pending until it times out.
2. **An edit must rebuild the whole blob array**, the `a2ui` entry included. The `%edit` arm stores the essay wholesale, so any entry not re-emitted is erased — omitting the blob deletes the card.

Also still open, and producer-side rather than agent-side: `pending-approvals` and `migrate-action` in `packages/openclaw/src/monitor/` use bare constant surface ids, not per-instance ones. Their cards cannot become stateful until that changes.
<!-- SECTION:NOTES:END -->
