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
