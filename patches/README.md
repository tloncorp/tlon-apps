# Patched Dependencies

This directory contains local dependency patches applied through
`pnpm.patchedDependencies` in the repo root `package.json`.

When adding a patch, document:
- why we need it locally
- the upstream issue or PR it came from
- how to validate it
- when it can be removed

## @gorhom/bottom-sheet@5.2.6

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

Local patch:
`patches/@gorhom__bottom-sheet@5.2.6.patch`

Background and reproduction details: PR #5790 (closed, kept for reference).

Validation:
Open any sheet whose content is a `flex:1` `ScrollView` with content larger
than the viewport plus a footer (e.g. CreateChatSheet). The footer should be
visible at the bottom of the sheet on first open.

Removal:
Drop this patch once we either move to building React Native from source
(so we can flip the Yoga `WebFlexBasis` flag and fix the bug at the
layout-engine level), or once `@gorhom/bottom-sheet` ships an equivalent
workaround upstream.

## react-native@0.81.5

Local patch:
`patches/react-native@0.81.5.patch`

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

## react-native-reanimated@4.1.6

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
`patches/react-native-reanimated@4.1.6.patch`

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

## react-native-gesture-handler@2.28.0

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
`patches/react-native-gesture-handler@2.28.0.patch`

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

## expo-image-manipulator@14.0.8

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

Local patch:
`patches/expo-image-manipulator@14.0.8.patch`

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
Remove this patch once `expo-image-manipulator` ships an equivalent orientation
normalization fix, or once we replace upload resizing with a lower-level ImageIO
thumbnail path.

## @tamagui/web@2.4.0

Why:
tamagui removed its undocumented `unset` style value in 2.x (upstream
`86d0cfe95` — `chore: remove undocumented unset style value`). We use `"unset"`
in ~56 places to mean "no value here" (e.g. `backgroundColor="unset"`,
`aspectRatio="unset"`). On web `unset` is a valid CSS keyword and still renders,
but on native `propMapper` now passes it straight to the React Native style and
RN throws on strict props — `aspectRatio` redboxes with "aspectRatio must
either be a number, a ratio string or `auto`. You passed: unset".

What it does:
Patches the two native `propMapper` variants
(`dist/{cjs,esm}/helpers/propMapper.native.js`) to drop a prop whose value is
`"unset"` (`if (value === "unset") return;`). The prop then falls back to the
property's initial value (transparent / auto / 0) and overrides styled-component
defaults the same way the value did before. The web bundles are intentionally
left unpatched, since `unset` is a valid CSS keyword there.

Local patch:
`patches/@tamagui__web@2.4.0.patch`

Upstream:
- removed deliberately in `tamagui/tamagui@86d0cfe95`; the configurable `unset`
  feature is not coming back
- native parity fix proposed upstream ("drop `unset` on native instead of
  crashing"): `tamagui/tamagui#4053`

Validation:
- Rebuild the mobile app so the patched bundle is picked up
- Open a post with an image, the Activity feed, and a content reference and
  confirm there's no `aspectRatio ... You passed: unset` redbox
- Confirm `node_modules/@tamagui/web/dist/esm/helpers/propMapper.native.js`
  contains `if (value === "unset") return;`

Removal:
Remove this patch once either the upstream native fix lands in a tamagui version
we use, or we migrate all `"unset"` style usages to explicit values
(`transparent` / `undefined` / `auto`) so nothing relies on the dropped value.
