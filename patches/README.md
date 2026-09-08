# Patched Dependencies

This directory contains local dependency patches applied through
`patchedDependencies` in the repo root `pnpm-workspace.yaml`.

When adding a patch, document:
- why we need it locally
- the upstream issue or PR it came from
- how to validate it
- when it can be removed

## stim-cli@1.0.0-rc.7

Adds `ios --scheme` so the preview app can use Stim without selecting the default
production target. The command validates the requested shared scheme, forwards
it to Xcode and reports `xcodeScheme`. Explicit schemes have separate lookup,
storage and build-lock keys, including after Pods changes. Fingerprint-only
project providers are bypassed for explicit schemes; local and key-based caches
still work.

Adds `--simulator-arch arm64|x86_64` for local simulator builds so Release does
not compile an unused second architecture. It forwards `ARCHS` and
`ONLY_ACTIVE_ARCH`, reports `simulatorArchitecture`, and separates architecture
keys at both fingerprint stages. Remote and physical-device use is rejected.

Derived from official Stim commit `95782a3120f7963333e9af9586dc0775506e2c1f`.
Remove when the pinned upstream version supports explicit scheme and simulator
architecture selection with equivalent cache isolation. Validate with
`node --test scripts/test-stim-ios-scheme.mjs`.
The custom `ENTRY_FILE` Release-swap limitation is separate and remains open.

## @legendapp/list@3.3.3

Local patch:
`patches/@legendapp__list@3.3.3.patch`

Why:
The native cached-range shortcut leaves the visible IDs stale when no optional
viewability callback is configured. The next row-size update can preserve a
message that has already left the viewport, jumping the reader by the height
of an unrelated row. Source controls reproduce this stale-anchor defect. R4
also observed an internal viewport about 502 pt ahead of the actual native
offset; R5 reproduced a 498 pt explicit center-command landing error. With the
completion and offset-recovery repairs installed, R6 preserves the history-cache
reader within 0.333008 pt. Explicit message centering still misses by 3.999837 pt
because the indexed cell includes decoration outside the message body. The
dynamic offset API below supports the app's measured correction; that correction
is integrated. R7 reaches the final center within 0.000489 pt, but incomplete
capture and a separate transient native offset failure leave qualification open.

What it does:
Refreshes the visible IDs on every valid cached-range pass. Invalid cached
ranges fall through to the existing full calculation. Viewability and
first-visible callbacks retain their existing opt-in and deduplication rules.
Both native CommonJS and ESM entries carry the same change.

Ordinary iOS indexed completion now requires an actual native observation at
the current measured target. Timer callbacks and promise settlement belong to
the exact command revision. Exhausted retries reject with
`LEGEND_SCROLL_UNALIGNED` instead of reporting a successful landing. Expired
MVCP suppression reconciles the logical offset only from a fresh native event
owned by the same command and suppression timer.

`cancelScroll` accepts the exact promise returned by this list's scroll method.
It retires that request's queued dispatch and JS retries when its app owner
loses focus, unmounts or yields to newer input. A settled request, another list's
promise or a superseded request cannot cancel current work. Already delivered
UIKit animation is outside this API's scope. The indexed-completion controls
cover pending, active, cross-list and reentrant cancellation.

iOS `scrollToItem` with an explicit key extractor follows the accepted item
key through deferred dispatch, insertions, removal, reorder and immutable data
replacement. A missing key rejects instead of completing on a neighboring row.
Geometry must match the current data/version/key; a structurally equivalent
array can retain an already valid layout cache. The default normalized index
extractor preserves legacy item semantics. Bootstrap and non-iOS completion
keep their existing behavior. This does not cancel already dispatched native
animations or change the choice of reading anchor.

Ordinary iOS keyed `scrollToItem` also accepts an optional `getViewOffset`
resolver for current app-owned geometry. Missing, stale or nonfinite geometry
cannot silently become zero or certify completion. The resolver is checked at
dispatch, layout correction, retry and native completion; callbacks that change
the command, target identity or layout invalidate that particular result. An
old layout callback cannot clear a newer command's pinned render range. The
native declaration documents the new optional parameter.

An unmounted keyed target gets a command-owned single-row render pin before the
resolver is ready. Acquisition mounts the target without moving either scroll
offset. Removal, rebuild, supersession and timeout release only that command's
pin; current geometry is still required before dispatch.

On Fabric, the content extent now uses the same React store subscription and
commit path as row positions. Previously, its Animated value could shrink the
scrollable range before surviving rows moved, causing a legal-range clamp and
a visible reading jump during removal. Legacy native keeps its existing
Animated extent. The handoff controls exercise removal, size updates, append
and horizontal layout with a held React commit. R20 simulator recordings pass
both near-end and history removal: 111 qualified native frames each, maximum
anchor drift 0.000326 pt, and both mutation-semantic checks pass. Bridged
JavaScript/native acquisition remains incomplete; this is native geometry
evidence, with presentation qualification still open.

Upstream:
Locally derived from the installed 3.3.3 native source and recorded scroller
regressions. No upstream issue or PR has been submitted for this patch.

Validation:
- Run `pnpm test:scroller:dependencies`. Its Legend suites execute actual installed
  native function bodies for visible IDs, completion, offset recovery and item
  identity/acquisition in both bundle formats. Native event delivery and peripheral layout
  remain modeled, so these controls do not prove native rendering or smoothness.
- Rebuild and run the standalone `command-center` iOS case. The requested
  message must reach its independently measured center within the original
  deadline and remain there through the quiet tail.
- Rebuild the iOS fixture and run history growth and cache replacement while
  reading above the changed row. The same reading point must remain visible.
- Separately test removal plus neighboring-message regrouping; this patch
  does not change which current visible row the library chooses to preserve.

Removal:
Remove after the pinned library provides the same visible-ID, observed
completion, owned recovery and stable item-identity behavior, then rerun all
dependency controls and affected iOS scenarios without it.

## react-native@0.86.0: Fabric visible-position preparation

Local patch: `patches/react-native@0.86.0.patch`. This hunk is independent of
the existing text-measurement patch in that file.

Fabric can skip visible-position preparation while the prop is disabled, then
adjust after the same mount enables it. A saved old frame or missing weak view
can then produce an invalid correction. Each preparation now clears old state;
adjustment consumes it once and verifies the current content/view identity and
revision before writing. Recycle and reentrant callbacks cannot reuse it.

The source controls reproduce disabled/enabled, missing-view, repeated-adjustment
and reentrant ownership failures while preserving ordinary horizontal/vertical
adjustment. They use extracted installed native bodies in a host harness; a
rebuilt RN core and simulator run are still required. The suspected relationship
to R7's transient offset remains a hypothesis until runtime evidence qualifies it.
No upstream issue or PR has been submitted. Remove this hunk when upstream
provides equivalent fresh, single-use preparation and the same controls plus
affected native scenarios pass without it.

### Reading correction during native range clamps

The coordinated RN and Legend changes prevent an automatic UIKit range clamp
from being added a second time when a row mutation's relative correction
arrives. The tagged request identifies its exact intent and operation, with an
actual native starting offset and the cumulative amount at that point. The
native fallback uses that basis and the current adjusted legal range. An
admitted reading-point provider keeps sole authority over its own correction.

Native retains only the latest confirmed completion of the current operation.
That lets a second mutation use the actual bounded result even before JS has
received the first acknowledgement. Completion retires with its native owner,
intent or operation. A matching acknowledgement travels through the existing
scroll event without coalescing; stale or mismatched acknowledgements cannot
settle newer work. This also handles a target already at its legal bound, where
UIKit need not produce a normal scroll callback. Branch-only older wire shapes
are unsupported by the production implementation.

Validate with `pnpm test:scroller:dependencies` and
`pnpm test:scroller:rn-read-point`, then rebuild and run the iOS mutation corpus.
Host controls cover before-delivery clamps, completed-clamp races, grow/shrink,
lost acknowledgements and retired owners; they do not establish device
presentation. Provider integration is documented in
`apps/tlon-mobile/modules/tlon-scroll-edge-effect/ios/READ_PROVIDER_CONTRACT.md`.
No upstream issue or PR has been submitted. Remove this coordinated patch only
when equivalent reading correction and request ownership are available without
it and the same regression corpus passes.

## expo-notifications@57.0.6

Local patch:
`patches/expo-notifications@57.0.6.patch`

Why:
On Android cold starts, expo-notifications queues the notification response
until its native emitter is registered. Version 57.0.6 delivers that queued
response but does not remove it. If the native module is recreated while the
app process remains alive, the same notification tap is emitted again and the
app routes back to the original channel. Killing the process clears the queue.

What it does:
Tracks whether a native listener handled each queued response and drains the
queue after successful delivery, for both structured responses and responses
reconstructed from launch-intent extras. The mobile package also lists
`expo-notifications` in Android's `buildFromSource` configuration so this patch
is compiled instead of the package's prebuilt AAR.

Upstream:
- `expo/expo#47615`
- commit `6bbdfb1b7ac8029f83ebbe41a6cd4ced67684704`

Validation:
- Build and launch the Android `productionDebug` variant.
- Open the app from a channel notification, background it, then reopen it from
  the launcher without killing the process. It must stay on the current screen
  instead of routing back to the notification's channel.

Removal:
Drop this patch when the pinned expo-notifications release includes
`expo/expo#47615`, then remove `expo-notifications` from Android's
`buildFromSource` list and refresh the Gradle dependency lock.

## @react-navigation/bottom-tabs@7.18.14 and react-native-screens@4.25.2

Local patches:
- `patches/@react-navigation__bottom-tabs@7.18.14.patch`
- `patches/react-native-screens@4.25.2.patch`

Why:
Android native tabs tint every image icon with the navigation bar's active or
inactive color. That is correct for our monochrome Home and Activity assets,
but it turns the Contacts avatar or colored sigil into a flat monochrome icon.
React Navigation exposes `tinted: false` for image icons only on iOS, and its
shared image-source adapter does not forward that choice to Android.

What they do:
The React Navigation patch forwards the existing `tinted` option through the
shared native-tab image source and declares Android support. The
react-native-screens patch carries that value through its Android Fabric prop
and disables Material's icon tint list for that tab item. Other tab items keep
the default native tint behavior.

Upstream:
- no equivalent Android `tinted: false` support was available in React
  Navigation 7.18.14 or react-native-screens 4.25.2 when this patch was added

Validation:
- Rebuild the Android app so the native patches are compiled in
- Confirm Home and Activity still use the Material active/inactive tint
- Confirm a photo Contacts avatar keeps its original colors
- Remove the current user's avatar temporarily and confirm the colored sigil
  also keeps its original foreground and background colors

Removal:
Remove both patches together once React Navigation and react-native-screens
ship Android support for untinted native-tab image icons.

## @gorhom/bottom-sheet@5.2.14

Local patch:
`patches/@gorhom__bottom-sheet@5.2.14.patch`

This patch carries two independent fixes.

### 1. First-open layout of flex:1 sheet content

Why:
On the first open of a bottom sheet whose content is a `flex:1` ScrollView/View
with content larger than the eventual viewport (a long scrollable list with a
footer/submit button below it), the footer ends up positioned past the bottom
of the visible sheet. The first frame of `contentMaskContainerAnimatedStyle`
returns `{}` while the container height is still being measured, so the
flex:1 child is laid out at intrinsic content size; once the real height
arrives a frame later, Yoga keeps the stale flex-basis from the unconstrained
pass and the child overflows.

The patch returns `{ height: 0 }` on the initial frame so children never get
a chance to lay out at intrinsic size, then snaps the height directly
(without going through `withTiming`) on the first real layout pass to avoid
animating the height up from 0. Subsequent transitions use the normal
animated path.

This is a workaround for an underlying Yoga bug that affects any flex tree
with the same shape, not just gorhom — see facebook/yoga#1552. The proper RN
fix (enabling Yoga's `WebFlexBasis` flag) requires building React Native
from source, which we currently don't do; the writeup is in the closed
draft PR linked below.

Background and reproduction details: PR #5790 (closed, kept for reference).

Validation:
Open any sheet whose content is a `flex:1` `ScrollView` with content larger
than the viewport plus a footer (e.g. CreateChatSheet). The footer should be
visible at the bottom of the sheet on first open.

Removal:
Drop this hunk once we either move to building React Native from source
(so we can flip the Yoga `WebFlexBasis` flag and fix the bug at the
layout-engine level), or once `@gorhom/bottom-sheet` ships an equivalent
workaround upstream.

### 2. Modal dismiss() bricks the modal when already dismissed

Why:
`BottomSheetModal.dismiss()` called while the modal's status is `INITIAL`
(never presented, or already fully dismissed and reset) falls through the
already-closed early-exit, permanently sets the internal status to
`DISMISSING`, and every later `present()` silently no-ops. Our
`BottomSheetWrapper` calls `dismiss()` whenever `open` flips false — which
is always the case right after a user-initiated close (backdrop tap / swipe
down) has already dismissed the modal internally — so modal sheets (e.g. the
personal invite sheet) could only be opened once per mount.

What it does:
Adds `MODAL_STATUS.INITIAL` to the already-closed early-exit in
`handleDismiss` (`src/components/bottomSheetModal/BottomSheetModal.tsx`),
making `dismiss()` idempotent.

Upstream:
- issue: `gorhom/react-native-bottom-sheet#2669`
- fix submitted: `gorhom/react-native-bottom-sheet#2711`

Validation:
- Home header → AddPerson opens the invite sheet; close it via the backdrop;
  tap AddPerson again — the sheet must open again (repeat a few times).

Removal:
Drop this hunk once `gorhom/react-native-bottom-sheet#2711` (or an
equivalent fix) ships in a release we use.

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

## react-native-keyboard-controller@1.22.0

Local patch:
`patches/react-native-keyboard-controller@1.22.0.patch`

Why:
On iOS, `KeyboardChatScrollView` implements composer growth through
`extraContentPadding`, which updates the scroll view's `contentInset`. When
`keyboardLiftBehavior="whenAtEnd"` decides not to move a user who is browsing
older messages, upstream returns without re-emitting the current
`contentOffset`. `ScrollViewWithBottomPadding` also omits `contentOffset` when
its numeric target has not changed. UIKit can therefore adjust the offset while
applying the inset by itself, producing a one-frame flash or jump when a
multiline chat composer first grows.

What it does:
- On iOS Fabric, re-publishes the currently observed offset when an
  `extraContentPadding` change should not shift the content. The guard keeps
  the workaround out of Android, web, and the legacy iOS architecture.
- Emits that offset whenever bottom padding changes, even if its numeric value
  is unchanged, so Reanimated sends the new `contentInset` and a
  `contentOffset` that preserves position in the same animated-props commit.

The app still owns the product behavior: it reports the floating composer
height to LegendList and uses the shared `whenAtEnd` policy on both platforms.
Android freezes keyboard-controller's inset path because `adjustResize`
already shrinks its viewport; iOS supplies the composer inset and performs the
offset-preserving commit.

Upstream:
- repo: `kirillzyusko/react-native-keyboard-controller`
- related discussion:
  [#1333](https://github.com/kirillzyusko/react-native-keyboard-controller/discussions/1333)
  covers layout shifts involving `whenAtEnd` and `extraContentPadding`
- related open fixes
  [#1605](https://github.com/kirillzyusko/react-native-keyboard-controller/pull/1605)
  and
  [#1609](https://github.com/kirillzyusko/react-native-keyboard-controller/pull/1609)
  address different animated-padding and Reanimated 4.6 failures
- as of August 31, 2026, upstream release `1.22.4` still has the same
  no-shift and unchanged-offset behavior; no exact upstream fix has shipped

Validation:
- Run `corepack pnpm install --frozen-lockfile` to confirm the patch applies
  and its lockfile hash is current.
- Rebuild the iOS app. With the keyboard open, grow and shrink the multiline
  composer while browsing history; the same visible message should retain its
  vertical position without flashing.
- Repeat at the end of the conversation; the latest message should remain
  anchored above the composer.
- Exercise emoji keyboard changes, momentum scrolling, and leaving/reopening
  the conversation to check for stale inset or offset state.
- Rebuild Android and confirm composer growth and keyboard dismissal retain
  the existing end-anchor behavior.

Removal:
Remove this patch after an upstream release commits `contentInset` together
with a preserving `contentOffset` for no-shift `extraContentPadding` changes,
then repeat the mid-history and at-end simulator checks without the patch.

## react-native-reanimated@4.5.0

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
`patches/react-native-reanimated@4.5.0.patch`

Upstream:
- repo: `software-mansion/react-native-reanimated`
- matching issue: `software-mansion/react-native-reanimated#6775`
- as of May 7, 2026, upstream `main` still has the same vulnerable web
  updater structure

Validation:
- Build web production with `pnpm --filter tlon-web exec vite build`
- Open a production build or `vite preview` session and verify channel open
  and sidebar switches no longer emit `Cannot convert undefined or null to
  object` from Reanimated bundles
- Confirm the emitted web bundle contains the patch markers
  (`getComponentFromRef`, `createTransformValueFallback`, and the
  `initial.value != null` guard)

Removal:
Remove this patch once we upgrade to a Reanimated version that includes an
upstream fix for the web JS updater path and confirm production web no longer
needs the local guards or transform fallback.

## react-native-gesture-handler@2.32.0

Why:
On Android, `ReanimatedSwipeable` leaves both the left and right action
containers mounted as absolute-fill views. The hidden side's container is
animated to `opacity: 0` but still receives touches, so taps on a revealed
quick action (e.g. "Mark as read" from a left swipe on a chat list item) are
swallowed by the opposite-side container sitting on top in z-order and never
reach the visible action.

What it does:
In `src/components/ReanimatedSwipeable/ReanimatedSwipeable.tsx`, the patch
adds `pointerEvents: showLeftProgress.value === 0 ? 'none' : 'auto'` to
`leftActionAnimation` and the symmetric guard to `rightActionAnimation`, so
the hidden side stops intercepting touches alongside its opacity going to 0.

Local patch:
`patches/react-native-gesture-handler@2.32.0.patch`

Upstream:
- no matching upstream fix found as of May 2026; `ReanimatedSwipeable` on
  `main` still animates only opacity on the action containers

Validation:
- Rebuild the Android app
- On a chat list item, swipe to reveal the "Mark as read" (or other) quick
  action and tap it. The tap should fire instead of being swallowed.
- Linear: `TLON-5659`

Removal:
Remove this patch once `react-native-gesture-handler` ships a version of
`ReanimatedSwipeable` that disables pointer events on the hidden action
container, and we confirm the Android repro no longer needs the local fix.

## expo-image-manipulator@57.0.1

This patch carries two independent iOS hunks.

Local patch:
`patches/expo-image-manipulator@57.0.1.patch`

### Orientation normalization (HDR HEIC uploads)

Why:
Expo's iOS orientation transformer normalizes images by manually creating a
`CGContext` with the source image's bit depth and color space, but with a
hard-coded `premultipliedLast` bitmap layout. HDR/10-bit HEIC images can fail
that context allocation with `Image context has been lost`, which prevents
mobile image uploads from finishing.

What it does:
Skips orientation normalization when `UIImage.imageOrientation` is already
`.up`. For non-upright images, uses Expo's `UIGraphicsImageRenderer` helper and
`UIImage.draw(in:)` instead of constructing a raw bitmap context. This lets
UIKit choose a supported backing context while still applying orientation and
mirroring before the requested resize runs.

Upstream:
- no matching Expo upstream fix found as of June 2026
- related public reports: `Expensify/App#81702`,
  `SDWebImage/SDWebImage#3333`

Validation:
- Rebuild the iOS app so the native patch is compiled in
- On iOS with Screen Capture set to HDR, upload an HDR HEIC screenshot that
  previously failed with `Image context has been lost`
- Confirm a rotated or mirrored HEIC/JPEG still exports upright
- Confirm ordinary JPEG and HEIC uploads still resize and upload

Removal:
Remove this hunk once `expo-image-manipulator` ships an equivalent orientation
normalization fix, or once we replace upload resizing with a lower-level ImageIO
thumbnail path.

### manipulate() SharedRef probe order (video attach crash)

Why:
Passing a shared image ref (expo-video's `VideoThumbnail`, used by the
video-poster flow in `videoPreviewData.native.ts`) to
`ImageManipulator.manipulate()` hard-crashes on SDK 56: the `Either<URL,
SharedRef<UIImage>>` argument probes `URL` first, whose converter runs the JS
value through the asserting `getAny()`, which hits a Swift `fatalError` on
shared-object instances before the `SharedRef` branch is tried. The trap is not
catchable from JS, so attaching a video killed the app.

What it does:
Swaps the argument to `Either<SharedRef<UIImage>, URL>` so shared refs match
directly without touching `getAny()`. String/URL sources fail the `SharedRef`
probe with a catchable exception and fall through to `URL` as before, so
`manipulateAsync(uri)`-style callers are unchanged.

Upstream:
- fix submitted: [expo/expo#47432](https://github.com/expo/expo/pull/47432)

Validation:
- Rebuild the iOS app so the native patch is compiled in
- Attach a video in a chat: poster generates and the upload completes
  (previously a hard native crash)
- Attach an image: resize-on-upload through the same module still works

Removal:
Remove this hunk once [expo/expo#47432](https://github.com/expo/expo/pull/47432)
(or an equivalent converter fix in `expo-modules-core`) ships in the Expo SDK
version we're on.

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
mount, which under Expo happens after our `AppDelegate` calls
`PasteInputModule.setup(factory.rootViewFactory)`. So `reactHost` is nil when
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
intentionally NOT included — on RN 0.85 the input's `__nativeTag` is populated,
so that change is unnecessary here and the lazy-host fix alone restores paste.
Android image paste is a separate, still-open limitation (the context-menu path
only reads `item.uri`) and is not patched here.
