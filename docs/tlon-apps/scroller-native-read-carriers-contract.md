# Native reading carriers

Before component controls: row context carries exact current membership incarnation
without introducing a view. Only the outer actual ContentRenderer publishes row
membership, using its actual selected content prop, including edit fallback. Nested
renderers/references get no inherited row registration. Pure derived React state
retains block lineage; discarded renders cannot mutate committed identities.

Replace each existing styled view host with a native carrier using its complete
Tamagui static configuration, preserving inherited defaults, context, variants,
accessibility and children. `asChild` is excluded: the installed native style
processor drops values equal to styled defaults in that mode. No UIView inside Text. Native carrier ref
and descriptor are forwarded atomically; non-iOS uses an ordinary View with no
native manager import or descriptor leakage. Scope accepts the root descriptor.

Initially paragraph/header/big-emoji blocks use their existing outer wrapper as a
single-Paragraph carrier. Images use the existing Pressable host. Other/custom
blocks retain membership but have no admitted inner carrier. Native rejects missing,
ambiguous or unsupported actual geometry. Media identity uses the effective source
(including imageProps override), exact current source ticket and successful native
load dimensions/URL. Replacement and errors revoke readiness; old/ABA callbacks
cannot certify the new image, and existing callbacks/layout behavior are preserved.

Controls exercise actual React components with named native/Tamagui/renderer stubs,
checking descriptor/content association, nested exclusion, lineage on update and
aborted render, membership isolation, prop/ref preservation and media source races.
They do not qualify UIKit/Fabric mounting, full complex content or presented frames.

## Supported surface and remaining qualification

The list supplies scope/visit and loaded membership; ScrollerItem adds only React
row context. ContentRenderer consumes the actual selected content prop, publishes
one row manifest, and clears inherited ownership for nested renderers/references.
Default paragraph, header and big-emoji wrappers are candidate text carriers;
the native provider still requires exactly one supported mounted Paragraph.
Default images use the existing Pressable host and actual effective source.
Lists, tables, code, blockquotes, link previews, A2UI, video/audio, files and custom
block/wrapper implementations retain membership but have no inner carrier here.
Their geometry is unavailable, not qualified by the supported text/image slice.

Moderation, deleted, hidden and blocked ChatMessage branches can replace
StaticChatMessage entirely. They bypass this ContentRenderer carrier and remain
an explicit required native qualification gap. A physically absent carrier does
not independently prove semantic removal. Product validation must cover those
branch transitions before claiming content coverage complete.

Image readiness belongs to the current effective source and exact row/block
incarnation. Source replacement or a new visit creates a new image ticket;
late/ABA callbacks cannot affect the new image. Failure retires that ticket
before a later success callback can revive it. Same-asset content revisions keep
the loaded image while publishing current block metadata. No source-event or
pixel-exposure proof is inferred from a placeholder.

## Focused evidence, 2026-09-07

Twenty-three actual component controls pass, alongside the existing 22
ScrollerItem layout and six list-marker controls: **51 passed, zero failed**.
Scoped TypeScript and diff checks pass. The tests use the actual installed
Tamagui native slot prop merger with named native/rendering boundary stubs;
font shaping, UIImageView/Fabric geometry and presentation are not executed.
An abandoned Suspense render preserves committed lineage. Source races include
replacement, ABA, old visits, errors and same-asset revisions.

Preserved red controls found two initial readiness gaps (late success after
error and nonfinite dimensions), plus premature image replacement on a
same-asset revision. The repaired consumer controls reject those failures.
Early harness runs that inspected cyclic React test trees or used incomplete
leaf stubs are retained separately and do not count as product failures or
passing evidence. Receipts: `/private/tmp/scroller-native-read-carriers-20260907`.
No app build, browser, simulator or actual UIKit navigation ran for this slice.

## Production native host correction

R9/R10 native recordings retain zero row/inner registrations despite a resident
scope. The installed non-test native Tamagui hook creates optimized `RCTView`
content before handling a `render` override, then keeps that existing content.
The earlier test boundary bypassed this production optimization and therefore
did not prove that an Expo Item host would be constructed.

The corrected component controls execute the installed production `useChildren`,
optimized View body and custom-render decision with actual React and native Slot.
Original components reproduce **5 passes/18 failures**. Supported row, text and
image carriers now use `asChild` with the actual carrier as the direct child;
Slot is selected before the base-View optimization. This preserves one equivalent
host, layout, children, ref and touch handlers. Custom unsupported overrides and
ordinary non-iOS paths remain outside admission.

The repaired suite passes **25 component controls**, plus **23 metadata controls**.
UIKit/Fabric registration and READ admission still need native runtime evidence;
the source correction does not change prior raw verdicts. Red/green and scoped
typecheck receipts: `/private/tmp/scroller-native-carrier-aschild-20260907`.

## R11 styled-default correction

The R11 registration fix made rows/inners mount, but same-key R10/R11 content
comparison exposed approximately 24pt missing text-body height. Installed
`getSplitStyles` filters `BlockWrapper`'s default `$l` padding under `asChild`;
row defaults were affected too. Original raw and optimization/Slot-only controls
remain retained at `/private/tmp/scroller-carrier-layout-comparison-r10-r11-20260907`
and `/private/tmp/scroller-native-carrier-aschild-20260907`.

The replacement reuses each original frame's complete `staticConfig` with an
explicit native host, retaining theme/default/variant lineage without copied style
values. Image Pressable retains its existing interaction, disabled and link logic;
an optional frame element replaces only its existing styled View. Tamagui delegates
press handling to custom bases, so the iOS carrier attaches RN's public
`usePressability` responder to the same physical view, preserving forwarded refs
and explicit callbacks and respecting external press ownership. The hook is confined
to `.ios.tsx`; the shared helper and desktop fallback do not import it.

Controls now execute the installed default filter, native optimization/Slot path,
actual Pressable, and installed RN Pressability/usePressability bodies. Native
measurement, feature flags and sound remain named stubs; token/Yoga resolution
is modeled. This verifies source behavior, not UIKit touch delivery or the restored
body height in a rebuilt app. The next native batch must qualify those outcomes.

The corrected focused run has **33 carrier controls plus 23 metadata controls,
56 passed / 0 failed**, and scoped TypeScript exits 0. The installed default-filter
red is 24 passed / 3 failed; the native responder red is 28 passed / 3 failed.
Receipts, errors and original sources are retained at
`/private/tmp/scroller-native-carrier-style-defaults-20260907`.
