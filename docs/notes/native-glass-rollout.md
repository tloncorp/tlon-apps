# Native glass rollout: temporary constructs

Things introduced (or kept alive) by the native glass work that are meant to go
away. Each entry follows the format used by `patches/README.md`: why it exists,
how to validate it still behaves, and the condition that lets us delete it.

Add to this file whenever the rollout introduces something temporary. The point
is that debt we are carrying deliberately stays distinguishable from debt the
next change inherits by accident.

## iOS 26 capability gates

Where:
`packages/app/ui/components/nativeScrollEdgeEffects.ts` (`supportsNativeScrollEdgeEffects`),
`packages/app/ui/components/glassChrome.ios.ts` (`canUseLiquidGlass`), and the
`@available(iOS 26.0, *)` checks in
`apps/tlon-mobile/modules/tlon-scroll-edge-effect`.

Why:
Scroll edge effects and Liquid Glass are iOS 26 APIs. Everything below 26 has to
keep rendering the previous chrome, so each surface asks a capability flag rather
than a version number.

Validate:
Run on an iOS 26 simulator and on one below 26. The lower version should show the
blur fallback everywhere, with no missing chrome and no crash.

Removal:
When the minimum deployment target reaches iOS 26, delete the flags and inline
the true branch. Components consume the named capability rather than the version
check, so this should be a deletion at the definition sites rather than a sweep
through the UI.

## `NativeTabRedirect`

Where: `packages/app/navigation/RootStack.tsx`.

Why:
Notifications, deep links, and reset helpers target the route names `Contacts`,
`ChatList`, and `Activity` directly. The native tab shell moved those screens
into a nested tab navigator, so these adapters keep the old route names working
by resetting into the corresponding tab.

Validate:
Open the app from a notification and from a deep link targeting each of those
three routes. Each should land on the right tab with the tab bar in the correct
state.

Removal:
Once every caller targets the nested tab routes directly, delete the adapters and
the `getNativeTabRoute` mapping. Note this only exists on native - the web branch
of `RootStack` registers the real screens, and that branch is not temporary.

## Header and tab icon PNGs

Where: `packages/app/navigation/assets/` (44 files).

Why:
React Navigation's native header and tab bar take raster image sources, so the
icons used there cannot reuse the SVG components in
`packages/ui/src/assets/icons`.

Validate:
Compare each header/tab icon against its SVG counterpart at 1x/2x/3x after any
icon change.

Removal:
Not removable while native headers are in use, but the duplication should stop
being manual - generate the PNG triples from the SVG sources in a build step. The
AddPerson icon update in this branch had to touch both by hand, which is the
failure mode to design out.

## Web `PostList` sharing the LegendList implementation

Where:
`packages/app/ui/components/Channel/PostList/PostList.web.tsx` imports
`PostListLegendList.tsx`.

Why:
The LegendList implementation serves every native list shape and the web
multi-column fallback, so web imports it directly rather than through the
platform-resolved `./PostList` entry (which would resolve to itself).

Validate:
Multi-column collections (gallery) on web should scroll and paginate the same as
on native.

Removal:
Not scheduled. Recorded here because the indirection through the one-line
`PostList.tsx` shim looks redundant until you notice the web file needs a
distinct module specifier to import.
