# Patched Dependencies

This directory contains local dependency patches applied through
`patchedDependencies` in the repo root `pnpm-workspace.yaml`.

When adding a patch, document:
- why we need it locally
- the upstream issue or PR it came from
- how to validate it
- when it can be removed

## react-native-screens@4.30.0

Local patch:
`patches/react-native-screens@4.30.0.patch`

The patch carries two independent fixes. A third, full-colour Android tab
icons, was dropped in the Expo SDK 58 upgrade: React Navigation 7.21 maps
`tinted: false` to the `original` icon tinting that react-native-screens 4.30
supports on Android, so the bottom-tabs patch went too.

### 1. Android header children retained during screen removal

Why:
During an Android screen removal transition, `startViewTransition` keeps a
removed header child attached to its toolbar until the matching
`endViewTransition` call. The existing cleanup walks the current child tree,
so it misses children already removed from that tree. A concurrent header
update can then try to add the retained child again and crash with `The
specified child already has a parent` in `ScreenStackHeaderConfig.onUpdate`.

What it does:
Records every parent-child transition pair when removal starts and finishes
those pairs in reverse order, including children no longer present in the
current view tree. Descendant transitions finish before the fragment root is
detached. Header rebuilds are also skipped while the owning screen, or an
ancestor screen, is being removed. In 4.30 the descendant cleanup runs after
the stack's `blockFrameworkTransitionFinalization` early return, so it waits
for the deferred finalization like the root does.

Upstream:
- issue: [software-mansion/react-native-screens#3249](https://github.com/software-mansion/react-native-screens/issues/3249)
- candidate fix: [software-mansion/react-native-screens#3777](https://github.com/software-mansion/react-native-screens/pull/3777),
  still open on October 16, 2026 and not in 4.30.0
- Linear: `TLON-6547`

Validation:
- Build and launch Android `productionDebug` on a physical device.
- Start a removal transition for a screen with a custom header child, remove
  that child from the toolbar, and finish the transition. The child's parent
  must be null and adding it back to the toolbar must not throw.
- The TLON-6547 device probe reproduced the exception before the patch and
  passed after it on a Pixel 7a running Android 17.

Removal:
Drop this hunk once the pinned react-native-screens release includes the
transition cleanup and removal guard from #3777 or an equivalent upstream fix.

### 2. Tab bar badges as a dot beneath the icon

Why:
The Bot and Activity tabs mark unread with a blank badge (`tabBarBadge: ' '`).
Natively that is a large pill over the icon's top-end corner: UIKit's empty
badge on iOS, a Material text badge on Android. The design is a small round
dot beneath the icon, like the web nav bar's, without moving the icons.

What it does:
- Android: a blank badge becomes Material's text-less dot (`m3_badge_size`,
  6dp), offset to sit centred 2dp beneath the icon. Since 4.30 each tab's
  icon is centred in a shared icon box (the bar's `itemIconSize`), so the
  offsets use the box for the horizontal centre and the tab's own icon size
  for its bottom edge. The icon view is untouched.
- iOS 26 and later: UIKit pads a badge's text by a fixed amount, so the badge
  cannot shrink below about 8pt. A blank badge instead draws a U+25CF glyph
  in the badge colour, at 8pt on a clear badge. That gives a 6pt dot, and a
  `badgePositionAdjustment` centres it 2pt beneath the 24pt icon. The tab bar
  draws every badge with the selected item's appearance, so the style goes on
  every item. It applies only while every badge on the bar is blank: a bar
  that also shows a text or number badge keeps UIKit's pills throughout. On
  iOS 26.1 and later, 4.30 also sets the badge on the `UITab`, so the dot
  glyph goes there too.
- iOS before 26 is unchanged, because its badge anchoring differs and it could
  not be verified here.

The iOS offset was measured on iOS 26.5, where a positive horizontal
adjustment moves the badge towards the icon. It assumes the 24pt icons in
`packages/app/navigation/assets`. In the bar's minimised state, UIKit anchors
the badge to a shorter button, so the dot sits about 3pt lower there.

Upstream:
- react-native-screens 4.30.0 has no badge size, shape or position options
  for native tabs.
- Linear: `TLON-6649`

Validation:
- Rebuild iOS and Android so the native patch is compiled in.
- Light both badges (an unread bot DM, unseen activity) and select a third
  tab. Each dot should be blue, round, about 6pt/dp, and centred beneath its
  icon. Select a badged tab: its dot keeps the same colour and position.
- The icons must not move: compare the tab bar against a build without the
  patch.
- Give one tab a numeric badge. On iOS 26 every badge on the bar returns to
  UIKit's pill.

Removal:
Drop these hunks if react-native-screens gains native badge styling that can
draw a small dot beneath the icon, or if the tab bar stops using blank badges.

## @expo/ui@58.0.19

Local patch:
`patches/@expo__ui@58.0.19.patch`

Why:
The shared mobile sheets present on iOS through Expo UI's
`community/bottom-sheet` adapter. Stock Expo UI 58 has no close control on its
iOS sheet and reports `onDismiss` on iOS in the same call as `onClose`.

The close control is native code (`ios/BottomSheetView.swift`). The rest is
JavaScript in `community/bottom-sheet/BottomSheet.ios` and
`swift-ui/BottomSheet`. Expo UI 58's package exports send Metro to the compiled
`build/` files and reach `src/` only under an `expo-source` condition that our
Metro config does not set, so the patch changes both `build/` and `src/`. The
compiled `build/community/bottom-sheet/BottomSheet.ios.js` is the one the app
runs.

Android is not patched. Its sheet is our own, built on Expo UI's public Compose
components: `packages/app/ui/components/NativeSheetHost.android.tsx`. That file
holds what used to be patched into Expo UI's Android adapter (fixed-height
snap points, `enableContentPanningGesture`, waiting for the hide animation)
along with the keyboard handling.

What it does:
- iOS: adds a `showCloseButton` prop that draws a native close control in the
  sheet's top-trailing corner and hides the drag indicator. Dismissible generic
  content reserves the control's 52pt header area (8pt inset plus its 44pt
  frame) inside its measured height so inputs cannot sit beneath its hit
  target; non-dismissible sheets omit it. The content root clips, so the app
  can lift a header into that area and a list taller than the sheet does not
  show below it.
- iOS: `onClose` and `onChange(-1)` fire when the sheet starts closing, and
  `onDismiss` fires from SwiftUI's own `onDismiss`, after the transition ends.
  Follow-up presentations wait for `onDismiss`.

Validation:
- Build the iOS preview app from source.
- Open Chat Options and a generic sheet (for example the attachment sheet).
  Confirm the close control aligns with the header, and that each sheet can be
  dismissed and reopened repeatedly in light and dark mode.
- From the attachment sheet, pick "Photo Library". The picker must appear after
  the sheet has gone.

Removal:
Drop the patch once Expo UI exposes sheet chrome configuration and a dismissal
callback separate from `onClose` upstream. Expo UI 58.0.19 defers its iOS close
callbacks to native dismissal, but fires them together, so the shared
dismissal hook cannot tell "closing" from "dismissed" without this patch.

## expo-background-task@58.0.11

Local patch:
`patches/expo-background-task@58.0.11.patch`

Why:
Stock expo-background-task schedules an iOS `BGProcessingTaskRequest` that
wants network and starts no sooner than its interval (12 hours by default), and
an Android worker that runs once a day. We use the task to refresh data in the
background, so it should run as often as the system allows.

What it does:
- iOS: schedules a `BGAppRefreshTaskRequest` with no earliest start date, so
  iOS alone decides when it runs, and checks for the `fetch` background mode
  instead of `processing`.
- Android: the default interval becomes 20 minutes.

The mobile package lists `expo-background-task` in `buildFromSource` on both
platforms, so the patched sources are compiled instead of the prebuilt
artifacts.

Upstream:
- none; this is a local scheduling choice, not an upstream bug

Validation:
- Rebuild iOS and Android so the native patch is compiled in.
- On iOS, the app must register the task without `BackgroundTasksNotConfigured`
  (the `fetch` background mode is in `Info.plist`).

Removal:
Drop the patch if expo-background-task gains options for the request type and
start date, or if we stop relying on frequent background refresh.

## expo-modules-core@58.0.20

Local patch:
`patches/expo-modules-core@58.0.20.patch`

Why:
`build/ts-declarations/global.js`, which `build/index.js` imports for its side
effects, imports `EventEmitter`, `NativeModule`, `SharedObject` and `SharedRef`
from sibling files that hold only type declarations and compile to empty
modules. Metro and Rollup accept that, but esbuild does not: Vite's dev-server
dependency pre-bundling fails with "No matching export", so `vite` (and the web
E2E tests that run it) cannot serve the app. Production `vite build` is
unaffected.

What it does:
Makes the runtime `global.js` an empty module. The imports it drops never had a
runtime value, so no platform behaves differently.

Upstream:
- none filed; 58.0.23 still ships the same `global.js`

Validation:
- `vite --force` in `apps/tlon-web` pre-bundles dependencies with no
  "No matching export" errors, and the web E2E tests load the app.

Removal:
Drop the patch once expo-modules-core emits type-only imports (or no imports)
in `build/ts-declarations/global.js`.

## @10play/tentap-editor@0.5.21

Why:
- Strips the package's bundled `Images` export, which was causing import errors in prod
- Removes the web bundle's legacy HTML hyperlink paste fallback, which can
  crash the Firefox note editor when pasting rich hyperlinks and make existing
  text appear deleted.

Local patch:
`patches/@10play__tentap-editor@0.5.21.patch`

Upstream:
- TipTap removed the same HTML-anchor paste path in
  `ueberdosis/tiptap@e8cfe043b753ee2a26cc595e95fd5e6e901285bf`
- Later `@10play/tentap-editor` versions also appear to have dropped this
  behavior. As of upstream `1.0.1`, the package is on TipTap 3 and
  `src/bridges/link.ts` is just a thin wrapper around
  `@tiptap/extension-link`, without the old HTML `text/html` anchor fallback.

Validation:
- Build the editor package and verify the patch still applies cleanly.
- In Firefox, paste a rich hyperlink into notes and confirm the editor does not
  crash or reload.
- Confirm the app still builds in production without reintroducing the original
  `@10play/tentap-editor` import error.

Removal:
Remove this patch once we upgrade off the old `0.5.x` web bundle and confirm
the replacement no longer vendors the legacy HTML link paste fallback or needs
the local asset export stripping.

## react-native-keyboard-controller@1.22.7

Local patch:
`patches/react-native-keyboard-controller@1.22.7.patch`

Why:
On iOS, upstream `KeyboardChatScrollView` applies the destination padding and
scroll offset at the start of a keyboard transition, while the native keyboard
is still moving. This can make the conversation jump ahead of the keyboard and
composer during opening, dismissal, or an interrupted transition.

On iOS, `KeyboardChatScrollView` implements composer growth through
`extraContentPadding`, which updates the scroll view's `contentInset`. When
`keyboardLiftBehavior="whenAtEnd"` decides not to move a user who is browsing
older messages, upstream returns without re-emitting the current
`contentOffset`. `ScrollViewWithBottomPadding` also omits `contentOffset` when
its numeric target has not changed. UIKit can therefore adjust the offset while
applying the inset by itself, producing a one-frame flash or jump when a
multiline chat composer first grows.

What it does:
- Drives iOS chat padding and scroll movement from the native keyboard height
  reported on each frame. It captures the current and destination values at
  transition start, then applies incremental scroll deltas so composer-height
  changes between frames are preserved. Interactive dismissal follows native
  frames directly, including the user's scroll delta; interrupted, instant,
  and duplicate end events do not replay stale offsets. Existing lift policies,
  safe-area handling, and `freeze` behavior are preserved.
- On iOS Fabric, re-publishes the currently observed offset when an
  `extraContentPadding` change should not shift the content. The guard keeps
  the workaround out of Android, web, and the legacy iOS architecture.
- Emits that offset whenever bottom padding changes, even if its numeric value
  is unchanged, so Reanimated sends the new `contentInset` and a
  `contentOffset` that preserves position in the same animated-props commit.
- iOS native: during an interactive swipe-back, holds the keyboard show and
  hide notifications until UIKit settles the navigation, then publishes the
  final keyboard state once. A held or cancelled swipe no longer drives the
  chat as if the keyboard were dismissing.

The composer-padding and frame-tracking changes are mirrored in the
TypeScript source and the published CommonJS and ES module builds. Metro loads
the `react-native` entry point, which is the TypeScript source. Android
retains its own hook implementation. The app still owns composer measurement
and the `whenAtEnd` policy on both platforms.

1.22.7 added its own interactive-dismissal shortcut to the iOS hook. The patch
replaces it, because frame tracking already continues from the last
interactive frame.

Upstream:
- repo: `kirillzyusko/react-native-keyboard-controller`
- related iOS gesture issue:
  [#1563](https://github.com/kirillzyusko/react-native-keyboard-controller/issues/1563)
  tracks sticky-view lag when interactive dismissal starts. It is related
  timing context, not a report of this exact chat-list fix.
- merged
  [#1565](https://github.com/kirillzyusko/react-native-keyboard-controller/pull/1565)
  avoids an extra programmatic scroll after interactive dismissal; it does not
  add per-frame chat padding and offset updates.
- related discussion:
  [#1333](https://github.com/kirillzyusko/react-native-keyboard-controller/discussions/1333)
  covers layout shifts involving `whenAtEnd` and `extraContentPadding`.
- [#1605](https://github.com/kirillzyusko/react-native-keyboard-controller/pull/1605),
  merged on October 14, 2026 but not in the 1.22.7 release, fixes lost scroll
  distance during animated padding changes. Closed
  [#1609](https://github.com/kirillzyusko/react-native-keyboard-controller/pull/1609)
  was superseded by merged
  [#1629](https://github.com/kirillzyusko/react-native-keyboard-controller/pull/1629)
  for Reanimated 4.6 compatibility. These address different failures from the
  no-shift inset/offset commit above.
- as of October 16, 2026, the latest release, `1.22.7`, still applies the
  keyboard destination in `onStart`, leaves `onMove` empty, and retains the
  no-shift and unchanged-offset behavior. No upstream issue or PR tracking this
  exact local implementation has been identified; the links above are related
  reports and fixes, not replacements for the patch.

Validation:
- Run `corepack pnpm install --frozen-lockfile` to confirm the patch applies
  and its lockfile hash is current.
- Run `pnpm --filter @tloncorp/app test ui/components/Channel/PostList/keyboardControllerIOS.test.ts`.
  These regression tests exercise the installed patched iOS hook, including
  native frame progress, interruptions, interactive dismissal, safe-area
  offsets, composer changes between frames, and frozen transitions. They
  import the package's TypeScript source, which does not typecheck against
  React Native 0.88's strict types, so `packages/app/tsconfig.json` types those
  imports against the published declarations instead.
- Rebuild the iOS app. Open, close, and interactively dismiss the keyboard at
  the end of a conversation and while browsing history. The list should follow
  the keyboard without an initial jump; cancel or reverse a dismissal to check
  that the next transition starts from the current position.
- With the keyboard open on iOS, grow and shrink the multiline
  composer while browsing history; the same visible message should retain its
  vertical position without flashing.
- Repeat at the end of the conversation; the latest message should remain
  anchored above the composer.
- Exercise emoji keyboard changes, momentum scrolling, and leaving/reopening
  the conversation to check for stale inset or offset state.
- Rebuild Android and confirm composer growth and keyboard dismissal retain
  the existing end-anchor behavior.

Removal:
Reassess each part independently when upgrading keyboard-controller:
- Remove the iOS keyboard hook hunks once an upstream release keeps chat
  padding and scroll movement synchronized with native keyboard frames and
  passes the transition regression tests and device checks above.
- Remove the composer-padding hunks once an upstream release commits
  `contentInset` together with a preserving `contentOffset` for no-shift
  `extraContentPadding` changes, including unchanged numeric offsets. Repeat
  the mid-history and at-end composer checks without those hunks.

Remove the whole patch only after both conditions hold. Closing a related
upstream issue alone is not sufficient.

## react-native-reanimated@4.7.1

Why:
- Fixes production-only web crashes in Reanimated's JS web updater
  (`ReanimatedModule/js-reanimated/index.js`) when animated refs resolve to
  wrapper objects without `props` or `_touchableNode`
- Unwraps refs more defensively (`getComponentFromRef`) so the DOM-style
  branch is taken on React Native Web 0.19+ regardless of whether
  `createReactDOMStyle` is exported, with a transform serializer fallback
- Guards `InlinePropManager.inlinePropsHasChanged` and `getInlineStyle`
  against null inputs, so `Object.keys`/`Object.entries` calls in those
  hot paths no longer throw. (Reanimated 4.5 rewrote
  `PropsFilter.animatedProps` to null-safe `for...in` iteration, so the
  former `initial.value == null` guard there is no longer carried.)
- Works with the web bundler alias in `apps/tlon-web/vite.config.mts` that
  keeps Vite on the patched top-level Reanimated package instead of a stale
  nested copy

Note: 4.x already fixed the older v3 `getInlinePropsUpdate` recursion bug
(`typeof null === 'object'`), so that part of the v3 patch is no longer
needed.

Local patch:
`patches/react-native-reanimated@4.7.1.patch`

Upstream:
- repo: `software-mansion/react-native-reanimated`
- matching issue: `software-mansion/react-native-reanimated#6775`, still open
  on October 16, 2026
- 4.7.1 already guards `component.props` before reading its keys, but keeps
  the rest of the vulnerable web updater structure

Validation:
- Build web production with `pnpm --filter tlon-web exec vite build`
- Open a production build or `vite preview` session and verify channel open
  and sidebar switches no longer emit `Cannot convert undefined or null to
  object` from Reanimated bundles
- Confirm the emitted Reanimated chunk
  (`dist/assets/react-native-reanimated-*.js`) contains the patched code. The
  minifier renames `getComponentFromRef` and `createTransformValueFallback`,
  so search for what survives: the transform units table
  (`perspective:"px",rotate:"deg"`) and the `getAnimatableRef()` unwrapping
  that falls back to `.current?.host`

Removal:
Remove this patch once we upgrade to a Reanimated version that includes an
upstream fix for the web JS updater path and confirm production web no longer
needs the local guards or transform fallback.

## @mattermost/react-native-paste-input@2.0.1

Local patch:
`patches/@mattermost__react-native-paste-input@2.0.1.patch`

### iOS paste never registers under Expo bridgeless

Why:
On iOS with the New Architecture (bridgeless), the library's paste interception
silently never installs, so pasting an image into a `PasteInput` does nothing —
`onPaste` never fires and no "Paste" option appears for image-only clipboard
contents. `PasteInputModule` captures `reactHost` once in `+setup:`, but the
base `RCTRootViewFactory` creates the `RCTHost` lazily on the first surface
mount, which happens after our `AppDelegate` calls
`PasteInputModule.setup(factory.rootViewFactory)`. Since Expo SDK 58 the
`SceneDelegate` starts React Native, so setup now runs before any surface
exists, and only the patch makes that order work. So `reactHost` is nil when
setup captures it, the Fabric surface presenter can't be resolved, the backing
`UITextView` is never found, and the `paste:`/`canPerformAction:` swizzle is
never applied.

What it does:
Keeps the `rootViewFactory` and re-reads `reactHost` from it lazily in
`getSurfacePresenter` — by the time a `PasteInput` mounts, the host exists.
No-op on setups where `reactHost` is already populated at setup time.

Upstream:
- fix submitted: [mattermost/react-native-paste-input#56](https://github.com/mattermost/react-native-paste-input/pull/56)

Validation:
- Rebuild the iOS app so the native patch is compiled in
- Focus a chat composer, put an image on the pasteboard (e.g.
  `xcrun simctl pbsync host <udid>` with a PNG on the Mac clipboard), and paste:
  the image attaches (previously nothing happened and no "Paste" option showed)

Removal:
Remove once [mattermost/react-native-paste-input#56](https://github.com/mattermost/react-native-paste-input/pull/56)
(or an equivalent host-resolution fix) ships in a released version we depend on.

Note:
This carries only the iOS native fix. `findNodeHandle` (upstream
[#55](https://github.com/mattermost/react-native-paste-input/pull/55)) is
intentionally NOT included — on RN 0.85 and later the input's `__nativeTag` is populated,
so that change is unnecessary here and the lazy-host fix alone restores paste.
Android image paste is a separate, still-open limitation (the context-menu path
only reads `item.uri`) and is not patched here.

### Bridge fallback does not compile on React Native 0.88

Why:
`getSurfacePresenter` falls back to the bridge's
`RCTSurfacePresenterBridgeAdapter` when there is no React host. React Native
0.88 builds with `RCT_REMOVE_LEGACY_ARCH`, which compiles that class out, so
the module no longer builds.

What it does:
Wraps the bridge fallback in `#ifndef RCT_REMOVE_LEGACY_ARCH`. The app is
bridgeless and always takes the React host branch above it.

Upstream:
- none found as of October 16, 2026; 2.0.1 is still the latest release

Validation:
- The iOS app builds, and the paste check above still attaches an image.

Removal:
Drop this hunk with the rest of the patch once a release stops referencing
the bridge adapter.

## @op-engineering/op-sqlite@15.2.5

Local patch:
`patches/@op-engineering__op-sqlite@15.2.5.patch`

Why:
The iOS module reads the JSI runtime by casting the bridge to `RCTCxxBridge`.
React Native 0.87 removed that class with the old architecture, so the module
no longer builds on 0.88.

What it does:
Backports op-sqlite 18.1.0's fix: reads `-runtime` from the bridge through a
small protocol. In bridgeless mode the bridge is an `RCTBridgeProxy`, which
implements that method, so this reaches the same runtime the cast did on
0.86. Android is unchanged; it still builds against 0.88's
`catalystInstance` shim, as op-sqlite 18 does.

Upstream:
- [OP-Engineering/op-sqlite#433](https://github.com/OP-Engineering/op-sqlite/pull/433),
  released in 18.1.0

Why not upgrade:
op-sqlite 16 to 18 carry breaking changes. Most importantly, 17.0.0 makes
`executeRawAsync` return `{ rawRows, columnNames }` instead of row arrays, and
drizzle-orm 0.39.3, which we pin and patch, reads its result as rows. Moving
the database driver three majors belongs in its own change.

Validation:
- The iOS app builds, opens its database, and loads the chat list.

Removal:
Drop the patch when we upgrade to op-sqlite 18.1.0 or later together with a
drizzle-orm that reads `rawRows`.

## react-native-country-codes-picker@2.3.5

Local patch:
`patches/react-native-country-codes-picker@2.3.5.patch`

Why:
The package ships its TypeScript source (`index.tsx`) as its entry point, so
our typecheck checks it. Its types disagree with ours in a few places.

What it does:
Type-only fixes. Uses `React.ReactElement` where it named the global `JSX`
namespace, casts the search bar style to `TextStyle`, and passes `undefined`
rather than `null` as the list header when there is none, which React Native
0.88's strict types require. Rendering is unchanged.

Validation:
- `pnpm -r tsc` passes.

Removal:
Drop it if the package publishes compiled output with declarations, or if we
replace the picker.

## react-native-branch@5.9.2 and @react-native-cookies/cookies@6.2.1

Local patches:
- `patches/react-native-branch@5.9.2.patch`
- `patches/@react-native-cookies__cookies@6.2.1.patch`

Why:
React Native 0.88 builds Android with Android Gradle Plugin 9 on Gradle 9.
Two old Android build scripts no longer configure there:
- react-native-branch declares a `BuildConfig` field, and AGP 9 no longer
  generates `BuildConfig` unless a library turns it on. React Native's Gradle
  plugin turns it on only for libraries that apply it, and Branch does not.
  The latest release, 7.0.0, has the same script.
- @react-native-cookies/cookies adds the `jcenter()` repository, which
  Gradle 9 removed. The package is deprecated and has no fixed release.

What they do:
- Branch: enables `buildFeatures.buildConfig` in its `android` block.
- Cookies: uses `mavenCentral()` where it used `jcenter()`.

Validation:
- `pnpm --filter tlon-mobile android:update-lockfile` configures the project.
- The Android app builds.

Removal:
- Branch: drop it with the Branch SDK (P3.1 of the Branch exit plan), or when
  a release enables `buildConfig` itself.
- Cookies: drop it if we replace the package, or a release stops using
  `jcenter()`.

## @tamagui/build@2.4.2

Local patch:
- `patches/@tamagui__build@2.4.2.patch`

Why:
`packages/ui` builds with `tamagui-build --skip-types`. TypeScript 7 (the native
compiler) ships no `ts.sys`, but `tamagui-build.js` builds a module-level
`formatHost` that reads `ts.sys.getCurrentDirectory` and `ts.sys.newLine` as the
file loads. That throws `Cannot read properties of undefined (reading
'getCurrentDirectory')` before `--skip-types` is even considered, so
`pnpm build:packages` cannot get past `@tloncorp/ui`.

What it does:
Guards both reads with optional chaining and a fallback (`process.cwd()` and
`'\n'`). `formatHost` is only consumed by `reportDiagnostics`, which
`--skip-types` never reaches, so this restores the JS-only build without
changing behavior when `ts.sys` is present.

Upstream:
- fix submitted: [tamagui/tamagui#4171](https://github.com/tamagui/tamagui/pull/4171)
- still present in `@tamagui/build@2.7.7`, the latest release at time of writing

Validation:
- `pnpm build:packages` completes, emitting `packages/ui/dist`

Removal:
Remove once [tamagui/tamagui#4171](https://github.com/tamagui/tamagui/pull/4171)
(or an equivalent guard) ships in a released `@tamagui/build`.

## @tamagui/static@2.4.2: TypeScript compiler API dependency

`pnpm-workspace.yaml` adds the extractor's missing runtime dependency on
TypeScript through `packageExtensions` and scopes its override to TypeScript 5.9.
The published package only lists TypeScript in `devDependencies`, even though
its config loader and import resolver call `ts.sys`, `findConfigFile`, and
`nodeModuleNameResolver` at runtime. Resolving the hoisted TypeScript 7 instead
throws while loading the Tamagui config and silently disables static extraction
in an otherwise successful web build.

Project type checks and API declarations still use TypeScript 7. Remove this
exception when the extractor declares a compatible runtime dependency or no
longer needs the legacy compiler API. Validate with `pnpm build:web`: the config
must load and extraction must finish without `fileExists` or `Must provide
components` errors.
