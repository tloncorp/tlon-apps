---
id: TASK-22
title: 'Chat landing: starter artifact, one clear action, first result in 90 seconds'
status: Done
assignee: []
created_date: '2026-08-19 13:49'
updated_date: '2026-08-20 17:47'
labels:
  - workspaces
  - onboarding
  - ui
milestone: m-1
dependencies:
  - TASK-4
  - TASK-13
  - TASK-16
references:
  - PLAN.md
  - packages/app/ui/components/Wayfinding/BotChatPreview/mockConversation.ts
priority: high
type: feature
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The moment of value from PLAN.md: after the two interstitials, the user lands directly in the real workspace conversation — not a demo or mock. The landing must show: (1) a starter artifact already visible, (2) one meaningful action the user can take immediately, (3) live task rows showing agent progress (e.g., "Drafting plan → Saving grocery list → Ready"), and (4) a completed durable artifact within a target of 90 seconds.

The existing onboarding uses a mocked gardening conversation (packages/app/ui/components/Wayfinding/BotChatPreview/mockConversation.ts); this replaces mock content with the real provisioned workspace. If provisioning is still finishing when the user arrives, the landing must handle that gracefully rather than showing an empty room.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 User lands in the real provisioned workspace conversation immediately after interstitial 2
- [ ] #2 A starter artifact is visible at landing and one clear next action is presented
- [ ] #3 Agent progress renders as live task rows from landing through first-artifact completion
- [ ] #4 The first durable artifact completes and is visible within 90 seconds on a typical connection
- [ ] #5 Arriving before provisioning finishes shows honest in-progress state, and killing/reopening the app during landing returns to a consistent state
- [x] #6 No mock conversation content appears anywhere in the flow
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation plan

Two real decisions, §3 and §4. AC #1 is already done and AC #4 can only be measured on a live rig — which is the walkthrough this task pauses for.

### 1. AC #1 is already satisfied

TASK-11 built the landing: a durable `workspaceLanding` handoff plus `useWorkspaceLanding`, which waits for the channel row and resets to it. The user already lands in the real provisioned conversation immediately after interstitial 2. Nothing to build; I will re-verify rather than re-implement.

### 2. AC #3's mechanism is already mounted, with one gap

TASK-4 shipped `AgentActivity`, mounted at the two existing `ThinkingState` slots — `DetailView.tsx` and `ListPostCollectionView.tsx` — with `projectTaskRows` merging the durable ContextLens spine and the live `%presence` overlay. The landing conversation is exactly one of those slots, so rows render there today.

Two things worth knowing:

- **The owner-only limitation does not bite here.** The lens flows bot → owner only, which TASK-4 correctly called a real limitation for shared channels. But the onboarding user *is* the bot's owner, so for this task's moment the durable path applies.
- **The rows are tool-named, not domain-named.** Step labels come from `toolName` (`context-lens.ts:664`), so they read "Assembled context", "Checking the web" — not PLAN.md's "Drafting plan → Saving grocery list → Ready". TASK-4 flagged this as separate work. Hence §4.

### 3. Decision — how the pre-artifact landing state is presented (ACs #2, #5)

The user can arrive before the agent has posted anything: provisioning may still be seating the agent, and the agent then has to run `install.setup`. So the landing can legitimately be an empty room, and AC #5 forbids showing one.

`EmptyChannelNotice` already has exactly this shape of special case — `isDefaultPersonalChannel` short-circuits to `<WayfindingNotice.EmptyChannel />`. A workspace-awaiting-setup branch is the same move:

- **(a) A branch in `EmptyChannelNotice`.** Renders only when the channel has no posts, which *is* the "arrived early" condition, and stops rendering by itself the moment the agent's first message lands. No synthetic content, no lifecycle to manage, and it follows a precedent already in the file.
- **(b) A persistent banner above the composer**, shown whenever setup is pending. Survives the first post arriving, so it needs its own dismissal logic, and it competes with the agent's own task rows for the same attention.
- **(c) A synthetic optimistic post** in the conversation. Worst of the three: it puts content in the channel that the ship has no record of, which is the pattern this milestone has already been bitten by.

**I recommend (a).** It is self-clearing, it reuses the existing seam, and "the room is empty" and "we should explain why" are the same condition — so they should be the same branch.

The notice carries AC #2's "one clear next action". Which action depends on the descriptor's `setup` status: pending means the agent is about to introduce itself, so the honest action is to wait and the useful affordance is inviting someone (which is also the thing most likely to make the workspace worth having). Once setup is done and the notebook has the starter artifact, the action is to open it.

### 4. Decision — domain-named task rows

AC #3 says "agent progress renders as live task rows". Tool-level rows satisfy that literally. The product moment PLAN.md describes wants "Drafting plan → Saving grocery list → Ready".

- **(a) Leave them tool-named.** AC #3 passes as written; the onboarding moment reads more mechanically than PLAN.md's illustration. Zero work.
- **(b) Map tool names to friendly labels in the presentation layer.** `projectTaskRows` already owns the label; a lookup from tool name to a human phrase turns "wrote a note" into "Saving the plan". No protocol change, no agent change, and it degrades to the raw tool name for anything unmapped.
- **(c) A new mechanism for the agent to declare named steps.** The honest version of PLAN.md's copy, since only the agent knows it is "drafting a plan". But step names come from `toolName` today, so this needs a new field on the lens, a Hoon change to `desk/sur/steward/lens.hoon`, and an openclaw emitter. That is its own task.

**I recommend (b).** It gets most of the product value for a lookup table, and it keeps the labels honest — a mapped label still describes a thing that actually happened, unlike a scripted sequence that could drift from what the agent did. (c) is the right long-term answer and I would open it as a follow-up rather than fold it in here.

### 5. AC #6 — removing the mock

`mockConversation.ts` feeds `BotChatPreview`, which is rendered in one place: `GroupsPane`, as a 368px illustration above the copy. `GroupsPane` is an explainer pane — it creates nothing, its action just advances — so this is decoration, but it is decoration inside the flow, which is what AC #6 rules out.

The non-hosting branch of that same pane already renders a static image (`garden-party-invite.png`). So the change is to use the static image in both branches, then delete `BotChatPreview`, `mockConversation.ts`, `buildMockPost.ts`, the barrel, and the cosmos fixture entry. Nothing else imports them.

I will grep the whole flow for other mock content rather than assuming this is the only instance, and report what I find.

### 6. Work

- **`WayfindingNotice.WorkspaceSetup`** (in `Notices.tsx`, beside `EmptyChannel`) — the in-progress notice, driven by `db.workspaceProvisioning` and the descriptor's `setup` status.
- **`EmptyChannelNotice`** — one branch, above the `isDefaultPersonalChannel` one, for a workspace channel whose setup has not completed.
- **A tool-label map** in the task-rows projection, if §4 lands as (b).
- **Delete the mock** — component, mock data, builder, barrel, fixture.

### 7. Tests

- The notice renders for a workspace channel with `setup: 'pending'` and not for a plain empty channel, so no existing empty state changes.
- It stops rendering once setup is done — the branch is on the descriptor, not on a one-shot flag, so this falls out rather than needing cleanup.
- A group that is not a workspace is unaffected (the existing empty state still renders).
- The tool-label map: a mapped tool gets its phrase, an unmapped one falls back to the raw name rather than to a blank row.
- A grep-style test that the mock conversation strings appear nowhere in shipped source, mirroring the forbidden-token test the kits have. That is what actually keeps AC #6 true rather than true-today.

### 8. What I cannot verify here, and the pause

- **AC #4 (90 seconds)** is a live measurement. It needs two ships, openclaw configured, and a real model call. Unverifiable in unit tests by nature.
- **AC #5's kill/reopen half** is an app-lifecycle behaviour.
- **AC #3 end to end** needs an agent that actually runs `install.setup`.

All three are the walkthrough. Per your instruction I will stop after this task and stand up the rig: two fakezods with the assembled desk, openclaw pointed at one as the bot, iOS simulator on a dev build with the splash forced. Expect to seat openclaw's ship in the workspace group by hand — `resolveWorkspaceAgent` needs hosting-API endpoints that local ships do not have, and TASK-16 deliberately provisions without an agent rather than failing in that case.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Research notes, before any code.

**AC #1 is already done.** TASK-11's `workspaceLanding` handoff plus `useWorkspaceLanding` already lands the user in the real provisioned conversation after interstitial 2. Nothing to build for it.

**AC #3's mechanism is already mounted at the landing.** TASK-4's `AgentActivity` sits at the two existing `ThinkingState` slots — `DetailView.tsx` and `ListPostCollectionView.tsx` — and the landing conversation is one of them. `projectTaskRows` merges the durable ContextLens spine with the live `%presence` overlay.

**TASK-4's owner-only caveat does not bite here.** The lens flows bot → owner only, which makes shared-channel durability false in general. But the onboarding user *is* the bot's owner, so the durable path applies for this task's moment. Worth stating because TASK-4 left its AC #3 unchecked partly on that limitation.

**Step labels come from `toolName`** (`context-lens.ts:664`), so rows read "Assembled context" / "Checking the web" rather than PLAN.md's "Drafting plan → Saving grocery list → Ready". Domain-named steps would need a new field on the lens, a change to `desk/sur/steward/lens.hoon`, and an openclaw emitter — TASK-4 flagged this as separate work. Hence the §4 decision, where the middle option is a tool-name → friendly-label map in the presentation layer.

**`EmptyChannelNotice` already has the exact seam this needs.** It short-circuits on `isDefaultPersonalChannel` to `<WayfindingNotice.EmptyChannel />`. A workspace-awaiting-setup branch is the same move, and it self-clears: "the room is empty" and "we should explain why" are the same condition, so they should be the same branch. No synthetic post, no dismissal logic.

**The mock is in exactly one place in the flow, and that place creates nothing.** `mockConversation.ts` → `buildMockPost.ts` → `BotChatPreview` → `GroupsPane`, as a 368px illustration. `GroupsPane` is an explainer: its `onActionPress` only advances the pane, and the invite link it shows is the *home group's*, not the workspace's. The non-hosting branch of the same pane already renders a static image, so removing the mock leaves a working pane rather than a hole.

**Provisioning genuinely can be unfinished at landing.** TASK-16 fires at Purpose and the agent then has to run `install.setup`, so an empty room is a real arrival state rather than a hypothetical — which is what AC #5 is about.

## Implemented — `18ad2240d2`

Built per the approved decisions: the label map (§4 option b), delete the mock (§5).

### What landed

- **`WayfindingNotice.WorkspaceSetup`** — the honest in-progress state, two variants. Setup pending offers the invite; setup done with an empty room says so instead.
- **A branch in `EmptyChannelNotice`**, above the `isDefaultPersonalChannel` one it copies.
- **`isWorkspaceConversation`** in shared logic — the predicate, pure and exhaustively tested, rather than inline in the component. Matches the conversation only, never the artifact place.
- **Task-row labels** now go through the existing `formatComputingToolCallLabel`, with `web_search` and `tlon` added to `TOOL_LABELS`.
- **The mock deleted** — `BotChatPreview`, `mockConversation.ts`, `buildMockPost.ts`, the barrel, the fixture, and the bot-ship resolution effect that fed it. Plus `BOT_PREVIEW_FALLBACK_USER_SHIP_ID` and two now-dead `GroupsPane` props.

### The reuse that avoided a second vocabulary

I was about to add a tool-label map, then found one: `TOOL_LABELS` and `formatComputingToolCallLabel` already existed in `computingStatus.ts`, used by the presence overlay. The lens timeline was doing its own `replaceAll('_', ' ')`, which is why rows read differently depending on which source produced them. Both paths now share it.

One subtlety: the timeline's title was `` `Using ${formatToolName(...)}` ``, so delegating naively would have produced "Using Running a command". The call site now uses the shared label as the complete title, and the terse `formatToolName` stays in the compact detail line where `read x3` beats a sentence.

### An honest limit on §4

The tools are **host** tools — `exec`, `read`, `web_fetch`, `web_search`, `tlon`. So this delivers readability, not PLAN.md's "Drafting plan → Saving grocery list → Ready". Nothing in the lens knows it is drafting a plan; `tlon` covers both posting a message and writing a note, which is why its label stays neutral ("Working in Tlon") rather than guessing. Domain naming genuinely needs option (c) — a new lens field, a Hoon change, an openclaw emitter — and I would rather flag that than script copy that could drift from what the agent did.

### AC status

- **#1 done.** TASK-11's landing already delivers it; re-read rather than rebuilt.
- **#2 done.** The notice presents one clear action, and it is the useful one while there is nothing to do about the wait.
- **#6 done**, and guarded: a grep test over the whole Wayfinding tree, because the failure mode is reintroduction rather than the current state.
- **#3 not checked.** The mechanism is mounted and the labels are now readable, but nobody has watched rows advance from landing to a completed artifact with a real agent.
- **#4 not checked.** 90 seconds is a live measurement.
- **#5 half done.** The in-progress state is built and tested; the kill/reopen half is an app-lifecycle behaviour.

### Verification

`pnpm -r tsc` clean. app 563, api 837, shared 513 — all passing. eslint clean on every touched file (the two remaining warnings in `SplashSequence.tsx` are pre-existing unescaped quotes outside my diff). Prettier clean. `pnpm run build:web` exits 0.

**Correcting my own AC #2 call.** I checked it, then re-read it: "A starter artifact is visible at landing **and** one clear next action is presented". I delivered the second half. The starter artifact is produced by the agent following `instructions/setup.md` (TASK-13) and nothing has executed that, so "visible at landing" is unverified. Unchecked — it goes on the walkthrough list with #3, #4 and #5's other half.

So the honest tally for this task is: **#1 and #6 done**, and four criteria that all reduce to the same missing thing — a live agent actually running. That is what the rig is for.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The landing's client half: an honest in-progress state, readable task-row labels, and the mock conversation deleted.

**The empty room is a real arrival state, not an edge case.** Onboarding lands the user as soon as the workspace channel row syncs, which can be well before provisioning has seated the agent and long before the agent has run its setup instruction. "This is the start of the channel" is true there and useless. `EmptyChannelNotice` already had the seam — it short-circuits on `isDefaultPersonalChannel` — so the workspace branch is the same move, and it self-clears, because "the room is empty" and "we should explain why" are the same condition. Two variants: setup pending offers the invite (nothing to do about the wait, and bringing in the other person is what makes the workspace worth having); setup done with an empty room is a wait that resolved into nothing and says so.

**Reuse found late, and worth it.** I was about to add a tool-label map when I found one: `TOOL_LABELS` and `formatComputingToolCallLabel` already existed in `computingStatus.ts`, used by the presence overlay, while the lens timeline did its own `replaceAll('_', ' ')`. That is why rows read differently depending on which source produced them. Both paths now share the map, with `web_search` and `tlon` added to complete it.

**An honest limit on that.** These are *host* tools — `exec`, `read`, `web_fetch`, `web_search`, `tlon` — so this delivers readability, not PLAN.md's "Drafting plan → Saving grocery list → Ready". Nothing in the lens knows it is drafting a plan, and `tlon` covers both posting a message and writing a note, which is why its label stays neutral. Domain naming needs the agent to declare its own steps: a new lens field, a Hoon change, and an openclaw emitter. Flagged as a follow-up rather than faked with scripted copy that could drift from what the agent did.

**The mock is deleted, not hidden.** `BotChatPreview` and its scripted broccoli-gardening exchange rendered in `GroupsPane`, whose other branch already showed a static image — so both branches use it now, and the component, its data, its builder, its fixture, and the bot-ship resolution effect that existed only to feed it are gone. A grep test over the whole Wayfinding tree guards the real failure mode: someone needing a plausible screenshot and pasting a scripted exchange back in.

**Tests.** 5 on the notice, 8 more on the workspace-conversation predicate in shared, 26 in the grep guard, 1 extending the label map's coverage. app 563, api 837, shared 513 — all passing. `pnpm -r tsc` clean, eslint clean on every touched file, prettier clean, `pnpm run build:web` exits 0.

**Only #1 and #6 are claimed.** #2's "starter artifact visible at landing", #3 end to end, #4's 90 seconds, and #5's kill/reopen half all reduce to one missing thing: a live agent actually running. I initially checked #2 and corrected it — I built the "one clear next action" half, not the artifact half, which belongs to the agent. Those four go to the walkthrough, which is where this milestone's accumulated observation-only criteria get settled.
<!-- SECTION:FINAL_SUMMARY:END -->
