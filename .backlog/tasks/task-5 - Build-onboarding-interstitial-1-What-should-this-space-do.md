---
id: TASK-5
title: 'Build onboarding interstitial 1: "What should this space do?"'
status: In Progress
assignee:
  - james@tlon.io
created_date: '2026-08-19 13:47'
updated_date: '2026-08-19 20:29'
labels:
  - workspaces
  - onboarding
milestone: m-1
dependencies: []
references:
  - PLAN.md
  - packages/app/ui/components/Wayfinding/SplashSequence.tsx
priority: high
type: feature
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PLAN.md replaces the current multi-pane onboarding wizard (packages/app/ui/components/Wayfinding/SplashSequence.tsx exposes bot identity, provider, model, group, and invitation) with exactly two interstitials before landing in a real workspace.

Screen 1 asks "What should this space do?" and offers three concrete shared starters — weekly meals + grocery list (recommended), garden plan + shared reminders, household tasks + recurring routines — plus a secondary "Something else" path that must not be the primary flow. Bot naming, avatar, provider, model, and connected services move out of onboarding to settings or later contextual prompts.

The starter list should match the wedge confirmed by the capability-matrix spike; build with the three PLAN.md defaults unless that spike revises them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Screen presents the three starter options with meal planning visually recommended, plus a de-emphasized Something else option
- [ ] #2 Selecting a starter records the chosen kit and advances to interstitial 2 with no intermediate panes
- [x] #3 No bot identity, provider, model, or group configuration appears anywhere in the screen
- [x] #4 Screen renders correctly on mobile and desktop/web navigation stacks
- [x] #5 Component tests cover option selection and the Something else path
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation plan

One new pane in the existing splash sequence, following patterns the sequence already uses. The code is small; two things need your decision, both below.

### 1. `starterOptions.ts` — the options module

Pure module beside `botProviderOptions.ts`, matching its shape (that module's `BotCredentialOption` already carries `recommendationLabel?: string`, so this is a direct analogue):

```ts
export type StarterOption = {
  id: string;               // the kit id this will eventually install
  label: string;
  description: string;
  recommendationLabel?: string;
};
export function buildStarterOptions(): StarterOption[];
```

Three options from the capability matrix (doc-1 §5), meals first with `recommendationLabel: 'Recommended'`:

| id | label | description |
|---|---|---|
| `meal-plan` | Weekly meals and grocery list | Plan the week's dinners and keep a shared list |
| `household-tasks` | Household tasks and routines | Split chores and keep recurring routines running |
| `garden-plan` | Garden plan and seasonal reminders | Plan what to plant and get nudged in season |

**These ids are forward references.** Only `book-club` exists in `packages/tlon-kits`, and — more than that — kits are entirely unwired on the client: `packages/app` and `packages/shared` contain zero references to `tlon-kits`, `kitId`, or `installKit`. So the screen records an id nothing can currently act on. That is expected given TASK-13 and TASK-16, but the ids are a contract with TASK-13 worth agreeing now rather than renaming later.

`starterOptions.test.ts` beside it, mirroring `botProviderOptions.test.ts`.

### 2. The pane

New `SplashPane.Purpose`, a `PurposePane`, and one render block, following the layout convention the other panes repeat by hand (`SplashTitle`/`SplashParagraph`, safe-area insets, hero `Button` at the foot).

For the options themselves there are two real precedents and they say different things:

- **`ModelOptionCard`** (`SplashSequence.tsx:2886`) — list-row shaped, already used by the provider and model panes, already has the recommendation `Badge`, selected border, checkmark, `testID`. Familiar within the sequence. It renders badge *instead of* description, so meals showing both needs the ternary split into two conditionals. Private to the file; would be extracted.
- **`GroupTypeCard` + `TemplateCarousel`** (`features/groups/GroupTypeSelectionSheet.tsx:25`, `:210`) — the actual template picker, 180px cards with icon, title, subtitle. Visually closer to "three concrete starters", but commits on press rather than select-then-Next.

**I lean to `ModelOptionCard`**: it keeps the pane consistent with the sequence it lives in, and the 600×700 web dialog is tight for three 180px cards plus a link. Cards would read as more substantial, so say the word if you prefer that.

"Something else" is a de-emphasised text link below the options, not a fourth card — AC #1 wants it secondary, and card parity would undercut that.

AC #3 holds by construction: the pane renders options and a link, and touches nothing about bot identity, provider, model, or groups.

### 3. Recording the selection

Add `starterKitId?: string` to `SignupParams`, written through the `signupData` storage item. That is AsyncStorage-backed, so the choice itself survives an app kill, and interstitial 2 and TASK-16's provisioning can both read it. "Something else" records nothing and advances; downstream treats absence as "no starter".

Worth knowing: **signup mode has no pane-level resume.** Only `tlonbotRevival` restores position, via `db.tlonbotRevivalSetup.stage` and the effect at `SplashSequence.tsx:265-281`, gated on `shouldDeferTlonbotSetup`. In signup mode `currentPane` is plain `useState`, so an app kill restarts at `Welcome`. The *answer* persists; the *position* does not. Fixing that generally is out of scope, but it means "records the chosen kit" is durable while the surrounding flow is not.

### 4. Placement, and the honest limit on AC #2

Insert after `Welcome`. That pane's handler currently branches `hostingBotEnabled ? TlonBot : Group`; it becomes an unconditional advance to `Purpose`, which then makes that original branch.

**AC #2 cannot be fully met yet.** It asks to "advance to interstitial 2 with no intermediate panes". Interstitial 2 is TASK-11 and does not exist, and the eight bot panes still sit in the path. What I can deliver: the selection records and the pane advances immediately with nothing between it and the next screen. What I cannot: that next screen being interstitial 2.

Those panes are not removable here. `BotProvider`, `BotApiKey`, and `BotModel` drive real hosting calls — `setTlawnProviderKey`, `getTlawnProviderModels`, `setTlawnPrimaryModel` — and PLAN.md's instruction to move them "to settings" presumes surfaces that do not exist yet. Deleting them leaves a non-functioning bot.

- **(a) Ship additively** — pane inserted after Welcome, advancing into the existing flow. AC #2 half-met, closed by TASK-11 plus the settings migration. No regression.
- **(b) TASK-5 and TASK-11 together** — both interstitials in one pass, bot panes still downstream. Makes "interstitial 1 → interstitial 2" literally true.
- **(c) Also relocate the bot panes** — genuinely delivers the two-interstitial flow, but needs the settings surfaces built first and is much larger.

**I recommend (a)**, opening the AC #2 remainder against TASK-11. **This is decision one.**

### 5. AC #4, and a bug that blocks half of it

**The web splash currently cannot render at all — verified, and it predates this task.** `useShowWebSplashModal` requires a viewport ≤767px, but its only mount (`navigation/desktop/HomeSidebar.tsx:347`) is reachable only through `BasePathNavigator isMobile={false}`, which `apps/tlon-web/src/app.tsx:382` selects when the *same* `(max-width: 767px)` query is false. `RootStack`, the mobile-web path, mounts no `SplashModal`. The conditions are mutually exclusive.

So AC #4's "desktop/web navigation stacks" half is not demonstrable today. Building the pane inside the shared `SplashSequence` means it is *correct* on both stacks by construction, and it will appear on web the moment the gate is fixed — but I cannot verify it there.

**Decision two:** fix the gate as part of this task, or leave it and note AC #4 as mobile-verified only? Fixing it is probably small — either mount `SplashModal` in `RootStack` or invert the viewport check — but it changes when the splash appears for every web user, which is a product call rather than a mechanical one. **I lean to leaving it and flagging it**, since it is a pre-existing bug with user-visible blast radius and deserves its own decision.

### 6. Tests — correcting my earlier note

I said in TASK-10 and TASK-4 that this repo has no component-render setup. That was wrong, and my first correction was also wrong: I proposed the `apps/tlon-mobile` jest + RNTL harness, but that is scripted as **`test-ui`, not `test`, so `pnpm run -r test` skips it and CI never runs it**.

The right home is `packages/app` vitest, which already renders real components with `react-test-renderer`'s `create`/`act` plus `vi.mock` — see `ui/components/Activity/ActivitySourceContent.test.tsx`. Root `test:ci` runs `pnpm run -r test run`, so this pattern is actually enforced.

- **Options module**: order, recommendation on meals only, unique ids.
- **Component**: the two AC #5 paths — pressing a starter records the id and advances; "Something else" advances without recording. Budget for tamagui and RN mocking, since `packages/app/vitest.config.ts` aliases `react-native` to a minimal mock and a splash pane pulls `Image`, `ScrollView`, and safe-area.

If the mocking turns out disproportionate I will say so and fall back to the options tests plus the fixture, rather than claiming coverage I do not have.

### 7. Fixture

`packages/app/fixtures/SplashSequence.fixture.tsx` already exports a per-pane fixture for every existing pane, so adding one is a few lines in an established file. Note it is registered in `apps/tlon-mobile/cosmos.imports.ts` but not the web one.

### Verification

`pnpm -r tsc`, `packages/app` vitest, prettier, and cosmos for the pane — including at the 600×700 dialog size, since that is the tight case even though the dialog cannot currently be reached in the running web app.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Research findings, part 1 — where the choice gets stored, and a correction about testing.

**Correcting myself: component tests *are* possible in this repo.** I said twice, in TASK-10 and TASK-4, that there is no component-render setup. That is true of `packages/app` (vitest, react-native mocked, no jsdom, no testing-library) but **not true of the repo**. `apps/tlon-mobile` has a working harness: jest + `jest-expo` + `@testing-library/react-native`, a `test-ui` script, and one real test (`src/__uitests__/App.test.tsx`) that renders the whole App and drives it with `userEvent.press`/`type`, asserting on `findByText` and `getByTestId`.

So AC #5 is achievable rather than something to argue down. Two constraints shape how:
- `jest.config.js` sets `testMatch: ['**/__uitests__/**/*.[jt]s?(x)']` with rootDir at `apps/tlon-mobile`, so the test must live in `apps/tlon-mobile/src/__uitests__/` even though the component lives in `packages/app`. Importing across is already the established pattern (the existing test imports `@tloncorp/app/lib/nativeDb`).
- The existing test renders the whole `App`, which self-provides its context stack. Rendering a single screen needs a provider wrapper, and none exists for tests. `packages/app/fixtures/FixtureWrapper.tsx` documents the stack a component needs — QueryClientProvider, AppDataContextProvider, NavigationProvider, Theme, ToastProvider, GestureHandlerRootView, BottomSheetModalProvider, safe-area — but it depends on `useFixtureSelect` from react-cosmos so it cannot be reused directly. A small test-only wrapper is new but bounded work, and it unblocks component testing generally rather than just this screen.

The mock surface is light (2 internal mocks, 7 external), so this is not a large lift.

**Where a chosen starter should be recorded (AC #2).** `SignupParams` (`packages/api/src/types/onboarding.ts:6`) is the onboarding accumulator, persisted through the `signupData` storage item (`packages/shared/src/db/keyValue.ts:116`). `createStorageItem` is AsyncStorage-backed with a react-query surface (`getValue`/`setValue`/`useValue`), so it survives a restart — which matters because the user can be killed mid-sequence. It already carries `onboardingFlow`, `bootPhase`, and `didCompleteOnboarding`, so a `starterKitId?: string` alongside them is the natural home, readable by interstitial 2 and by TASK-16's background provisioning.

**The starter ids are forward references.** Only one kit exists today — `packages/tlon-kits/kits/book-club`. Meals, garden, and household tasks are all TASK-13's work. So this screen can record a selection but nothing can install it yet. That is fine for the task as scoped (provisioning is TASK-16), but it means the ids must be agreed up front and the screen must not assume a kit is resolvable.

**`INSTALLING_KIT` is not on the branch.** I deliberately excluded it from TASK-2 as UI-adjacent, so `NodeBootPhase` still runs `ACCEPTING_INVITES = 70` → `READY = 200` with nothing between. Whoever wires provisioning adds it back.

**The spike confirmed the three options unchanged** (doc-1 §5): meals recommended, household tasks, garden, plus "Something else" as a secondary path. It added day-one framing requirements per option — household tasks must propose a routine rather than ask the user to enumerate chores; garden must lead with a location question — but those shape each kit's first turn, not this picker, so they belong to TASK-13.

Research findings, part 2 — the splash sequence, and two reusable pieces already in it.

**The pane machine is hardcoded, not data-driven.** `SplashSequence.tsx` (~2900 lines) holds a 13-value `SplashPane` enum (`:116`) driven by a single `useState` current pane, with roughly twenty scattered `setCurrentPane(…)` calls and a long chain of `{currentPane === SplashPane.X && …}` render blocks starting at `:948`. Each pane's "next" is baked into its own handler rather than declared anywhere central. Inserting a pane therefore means: add an enum member, add a render block, and edit exactly one existing handler to point at it.

The file's own header comment says the standard flow is `Welcome → Group → Channels → Privacy → Invite`, with the eight bot panes (TlonBot, BotName, BotAvatar, BotProvider, BotApiKey, BotSubscriptionAuth, BotModel, TlonBotSetup) branching in when `hostingBotEnabled`.

**Two things worth reusing rather than inventing.**

`ModelOptionCard` (`SplashSequence.tsx:2886`) is already the exact widget AC #1 describes: a pressable `ListItem` with label, optional description, a positive `Badge` for a recommendation, a selected state (border plus `Checkmark`), and a `testID`. One wrinkle — it renders the recommendation badge *instead of* the description, not alongside it, so showing both on the meals option needs a small change. It is private to the file today.

`botProviderOptions.ts` is the precedent for how onboarding choices are modelled: a pure module exporting an option type that already carries `recommendationLabel?: string`, with a vitest file beside it asserting things like `expect(openAIOptions[0]?.recommendationLabel).toBe('Recommended')`. Two sibling modules follow the same shape (`providerKeyValidation`, `providerModelDefaults`). So there is an established, tested pattern for exactly this kind of screen, and a `starterOptions.ts` + `starterOptions.test.ts` pair fits it directly.

**Platform mounting differs, but the component is shared** (AC #4). On native, `apps/tlon-mobile`'s `useTopLevelRouting` reads `needsSplashSequence`/`splashSequenceMode` off ship context and routes into the onboarding screens. On web, `SplashModal` wraps `SplashSequence` in an `ActionSheet` dialog fixed at **600×700** and is mounted in `navigation/desktop/HomeSidebar.tsx:347`, gated by `useShowWebSplashModal` — which, despite living on the desktop path, returns false unless the viewport is ≤767px. So building the pane inside `SplashSequence` covers both stacks by construction; what differs is the shell, and the 600×700 dialog is the tighter constraint. Three option cards plus a secondary link have to fit there without scrolling awkwardly.

**Consequence for scope:** the eight bot panes are not decoration. BotProvider, BotApiKey, and BotModel configure a working agent, and PLAN.md's instruction to move them "to settings or later contextual prompts" presumes those settings surfaces exist. Removing them is not this task.

Research findings, part 3 — two corrections to my own plan, and a bug that affects AC #4.

**The web splash modal can never render. Verified independently.** `useShowWebSplashModal` returns false unless `window.matchMedia('(max-width: 767px)')` matches. Its only mount is `navigation/desktop/HomeSidebar.tsx:347`, reachable only through `BasePathNavigator isMobile={false}` — which `apps/tlon-web/src/app.tsx:382` selects when `useIsMobile()` is false, using the **same** `(max-width: 767px)` query (`logic/useMedia.ts:65`). The two conditions are mutually exclusive. And `RootStack`, the `isMobile={true}` path, contains no `SplashModal` at all (grep: zero). So at >767px you get the navigator that has the modal and a gate that says no; at ≤767px you get the gate saying yes and a navigator with no modal.

This matters for AC #4 ("renders correctly on mobile and desktop/web navigation stacks"): the web stack cannot demonstrate the screen today, for reasons that predate this task. Introduced by `79b4d22cd`.

**Correction to my own plan on AC #5.** I proposed the `apps/tlon-mobile` jest + RNTL harness. That is a worse choice than a third option I had not found: **`packages/app` already renders real components under vitest** using `react-test-renderer`'s `create`/`act` with `vi.mock` for dependencies — see `ui/components/Activity/ActivitySourceContent.test.tsx` and `features/settings/bot/useOpenAISubscriptionAuth.test.tsx`. Decisively, the root `test:ci` runs `pnpm run -r test run`, which picks up `packages/app`'s `test` script; the mobile harness is scripted as **`test-ui`, not `test`, so it never runs in CI**. A component test there would be dormant infrastructure that nothing enforces. So: vitest + react-test-renderer in `packages/app`, budgeting for tamagui/RN mocking, since the vitest config aliases `react-native` to a minimal mock.

**Signup mode has no intra-sequence persistence at all.** Only `tlonbotRevival` stages resume, via `db.tlonbotRevivalSetup.stage` and the effect at `SplashSequence.tsx:265-281`, and that whole path is gated on `shouldDeferTlonbotSetup` (revival only). In signup mode `currentPane` and every collected answer are plain `useState` — kill the app and you restart at `Welcome` having lost them, even though the hosting-side side effects already fired. Writing `starterKitId` to `signupData` is therefore durable, but the *pane* you resume on is not, and fixing that generally is out of scope here.

**A better visual precedent than the one I picked.** `GroupTypeSelectionSheet.tsx` has `GroupTypeCard` (`:25`) and `TemplateCarousel` (`:210`) — the actual group-template picker, card-shaped at 180px with icon row, title, subtitle, narrow/wide handling, driven by `groupTemplates.ts`. That is closer to "three concrete starters" than `ModelOptionCard`, which is a list row. Difference: it commits on press rather than select-then-Next. Worth choosing deliberately — cards read as more substantial choices, rows as settings.

**`SplashSequence.fixture.tsx` already exists** (438 lines) with per-pane fixtures for every existing pane, registered in `apps/tlon-mobile/cosmos.imports.ts` but **not** in the web one. Adding a fixture for a new pane is a few lines in an established file rather than new scaffolding.

**Kits are entirely unwired on the client.** Grepping `packages/app` and `packages/shared` for `tlon-kits`, `kitId`, or `installKit` returns zero. So this screen records an id that nothing can currently act on — which is expected given TASK-13 and TASK-16, but worth stating plainly rather than implying a pipeline exists. The nearest working analogue is `store.createGroupFromTemplate` (`groupActions.ts:124`), whose `createGroup` already takes a `templateId`.

## Implementation

Shipped additively per your decision on §4, with the AC #2 remainder going to TASK-11.

Three commits:

- `4871ef6628` — the interstitial itself
- `8696025b9c` — two browser-breaking regressions from the TASK-2 kits landing, found while verifying this
- `b2c59d8a18` — a layout collision the new pane exposed in the shared option card

### What landed

`starterOptions.ts` + 6 tests, matching `botProviderOptions.ts`. Ids are `meal-plan`, `household-tasks`, `garden-plan`, meals carrying `recommendationLabel: 'Recommended'`. Still forward references to TASK-13; nothing consumes them yet.

`SplashPane.Purpose` inserted after Welcome. `WelcomePane.onActionPress` now advances there unconditionally; its old `hostingBotEnabled ? TlonBot : Group` branch moved into `handleStarterSelected`, so the pane after Purpose is unchanged from before.

The choice writes to `signupData.starterKitId` (new optional field on `SignupParams`). "Something else" writes `undefined` and advances.

Three extractions, done so the pane could be tested without importing the ~2900-line `SplashSequence`: `SplashOptionCard` (was the file-private `ModelOptionCard`), `splashPrimitives` (`SplashTitle`/`SplashParagraph` — breaks a circular import), and `PurposePane` itself.

### On the two decisions you didn't answer

I went with what I recommended and am flagging it rather than burying it: `ModelOptionCard` over `GroupTypeCard`, and I left the web splash gate bug alone.

### AC status

- **#1, #3, #5 — done.** #5 is 6 component tests in `packages/app` vitest (`PurposePane.test.tsx`) covering both AC #5 paths, plus 6 on the options module. The tamagui/RN mocking was light, so I did not have to fall back.
- **#4 — checked, with the scope stated.** Verified in cosmos on web at 600×700 (the splash dialog size): renders correctly, selection moves between cards, Next advances carrying `household-tasks`, "Something else" skips, no console errors. That is the web rendering stack. Two things it is *not*: the in-app web splash modal still cannot be reached (pre-existing gate bug, see research part 3 — unchanged by this task), and I did not run the pane on a device or simulator. The component is shared, so mobile is correct by construction, but I have not seen it there.
- **#2 — left unchecked.** Selecting records the kit and advances immediately, but interstitial 2 does not exist and the bot panes still sit downstream. Carrying to TASK-11.

### Two regressions I introduced in TASK-2, fixed here

Both crashed the **entire web bundle** at module-eval, and both were invisible to `pnpm -r tsc` and to every vitest suite — node resolves these modules differently than the browser bundler does. Rendering a splash pane in cosmos was the first time anything in this repo evaluated them in a browser at all.

1. **`node:fs` in the browser graph.** `packages/tlon-kits`'s barrel re-exported `loader.ts`. `@tloncorp/api` imports that barrel, so every web build pulled `node:fs` in and threw on Vite's externalized stub. Fixed by giving the loader its own `./loader` subpath export and dropping it from the barrel; the single Node caller (`tlon-skill/scripts/kits.ts`) imports from there. Added `typesVersions` because tlon-skill typechecks under classic Node resolution — I tried switching its `moduleResolution` instead and it dragged `@tloncorp/api`'s sources into the program with ~20 errors, so I reverted that.

2. **A zod 4 API in a zod 3 consumer.** `groupConfig.ts` used `z.looseObject`. `packages/api` pins zod ^3.25.76 while tlon-kits and openclaw are on ^4.4.1, and the bundler collapses the graph to one copy — so the call was `undefined` and the app died on import. Rewritten as `.object().passthrough()`, which both majors support, with a comment pinning the file to the common subset. Note the api-side test passes either way: under vitest, api resolves the hoisted root zod 4, not its own nested 3.

### A layout bug the new pane exposed

`ListItemMainContent` has a fixed `height: '$4xl'` — room for exactly two lines. The starter picker is the first place an option carries a description *and* a badge, and the third stacked row overflowed: the description drew on top of the title. Confirmed by screenshot before and after. Fixed by putting the badge beside the title. This also changes the bot provider pane's recommended row, which now shows its badge inline; that row has no description, so it reads the same — verified in cosmos.

### Verification

`tsc --noEmit` clean across tlon-kits, api, tlon-skill, openclaw, app, shared, ui. Tests: tlon-kits 25, api 787, app 483, openclaw 1426 — all passing. Prettier clean on the diff.

Two things I could not run locally: `tlon-skill`'s tests and build both require **bun**, which is not installed here. Its typecheck is clean and its `exports` map declares the `bun` condition for the new subpath, but the bun-resolved import is unexercised.

Also worth knowing: `packages/editor/dist` was unbuilt in this worktree, which makes `packages/app` fail `tsc` and the web bundle fail to resolve `@tloncorp/editor/dist/editorHtml`. Pre-existing and unrelated — `pnpm --filter '@tloncorp/editor' build` fixes it.

### Correction: the tlon-skill gap is closed

Installed bun 1.3.4 (matching the pin in `.github/workflows/*`) and ran what I had flagged as unexercised. The caveat above no longer applies.

`pnpm --filter '@tloncorp/tlon-skill' check` — the exact CI invocation — passes end to end: typecheck clean, **449 unit tests**, **364 hermetic integration tests**, 0 failures, and the compiled `tlon-run` binary builds and smokes.

I also confirmed the specific thing the fix changed, since `check` alone would not isolate it. A script importing exactly as `scripts/kits.ts` now does — `toWireKit` from the barrel, `loadKit`/`loadAllKits`/`resolvePackagedKitsDir` from `@tloncorp/tlon-kits/loader` — resolves under bun and works: it loads book-club v0.1.0 (7 files) and `resolvePackagedKitsDir()` still returns the packaged `kits/` directory. That last one was the most likely thing to break when the module moved, since it resolves relative to its own location.

The CLI path itself could not isolate this: `kits add` calls `ensureClient` before `loadKit`, so without a live ship it always fails at the connection first.
<!-- SECTION:NOTES:END -->
