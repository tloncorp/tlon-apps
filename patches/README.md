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

## react-native-screens@4.4.0

Why:
iOS native-stack can double-pop when two back-swipe gestures happen in quick
succession, causing a brief `Channel -> GroupChannels -> ChatList ->
GroupChannels -> ChatList` bounce.

Local patch:
`patches/react-native-screens@4.4.0.patch`

Upstream:
- issue: `software-mansion/react-native-screens#2559`
- fix: `software-mansion/react-native-screens#3584`
- enabled by default: `software-mansion/react-native-screens#3652`

Validation:
Rebuild the iOS app and verify that fast successive swipe-backs no longer cause
the screen bounce.

Removal:
Remove this patch once we upgrade to a compatible `react-native-screens`
version that already includes the upstream fix. `4.24.0+` has the behavior
enabled by default.

## react-native@0.76.9

Local patch:
`patches/react-native@0.76.9.patch`

Why:
On iOS Fabric, a single-line `TextInput` that sets custom `lineHeight` can
poison later recycled inputs. In our onboarding flow, styling the bot-name
field with `lineHeight: 30` caused later placeholders like "Paste your key
here" and "Search models" to render misaligned until the app was restarted.

What it does:
In `Libraries/Text/TextInput/Singleline/RCTUITextField.mm`, this removes
`NSParagraphStyleAttributeName` and `NSShadowAttributeName` from placeholder
text attributes before building `attributedPlaceholder`.

This stops single-line placeholders from inheriting paragraph-style and shadow
attributes from the field's text styling. React Native stores iOS `lineHeight`
in the paragraph style, so clearing that is the core part of the fix.

Upstream:
- no exact upstream fix found for this placeholder/baseline bug on `0.76.x`
- related issues:
  `facebook/react-native#53050`
  `facebook/react-native#37236`
  `facebook/react-native#49933`

Validation:
- Rebuild the iOS app so the native patch is compiled in.
- In onboarding, keep the bot-name field on the risky style
  (`fontSize: 24`, `lineHeight: 30`, `height: 72`).
- Advance from bot name to API key and model search panes and confirm the
  later placeholders no longer drift downward after the bot-name screen is
  shown.

Removal:
Remove this patch once we upgrade to a React Native version where the
single-line placeholder path no longer picks up broken paragraph-style state,
and we have verified the onboarding repro without the local patch.

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
