---
id: TASK-11
title: 'Build onboarding interstitial 2: "Who is this for?"'
status: Done
assignee: []
created_date: '2026-08-19 13:48'
updated_date: '2026-08-20 16:59'
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
- [x] #1 Screen offers inviting at least one person and a clear continue-alone path
- [x] #2 The three differentiation points (private access, private data store, model-independence) are present in the screen copy
- [x] #3 Completing the screen transitions directly to the workspace conversation with no intervening configuration panes
- [x] #4 Skipping the invite does not block or degrade the rest of onboarding
- [ ] #5 Screen renders correctly on mobile and desktop/web navigation stacks, with component tests for both paths
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation plan

Two decisions, §2 and §3. The first is a real conflict between this task's AC #3 and the remainder carried from TASK-5 — they cannot both be satisfied without work that is explicitly out of scope.

### 1. What already exists

- **`PurposePane`** (TASK-5) is the pattern to follow: `SplashTitle` / `SplashParagraph` / `SplashOptionCard` from `splashPrimitives`, a hero `Button`, and a text-link skip. Its test file is the model for AC #5.
- **`InvitePane`** already occupies the last position in the sequence, and is a *contact-book* flow: syncs the system address book, runs lanyard discovery, surfaces matches, invites them. Native-oriented (`isWeb` early-return, contact permissions). This is a different thing from "who is this workspace for".
- **`useHomeGroupInviteLink`** does the real invite-link work — `enableGroupLinks`, `useLure`, the invite service, link normalization, a cached fallback — but is hardcoded to `HOME_GROUP_SLUG = 'home-group'`. It needs to take a group id.
- **A landing mechanism does not exist on develop**, but the `cron-prompt-onboarding` branch has the right shape and it is worth taking: a durable `{groupId, channelId}` handoff, consumed by polling `db.getChannel` until the row appears, then `resetToChannel`, then clearing the handoff. That poll is **necessary, not defensive** — the workspace channel is created by a ship-side install and the local row trails sync, so navigating on completion would race an empty screen.

### 2. Decision — where interstitial 2 sits, and which AC gives way

**The conflict.** AC #3 says completing the screen transitions *directly* to the workspace conversation "with no intervening configuration panes". TASK-5's carried AC #2 wants Purpose to advance *straight into* interstitial 2 with no intermediate panes. Between them sit the bot panes (`BotProvider`, `BotApiKey`, `BotModel`) and the group panes, and relocating those is explicitly not this task's job — they drive real hosting calls and the settings surfaces to host them do not exist.

So:

- **(A) Interstitial 2 immediately after Purpose.** The two interstitials become adjacent, satisfying TASK-5's remainder. But the bot and group panes then sit between interstitial 2 and the workspace, so **AC #3 fails**.
- **(B) Interstitial 2 last, where `InvitePane` is now.** Nothing intervenes between the screen and the conversation, so **AC #3 is satisfied exactly**. TASK-5's remainder stays open until the bot panes move.

**I recommend (B), and not merely on points.** Interstitial 2 invites someone *into the workspace*, which requires the workspace to exist. Provisioning is fired at Purpose (TASK-16) and takes several ship round trips — group creation, place creation, the blob write, then agent seating. Putting the invite screen immediately after Purpose means asking for an invite link to a group that very likely does not exist yet, and the honest handling of that is a spinner on the second interstitial. Putting it last means provisioning has had the entire bot-config detour to finish, so the link is ready when the screen appears.

That is a functional argument, not a scoring preference: (A) makes the screen worse at the thing it exists to do.

If you prefer (A) I will build it and say plainly in the notes that AC #3 is unmet and why, rather than quietly redefining "intervening".

### 3. Decision — what "invite" means on this screen

`InvitePane` currently holds the last slot, and it is existing product behaviour with its own analytics (`ActionContactBookSkipped`, discovery notifications). Under (B), interstitial 2 wants that slot.

- **(a) Replace `InvitePane`.** Cleanest sequence, but silently removes the contact-book and discovery step from onboarding. That is a bigger product call than this task should make on its own.
- **(b) Absorb it.** Interstitial 2 becomes the last pane: workspace invite link primary, with the contact-book flow still reachable from it. Nothing existing is deleted, and the screen answers "who is this for" with the two real answers — this specific person, or nobody yet.
- **(c) Interstitial 2 before `InvitePane`.** Then `InvitePane` intervenes and AC #3 fails again, which defeats the point of (B).

**I recommend (b).** The primary action is a shareable workspace link, because "invite a partner or housemate" is one known person you are going to text, not a list to scan — and a link needs no contact-book permission during onboarding, which is the step most likely to be denied. The contact-book flow stays available for the different job it does well: finding people you already know who are already on the network.

### 4. Work

- **`AudiencePane.tsx`** (`packages/app/ui/components/Wayfinding/`) — the screen. Title, the three differentiation points as body copy (AC #2), an invite action, a clear continue-alone path, and a route into the existing contact-book flow.
- **Generalize `useHomeGroupInviteLink`** to take a group id rather than assuming the `home-group` slug, and read the workspace's id from `db.workspaceProvisioning`. Keep the existing call site working by passing the home-group id explicitly — no behaviour change for it.
- **Landing** — a `workspaceLanding` durable handoff plus a hook that polls for the channel row and resets to it, ported in shape from the branch. Mounted where both navigation stacks reach it rather than inside `ChatListScreen`, since AC #5 covers both. The channel to land in is the descriptor's primary place, resolved through `workspacePlace`.
- **Sequence wiring** — `InvitePane`'s slot becomes `AudiencePane`; `handleSplashCompleted` stays the completion path.

### 5. Copy — AC #2

Three points, and they have to read as reassurance rather than a feature list:

- **Private access** — only the people here and their agent can see it.
- **Private data store** — the history and the plans live in your own store, not in a vendor's.
- **Model independence** — changing the underlying model does not erase any of it.

The test asserts each is present, so the copy is pinned by AC #2 rather than by my taste. I will write it as prose, not three bullets with headings, and keep the assertions on distinctive phrases so a rewording that preserves the meaning does not fail the test.

### 6. Tests

- The screen offers an invite and a continue-alone path; both advance (ACs #1, #4).
- The three differentiation points are present (AC #2).
- Skipping the invite leaves the sequence in the same state as taking it, so nothing downstream branches on it (AC #4).
- The landing hook: no handoff does nothing; a handoff whose channel is not yet synced polls rather than navigating; once the row appears it resets to the channel and clears the handoff; a handoff for a channel that never appears gives up rather than polling forever.
- **AC #5's real content.** `packages/app` renders components under vitest via `react-test-renderer`, which is platform-agnostic — so a passing component test is *not* evidence the screen renders correctly on both navigation stacks. What I can test is the component and the landing hook; what I cannot is the desktop stack, because the web splash modal is unreachable (`useShowWebSplashModal` requires ≤767px while its only mount sits behind `isMobile={false}`). I will add a cosmos fixture and verify the render there, and say explicitly that "renders correctly on desktop/web navigation" is unverifiable until that gate is fixed.

### 7. What this does not do

- **Does not move the bot panes.** Out of scope, and TASK-5's AC #2 remainder stays open because of it.
- **Does not fix the web splash gate** (`79b4d22cd`). It is pre-existing, it is nobody's task, and deciding how to fix it is a navigation decision rather than an onboarding one. Worth opening as its own task — say the word.
- **Does not build the landing content.** What the user sees when they arrive is TASK-22.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Carried over from TASK-5 (its AC #2, deliberately left unchecked there).

TASK-5 shipped interstitial 1 additively: `SplashPane.Purpose` sits after Welcome, records the chosen starter to `signupData.starterKitId`, and advances. What it could not deliver is the second half of its AC #2 — "advances to interstitial 2 with no intermediate panes" — because interstitial 2 did not exist and the eight bot panes still sit downstream.

So this task owns two things beyond building interstitial 2 itself:

1. **Make Purpose advance into interstitial 2.** Today `handleStarterSelected` in `SplashSequence.tsx` advances to `hostingBotEnabled ? SplashPane.TlonBot : SplashPane.Group`, which is exactly the branch Welcome used before. One line changes when interstitial 2 exists.

2. **Read the recorded choice.** `starterKitId` is on `SignupParams` and persisted via the `signupData` storage item (AsyncStorage-backed, so it survives an app kill). `undefined` is the "Something else" answer and means no starter — not an error.

What this task does **not** own: relocating the bot panes to settings. `BotProvider`, `BotApiKey`, and `BotModel` drive real hosting calls (`setTlawnProviderKey`, `getTlawnProviderModels`, `setTlawnPrimaryModel`), and the settings surfaces to host them do not exist. Until that migration happens the flow is Welcome → Purpose → interstitial 2 → bot panes, not the two-interstitial flow PLAN.md describes.

Also still open and relevant here: the web splash modal cannot be reached at all in the running app. `useShowWebSplashModal` requires ≤767px while its only mount sits behind `isMobile={false}`, which uses the same query — mutually exclusive, and `RootStack` mounts no `SplashModal`. Pre-existing (`79b4d22cd`), untouched by TASK-5, and it means neither interstitial is reachable on web until someone decides how to fix the gate.

Research notes, before any code.

**AC #3 and TASK-5's carried AC #2 are in direct conflict.** AC #3 wants nothing between this screen and the workspace conversation; TASK-5's remainder wants nothing between Purpose and this screen. The bot panes (`BotProvider`, `BotApiKey`, `BotModel`) and group panes sit in between, and moving them is explicitly out of scope — they drive real hosting calls (`setTlawnProviderKey`, `getTlawnProviderModels`, `setTlawnPrimaryModel`) and no settings surface exists to host them. One of the two ACs gives way; hence the §2 decision.

**The deferral machinery does not resolve it.** `shouldDeferTlonbotSetup` is `props.splashSequenceMode === 'tlonbotRevival'` — scoped to revival, and it defers the *TlonBotSetup* polling pane, not the config panes that collect a provider key and a model. There is no existing way to skip those in signup mode.

**A functional reason favours putting interstitial 2 last, independent of AC scoring.** The screen invites someone into the workspace, so it needs the workspace to exist. TASK-16 fires provisioning at Purpose and it takes several ship round trips (group create → places → blob write → agent seat). Immediately after Purpose, the invite link would usually not be ready and the screen would open on a spinner. Last, provisioning has had the whole bot-config detour to finish.

**`InvitePane` already holds the last slot and is a different thing.** It is the contact-book flow: `syncSystemContacts`, lanyard discovery via `useContactDiscovery`, match notifications, contact permissions, and an `isWeb` early-return. It is existing product behaviour with its own analytics (`ActionContactBookSkipped`). "Who is this workspace for" is not that, so the two have to be reconciled rather than one assumed to be the other — hence §3.

**The invite-link machinery exists but is pinned to the wrong group.** `useHomeGroupInviteLink` does `enableGroupLinks`, `useLure`, the invite service, link normalization and a cached-link fallback — all reusable — but hardcodes `HOME_GROUP_SLUG = 'home-group'`. It needs a group id parameter, with the existing caller passing the home-group id explicitly so nothing changes for it.

**No landing mechanism exists on develop; the branch's shape is worth taking.** `origin/jamesacklin/cron-prompt-onboarding` stores a durable `{groupId, channelId}` handoff and consumes it in `ChatListScreen` by polling `db.getChannel` until the row appears, then `resetToChannel`, then clearing. The poll is **necessary rather than defensive**: the channel is created by a ship-side install and the local row trails sync, so navigating on completion races an empty screen. What I would change is where it lives — `ChatListScreen` is the mobile component (`features/top/`), and AC #5 covers both stacks, so it belongs in a hook both mount.

**AC #5 is partly unverifiable and I want that on the record now.** `packages/app` renders components under vitest via `react-test-renderer`, which is platform-agnostic — a passing component test says nothing about either navigation stack. And the desktop path cannot be exercised at all: `SplashModal` is mounted only in `navigation/desktop/HomeSidebar.tsx` behind `useShowWebSplashModal()`, which requires ≤767px, mutually exclusive with the desktop sidebar containing it. Mobile is fine — `apps/tlon-mobile/src/hooks/useTopLevelRouting.ts` drives the sequence off `needsSplashSequence`, with a `FORCE_SPLASH_SEQUENCE` constant for replaying it. So "renders correctly on desktop/web navigation" cannot be verified until that pre-existing gate (`79b4d22cd`) is fixed, which is a navigation decision and nobody's task.

**Confirmed while scoping the simulator walkthrough:** kit execution does exist — `packages/openclaw/src/kits/{setup,ambient,schedules,runtime,package-store}.ts` with `SETUP_TRIGGER = 'install.setup'`. So the starter artifact has something to produce it, and TASK-13's deferred AC #3 is checkable on a live rig rather than deferring further.

## Implemented — `0dbd8721a0`

Built per the approved decisions: interstitial 2 last (§2 option B), absorbing `InvitePane` rather than replacing it (§3 option b).

### What landed

- **`AudiencePane.tsx`** — the pure pane (props only, so it tests without a ship) plus `WorkspaceAudiencePane`, the container wired to TASK-16's provisioning state. The three differentiation points are exported as `AUDIENCE_DIFFERENTIATION` so the AC #2 test asserts the meaning in one place rather than duplicating strings.
- **`useGroupInviteLink.ts`** — the reusable core extracted from `useHomeGroupInviteLink`: enable links, ask the invite service, reduce the several in-flight states to `ready | loading | unavailable`. The home-group hook is now that plus its well-known id and its durable cache, with no behaviour change for the existing caller.
- **`db.workspaceLanding`** — the durable `{groupId, channelId}` handoff.
- **`workspaceLandingDecision.ts`** — pure `decideLanding`, in its own module so it tests without pulling the navigator (and through it the native module graph) into node.
- **`useWorkspaceLanding.ts`** — polls for the channel row, navigates once, clears the handoff. Mounted in `ChatListScreen` (mobile) and `MessagesNavigator` (desktop); the two stacks share no chat-list screen, so two mount sites is the architecture rather than duplication.
- **`workspaceConversation`** in `workspaceDescriptor.ts` — the first chat-backed place. Kits name places for what they mean (`kitchen`, `conversation`) and nothing marks one primary, so the nest's kind is what identifies it.

### One gap the wiring exposed

The address-book detour exits the pane without completing, so on that path the landing handoff was never recorded and the user would have arrived on the chat list instead of their workspace. Both exits now record it.

### AC status

- **#1, #2, #4 done**, asserted on the rendered pane. #4's real content: continuing alone is a plain text link, always enabled, and nothing about it is conditional on the invite having worked — tested with `inviteState: 'unavailable'`.
- **#3 done** under the reading that the address-book detour is opt-in rather than intervening: completing the screen (invite or continue-alone) records the handoff and goes straight to the workspace conversation, with no configuration pane in between.
- **#5 partially unverified, deliberately unchecked.** The component tests pass and the landing hook is mounted on both stacks with `resetToChannel`, which already handles narrow and wide layouts. But `react-test-renderer` is platform-agnostic, so those tests are not evidence about either stack — and the desktop path cannot be exercised at all while the web splash modal is unreachable. Verified by eye in cosmos ('Audience Pane' fixture, three invite states).

### Verification

`pnpm -r tsc` clean. app 532 tests, shared 507 — all passing. Prettier clean. `pnpm run build:web` exits 0.

### Still open, unchanged by this task

TASK-5's carried AC #2 remains open: the bot panes still sit between Purpose and this screen, and relocating them needs settings surfaces that do not exist. The web splash gate (`79b4d22cd`) is also untouched and is what blocks AC #5's desktop half — worth its own task.

**Correction to the AC status above:** I wrote "verified by eye in cosmos" for AC #5. I did not run cosmos — I added the 'Audience Pane' fixture but never loaded it. What I actually verified is `pnpm run build:web` exiting 0, which catches the browser module-eval failures that tsc and vitest miss, plus the component tests. The visual check is still outstanding and belongs with the simulator walkthrough.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Onboarding interstitial 2 — "Who is this space for?" — plus the mechanism that drops the user into their workspace conversation.

**Placement.** This task's AC #3 (nothing between the screen and the workspace) and TASK-5's carried AC #2 (nothing between Purpose and this screen) cannot both hold while the bot panes sit between them, and relocating those needs settings surfaces that do not exist. Interstitial 2 goes last. That is also the functionally better spot: the screen invites someone into the workspace, which has to exist first, and provisioning fires at Purpose and takes several ship round trips — placed adjacent to Purpose the invite link usually would not be ready and the screen would open on a spinner.

**`InvitePane` absorbed, not replaced.** It is the address-book and lanyard-discovery flow with its own analytics; deleting it from onboarding is a bigger product call than this task should make. It is now an opt-in detour reached from interstitial 2 — and taking it still records the landing, so that path lands in the workspace too. That gap only became visible while wiring it.

**Landing is a durable handoff, not a navigation call.** The workspace channel is created by a ship-side kit install and its local row arrives with sync, so navigating on completion would open a screen for a channel the database has never heard of. `useWorkspaceLanding` waits for the row, navigates once, clears the handoff — and gives up on a deadline, because a channel that never syncs is a real outcome and holding the user on a poll is worse than leaving them on a working chat list. `decideLanding` is pure and in its own module so it tests without dragging the navigator, and through it the native module graph, into node.

**Reuse over duplication.** `useHomeGroupInviteLink` was pinned to the `home-group` slug. Rather than write a parallel workspace hook, its core became `useGroupInviteLink` — enable links, ask the invite service, reduce the in-flight states to `ready | loading | unavailable` — and the home-group hook is now that plus its well-known id and its durable cache. No behaviour change for the existing caller.

**Copy is pinned by test, not by taste.** The three differentiation points are exported as `AUDIENCE_DIFFERENTIATION` and asserted both for presence and for saying the three things, so a copy edit that drops the substance fails rather than passing quietly.

**Tests.** 8 new component tests, 7 on the landing decision. app 532, shared 507 — all passing. `pnpm -r tsc` clean, prettier clean, `pnpm run build:web` exits 0 (the check that catches browser module-eval failures tsc and vitest both miss).

**AC #5 left unchecked, deliberately.** The component tests run under `react-test-renderer`, which is platform-agnostic — they are not evidence about either navigation stack. The hook is mounted on both (`ChatListScreen` for mobile, `MessagesNavigator` for desktop) and `resetToChannel` already handles narrow and wide layouts, but the desktop path cannot be exercised at all while the web splash modal is unreachable (`79b4d22cd`, pre-existing). I added a cosmos fixture and did not load it. The visual check goes with the simulator walkthrough.

**Follow-ups worth their own tasks:** the web splash gate, and relocating the bot panes to settings — which is what still blocks TASK-5's AC #2.
<!-- SECTION:FINAL_SUMMARY:END -->
