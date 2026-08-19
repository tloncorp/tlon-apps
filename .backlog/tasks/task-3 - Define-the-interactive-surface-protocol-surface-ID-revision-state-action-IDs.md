---
id: TASK-3
title: >-
  Define the interactive surface protocol (surface ID, revision, state, action
  IDs)
status: Done
assignee:
  - james@tlon.io
created_date: '2026-08-19 13:46'
updated_date: '2026-08-19 18:55'
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
- [x] #1 A named schema for the interactive surface entry (surface ID, revision, state, processed action IDs) is registered in postBlobDataEntryDefinitions with an inferred type
- [x] #2 An action payload format referencing source message, surface ID, and expected revision is defined and typed
- [x] #3 The spec is documented in docs/tlon-apps/ covering idempotency (duplicate action IDs), revision conflicts, and unknown-entry fallback
- [x] #4 Tests cover valid and malformed payloads for the new entry type
- [x] #5 Unknown or future entries still degrade to the existing upgrade-your-app blockquote
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation plan

Schema and spec only. No agent behaviour (TASK-12), no client rendering (TASK-10), no CLI edit path (TASK-9). The deliverable is what those three build against.

### Read this first: the protocol is currently unimplementable

Cards render **only** in DMs (`StaticChatMessage.tsx:148`), and `editPost` **throws** on DMs (`postsApi.ts:247-250`). The one channel type where a card is visible is the one where the agent cannot edit it. Nothing built on this protocol can run until that is resolved, and the right resolution is TASK-10's AC #7 — lift the DM-only render gate so cards live in group channels, which are editable and are where workspaces live anyway.

That makes **TASK-10 #7 a hard prerequisite for the whole interactive-card programme**, not just for group rendering. Writing the spec is still worth doing now — it is what TASK-9/10/12 build against — but the spec should state the dependency plainly rather than describe a round trip that cannot currently complete.

### Borrow the vocabulary from `%notes`, not from the mini-app prototype

The repo already ships this exact protocol, merged and reviewed: `%notes` has `revision`, `[%update body expected-revision]`, a typed `%conflict` on mismatch, and a client-supplied `request-id` for idempotent replay. Using its names — `expectedRevision`, `conflict`, `no-change` — makes the surface protocol legible to anyone who has read the notes code, and lets me copy two rules it already got right:

- **`no-change` does not bump the revision.** If an action resolves to identical state, do not increment, and tell callers tracking revisions not to advance theirs.
- **`expectedRevision` is optional.** Omitting it means "apply against current" — opt-in last-write-wins, which the agent's own non-contended writes want and which notes already exposes for LLM tool-callers that do not track revisions.

### Shape

Two new blob entry types plus one new A2UI button action. State lives on the bot's post; the tap is a reply carrying a structured action; the agent edits its own post. All on transports that already accept a blob, so no Hoon change.

```
bot post P     blob: [ a2ui(surfaceId=S, tree)                        ← the view
                     , interactive-surface(S, rev=3, state, stateHash, processed[]) ]  ← the truth

tap        →   reply A  blob: [ interactive-action(target=P, S, actionId=U, expectedRevision=3, name, params) ]

agent      →   edit P   blob: [ a2ui(S, re-rendered tree)
                              , interactive-surface(S, rev=4, state', stateHash', processed[]+U) ]
```

Keeping the view in the existing `a2ui` entry and the state in a sibling entry leaves the current renderer and its validator untouched, and gives `surfaceId` a real job: the join key between the two entries on one post.

### 1. `interactive-surface` v1 (AC #1)

Registered in `postBlobDataEntryDefinitions` via `definePostBlobDataEntrySchema`:

| field | type | notes |
|---|---|---|
| `surfaceId` | string, non-empty | equals the sibling `a2ui` entry's surfaceId |
| `revision` | non-negative int | starts at 0; +1 per *applied* action, never on a no-change |
| `state` | JSON object, capped | opaque to the client |
| `stateHash` | string, optional | sha-256 over sorted-key canonical JSON, from the prototype's `canonicalMiniAppJSONString`; lets the agent detect no-change cheaply and lets a reviewer verify a revision |
| `processedActionIds` | string[], capped FIFO | oldest evicted |

`state` stays opaque on purpose: the client renders the `a2ui` tree the agent produced, never the state, so typing it here would couple the protocol to individual kits. Cap it — every byte ships to every member on every render.

`processedActionIds` gets a hard cap (proposing 50), mirroring `createProcessedMessageTracker`'s bounded FIFO at a far smaller bound, and mirroring notes' `+register-request`, which sweeps terminated records **at add time** rather than on a timer. Document the consequence honestly: past the cap an ID can be forgotten and a very old retry could re-apply. That is the right trade against unbounded growth in a replicated field, and the revision check catches most of it.

### 2. `interactive-action` v1 (AC #2)

Also registered, since it rides the actor's post blob:

| field | type | notes |
|---|---|---|
| `targetPostId` | string | the bot post addressed; should match the reply parent |
| `targetChannelId` | string | resolve without a search |
| `surfaceId` | string | guards a post carrying more than one surface |
| `actionId` | string | client-minted at tap, reused verbatim on retry — the idempotency key, notes' `request-id` |
| `expectedRevision` | non-negative int, **optional** | omit for last-write-wins |
| `name` | string | which control fired |
| `params` | JSON object, optional, capped | control-specific |

Two rules the spec must state because they are security properties, both taken from the prototype's tests:

- **The actor is the post's `authorId`, never a field in the payload.** The prototype's fixture writes `actor: 'spoofed'` specifically to pin this.
- **Order actions by canonical post id, never by client timestamps.** Reuse `compareCanonicalPostIds` (BigInt over the dot-stripped `@da`); its test asserts a reply with `createdAt: 99` sorts before one with `createdAt: 1`.

### 3. `tlon.surfaceAction` A2UI button action

A third event name alongside `sendMessage`/`navigate`, carrying `{surfaceId, name, params?}`. The client fills `targetPostId`, `expectedRevision`, and a fresh `actionId` at tap time — none can be baked into the button, which is authored before the post exists and reused across revisions.

This is what makes AC #5 strong rather than merely adequate: `validateButtonAction` rejects unknown event names, failing the whole `a2ui` entry, which degrades to the upgrade blockquote. An old client therefore does not render a new-protocol card **at all** and cannot tap a stale one into emitting garbage. State it as intended behaviour, not an accident.

### 4. Spec document (AC #3)

New `docs/tlon-apps/interactive-surfaces.md`, cross-linked from `post-blobs.md` (which also needs its stale `src/lib/` paths corrected to `src/client/`). Contents:

- The round trip, why the post is the store, and the DM blocker above.
- **Idempotency.** `actionId` is the key; a replay applies nothing and does not bump. Call out the consequence the ACs imply but never state: a de-duplicated action produces **no edit**, so a client sitting in optimistic state receives no event and must fall back to its no-edit-arrived timeout (TASK-10 #3). Without that pairing a double tap leaves the second one spinning forever.
- **Revision conflicts.** Mismatch → reject, change nothing, return `conflict`. No merge, no retry: the actor is already receiving the authoritative post, re-renders, and can tap again. This satisfies TASK-12 #4 and gives concurrent actions one winner per revision (#5).
- **`no-change`** semantics, per notes.
- **Wholesale blob replacement.** The `%edit` arm stores the essay wholesale, so an edit carrying the surface must re-emit *every* blob entry, `a2ui` included; omitting the blob erases the card. The sharpest footgun here, and it currently lives only in a code comment about `botProfile`.
- **Surface ID uniqueness** per message instance. Existing producers use reusable labels (`pending-approvals`, `migrate-action`), so migrating them is a prerequisite for any stateful card.
- **Action replies are hidden**, following the prototype's `isOnlyMiniAppSystemReply` and its conservative guard: hide only when the blob carries *exactly one* entry and it is an action. A reply that also carries user content stays visible.
- Unknown-entry fallback; size caps and why.

### 5. Tests (AC #4)

`packages/api/src/__tests__/`, following `postContent.kit.test.ts` (valid case + malformed-degrades case) and the `content-helpers.test.ts` round-trip pattern:

- Both entries round-trip `appendToPostBlob` → `parsePostBlob`.
- Malformed variants degrade to `{type:'unknown'}` and render the blockquote: missing `surfaceId`, negative/non-integer `revision`, over-cap `processedActionIds`, oversized `state`, malformed `params`.
- `expectedRevision` omitted parses fine (optional), present-but-negative does not.
- A post carrying a valid `a2ui` entry **plus** an unknown future entry renders the card *and* the notice — the mixed case AC #5 actually cares about.
- `tlon.surfaceAction` fails today's `validateButtonAction`, proving the old-client gate.

### Verification

`pnpm -r tsc`, `packages/api` vitest, prettier. Pure TypeScript and docs — no ship, no desk assembly.

### Decisions taken (flagging, not asking)

**Action visibility** — resolved by precedent rather than preference. Taps are replies carrying the action entry, hidden by the `isOnlyMiniAppSystemReply` rule. Replies give host-assigned ordering and authorship for free, which a lightweight poke would force us to re-derive. The cost is real and worth naming: it consumes the thread affordance on card posts, which is why the prototype also suppressed reply-count summaries on them.

**State is a snapshot, not a log.** PLAN.md says keep the prototype's action-log/reducer/render *mental model*, and the spec will — but the reducer lives in the agent, and only the resulting snapshot ships in the blob. The prototype's log forced every client to re-fold from genesis, which is why it needed snapshots, replay bounds, and a hard failure at 500 actions that would brick a busy card. With the agent as sole writer none of that is needed.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Research findings — what exists today and what constrains the protocol.

**Path correction:** the task references `packages/api/src/lib/content-helpers.ts`; the file is at `packages/api/src/client/content-helpers.ts`. `docs/tlon-apps/post-blobs.md` has the same stale path in places.

**The blob registry.** `definePostBlobDataEntrySchema(type, version, payload)` (`content-helpers.ts:589`) builds a zod object with literal `type`/`version` discriminants. Six entries are registered in `postBlobDataEntryDefinitions` (`:713`): file, voicememo, video, tlon-context-lens, kit, and `A2UI.blobEntrySchema`. Note A2UI is the odd one out — it is `z.custom(validateBlobEntry)` wrapping a hand-rolled validator, not a zod shape. New entries should follow the zod path (file/kit), which is what AC #1 asks for.

**Unknown degradation already works** (`postContent.ts:555`): any entry failing the union parses to `{type:'unknown'}` and `convertContent` pushes a blockquote reading "Upgrade your app to see this post". Entries are iterated independently, so a post carrying both a known and an unknown entry renders both.

**A2UI already has a `surfaceId`** — in both `createSurface` and `updateComponents` (`a2ui.ts:118,126`), and validation requires the two to match (`:396-404`). But it is not an identity: the only producers are openclaw's `makeA2UIBlob` callers, which pass semantic labels — `approval-${requestId}` but also the bare constants `'pending-approvals'` and `'migrate-action'` (`monitor/approval.ts:470,760`, `monitor/migrate-card.ts:157`). Two different posts can carry the same surfaceId today. The protocol needs per-message-instance uniqueness, so this is a behavioural change for existing producers, not just an addition.

**There is no structured action today.** A tap runs `tlon.sendMessage`, which composes literal prose into the user's draft (`StaticChatMessage.tsx:135`, `A2UIBlock.tsx:151`). The agent receives ordinary text. So AC #2 is genuinely new surface, not a refactor.

**Both transports already carry a blob.** `sendPost` (`postsApi.ts:150-166`) and `editPost` (`:221-244`) each accept `blob?: string`, so the whole round trip — bot posts a surface, actor posts an action, bot edits the surface — works on existing transport with no Hoon change. Two constraints come with that: the `%edit` arm stores the essay wholesale (the `botProfile` comment at `postsApi.ts:240` says so explicitly), so **an edit must re-emit the entire blob array or every other entry is lost**; and the same wholesale rule is why `editPost` writing `blob ?? null` erases a card when the blob is omitted.

**Old clients cannot be made to emit bogus actions.** `validateButtonAction` (`a2ui.ts`) returns false for any event name other than `tlon.sendMessage`/`tlon.navigate`, which fails the whole entry, which degrades it to the upgrade blockquote. So introducing a new button action name is self-gating: an old client never renders a new-protocol card and therefore never taps one. That is a stronger AC #5 story than mere graceful degradation.

**Size budget.** A2UI enforces `maxBytes: 32 * 1024` plus component/depth/text caps (`a2ui.ts` LIMITS). Whatever the surface entry stores ships inside every copy of the post to every member, so state and the processed-action list both need explicit caps.

**Idempotency precedent to mirror:** `packages/openclaw/src/monitor/processed-messages.ts` — a bounded FIFO (`createProcessedMessageTracker(limit = 2000)`) with `mark`/`has`, evicting oldest past the limit. The blob-side list needs the same shape at a far smaller bound.

**What the dependents need from this spec.** TASK-9 #3 (reject stale-revision edits), TASK-10 #2/#3/#4 (tap carries source message + surfaceId + actionId + expectedRevision; optimistic feedback that reverts if no edit arrives; duplicate tap causes one state change), TASK-12 #3/#4/#5 (duplicate actionId acknowledged without double-apply; stale revision does not corrupt and the client ends on authoritative state; concurrent actions converge).

Research findings, part 2a — a blocker.

**Cards render only where they cannot be edited.** Two constraints on develop are mutually exclusive, and together they make "the agent edits its own card" unimplementable today:
- `StaticChatMessage.tsx:148` — `canRenderA2UI = isDmChannelId(post.channelId)`. Cards render **only** in DMs.
- `postsApi.ts:247-250` — `editPost` **throws outright** on DM and group-DM channels: `Cannot edit a post in a DM or group DM`.

The only channel type where a card is visible is the only one where the agent cannot edit it. The `%chat` agent does have an `%edit` arm on writs (`desk/app/chat.hoon:1663`), so this is a client-side gap rather than a protocol impossibility — but nothing can be built on this protocol until one side moves. Lifting the DM-only render gate (already folded into TASK-10 as AC #7) resolves it in the right direction: cards move to group channels, which are editable, and which is where workspaces live anyway. This promotes TASK-10 #7 from a nice-to-have to a hard prerequisite for the whole interactive-card programme. The mini-app prototype dodged this by never editing anything.

Research findings, part 2b — %notes is a better template than the mini-app prototype.

**The repo already ships this protocol, merged on develop.** Reusing its vocabulary makes the surface protocol legible to anyone who has read the notes code:
- `desk/sur/notes.hoon:89` — `revision=@ud` on the note; `:184` — the write action is `[%update body=@t expected-revision=@ud]`; `:350-355` — a typed `%conflict` response on mismatch, driving an editor conflict banner.
- `desk/app/notes.hoon` `+se-update-note` — `?: !=(revision.note expected-revision)` finalizes `%conflict` with `revision-mismatch: expected {…}, current {…}`; otherwise archives the prior revision and bumps.
- Idempotency by client-supplied id: `sur/notes.hoon:347` `+$ request-id @uv`, carried on every v1 action/command/response; `+register-request` is an insert-if-missing with `cleanup-requests` sweeping terminated records **at add time**, so the map stays bounded without a timer. Worth copying — same problem as bounding `processedActionIds`.
- `packages/api/src/client/notesApi.ts` — `expectedRevision?: number` (optional; omitting it falls back to current, i.e. opt-in last-write-wins for callers that do not track revisions), an `isNotesV1ConflictError` guard, and a `'no-change'` result meaning the body already matched and **the revision was not bumped**, with an explicit note that callers tracking revisions must not advance theirs.
- Design note in `sur/notes.hoon`: metadata edits (`%rename`, `%move`) deliberately do not bump the revision, "so the revision-check semantics don't get tangled with metadata edits."

**No other branch attempts this.** A sweep of every `origin` tip for `surfaceRevision`/`expectedRevision`/`processedActionIds`/`idempot`, and of all commit messages for surface/revision/idempotent/a2ui/miniapp, found nothing beyond `385fbe9f0` (sole commit on `origin/lb/agent-mini-app`). The A2UI-adjacent commits are cosmetic or onboarding-related.

Research findings, part 2c — what to keep and drop from the mini-app prototype (`385fbe9f0`).

**Keep:**
- `compareCanonicalPostIds` — BigInt over the dot-stripped Urbit `@da` in the post id, giving a host-assigned total order. Its test asserts ordering by post id **not** client `createdAt` (a reply with `createdAt: 99` sorts before one with `createdAt: 1`). The right way to order a batch of inbound actions.
- **Actor comes from `reply.authorId`, never from the payload.** The fixture deliberately writes `action: {kind:'vote', actor:'spoofed'}` to pin this. Exactly the anti-spoofing property TASK-12 #2 needs.
- `canonicalMiniAppJSONString` + `stateSha256` — sorted-key deterministic JSON hashing, making "state as of revision N" verifiable and letting an unchanged state skip a revision bump (pairs with notes' `no-change`).
- The render envelope `{visual?, controls?, summary?, badge?}`. `summary` and `badge` are the notification / list-preview / plaintext-fallback surface; A2UI has no equivalent today and any agent-rendered card needs one.
- `isOnlyMiniAppSystemReply` — hides action replies from the thread UI, guarded on the blob containing *exactly one* system entry. This answers the open question about action-message visibility with in-repo precedent.

**Discard:** the entire bundle apparatus (`bundleUri`/`bundleSha256`/`runtime`/`MiniAppBundleSchema.source`), `WORKER_SOURCE` and the Web Worker sandbox, `lintMiniAppSource` and its forbidden-globals list, `fetchAndVerifyBundle`, and `init`/`reduce`/`render` as a *client* contract (keep them as the agent's mental model only). Also the append-only reply log itself: `getMiniAppActionLog`, `sequence`, the replay bounds (500 actions, past which a busy card hard-fails with "Action log exceeds V1 replay limit"), and the snapshot machinery. With the agent as sole writer, current state is one field on the root post — no fold, no bound, no bricking. The snapshot *field set* remains a good template: `throughPostId` → last folded action, `actionCount` → `revision`, `stateSha256` kept as-is.

Also noted: the prototype was web-only (`StaticChatMessage.tsx` gated the feature on `isWeb`), so it never ran on iOS.

Status set back to To Do: the implementation plan is recorded and reviewed, but no code has been written and the task is awaiting approval to proceed. Nothing is in flight.

**The blocker recorded in part 2a is now cleared.** TASK-10 AC #7 landed in `5a202e04c` — A2UI blocks are no longer filtered out of non-DM conversations, so cards render in group channels, which `editPost` accepts. The round trip this protocol describes (bot posts a surface → actor posts an action → bot edits its own post) is therefore implementable now. The prerequisite noted in the plan's opening section is satisfied; the plan text itself still describes it as outstanding and should be read with that correction.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Summary

The interactive surface protocol is defined, registered, documented, and tested in `3c7fb2046`. Schema and spec only — the agent half (TASK-12), the client half (TASK-10), and the CLI edit path (TASK-9) build against this.

## What landed

**Two blob entries**, both registered in `postBlobDataEntryDefinitions` so unknown and future variants keep degrading to the upgrade blockquote:

- `interactive-surface` v1 — `surfaceId`, `revision`, opaque `state`, an optional canonical-JSON `stateHash`, and a capped FIFO of `processedActionIds`.
- `interactive-action` v1 — `targetPostId`, `targetChannelId`, `surfaceId`, `actionId`, optional `expectedRevision`, `name`, `params`.

Plus `appendInteractiveSurfaceToPostBlob` / `appendInteractiveActionToPostBlob`, `INTERACTIVE_SURFACE_LIMITS`, and `tlon.surfaceAction` — a third A2UI button action naming only the surface and control, since the target post, revision, and action id are only knowable at tap time.

**`docs/tlon-apps/interactive-surfaces.md`**, cross-linked from `post-blobs.md`: the round trip, who may write what, revisions and conflicts, idempotency, surface-id uniqueness, action replies, older clients, and limits.

## Design decisions worth re-reading

**State is opaque and stays that way.** Clients render the `a2ui` tree the agent produced and never read `state`, so typing it here would couple the protocol to whichever kit owns the card. The two entries sit side by side on one post joined by `surfaceId`, which leaves the existing a2ui renderer and validator untouched.

**Vocabulary borrowed from `%notes` rather than invented** — `expectedRevision`, `conflict`, `no-change`, and an optional `expectedRevision` meaning opt-in last-write-wins. That protocol is already merged and reviewed here, so this one reads as familiar rather than novel.

**Two rules documented as security properties, not conventions:** the actor is the action post's author and never a payload field, and actions order by host-assigned post id rather than any client clock. Both come from tests in the mini-app prototype that pin exactly these.

**The idempotency/optimism interaction is spelled out** because it is easy to miss when the halves are built separately: a de-duplicated action produces *no edit at all*, so a client in optimistic state after a double tap receives no event and must time out and re-render from the post it already has. Without that pairing the second tap spins forever.

**Older clients are self-gating.** `validateButtonAction` rejects unknown event names, failing the whole `a2ui` entry, so an old client does not render a new-protocol card at all and cannot tap a stale one into emitting a bad-revision action. Degrading the view and disabling the interaction are the same act.

## Verification

21 new tests in `packages/api/src/__tests__/interactiveSurfaces.test.ts`: round-trips for both entries, defaulting, the FIFO trim, nine malformed-payload cases degrading to `{type:'unknown'}` and the upgrade blockquote, the omitted-`expectedRevision` case, the mixed known-plus-unknown case AC #5 actually cares about, and four `tlon.surfaceAction` validation cases including the old-client gate. 787 api, 454 app, 1426 openclaw tests pass; api, shared, app, and openclaw all typecheck.

One test initially failed for the right reason — `appendToPostBlob` validates on write, so it cannot construct a deliberately-invalid blob. Rebuilt as raw wire JSON, which is the more accurate simulation anyway since such a blob arrives from a newer client.

## Incidental change

Adding a third event name broke narrowing-by-elimination in `handleA2UIAction`, which now switches explicitly. `surfaceAction` taps are inert for now — `isA2UIActionAvailable` reports them unavailable, so buttons render disabled — because emitting one is the client half and lands with TASK-10. Flagged in a comment at the branch.

## Not done here

The prerequisite blocker recorded during planning was cleared separately by TASK-10 AC #7 (`5a202e04c`), which lifted the DM-only render gate; cards now live in group channels, which `editPost` accepts, so the round trip this protocol describes is implementable.

Existing A2UI producers still use reusable surface-id labels (`pending-approvals`, `migrate-action`), which must move to per-instance ids before their cards can become stateful. Documented in the spec; the work belongs to TASK-12.
<!-- SECTION:FINAL_SUMMARY:END -->
