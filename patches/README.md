# Patched Dependencies

This directory contains local dependency patches applied through
`pnpm.patchedDependencies` in the repo root `package.json`.

When adding a patch, document:
- why we need it locally
- the upstream issue or PR it came from
- how to validate it
- when it can be removed

## react-native@0.81.5

Why:
Enables Yoga's experimental `WebFlexBasis` feature, which fixes a flex-basis
caching bug that makes flex children stick at their initial intrinsic content
size when the parent's main-axis size transitions from undefined to defined
across renders. The visible symptom in this app is a sheet/modal whose footer
or "submit" button gets pushed off-screen when the sheet animates in over a
ScrollView/View whose content is taller than the eventual viewport.

(The patch also keeps a separate, pre-existing `BaseTextInputShadowNode`
change related to TextInput attributed-string sync.)

Local patch:
`patches/react-native@0.81.5.patch`

Upstream:
- issue: `facebook/yoga#1552` (open since Jan 2024)
- the fix already exists in Yoga as the `WebFlexBasis` experimental feature
  flag — it just isn't enabled by default in React Native because rolling it
  out historically broke Meta-internal apps that relied on the buggy behavior

Background and tradeoffs are documented in PR #5790, including the
same-generation re-measurement edge case the upstream maintainer flagged.

Validation:
Build the iOS app and verify that opening any animated bottom sheet (gorhom or
Tamagui) with a flex:1 ScrollView/View larger than the viewport keeps the
footer / submit button visible at the bottom of the sheet.

Removal:
Drop this patch once we upgrade to a Yoga/React Native version that enables
spec-compliant flex-basis recomputation by default (i.e. the upstream issue is
resolved without needing the experimental flag).

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
