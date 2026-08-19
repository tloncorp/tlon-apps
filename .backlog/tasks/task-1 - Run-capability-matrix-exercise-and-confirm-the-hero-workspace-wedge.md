---
id: TASK-1
title: Run capability matrix exercise and confirm the hero workspace wedge
status: Done
assignee:
  - james@tlon.io
created_date: '2026-08-19 13:46'
updated_date: '2026-08-19 14:17'
labels:
  - workspaces
  - product
milestone: m-0
dependencies: []
references:
  - PLAN.md
  - .backlog/docs/doc-1 - Workspace-capability-matrix-and-hero-wedge-decision.md
priority: high
type: spike
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PLAN.md proposes making Workspace the product primitive with Groups as hidden infrastructure. Before building, the team needs to validate the first activation wedge (meal planning is the recommended default) via a structured exercise.

Capture each candidate workspace idea in a matrix with columns: user job, people or agents involved, required authenticated action, durable data produced, trigger (tap / message / event / schedule), possible today?, missing dependency. Cross off anything requiring arbitrary generated UI, unsupported integrations, or unclear permissions. Cluster what remains into templates and select one shared-domestic hero (candidates: weekly meals + grocery list, garden plan + reminders, household tasks + routines).

The outcome gates the content of the starter kit and the onboarding starter options in milestone 2.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Capability matrix exists as a Backlog document or docs/ file covering all candidate ideas with the seven columns from PLAN.md
- [x] #2 Ideas requiring arbitrary generated UI, unsupported integrations, or unclear permissions are explicitly crossed off with the blocking reason recorded
- [x] #3 One hero template is selected and recorded with rationale
- [x] #4 The three starter options for onboarding screen 1 are confirmed or revised based on the matrix
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation plan (spike — deliverable is a document + decision, no app code)

### Deliverable and location
A Backlog document `capability-matrix` created via `document_create` (lives in `.backlog/docs/`), referenced from this task. Chosen over `docs/` because the matrix gates backlog milestone content and is a product decision record, not engineering reference; the repo's `docs/` tree is engineering docs. (Flag for approval: say the word if you'd rather have `docs/product/capability-matrix.md` in the repo proper.)

### Step 1 — Capability baseline (DONE, recorded in task notes)
The 12-point codebase inventory in the task notes is the ground truth for the "possible today?" column. Reproduce its summary table at the top of the matrix document so the scoring is auditable.

### Step 2 — Enumerate candidate workspace ideas (~15)
Sources: the three PLAN.md candidates; existing group templates (`packages/api/src/types/groupTemplates.ts`: book club, cooking club, music, running club…); the book-club kit on the kits branch; OpenClaw nudge product framings (`packages/openclaw/src/nudge-messages.ts`: morning news summary, recurring jobs); plus common shared-domestic jobs. Seed list:
1. Weekly meals + grocery list
2. Garden plan + shared reminders
3. Household tasks + recurring routines
4. Shared family calendar / scheduling coordination
5. Grocery ordering / errands with online purchase
6. Shared budget / expense tracking
7. Trip planning
8. Book club (reading schedule + discussion)
9. Pantry inventory + restock alerts
10. Pet care schedule
11. Home maintenance log + seasonal reminders
12. Morning briefing / news digest (solo)
13. Running/fitness club with training plan
14. Party/event planning
15. Kids' school coordination (permission slips, events)
Add/drop during execution; the matrix must cover at least all shared-domestic candidates named in PLAN.md.

### Step 3 — Fill the seven-column matrix
Columns exactly as PLAN.md rollout §1: user job | people or agents involved | required authenticated action | durable data produced | trigger (tap/message/event/schedule) | possible today? | missing dependency.
Scoring rules:
- "Possible today?" = achievable on develop with the current agent tool surface (notes CRUD, group provisioning, cron-via-chat, message-shaped notifications). Use three values: **yes / yes-degraded** (works but via chat text instead of cards/UI) / **no**.
- "Missing dependency" must name the concrete blocker from the baseline (e.g. "A2UI group-channel render gate", "blob-carrying post edit", "no calendar integration") and cross-reference the existing backlog task that covers it where one exists (task-4, task-8, task-9, task-10…). A dependency with no covering task is a flagged finding.

### Step 4 — Cross off per PLAN.md criteria
Explicitly strike (kept in the doc with strikethrough + blocking reason, per AC #2) anything requiring:
- **Arbitrary generated UI** — anything beyond A2UI's 6 component types / 2 actions, or needing the mini-app JS runtime (research-only, 385fbe9f0).
- **Unsupported integrations** — calendar, email, shopping/checkout, smart home, school portals: no first-party integrations exist; MCP OAuth catalog is hosting-side and effectively empty.
- **Unclear permissions** — cases where actor validation or write authority can't be cleanly expressed today (e.g. money movement; note the group-read vs per-notebook-write role split as a watch item, not a blocker, for notes-backed ideas).

### Step 5 — Cluster survivors into templates and select the hero
Cluster by shape (e.g. "recurring plan + shared list artifact", "log + reminder", "schedule + discussion"). Score the shared-domestic finalists (meals, garden, household tasks) against PLAN.md's activation criteria: immediately generative, naturally collaborative, visible durable artifact, recurring behavior without integrations, and feasibility-today from the matrix. Record the selection AND the runner-up rationale in the document (AC #3). PLAN.md predicts meal planning wins; the exercise must show its work rather than assume it.

### Step 6 — Confirm or revise onboarding screen-1 starter options
Re-derive the three starter options for interstitial 1 from the surviving template clusters (AC #4). Record confirmed/revised list in the document with one-line feasibility notes each, and note the consequence for TASK-5 (interstitial 1) and TASK-13 (meal-planning kit content).

### Step 7 — Finalize
Add the document to this task's references, append a decision summary to task notes, verify each AC against the document, then follow the task-finalization guide.

### Risks / open questions
- Every candidate that wants live interactive cards is "yes-degraded" today (DM-only rendering + blob-destroying edits). The hero must be compelling with chat + notes artifacts alone, with cards as the m-1 upgrade path — this is the single biggest constraint the matrix will surface.
- The agent cannot mint invite links, so "invite a partner" during onboarding must go through app-side lure APIs, not the agent (relevant to TASK-11/TASK-16, worth recording in the matrix doc).
- Reminders are message-shaped pushes only; ideas whose core value is precise/silent notifications score lower.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Research findings (capability baseline, branch james/agentic-workspace @ c3c5b458b — develop + backlog setup only; all prototype work is unmerged but present locally: 0f5ebfc28 kits runtime, 12c2ae54b kits UI, 385fbe9f0 mini-app demo, 6ee72347e task rows):

| # | Capability | Status today | Key blocker if partial |
|---|---|---|---|
| 1 | Scheduled agent work | ✅ core `cron` tool, owner-only, chat-created | no app UI for schedules; scheduler lives in OpenClaw core |
| 2 | Interactive cards (A2UI) | ⚠️ agent can post cards, but they render in DMs ONLY (`StaticChatMessage.tsx:148` gates on `isDmChannelId`); components limited to Text/Row/Column/Card/Divider/Button; actions limited to `tlon.sendMessage`/`tlon.navigate` | agent `posts edit` has no `--blob` and writes `blob: null` — an edit WIPES the card (`postsApi.ts:258`); group channels strip A2UI blocks |
| 3 | Renderer registry | ⚠️ exists but closed — 4 hardcoded built-ins (`ComponentsKitProvider.tsx:28-47`) | no registration API |
| 4 | Channel types | ⚠️ 6 fixed types; `'custom'` coerces to `'chat'` (`channelActions.ts:46`) | new type needs Hoon kind + union member |
| 5 | Notes channels | ✅ full agent CRUD (26 ops), reads inherit group perms | writes need explicit per-notebook role (owner/editor/viewer) |
| 6 | Group provisioning | ✅ `scaffoldPersonalGroup`/`createGroupFromTemplate` create secret group + channels in one shot; agent has `groups create-owned` | agent CLI cannot generate invite links (lure) — direct ship invites only |
| 7 | Agent seating | ✅ hosting provisions bot moon; cordon+join+poll pattern exists (`BotChannelRulesScreen.tsx:185-236`); home group created hosting-side | — |
| 8 | Session routing | ✅ stable per-nest group sessions (`session-route.ts:43-53`) | skipped if route resolves to main session (core config) |
| 9 | Agent tool surface | ⚠️ `tlon` CLI tool + core `message`/`read`/`cron`/`exec`/`web_fetch`/`web_search` | NO calendar/email/shopping/smart-home; generic MCP OAuth plumbing exists but provider catalog is hosting-side (only disabled `supabase` today) |
| 10 | Task-progress rows | ⚠️ ephemeral `%presence`-based ThinkingState + post-hoc ContextLens exist | persistent animated AgentTaskRows is unmerged (6ee72347e) |
| 11 | Group blob / workspace descriptor | ❌ does not exist — `$group` has no blob field | needs `$group` blob (backend) or JSON-in-description squat like `StructuredChannelDescriptionPayload` |
| 12 | Push/reminders | ⚠️ works only as chat messages (cron → DM → push); `%activity` event set is closed | no silent/structured/actionable notification type |

Implication for the matrix: 'possible today?' must be scored against THIS table, and 'missing dependency' should point at existing m-1/m-2 backlog tasks where one already covers the gap (e.g. task-9 = blob-carrying edit, task-8 = group descriptor, task-4 = task rows).

Verification of the two load-bearing code claims (both confirmed by direct read, not grep):
- `packages/app/ui/components/ChatMessage/StaticChatMessage.tsx:148` — `const canRenderA2UI = isDmChannelId(post.channelId);` and lines 150-165 filter `block.type !== 'a2ui'` out of both `content` and `lastEditContent` when false. Cards are therefore invisible in group channels, which is where workspaces live.
- `packages/tlon-skill/scripts/commands/posts.ts:123-131` — `PostEditInput` has no `blob` field; `packages/api/src/client/postsApi.ts:~258` writes `blob: blob ?? null` into the essay. An agent edit therefore erases an existing card rather than updating it.

Decision recorded: hero = weekly meals + grocery list. The deciding argument is feasibility rather than novelty — meals is the only shared-domestic cluster-A candidate whose core loop is not blocked by the DM-only card gate, because a meal plan and grocery list are legitimately documents, so notes-backed artifacts are the real product rather than a placeholder. Household tasks scores better on collaboration but its core loop (tap to mark done) is exactly the blocked capability; recorded as runner-up and proposed as the acceptance test for the interactive-card work.

Onboarding screen 1: PLAN.md's three starters confirmed, with per-option day-one framing requirements so garden and household tasks do not disappoint under current constraints.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Summary

Ran the capability matrix exercise from PLAN.md rollout step 1 and confirmed **weekly meals + grocery list** as the hero workspace wedge. Deliverable is `doc-1 — Workspace capability matrix and hero wedge decision` in `.backlog/docs/`. No application code changed; this is a spike whose output is a decision document.

## What was produced

- **Capability baseline** — a 12-point inventory of what this branch (`c3c5b458b`, = develop plus backlog setup) can actually do, with file and line citations. Used as the scoring authority for "possible today?" so the matrix is auditable rather than assumed.
- **17-row matrix** with PLAN.md's seven columns, scored yes / degraded / no.
- **Five ideas crossed off** with blocking reasons: shared family calendar, grocery checkout, shared budget, school logistics (unsupported integrations and/or unclear permissions), and "describe an app and the agent builds it" (arbitrary generated UI, research prototype only).
- **Four clusters** of survivors; the hero comes from cluster A (recurring plan producing a shared list).
- **Hero selection** scored across six activation criteria against the two runners-up, with rationale and a named runner-up.
- **Screen 1 starter options** confirmed as PLAN.md proposed, with day-one framing requirements added per option.

## Key finding

Two capability facts dominate the decision and were verified by direct code read: A2UI cards render in DMs only (`StaticChatMessage.tsx:148` filters a2ui blocks out of group channels), and an agent post-edit drops the blob (`PostEditInput` has no `blob` field; `postsApi` writes `blob ?? null`), so editing a card destroys it. Since workspaces are group channels, **every tap-driven workspace idea is blocked today.** Meals wins because its artifacts are legitimately documents, so the notes-backed version is the real product and interactive cards are a later upgrade rather than a prerequisite.

## Downstream effects

- **TASK-5** (interstitial 1) can build against the confirmed three-option set.
- **TASK-13** (meal-planning kit) is unblocked; should target notes-backed artifacts, not cards.
- Household tasks proposed as the second kit and as the acceptance test for TASK-9/10/12.

## Follow-ups surfaced (not acted on)

Four gaps with no clean covering task, recorded in section 6 of the document: the group-channel A2UI render gate has no owning task and is on the critical path for every card feature; the agent cannot mint invite links, so invitation cannot be an agent action (TASK-11/16/24); notes writes need an explicit editor role granted at provisioning (TASK-16/13); cron is owner-only with no UI path (TASK-23).
<!-- SECTION:FINAL_SUMMARY:END -->
