---
id: TASK-10
title: Render interactive cards from post state with optimistic-then-reconciled taps
status: To Do
assignee: []
created_date: '2026-08-19 13:48'
updated_date: '2026-08-19 14:20'
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
  - .backlog/docs/doc-1 - Workspace-capability-matrix-and-hero-wedge-decision.md
priority: high
type: feature
ordinal: 3400
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Client half of the server-authoritative interactive card model from PLAN.md. Cards must render from the synchronized post (the bot message is the source of truth), not from React component state, so state survives app restarts, list virtualization, multiple devices, and multiple participants.

A tap emits an action referencing the original message, surface ID, and expected revision per the interactive surface protocol. React state is used only for short optimistic feedback, then reconciled against the message once the agent's edit arrives. Be mindful of the invalidation-driven caching model in docs/tlon-apps/db-react-query.md when wiring the re-render path.

Also in scope (folded in from the TASK-1 capability matrix): **lift the DM-only A2UI render gate.** Today `packages/app/ui/components/ChatMessage/StaticChatMessage.tsx:148` sets `canRenderA2UI = isDmChannelId(post.channelId)` and filters every `a2ui` block out of both `content` and `lastEditContent` in group channels. Since workspaces are group channels, cards are invisible where the product needs them, and this blocks every card-based feature independently of the protocol work in TASK-3/9/12. Lifting the gate is a prerequisite for verifying the rest of this task's criteria in a real workspace rather than only in a DM.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A card's rendered state derives from the post's current surface entry, including after app restart and after scrolling the card out of and back into a virtualized list
- [ ] #2 Tapping emits an action carrying the source message reference, surface ID, action ID, and expected revision
- [ ] #3 Tap shows optimistic feedback that reconciles to the post state when the edited message arrives, including reverting if no edit arrives
- [ ] #4 Tapping the same control twice produces one state change (idempotent by action ID)
- [ ] #5 A second device viewing the same card shows identical state after the agent's edit syncs
- [ ] #6 Tests cover restart/remount rendering, optimistic reconcile, and duplicate-tap idempotency
- [ ] #7 Interactive cards render in group channels, not only DMs: the isDmChannelId gate in StaticChatMessage no longer strips a2ui blocks from workspace conversations, and all other criteria in this task are verified in a group channel
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scope addition from TASK-1 (capability matrix, doc-1 section 6): the group-channel A2UI render gate had no owning task. Folded here at the user's direction rather than opened as a separate task.

Verified by direct read at TASK-1 time: `StaticChatMessage.tsx:148` — `const canRenderA2UI = isDmChannelId(post.channelId);`, with lines ~150-165 filtering `block.type !== 'a2ui'` out of `content` and `lastEditContent` when false. `BlockRenderer.tsx:980` also maps `a2ui: () => null` in the non-A2UI default path — check both when lifting the gate.

Why it matters here: workspaces are group channels, so without this every acceptance criterion below can only be demonstrated in a DM. Any multi-device or multi-participant verification (AC #5 in particular) is meaningless in a DM with the bot.
<!-- SECTION:NOTES:END -->
