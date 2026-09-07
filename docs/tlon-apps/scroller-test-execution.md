# Running the scroller suite

The [situation matrix](scroller-test-matrix.md) defines the accepted policies and
criteria. The [history inventory](scroller-regression-history.md) supplies past
regression leads. A registered test covers its stated variant, not every
combination of its linked matrix row.

## Oracle controls

Use Node 22.22.0 and the repository's pnpm installation. From the repository root:

```sh
corepack pnpm --dir packages/app exec vitest run \
  fixtures/scrollStabilityTrace.test.ts fixtures/scrollStabilityImageLoad.test.ts \
  fixtures/scrollStabilityCoverage.test.js fixtures/scrollChromeTrace.test.ts \
  fixtures/scrollContentTrace.test.ts fixtures/scrollStabilityMutation.test.ts \
  fixtures/scrollNativeGeometry.test.ts fixtures/scrollInputTrace.test.ts \
  fixtures/scrollInputCoverage.test.js fixtures/scrollReadingTrace.test.ts \
  fixtures/scrollReadingCoverage.test.js fixtures/scrollReferenceCoverage.test.js \
  fixtures/scrollPresentationEvidence.test.js \
  ui/components/Channel/ThinkingState.test.tsx \
  ui/components/conversationScrollChrome.test.tsx
node scripts/scroll-stability-report.mjs > /tmp/scroller-coverage-inventory.json
```

These controls test the detectors and coverage bookkeeping. They do not count
as runs of the scroller. The reporter lists every documented row, implemented
slice, unrun case and unmapped family; an inventory with no traces is not a pass.
Browser calibrations carry an explicit `evidence-kind` annotation. Historical
reports are recognized by their original calibration suite/file identities.
Calibration passes never increase product coverage; calibration failures remain
visible and fail the report exit status.
The reporter uses Node's TypeScript support (Node 22.18 or newer; use the
repository's Node 22.22.0) to replay the pure native geometry oracle from raw
samples and the serialized action/coverage/position contract. Native traces
without `assertionSchemaVersion: 1` retain their original diagnostic verdict but
cannot count as revalidated sampled passes. The web importer rechecks raw
positions and required measured resize effects; a stale producer pass flag
cannot override contradictory geometry. UI/backend preconditions and installed
build provenance still need their separate execution evidence.

Run production component/screen lifecycle regressions separately. Native view,
network and store boundaries are controlled in these tests; callback ownership,
effect ordering and navigation commands come from actual components. These
ordinary assertions intentionally retain the recorded pre-refactor failures.

```sh
corepack pnpm --dir packages/app exec vitest run \
  ui/components/Channel/Scroller.native-integration.test.tsx \
  features/top/ChannelScreen.scroller-integration.test.tsx \
  ui/components/PostScreenView.scroller-integration.test.tsx
```

## Web

Web qualification targets desktop browsers. Mobile web (phone/tablet browsers
and mobile-web emulation profiles) is excluded by user instruction. Supported
narrow/short desktop windows remain in scope. The current default is
`1280 × 500` (width × height), with 650 px resize and 800 px edit-case heights;
these are desktop viewports, not mobile-web tests. No active mobile-web variant
needs to be removed from this suite.

Prepare the local zod/ten test ships using the web E2E setup and confirm that
both are running the current desk and serving the groups app. Authentication
setup alone does not establish backend readiness. Keep unrelated local services
out of the existing Rube cleanup path: it includes broad port/process cleanup.

From the repository root, authenticate those two isolated local fake ships:

```sh
node scripts/authenticate-scroller-web.mjs
```

This helper verifies an authenticated presence scry before saving the two
Playwright sessions. It avoids the existing HTML-login setup's dependency on a
legacy root-app redirect. It does not establish the installed desk revision;
verify that separately. Each product fixture still opens the real groups app
and requires its Home UI before running.

From `apps/tlon-web`, the product-only entry point selects the real conversation,
input, reading-point and reference cases. It excludes all detector calibration
tests. Verify both frontends and local ships before using this warm config:

```sh
PLAYWRIGHT_JSON_OUTPUT_NAME=/private/tmp/scroller-product-run.json \
corepack pnpm exec playwright test \
  --config=playwright.scroller-product.config.ts
```

This command uses headed desktop Chromium, one worker and no retries. Its
42 currently registered cases retain their individual acceptance limits and
instrumentation. A successful runner result still needs raw-evidence replay;
missing caret or presentation evidence cannot be qualified by the exit code.
Run `--list` to inspect selection without executing product actions.
All 42 cases use normal application flags. Historical captures of the older
24 cases retain their accelerated E2E setting and are not relabeled. The full
42-case run is the post-integration regression gate against canonical Vite
frontends on ports 3000 and 3002; selecting this config does not build assets or
establish production-build coverage. Setup closes developer tools through the
real application hook only when their persisted setting is open, and verifies
that the overlay is hidden before product actions.

The separate six-case built-content baseline used verified production responses
and receipt hashes. Its latest result per variant is three sampled passes and
three failures: both concurrent-media history orders and rich-text history each
move the unchanged reading character upward by 100 CSS pixels. The r3 focused
recapture qualified two passes and one failure with no incomplete evidence;
previous setup and attempt-clock failures remain preserved. These results cover
bounded loading/reading scenarios, not the whole 42-case production corpus.
Raw records: `/private/tmp/scroller-built-content-product-r2-20260907.json` and
`/private/tmp/scroller-built-content-product-r3-20260907.json`; final r3 replay:
`/private/tmp/scroller-built-content-product-r3-independent-20260907.json`.

The added pending-send case holds one actual Enter send, scrolls upward into a
declared reading position, then releases the original request and observes its
committed acknowledgement. Its independent replay checks the raw transport and
reading-point association instead of trusting the producer assessment. This is
one desktop SND-04/RAC-08/AC-12 slice with observed runtime resources; it does not
establish a complete build receipt, native caret or presented-frame behavior.

For the original geometry cases and their detector controls together:

```sh
PLAYWRIGHT_JSON_OUTPUT_NAME=/private/tmp/scroller-web-run.json \
corepack pnpm exec playwright test scroller-stability.spec.ts \
  --project=chromium --no-deps --retries=0 --reporter=list,json
```

The normal config starts/reuses Vite on ports 3000 and 3002; `--no-deps` uses
the verified sessions above instead of rerunning the legacy auth setup. Verify
workspace package links resolve into the intended checkout before accepting a
run. This suite gives app/database readiness a separate 60-second bound; its
10-second action limit and all measured scroller criteria remain unchanged.
The detector controls also have a standalone config that
does not start backend servers or authentication:

```sh
PLAYWRIGHT_JSON_OUTPUT_NAME=/private/tmp/scroller-detector-run.json \
corepack pnpm exec playwright test \
  --config=playwright.scroller-detectors.config.ts --retries=0 --reporter=list,json
```

For focused rechecks when the required frontend(s), local ship(s), module paths
and auth sessions have already been verified, use
`--config=playwright.scroller-warm.config.ts`. It starts no servers and skips
legacy auth dependencies; it does not change the application fixtures or
assertions. `--trace=off` can omit Playwright's full tracing while preserving the
suite's own continuous raw geometry/content/control captures and required proof
attachments. Record this instrumentation choice with results. A setup timeout
or insufficient capture remains evidence from that attempt, even if a later
focused run passes.

Each mutation retains a JSON trace attachment even when its action or assertion
fails. Frames contain viewport bounds, scroll extent/offset, bottom gap and row
coordinates; marks identify action boundaries. Assertions require visible
witness rows, a 1 CSS pixel tolerance and sufficient continuous coverage.
Capture gaps above 100 ms mean insufficient evidence, not a measured compositor
stutter. Failed Playwright runs also retain their trace, screenshot and video.

The registry separately lists web product variants, native variants and
detector controls; the inventory command reports current counts. The web product variants cover send, composer growth/shrink, reactions,
editing, reference attachments and landing, latest controls, incoming messages,
viewport changes, thread return/unreads, and actual computing-presence show,
timeout and response handoff at latest/history. Thread return currently proves
eventual restored geometry, not the first visible frame. A quote attachment is
not an upload test, 18 seeded posts do not establish pagination, and a staggered
message series does not establish same-frame burst behavior.

Two latest-control variants each perform two complete at-end → deliberate
history scroll → actual latest click → landed cycles, with normal and reduced
motion. Separate DOM samples record the control's actual glyph and ancestor
opacity, duplicate/missing content, list visibility, current conversation scope,
and delivered click. The fixed contract permits one monotonic fade per transition
(instant state changes with reduced motion) and requires a full second of hidden
control plus correct latest landing after terminal readiness. An independently
replayed proof rejects shortened tails, reused cycles and weakened motion or
capture limits. These variants exercise cached history at rest; spinner/loading,
threshold jitter, rapid repeated taps, interruption and native presentation need
their separate CTL/FLK cases. The DOM sampler does not establish occlusion or
hidden-control hit testing. Component controls separately check interaction and
accessibility props, icon/spinner selection, retained identity and requested
animation endpoints for ordinary and Liquid Glass controls; mocked animation
progress is not native frame evidence.

Four web image cases hold a real unique image request pending, then release and
decode its response without changing the backend post content or remounting the
row. They cover latest, history, an expanded composer followed by clear, and an
upward three-wheel sequence. The coverage reporter requires the raw frame trace,
pending/release/decode markers, and the separate `-loading-proof` attachment:
acknowledged requests, unchanged post content, retained row identity, explicit
image/reader IDs, pending and decoded natural dimensions, and image and target
row height changes visible in the captured geometry. Wheel cases also retain
their initial offset and the three requested displacements. Missing proof is
incomplete even when Playwright reports a pass. Composer and wheel sequences do
not establish exact event overlap, native momentum, or all combined completion
orders; cache, failure/retry and multiple concurrent image loads remain outside
these variants.

An additional `image-content-end` variant combines the real held request and
immutable-essay proof with continuous DOM content sampling. It verifies the
actual pending reservation, original image and caption, trusted load followed
by decode, expected intrinsic dimensions, clipping/opacity, and a full second
of terminal retention. This controlled desktop fixture first establishes that
its decoded image fits the viewport; it does not require a tall image to fit
arbitrarily. A scoped interior hit witness does not establish every pixel or
rule out overlays that ignore pointer events. Three separate browser collector
calibrations use a held image response and healthy/brief-child-hide/brief-ancestor-hide
states. Pure oracle and reporter controls additionally reject stale source,
duplicate/missing image, ready-to-pending regression and missing causal/tail
evidence. These are partial FLK-07/12 and STA-01 results, not all loading paths.

DOM animation-frame
sampling does not establish presented-frame continuity or all browser support.

### Actual content and exact input

The newer product configs use normal application flags and headed Chromium at
1280 × 800. With the isolated app on port 3000 and its local ships already
verified, run from `apps/tlon-web`:

```sh
PLAYWRIGHT_JSON_OUTPUT_NAME=/private/tmp/scroller-reading-product.json \
corepack pnpm exec playwright test \
  --config=playwright.scroller-reading-product.config.ts --workers=1 --retries=0
PLAYWRIGHT_JSON_OUTPUT_NAME=/private/tmp/scroller-input-product.json \
corepack pnpm exec playwright test \
  --config=playwright.scroller-input-product.config.ts --workers=1 --retries=0 \
  --reporter=list,json
PLAYWRIGHT_JSON_OUTPUT_NAME=/private/tmp/scroller-reference-product.json \
corepack pnpm exec playwright test \
  --config=playwright.scroller-reference.config.ts --workers=1 --retries=0
```

These test actual same-message image loading and composer growth/clear at
latest, deliberate near-bottom reading and deep history. Geometry qualifies
the starting distance; the deep case currently sends 72 messages through the
actual composer. Native textarea caret geometry remains explicitly unavailable
even when draft, selection, focus and geometry pass. Preserve that distinction
when reviewing the Playwright result and independent evidence report.

The reference cases require an uncached post-reference subscription and a later
committed source edit while the quote stays mounted. They record the exact text
phases and an adjacent reading character; a setup/cache hit, an initially
offscreen character or incomplete phase cannot qualify that scenario. The
[reference contract](scroller-reference-evidence-contract.md) specifies the
remaining identity and transport evidence.

`playwright.scroller-reading.config.ts` and
`playwright.scroller-input.config.ts` are separate synthetic detector
calibrations. They deliberately inject faults into small HTML documents. They
prove detector behavior, never Tlon conversation correctness. Do not use their
passing results as the product baseline. The
[product baseline](scroller-product-baseline-2026-09-07.md) records the actual
app failures and remaining proof limits.

## iOS Simulator

Use an explicit Simulator UDID. Follow the repository's build wrapper so the
installed executable, dirty working-tree snapshot and target are verified.
The fixture entry uses local data and actual channel/message/input components.
It does not start the normal account database or send to another person.

From the repository root, start the deterministic local image gate in a separate
terminal and keep it running through the suite:

```sh
node scripts/scroller-test-assets.mjs
```

Then build the fixture. The xcconfig selects arm64 for an Apple Silicon
Simulator while keeping Release optimizations; omit it on an Intel host.

```sh
/Users/danielbrewster/.codex/bin/tlon-mobile-run inspect
XCODE_XCCONFIG_FILE="$PWD/scripts/scroll-stability-ios.xcconfig" \
ENTRY_FILE="$PWD/apps/tlon-mobile/index.scroll-stability.tsx" \
SENTRY_DISABLE_AUTO_UPLOAD=true \
/Users/danielbrewster/.codex/bin/tlon-mobile-run ios-sim \
  --udid "$SCROLLER_SIM_UDID" --configuration Release
/Users/danielbrewster/.codex/bin/tlon-mobile-run verify --udid "$SCROLLER_SIM_UDID"
```

Save the wrapper output/receipt with the run artifacts. If the working tree
changed during compilation, repeat inspection and the incremental build before
running. Do not relabel a stale install as current.

Use Argent's `open-url` on that UDID with a unique run ID:

```text
io.tlon.groups.preview://scroll-stability?suite=core&runId=RUN_ID
```

The native registry currently contains 56 variants: 38 automatic cases and 18
other/armed cases. Registration does not establish execution. Collect the 38
automatic results and all corresponding raw traces:

```sh
node scripts/collect-scroll-stability-ios.mjs \
  --udid "$SCROLLER_SIM_UDID" --run-id RUN_ID --timeout-ms 480000
node scripts/scroll-stability-report.mjs \
  /private/tmp/tlon-scroll-stability/RUN_ID/scroll-stability-*.json \
  > /private/tmp/tlon-scroll-stability/RUN_ID/coverage.json
```

The collector prints each verdict and exits 1 for failure, 2 for incomplete
evidence, or 0 for sampled geometry passing. Its collection manifest is not a
trace input to the coverage reporter.

For actual keyboard, composer and gesture actions, open the same URL with
`scenario=keyboard-history`, `keyboard-end`, `composer-history`, `composer-end`
or `gesture` instead of `suite=core`. Start the matching real interaction after
the status reads `Recording`; the capture lasts 4.5 seconds. For composer tests,
focus the input before arming, then type/delete enough text to change its height.
For keyboard tests, focus the input after arming. Use `dismiss-history` only with
an already open keyboard. A capture without the required causal event cannot
pass. Raw geometry failures may remain diagnostic; without qualified action
evidence they do not establish that the intended interaction scenario ran.

`stateful-image-load-end/history` first establishes a unique, unreleased image
request with unknown dimensions. During capture, the real image response is
released while post props stay unchanged. A changed target row layout and a
matching subsequent native measurement must witness the production `onLoad`
resize. These cases cover pending-to-loaded geometry at rest; installing the
pending placeholder occurs before capture. Prop-driven `near/history-media`
replacements are separate cases and do not establish this loading lifecycle.
The `near/history` prop mutations select a visible row other than the reading
witness. Their target may be before or after that witness; the trace records
the measured relation. They do not establish an above-anchor-only variant or
all relative target positions. They also require the intended target revision
to commit and be measured; unchanged geometry alone cannot prove the mutation
ran. The `near` setup is programmatic and does not establish deliberate user
reading inside the follow threshold.

Five additional image cases require an actual interaction after `Recording`:

- `armed-image-load-gesture`: release and measured image layout change must both
  occur inside a real drag-begin to drag-end interval.
- `armed-image-load-keyboard-end/history`: both must occur inside matching real
  keyboard-will-show/hide to keyboard-did-show/hide events.
- `armed-image-load-composer-end/history`: both must occur between real composer
  input and a changed-height composer layout within 125 ms. Focus before arming,
  then type/delete enough text to change the input height.

The gate releases only after the matching interaction starts. Missing causal
overlap disqualifies the intended race, even if raw geometric residuals retain
a failure for diagnosis. These are single-image, pairwise overlap cases.
They do not establish combined keyboard/composer/image completion orders,
multiple loading rows, loading during momentum, cache/refetch behavior, failure
and retry, A2UI state transitions, or painted image/aspect-ratio correctness.
Composer overlap describes sampled input-to-layout timing, not native animation
frames. The armed captures last 4.5 seconds.

`armed-thinking-keyboard-end`, `armed-thinking-keyboard-history` and
`armed-thinking-gesture` require the real interaction to overlap the measured
thinking-footer change. The automatic thinking cases exercise the production
footer through its forced setup label, with actual commit/layout witnesses.
They do not substitute for presence/expiry behavior: that is tested separately
by the ThinkingState lifecycle controls and the web presence-agent cases.

```sh
node scripts/collect-scroll-stability-ios.mjs \
  --udid "$SCROLLER_SIM_UDID" --run-id RUN_ID --scenario keyboard-history
```

Native measurements are asynchronous samples. A passing trace does not establish
zero dropped frames, compositor continuity, physical-device performance, or full
product read/send correctness. Presentation qualification requires real frame
evidence; a JavaScript heartbeat is deliberately rejected as a substitute.
Native gesture cases compare row displacement with the measured native content
offset. Their start/end events do not contain a finger trajectory, so those
passes cannot establish finger-following or requested-direction correctness.
Gesture qualification inspects the entire capture before attributing a residual
to the product. A later unexplained extent change or missing displacement
witness makes that gesture scope incomplete, retaining earlier raw residuals.
Native scroll callbacks and row measurements are asynchronous; callback age and
split residuals remain acquisition diagnostics, not presented-frame evidence.

The reporter preserves `reportedVerdict` and the existing failure-retaining
`status`, and separately reports `qualifiedStatus` with `qualificationIssues`.
Qualified native results replay the captured preconditions and causal action
before assessing geometry. Unobserved actions and programmatic `near-*` setups
remain incomplete for the named interaction/READ scope, even when raw residuals
failed. `qualifiedRecordedSampledPasses`, `qualifiedFailingSlices` and
`qualifiedIncompleteSlices` describe that narrower qualification; the original
counts retain all attempted evidence. Earlier incomplete attempts still remain
in an aggregate containing reruns, so label a selected latest-per-variant view
separately and retain the complete attempt ledger.

## Retaining evidence

Keep initial failures alongside any rerun. A passing rerun does not erase the
first failure. Record the reason for rerunning, device/browser identity, build
configuration, source snapshot, run ID, raw samples and action events. Do not
increase tolerances to convert an unexplained failure into a pass.
