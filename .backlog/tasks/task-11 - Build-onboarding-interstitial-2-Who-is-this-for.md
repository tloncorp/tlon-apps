---
id: TASK-11
title: 'Build onboarding interstitial 2: "Who is this for?"'
status: To Do
assignee: []
created_date: '2026-08-19 13:48'
updated_date: '2026-08-19 20:20'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Carried over from TASK-5 (its AC #2, deliberately left unchecked there).

TASK-5 shipped interstitial 1 additively: `SplashPane.Purpose` sits after Welcome, records the chosen starter to `signupData.starterKitId`, and advances. What it could not deliver is the second half of its AC #2 — "advances to interstitial 2 with no intermediate panes" — because interstitial 2 did not exist and the eight bot panes still sit downstream.

So this task owns two things beyond building interstitial 2 itself:

1. **Make Purpose advance into interstitial 2.** Today `handleStarterSelected` in `SplashSequence.tsx` advances to `hostingBotEnabled ? SplashPane.TlonBot : SplashPane.Group`, which is exactly the branch Welcome used before. One line changes when interstitial 2 exists.

2. **Read the recorded choice.** `starterKitId` is on `SignupParams` and persisted via the `signupData` storage item (AsyncStorage-backed, so it survives an app kill). `undefined` is the "Something else" answer and means no starter — not an error.

What this task does **not** own: relocating the bot panes to settings. `BotProvider`, `BotApiKey`, and `BotModel` drive real hosting calls (`setTlawnProviderKey`, `getTlawnProviderModels`, `setTlawnPrimaryModel`), and the settings surfaces to host them do not exist. Until that migration happens the flow is Welcome → Purpose → interstitial 2 → bot panes, not the two-interstitial flow PLAN.md describes.

Also still open and relevant here: the web splash modal cannot be reached at all in the running app. `useShowWebSplashModal` requires ≤767px while its only mount sits behind `isMobile={false}`, which uses the same query — mutually exclusive, and `RootStack` mounts no `SplashModal`. Pre-existing (`79b4d22cd`), untouched by TASK-5, and it means neither interstitial is reachable on web until someone decides how to fix the gate.
<!-- SECTION:NOTES:END -->
