# Latest-control and loading-flicker extension — 2026-09-06

This extends the [earlier scroller run](scroller-test-results-2026-09-06.md).
Existing failures remain open. It does not replace that run or qualify the
entire matrix. Mobile web remains excluded.

## Design saved before execution

The [matrix](scroller-test-matrix.md) adds 14 latest-control families
(`CTL-01–14`) and 12 loading/content-flicker families (`FLK-01–12`). It now has
245 situation families plus 22 acceptance criteria. The additions specify
readiness, threshold crossings, appearance/disappearance, normal/reduced motion,
Liquid Glass, icon/spinner changes, actual activation/landing, repeated actions,
interruption, scope replacement, overlays, loading timers, content revisions
and a terminal observation window. A button hiding near bottom does not prove
that its latest action landed correctly.

The first implemented desktop slices are two complete latest-control cycles
per motion setting and one real pending-image-to-decoded-image lifecycle at
latest. The image contract was also saved before its tests ran. These slices
cover only the combinations named in their registry entries.

## Evidence and environment

Working checkout: `db/scroll-stability-fixture`, base commit
`0084cc91f64472848a4e6c75da4256e13d642819`, with the suite's uncommitted changes.
Desktop Chromium uses real local zod/ten ships, real application components and
the existing E2E flag. CSS/DOM samples and component lifecycle tests are distinct
from compositor or native presented-frame evidence. This extension has no new
iOS Simulator presentation run.

Setup problems were retained as evidence before the corrected run:

- `/private/tmp/scroller-chrome-web-20260907.json`: legacy authentication setup
  waited for `/apps/landscape/`; login redirected to a root page that failed.
  Neither product case ran. The scoped
  [authentication helper](../../scripts/authenticate-scroller-web.mjs) now
  validates the two local fake ships' authenticated presence endpoint and saves
  fresh sessions; product fixtures still require the real groups Home UI.
- `/private/tmp/scroller-chrome-web-r2-20260907.json`: the first product fixture
  timed out while loading the app, before a scroller action. Its network trace
  exposed a root `node_modules/@tloncorp/ui` link to a different temporary
  checkout. The invalid run was stopped and the link corrected to this
  checkout's `packages/ui`; the prior target and repair are recorded in
  `/private/tmp/scroller-workspace-link-repair-20260907.json`.
- `/private/tmp/scroller-chrome-web-r3-20260907.json`: both cases stopped in
  fixture startup while waiting for Home. The suite's 10-second action timeout
  also applied to app/database readiness. A scoped `appReadyTimeoutMs: 60_000`
  now separates that setup wait from the unchanged scenario action, position,
  transition and capture limits.

After correcting that link, cold frontend compilation exceeded one readiness
deadline. The warmed retry reached Home as `zod` in 11.7 seconds with no page
errors or foreign-checkout module requests:
`/private/tmp/scroller-chrome-warm-readiness-r2-20260907.json`.
Authenticated readiness evidence is
`/private/tmp/scroller-chrome-auth-final-20260907.jsonl`. Setup timings are not scroller
latency measurements.

The first content-collector browser calibration also exposed a harness bug:
the DOM load event's target was read after awaiting image decode and was no
longer available. The helper now captures the real event's target/trust evidence
synchronously and independently checks current row/image identity at decode
completion. The failing calibration is preserved in
`/private/tmp/scroller-chrome-detectors-final-20260907.json`; its brief injected
flashes were still detected, but missing causal evidence prevented a pass.

The normal-motion case in `scroller-chrome-web-r4-20260907.json` exposed a
second harness timing error: it began the stable hidden phase 250 ms after the
click, before the 200 ms fade triggered by crossing the scroll threshold had
finished. The raw opacity decreased monotonically to zero; this was not evidence
of an extra flash. The corrected test records the actual same-control/same-scope
`pointer-events: none` eligibility gate, observes a fixed 250 ms window, and
keeps the original one-second press-to-hidden bound, continuous monotonic checks,
actual bottom landing and terminal tail. It never polls opacity until it passes.

`scroller-chrome-web-r5-20260907.json` is also retained: normal motion stopped
during seeding on a 10-second message-input fill timeout, and reduced motion
stopped during preparation because its 112.3 ms geometry sample gap exceeded
the unchanged 100 ms evidence limit. Neither reached a measured control cycle.
These remain unsuccessful attempts; this run does not establish their cause.
The final button recheck used the already verified warm frontend and
`--trace=off` to omit Playwright's full tracing while retaining every required
test-owned raw trace and proof. No position, transition or capture tolerance
was relaxed.

## Result scope

The final targeted component/oracle/reporter files contain **250 passing
checks**. This count includes retained controls; it is not 250 new product
scenarios. None of these controls counts as an iOS Simulator run.

| Check group | Result | Raw evidence |
| --- | --- | --- |
| Chrome trace oracle + ordinary/Liquid Glass component | 36 + 14 passed | `/private/tmp/scroller-chrome-component-oracle-final-20260907.json` |
| Real-image content oracle | 41 passed | `/private/tmp/scroller-content-oracle-controls-final.json` |
| Independent coverage/evidence replay | 142 passed | `/private/tmp/scroller-chrome-eligibility-import-controls-20260907.json` |
| ThinkingState lifecycle | 17 passed | `/private/tmp/scroller-content-import-thinking-controls-20260907.json` (ThinkingState file only; its older reporter count is superseded above) |
| Button browser collector calibration | Passed, healthy plus injected ancestor/glyph flashes | `/private/tmp/scroller-chrome-detectors-final-20260907.json` (button case only) |
| Image browser collector calibration | 3 passed, healthy plus injected child/ancestor flashes | `/private/tmp/scroller-content-detectors-r2-20260907.json` |
| Desktop image content at latest | Passed and independently replayed | `/private/tmp/scroller-chrome-web-r4-20260907.json`, `/private/tmp/scroller-chrome-coverage-r4-20260907.json` (image case only) |
| Desktop latest control, normal and reduced motion | Both passed and independently replayed; two complete cycles each | `/private/tmp/scroller-chrome-web-r6-20260907.json`, `/private/tmp/scroller-chrome-coverage-r6-20260907.json` |

The image run retained 133 content samples and 105 geometry samples, with
maximum sample gaps of 18.5 ms and 18 ms respectively. Every sampled bottom gap
was zero; actual load and decode belonged to the original image. These are
sample-cadence/geometry results, not a compositor frame-rate measurement.

The final three product slices are independently qualified as sampled passes
in `/private/tmp/scroller-chrome-latest-coverage-20260907.json`. The explicit
source/selection manifest is
`/private/tmp/scroller-chrome-latest-selection-20260907.json`; original failed
attempts are retained in `/private/tmp/scroller-chrome-all-attempts-20260907.json`
and their original reports. The selection covers this extension only, not a
rerun of all 80 registered native/web variants. Focused web typechecking of the
current helper/spec passed; app typechecking also passed during the extension.

The button's browser recorder observes actual glyph/ancestor opacity and list
visibility. Its sampler does not establish hidden hit testing or general
occlusion. Component tests check the real component's requested transition,
content selection, retained identity and interaction/accessibility props with
mocked animation progress. The ordinary button lacks the explicit label/role
provided by the Liquid Glass variant; these tests do not manufacture that
accessibility behavior.

The content recorder observes the real image, source and caption, retained row
and image identity, actual load/decode completion, ancestor opacity and clipping,
and terminal retention. It permits the production pending reservation, which
has no explicit skeleton or spinner. It does not prove every pixel was presented
or that every possible covering layer was absent.

Loading glyph races, header/entry-overlay flicker, rapid repeated taps,
interruption, pagination, multiple simultaneous content loads, error/retry,
production web parity and native presentation retain their separate matrix
requirements. No zero-jank or complete-family claim follows from these slices.
