---
id: TASK-12
title: >-
  Agent applies card actions: validate actor, update state, edit original
  message
status: To Do
assignee: []
created_date: '2026-08-19 13:48'
updated_date: '2026-08-20 14:48'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation plan

**One decision dominates this task and I do not think it should be made implicitly: who computes the new state.** §3. Everything else follows.

### 1. Where this runs, and what is missing

Applying an action is reactive — it happens when an action reply arrives, not on a model turn. That puts it in the monitor's SSE loop (`packages/openclaw/src/monitor/index.ts`), which already sees reply essays **including their blob**: the local `Essay` type at `:205` carries `blob?: string | null`, and both the channel and writ reply deltas are already destructured.

Two things are genuinely absent:

- **openclaw cannot edit a post at all.** `grep editPost packages/openclaw/src` returns **zero**. It sends and replies (`urbit/send.ts`) but has never edited. TASK-9 gave the *CLI* that ability; openclak is a separate consumer of `@tloncorp/api` and needs its own path.
- **Nothing reads `interactive-action` entries.** The existing a2ui buttons all use `tlon.sendMessage` to post a slash command, which the monitor handles through `command-bridge.ts` / `command-auth.ts`. That is the current "button does something" pattern and it is text-based. `tlon.surfaceAction` is a structured channel and needs a new handler.

### 2. The mechanical half, which is straightforward

Given an inbound reply whose blob parses to exactly one `interactive-action`:

1. **Resolve the target.** `targetPostId` + `targetChannelId` from the entry; read that post.
2. **Validate the actor — AC #2.** The actor is the reply's author, never a field in the payload. Check it against the channel's `can-write`, which is what "may act on this card" means: tapping is posting. `%groups`' bulk gate is already how `%notes` and `%apps` do this.
3. **Idempotency — AC #3.** If `actionId` is in the surface's `processedActionIds`, do nothing: no state change, no revision bump, **no edit**. The client depends on this producing no event and falls back to a timeout.
4. **Revision — AC #4.** Mismatch → reject, change nothing. Absent `expectedRevision` → apply against current (explicit last-write-wins).
5. **Edit.** Rebuild the **whole** blob array including the `a2ui` entry, bump the revision by exactly 1, append the action id. A no-change records the id but leaves the revision alone.

AC #5 (concurrent actions) falls out of 3+4 rather than needing its own mechanism: for a given revision exactly one action wins and the losers are told to look again. Worth noting the ordering rule from the protocol doc — order by **post id**, which the host assigns and totally orders, never by `createdAt`/`sentAt`, which are client-supplied.

### 3. Decision — who computes the new state

Steps 1–5 above are mechanical. `computeNewState(state, actionName, params)` is not: a generic reducer cannot know what `setPortions` means.

And the obvious answer is blocked: **kits carry no executable code**, deliberately. `docs/kits.md` says a kit is "markdown instructions, starting state, schedule declarations, place templates, and a policy patch — no executable code; a kit's power is bounded by the policy the owner grants, not by its text." A kit-supplied reducer would break that, and it is a security property, not an implementation detail.

Three ways out:

- **(a) A built-in action vocabulary.** The agent ships a fixed, small set of state operations — `set`, `toggle`, `increment`, `append`, `remove` — each addressing a JSON path in `state`. The button's `name` picks the operation and `params` carries the path and value. Deterministic, instant, no model turn, no executable kit code, and testable as a pure function. The cost is that a card can only do what the vocabulary allows, and a kit wanting something else has to express it as a composition or go without.
- **(b) A model turn per tap.** The monitor surfaces the action to the model, which computes the new state and calls `tlon posts edit --blob … --expected-revision …` (exactly what TASK-9 built). Arbitrarily expressive. But every tap costs a model turn — latency measured in seconds, cost per tap, and nondeterminism in a code path whose whole purpose is that two devices agree. It also makes AC #5 much harder: two concurrent taps become two concurrent model turns.
- **(c) Both.** Vocabulary handles what it can; anything else falls through to the model.

**I recommend (a).** The hero wedge is meal planning — toggling a day done, setting portions, checking off a grocery item. Those are `toggle` and `set` on a path. Making the common case instant and deterministic is worth far more than making the rare case possible, and (b) can be added later without changing the wire format, because the protocol does not care who computed the state. Shipping (b) first would make every card tap slow and would put a model in the middle of a concurrency protocol.

I would also note: **(a) keeps `state` genuinely opaque to the protocol** while giving the agent a defined way to change it. (b) does too, but by making the agent's reasoning the contract, which is much harder to test.

**This is the decision I need.** If you want (c), say so and I will build (a) with a documented fall-through point rather than the fall-through itself.

### 4. Work, assuming (a)

- **`packages/openclaw/src/urbit/blob.ts`** — extend with a surface reader and writer: parse the target post's `interactive-surface`, and rebuild a full blob array carrying the a2ui entry plus the new surface entry. This is where the "rebuild the whole array" rule gets enforced once, rather than at each call site.
- **`packages/openclaw/src/monitor/surface-actions.ts`** (new) — the pure part: given the current surface, the action, and the actor's write permission, return one of `{apply, newState, revision}` / `{noop, reason}` / `{reject, reason}`. No I/O, so AC #6's authorization, idempotency, stale-revision and concurrency cases are all unit tests over a pure function.
- **`packages/openclaw/src/monitor/state-ops.ts`** (new) — the action vocabulary from §3(a), also pure.
- **`monitor/index.ts`** — detect the inbound action reply, resolve the target post, call the pure decision, and on `apply` perform the edit. This is the only part that touches the network.
- **An edit path** — openclaw has none. Add one to `urbit/send.ts` (or a sibling) wrapping `api.editPost`, carrying the authorship shape back like every other edit path in the repo does, or a bot-authored card is rewritten to a bare ship author and loses its Bot tag.
- **Per-instance surface ids.** `approval.ts:760` (`pending-approvals`) and `migrate-card.ts:157` (`migrate-action`) pass bare constants, so two posts can share a surface id. They are not stateful cards today so nothing breaks, but the moment anything keys state by surface id they collide. I would fix these here — it is two call sites — and note that `approval.ts:470` already does it correctly (`approval-${requestId}`).

### 5. Tests — AC #6

All four AC cases are pure-function tests over the decision module:

- **Authorization** — a non-member's action rejects and produces no edit; a member's applies.
- **Idempotency** — a replayed `actionId` returns `noop` with no revision bump and, critically, **no edit**, because the client's timeout fallback depends on exactly that.
- **Stale revision** — mismatch rejects and changes nothing; absent `expectedRevision` applies against current.
- **Concurrency** — two actions against the same revision: the first applies, the second (now stale) rejects. Then the same pair ordered by post id rather than by client timestamp, to pin the ordering rule.
- **No-change** — an action resolving to identical state records the id and does **not** bump the revision.
- **Blob rebuild** — the produced blob still carries the a2ui entry. This is the regression test for the sharpest edge in the protocol, and it is worth asserting on the bytes.
- **The state vocabulary** — each operation, plus an unknown operation name rejecting rather than silently doing nothing.

Integration: `packages/openclaw/test/cases/` has the numbered fakezod suite (`05-channels.test.ts` etc.) if we want a live round trip, which is also what would finally close **TASK-10 AC #3's reconcile half and AC #5** end to end.

### 6. Verification

`pnpm -r tsc`; `packages/openclaw` vitest (1426 tests currently); prettier. openclaw's own CI also runs security scanners — no `Math.random()` for ids, no raw `fetch`.

If we want AC #5 demonstrated rather than argued: `pnpm test:integration` spins ephemeral fakezods, and two ships tapping the same card is the real test. That is the piece TASK-10 could not do.

### 7. What this does not do

- **No new card types.** Building the meal-planning card is TASK-13.
- **No client change.** TASK-10 already emits, shows pending, and reconciles; post reads declare a `posts` table dep so an edit re-renders. Nothing on that side should need touching, and if it does I will say so.
- **No action log or replay** — TASK-21.
<!-- SECTION:PLAN:END -->

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

Research notes, before any code.

**openclaw cannot edit a post today.** `grep -rn editPost packages/openclaw/src` returns **zero** results. It sends and replies (`urbit/send.ts`) but has never edited anything, so an edit path is new code here — including carrying the bot authorship shape back, which every other edit path in the repo does explicitly or the post loses its Bot tag.

**The monitor already sees inbound blobs.** `monitor/index.ts:205` declares a local `Essay` type with `blob?: string | null` (the comment notes @tloncorp/api does not export these), and both the `ChannelResponse` reply arm (`:217`) and the `WritResponseDelta` reply arm (`:236`) destructure reply essays. So detecting an `interactive-action` reply needs no new plumbing to reach the data — only a new branch.

**The existing "button does something" pattern is text, not state.** Every a2ui button in openclaw today uses `tlon.sendMessage` to post a slash command, which the monitor handles through `command-bridge.ts` (97 lines, an `ApprovalCommandBridge` registry keyed by accountId) and `command-auth.ts` (79 lines). That is a deterministic, no-model path and a good precedent for handling taps in TS rather than through a model turn — but it routes through commands, so `tlon.surfaceAction` needs its own handler.

**The hard part is not the protocol, it is `computeNewState`.** Steps like actor validation, idempotency and the revision check are mechanical. Deciding what `setPortions` *means* is not, and the obvious answer is closed off: `docs/kits.md` states a kit carries markdown instructions, scaffolds, schedules, place templates and a policy patch — **"No executable code — instructions are markdown the harness loads into model context; a kit's power is bounded by the policy the owner grants, not by its text."** A kit-supplied reducer would break a deliberate security property. Hence the §3 decision.

**Two producers still use constant surface ids.** `approval.ts:760` passes `'pending-approvals'` and `migrate-card.ts:157` passes `'migrate-action'`, so two posts can carry the same surface id. `approval.ts:470` already does it correctly with `approval-${requestId}`. Nothing breaks today because neither is stateful, but anything keying state by surface id collides. Two call sites to fix.

**Reusable pieces:** `urbit/blob.ts` already has `makeA2UIBlob` (which validates via `A2UI.validateBlobEntry` and throws) and `serializeBlobField`; `monitor/processed-messages.ts` has a `ProcessedMessageTracker`, though the protocol's idempotency key lives in the post's `processedActionIds` rather than in agent memory — which is the right place, since it survives a restart and replicates.

**What the client already guarantees**, so this task need not defend against it: the actor is the reply's author (no actor field exists in the payload); `actionId` is per-tap and reused verbatim on retry; a second tap while one is in flight is suppressed client-side; `expectedRevision` is omitted only when the card had no surface entry, which is the documented opt-in to last-write-wins.

**Two obligations the client depends on**, both from `docs/tlon-apps/interactive-surfaces.md`: a no-change must record the action id **without** bumping the revision (the client reconciles on either signal precisely because of this), and an edit must rebuild the whole blob array including the `a2ui` entry or the card is erased for everyone. TASK-9 added a CLI guard against the second; openclaw's own edit path needs the equivalent.

**Integration testing is available if we want AC #5 demonstrated rather than argued.** `packages/openclaw/test/cases/` is a numbered fakezod suite and `pnpm test:integration` spins ephemeral ships. Two ships tapping the same card is the real test, and it is exactly what TASK-10 could not do.
<!-- SECTION:NOTES:END -->
