---
id: TASK-4
title: Land agent task-progress rows in conversation
status: In Progress
assignee:
  - james@tlon.io
created_date: '2026-08-19 13:47'
updated_date: '2026-08-19 19:22'
labels:
  - workspaces
  - agent
  - ui
milestone: m-1
dependencies: []
references:
  - PLAN.md
  - commit 6ee72347e
priority: medium
type: feature
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PLAN.md calls for live task rows in conversation showing agent progress (e.g., "Drafting plan → Saving grocery list → Ready") as the post-onboarding engagement hook, and identifies the unmerged agent task rows work (commit 6ee72347e) as ready to use.

Bring the task-rows prototype onto develop so an agent working in a workspace conversation shows visible progress rows that update as work advances and resolve when done. This is what makes the 90-second first-artifact target feel alive rather than silent.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Agent work in a conversation renders as progress rows with distinct in-progress and completed states
- [x] #2 Rows update live as the agent advances through steps and reach a terminal state when work completes or fails
- [ ] #3 State survives app restart: reopening the conversation shows the correct current row state
- [x] #4 Rendering degrades gracefully on clients that do not recognize the row content
- [x] #5 Tests cover row rendering for in-progress, completed, and failed states
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation plan

### The task is not what the title suggests

"Land the task-rows prototype" reads like a cherry-pick. It is not. `6ee72347e` is 593 lines of polished, reduced-motion-aware presentation driven by a hardcoded `setTimeout` mock — it has no data source of any kind. It merges clean and breaks nothing, but landing it as-is delivers a cosmos fixture, not a feature. Every line of data plumbing is still to be written, and **AC #3 is 100% unimplemented**.

Adopting the component is still right: the motion and accessibility work is the genuinely tedious part, and rebuilding it would be waste. Treat it as the view layer and write the adapter beneath it.

### The real decision: which store backs the rows

Three mechanisms exist and none satisfies the criteria alone.

- **`%presence`** is live and sub-second and, because openclaw passes `disclose: []`, **public to every member of the channel**. But it is ephemeral by construction — a 90s ship-side timeout, cleared when the run ends, expired entries dropped on load. It also has no step model at all: `tlon.computing-status.v1` is a boolean plus a deduped list of active tool names. No sequence, no completion, no failure, no ordering.
- **ContextLens** is durable and already models steps properly — ten run statuses including `error`/`timed_out`/`aborted`, per-tool runs with `callIndex`, timings, and errors — resolved db-first from a local SQLite table with a scry fallback. But **it flows bot → owner only**. `visibility: 'participants'` exists as a client-side field, defaults to `'owner'`, is never used to route, and does not appear in `desk/sur/steward/lens.hoon` at all.
- **The post blob** would be durable *and* group-replicated, and TASK-3 just established the pattern.

**Recommendation: ContextLens as the durable spine, presence as the live overlay, and accept that durable rows are owner-only for now.** Reasons:

The hero scenario in PLAN.md is the post-onboarding 90-second moment, where the user *is* the bot's owner. Owner-only durability covers it exactly. Other members still see live progress via presence while work is happening — they just do not get history after a restart. That is a real limitation and the plan states it rather than hiding it.

Extending durability to all members means putting a row summary on the post blob. That is the right eventual answer and TASK-3's `interactive-surface` is the template, but it is a protocol change with an agent-side writer, which is a materially bigger task than this one is scoped for. I would rather ship the owner path, prove the rows are worth having, and open that as its own task than smuggle a protocol extension in here.

### Work

**1. Land the component, minus its demo surface.** Cherry-pick `6ee72347e`, then:
- Drop `export * from './demo'` from `AgentTaskRows/index.ts` and import the mock directly in the fixture. As landed, `buildAgentTaskDemoRows` becomes part of the public `@tloncorp/app` surface and ships in the bundle.
- Fix the alphabetical position of the new `ui/index.tsx` export line.
- Remove the spinning `Refresh` icon from the `failed` pill, or wire it to `retryLensRun` (which already exists in `shared/src/store/lensActions.ts`). A spinner implying auto-retry that never retries is worse than no affordance. I lean toward wiring it, since the function is there and a failed run the user cannot retry is a dead end.

**2. Write the adapter — `useAgentTaskRows(channelId)`.** The projection is mostly already written: `ContextLens/RunTimeline.tsx` exports `buildRunTimeline(events, latest, now): TimelineRow[]`, whose `{key, title, detail, meta, tone, active}` maps onto `AgentTaskRow` nearly field-for-field. New logic is the merge:
- **Durable base:** the most recent lens run for the conversation, via `useRecentContextLensRuns` / `ensureContextLensRun`, projected through `buildRunTimeline`. `tone` + `active` → `status`; run-level `FINAL_STATUSES` decide whether the last row is `completed` or `failed`; `sequence` is synthesized from index.
- **Live overlay:** `useConversationComputingState` for the in-flight step, so the current row updates sub-second rather than waiting for lens sync. Presence wins only for the currently-running row; everything terminal comes from the lens.
- **Precedence:** follow the `prefersEvent`/`preferred` merge policy `ContextLensPanel.tsx` already uses, where a finalized synced row overrides a stale in-flight event.

Keep this a pure function over its two inputs plus a thin hook wrapper, so the projection is testable without rendering.

**3. Mount it.** Replace or sit beside `<ThinkingState>` at its two existing slots — `DetailView.tsx:88` and `ListPostCollectionView.tsx:58` — reusing the `useShouldShowThinkingState` gate. Render nothing when there are no rows, exactly as `ThinkingState` returns null today.

Open question I will resolve while building: whether rows *replace* `ThinkingState` or appear above it. Replacing is cleaner and avoids showing "Thinking…" and a running row simultaneously; I will replace unless it looks wrong in the fixture.

**4. Tests.** `packages/app` vitest runs logic tests with react-native mocked and has no jsdom or testing-library, so component-render tests are not available without standing up a Tamagui harness — the same constraint that applied to the render gate in TASK-10.

So AC #5 is met at the projection layer, which is where the real logic is: a `useAgentTaskRows.test.ts` over the pure projection asserting in-progress, completed, and failed row sets from representative lens payloads, plus the presence-overlay precedence and the empty case. Visual coverage goes in the cosmos fixture, extended from the self-referential demo to the three states. I will say plainly in the task notes that there is no automated render coverage rather than implying AC #5 is stronger than it is.

**5. AC #4 comes free but should be checked.** Nothing new goes on the wire — presence blobs already parse defensively via `parseComputingStatus`, and the lens pointer is an existing registered blob entry that degrades to the upgrade blockquote. Worth one test that an unparseable computing-status blob yields no rows rather than throwing.

### Verification

`pnpm -r tsc`, `packages/app` vitest, prettier, and the cosmos fixture for the visual states. No ship or desk work — this is client-only.

### What this does not do

- **Non-owner members get live-only rows, no history.** Stated above; the fix is a post-blob row summary and belongs in its own task.
- **No new step vocabulary.** Rows are whatever `buildRunTimeline` already emits from a lens run. PLAN.md's illustrative "Drafting plan → Saving grocery list → Ready" is kit-flavoured phrasing that would need the agent to emit named steps; today the lens gives tool-level granularity. If the onboarding moment needs that exact scripted copy, that is a kit/agent change, not this one — worth confirming which you want before I start.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Research findings, part 1 — the three existing mechanisms, and why none of them alone satisfies the acceptance criteria.

AC #3 ("state survives app restart") is the crux of this task, and it is not a detail the prototype can be assumed to have handled. Here is what develop actually has:

| | live updates | survives restart | visible to all members | failure states |
|---|---|---|---|---|
| `%presence` (`%computing`) | yes, sub-second | **no** | **yes** | no |
| ContextLens | yes (subscription) | **yes** | **no — owner only** | **yes** |
| post blob | via post edits | yes | yes | whatever we define |

**`%presence` is ephemeral by construction.** `desk/sur/presence.hoon` opens by describing itself as "short-lived personal activity types"; entries carry `timing [since=@da timeout=(unit @dr)]`, `desk/app/presence.hoon` sets a `default-timeout` of `~m1` for `%computing`, and on load it ignores "any that have expired". OpenClaw's publisher sets an explicit 90s ship-side timeout (`ACTIVE_PRESENCE_TIMEOUT_SECS = 90` in `monitor/computing-presence.ts`) and re-publishes while active. So `ThinkingState` cannot satisfy AC #3 no matter how it is wired — the data is gone.

It is, however, **public**: openclaw passes `disclose: []`, and `presence.hoon:378` comments "an empty disclose means public", fanning the update to everyone subscribed to the channel context. So presence is the only mechanism today that shows progress to *other members* of a shared conversation.

**ContextLens is durable and already models rows, but is owner-only.** The durability chain is well built: the `tlon-context-lens` post-blob entry carries only a pointer (`{lensId, botShip}` — `content-helpers.ts:681`), the body lives on the owner ship's `%steward` lens module, and `ensureContextLensRun` (`shared/src/store/lensActions.ts`) resolves db-first from the local `contextLensRuns` SQLite table, scrying and caching on miss. It also syncs **live**, not just at the end: `subscribeToLensUpdates` is wired in `setupLowPrioritySubscriptions` (`sync.ts:2455`) and there are per-phase `ContextLensEvent`s.

And `ContextLensToolRun` is already a task row: `{id, callIndex, name, phase, startedAt, completedAt, durationMs, status: 'running'|'completed'|'error'|'blocked', argumentSummary, resultSummary, error}`, ordered by `callIndex`, under `tools.runs`. The run-level `ContextLensStatus` adds the terminal vocabulary AC #2 and #5 want: `completed`, `no_reply`, `timed_out`, `aborted`, `error`.

**But the lens flows bot → owner only.** `desk/app/steward.hoon` describes the owner as the "lens send target", and the client type's `visibility: 'owner' | 'participants' | 'internal'` is **not honoured anywhere** — it is set (defaulting to `'owner'`, configurable via `visibilityDefault`) but never used to route, and `desk/sur/steward/lens.hoon` contains no `visibility` field at all, so it never reaches the wire. In a shared workspace channel only the bot's owner would see lens-backed rows; everyone else sees nothing.

**Consequence for this task.** PLAN.md wants progress visible in a shared workspace conversation. Presence gives shared visibility but evaporates; ContextLens gives durability and failure states but only to one person. Satisfying AC #1–#5 together therefore needs either a third store or a deliberate combination, and that decision — not the animation work — is the substance of this task. The post blob is the obvious third option, and TASK-3 just established that exact pattern (`interactive-surface`: durable, replicates with the post, degrades to the upgrade blockquote on old clients, which is AC #4 for free).

Research findings, part 2 — what `6ee72347e` actually is.

**It is a view, not a feature.** 6 files, 799 insertions, 0 deletions, on `origin/agent/agent-task-rows` — a single commit one off develop. `AgentTaskRows.tsx` is 593 lines of pure presentation whose entire import set is `@tloncorp/ui`, react, react-native, reanimated, react-native-svg, tamagui. It touches **no** `@tloncorp/shared`, `@tloncorp/api`, `db`, `store`, presence, or network code. The remaining ~200 lines are a cosmos fixture, a hardcoded mock generator, a barrel, and one export line.

The rows in the demo are literally `"Map agent turn events"`, `"Shape Ochre task rows"`, `"Prepare Messenger fixture"` — self-referential descriptions of building the component, driven by a `setTimeout` chain over `AGENT_TASK_DEMO_TICKS = [600,900,2400,1400,2400,600]`. The only component state is `manualExpanded` and `lastAutoExpandedId`, both `useState`. **There is no data source at all**, durable or otherwise, so 100% of AC #3 is unimplemented — there is nothing yet to survive a restart.

**It merges clean.** Verified with `git merge-tree --write-tree HEAD 6ee72347e` — no conflicts. `AgentTaskRows` does not exist on develop, so no name collision, and develop has not touched any file it modifies. Every icon (`Checkmark`, `Close`, `ChevronDown`, `Refresh`) and token (`$positiveActionText`, `$negativeActionText`, `$shadow`) it uses already exists, `useReducedMotion` has precedent in `conversationScrollChrome.tsx`, and `react-native-svg` resolves by hoisting exactly as `Wayfinding/SegmentedSpinner.tsx` already does.

**Row model** — four states, not the three the acceptance criteria mention:
```ts
type AgentTaskStatus = 'pending' | 'running' | 'completed' | 'failed';
type AgentTaskRow = {
  id: string; title: string; status: AgentTaskStatus; sequence: number;
  meta?: string; details?: {label,value}[]; progress?: number;
};
```
Ordering is array order only — the component never sorts, and `sequence` is display-only, rendered inside the ring glyph, never validated against index. Animations are thorough and reduced-motion aware throughout.

**Two things worth knowing before wiring it:** row entry animation is `FadeInUp.delay(index * 80)`, so appending or reordering rows re-staggers by position rather than identity; and the `failed` pill contains a permanently spinning `Refresh` icon implying auto-retry, but there is **no retry callback** — the spinner is decorative and would need either wiring or removal, since suggesting a retry that never happens is worse than not suggesting one.

**Landing hygiene:** `index.ts` re-exports `./demo`, and `ui/index.tsx` re-exports the barrel, so the mock generator would become part of the public `@tloncorp/app` surface and ship in the bundle — drop that. The new export line is also inserted out of alphabetical order.

**The adapter is largely already written.** `ContextLens/RunTimeline.tsx` exports `buildRunTimeline(events, latest, now): TimelineRow[]` with `{key, title, detail, meta, tone, active?}`, producing ordered rows keyed `context | queue | model | tools | delivery | live` and titles like "Assembled context", "Using <tool>", "Delivered reply", "Run failed". That maps onto `AgentTaskRow` nearly field-for-field — `key→id`, `title→title`, `meta→meta`, `detail→details[0].value`, `tone`+`active`→`status`, plus a synthesized `sequence`. It is currently rendered as a static dot-and-connector timeline with no animation. So the projection logic exists and is proven; what is missing is the durable-plus-live merge and a nicer renderer.

**Mount points**, both existing `<ThinkingState>` slots, gated by `useShouldShowThinkingState`: `DetailView.tsx:88` and `ListPostCollectionView.tsx:58`. The per-message alternative is `StaticChatMessage.tsx:247`, where `ContextLensBadge` already renders.

**One caveat the durability story needs:** the ContextLens *live SSE gateway* stream is web-only (`useContextLensGatewayConfig` returns null unless `Platform.OS === 'web'`) and flag-gated. The *durable synced table* has neither restriction — `subscribeToLensUpdates` sits in `setupLowPrioritySubscriptions`, not behind a platform check — so on mobile the near-live path is the sync subscription plus presence for sub-second, which is fine.

Execution log — landed in `b435a48c7`.

**AC #3 is checked with a caveat, and I want that visible rather than buried.** Row state survives a restart *for the bot's owner*, which is the durability the criterion asks for and covers PLAN.md's hero scenario, where the user is the owner. It does not survive for other members of a shared channel, because the lens never reaches them — they keep the presence indicator, which is live-only. I have checked the criterion because the mechanism is genuinely durable where it applies, but the shared-member gap is real and unresolved; the fix is a post-blob row summary and belongs in its own task.

**What I built.** `projectTaskRows` is a pure function merging two sources; `useAgentTaskRows` feeds it and exposes a wired retry; `AgentActivity` mounts at the two existing `ThinkingState` slots and falls back to that indicator when there are no rows.

**A decision I changed while building.** The plan proposed a live-only row path so non-owners would get rows from presence alone. I dropped it. Presence carries no step structure, so those rows would have been a single synthetic row with a label — strictly worse than `ThinkingState`, which shows the same label plus avatars and multi-ship aggregation. Falling back to the existing component is both simpler and better for that case, and it makes the change purely additive with no regression for anyone. The cost is a brief swap from indicator to rows once the first lens event syncs.

**Three prototype defects fixed rather than ported**, all flagged during research: the barrel leaked the demo mock into public API, the failed pill span a Refresh icon implying an auto-retry that never happened, and the export line was misordered. The retry is now wired to `retryLensRun` and rendered only when a handler exists, so a failed run is recoverable rather than a dead end.

**AC #5 caveat.** `packages/app` runs vitest over logic with react-native mocked and has neither jsdom nor testing-library, so there is no automated render coverage — the same constraint that applied to TASK-10's render gate. The three states are covered by 11 tests over the projection, which is where the logic actually is, plus a new `states` cosmos fixture for visual inspection. Someone should still look at it in cosmos and in a real conversation.

**Not done, and worth knowing:** rows are whatever `buildRunTimeline` already emits — tool-level granularity like "Assembled context" and "Checking the web", not PLAN.md's illustrative "Drafting plan → Saving grocery list → Ready". Domain-named steps would need the agent to emit them, which is a kit/agent change. I raised this before starting and proceeded with tool-level since that is what exists; if the onboarding moment needs the scripted copy, that is a separate piece of work.

**Verification:** 468 app tests pass (14 in this component), `packages/app` typechecks with only the pre-existing unbuilt-editor error, and eslint is clean on every file I touched — the two warnings it reports are pre-existing and outside my diff.

Correction to the line above: AC #3 is **left unchecked**, not "checked with a caveat" — the earlier note contradicted the actual state of the checkbox.

Two reasons to leave it open. First, I verified the *mechanism* is durable (the lens is read from the SQLite `contextLensRuns` cache with a scry fallback, so the data outlives a process) but I did not empirically restart an app and confirm the rows come back correct. That is a behaviour-level check the criterion is asking for and I have not run it. Second, it holds only for the bot's owner; other members of a shared channel see the presence indicator, which is live-only, so for them "reopening the conversation shows the correct current row state" is false in any meaningful sense.

What would close it: a manual restart check in a real conversation with a completed run, plus a decision on whether shared-member durability is in scope. If it is, the mechanism is a row summary on the post blob using the TASK-3 pattern, which is its own task.

The other four criteria are met and verified: rows render with distinct states, advance live and resolve to a terminal state, degrade to the existing indicator where no run data exists, and are covered by 11 projection tests plus a cosmos fixture.
<!-- SECTION:NOTES:END -->
