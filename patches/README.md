# Patched Dependencies

This directory contains local dependency patches applied through
`pnpm.patchedDependencies` in the repo root `package.json`.

When adding a patch, document:
- why we need it locally
- the upstream issue or PR it came from
- how to validate it
- when it can be removed

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

## react-native@0.85.3

Local patch:
`patches/react-native@0.85.3.patch`

Why:
An uncontrolled `TextInput` (no `value` prop, content driven by children) can
measure to the wrong size when its text changes. On Fabric the shadow node
measures from the cached native attributed string (`attributedStringBox`),
which lags the React tree until the next native state update — so the input is
laid out against stale text.

What it does:
In `ReactCommon/react/renderer/components/textinput/BaseTextInputShadowNode.h`,
for inputs with no `text` prop it compares the current React-tree attributed
string against the last state-synced one, and when they differ measures from
the React-tree string (falling back to the placeholder when empty) instead of
the possibly-stale native `attributedStringBox`.

Upstream:
- Upstream PR (open): `facebook/react-native#56291` — "Fix uncontrolled
  multiline TextInput not resizing when children change". Same
  `BaseTextInputShadowNode.h` change this patch carries.

Validation:
- Rebuild the iOS app so the native patch is compiled in.
- Exercise an uncontrolled `TextInput` whose content changes via children (no
  `value` prop) and confirm it sizes to the new content rather than a stale
  value.

Removal:
Remove once `facebook/react-native#56291` lands in a version we ship. Note:
`BaseTextInputShadowNode` was refactored in 0.85, so this hunk must be
re-ported when upgrading past 0.81 if the upstream fix hasn't shipped yet.

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

## react-native-reanimated@4.3.1

Why:
- Fixes production-only web crashes in Reanimated's JS web updater
  (`ReanimatedModule/js-reanimated/index.js`) when animated refs resolve to
  wrapper objects without `props` or `_touchableNode`
- Unwraps refs more defensively (`getComponentFromRef`) so the DOM-style
  branch is taken on React Native Web 0.19+ regardless of whether
  `createReactDOMStyle` is exported, with a transform serializer fallback
- Guards `InlinePropManager.inlinePropsHasChanged` and `getInlineStyle`
  against null inputs, and `PropsFilter.animatedProps` against
  `initial.value == null`, so `Object.keys`/`Object.entries` calls in those
  hot paths no longer throw
- Works with the web bundler alias in `apps/tlon-web/vite.config.mts` that
  keeps Vite on the patched top-level Reanimated package instead of a stale
  nested copy

Note: 4.x already fixed the older v3 `getInlinePropsUpdate` recursion bug
(`typeof null === 'object'`), so that part of the v3 patch is no longer
needed.

Local patch:
`patches/react-native-reanimated@4.3.1.patch`

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

## react-native-gesture-handler@2.31.2

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
`patches/react-native-gesture-handler@2.31.2.patch`

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

## expo-image-manipulator@56.0.19

This patch carries two independent iOS hunks.

Local patch:
`patches/expo-image-manipulator@56.0.19.patch`

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
