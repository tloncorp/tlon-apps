# Scroller presentation evidence contract

This contract is recorded before the new trace probe and importer tests run.
Only isolated synthetic desktop Chromium pages are used for calibration. Mobile
web and native builds/profiling are excluded from this task.

## Acceptance

| Case | Required result |
| --- | --- |
| Healthy JavaScript callbacks with missing display evidence | Presentation remains incomplete; never infer presentation from rAF, begin-frame, vsync, DrawFrame, swap submission or screenshots |
| Healthy callback cadence with a proved dropped/partial/late renderer frame | Preserve the renderer failure independently of the callback stream |
| Trace from another page, renderer, surface or layer tree | Reject attribution; browser chrome or another page cannot qualify the requested scroller |
| Truncated trace, lost buffer data, unmatched begin/end, missing observation boundaries or unsupported browser/schema | Fail closed with an explicit incomplete result |
| Chromium reports a frame state or presentation-feedback timestamp | Preserve the exact original source event, ID, process/thread, timestamp units and documented meaning; do not relabel a pipeline timestamp as physical display presentation |
| Independently available actual presentation feedback | Require the supported source's exact semantics, complete attribution and clock/deadline evidence before any presentation pass |

## Initial local evidence boundary

The installed Playwright protocol exposes CDP `Tracing.start`, trace events and
`tracingComplete.dataLossOccurred`. The existing web helpers sample DOM/CSS at
animation callbacks and explicitly do not establish compositor presentation.
The current generic presentation oracle accepts normalized frame records, but
there is no existing Chromium importer proving where those records came from.

The probe will preserve browser version/revision/arguments, selected categories,
target/frame identifiers, trace completion, synthetic action markers and raw
events. Any supported importer must validate these original records rather
than trusting a caller's `source: presentation` label or a precomputed verdict.

## Investigation and results

The importer controls below are specified before implementation or execution.

| Input condition | Pipeline result | Physical presentation result |
| --- | --- | --- |
| Complete, attributable presented-all/no-update records | No failure observed, never a pass | Incomplete |
| Dropped or partial frame with Chromium's `affects_smoothness` flag | Fail, including when JavaScript heartbeat samples look healthy | Incomplete |
| Presented frame reports missing/raster/record content | Fail | Incomplete |
| Dropped frame that does not affect smoothness | Count diagnostically; do not assert a visible failure | Incomplete |
| High-latency flag without a dropped/partial/missing-content signal | Count the source's 75 ms classification; do not invent a refresh deadline | Incomplete |
| Unsupported version/revision, headless mode, missing renderer/layer/navigation attribution | Incomplete; do not assign failures to this page | Incomplete |
| Lost data, missing terminal observation, unmatched or invalid relevant records | Incomplete unless an independently valid attributable failure is already observed | Incomplete |
| Other renderer/browser chrome/layer reports failure | Ignore it for this page | Incomplete |
| Duplicate local track ID or unsafe numeric begin-frame identifier | Reject the affected correlation | Incomplete |
| Forked/backfill reporters share a begin-frame sequence | Retain separate source records; never join using rounded surface/display IDs | Incomplete |
| AnimationFrame::Presentation timestamp | Preserve as browser feedback estimate with source event index and safe begin-frame correlation | Incomplete |
| DrawFrame, vsync, swap, rAF, a caller's `source: presentation`, or zero-valued begin-frame ID alone | Cannot qualify evidence | Incomplete |

The required observation window uses three unique `performance.mark` records:
action start, action end, and observation end at least 1,000 ms later. All must
belong to the same renderer main thread and navigation. Capture preserves raw
microsecond trace timestamps, process/thread metadata, the page/frame identity,
layer-tree binding, browser version/arguments, and CDP completion. Missing tail
data cannot erase a valid scoped failure, but prevents a complete diagnostic
read. Tests are importer controls, not real scroller acceptance evidence.

### Exact installed source boundary

The inspected browser is headed Playwright Chromium `136.0.7103.25`, revision
`97d495678dc307bfe6d6475901104e262ec7a487`, on macOS. The importer deliberately
supports that exact build and backend. A newer build requires a fresh source
audit rather than silently inheriting the same meaning.

| Observed event | Proven meaning and usable identity | Limit |
| --- | --- | --- |
| `PipelineReporter` begin/end | Chromium's compositor frame outcome and smoothness/content flags; pair by renderer PID plus exact hexadecimal `id2.local`, then bind `layer_tree_host_id` to the target page using `SetLayerTreeId` | The end timestamp is frame termination; it is not inherently physical presentation |
| `AnimationFrame::Presentation` | Trace timestamp is `presentation_feedback.timestamp`; safe `begin_frame_id.source_id/sequence_number` links to the scoped pipeline | This backend estimates that timestamp; the event does not contain a per-frame deadline or feedback flags |
| `Display::FrameDisplayed` | Display pipeline copies the same feedback timestamp into this event | It adds neither physical observation nor page identity; its reassuring name does not change the source semantics |
| `FramePresented` | Observed browser-process records carry `environment: browser` | They cannot establish the target page's output |
| `OnVSyncPresentation`, `CommitPresentedFrameToCA` | Display-link callback and layer commit activity | Callback timing and submission are not screen presentation |

The matching Chromium implementation writes the reporter's final state,
`IsDroppedAffectingSmoothness()` result, page layer-tree ID, missing-content
flags and a latency flag with a **75 ms** threshold. Its internal refresh
deadline uses the begin-frame interval, but that deadline is absent from these
JSON records. Consequently the importer counts high latency without inventing
a 60 Hz deadline. Forked/backfill records can legitimately share a begin-frame
sequence. [CompositorFrameReporter source](https://chromium.googlesource.com/chromium/src/+/97d495678dc307bfe6d6475901104e262ec7a487/cc/metrics/compositor_frame_reporter.cc#1446)

`AnimationFrame::Presentation` records the feedback timestamp and begin-frame
ID. On this macOS path, the CALayer coordinator assigns that timestamp from
`display_time`; `GetDisplaytime` predicts it using display-link timing and an
experimentally chosen latch buffer, falling back to latch time when timing is
unavailable. Even this path's `kHWCompletion` flag is assigned alongside the
prediction and would not establish independent physical observation.
[Animation-frame feedback source](https://chromium.googlesource.com/chromium/src/+/97d495678dc307bfe6d6475901104e262ec7a487/third_party/blink/renderer/core/frame/animation_frame_timing_monitor.cc#323),
[CALayer feedback source](https://chromium.googlesource.com/chromium/src/+/97d495678dc307bfe6d6475901104e262ec7a487/ui/accelerated_widget_mac/ca_layer_tree_coordinator.mm#185),
[macOS display-time prediction](https://chromium.googlesource.com/chromium/src/+/97d495678dc307bfe6d6475901104e262ec7a487/gpu/ipc/service/image_transport_surface_overlay_mac.mm#366)

`Display::FrameDisplayed` also copies this feedback timestamp. It does not
resolve the boundary above. [Display feedback trace source](https://chromium.googlesource.com/chromium/src/+/97d495678dc307bfe6d6475901104e262ec7a487/components/viz/service/display/display.cc#1367)

JSON parsing loses precision in the observed 64-bit numeric
`surface_frame_trace_id` and `display_trace_id` values. The importer retains
these raw parsed fields for diagnosis but **never correlates with them**. It
uses safe integer begin-frame IDs and string local track IDs. Every imported
record links back to its original event indexes, PID/TID and microsecond trace
timestamps. The source trace must be retained; normalized output alone is not
independent evidence.

### Implemented route and qualification

`scripts/scroll-stability-presentation-evidence.mjs` exports
`startChromiumPresentationCapture(page)` for an existing caller-owned Playwright
Chromium page. It neither launches a browser nor navigates. The caller starts
tracing before application settling, so `SetLayerTreeId` can bind the page
before the action, then calls:

1. `markActionStart()` immediately before the actual product interaction.
2. `markActionEnd()` when the action's observable completion condition holds.
3. `markObservationEnd()` after at least 1,000 ms of continued observation.
4. `stop()` in cleanup, preserving its returned `trace`, `receipt` and
   `assessment` separately.

The recorder uses CDP `ReportEvents`, captures browser command/version and
page/frame identity, and waits for `tracingComplete`. Known buffer loss or
missing completion remains incomplete. Only one browser-wide CDP tracing
session can be owned at a time; serialize this with other tracing/profiling
work. The importer can also run without a browser:

```sh
node scripts/scroll-stability-presentation-evidence.mjs TRACE.json RECEIPT.json ASSESSMENT.json
```

The [CDP Tracing contract](https://chromedevtools.github.io/devtools-protocol/tot/Tracing/)
defines event delivery, trace flushing and `dataLossOccurred`. Trace completion
does not establish the physical-display meaning of individual events.

The result has separate fields: `pipelineVerdict` can be `FAIL`, `INCOMPLETE`,
or `NO_FAILURE_OBSERVED`; `presentationVerdict` is always `INCOMPLETE` for this
source. `NO_FAILURE_OBSERVED` only describes imported records. It does not prove
that every display refresh was covered. The overall `verdict` can fail on
valid scoped pipeline failures, but **cannot pass**. JavaScript heartbeat
arrays and caller-provided source labels do not influence classification.

Capture metadata does not prove foreground/occlusion, machine idleness,
collector overhead or attribution of a pipeline failure to the scroller
component rather than other content in the same page. Real application runs
must qualify those conditions separately and retain their product action
evidence. This diagnostic route is not a substitute for application integration
tests, visual-content sampling or physical device presentation measurements.

### Raw probe and controls

The initial isolated synthetic page probe saved 22,202 original events at
`/private/tmp/scroller-presentation-probe-20260907/trace.json`, with CDP/browser
provenance in `receipt.json` and the import result in `assessment.json`.
Completion reports `dataLossOccurred: false`. The requested page maps to
renderer PID `56969`, main thread `32224676`, layer tree `1`, and the same
navigation at its action marks.

The action interval yields 169 pipeline records: 132 drops flagged as affecting
smoothness, 17 partial records, and 19 correlated feedback estimates. The trace
also contains 25 `Display::FrameDisplayed` events. Overall classification is
`FAIL` for renderer smoothness, with physical presentation `INCOMPLETE`.
The exploratory probe omitted a terminal tail and therefore also records that
coverage deficiency. Its uninjected page had poor callback cadence; this is
**environment/collector diagnostic evidence, not a healthy control or a
scroller regression**. No native run was performed for this task.

The pure controls in
`packages/app/fixtures/scrollPresentationEvidence.test.js` verify source
attribution, data loss, missing boundaries, malformed records, estimated
feedback identity, forked sequences, and a healthy JavaScript heartbeat paired
with a renderer smoothness failure. They exercise the importer; they do not
count as tested application situations. A fresh synthetic performance pair
was deferred when the team moved to real application execution and local
runtime startup; the initial trace was not relabeled as such a calibration.

Final importer control run: **55 passed, 0 failed**. Raw Vitest JSON is saved at
`/private/tmp/scroller-presentation-importer-controls-20260907.json`. Scoped
lint reports no diagnostics. The recorder wrapper is available for the next
real application run; that wrapper has not yet captured a product workload.
