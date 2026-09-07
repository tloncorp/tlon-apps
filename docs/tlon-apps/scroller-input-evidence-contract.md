# Exact composer input evidence

These cases refine AC-11, AC-12, AC-15, AC-18, AC-19 and AC-22 before execution.
The input checker is independent of row geometry and cannot certify presentation
latency from DOM samples. Its latency is sampled local acknowledgement only.

| Situation | Acceptance |
| --- | --- |
| Fill, grow, shrink and clear a focused draft | Exact expected text and selection, focus, composition state and visible caret are retained after acknowledgement through the declared interval |
| Unrelated incoming content/load changes the list | No draft, selection or focus change; send control remains visible and hit-testable when required |
| Input or send in one scope followed by navigation | Every observed action belongs to its expected scope and input; old-scope actions cannot count as delivery in a new scope |
| Several inputs/actions in one capture | Match the complete expected ordered action list including kind, target and payload; missing, extra and duplicated actions fail |
| Composition and newline | Compare explicit composition and selection expectations; do not treat an IME commit or newline as an authorized send |
| Transient loss or stale restoration | A correct state followed by wrong text, selection, focus, composition or hidden caret fails even if the final sample recovers |
| Capture loss or missing acknowledgement | Missing/invalid samples or uncovered interval is incomplete. A completely captured interval without expected acknowledgement fails |

The real composer corpus distinguishes these positions before capture. The
original 18-message history case was only 73 px from latest; its raw attempts
remain evidence for near-bottom reading, not deep history.

| Real conversation position | Required preparation and acceptance |
| --- | --- |
| Latest | Initial bottom gap <= 1 px; grow and clear retain the legal bottom in every valid sample |
| Deliberate near-bottom reading | Actual upward wheel input, initial bottom gap > 1 and <= 100 px; an unchanged visible message retains its viewport position through grow and clear |
| Deep history | Actual upward wheel input, initial bottom gap at least two viewport heights; the same unchanged reading anchor remains in place through grow and clear |

Use the real composer and message renderer with ordinary application flags.
Seed 18 actual messages for the existing near-bottom regression and 72 for the
separate deep-history variant, and verify actual geometry after focus and setup.
Counts alone do not establish the required position. Capture exact input state,
send availability and the same deferred tail independently of geometry. An
unavailable textarea caret cannot erase an independently witnessed scroll or
draft failure; it remains a separate incomplete proof dimension.

Each interval and its expected state are defined by the test independently of
observed success. Actual input events use the same monotonic clock as snapshots.
Allow at most 100 ms from the triggering event to sampled acknowledgement; across
multiple triggered phases report p95 and require <=50 ms. Require the state to
hold from its first matching sample through the predeclared interval end. A
capture cannot reset the deadline or move the interval to discard a bad sample.
The final interval includes the relevant deferred-callback deadline and a 1 s
quiet tail. Sampling gaps may not exceed 100 ms. These limits preserve the
matrix; sampled acknowledgement does not fulfill displayed-frame AC-15.

Controls must include healthy sequences, dropped and duplicate actions, wrong
payload/target/scope, lost characters, moved selection, broken composition,
focus loss, covered caret/control, delayed acknowledgement, incomplete tails,
out-of-order/invalid samples and correct-to-stale-to-correct restoration.

The browser collector records trusted delivered input events and snapshots after
their handlers as well as at animation callbacks. Native textarea caret geometry
is unavailable to this DOM API; it records `null` and an incomplete caret verdict,
while exact draft/selection/focus has its own semantic verdict. It must not use a
mirrored textarea as if it were the real caret. Contenteditable calibration uses
the actual selection Range. Neither path establishes displayed-frame latency.

The first actual multiline composer run delivered eleven input events for one
fill and one for clear. A driver command and a DOM input event are different
units. For real fill cases, freeze the two requested payloads before capture and
record each command's dispatch start/end. Require at least one trusted delivery
inside each non-overlapping dispatch window (at most 250 ms), with the exact
requested payload, scope and target for every delivery. Repeated identical
events inside one dispatch remain in raw evidence; any extra event outside its
dispatch or a different value fails. Replay those deliveries independently into
the two requested actions; never choose command boundaries from observed success.
The empty composer must keep its send control visible and non-hit-testable;
the nonempty draft must make it hit-testable. This preserves the actual disabled
send policy rather than requiring an empty message to be actionable.
Preserve each event's native DOM `timeStamp` and the collector's `observedAt`
separately. Validate their ordering on the page's monotonic clock and measure
acknowledgement from event creation; an earlier event handler's stall must not
disappear by restarting the clock when the collector finally runs.

Initial local headless-shell execution was blocked by the macOS sandbox; a scoped
browser launch outside it succeeded. The first healthy capture then had an
118.2 ms sampling gap, so it cannot qualify. The next calibration uses full
Chromium headed with a fixed 2 s setup warmup and the same evidence limits. Keep
those browser conditions with its results rather than generalizing them to
headless production execution.
