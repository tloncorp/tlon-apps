---
id: TASK-10
title: Render interactive cards from post state with optimistic-then-reconciled taps
status: In Progress
assignee:
  - james@tlon.io
created_date: '2026-08-19 13:48'
updated_date: '2026-08-20 14:20'
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
- [x] #1 A card's rendered state derives from the post's current surface entry, including after app restart and after scrolling the card out of and back into a virtualized list
- [x] #2 Tapping emits an action carrying the source message reference, surface ID, action ID, and expected revision
- [ ] #3 Tap shows optimistic feedback that reconciles to the post state when the edited message arrives, including reverting if no edit arrives
- [x] #4 Tapping the same control twice produces one state change (idempotent by action ID)
- [ ] #5 A second device viewing the same card shows identical state after the agent's edit syncs
- [x] #6 Tests cover restart/remount rendering, optimistic reconcile, and duplicate-tap idempotency
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

Research notes for the remaining work (ACs #1–#6), before any code.

**TASK-3 landed everything this needs on the wire.** `PostBlobDataEntryInteractiveSurfaceSchema` and `PostBlobDataEntryInteractiveActionSchema` are registered in `postBlobDataEntryDefinitions` (`content-helpers.ts:752`, `:775`), with `appendInteractiveSurfaceToPostBlob` / `appendInteractiveActionToPostBlob` builders and `INTERACTIVE_SURFACE_LIMITS` (8KB state, 2KB params, 50 processed ids). `convertContent` already treats both as data-only and emits no block (`postContent.ts:558`). `A2UI.action.surfaceAction` = `'tlon.surfaceAction'` exists with a `SurfaceActionEvent` carrying `{surfaceId, name, params?}` (`a2ui.ts:108`). The protocol is complete; the client is the only missing half.

**Nothing client-side exists yet.** Grepping `packages/app`, `packages/shared`, and `packages/ui` for `interactive-surface`, `interactiveSurface`, `interactive-action`, or `interactiveAction` returns **zero**. Greenfield, not a modification.

**AC #1 and AC #5 are mostly already satisfied by existing machinery, which I did not expect.** `usePostContent` is `useMemo(() => convertContent(post.content, post.blob), [post])` (`contentUtils.tsx:6`), `posts.blob` is a real persisted column (`schema.ts:1310`), the agent's edit lands in it (`postsApi.ts:1396`), and post read queries declare `['posts']` deps (`queries.ts:1957`, `:1976`, `:3294`) so an edit invalidates and refetches. Restart, remount-after-virtualization, and second-device all fall out of that, provided the optimistic layer introduces no state that outlives the post. That reframes the task: the work is the write side plus a pending layer that stays subordinate to the post.

**`api.sendReply` takes a blob directly and works in group channels** (`postsApi.ts:312`). By contrast the draft path derives `blob` *only* from attachments — `toPostData` switches on attachment type with no passthrough (`content-helpers.ts:1020`). So emitting an action through `sendPostFromDraft` would need an attachment type whose only job is to carry a blob, plus an optimistic post row for a reply that must never be visible.

**`A2UIBlock` is presentational and gets its callbacks from context.** It reads `onA2UIAction` / `isA2UIActionAvailable` off `useContentContext()` (`A2UIBlock.tsx:136`) and never sees the post; `handleA2UIAction` in `StaticChatMessage` closes over it. Pending state must live above the block — `A2UIBlock` remounts on virtualization, so holding it inside would drop it on scroll.

**AC #4 is ambiguous and I want it settled in the plan, not in code.** `actionId` is minted at tap and "reused verbatim on retry" per the protocol doc, so it makes *retries* idempotent. Two distinct taps mint two ids and are two legitimate actions. The only reading consistent with the protocol is "a second tap while the first is in flight must not become a second action."

**The timeout in AC #3 is a protocol requirement, not defensive coding.** `interactive-surfaces.md` states a de-duplicated action produces no edit at all, so a client in optimistic state gets no event and "without that fallback the second tap spins forever." Separately, a no-change action deliberately does **not** bump the revision, so reconciling on revision alone hangs on a legitimate no-change — `processedActionIds` must be checked too.

**Hiding the action reply is unlisted but necessary.** The doc specifies hiding a reply whose blob carries exactly one entry that is an `interactive-action`; the "exactly one" guard keeps a reply with real user content visible. No such filter exists, so the first working tap would leave a visible empty reply on every card thread.

**Correcting my own earlier note on this task.** I wrote that `packages/app` had "vitest but no jsdom and no testing-library" so a render test would need a new Tamagui harness and was disproportionate. That was wrong. `packages/app` renders real components under vitest via `react-test-renderer`'s `create`/`act` with `vi.mock` — pattern at `ui/components/Activity/ActivitySourceContent.test.tsx`, CI-enforced through root `test:ci`. TASK-5 shipped `PurposePane.test.tsx` that way. AC #6 is achievable as written.

**Legacy cards must not regress.** Most existing A2UI content has an `a2ui` entry with no sibling surface entry, and the two OpenClaw producers (`pending-approvals`, `migrate-action`) use bare constant surface ids rather than per-instance ones. Absence of a surface entry must mean "stateless card, behave as today".

**The hard blocker on AC #5.** Applying an action and editing the post is TASK-12 (`To Do`). Until it exists nothing ever edits a card, so AC #5 has no counterparty and AC #3's reconcile half can only be tested against a simulated post update. ACs #1, #2, #4 and the revert-on-no-edit half of #3 are fully verifiable now.

## Implemented — `5fafe613cd`

Built per option (a), suppressing the second tap. AC #3's reconcile half and AC #5 carry to TASK-12.

### What landed

- **Read helpers** in `content-helpers.ts`, beside the schemas they read: `findInteractiveSurface`, `isInteractiveActionOnlyBlob`, `hasAppliedInteractiveAction`. Pure and separately tested.
- **`useInteractiveSurface`** (`packages/app/ui/hooks/`) — holds the single tap in flight, emits via `api.sendReply` with an `interactive-action` blob, reconciles, times out.
- **Wiring** — `handleA2UIAction`'s `surfaceAction` early-return replaced; `isA2UIActionAvailable` extended so a tap needs the same permission typing does; a new `getA2UIActionState` context prop drives a spinner on the pressed control.
- **Action replies filtered** out of `useThreadPosts`, using the exactly-one-entry predicate.

### AC status

- **#1 done.** The card was already a pure function of the post; the tests assert a remount and an advanced post both derive correctly.
- **#2 done.** Asserted on the emitted blob entry: target post and channel, surface id, action id, expected revision, name, params.
- **#4 done.** Suppression, per your call. Two taps → one `sendReply`.
- **#6 done.** 28 tests — 12 on the helpers, 16 on the hook.
- **#3 half done, left unchecked.** The revert-on-no-edit path is real and tested (both the timeout and the send-failure path). The reconcile-to-post-state path is tested against a simulated post update, but no agent edits a card yet, so it has not run end to end.
- **#5 left unchecked.** No counterparty until TASK-12.

### Three things worth knowing

**A test-infrastructure bug, fixed.** `packages/app/vitest.config.ts` was missing the `tlon-source` resolve condition that `tsconfig.json`, `packages/shared/vitest.config.ts`, `vite.config.mts`, and `vite.cosmos.config.mts` all set. So app tests resolved `@tloncorp/api` to `dist/index.js` — running against a stale build. My newly added export read as missing, which is how I found it. Adding the condition fixed it and all 57 app test files still pass under source resolution. Anything that previously "passed" in `packages/app` was testing whatever was last built.

**A bug only cosmos could catch.** `ContentRenderer` destructures the known context props and forwards `...rest` to a styled View, so my new `getA2UIActionState` prop landed on a DOM element (`React does not recognize the getA2UIActionState prop`). Unit tests cannot see this. Verified fixed: card renders in a group channel with no console errors.

**I clobbered an existing test file and caught it by counting.** `packages/api/src/__tests__/interactiveSurfaces.test.ts` already existed from TASK-3 with 21 tests covering the wire round-trip, the render behaviour, and `tlon.surfaceAction` validation. I wrote over it. The api suite going 824 → 815 is what exposed it; I restored the original and appended my 12 helper tests, giving 836. Worth remembering that a dropped test count is the only signal for this.

### Verification

`tsc --noEmit` clean across api/shared/app/ui. Tests: api 836, shared 447, app 520 — all passing. Prettier clean. Cosmos: stateful and stateless cards both render correctly in a group channel, tap fires, no console errors.

The pending spinner itself was verified by test rather than by eye — in cosmos there is no ship, so `sendReply` 404s immediately and the pending state clears before it can be seen.

### Not done, as planned

No agent (TASK-12). No surface-id migration for the existing `pending-approvals` / `migrate-action` producers, which still use constant rather than per-instance ids. Reply-count suppression on card posts left alone — cosmetic, say the word.
<!-- SECTION:NOTES:END -->
