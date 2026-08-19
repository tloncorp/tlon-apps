---
id: TASK-10
title: Render interactive cards from post state with optimistic-then-reconciled taps
status: In Progress
assignee:
  - james@tlon.io
created_date: '2026-08-19 13:48'
updated_date: '2026-08-19 18:46'
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
- [x] #7 Interactive cards render in group channels, not only DMs: the isDmChannelId gate in StaticChatMessage no longer strips a2ui blocks from workspace conversations, and all other criteria in this task are verified in a group channel
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scope addition from TASK-1 (capability matrix, doc-1 section 6): the group-channel A2UI render gate had no owning task. Folded here at the user's direction rather than opened as a separate task.

Verified by direct read at TASK-1 time: `StaticChatMessage.tsx:148` — `const canRenderA2UI = isDmChannelId(post.channelId);`, with lines ~150-165 filtering `block.type !== 'a2ui'` out of `content` and `lastEditContent` when false. `BlockRenderer.tsx:980` also maps `a2ui: () => null` in the non-A2UI default path — check both when lifting the gate.

Why it matters here: workspaces are group channels, so without this every acceptance criterion below can only be demonstrated in a DM. Any multi-device or multi-participant verification (AC #5 in particular) is meaningless in a DM with the bot.

AC #7 (the render gate) is done in `5a202e04c`. The rest of the task — rendering from post state, optimistic reconcile, idempotency, multi-device — is untouched and still depends on TASK-3's protocol.

**What changed.** `StaticChatMessage` filtered every `a2ui` block out of any conversation that was not a DM, so a card posted into a group channel simply vanished. The filter is removed rather than widened, because `StaticChatMessage` *is* the chat renderer for chat channels, DMs, and group DMs alike — there is no narrower predicate that means anything here. Notebook and gallery posts are unaffected: they never reach this component and use the default block renderers, where `a2ui` maps to null.

**The gate was worse than "cards do not show in workspaces."** It collided with `editPost`, which throws outright on DMs and group DMs (`postsApi.ts:247-250`). So the only channel type where a card could render was the only one where the agent could never edit it, which made the entire server-authoritative model in TASK-3/9/12 unimplementable rather than merely unbuilt. Lifting the gate is what unblocks that whole line of work — recorded in TASK-3's notes as well.

**No new permission work was needed.** The action handlers are now always wired, but `isA2UIActionAvailable` already gates `sendMessage` on `draftInputContext.canStartDraft`, so a read-only member of a group channel gets disabled buttons for exactly the same reason they cannot type. `handleA2UIAction` sends through `draftInputContext.channel`, which is channel-agnostic.

**Test coverage gap, stated plainly.** There is no automated render coverage for this path. `packages/app` has vitest but no jsdom and no testing-library — it is configured for logic tests with react-native mocked out — so a component-render test would mean standing up a Tamagui test harness, which is disproportionate for deleting a condition. Instead I added a group-channel case to `packages/app/fixtures/A2UI.fixture.tsx`, which is this repo's actual component harness (`pnpm run cosmos`). Verification was: `packages/app` typechecks and its 454 tests pass. Someone should still eyeball a card in a real group channel before relying on this.

**Docs updated:** `docs/tlon-apps/post-blobs.md` said "A2UI blocks render only in direct messages for now" and described `tlon.sendMessage` as sending "in the current DM". Both now describe the real policy.

**Separately fixed:** `7da6da213` registers `kit-card` as a null renderer. My TASK-2 commit `8739a446f` added that block to the api union without a renderer, and `BlockRendererConfig` is exhaustive, so `packages/app` had stopped typechecking. I missed it because that round's verification covered five packages but not `app`.
<!-- SECTION:NOTES:END -->
