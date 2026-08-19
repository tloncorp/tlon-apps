---
id: TASK-11
title: 'Build onboarding interstitial 2: "Who is this for?"'
status: To Do
assignee: []
created_date: '2026-08-19 13:48'
labels:
  - workspaces
  - onboarding
milestone: m-1
dependencies:
  - TASK-5
references:
  - PLAN.md
priority: high
type: feature
ordinal: 5200
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Second and final onboarding interstitial from PLAN.md. After choosing what the space should do, the user chooses who it is for: invite a partner or housemate, or continue alone.

The screen carries the product differentiation succinctly: only these people and their agent can access the workspace; the history and plans stay in their private data store; changing the underlying AI model does not erase the workspace. After this screen the user lands directly in the real workspace conversation — no further setup panes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Screen offers inviting at least one person and a clear continue-alone path
- [ ] #2 The three differentiation points (private access, private data store, model-independence) are present in the screen copy
- [ ] #3 Completing the screen transitions directly to the workspace conversation with no intervening configuration panes
- [ ] #4 Skipping the invite does not block or degrade the rest of onboarding
- [ ] #5 Screen renders correctly on mobile and desktop/web navigation stacks, with component tests for both paths
<!-- AC:END -->
