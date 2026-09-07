# Visible text and reading-point detector contract

This bounded extension refines AC-01/07/09/19/21 and the proof gaps in the
[gap audit](scroller-test-gap-audit-2026-09-06.md). Its first executions are
synthetic desktop Chromium collector calibrations, **not product passes**.
Mobile web is excluded. No ships or application servers are required.

## Accepted observation

The caller declares the conversation pathname, post identity, an unambiguous
selector for one text block, the exact expected text and its semantic revision
label, and a non-whitespace UTF-16 character range within that text. Expected
text comes from the scenario's content, not the recorded final DOM. The revision
label names that expectation; it does not pretend production exposes a revision
attribute. This first contract preserves one revision throughout the interval.

Every sample retains the original row/block identity, matching block count,
complete text-node inventory, range rectangles, ancestor display/visibility and
opacity, effective text fill alpha, and clipping by the list, browser viewport
and overflow ancestors. Each exposed text fragment has interior hit-test
witnesses from `elementsFromPoint`. Foreign elements before the text owner are
an obstruction; this catches pointer-intercepting and pointer-events-none
overlays where the browser exposes them. CSS pseudo-elements, canvas, browser
compositor pixels and overlays excluded by browser hit testing remain outside
this evidence; a CSS/hit-test pass is not painted-frame proof.
Noninteractive text with computed `pointer-events: none` may correctly resolve
to an ancestor hit target; a foreign target is still rejected. The sampler
records this actual CSS policy rather than making all text actionable.

The declared character's rectangle is tracked relative to the actual list
viewport, independently of the row rectangle. Its expected initial point is
acquired before mutation and must remain within one CSS pixel on both axes.
The character must remain exposed and unobstructed. Correct row geometry cannot
compensate for a moved inner paragraph. The complete expected text must remain
present; exposed text must remain visibly styled. Offscreen parts of an oversized
block need not be exposed, and declared ordinary whitespace is not a blank fault.

Evidence uses one RAF loop, a 100 ms maximum gap and 32 ms maximum acquisition
time. The caller supplies a terminal marker and a planned deadline exactly
1,000 ms later; the capture must reach it. Missing identities, samples, hit-test
witnesses or malformed measurements are incomplete, never passes. A detected
fault remains in raw samples even when the final state recovers. Presentation
and actual application behavior remain separately unproved by calibrations.

## Detector situations saved before execution

All defect controls retain a fixed-size row and restore the healthy state after
at least 50 ms. The healthy control spans the same interval. Real browser DOM
and CSS mutations are collected through the production-facing helper API.

| Situation | Required result |
| --- | --- |
| Expected text, same row/block, exposed character, stable viewport | PASS |
| Text child briefly empty while the row stays unchanged | FAIL: wrong text or missing character |
| Correct text briefly reverts to an older same-length revision | FAIL: unexpected semantic text |
| Child or ancestor opacity becomes zero | FAIL: exposed text hidden |
| Text fill becomes transparent without moving the row | FAIL: exposed text hidden |
| Foreign overlay covers the reading character | FAIL: observed obstruction |
| Inner paragraph shifts inside a fixed row | FAIL: reading-point displacement |
| Same-looking text block is replaced with a new DOM element | INCOMPLETE: retained measurement identity lost; replacement alone is not a visible defect |
| Character is clipped by an inner overflow ancestor | FAIL: reading point no longer exposed |
| Raw samples are missing, delayed, malformed, or stop before planned tail | INCOMPLETE |

Pure oracle controls additionally corrupt raw identity, fragment inventories,
hit witnesses, timing, geometry and expectation contracts. Input draft, selection,
focus and action evidence is owned by the separate input-evidence extension.
Real product integration, fallback when the reading point is deleted, changing
revisions, multiple visible rows, full occlusion meshes and native presentation
remain open after this first bounded slice.

Injected detection and continuous stability are separate results. A defect
control qualifies detection only when its specific expected failure occurs on a
coherent sample inside the actual recorded application/restoration interval and
that same sample retains the row's original bounds. Missing observations or
malformed witnesses do not qualify. Gaps elsewhere keep the continuous trace
`INCOMPLETE`; an observed injected fault never becomes a product pass. The
healthy control still requires a fully valid `PASS` and stable row geometry.

## Browser scheduling precondition

The first preserved headless calibrations were incomplete because RAF callbacks
regularly exceeded 100 ms. An independent three-second blank-page comparison
reproduced that cadence in both headless shell and full Chromium headless, with
no collector running. Full headed Chromium had a 16.7 ms median. The dedicated
configuration therefore uses headed desktop Chromium and a separately recorded
two-second preparation interval before any scenario capture. Every recorded
scenario sample still obeys the original 100 ms / 32 ms limits; nothing is
trimmed from captured evidence. Browser identity, preparation frames and raw
scenario traces are retained. This is calibration execution parity, not a claim
that headed results qualify an unmeasured headless or production environment.

## Integration API and preserved executions

`startScrollReadingTrace(scroller, row, { blockSelector, start, end })` accepts
the actual list and post handles. It returns `baseline`, `scope`,
`markTerminal()`, `wait(ms)`, `freeze()` and `stop(testInfo?, attachmentName?)`.
Declare the expected text/revision before the action; derive only the geometric
reference point from `baseline.point` before mutation. A missing baseline point
is a failed precondition. Set contract `endTime = terminalTime + 1000`, capture
that interval, then call `assessScrollReadingTrace(raw, contract)`.

When collecting existing row geometry alongside reading content, freeze the
reading sampler, stop the geometry sampler, and only then transfer the larger
reading trace. This avoids adding artifact-transfer delay to another recorder's
live interval. `assessInjectedReadingFault` is reserved for synthetic detector
controls, requiring a healthy baseline, matching contract and actual mutation
window. It must never be used to qualify product stability.

Executed evidence (all under `/private/tmp`, first attempts retained):

- `scroller-reading-browser-controls.json`: initial ten headless attempts,
  incomplete from sampling gaps; actual detected issues retained.
- `scroller-reading-healthy-r2.json`: headless trace-off/shutdown diagnostic,
  still incomplete from the independently reproduced headless cadence.
- `scroller-reading-raf-baseline.json` and
  `scroller-reading-raf-full-headless.json`: blank-page scheduling comparisons.
- `scroller-reading-headed-healthy.json`: healthy PASS, 86 samples, maximum gap
  18.7 ms, acquisition 5.4 ms, zero reading-point drift.
- `scroller-reading-headed-faults.json`: all nine faults observed on coherent
  samples with zero row drift; three fully qualified fault captures and six
  incomplete continuity captures. `scroller-reading-headed-observed-faults.json`
  records their raw witness indices without rewriting the original result.
- `scroller-reading-causal-inner-shift.json`: focused actual mutation-window
  qualification, 90 samples, maximum gap 18.3 ms and seven witnesses of a 12 px
  character shift inside a stationary row. Its continuous trace correctly fails.

Latest bounded outcome: one complete healthy pass; four complete injected-fault
captures; five further faults detected with incomplete continuity. This adds
detector capability, not executed application coverage. Previous failed or
incomplete attempts remain part of the record.

## Next executable product pair: same-post image and rich-text reading point

This design is saved before executing the new real-application pair. Both cases
use actual local ships, committed channel content and production ChatMessage /
PostContent / ImageBlock rendering. The app runs with `e2eMode: false`, so normal
sync delays and deferred UI remain enabled. Assets are served by Vite in
development mode; this does not claim built-production execution parity.

One immutable post contains an unknown-size image **before** a paragraph with
plain, bold, italic and inline-code spans. A real image request is held; its PNG
bytes are released after at least 250 ms of observation. The actual trusted load
and decode events must retain row/image/source identity, learn intrinsic 2×1
dimensions and cause a measured row-height change greater than 16 px. Backend
essays before and after must be identical. No DOM replacement, CSS fault or
application rendering stub is injected in these product cases.

| Product situation | Independent acceptance |
| --- | --- |
| Same post at latest; image decode resizes content above its rich paragraph | Actual list remains within 1 px of bottom, exact paragraph revision remains visible, and the selected trailing character remains within 1 px of its pre-decode viewport position through the planned one-second tail |
| Same post while reading history, with newer messages below it | Real wheel input places the paragraph in view before capture; the exact character remains within 1 px during decode and the tail, even when its parent row's origin stays unchanged. No assumption that stable outer-row geometry proves this |

The block selector is derived from the already declared exact paragraph text
and actual DOM ancestry without adding attributes. The original element is then
retained throughout capture. Actual bold/italic/code styles and the complete
text-node inventory are recorded. Image pixels may legally be clipped above the
history reading point, so the dedicated full-image-exposure oracle is not
misapplied; its existing trusted load/decode collector supplies causal events,
while text exposure, point stability and list geometry use their own oracles.
Both cases remain subject to strict capture completeness. A product failure is
retained as a failure; injected-fault detection qualification is never used.

## Retained block acquisition correction

A positional selector acquires the original DOM element once; harmless sibling
insertion or wrapper layout changes must not masquerade as replacement. Samples
keep that connected element inside the same row and count exact semantic-text
candidates to retain ambiguity detection. Replacing the acquired element with a
same-looking clone invalidates this retained-handle measurement (INCOMPLETE),
without claiming a visible fault. Wrong scoped text, blank content, obstruction
and actual point displacement remain separate FAIL criteria. A browser control
will insert a zero-height sibling before a positionally acquired block, and a
second control will replace it with a same-looking clone. The first must keep a
fully valid PASS; the second must report acquisition INCOMPLETE.
