---
id: TASK-34
title: >-
  Implement the Claude Design workspace prototype: agent-built interactive
  weekly-plan card in the kitchen chat
status: In Progress
assignee: []
created_date: '2026-08-21 00:29'
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
- [ ] #1 Fresh install: the setup turn posts one Kitchen message carrying the weekly-plan card (a2ui + interactive-surface, revision 0) plus the one-line assumptions text, verified by scrying the post blob on the host ship
- [ ] #2 Tapping Replace on a day (or posting its action text as the owner) produces a model turn that edits the card post in place: new meal visible in the tree, revision bumped, grocery list and notebook note amended — no duplicate card post
- [ ] #3 The card renders in the simulator app in the kitchen chat with working buttons (visual per the prototype within the a2ui v1 subset)
- [ ] #4 SKILL.md documents --blob on posts send/reply/edit, the a2ui and interactive-surface entry shapes, the whole-array edit rule, and the v1 limits, so the model can compose cards without kit-specific hints
- [ ] #5 The kit carries the card contract (template + update rules) in its instruction files; weekly-plan.md scheduled runs post a fresh card the same way
- [ ] #6 Old-client degradation intact: the card post degrades to the upgrade blockquote, never a crash
<!-- AC:END -->
