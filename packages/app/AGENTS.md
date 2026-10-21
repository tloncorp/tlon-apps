# AGENTS.md — packages/app (@tloncorp/app)

Owns the React that web, mobile and desktop share: screens (`features/`),
navigation (`navigation/`), app hooks (`hooks/`), views (`ui/components/`,
`ui/contexts/`), providers (`provider/`), platform db adapters
(`lib/webDb.ts`, `nativeDb.ts`, `electronDb.ts`) and feature flags
(`lib/featureFlags.ts`).

## Data access

- Read through `@tloncorp/shared` store hooks and mutate through store
  actions. Components don't write the db, and don't call `@tloncorp/api` for
  data that belongs in the db (see `packages/shared/AGENTS.md`). If a read you
  need doesn't exist, add a `createReadQuery` and a hook in shared's
  `store/dbHooks.ts`.
- App-level composition hooks (navigation, permissions, telemetry) go in
  `hooks/`; data hooks over the db go in shared.
- The client relies on `desk.bill` to keep agents running; don't probe whether
  an agent is alive with `try/catch`.

## Navigation: two separate trees

- **Mobile and narrow web:** `navigation/RootStack.tsx`. `MainTabs` holds
  BotChat, ChatList, Activity and Settings; other screens (Contacts, …) are
  root-stack screens. Mobile screens live in `features/`.
- **Desktop and wide web:** `navigation/desktop/TopLevelDrawer.tsx`, with
  `HomeNavigator`, `MessagesNavigator`, `ActivityNavigator`,
  `ProfileNavigator` (Contacts) and `SettingsNavigator` in
  `navigation/desktop/`. Web switches trees by viewport.
- A behavior change usually needs both trees. Web E2E runs wide, so it
  exercises the desktop tree: testIDs for web E2E go in `navigation/desktop/`,
  and render as `data-testid`.
- A new route needs its param list in `navigation/types.ts`, the screen in the
  right tree(s), and a path in `navigation/linking.ts`.
- `navigate()` to a top-level tab passes `{ pop: true }`, or React
  Navigation 7 pushes a duplicate. Use `useTypedReset()`, not
  `CommonActions.reset`. Centralize repeated navigation in helpers on
  `useRootNavigation`.

## UI

- Tamagui. Reuse `@tloncorp/ui` primitives (`ZStack` from there), use
  `getTokenValue()` not `getToken()`, and put presses on `Pressable`, not
  `Stack`/`View`/`ListItem`. Lint enforces these.
- Extract repeated style combinations with `styled()` rather than repeating
  inline style props.
- Keep big components (`Channel`, `ChatMessage`, `BigInput`, settings
  screens) thin: extract named hooks and helpers, and don't define functions in
  the render body.
- Platform splits: `.native.tsx`, `.ios.tsx`, `.android.tsx`, `.web.tsx`
  siblings and `Platform.OS` guards. A change to one variant must be checked
  against the others; removing one requires the replacement to cover that
  platform.
- Changing a shared component's defaults or props means checking every
  callsite.
- Prefer native confirm dialogs over stacked modals.
- Add a cosmos fixture (`fixtures/`) for new visual components.
- Gate unfinished features with `featureMeta` in `lib/featureFlags.ts`. Gate
  desk capabilities on shared logic (`logic/*Support.ts`), not feature flags.
- Native db cache: bump `NATIVE_CACHE_GENERATION`
  (`lib/nativeCacheGeneration.ts`) to force a one-time rebuild; see
  `docs/tlon-apps/native-changes-cache.md`.

Tests: vitest. User-facing flow changes need E2E coverage in
`apps/tlon-web/e2e/` or a stated reason why not.

## Code Review Rules

Before claiming an effect reaches a population (signed-in users, mobile,
desktop), find where the component is mounted. Onboarding-stack screens only
mount when signed out, and the two navigation trees mount different screens.

Flag:

- A component writing the db, or fetching from the api data that other screens
  read and that belongs in the db.
- A change made in one navigation tree when the behavior exists in both; a
  web-E2E testID added only under `features/`.
- A platform-specific file removed or changed without covering the other
  platforms.
- Work added to render paths that runs often (large re-renders, functions or
  objects recreated each render in hot lists) without a stated reason.
- A user-facing error path that behaves differently from its sibling paths
  (an Alert in one, a silent drop in another).

Do not flag:

- `features/` and `navigation/desktop/` both containing a screen for the same
  thing; that split is deliberate.
