---
id: TASK-34
title: >-
  Implement the Claude Design workspace prototype: agent-built interactive
  weekly-plan card in the kitchen chat
status: Done
assignee: []
created_date: '2026-08-21 00:29'
updated_date: '2026-08-21 13:53'
labels:
  - workspaces
  - interactive-cards
  - kits
  - demo
milestone: m-1
dependencies:
  - TASK-9
  - TASK-10
  - TASK-12
  - TASK-13
references:
  - packages/tlon-kits/kits/meal-plan/
  - packages/tlon-skill/SKILL.md
  - docs/tlon-apps/interactive-surfaces.md
  - docs/tlon-apps/post-blobs.md
  - packages/app/ui/components/PostContent/A2UIBlock.tsx
priority: high
type: feature
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the demo flow from the Claude Design project "Weekly Meals onboarding prototype" (claude.ai/design p/055eb53c-9501-4d1c-884e-ea958c0ada45, file `Tlon Workspaces Prototype.dc.html`): after onboarding provisions a Weekly Meals workspace, the agent's first act in the Kitchen chat is an **interactive weekly-plan card** — day rows with per-row controls (Replace / Keep / add-to-list), a saved indicator, and a link to the Meal Plans notebook — that the agent updates in place as the household reacts.

All the platform pieces already shipped on this branch and are Done: a2ui v1 blocks render in chat (TASK-10, `A2UIBlock`/`StaticChatMessage`/`useInteractiveSurface`), `tlon posts send/edit --blob --expected-revision` (TASK-9), the interactive-surface protocol (TASK-3), and the deterministic action-apply loop (TASK-12). What's missing is the **content and instruction layer**: the meal-plan kit never tells the agent to build a card, and SKILL.md never teaches the model that `--blob`, a2ui trees, or interactive surfaces exist.

Design mapping (prototype → wire):
- The "This week" card = one kitchen post whose text content is the one-line assumptions message and whose blob is `[a2ui(surfaceId, tree), interactive-surface(surfaceId, rev 0, state)]`.
- Replace/Keep/add-to-list controls = `tlon.sendMessage` buttons ("Replace Wednesday's dinner" etc.). The owner is heard without mention in owner-hosted channels (`owner-owned` engage reason), so a tap wakes a model turn; the model edits the card post (whole blob array, `--expected-revision`, bump) and amends the notebook + grocery in the same turn — the prototype's "Updating… → Replaced · saved" beat. Deterministic `tlon.surfaceAction` taps are NOT used for these controls because a vocabulary tap preserves the a2ui tree verbatim (no visible change).
- "Open Meal Plans" = `tlon.navigate` to the notes place.
- a2ui v1 limits apply: ≤50 components, depth ≤8, Card/Column/Row/Text/Divider/Button only — the card template must fit (7 rows ≈ 44 components).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Fresh install: the setup turn posts one Kitchen message carrying the weekly-plan card (a2ui + interactive-surface, revision 0) plus the one-line assumptions text, verified by scrying the post blob on the host ship
- [x] #2 Tapping Replace on a day (or posting its action text as the owner) produces a model turn that edits the card post in place: new meal visible in the tree, revision bumped, grocery list and notebook note amended — no duplicate card post
- [x] #3 The card renders in the simulator app in the kitchen chat with working buttons (visual per the prototype within the a2ui v1 subset)
- [x] #4 SKILL.md documents --blob on posts send/reply/edit, the a2ui and interactive-surface entry shapes, the whole-array edit rule, and the v1 limits, so the model can compose cards without kit-specific hints
- [x] #5 The kit carries the card contract (template + update rules) in its instruction files; weekly-plan.md scheduled runs post a fresh card the same way
- [x] #6 Old-client degradation intact: the card post degrades to the upgrade blockquote, never a crash
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-08-21 (~02:00 UTC): PROVEN LIVE end to end on the rebuilt rig. Fresh install task34-e2e (installer ~ten, agent ~zod) → invite → auto-accept → post-join reconcile → setup turn → the agent wrote the full week to Meal Plans (note 'Week of 17–23 August 2026', ~3KB) AND posted the interactive card into the Kitchen: blob = [a2ui, interactive-surface], surfaceId weekly-plan-2026-08-17-mp34, revision 0, 7 meals in state, footer buttons wired to the real places. Rendered in the web app (screenshot in scratchpad/card-in-chat.png): bordered card, title, caption, 7 day rows, 'Open Meal Plans' + primary 'Looks good'; the earlier malformed post degrades to the 'Upgrade your app' blockquote right above it (AC #6). Clicked 'Looks good' in the browser: posted as ~ten, owner-owned engage woke a model turn, and ~zod replied 'Thanks — should I put a fresh plan together each week?' — the prototype's schedule beat.

Two defects found and fixed on the way (commit 391021b86c): cron-fired turns never had a session→group binding so kit ambient context (card.md, scaffolds) was absent and the first attempt hallucinated an invalid blob — the prompt-build hook now derives the group from the session key's nest; and %notes was missing from desk.bill (TASK-29). Plus tlon-skill build-all EACCES on VirtioFS (every second container boot died) fixed by rm-before-copy. Residual model-discipline gap: the first valid card flattened the per-day Row+Button structure into plain Text (no Replace buttons) — card.md now forbids simplification explicitly; the tightened kit is re-seeded on both ships and the container restarted to clear the package cache. AC #2 (Replace round-trip with card edit) and AC #3 (simulator render) remain to verify — the next setup fire and the user's walkthrough cover them.

AC #2 CLOSED live (~01:52 UTC): typed 'Replace Wednesday's dinner' as ~ten in the web client → model turn → the agent edited the SAME card post (id …131.234.816) in place: revision 0→1, both blob entries re-emitted, Wednesday now 'Sheet-pan gnocchi with tomatoes & spinach — replaced', message text updated, 'Edited' marker shown, and a one-line confirmation posted. The notebook followed: note revision 1, black-bean gone, gnocchi in the grocery list. Bonus: the edit rebuilt the card per the TIGHTENED template — every day row now carries its Replace button — and the web client re-rendered the real edit live, closing TASK-12's 'reconcile never ran against a real edit' caveat. Screenshots: scratchpad/card-in-chat.png, card-after-replace.png. AC #4/#5 checked (SKILL.md + kit contract committed; a live weekly-schedule run is not yet exercised — same plumbing as setup). Remaining: AC #3, the simulator walkthrough (user-driven; app is running with the wiring proven on web).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The agent builds an interactive app inside the chat, end to end. The meal-plan kit's instruction layer (instructions/card.md, ambient) teaches the agent to post one Kitchen message whose blob carries an a2ui tree plus an interactive-surface entry — a weekly-plan card with per-day Replace pills, a "✓ Saved" header, and notebook navigation — and to edit that same post in place (whole-array re-emit, revision bump, --expected-revision) as the household reacts, keeping the notebook and grocery list in step. SKILL.md documents the generic mechanics (--blob, entry shapes, the whole-array edit rule, limits raised to 80 components / 20 children for divided-list cards).

Proven live repeatedly: fresh installs fire setup unprompted (invite → auto-accept → post-join reconcile → cron one-shot), the card posts, taps ("Replace Wednesday's dinner", "Looks good", "i'm vegetarian", "we're three people", nut allergy) each wake a model turn that edits the card in place — revision advancing 0→9+ across sessions — with the notebook amended in the same turn. Verified rendering and interaction on web and on the iOS simulator (final screenshot: a fresh onboarding workspace whose card followed the redesigned template unprompted). Old clients degrade to the upgrade blockquote.

Fixed along the way: cron-fired turns get kit ambient context via session-nest derivation (they previously ran blind); %notes shipped in desk.bill; tlon-skill's build EACCES on VirtioFS; the openclaw host's poll-param heuristic (TASK-33); the template-governs-structure-on-every-edit rule after the agent regenerated old anatomy from session memory. TASK-35 built the app-primary channel view this card lives in; TASK-36 holds the deferred %apps-channel streaming variant.
<!-- SECTION:FINAL_SUMMARY:END -->
