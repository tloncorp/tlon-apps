# Patched Dependencies

This directory contains local dependency patches applied through
`pnpm.patchedDependencies` in the repo root `package.json`.

When adding a patch, document:
- why we need it locally
- the upstream issue or PR it came from
- how to validate it
- when it can be removed

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

## react-native-reanimated@3.16.7

Why:
- Fixes production-only web crashes in Reanimated's JS web updater when
  animated refs resolve to wrapper objects without `props`
- Avoids repeated web warning floods by unwrapping refs more defensively and
  updating DOM style targets directly on web
- Works with the web bundler alias that keeps Vite on the patched top-level
  Reanimated package instead of a stale nested copy

Local patch:
`patches/react-native-reanimated@3.16.7.patch`

Upstream:
- repo: `software-mansion/react-native-reanimated`
- matching issue: `software-mansion/react-native-reanimated#6775`
- as of April 24, 2026, upstream `main` still appears to have the same
  vulnerable web updater structure

Validation:
- Build web production with `pnpm --filter tlon-web exec vite build`
- Open a production build or `vite preview` session and verify channel open and
  sidebar switches no longer emit `Cannot convert undefined or null to object`
  from Reanimated bundles
- Confirm the emitted web bundle no longer contains the unguarded
  `Object.keys(component.props)` updater path

Removal:
Remove this patch once we upgrade to a Reanimated version that includes an
upstream fix for the web JS updater path and confirm production web no longer
needs the local guards or transform fallback.
