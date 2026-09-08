# Real product checks added during test hardening

The simple HTML pages calibrate detectors: they establish that a checker rejects
injected drift, stale content, hidden text or broken input. They do not establish
Tlon behavior. The checks below use actual conversations, production message
renderers and the composer, backed by isolated local test ships.

Desktop setup: headed Chromium, 1280 × 800, normal application flags
(`TLON_IS_E2E` false), Vite development assets, zod HTTP 35453 and ten HTTP 38473.
This is not a production web build or physical presentation qualification.
Mobile web remains excluded. No production scroll behavior has been changed in
this baseline. The later verified production-build execution below is recorded
separately from these development-asset runs.

## Verified production-build execution

The initial r2 attempt ran six real-app image/text cases in headed desktop Chromium against a
fresh production build with normal application flags. Build receipt SHA-256:
`daae9e40c62f6fe5c6c7d81daf26d9cc2189453bf3b973e818f6531512936450`.
The receipt records 2,148 source inputs and 62 output files; captured application
responses match built bytes. Bootstrap responses are separately identified.

Its retained independent results are **one pass, two failures and three incomplete**. Both
concurrent history cases preserve exact text identity but move the retained
reading character upward 100 px. One concurrent latest case passes; the other
has stable geometry but an unresolved asset attempt-boundary timestamp check.
Both single-image rich-text cases stop during setup because developer tools
cover Send. Those incomplete cases do not qualify their intended product paths.

Raw report: `/private/tmp/scroller-built-content-product-r2-20260907.json`.
Independent replay:
`/private/tmp/scroller-built-content-product-r2-independent-20260907.json`.
The earlier build's test-loader interop failure remains retained. Corrected
reruns must use fresh artifacts and preserve these original attempts.

The separate r3 rerun corrected only demonstrated harness issues: a reporter
wall-end observation replaces the invalid assumption that Playwright's duration
covers all wall time, and authenticated reload setup idempotently closes the
real developer-tools overlay. It rebuilt from a fresh frozen source receipt
`b3b44a3cf57c4f857053c9b8b7b93d2482e30f99f7835fe8ac3cf05ed80890ff`
(2,150 source inputs, 62 output files) and reran only the three affected cases.
Independent replay qualified **two passes, one failure and zero incomplete**.
Concurrent latest and rich-text latest retain their exact reading points; the
rich-text history point moves upward exactly 100 CSS pixels. All three retain
valid production byte/scope evidence, maximum sampling gaps below 20 ms,
acquisition below 9 ms and over one second of terminal observation.

Combining the unaffected r2 cases with their r3 replacements gives **three
passes and three failures** across the six built-content variants. This is a
latest-per-variant view; the initial r2 incomplete attempts remain intact.
Raw r3: `/private/tmp/scroller-built-content-product-r3-20260907.json`.
Independent replay:
`/private/tmp/scroller-built-content-product-r3-independent-20260907.json`.

## Earlier development-asset execution

The acceptance contracts were written before execution:
[reading point and visible content](scroller-visible-evidence-contract.md),
[exact input and browsing positions](scroller-input-evidence-contract.md), and
[uncached references and source revisions](scroller-reference-evidence-contract.md).

| Actual product situation | Observed result | Evidence limit |
| --- | --- | --- |
| Held image loads before formatted text inside the same message, at latest | Sampled geometry and text-point contract pass | One immutable image/text essay, DOM observations; no painted-frame proof |
| The same image loads while reading history | The exact reading point moves 100 px although the row top stays fixed | Confirms an interior reading-point failure that row-origin checks miss |
| Focused composer expands and clears at latest | 77 px bottom gap for one sampled frame | Exact draft, selection and focus pass; native textarea caret geometry unavailable |
| Composer expands and clears during deliberate near-bottom reading | Anchor moves 150 px transiently and remains 73 px displaced | Started 73 px from latest after actual upward wheel input; does not establish deep-history behavior |
| Composer expands and clears in deep history | Reading anchor and exact draft/focus pass at 2,136 px from latest | 111 geometry samples, maximum gap 21.6 ms; caret and presented frames remain incomplete |
| Uncached reference loads and its source is edited at latest | Reading character moves 24.90 px on load and 42 px on edit; transient bottom gaps of 25 px and 42 px | Real forwarded subscription, correct author and both source revisions; 88/125 samples, maximum gaps 48/60.7 ms |
| The same reference loads and updates while reading history | Reading character moves 24.90 px on load and another 42 px on edit; both movements persist | Exposed starting character, 302.5 px from latest; 88/121 samples, maximum gaps 41/62.6 ms; does not establish deep-history or pagination behavior |
| Two actual image requests overlap, at latest, in both completion orders | Both independently replay as PASS; zero reading-character drift or bottom gap | A 720 × 1080 portrait and 1280 × 640 landscape image, verified PNG bytes, actual load/decode and one-second tail; DOM geometry only |
| The same concurrent images load during deliberate history reading near bottom | Both orders independently replay as FAIL: the retained character moves upward 100 px when the landscape frame shrinks from 400 to 300 px | Starting bottom gap 490 px becomes 390 px; latest button is correctly hidden below the 699 px viewport threshold, so these cases do not prove a button transition |
| Incremental keyboard editing and Enter routing, latest/history | Both corrected r3 runs independently FAIL with no incomplete dimensions: Send is unreachable by Tab in both; latest also leaves an 11.5 px gap during Shift+Enter | Exact edits, undo/redo, final draft and a single outgoing/committed essay pass their subcriteria; READ anchor drift is zero; native caret/presented pixels remain outside this sampled contract |
| Back while a cached-parent thread's reply sync remains pending | Independently PASS: the original response completes after Back and preserves the returned reading position | Actual held thread request; this proves pending-sync cancellation, not cancellation before first content |
| Open a missing-parent reply reference, then Back before thread content | Independently FAIL: 24 unlabelled blank DOM samples span 337.3 ms | Actual parent/query absence and original held request; returned channel has zero row/interior drift across 98 samples and a 1,216.9 ms tail after response completion; physical presentation remains unqualified |

The deep-history case contains 72 messages sent through the real composer;
the near-bottom regression retains the original 18-message setup. Geometry,
rather than message count, qualifies the starting position. The deep-history
run took 2.2 minutes for the test and 2.3 minutes including the runner. Its input
acknowledgement maximum was 17.8 ms; this is local sampled acknowledgement, not
display latency.

Raw evidence is retained outside the checkout:

- Image/text first run: `/private/tmp/scroller-reading-product-r1-projected.json`,
  with original HTML, JUnit and attachments retained under the matching `r1`
  artifact paths. The projection retains the source report provenance.
- Composer final latest/near-bottom baseline:
  `/private/tmp/scroller-input-product-r3-20260907.json`.
- Separate deep-history run:
  `/private/tmp/scroller-input-product-deep-r1-20260907.json`.
- Reference load/edit final baseline:
  `/private/tmp/scroller-reference-product-r7-20260907.json`, independently
  qualified in `/private/tmp/scroller-reference-product-r7-qualification-20260907.json`.
- Independent replay of these seven cases:
  `/private/tmp/scroller-gap-web-product-replay-r4-20260907.json`.
- Four concurrent-media cases: `/private/tmp/scroller-concurrent-product-r2-20260907.json`,
  independently replayed in
  `/private/tmp/scroller-concurrent-product-r2-independent-20260907-v2.json`.

The concurrent run independently qualifies as two passes, two failures and no
incomplete captures. Both image requests remain pending together for 297–313 ms;
after the first becomes ready, the other remains pending for 283–294 ms. The
largest reading-sample gap is 26.9 ms and acquisition cost 3.5 ms. The portrait
frame remains 400 px tall; the landscape frame changes from 400 to 300 px. These
are the observed layout effects, not a claim that both images resize.

The earlier concurrent attempt remains preserved. It exposed two harness
problems: object-key ordering was incorrectly treated as an essay change, and
a positional CSS path stopped matching after a harmless sibling insertion.
Structural object comparison now preserves array order, and the reading
collector retains the original connected text element. Two browser calibrations
verify harmless sibling insertion stays measurable and replacement of the
measured element is acquisition-incomplete. Neither is counted as product
coverage. The separate concurrent acceptance contract predates its execution.

That selected replay contains one fully qualified sampled pass, five qualified
failures, and one incomplete case (deep-history input's unavailable caret).
The report retains the exact incomplete dimensions even when an independently
observed scroll failure determines the overall result. Earlier failed and
incomplete attempts remain in their original reports; this selection does not
erase them or replace the [previous baseline](scroller-test-results-2026-09-06.md).

The reference source was committed with 60 newer posts, then opened from a
fresh browser context in another channel. The app requested the exact uncached
reference; the test held and then forwarded that request unchanged. Editing the
source returned HTTP 204 and the edited essay was read back from the backend.
The containing message and reading paragraph stayed unchanged. All four final
load/edit captures independently qualified, including exact author/revision
checks and a complete one-second terminal tail. Earlier setup failures and the
r6 history run with an already-clipped baseline remain recorded as incomplete.

The new product-only runner,
`apps/tlon-web/playwright.scroller-product.config.ts`, now registers 41 real-app
cases across seven files and excludes detector calibrations. The earlier
31-case `--list` selection was verified; registration of the ten additional
cases is not a fresh execution of all 41. The older 24 cases retain their
recorded accelerated E2E sync setting; the 17 focused additions use normal
application flags. Both currently use development assets.

The keyboard r3 raw report is
`/private/tmp/scroller-keyboard-product-r3-20260907.json`, with independent replay
in `/private/tmp/scroller-keyboard-product-r3-qualification-20260907.json`.
The two outcomes are FAIL/FAIL, with no acquisition-incomplete issues. The
recorded 1,001 test/app source hashes were unchanged through capture. Auxiliary
r3 screenshots and traces are uniquely archived under
`/private/tmp/scroller-keyboard-product-r3-artifacts-20260907/manifest.json`.
Earlier keyboard r2 measurement/proof JSON remains intact, but its original
shared screenshot/ZIP paths are not immutable retained artifacts. The r3 plan
corrects native undo selection and exact paragraph serialization, both grounded
in native-control/source checks rather than weakened string comparison.

Navigation r2 reached the real thread and returned to the original exact reading
point. An oracle correction allows bounded route/content commit ordering while
checking first actual destination exposure; independent replay then has no
journey issues. Its original failed runner status is preserved, so the shared
report does not promote that historical attempt to a recorded pass. The Back
attempt happened after first reveal and remains incomplete. Two newly registered
pending-load cancellation cases have now executed separately. Cached-parent r1
qualifies as PASS in `/private/tmp/scroller-navigation-pending-product-r1-20260907-replay.json`.
The missing-parent r1 attempt timed out because the driver targeted inner text
instead of its actual pressable reference frame; it remains incomplete. The
corrected r2 clicks the real frame and independently qualifies as FAIL only for
the unlabelled blank samples. Its raw report, replay, importer records and source
hashes are `/private/tmp/scroller-navigation-pending-product-r2-20260907*.json`.
The original response is released 304.4 ms after Back; 147 observations have a
maximum gap of 61.3 ms and acquisition cost of 21 ms. The blank interval from
first blank sample to first returned content is 355.5 ms. These are DOM sample
intervals, not a claim about the duration of physical display presentation.

The reporting controls now also reject relabeling near-bottom evidence as deep
history. Sixty-eight input/oracle/import controls pass, including an observed
scroll or draft failure combined with missing caret geometry, and a producer
failure whose missing geometry must remain incomplete. They are detector
validation counts, not additional product scenarios.

The final combined run passed 799 detector, evidence-import and component
controls across 15 files, saved in
`/private/tmp/scroller-final-hardening-controls-20260907.json`. Explicit
`evidence-kind: scroller-detector-calibration` annotations now identify all three
calibration suites. Old reports remain recognized; detector passes contribute no
product coverage, detector failures still fail the report, and an annotation
cannot hide a registered product failure.

A checksummed copy of the retained evidence and current test/instrumentation
sources is preserved in `artifacts/scroller-baseline-2026-09-07.tgz`. Its
`MANIFEST.json` records every included file. Per-run provenance remains
authoritative: the source archived at the end is not necessarily the source
used by every earlier attempt.

A second immutable archive, `artifacts/scroller-baseline-2026-09-07-v2.tgz`,
retains the later keyboard, concurrent-content, pending-navigation and buffered
native evidence with the source snapshot at archive time. All 351 files were
read back and verified; archive SHA-256 is
`ca63b67d7dbaba512663906f13831d6ef6b3602275d8623bc9223fce5bea5c3c`.
Later entry-qualification and web module-interop changes are not represented by
that source snapshot and require their own build/source provenance.

These additions do not complete the matrix. Reference/media failure, retry and
source replacement, more content combinations, native read/send
journeys, continuous first-reveal navigation, incremental typing/IME, presented
frames, built assets, browser/device breadth, cancellation combinations and soak
remain separately required. Small controlled assets establish their measured
load/reflow behavior, not the complete content renderer or media experience.

## Pending send followed by deliberate READ

The one bounded real-app case independently **fails with zero incomplete issues**.
The actual Enter key created one optimistic message while its exact outbound
post-add request was held before forwarding. During that 1,035.6 ms hold, the
backend contained zero matching posts. Trusted upward wheel input established a
120 px bottom gap and an exposed unchanged reading character. After unchanged
request release, the matching successful wire poke acknowledgement arrived;
the list then returned to latest and moved that character upward120 px.

The first observed movement was 47.4 ms after wire acknowledgement receipt. This
is a network-observer receipt timestamp, not a direct observation of the app's
`onSuccess` callback. Final backend and UI evidence independently establish one
committed message and reconciliation from the optimistic ID to that exact
canonical backend ID. Both backend windows are complete: 36 original posts,
then 37 posts, unique canonical IDs, no older/newer cursor, and unchanged original
essays. There is no duplicate send or late draft restoration.

The retained capture has 425 DOM samples and 319 reading samples. Maximum sample
gaps are 56.1/55.9 ms; acquisition costs are 0.5/5.6 ms. It covers the independently
fixed five seconds after release and 4.658 s after terminal reconciliation. All
1,668 captured source hashes were unchanged during execution. The scenario took
21.007 s in headed Chromium with normal application flags; actual bundled
`index-lbl3h7gl.js` was observed and no Vite runtime was present. Reusing that warm
preview is not a fresh build-receipt qualification. Presented frames and native
caret geometry remain outside this sampled contract.

The runner's first invocation selected zero tests because its grep expression
was incorrectly anchored; it remains a separate runner failure. No product case
ran then. The corrected r2 invocation ran the single intended case once. Its
ordinary failing assertion remains in the baseline; no rerun was needed.

- Raw report: `/private/tmp/scroller-pending-send-product-r2-20260907.json`.
- Original independent replay: `/private/tmp/scroller-pending-send-product-r2-20260907-independent.json`.
- Tightened independent replay: `/private/tmp/scroller-pending-send-product-r2-20260907-independent-v2.json`.
- Initial 71 controls: `/private/tmp/scroller-pending-send-controls-20260907.json`.
- After three identified proof corrections, 83 controls: `/private/tmp/scroller-pending-send-integrity-controls-20260907.json`.

The later proof corrections require finite hold/forward/ACK times, exact
canonical terminal UI identity and a complete canonical-ID-unique backend
window. Replaying the untouched r2 data under these rules retains the same120 px
failure with no new incomplete issues. Exact run-source bytes and later replay
sources are retained separately; tightening the evaluator does not rewrite the
collector that ran. The separate supplemental archive is
`artifacts/scroller-pending-send-baseline-2026-09-07.tgz`.
