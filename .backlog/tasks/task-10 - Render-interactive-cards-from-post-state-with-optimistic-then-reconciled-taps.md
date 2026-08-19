---
id: TASK-10
title: Render interactive cards from post state with optimistic-then-reconciled taps
status: To Do
assignee: []
created_date: '2026-08-19 13:48'
labels:
  - workspaces
  - interactive-cards
  - ui
milestone: m-1
dependencies:
  - TASK-3
references:
  - PLAN.md
  - docs/tlon-apps/post-blobs.md
  - docs/tlon-apps/db-react-query.md
priority: high
type: feature
ordinal: 3400
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Client half of the server-authoritative interactive card model from PLAN.md. Cards must render from the synchronized post (the bot message is the source of truth), not from React component state, so state survives app restarts, list virtualization, multiple devices, and multiple participants.

A tap emits an action referencing the original message, surface ID, and expected revision per the interactive surface protocol. React state is used only for short optimistic feedback, then reconciled against the message once the agent's edit arrives. Be mindful of the invalidation-driven caching model in docs/tlon-apps/db-react-query.md when wiring the re-render path.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A card's rendered state derives from the post's current surface entry, including after app restart and after scrolling the card out of and back into a virtualized list
- [ ] #2 Tapping emits an action carrying the source message reference, surface ID, action ID, and expected revision
- [ ] #3 Tap shows optimistic feedback that reconciles to the post state when the edited message arrives, including reverting if no edit arrives
- [ ] #4 Tapping the same control twice produces one state change (idempotent by action ID)
- [ ] #5 A second device viewing the same card shows identical state after the agent's edit syncs
- [ ] #6 Tests cover restart/remount rendering, optimistic reconcile, and duplicate-tap idempotency
<!-- AC:END -->
