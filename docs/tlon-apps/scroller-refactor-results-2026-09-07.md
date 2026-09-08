# Scroller refactor validation — 2026-09-07

## Production recheck — September 8

Production R3 takes **116.341s** for six cases with one headless Chromium worker
and no retries. Independent replay confirms five sampled-behavior passes:
both image completion orders at Latest and in history near the bottom, plus
the real older-pagination failure/boundary-retry case. The restored viewport
visibility policy now passes the same two cases that failed in R2. All six
test-owned groups are deleted; no cleanup errors occur.

The concurrent reader now reports sampled behavior separately from headed
behavior and presented frames, as declared in its updated contract before the
fresh run. Both browser modes use the same visibility, geometry, acquisition
and cadence rules. Headless sampled passes do not qualify headed or presented
behavior. Original reports and assessments remain unchanged.

Retry remains incomplete in R3: the new continuation wait mistakenly watches
the original aborted request. Its actual retry request continues, but the
wait prevents collection of the terminal phase. The helper now waits for the
active retry request, or the original request for the non-retry case. The
isolated **R5 now passes** both Playwright and independent sampled-behavior
replay with no reported issue: **22.371s total / 20.5s test**. The real same-post
Retry keeps later READ ownership, reconciles once and completes the required
tail. Its single test-owned group is deleted without error. Raw report and
independent replay are in
`/private/tmp/scroller-failed-send-product-r5-20260908/`. It runs against the
production preview; this helper's script observations do not independently
bind loaded asset bytes as the concurrent-image and pagination captures do.
Presented frames and caret geometry remain incomplete.

The combined app check has **3,056 passing assertions and three existing
skips across 131 files**, with TypeScript passing. Build R3 completes in
74.852s; its receipt digest is
`de797c8e299eaff0090114d514a8e6326642deeed13720af58c934aee35d9a1f`.
Raw R3 report and independent replay are in
`/private/tmp/scroller-production-content-r3-20260908/`; checks are in
`/private/tmp/scroller-production-fixes-app-r3-20260908.json` and
`/private/tmp/scroller-production-fixes-ts-r3-20260908.log`.
The subsequent helper-only request-selection correction is verified by the
actual R5 case. The same production application output is unchanged between
R3 and R4 builds; their broader source receipts differ because they include
the helper. Original and corrected attempts are archived in
`artifacts/scroller-production-regressions-2026-09-08.tgz`.

## Production loading, pagination and Latest visibility — September 8

The eight-case production batch takes **174.711s** with one headless Chromium
worker, no retries and no extra Playwright trace/video. Both rich-text image
loading cases pass, at Latest and in history. Independent replay records two
sampled passes, two failures and four incomplete results. All eight test-owned
groups are deleted successfully. Raw attempts and the original replay remain at
`/private/tmp/scroller-production-content-r2-20260908/`.

The two concurrent-image history cases expose a real refactor regression:
Latest is visible at a 490px gap inside a 699px viewport, contrary to the
accepted one-viewport visibility policy. Commit `025f83098b` had changed the web
comparison to an absolute 1px distance. Native still uses its documented window
ratio. The web fix restores the viewport comparison while leaving deliberate
READ ownership and exact bottom landing unchanged. Five focused assertions fail
before this fix; all 64 focused visibility/coordinator/registry assertions pass
afterward. The concurrent-image cases also retain their headed-only qualification
gap; the two Latest variants have no other reported issue.

The failed-send case now captures the actual browser request initiation. In this
run Retry starts its request **56.232ms** after the trusted click, within the
unchanged 100ms limit, and the same post succeeds once. Its remaining incomplete
result is test ordering: the terminal backend read starts 0.6ms before the
asynchronous route-continuation timestamp. The helper now awaits continuation
before beginning that read; it does not change the reader's causal requirement.
The earlier standalone production R4 stops at the dev-only Retry whitespace
assumption and remains preserved in
`/private/tmp/scroller-failed-send-product-r4-20260908/`.

The new real pagination case completes five failed older-range attempts and a
sixth unchanged successful GET, then prepends the original committed rows once.
The first recorded run is incomplete because full navigation creates two
document observations, and its successful response arrives before the required
200ms reading baseline. Setup now uses the real named-group navigation UI and
records 270ms before releasing either held response. Asset, geometry, cadence
and tail limits are unchanged. The acceptance is in
[pagination failure and retry](scroller-pagination-retry-contract.md).

The initial combined app check records 3,035 passes, two stale registry-total
failures and three existing skips across 131 files; TypeScript passes. The two
unrelated global-total assertions are removed while their exact family, scenario
and matrix assertions remain. Updated final checks and fresh runtime results
are required before this checkpoint is considered verified.

## Capture corrections and failed-send coverage — September 8

Baseline refactor: `2fed3a95678ffaa66748311e311b1d2a8e25a47d`.
The new checks bind wheel commands to independently measured scale and the
actual asynchronous DOM receipt, preserve same-clock input deliveries, and use
native local bounds to distinguish reserved shape from converted cell extents.
Failed-send coverage aborts only the exact owned request, uses the actual Retry
control, and retains later READ ownership through the successful retry.

| Check | Result | Evidence |
| --- | --- | --- |
| Combined app | 2,990 assertions pass; three existing skips, 130 files; TypeScript passes | `/private/tmp/scroller-final-capture-fixes-app-20260908.json`, `/private/tmp/scroller-final-capture-fixes-typescript-20260908.log` |
| Native R27 | Reaction mutation and anchor continuity PASS, 106 frames, zero drift; native buffer COMPLETE; shared JS/native acquisition INCOMPLETE | `/private/tmp/scroller-native-reaction-r27-20260908/independent-replay.json` |
| Desktop R6 | 50/50 actions; Playwright fails, independent INCOMPLETE with 14 issues | `/private/tmp/scroller-seeded-session-product-r6-20260908/independent.json` |
| Desktop R7 | 50/50 actions; wheel/thinking checks clear; two remaining reading/input acquisition gaps | `/private/tmp/scroller-seeded-session-product-r7-20260908/independent.json` |
| Desktop R8 | 50/50 actions; wheel/input checks clear; two reading gaps plus two thinking-acquisition flags and their downstream handoff flag; INCOMPLETE | `/private/tmp/scroller-seeded-session-product-r8-20260908/independent.json` |
| Failed-send R1 | Real failure reached; Retry selector spacing mismatch stops before Retry/READ | `/private/tmp/scroller-failed-send-product-r1-20260908/playwright.json` |
| Failed-send R2 / R3 | Real same-post Retry succeeds; 120.1 / 119.3 ms click-to-request intervals exceed the 100 ms binding limit; INCOMPLETE | `/private/tmp/scroller-failed-send-product-r2-20260908/canonical-replay.json`, `/private/tmp/scroller-failed-send-product-r3-20260908/canonical-replay.json` |

R27 takes **184.458s total**: build/install 138s, launch 1s, readiness 20s.
Ready-to-dispatch request takes 1.373s, and dispatch-to-collection takes 11.289s;
the native recording itself lasts 1.825s. Shared acquisition brackets of
76.454/50.278/44.221 ms exceed 32 ms; native measurement operations take only
1.079–1.341 ms. Native-buffer continuity remains separately qualified. Exact
artifact/source checks, one final screenshot and explicit-device cleanup finish.

R6 exposes two wheel-binding mistakes that isolated controls missed: the real
route has a query string, and DOM observation follows driver return by
6.7–10.5 ms. Both are corrected with faithful controls and unchanged limits.
R6's 37.4 ms metrics bracket remains incomplete in the preserved attempt.
The original R5 duplicate input snapshots also remain preserved; the producer
now coalesces only fully identical snapshots at the same timestamp.

Per-sample ancestor read reuse reduces observed global-collector measurement
time in the affected R6/R7 interval from 3.22 to 2.53 ms on average. Every
sample, event and hit probe is preserved, and caches expire after each sample.
This comparison supports reduced collector cost, not a controlled causal claim.
R7 still has a shared 105.7 ms reading/input gap.

Playwright's inherited retain-on-failure trace/video settings record throughout
each test. They are now off for measurement runs; explicit raw collectors and
failure screenshots are unchanged. R8 takes **111.515s total / 100.941s test**,
compared with R7's **122.103s / 108.154s**. Cadence gaps remain: reading 1 has a
100.7 ms quiet-tail gap; reading 2 and semantic/chrome have 103.0/103.1 ms gaps
during remote send. The thinking handoff flag follows from that truncated
qualified prefix. Removing debug recording does not establish a timing fix.

Failed-send R3 retains exactly two owned requests, unchanged payload/identity,
a real successful retry ACK, one reconciled post and an empty draft. Click
observation takes 67.7 ms, followed by 51.6 ms to the captured request. The
100 ms binding guard rejects their 119.3 ms total; the acknowledgement issue
is downstream of the reader retaining the initial request ID. All three
attempts clean up their exact owned groups. No timing limit is relaxed and no
incomplete attempt is counted as a product pass.

All runtime processes are terminal. Source/recipe checks and owned cleanup
complete. Raw attempts and reviewed changes are retained in
`artifacts/scroller-capture-fixes-2026-09-08.tgz`; compiled native executable,
bundle and source map are excluded. Production-build, presented-frame,
caret/IME, wider platform/overlap/unread/pagination and soak qualification is
still open. Mobile web remains excluded.

## Structural refactor and fresh comparison — September 8

Parent baseline: `025f83098b7baa7fa6bd864ebc38a56ff93ca08f`.
Message actions and local overlays now share one module; Scroller keeps list
lifecycle setup together, readiness exposes an entry-bound accessor, and Latest
retirement retains its exact request/frame guards. Row divider rendering is
shared without changing native hosts, refs or labels. Independent review found
no behavior changes. Six added action transitions and four divider-label cases
exercise the existing component seams. Twenty-five new seeded-reader controls
cover independently derived provisional send IDs and the exact binding of all
multiline input events to the original dispatch.

| Check | Current result | Evidence |
| --- | --- | --- |
| Combined app checks | 2,865 assertions passed; three existing skips in 130 files; TypeScript passed | `/private/tmp/scroller-structural-final-app-20260908.json`, `/private/tmp/scroller-structural-final-typescript-20260908.log` |
| Fresh desktop R5 | All 50 actions complete, zero action errors. Playwright assertion fails on ten incomplete issues; independent behavior and overall verdicts are INCOMPLETE, with no qualified behavior failures | `/private/tmp/scroller-seeded-session-product-r5-20260908/independent.json` |
| Fresh iOS R26 | Three complete native buffers. Entry row model passes within 0.167 pt; removal passes with zero drift. Broader entry and reaction assessments remain incomplete | `/private/tmp/scroller-native-refactor-r26-20260908/independent-replay.json` |
| Combined checkpoint | Source/reader/recipe and native artifact checks complete; both runs' owned cleanup complete | `/private/tmp/scroller-structural-checkpoint-20260908/results.json` |

Raw attempts, readers, checks and receipts are retained in ignored local archive
`artifacts/scroller-structural-checkpoint-2026-09-08.tgz` (58,263,569 bytes,
SHA256 `c8dbb1713d271cd5f0800316b18346b9a8a8fd5d2dd19639b5bebe65b7516456`).
Compiled native executables and bundles are excluded from this archive.

Desktop R5 takes **141.604s total / 117.670s test time**, headless Chromium,
one worker, zero retries and normal app flags. Its ten remaining issues are eight
wheel-delivery mismatches, `reading-1:capture-gap` and
`input-6:invalid-input-samples`. The exact created group `~zod/v20a3il2` is deleted,
and the browser closes. The preceding R4 stops at startup when a stale Vite
resolver cannot resolve the new `ScrollerMessageActions` file; its browser
closes before any scenario. Both exact owned Vites are restarted with the same
root, port and ship configuration, and four changed-module probes return HTTP
200 JavaScript. Recovery: `/private/tmp/scroller-web-refactor-vite-recovery-20260908`.
R3 was prepared but never captured. These attempts remain separate.

The original R2 FAIL is unchanged. Supplemental replay with the corrected reader
removes its 109 provisional-ID flags and four multiline-input cardinality gaps
using retained wire/dispatch facts; its eight wheel mismatches and two capture
gaps remain. Receipts: `/private/tmp/scroller-seeded-provisional-id-20260908` and
`/private/tmp/scroller-seeded-grow-binding-20260908`.

iOS R26 takes **424.349s total**, including **135s build/install**, **16s Ready
check** and **192.151s waiting for capture release**. Suite dispatch through
collection takes **28.653s**. Entry checks 200 content frames and 60 tail frames;
removal retains 111 qualified anchor frames. Reaction continuity cannot qualify
after its anchor content/dimensions change. Exact source, embedded bundle and
installed executable match; one final screenshot and explicit-device service
cleanup complete. Receipt and image:
`/private/tmp/scroller-native-refactor-r26-20260908/report.md`,
`/private/tmp/scroller-native-refactor-r26-20260908/final-screenshot.png`.

This checkpoint supports the structural refactor. It does not close native
keyboard/gesture, interior-content, presentation/caret/IME, remaining platform
or seed/soak coverage. No native overlay interaction or complete matrix pass is
claimed. Mobile web remains excluded.

## Prior baseline checkpoint

Current checkpoint: R24 end and R25 away post-gesture tails pass bounded native
checks; keyboard/drag overlap remains incomplete. Seeded R2 completes all 50
actions but fails the final canonical assessment. This tested baseline supports
the refactor entry gate, with failures and test gaps explicit; final
qualification remains open. Mobile web remains excluded. Baseline:
`e1ae7dda78b0107c42d45b4d0364b55047c301d8`.

Original captures and failures remain in ignored local archive
`artifacts/scroller-refactor-r1-web-ios-2026-09-07.tgz` (345,949,671 bytes,
SHA256 `212b4b57915ea0aa8d56063149ad30be7b3a45d9649c055915247ef173b8e461`).
It is not part of the source commit.

The current checkpoint's raw attempts, readers, receipts and checks are also
retained in ignored `artifacts/scroller-baseline-checkpoint-2026-09-08.tgz`
(81,442,239 bytes, SHA256
`00e88970a2d77f20d06ad7c200052bb809381a392ef29eb96d1497f1e2498adf`).

## Latest focused desktop checks

Routine scroller configs now default to headless full Chromium. Visible runs
require explicit `SCROLLER_HEADED=1` or `--headed`; actual preparation metadata
records the resolved mode. Existing headed-only evidence requirements are not
weakened. The fresh functional Send check passed 2/2 in 25.924 seconds with an
actual `--headless` launch and clean browser exit. Config-only checks confirmed
the default and both explicit visible overrides without opening a headed browser.
Evidence: `/private/tmp/scroller-send-headless-r1-20260907`.

The synchronous composer-layout notification now has a headless actual-app
latest-keyboard assertion pass and a separate unchanged geometry-oracle pass:
897 samples, maximum spacing 57.4 ms and maximum bottom gap 0.5 px. The full
existing keyboard importer remains **incomplete** because it requires headed
provenance. That requirement was not relaxed; this is a geometry-only scoped
qualification, not presented-frame evidence. Raw and independent replay:
`/private/tmp/scroller-center-keyboard-product-r1-20260907`.

The new center-reading edit case independently passes after actual expansion and
shrink through Edit/Save: 171 samples, maximum gap 92.8 ms, acquisition 3.4 ms,
character movement 0.1953125 px and a 1,013.6 ms terminal tail. The edited row
measured 31.203125→157.5078125→52.5078125 px. Both actual 204 header receipts
preceded fresh verification GETs; complete 36-post windows proved exact saved
revisions and unchanged other content. The original exposure oracle also passes;
response-end latency and compositor presentation remain unknown. Normal flags,
headless Chromium, one worker, zero retries and matching before/after source and
reader snapshots. Runtime 20.457 seconds; raw and qualified replay:
`/private/tmp/scroller-center-edit-product-r3-20260907`.

Its full attempt ledger is retained: R1 lost a positional setup selector;
R2 reached both edits but unbounded HTTP finalization prevented raw export;
the combined run exported raw yet remained incomplete because its GETs started
before response headers. The producer now explicitly waits for matching headers;
the independent ordering guard is unchanged. Original directories:
`/private/tmp/scroller-center-edit-product-r1-20260907`,
`/private/tmp/scroller-center-edit-product-r2-20260907`, and the combined run above.
These supplement the older first-row edit failure; they do not rewrite it.

The preceding r3 focused run passed both functional Send cases. Strict replay
retains one sampled pass (history keyboard), one latest-keyboard geometry
failure with additional acquisition gaps, and four incomplete cases. The final
thinking/history case was interrupted for the user's new browser-focus
constraint and is not a product failure. The textarea measurement supplement
had not resolved the latest-keyboard failure at that earlier recording.
Raw and replay: `/private/tmp/scroller-refactor-send-semantic-r3-20260907`.
The intervening r2 import-resolution setup failures and scoped abort remain in
`/private/tmp/scroller-refactor-send-semantic-r2-20260907`; they reached no
scenario actions. Refreshing only the two verified Vite processes restored
the same module URLs without changing source.

The separate Send-button functional rerun passed both actual-app cases in
22.5 seconds. Tab/Shift+Tab retained the input and selection; Enter and Space
each generated one trusted click, one channel request and exactly one matching
durable message. The actual HTML button has `type="button"`, its accessible
name and its native disabled property. The first attempt failed on the missing
accessible name and remains retained. This proves these functional contracts,
not continuous geometry, latency or presented frames.

Raw: `/private/tmp/scroller-refactor-send-button-r2-20260907/raw.json`, SHA256
`2530a412bf91041898fb604e2c6bab1d5c232e63ec197e2693eed526e44a0fc4`.
Source-before/after hashes agree. Normal flags, one headed Chromium worker,
zero retries, existing verified local test ships and Vite development assets.

The preceding focused strict six-case run independently yielded one sampled
pass, three failures and two incomplete results. History keyboard passed;
latest keyboard retained a geometry failure, with its input/focus/delivery
checks passing. Remote/thinking history failed new exact-text checks; inspection
found the expected rendered text omitted the real serializer's trailing space.
The latest variants began away from latest and lacked complete action/tail
evidence. These oracle/preparation defects require separately tested corrections;
the old failures and incomplete reports are not rewritten.
Raw and independent replay:
`/private/tmp/scroller-refactor-send-semantic-r1-20260907`.

The uncached-parent navigation failure also has a retained browser screencast
image showing the blank pane, beyond the DOM sampling failure. Its exact source
renders no content while the parent query is empty. Image:
`/private/tmp/scroller-refactor-web-failure-analysis-20260907/missing-parent-460066.852.jpeg`.
This individual captured frame does not provide full presented-frame coverage.

## Second native component recording

Total elapsed time: **21m 3s** (14:07:14–14:28:17 UTC), including build,
interaction, collection and verification. App-only timing was not measured.
The exact Release fixture executable and embedded JavaScript matched before
and after the run on simulator `6DBBE7A7-F11A-4133-8B20-25A39B4B980C`.
Source snapshot: `8e3e230fafe6beb356369f7866dc3e1d5f9df99f8df271539cc344a3eeca6b42`.
Evidence: `/private/tmp/scroller-refactor-native-buffer-r2-20260907`.

The 38 core cases independently yield **13 sampled passes, 3 failures and 22
incomplete results** through the existing on-demand native geometry reader.
All 38 buffered native acquisitions are complete. Acquisition completeness
does not qualify product behavior. The original collector's 13/4/21 counts
remain preserved alongside the independent replay.

All three separate initial-entry captures pass the buffered row-model oracle:
latest 0pt, selected 0.166748pt and delayed 0.333333pt maximum landing error.
Each includes the required one-second terminal tail. Buffered acquisition is
complete for these three captures. These results do not establish input-to-usable
latency or every presented frame. The core-suite entry captures independently
yield two passes and one incomplete result: core latest has an inner/cell
containment mismatch and is not replaced by its later standalone pass.

The three history failures are retained. Growing or changing cached content in
message109 below the reading anchor moves message108 upward by1392pt. Removing
message109 above the reading anchor moves message111 upward by38pt while the
following message also changes height as its grouping changes. Choosing a later
anchor or retaining a dependency target may explain this behavior; the captured
data does not identify the responsible dependency state.

Some incomplete cases have concrete measurement defects. The on-demand reader
still uses a full transparent composer/latest wrapper as the bottom boundary,
while the newer entry ruler measures actual surfaces. Eleven mutation cases
also contain a JS acquisition bracket over32ms at the commit; the native
operation is short, but mixed ownership/time evidence cannot pass. Preserve
these raw results and correct future capture contracts before rerunning.

## Thread loading correction

An uncached thread now retains a loading shell with Back, then an explicit
error or unavailable state with retry. A successful sync is followed by a
fresh local read; stale route completions cannot publish UI. Cached content
remains mounted during background work. Settled-read gating avoids restarting
the request when an initial query error is refetched. Covered stack routes
retire their own loading headers while preserving the covering route and
shared tab header ownership.

Tests reproduced the initial query restart and retained route header defects
before their corrections. The combined75 controls pass, including an installed
React Navigation retained-route descriptor harness; app TypeScript passes.
Evidence: `/private/tmp/scroller-post-loading-followup-handoff-20260907.json`.
Actual-app loading and native painted-header recaptures remain pending.

## What changed

Scroller orchestration now separates readiness, latest-action ownership, layout,
and row interactions. Native and desktop lists distinguish following latest,
reading history, and an explicit destination. Delayed callbacks retain their
original conversation visit and user intent; new input or navigation revokes
that authority. Native composer restoration uses the same ownership rule.
Desktop reading anchors include an interior text position so an image decoding
inside the same message cannot move the paragraph being read.

The screen layer scopes read work, thread unread snapshots, selected-message
work and send completion to the current visit. Native landing accounts for the
usable viewport and the last-row footer. Thinking state is scoped to the thread
parent. Row memoization now observes renderer and action changes.

## Evidence layers

The component fixture uses real Channel, ChatMessage and composer components
with controlled posts and dependencies. It can isolate layout and anchoring;
it cannot establish real transport, cache invalidation, subscriptions or screen
navigation. Detector controls establish that measurement failures are caught.
Actual app cases cross those boundaries. Sampled geometry does not establish
what every display frame presented.

| Layer | Current result | Meaning and limitation |
| --- | --- | --- |
| App unit and component tests | r2: 2,022 passed / 3 skipped; r4: 2,077 passed / 3 skipped; r5: 2,151 passed / 3 skipped; zero failures | Counts come from individual assertions. All runs skip the same three preexisting live provider-key checks; Vitest's aggregate incorrectly includes them among passes. These are not product-scenario counts. App TypeScript passed at those snapshots. |
| Built desktop actual app | Seven browser assertions and seven independently replayed sampled passes on the initial refactor snapshot | Four concurrent-image orders/positions, rich-text image decode at latest/history, delayed Enter send after upward scrolling. The original six-pass/one-incomplete report is retained; a separately tested clock-reader correction qualifies the unchanged raw attempt. |
| Normal iOS app | One uninterrupted 441-second journey passed; initial Home precondition failure retained | Eighteen exact UI sends, composer expansion/clear, actual latest button, correctly parented reply and thread return/reentry. Independent backend readback confirmed exactly 18 posts and one reply. |
| Native component geometry, buffered r1 | 38 core: 4 sampled passes / 5 failures / 29 incomplete; three entry attempts: 2 passes / 1 failure | Acquisition is separately 25 complete / 13 incomplete for core. Five qualified failures are transient end gaps; entry retains the old-ruler 24.166748 pt selected error. Later fixes await recapture. |
| Broader desktop product corpus | All 42 ran once in 20 minutes: 29 browser passes / 13 failures; independent replay: 27 sampled passes / 7 failures / 8 incomplete | Normal app flags, headed desktop Chromium, one worker and no retries. Vite development assets and frozen source, not a production-bundle byte qualification. |

All seven desktop captures measured 0 px interior reading drift. The original
READ content-loading cases moved that same point by 100 px. The original
delayed-send case moved it by 120 px; the new actual send/acknowledgement case
independently passes with its original fixed five-second post-release window.
The six media cases verified the delivered production response bytes. The
pending-send case records the actual runtime and resources but does not carry
that same per-case delivered-byte proof.

## Remaining limits

Required browser/device breadth, presented frames, long seeded sequences and
soak remain unqualified. The actual native journey does not itself qualify
continuous native geometry, read/unread effects, IME, upload failure recovery or
all stateful media. A green component test or acquisition-complete recording
cannot substitute for those requirements.

## Normal native run provenance

The phase ran from 11:27:04.543 to 11:48:33.438 UTC: 1,288.895 seconds total,
including build, waiting for the exclusive browser capture, setup and final
verification. The successful uninterrupted Maestro journey took 441 seconds;
app-only response time was not measured. The first attempt failed its Home
precondition after 19 seconds while SpringBoard was foreground. No conversation
actions ran in that attempt. A separate attempt explicitly launched the verified
app before invoking the same immutable flow and passed all assertions.

Only simulator `6DBBE7A7-F11A-4133-8B20-25A39B4B980C` was used. The normal
`index.tsx`/`App.main` Release preview app used ordinary flags and the isolated
local `~zod` account. The tested source snapshot was
`7f537bcb41d38826fe509f8c180ec49fe067b00873b6a3f11329e49f4ddaa143`.
Artifact and installed JavaScript matched SHA256
`f182bf1ee7a3608179c2d855db43fe0c920be256ae7daf6c40e99b8e5bf87806`;
native executable SHA256 was
`7165848490f8fbdfa6c8b4f37cd0e158705eb13cabb36cbe4ca16a62b8a1f801`.
The source map contains App.main and excludes the component-fixture entry.
The receipt, executable, embedded JavaScript and source map are retained under
`/private/tmp/scroller-refactor-native-product-r1-20260907` alongside both
attempts and the independent backend readback. Final snapshot, installed-byte
and account verification passed before subsequent source edits.

The next review found three additional cases requiring changes: existing FOLLOW
after browser range clamping, Ctrl-wheel zoom intent, and a retained thread
covered by another native route. This successful native journey predates those
supplements; their evidence must be recorded separately.

## Review supplements and evidence-reader correction

A second complete app run (r2) contains 2,022 passing assertions, three skipped
preexisting provider-key checks and zero failures; the later r4 run contains
2,077 passing assertions with the same three skips and no failures. The aggregate
2,025/2,080 "passed" totals include those skips and are not used here.
TypeScript passed at both snapshots. New controls first reproduced four browser clamp failures,
four zoom-classification failures and five route-focus failures against the
preceding source, then passed after their bounded fixes. The clock correction
adds eleven controls. None is counted as an actual-app situation.

- Existing FOLLOW now survives a witnessed browser range clamp in either event
  order. A real upward gesture, an existing READ, and unexplained passive motion
  cannot obtain follow authority; previously revoked permits stay revoked.
- Both desktop list layouts exclude Ctrl-wheel zoom/pinch from vertical scroll
  intent. Ordinary trusted wheel and keyboard handling remain covered.
- Thread ownership now requires navigation focus as well as the selected
  carousel post. Covering a retained screen retires read/send-follow/queued-frame
  work. Returning creates fresh eligibility while preserving the mounted draft.

The browser attempt reader incorrectly compared Date.now endpoints with
Playwright's independently accumulated monotonic timeout duration. Its actual
end preceded `wall start + duration` by 7 ms, although all measured asset work
finished 650 ms before the explicit wall end. The correction checks ordered
wall endpoints and exact asset containment against that observed end, retains
finite-duration, identity/retry and byte-hash checks, and introduces no time
padding. Controls reject reversed clocks, invalid duration, late assets and
wrong bytes. Replaying the unchanged raw result produces seven sampled passes.
The original six-pass/one-incomplete report is retained alongside the distinct
`independent-replay-clock-v2.json` report. This does not constitute a new browser
execution of the later production review fixes.

Detailed pre-test contracts:
[attempt clock](scroller-attempt-clock-evidence-contract.md) and
[retained post focus](scroller-post-route-focus-contract.md).
Raw consolidated reports are `/private/tmp/scroller-refactor-app-tests-r2-20260907.json`
and `/private/tmp/scroller-refactor-app-tests-r4-20260907.json`; the later r5
report is `/private/tmp/scroller-refactor-app-tests-r5-20260907.json`. The corresponding
typecheck logs are retained separately.

## Full desktop corpus

All 42 cases executed once, with no skips or retries, in 1,199.504 seconds
(20.0 minutes). Browser assertions report 29 passes and 13 failures. Independent
replay qualifies 27 sampled passes, seven failures and eight incomplete cases.
The failures include composer end gaps, keyboard delivery/focus, missing-parent
navigation blanking, thread-return position and edit-time reading drift.
Incomplete evidence includes unmeasured caret position, invalid setup/action
proof and missing capture intervals or quiet tails; it is not counted as passing.

The exact-composer latest case records a **77 px gap in one RAF sample** when
the viewport shrinks 699→622 px. The next sample, 15.6 ms later, has zero gap.
This remains a sampled-geometry failure under the unchanged 1 px criterion.
It does not establish lost FOLLOW authority, a persistent jump or presented-frame
jank; RAF/ResizeObserver ordering is a possible explanation, not a proven cause.

Raw assertions, attachments, replay, all failures and the compact qualification
summary remain under `/private/tmp/scroller-refactor-full-web-r1-20260907`.
The raw report SHA256 is
`c95057c757b4cd7ba6c36db200c8f7f3e26c73522b190aa34dc4e70839128698`.
Before/after source digests match
`882f484a43c76d770a5fdd981cf24e67d15bd624142e59bf7bfffb0fa802aee0`.
These normal-flag Vite captures do not inherit the earlier built-asset receipts.
The composer diagnostic is retained under
`/private/tmp/scroller-composer-gap-diagnosis-20260907`.

## Buffered native refactor recording

The 38 core attempts independently qualify four sampled passes, five failures
and 29 incomplete results. Native acquisition is separately complete for 25
attempts and incomplete for 13. Thirteen fixture-command cases were invalid:
the fixture's direct LegendList positioning bypassed FOLLOW ownership, so the
required history anchor was not acquired. Neither acquisition completeness nor
a fixture setup failure establishes a product pass or failure.

Five qualified failures retain transient end gaps during append and thinking
show/handoff transitions. Their JS-observed gaps are approximately 52–129.667 pt;
the native model also records up to 146 pt. Eventual end arrival does not erase
these failures, and native model samples do not prove presentation. Separate
entry attempts qualify latest and delayed entry, while selected entry fails at
24.166748 pt under the original inner-row/composer-wrapper ruler. The later
ruler correction cannot retroactively qualify that recording.

The 831-second phase used a frozen source snapshot, and final receipt/installed
byte verification passed. Raw attempts, `phase-summary.json` and
`qualified-end-gap-diagnosis.json` remain under
`/private/tmp/scroller-refactor-native-buffer-r1-20260907`. This component-fixture
recording is separate from the uninterrupted normal App.main journey above.

## Supplements awaiting runtime qualification

The newest native FOLLOW and selected-ruler changes, retained-surface focus
handling, desktop unread-center and deleted-anchor fallback corrections,
stronger semantic proof have focused-control evidence but do not yet have full
fresh runtime qualification. The accessible Send control has the separate
actual functional passes recorded above, including the new headless run.
Earlier captures and
their original verdicts remain unchanged; fresh comparable captures are required
before claiming these changes resolve the recorded failures.

## Native focused r3 and current unit run

The consolidated r6 app run has **2,285 passing assertions, three preexisting
skipped provider checks and zero failures** (115 suites, 19.452 seconds).
App TypeScript passes. The persistent Legend List patch has 64 portable
installed-dependency controls, now run by the normal CI job through
`pnpm test:scroller:dependencies`. Its unchanged-source controls retain nine
failures per native bundle. These algorithm controls do not prove runtime
causality or replace the native results below.

The native end-distance handler now publishes bottom state even when UIKit
rounds or bounces beyond the calculated end, while preserving the separate
header animation's bounce suppression. The actual hook reproduced three stale
Latest-state failures before correction; 98 related controls pass afterward.

Six fresh Release fixture cases ran on the dedicated 6DBBE7A7 simulator:
history growth, cache replacement, removal, append at end, thinking label at
end, and message-first thinking handoff at end. Total elapsed including
preparation was **866.657 seconds (14m 27s)**; wrapper inspection through final
verification was 358 seconds. App-only timing was not isolated.

- Independent sampled geometry: **three passes, one failure, two incomplete**.
  Append and both thinking cases pass. History cache replacement still fails;
  growth and removal retain invalid acquisition/action-witness gaps and their
  observed geometry issues. The library patch is not a proven fix for these
  remaining runtime jumps.
- Buffered native acquisition: **six complete**. Acquisition completeness
  does not override the semantic sampled verdicts.
- Separate fixed final 300 ms native-model Latest visibility: **six passes**,
  using captured React Native window-height thresholds and independently
  checked native ownership/surface manifests. Across the recorded samples,
  no exposed Latest surface was observed at the legal end. This does not
  qualify painted frames, fade/flicker, hit testing or all control transitions.

The explicit sampled ruler v2 uses actual reserved insets and width-aware
surfaces instead of treating the entire floating composer wrapper as occlusion.
It pins the declared scope and actual native owner, validates complete semantic
signatures, and preserves old v1 replay behavior. Invalid or overlong samples
remain in the trace. The original r2 results have not been rewritten.

Before/after source snapshot:
`9c3d54e5897edf5a27b50e227bfa6ac238e34b76f98c16fa8910cc7a2727bd72`.
Installed executable and embedded JavaScript bytes match the built artifact;
the source map also matches the exact patched native Legend entry, scroll
handler and fixture source. Evidence and independent reader copies are in
`/private/tmp/scroller-native-focused-r3-20260907`, including
`phase-summary.json`, `independent-replay.json` and
`latest-visibility-replay.json`. No source changes occurred during capture.

## Actual missing-parent loading shell after the fix

The existing missing-parent reference/Back case passes headlessly in 50.441
seconds using normal Vite flags. Both the original navigation/transport oracle
and the added loading-shell oracle pass without issues: 161 samples, maximum
gap 95.3 ms, maximum acquisition 19 ms. During the held original GET, 22 shell
samples span 304.6 ms and show the exact Thread/Loading thread text and an
enabled Back control with an unobstructed center.

Back precedes response release. The unchanged successful response contains the
parent and 18 replies, followed by a 1,221 ms quiet tail. The returned row and
interior character each have zero drift. No thread content appears before Back
and the shell does not reappear afterward. The earlier 337.3 ms blank-pane
failure is preserved as its original attempt.

The registered importer still reports incomplete at its unchanged headed-only
provenance gate. Pressing the shell's Back control, error/retry, durable read
effects and presentation remain unexecuted or unqualified by this case.
Evidence: `/private/tmp/scroller-thread-shell-product-r1-20260907`, with frozen
source/reader snapshots and a clean headless Chromium exit.

## Native history-cache correction diagnosis, r4

The single-case Release recording retains a qualified history-cache failure:
the reader moves 1392 pt. Independent sampled geometry fails; buffered native
acquisition is complete. The diagnostic hook did not change geometric
acceptance, and no invalid samples were removed.

The actual correction is MVCP transaction 43. It selects visible-size anchor
110 and requests +1391.625 pt, followed by a native +1392 pt offset change.
At that decision, the explicit target, initial target and preserved initial-end
correction are all absent. The earlier preserved-end interleaving control is a
separate demonstrated hazard, not the cause observed in this recording.

During the preceding center-position command, MVCP transaction 36 added
502.125 pt to the internal offset. At the mutation, that offset remains
10026.4375 while native offset and pending scroll are 9524.3333. The cached
visible-ID refresh uses that internal viewport and retains rows 110–114.
Native cell 110's content coordinate matches the library's position within
0.167 pt, so these offsets are in the same coordinate system. Why the earlier
adjustment failed to reconcile with the native position remains unresolved.

The optional fixture collector keeps one exact list/session across capture,
rejects out-of-bracket clocks and lossy disposal, and records the original JS
coherence predicates. It passes 60 focused controls and app TypeScript. The
temporary dependency observation patch passes 48 controls per native bundle.
Neither diagnostic stream can turn geometric evidence into a pass.

Preparation timer through final verification: **18m 34s**. Wrapper inspection
through final verification: **5m 08s**. App-only duration was not isolated.
The first collector call was denied CoreSimulator access by the sandbox; its
log is preserved. Reading the same completed recording with the required
access succeeded without rerunning the scenario.

Evidence: `/private/tmp/scroller-native-correction-r4-20260907`. Exact source
snapshot: `1276b5e9a2e7a806b1bd7a0fc550cc92eb16a63d13dc9acb0729697105a83bda`.
Before/after installed executable and embedded JavaScript match the build.
The source map verifies the actual instrumented library and fixture sources.
This remains component-fixture/native-model evidence, without painted-frame
or actual-app transport qualification.

The independent diagnostic inspection validates all 60 records and coverage
through the actual center command and original quiet tail. Its first reader
required a preparation marker omitted by the fixture's event slicing and is
retained as incomplete. A separate source-bound reader uses the recorded native
center primitive and reports complete attribution coverage; it makes no claim
that the requested center landing itself was correct. Both readers and outputs
are preserved. The temporary dependency hook was then reversed exactly, leaving
the persistent visible-ID patch in place; its 64 controls pass after restoration.
The simulator retains the recorded diagnostic binary and must be rebuilt for a
new source qualification.

## Native explicit center-command baseline, r5

Preparation through final verification: **11m 19s**. Wrapper inspection through
final verification: **6m 53s**. App-only elapsed time was not isolated; the native
recording spans 2,836 ms.

The new standalone `command-center` case fails before any later content
mutation. It starts at the actual legal end, issues one public PostList request
for message 111 after 26.7 ms, and records a **498.0002 pt** center error with the
target reading point outside the viewport. The final fixed second contains 62
samples showing the same wrong landing. All 166 sampled brackets are valid;
maximum acquisition is 31.949 ms and maximum gap is 92.690 ms. The 32/125 ms
budgets are unchanged.

Independent native geometry replay reports failure. Buffered acquisition is
complete with 170 frames, no concealed frames and maximum operation 4.653 ms.
The first buffered reader lacked the new scenario's predeclared 2,800 ms
duration and is preserved as incomplete. Adding that exact duration to its
allowlist qualifies the unchanged raw recording; no thresholds changed.

The fixed target, exact arguments, unchanged sampled data, native owner and
1,800/2,800 ms deadline are checked independently of the producer's verdict.
Review also caught and fixed a harness gap: a successfully issued command that
never moves must fail its landing, not be dismissed as an unobserved action.
The three focused contract/replay files pass 158 controls after the reader
addition. App TypeScript passed before the native capture.

Evidence: `/private/tmp/scroller-native-center-command-r5-20260907`, including
`phase-summary.json`, `independent-replay.json` and `native-buffer-replay-r2.json`.
Source snapshot: `778c2bbcb8beae7349f61314488c66627ac67c7fb370d4a2d441f7447a924f93`.
The installed native executable and embedded JavaScript match before and after
capture. The source map binds the new fixture and contract to the installed
bundle. Both the completion repair and the temporary diagnostic hook remain
unapplied. The persistent visible-ID patch remains installed.

This is a production-component fixture and native-model landing regression.
It does not qualify actual-app transport, presented frames or gesture behavior.
Completion/recovery repairs are prepared separately and still require app
failure handling and a native recapture before this bug can be called fixed.

## App command recovery and message identity

The app now retains pending content behind its existing entry surface when an
owned native command rejects with `LEGEND_SCROLL_UNALIGNED`. It presents a
scoped Try again action, does not signal successful readiness, and does not
automatically repeat the dependency's already exhausted command. Covered or
replaced routes cannot invoke an old retry. Already revealed content remains
visible after failure.

iOS post navigation now passes the current message item through the existing
`scrollToItem` API. Initial selected/unread corrections and explicit retries
resolve the committed message ID again before dispatch. Missing targets reject
instead of silently completing on no item. Numeric start/end operations and
Android positioning retain their existing dispatch paths.

The applied checkout passes 107 focused ownership/recovery/component controls.
The subsequent full r7 app run passes **2,350 assertions with three preexisting
provider-key skips**, across 116 test files, and app TypeScript passes. Evidence:
`/private/tmp/scroller-applied-keyed-app-controls-20260907.json` and
`/private/tmp/scroller-refactor-app-tests-r7-20260907.json`.

This is app-boundary validation. The dependency completion/recovery/keyed-target
repair still awaits integration and actual native capture. Independent review
found two additional production render paths the first proposal did not cover:
default key-extractor normalization and a new array containing the same item
objects without a position rebuild. Their source regressions must pass before
that proposal qualifies for integration. The R5 landing failure remains open.

The corrected R2 proposal subsequently passes independent review and is now
integrated. All four installed dependency suites pass: 64 visible-ID controls,
56 indexed-completion controls, 36 native-recovery controls and 74 keyed-target
controls, totaling **230** across CJS and ESM. The generated versioned patch
reconstructs the exact independently reviewed bytes from pristine package
content; lockfile changes from patch generation are limited to its hash.
Evidence: `/private/tmp/scroller-native-command-integration-20260907`, including
`integrated.json` and `installed-controls.log`. Patch SHA-256:
`57a8432b2654c1413906dd1c6d9badc30a559251af4def112e4dc3ea874b6e15`.
Actual R6 capture is still required before qualifying the native fix.

## Integrated native command repair, r6

Preparation through final verification: **16m 45s**. Wrapper inspection through
final verification: **8m 56s**. App-only elapsed time was not isolated. The
verified Release fixture uses snapshot
`3f16f36c8fcb8b17d3f43a4d5e0b82d83eb2c3e389b72ae9528d1e114c2f86c7`.
Its executable and embedded JavaScript match before and after capture; the
source map verifies the exact dependency, app command boundary and fixture.

The first center-command recording is incomplete because its baseline bracket
takes 46.253 ms, exceeding the unchanged 32 ms limit. It remains preserved.
After the six-case core run, the fixture was reset through its existing UI and
one fresh center-command recording was taken without rebuilding or changing
source. That repeat is a qualified **3.999837 pt landing failure**: all 168
brackets are valid, maximum acquisition is 12.970 ms, maximum gap is 67.501 ms,
and buffered acquisition is complete with 171 native samples. The original
498 pt landing error is reduced but the requested inner-message center still
does not meet the 1 pt criterion.

The same native walk identifies the remaining mismatch. Message 111 and its
indexed cell share a top coordinate, but their heights are 121.666992 and
129.666992 pt. The cell center is within 0.000163 pt of the viewport center;
the message center is 3.999837 pt above it. The 8 pt trailing post-block
separator is included in the library's cell alignment. A general app geometry
correction must account for variable leading/trailing row UI rather than adding
a constant offset for this fixture. The separately declared initial-entry
cell-alignment policy remains distinct from this public message command.

Independent replay of the six core cases yields **four sampled passes and two
incomplete cases**. History-cache now preserves message 111 within 0.333008 pt,
where R4 recorded a 1392 pt jump. Append-end, thinking-label-end and
thinking-handoff-message-first-end also pass. History-grow has a native buffer
coverage gap as well as invalid sampled acquisition; history-remove retains
invalid sampled acquisition while buffered acquisition is complete. These two
cases do not qualify as passes, and their timing gaps require investigation.

Evidence: `/private/tmp/scroller-native-command-repair-r6-20260907`, containing
the original and repeated center traces, six core traces, independent replay,
source/reader snapshots and `phase-summary.json`. Final screenshot:
`/var/folders/vc/ldtn6s4n57ld52x764q0tcm80000gn/T/simserver-TfchJn/media/557756000-1788802501578.png`.
The scoped Argent services and local image server were stopped after capture.
This remains production-component fixture and native-model evidence. It does
not qualify actual-app transport, gesture cancellation or displayed frames.

A bounded timing review distinguishes the two incomplete core captures.
Growth contains a 137.793 ms gap between native display-link captures while
the surrounding capture bodies take less than 1 ms. A concurrent JavaScript
request waits about 137 ms before main-queue capture begins. This demonstrates
delayed native callback service during the mutation, requiring stack/run-loop
attribution rather than another unchanged attempt to obtain a passing trace.
Removal maintains native cadence within 18.277 ms; its slow JavaScript bracket
spends about 47 ms between native completion and JavaScript receipt. Continuous
native samples still record a 38 pt anchor shift. These diagnostics do not
retroactively qualify the incomplete geometric replay or establish which
frames were displayed.

The subsequent bounded profiling attempt took **22m 51s** from preparation to
artifact verification and cleanup; app-only timing was not isolated. It produced
no usable stack evidence. Argent's saved trace failed export with “Document
Missing Template”; the built-in Time Profiler plus Thread State Trace attempt
stalled while attaching to the exact simulator app process. Its 40-second
recording limit never completed. The verified recorder was interrupted, then
terminated after it remained live; its session exited and its PID was confirmed
absent. Both partial traces and workload captures are preserved. Neither capture
qualifies the growth/removal behavior or attributes the delay to application
CPU, blocking, scheduling, or measurement overhead.

The wrapper and embedded-source check still matched the original R6 executable
and JavaScript after the attempt. The two reports temporarily restored to reuse
that exact snapshot were restored to their latest verified bytes before further
work. Evidence and cleanup record:
`/private/tmp/scroller-native-mutation-profile-r6-20260907/closure.json`.

## Current dynamic native target integration

The optional current-geometry resolver is integrated into the pinned native
dependency and its declaration. Review reproduced two defects in the first
unapplied proposal: an old layout pass could clear a newer command's pinned
range, and a callback rebuilding data could dispatch using the old index,
landing 120 pt away from the requested key. Both original failures are retained.
The corrected proposal passed independent re-review before integration.

All four suites against the actual installed native bundles now pass **280
controls**: 64 visible-ID, 56 indexed-completion, 36 recovery and 124 keyed-target
assertions. Native event delivery remains modeled. The generated package patch
reconstructs the exact reviewed CJS, ESM and declaration bytes; patch generation
changed only the patch hash in the lockfile. Evidence:
`/private/tmp/scroller-dynamic-offset-integration-20260907/installed.json` and
`installed-controls.log`. Patch SHA-256:
`bdf43bc4504ce1808df0d486879cea628c38e4b117a691ac462abfead0b570ed`.

The app measurement correction remains separate and unapplied at this point.
Review found mixed old/new geometry when decoration is removed, plus the need
to match the dependency's exact eighth-point size normalization. The R6 4 pt
message landing failure remains open until that app repair and native recapture.

The existing actual-app desktop thread-return scenario was rerun on current
source in headless Chromium with normal flags, one worker and zero retries. It
still fails by **6.5 px** after the parent gains its 24 px reply footer. The
unchanged independent reader confirms the failure; source and reader snapshots
match. Its 15 baseline samples and 64 returned samples satisfy the existing
acquisition checks. Runtime: 56.988 seconds including test hooks. This is
before/after sampled geometry, not continuous navigation or displayed-frame
proof. Evidence: `/private/tmp/scroller-thread-return-product-r2-20260907`.

## R7 integrated message geometry and native recapture

Preparation through final artifact verification took **40m 59.7s**; wrapper
inspection through verification took **25m 34s**. App-only timing was not
isolated. This includes preparation, build, dispatch and collection work, not
only time spent exercising the app.

The independently reviewed R3 app proposal is applied exactly across eleven
files. The full app run passes **2,393 assertions**, with the same three existing
provider-key skips and no failures (118 test files); TypeScript exits zero.
Frozen proposal and integration evidence are in
`/private/tmp/scroller-post-decoration-app-r3-20260907` and
`/private/tmp/scroller-post-decoration-app-integration-20260907`.

The Release fixture was built and installed through the wrapper on
`6DBBE7A7-F11A-4133-8B20-25A39B4B980C`, snapshot
`8b189645433a4aa53f0187358000f5243e13c14d6c527277a223a976dfa7f620`.
The installed executable and embedded bundle match the artifact before and
after capture. Sixteen source/patch checks include the actual ScrollerItem,
decoration registry and native host-measurement hook. Final executable SHA is
`a940d324fddbc05bca6b395c46241812c3fef5c4937ae9173b56f2c2b66b5320`;
bundle SHA is `1171c48b88eebc4a1637628c99293a4c3138d697d62f2e271f2b4d4e44122ceb`.

Both unchanged command-center attempts are independently **INCOMPLETE** because
their JS/native measurement brackets lose coverage, despite complete native
buffer acquisition. The repeat's final landing error is **0.00048828125 pt**,
but it also contains a valid 22.221 ms bracket with zero visible measured rows.
The native buffer independently records six frames over 95.027 ms with offset
**-9,990,479.666667 pt**, outside the legal range, and no exposed measured rows.
That transient cannot be erased by the correct final landing. The -10-million
list placement sentinel is a source lead, not yet a proven causal attribution.
These are native model measurements, not UIKit presented-frame proof.

The first dispatch used Argent; subsequent predeclared captures used explicit
`simctl openurl` because Argent cannot suppress its automatic screenshot and
accessibility read during the measurement window. No source, artifact, request
deadline, landing tolerance or sampling budget changed between attempts. The
first attempt remains preserved; no claim attributes its gaps to Argent.

The same six R6 core cases now independently qualify **two sampled passes and
four incomplete results**. History-cache and thinking handoff pass. Growth,
removal, append and thinking-label captures remain incomplete. Native buffer
acquisition separately reports five complete and one incomplete. The selected
and delayed entry supplements are both incomplete: selected loses reveal/tail
coverage; delayed retains native acquisition but its historical V1 inner/cell
ruler rejects fractional inner overflow. Neither entry is relabeled as a pass.

Separate actual-source controls reproduce a new dynamic-target acquisition
failure: an unmounted target (including one with a cached cell size) never gets
a render request while the command waits for its decoration measurement. Both
installed bundles reject after 800 ms without dispatching. The original corpus
records four passes/two failures per bundle; a command-owned render-acquisition
repair is being reviewed. This must be closed before accepting the targeting
change. Evidence: `/private/tmp/scroller-offscreen-dynamic-acquisition-20260907`.

R7 raw reports, independent readers, exact artifact verification, timing,
transient-offset diagnosis and final screenshot are retained in
`/private/tmp/scroller-native-message-geometry-r7-20260907`. The image gate and
Argent services owned by this capture were stopped. App r8 raw output is
`/private/tmp/scroller-refactor-app-tests-r8-20260907.json`. Native READ,
offscreen targeting, transient command behavior, presentation and broader
qualification remain open; the existing R6 and web failures are unchanged.

## Focused integration after R7

The reviewed offscreen target fix is installed in both Legend native bundles.
It renders the command's exact target before waiting for inner-message geometry,
without scrolling during acquisition. The five installed dependency suites pass
322 controls, including 42 acquisition regressions. Evidence is retained in
`/private/tmp/scroller-offscreen-dynamic-integration-20260907`.

The actual Back hook now returns to an immediately preceding same-channel route
without replacing its reading position with a selected-post centering request.
The imported hook and installed router controls change from seven passes/six
failures to thirteen passes. Full app r9 passes 2,406 assertions with the same
three existing skips; TypeScript exits zero. The subsequent real desktop attempt
fails before Home becomes available (95.073 seconds total), so independent replay
is incomplete and the earlier 6.5 px product failure remains open. Evidence:
`/private/tmp/scroller-thread-return-integration-20260907` and
`/private/tmp/scroller-thread-return-product-r3-20260907`.

The R7 negative-offset source lead has been narrowed: the plausible stale native
anchor belongs to Legend's positive ten-million-point ScrollAdjust placement,
not its negative offscreen-row sentinel. Actual RN preparation/adjustment bodies
reproduce disabled-to-enabled and missing-anchor failures. A reviewed one-use
preparation guard changes the host controls from four passes/thirteen failures
to seventeen passes. The private prior frame remains inferred; these controls
do not establish attribution of the captured UIKit writer or native runtime
qualification. Evidence: `/private/tmp/scroller-native-stale-mvcp-20260907`.

Iteration now follows the [focused/batched workflow](scroller-test-execution.md#fast-iteration-without-changing-acceptance):
targeted controls per edit, one product capture sequence per related batch, and
full regression/Release checks at milestones. R7's approximately 3m43s
build/install interval and 14m42s prelaunch gap show that orchestration is the
immediate bottleneck. No acceptance or historical verdict changed.

## R8 native batch and recovered desktop thread return

The unchanged real-conversation desktop thread-return test now passes in
30.6 seconds. Independent replay reports zero return drift: the same post stays
at 167.7109375 CSS px relative to its viewport through 64 returned samples over
1,027.1 ms, while its reply footer increases row height from 52.203125 to
76.203125 px. Source and reader snapshots match. Chromium ran headless with
normal application flags and closed normally. The earlier 6.5 px failure and
Home setup failures remain preserved. Startup recovery restarted only the owned
stale Vite resolver; the test, timeout, source, authentication and oracle were
unchanged. A peer's 164 ms Node import attempt overlapped the overall run, so
this does not claim exclusive CPU. Evidence:
`/private/tmp/scroller-thread-return-product-r4-20260907/independent.json` and
`contention-note.json`. This qualifies before/after sampled geometry, not the
continuous navigation transition or presented frames.

Native R8 compiled the installed stale-MVCP guard and bundled the offscreen
target acquisition repair. Build/install took **33m 04s**, including **18m
42.056s** of Metro bundling. Build-end-to-launch was 19 seconds; launch through
first capture took 119.6 seconds; all nine captures took **46.6 seconds**.
Inspection through final verification took 36m 16s, and preparation through
verification took **62m 52.8s**. App-only timing was not isolated. Batching
shortened orchestration, but the much slower build means this run did not
improve overall iteration time.

The explicit simulator remains `6DBBE7A7-F11A-4133-8B20-25A39B4B980C`. The
wrapper and embedded-source checks matched before and after capture at snapshot
`47079e571efb24a36afcb3dff8b67b1fdcf6b35b6282f96ec278d5ec863288ee`;
executable SHA is
`3722ff790ad63fe9ff193c99f1e163dd0c65c7b43c053fe29aa80993e37e7543`,
and bundle SHA is
`af786015bd09db7fd787b9db9e7a0cdb31f2877d72a771a6ee28fff7833171c4`.
The build log records compilation of the actual patched RN scroll view source.
The owned image gate and Argent services were stopped after capture.

The initial independent replay could not import an extensionless TypeScript
helper under Node 22, although Vitest resolved it. Consolidating the center and
offscreen helpers into `scrollNativeTargetCommand.ts` preserved their bodies
exactly and repaired the CLI boundary. A fresh Node subprocess control now
checks actual replay without Vitest loaders; all **123 focused controls** pass.
The import failure and body-preservation receipt remain at
`/private/tmp/scroller-native-replay-packaging-20260907`.

Replaying the unchanged nine raw captures then reports **five sampled passes
and four incomplete results**: repeated center, append, cache, thinking-label
and thinking handoff pass. Original center, offscreen, growth and removal remain
incomplete under that reader. Native buffer acquisition separately reports
seven complete and two incomplete recordings. These are production-component
fixture and native-model results; actual-account transport, native READ,
continuous gesture behavior, presented frames and broader qualification remain
open. Raw captures, both replay attempts, selection, acceptance, timing,
artifact receipts and the final screenshot are retained at
`/private/tmp/scroller-native-batch-r8-20260907`.

The portable RN host controls now have a filtered macOS CI job included in
`CI OK`, without a simulator, Pods or app build. Local validation passes all
17 healthy controls; a deliberate compiler error remains exit 1 and preserves
the compiler output and exact extracted methods before scratch cleanup. Path
filter and merge-gate checks pass. This is local validation of CI wiring, not
a hosted CI run. Evidence:
`/private/tmp/scroller-rn-mvcp-ci-validation-20260907/validation-receipt.json`.

The installed Expo parser also confirms that the proposed next-build override
sets cache reset off and workers to two while preserving every other resolved
Release option. Cache retention remains conditional on unchanged external
transform inputs; no speed improvement is claimed before measuring that build.

The separate recording reader initially omitted `command-offscreen` from its
2,800 ms duration dispatch. Its ordinary direct-Node control records 58
passes/one failure before that single-branch correction and 59 passes afterward,
including rejection of wrong minimum duration and buffer capacity. A separate
`independent-replay-r3.json` preserves both assessments and the corrected reader
hash. Acquisition becomes **eight complete/one incomplete**; product geometry
stays **five sampled passes/four incomplete**. No raw capture, duration or
tolerance changed.

The bounded R8/R7 diagnosis retains important unresolved native observations.
Repeated center no longer records R7's six extreme illegal offsets or six
zero-exposed-row observations and finishes within 0.000163 pt. Original center
still has one zero-exposed-row observation and insufficient acquisition.
Offscreen acquires the specified unmounted target and eventually centers within
0.000061 pt, but one native frame exceeds the legal range by **59.333 pt**, and
two expose no measured rows. Removal again shifts the reading post by **38 pt**.
The incomplete captures remain incomplete; these native model observations
justify targeted repairs and do not establish which frames were displayed.
Exact indices, clocks, trace hashes and scope are recorded in R8's
`diagnostic-handoff.md` and `derived-diagnostic.json`.

## Focused desktop composer, incoming-message and thinking batch

Seven existing normal-flag headless cases ran in **248 seconds** with one
worker and zero retries. Runtime results are five passes/two failures;
independent replay qualifies **five sampled passes, one failure and one
incomplete case**. Source, readers and recipe match before and after the batch.
The owned ten frontend's stale resolver was caught and restarted during
preflight, before any product attempts were consumed.

All three composer geometry traces pass: both latest variants maintain a
zero-pixel end gap, including a 77 px viewport shrink and restoration, and the
history variant retains its reading anchor with zero measured drift. The exact
draft case remains an input failure under its original contract: during the
clear dispatch, Playwright selects the 70-character draft before pressing
Delete. A captured `0..70` selection precedes the clear input event while the
declared grown phase still requires `70..70`. Installed Playwright source
confirms that prelude. This supports a test phase mismatch, not unsolicited app
selection loss; retain the original failure while adding an explicit selection
action/phase and controls. Caret geometry remains unmeasured.

Remote append at latest passes geometry and exact semantic checks, with at most
a 0.5 px end gap. Both thinking show/clear/reply-handoff cases pass geometry and
semantics, with zero latest gap/history drift. Remote append in history remains
incomplete: one 106.2 ms geometry interval and corresponding 104.6 ms semantic
interval exceed the unchanged 100 ms limit. Its semantic measurement takes
2.9 ms and otherwise remains valid; observed reading drift is zero. Neither
missing coverage nor the good samples justify a pass or prove semantic damage.

Evidence: `/private/tmp/scroller-web-composer-semantic-seven-r1-20260907`,
including `raw.json`, `independent.json`, `failure-boundaries.json`, source and
reader snapshots, exact selection and retained preflight failure. This batch
does not qualify caret/IME, presented frames, other browsers, soak or current
production bundle bytes.


## Explicit selection and remote-history follow-up

The bounded input correction passes **93 controls** and scoped TypeScript.
It predeclares real keyboard select-all and Delete, with exact selection phases,
trusted scoped delivery, focus, draft, hit-target, acknowledgement and quiet-tail
requirements. Wrong, unsolicited, late and out-of-scope selections remain
rejected. Independent replay of the original seven-case raw still reports its
original selection failure; no old evidence or thresholds changed. Control and
source receipts: `/private/tmp/scroller-input-select-all-20260907`.

One headless plain-textarea calibration passes, including native keyboard event
binding and a 10.8 ms maximum acknowledgement. It is excluded from product
counts. Its runner took 4.5 seconds; two subsequent normal-flag product cases
ran with one worker and zero retries in **61.4 seconds**, both passing:

- Exact draft growth/clear at latest: 116 geometry samples, **0 px** maximum end
  gap, 23.7 ms maximum interval, viewport 699 → 622 → 699 px. Independent input
  binding and semantics pass. The full shared result remains **incomplete solely
  for unmeasured caret geometry**.
- Remote append burst in history: **sampled pass**, exact semantic checks pass,
  358 geometry samples, **0 px** reading drift and a 76.8 ms maximum interval.
  This new adequate capture leaves the older interval-incomplete attempt intact.

Source, independent readers and recipe match before and after. The initial
empty selection and a temporary replay-script enum mismatch are preserved as
orchestration errors; neither consumed an extra product attempt. The gap between
calibration and product execution includes that replay correction, not app
runtime. Artifacts: `/private/tmp/scroller-input-remote-r1-20260907`, including
separate `calibration` and `product` raw/independent reports, launch-mode receipts,
source snapshots and timing. Product raw SHA-256:
`4246aa71758f7c9b5cdb3c355d86783dd4446b562c6a98697c8229673fa1ee31`.
These runs do not qualify caret/IME, presented frames, broader browser coverage,
soak or current delivered production bundle bytes.

## Portable native READ and text host controls

The installed RN sources pass **98 portable host controls**: 45 READ seam,
36 TextKit and 17 generic MVCP. The READ and text runners preserve the existing
case names and exact extracted method/helper bodies. An intentional compiler
error returns an error and retains compiler diagnostics and generated inputs.
Installed source hashes remain unchanged. Package commands and the existing
filtered macOS CI job now include these runners; local wiring checks pass,
while hosted CI remains unexecuted.

These controls use modeled UIKit/mount/native-delivery boundaries and host
AppKit TextKit. Paragraph integration is source-checked. They do not establish
UIKit/Fabric execution, app provider registration, complete READ behavior or
presented frames. Receipts: `/private/tmp/scroller-portable-rn-reading-20260907`.

## Textarea caret CDP feasibility

Eight isolated headless Chromium **136.0.7103.25** cases inspect the actual
textarea user-agent editing subtree and its real Selection Range through CDP.
Six nonempty positions return caret geometry, including multiline, emoji and
scrolled text; clipped rectangles do not prove caret exposure. No mirror
textarea, inferred font metrics or invented caret box is used.

Empty input and a trailing newline return no Range rectangle. Inside `a😀b`,
textarea UTF-16 selection offset 2 maps to internal visual offset 3; a collector
cannot silently treat those as identical. Protocol tree traversal also omits
newline-only text nodes that the resolved DOM contains. These limits leave the
empty/grow/clear caret gate open. There is no production collector or product
recapture, and no cadence, paint or cross-browser qualification.

Both calibration browsers closed normally. Raw protocol requests/results,
eight-case state, installed protocol excerpts and hashes are retained at
`/private/tmp/scroller-textarea-cdp-calibration-20260907` (`cases.json`,
`cases-protocol.json`, `handoff.json`).

## R9b integrated native batch

The successful prepared pipeline took **380 seconds**, including **299 seconds**
for build/install. Build-end-to-launch was 2 seconds; launch-end-to-first-capture
was 20.5968 seconds; the same nine selected captures took **45.058 seconds**.
Including the preserved R9 build failure, one-line Objective-C declaration fix
and R9b retry, elapsed time was **805 seconds**. App-only timing is not isolated:
capture intervals include dispatch and collection. R8's corresponding pipeline
took 2,176 seconds, with 1,984 seconds for build/install and 46.637 seconds for
captures. This is not a controlled same-source benchmark or evidence assigning
the improvement to a particular optimization.

All **nine native buffer acquisitions are complete**. Independent geometry
qualifies **five sampled passes, three incomplete cases and one failure**:

- Repeated center, history cache, append at end, thinking label and thinking
  reply handoff pass their sampled geometry checks.
- Original center, history growth and removal remain incomplete under their
  coherent-acquisition requirements. The separate acquisition-reader pass does
  not override those geometry verdicts.
- Offscreen command fails with a sample gap and blank-viewport observations.

Native ownership diagnostics show `resident=true` and `admitted=false` in every
sampled state across all nine recordings; history cases retain pending admission.
These observations do not determine whether a provisional candidate existed
earlier within a mount transaction. Registration presence does not establish
READ admission or complete READ behavior. No full-suite or presented-frame claim
is made; prior failures and incomplete attempts remain preserved.

The integrated source checks separately pass **495 controls** (87 RN READ and
408 Legend), plus **17 generic RN MVCP controls**. These host/source checks do
not replace native runtime acceptance. Receipts:
`/private/tmp/scroller-native-tagged-integration-20260907`.

Separate iOS SDK checks pass seven native translation-unit syntax checks and
typechecking for two Swift source files. Their scope is compilation only;
receipts are `/private/tmp/scroller-native-r9-all-syntax-20260907/receipt.json`
and `/private/tmp/scroller-read-provider-controls-20260907/swift-current-typecheck-1/receipt.json`.

Timing, raw traces, source/build verification, `independent-replay.json` and
`native-reading-diagnostic.json` are retained in
`/private/tmp/scroller-native-batch-r9b-20260907`. Its `timings.json` records the
exact intervals, and `retry-preparation.json` identifies the preserved failed
R9 build and copied recipe inputs. Original failure artifacts remain in
`/private/tmp/scroller-native-batch-r9-20260907`.

## R10 native acquisition and provider diagnostics

The complete prepared pipeline took **200 seconds**, with **125 seconds** for
build/install, 1 second for launch, 15 seconds for readiness and **43.194 seconds**
for the same nine captures. No retry occurred. App-only timing is not isolated.
This is a different source/build state from R9b's 380-second cycle, not a
controlled benchmark. Both retained Metro cache reset and two workers; R10
compiled the changed provider and verified exact unchanged native objects.

All **nine buffer acquisitions are complete**. Independent geometry reports
**five sampled passes, three incomplete cases and one failure**:

- Offscreen, history cache, append, thinking label and thinking handoff pass the
  existing sampled checks.
- Original center, history growth and removal remain incomplete for coherent
  acquisition; a complete native buffer does not override that requirement.
- Repeated center fails wrong-landing and target-occluded checks through its tail.

The offscreen repair removes R9b's 13 blank native observations spanning
199.816 ms: R10 has zero blank observations. The final target residual remains
approximately -0.000061 pt. However, native offset first changes from 10,487.333
to 998.667 and then to 1,658, 66.612 ms later. The existing landing oracle passes
this trajectory, so that pass does not establish a jump-free command. This
specific oracle gap and the repeated-center failure require regression controls
and repair. Prior raw failures remain unchanged.

The subsequently strengthened importer adds alignment from first observed
nonanimated movement, using the same 1 pt limit. Six durable controls bring its
existing runner to 86 passing checks. Separately replaying all nine unchanged
R10 traces now gives **four sampled passes, two failures and three incomplete
cases**, without exceptions; only offscreen changes to trajectory FAIL. This
supplement preserves the original five-pass report and its reader hash.

Cached provider diagnostics appear in all **1,251 native samples**. Every sample
reports one registered scope, zero rows, zero inner content, no eligible
candidate and no admission attempt. Source review identified the installed
Tamagui production native optimization bypassing custom `render` carriers;
its test-mode path skips that optimization. This affects the production component
path and requires native recapture after repair. Registration or geometry passes
do not qualify READ preservation.

The installed Legend suite separately passes **438 controls**, including the
30 new acquisition-position controls. The provider diagnostics pass 19 capture
and 23 registry controls plus an actual iOS SDK syntax check. These controls
do not replace native rendering or presentation evidence.

R10 source snapshot: `920ae018bd2e360a9d27155db44ddb11ed1ef7c0beeef1c2dd0a6ab392ec94c3`.
Verified bundle: `0851e04798e89cc28158187d6d99c6d024acf504ce6271d429210cdabf034d09`.
Raw, replay, timings and provider observations:
`/private/tmp/scroller-native-batch-r10-20260907`.
Exact prior/current offscreen comparison:
`/private/tmp/scroller-r9b-r10-offscreen-comparison-20260907/comparison.json`.

Before R11, the app provider's three existing control runners are connected to
the filtered macOS CI job through `test:scroller:native-read-provider`. All 94
checks pass locally; hosted CI has not run. The carrier fix uses explicit native
children through Tamagui Slot, with the production-path consumer reproducer
changing from 5 pass / 18 fail to 25 pass. Its separate metadata checks pass 23.
The combined installed Legend suite now passes 446 checks; 89 affected app
component checks and the app TypeScript check pass. Runtime qualification of
these R11 candidate changes remains pending.

## R11 native batch and remaining presentation/performance defects

The prepared build/install/readiness/capture/replay cycle took **214 seconds**:
136 seconds for build/install, 2 seconds for launch, 17 seconds for readiness,
and 43.607 seconds for nine captures. No retry occurred. App-only timing is not
isolated. The stronger fixed-command trajectory reader ran in this batch;
these distinct source states are not a controlled timing benchmark.

Independent geometry reports **five sampled passes and four incomplete cases**.
Repeated center, history cache, append, thinking label and thinking handoff pass.
First center, history growth, history removal and offscreen remain incomplete.
Native buffer acquisition separately reports **eight complete and one incomplete**;
offscreen has the incomplete buffer. These counts are not overall UX qualification.

Native READ now has actual row and inner registrations. All 332 history frames
report current RN admission and READ ownership, with aligned/adjust decisions.
All 401 FOLLOW frames retain unadmitted legacy ownership. The provider's cached
last admission reason is historical; it must not override RN's current state.
Repeated center lands within approximately 0.000163 pt and passes the stronger
reader. This supports the combined repairs but does not isolate the cause of
R10's failure or qualify the entire READ matrix.

Offscreen records native callback gaps of **224.132 and 358.612 ms** before its
first observed correct destination. The measured capture operations themselves
take about 0.9 ms. Recorded frames have no blank viewport; the missing frames
remain unknown. The observed first destination is centered, followed by a
0.333 pt adjustment, but neither correct observation can establish the trajectory
inside those gaps. First center has five JS/native brackets over 32 ms. Growth
and removal each straddle an actual mutation in an over-budget bracket; those
cases retain complete native acquisition separately.

A separate same-key comparison exposes a **visual regression**: unchanged text
message 111 shrinks from 121.666 pt to 97.667 pt at the same 386 pt width. Other
text rows similarly lose about 24 pt; image row 117 remains unchanged. Installed
Tamagui `asChild` processing drops styled defaults, including the text wrapper's
12 pt top/bottom padding. Earlier carrier controls covered optimization and Slot
but omitted this style-processing step. The style repair and regression control
must precede qualification; the five geometry passes do not excuse this change.

R11 snapshot: `2640dc65ac572b033d53ff10d398b05727c98a8628babdefc0d7138b9c50a8b7`.
Verified bundle: `eff1de3bcaadc3282130f3da657b36d3f8b8fa5f7456664508a321ab80d38093`.
Run evidence: `/private/tmp/scroller-native-batch-r11-20260907`.
Gap diagnosis: `/private/tmp/scroller-r11-acquisition-gap-diagnosis-20260907`.
Same-key layout comparison: `/private/tmp/scroller-carrier-layout-comparison-r10-r11-20260907`.
The separate native-profile attempt at
`/private/tmp/scroller-r11-offscreen-profile-20260908` uses verified R11 source
and installed bytes. It is diagnostic evidence under instrumentation, not a
qualification retry.

The profile exported successfully and records two app-owned main-thread hangs
in the session containing the offscreen action, **271 ms and 300 ms**. Their sampled stacks include provider
exposure/candidate acquisition and repeated TextKit storage/layout construction.
This supports a focused optimization of repeated work within one synchronous
candidate query; it does not justify skipping ownership, visibility or
pre-mutation capture checks. Inclusive Reanimated stack time includes these
descendant calls and is not isolated Reanimated cost. Recording also includes
idle time before dispatch; aggregate CPU percentages are not action-only.
The raw trace and report are under
`/var/folders/vc/ldtn6s4n57ld52x764q0tcm80000gn/T/argent-profiler-cwd/native-profiler-20260908-001036*`;
the profile-attempt directory retains the two detailed hang queries and exact
source/artifact verification. The scoped profiler service was stopped after
export. A later profile must repeat this scenario and retain its own timing and
source receipt separately from uninstrumented qualification.

The later raw-process audit confirms both R11 hangs belong to Landscape-preview
PID 70195. Exact overlap with the dispatch interval is unestablished because an
absolute trace-start mapping was not retained; do not infer it from the filename.

Before R12, the carrier repair preserves the original styled frame configuration
and supplies RN press handling on the same physical native view. The installed
style-filter/responder consumer checks pass 33 cases, with 23 metadata cases;
scoped TypeScript also passes. Earlier style and responder failures remain in
`/private/tmp/scroller-native-carrier-style-defaults-20260907`. Native dimensions
and actual touch delivery still require runtime verification.

The TextKit repair reuses one independent layout only within a synchronous
candidate query. Physical owner, revision, state, manager, frame, attributed
source and paragraph attributes guard reuse; changes retire the query. The
existing durable text-reading command passes 57 installed-source checks,
including preserved original performance failures and reentrant changes. All
94 provider controls and four edited native translation-unit SDK checks pass.
This does not establish a runtime speed improvement. Integration receipt:
`/private/tmp/scroller-native-query-integration-20260908/installed.json`.

## R12 verified checkpoint

The successful pipeline took **349 seconds** (251 build/install, 30 readiness,
44.375 nine captures); including one preserved prebuild sandbox inspection
failure, elapsed time was **457 seconds**. There were zero product retries.
Source, embedded bytes, current native compilation or verified unchanged native
objects, and installed artifact checks passed. Independent results remain
**three sampled passes and six incomplete**, with **eight complete native
acquisitions and one incomplete**. No presentation qualification is inferred.

Same-key text/content signatures and widths match R10; nine shared row heights
match within 0.334 pt. The approximately 24 pt loss from R11 is restored.
Actual READ admission is present in all 334 history frames, while all 401
FOLLOW frames retain unadmitted legacy ownership. Repeated center and offscreen
first observed movement center their targets. First center, however, records
a 502 pt wrong intermediate stop for about 37 ms before correcting. Its original
INCOMPLETE remains, alongside this explicit observed defect. Offscreen retains
140.199/196.175 ms native gaps; missing intervals remain unknown. Five other
cases have over-budget JS/native brackets, including two that straddle expected
content/removal mutations. Raw results and all older attempts remain unchanged.

The repeat profile's CPU export failed with Xcode dylib-overlap errors. Its sole
314.974 ms exported hang belongs to **SpringBoard PID 70593**, not Tlon. The
generated summary omits that process distinction and reports an empty export
error object, contradicted by the retained stop response. Neither that row nor
absence of another row establishes Tlon performance improvement. Raw process
ownership and limitations are preserved in
`/private/tmp/scroller-r12-profile-hang-review-20260908/report.json`.

Four separate native functional checks pass: image tap/return, ancestor native
long-press menu canceling the image tap, image-origin scroll canceling the tap,
and a final tap/return. They use a local 1x1 image through the production carrier
and a fixture destination. They do not cover the normal app viewer, the inner
long-press callback, or continuous presentation. The media setup's own geometry
INCOMPLETE (407.7 pt) remains unchanged. The touch check took 504 seconds through
final verification, with 114.927 seconds in the requested sequence; no retries.
Evidence: `/private/tmp/scroller-native-r12-touch-20260908/summary.json`.
Scoped Argent services were stopped after final verification.

R12 snapshot: `7ad3287dddc07601f3dc5d11d676bf5ef2a58f3b349eddba2c9795c9f0ed58cd`.
Bundle: `f7467232467e537880754503f3d1a36e98b278a84079db401baa675cdf509966`.
Native executable: `5130f1b90bc3f0ddd2f2f740e113d770f3ff7470591bb4c1695bb58252ea8d07`.
Run: `/private/tmp/scroller-native-batch-r12-20260907`.
Comparison: `/private/tmp/scroller-r12-layout-trajectory-comparison-20260907/finding.md`.


## R13: direct center landing and instrumented native capture

The same nine-case iOS Release batch completed in 229 seconds: build/install
147 seconds, launch 2 seconds, readiness 20 seconds. This is the runner execution
window, excluding tool dispatch; actual app-only time was not isolated. The
frozen source snapshot is `3e2a87e60ade1fdc394dd83a7e017b8b08da45164276b305ed1f4c31043a60fd`;
103 critical sources, installed executable and embedded source-map bytes verified
before launch and after collection. No product retry or extra native profile.

Independent results are five sampled passes and four incomplete; native buffer
acquisition separately qualifies eight complete and one incomplete. Repeated
center, history cache, append, thinking-label and thinking handoff pass. First
center, growth, removal and offscreen retain invalid mixed-source acquisition.
First center's first observed movement now lands directly within 0.001 pt at
native +131.315 ms, with a later subpoint adjustment. The prior R12 502 pt
intermediate stop is absent from this recording. All three command recordings
first expose their targets within the existing 1 pt tolerance; none records a
blank command frame. Missing observations still prevent broader claims.

Offscreen retains 236.099 ms and 142.036 ms native gaps. Explicitly enabled native
session `r13` records 27/14 capture calls and 193.663/129.553 ms cumulative capture
elapsed time across those intervals, with no active spans at the sampled
endpoints. A single capture peaks at 11.398 ms; query at 1.829 ms. These are
inclusive method durations, not CPU samples or exclusive writer attribution;
nested query/exposure totals are not added. Repeated provisional capture work is
the next performance target. History captures retain actual READ admission in
334/334 frames; the three following cases remain unadmitted in 404/404 frames.

Combined app validation passes 2,560 assertions across 122 files with the same
three existing provider-key skips. Installed Legend controls pass 456; native
provider controls pass 137 and current SDK syntax passes. App TypeScript passes
after correcting a test-only relative type import; the actual Pressable source
still runs in its 33 passing carrier controls. The earlier marker mock load
failure and initial TypeScript failure are preserved. Earlier reported app
aggregate counts included skipped assertions; these totals exclude them.

Desktop caret calibration passes three natural-blink cases. Product R1 stopped
before Home on a stale Vite import graph; an exact-module probe and scoped server
restart repaired setup. Product R2 reached the actual composer and delivered all
three exact actions, with zero end gap in all 89 recorded geometry observations.
It remains incomplete: optional screenshot acquisition timed out at 250 ms and a
486.6 ms observation gap remains. That overlap does not establish causation.
A dedicated-CDP collector is being tested separately; these attempts remain
unchanged and do not qualify caret continuity or presentation.

Evidence: `/private/tmp/scroller-native-batch-r13-20260907/independent-replay.json`,
`/private/tmp/scroller-r13-post-run-diagnostics-20260907/diagnostic.json`,
`/private/tmp/scroller-app-r13-20260908/full.json`,
`/private/tmp/scroller-native-ready-window-integration-r13-20260908/installed.json`,
`/private/tmp/scroller-read-duration-r13-20260908/manifest.json`, and
`/private/tmp/scroller-input-paint-product-r2-20260908/product/independent.json`.


### Desktop exact input R3

The dedicated-CDP PNG collector records a passing ordinary geometry/input slice:
120 geometry frames, every bottom gap 0 px; 133 input samples, maximum sampling
gap 46.5 ms. Exact growth/select-all/Delete acknowledgements are 11.7/17/10.8 ms.
It retains 28 actual PNGs with maximum acquisition bracket 88.2 ms and start gap
91.3 ms. The independent reader identifies one cleared-empty caret candidate
across 17 frames/1,141.3 ms with two natural transitions. Transitional epochs,
missing phase coverage and the last capture retired by session detach remain
incomplete. Continuous caret, full attribution and presentation are unqualified.

The overall case is INCOMPLETE: after the product body finished, group deletion
in shared `zodSetup` teardown stalled for 179,723 ms on `GroupLeaveAction-Delete group`. Retained
action logs show the target was present but repeatedly scrolled under the
ChatDetailsHeader/overlay, which intercepted clicks. Case duration is 200.439 seconds and the
whole pipeline 203.169 seconds. This is not a passing cleanup or full-case
result. Chromium closed; source/reader hashes remained unchanged; no retry.
The earlier R1 startup failure and R2 screenshot/gap evidence remain retained.

Evidence: `/private/tmp/scroller-input-paint-product-r3-20260908/product/metrics.json`,
`independent.json`, `long-calls.json`, and `raw.json` (SHA-256
`0cff145d4ef1ac9d4636017dd2bbc9a8f4249268c583bbfbec3631eb23d69c4a`).

## Desktop exact-input R4 and native follow-up integration

The single headless exact-growth/select-all/Delete case completes in 21.849 s
(report 24.372 s), with no retry and unchanged source through independent replay.
The geometry slice passes 125 observations at zero end-gap error, and exact
draft/selection semantics pass. The opt-in cleanup deletes only the newly
observed, acknowledged local test group and verifies fresh backend absence; its
receipt is complete. R3's intercepted product Delete control remains a separate
recorded UI finding. No product Delete behavior was changed by test cleanup.

Full evidence remains incomplete: the generic importer still requires its
viewport resize/restore coverage, and caret attribution/continuous capture and
presentation are unqualified. Optional PNG acquisition stops on its failed
capture rather than retrying or relaxing the timing limit. Raw R4 evidence is
`/private/tmp/scroller-input-paint-product-r4-20260908/product`; raw report SHA256
`dfc153d1c308b0ad93c04441f57c1cb56c09210fe9a4fbecca7a87145261a74f`.

The reviewed combined native candidate is now integrated: per-query text
fragment clipping reuse, plus an opt-in copy of actual committed loaded-row
membership. Its exact three installed file hashes match the candidate with 189
passing source controls and a successful actual iOS SDK syntax check. The
modeled long-text geometry conversions fall from 1,411 to 14 with nine identical
witness/rejection records. Device time has not yet been measured on this source.
Membership alone does not bind a recycled row's signature to its incarnation;
that same-operation physical native row/cell binding and independent mutation
reader are in progress. The fixture now declares the separate native mutation
contract before recording and marks its actual request before applying it,
retaining the original mixed-source witness and timing policy. This integration
is not a new runtime pass.

### Correction: R3/R4 screenshot collector altered the viewport

The optional fresh-CDP-session clipped surface screenshot used Chromium's own
temporary emulation/restore path. The exact installed Chromium
136.0.7103.25 source and raw captures identify a collector-caused viewport/DPR
change: the first requested 773-by-38 CSS-pixel PNG at DPR 1 is actually
1546-by-76 pixels, and subsequent observations report DPR 2 and a 713-point
viewport instead of the declared 800-point viewport. Source evidence, hashes
and protocol diagnosis are retained in
`/private/tmp/scroller-cdp-viewport-diagnosis-20260908`.

Thus R3/R4's zero measured end gap describes the captured, altered environment;
it does not qualify the intended unchanged viewport. Exact observed action
delivery and scoped cleanup remain valid evidence. Neither run qualifies
continuous caret or presentation. The full records are preserved. R4's first
screenshot request itself took 88.504 ms, but its browser observation bracket
was 112.5 ms and crossed empty-to-grown state/action epochs; stopping the
collector was correct. The replacement will capture an unchanged full viewport
and apply the textarea region only in independent PNG analysis, without
writing emulation settings, extending action holds, or changing limits.

## Native R14

Total runner elapsed time is **217 seconds (3m 37s)**, 03:02:12–03:05:49 UTC
on September 8. Build/install takes 137 seconds, verified launch 2 seconds,
readiness 16 seconds and capture 45.15 seconds; app-only timing is not isolated.
The same nine cases run once on explicit simulator
`6DBBE7A7-F11A-4133-8B20-25A39B4B980C`, with source and executable/bundle
verification before and after. Snapshot:
`063d84842b5af2eca7eb36c3b4161c604d86837abcd6ec7c67626bd263288946`.

Independent original geometry replay yields **six sampled passes and three
incomplete results**. Native acquisition separately yields eight complete and
one incomplete. Center-repeat, history-grow, history-cache, append-end,
thinking-label-end and thinking-handoff-message-first-end pass the original
sampled geometry checks. First center, history removal and offscreen remain
incomplete; their eventual landings cannot qualify missing evidence.

The separately predeclared native mutation proof passes growth and cache changes
with zero measured anchor drift. Removal is incomplete: at request +32.842 and
+50.171 ms, committed membership no longer includes message109 but the same old
physical row is still exposed and its registration binding is unavailable. By
+67.114 ms the row is absent. The two transitional observations remain in the
record; the reader does not treat later absence as proof of that interval.
This does not yet establish whether the gap is in product behavior or the
acquisition model's representation of native retirement.

The largest offscreen native observation gap decreases from 236.099 to
151.370 ms, still above 125 ms. During that interval, inclusive capture time
decreases from 193.663 ms over 27 calls to 110.779 ms over 25 calls; nested
exposure time decreases from 102.515 to 9.060 ms. Nested query time is
80.923 ms. These durations overlap and are not summed or described as CPU time.
The first observed offscreen move decreases from 442.232 to 311.935 ms and
lands within 0.001 pt. No blank row is observed in the three command captures;
unobserved frames remain unknown. JS/native observation brackets still exceed
their separate 32 ms limit in the incomplete cases.

Installed native controls pass 233 checks. The independent mutation reader has
50 durable corruption controls exercised by the normal app test command. The
combined app run passes **2,579 assertions, three existing skips, zero failures**;
the full app TypeScript check passes. These counts do not qualify presentation
or the remaining matrix families.

Evidence: `/private/tmp/scroller-native-batch-r14-20260907/independent-replay.json`,
`/private/tmp/scroller-r14-r13-comparison-20260908/comparison.json`,
`/private/tmp/scroller-r14-remove-transition-20260908.json`, and
`/private/tmp/scroller-native-mutation-integration-20260908/full.json`.

## Desktop full-viewport calibration R5

The unchanged `abc` calibration runs once, headlessly, with zero retries. It
fails before the product case: all 36 original PNGs are 2560 by 1426 pixels,
exceeding the unchanged two-million-pixel decoder allocation limit and not
matching the intended 1280 by 800 viewport at DPR 1. Decoding is refused before
caret analysis, so zero returned candidates says nothing about actual blinking.

Unlike R3/R4, all 72 surrounding browser observations and the post-detach check
retain 1280 by 800 at DPR 1. Draft, focus and selection stay exact. Maximum
capture bracket is 68.9 ms and capture-start gap is 69.7 ms. This qualifies the
observed viewport preservation, not the PNG coordinate mapping or caret proof.
Calibration case time is 2.478 seconds, report time 4.488 seconds; the product
case and group cleanup are unexecuted. Browser exit and unchanged source through
independent replay are verified. No timing, pixel budget or action hold changes
are used to reinterpret this attempt.

Evidence: `/private/tmp/scroller-input-paint-product-r5-20260908/calibration`,
raw SHA256 `20c9ff74ed303a45e0de322e90a332b21fb566bab28d0d04509273caeb30aaf4`.

## R15 full native selection and current app checks

The prepared native run took **7 minutes 46 seconds**, including 182 seconds
for build/install and 215.338 seconds for dispatch and collection. App-only
latency was not isolated. It requested 44 recordings and retained 42 actual
raw files; the two missing image recordings remain explicit incomplete results.

| Evidence | Pass or complete | Fail | Incomplete |
| --- | ---: | ---: | ---: |
| Existing mixed-source geometry reader, 44 requested slots | 22 | 1 | 21 |
| Native buffer acquisition | 41 | 0 | 3 |
| Separate native entry reader, six recordings | 4 | 0 | 2 |
| Separate native mutation reader, three recordings | 2 | 0 | 1 |

`near-remove` is the qualified sampled failure: removing post 115 moves the
preserved reading point in post 117 by **27.3333 points**. Its 108 measured
samples contain no missing anchor; native acquisition is complete. The removed
row also changes its successor's grouping and height. The native offset moves
199.333 points while content shrinks 172 points. This identifies excess
compensation, but the recording alone does not identify its writer.

Both stateful image cases failed before capture because the fixture's local
asset server on port 8337 was unavailable. The original run omitted that service
preflight. Their missing recordings are setup failures, not image-loading product
verdicts. A separate recovery must preserve these attempts.

Latest and selected entry each pass the separate native row-model reader in
both core and standalone captures. Both delayed entries remain incomplete for
inner/cell identity association. History growth and cache changes pass the
separate mutation reader at zero measured drift; removal retains its transitional
membership/binding gap. `near-media` exceeds both the native sample-gap and
synchronous-operation limits. Offscreen native acquisition now meets its limits,
but its JS capture still exceeds the unchanged bounds. These results establish
neither presented-frame behavior nor full native READ coverage.

The source and installed-artifact checks pass before and after the run: branch
`db/scroll-stability-fixture`, HEAD `e1ae7dda78b0107c42d45b4d0364b55047c301d8`,
dirty snapshot `8a843ce95e9e3f09760e374b79069ad656af96232aa314490bd80e2e44b5c024`,
108 frozen sources, explicit simulator `6DBBE7A7-F11A-4133-8B20-25A39B4B980C`,
and native executable SHA-256
`d4a16a533eb2c90ee19c38f151533bc023a8ce5cb59b8b84977eaf3ab98267eb`.

The current app run passes **2,580 assertions**, with the same three existing
skips, across 125 files. App TypeScript passes. Center Edit/Save now uses its
existing strict replay reader in the full 43-case web registry; nine new
integration controls verify missing, duplicate, invalid and failed evidence
cannot become a pass. Native exact-range reuse passes 73 installed-source
controls, preserving geometry and ownership while eliminating the duplicate
measurement within one query. No native speed improvement is inferred from
that control count.

Evidence: `/private/tmp/scroller-native-batch-r15-20260908/independent-replay.json`,
`/private/tmp/scroller-r15-independent-audit-20260908/diagnosis.json`, and
`/private/tmp/scroller-app-r15-20260908/full-fixed.json`.

## Desktop public screenshot acquisition, R6

The collector now uses Playwright's public viewport screenshot API with CSS
pixel scale and the page's existing session. It keeps the original PNGs and
the existing sampling, request and ownership limits. The calibration case
passes its declared viewport and natural caret-blink checks. Its separate TMP
orchestration gate still fails on an invalid final in-flight observation; that
attempt remains unchanged.

One separately recorded product continuation passes sampled geometry and exact
input semantics in **23.211 seconds**, with a zero-pixel maximum end gap. All
57 observed screenshot surfaces retain 1280×800 at DPR 1; 29 PNGs are retained.
Caret attribution, phase coverage and continuous presentation remain incomplete.
The original R2–R5 failures and altered-surface limitations remain in the ledger.

The product continuation and the two-case cleanup rollout verify bounded cleanup
of only the exact groups acknowledged as newly created by those tests. The
center Edit/Save and latest keyboard rollout cases pass in a 55.599-second
report; this does not qualify the broader visible-browser or presentation gates.

Evidence: `/private/tmp/scroller-input-paint-product-r6-20260908`,
`/private/tmp/scroller-input-paint-product-r6-continuation-20260908/product/independent.json`,
and `/private/tmp/scroller-scoped-cleanup-product-r1-20260908`.

## Full desktop 43-case run

The complete fixed selection ran once with normal Vite app flags, headless
Chromium, one worker, zero retries and optional PNG acquisition disabled. The
report took **21 minutes 44.503 seconds**. All 43 requested cases were attempted;
runtime assertions were 28 passed and 15 failed. Independent canonical replay
qualifies **18 sampled passes, one failure and 24 incomplete results**. All
43 scoped cleanup receipts are complete: 38 newly created groups were deleted
and five setup failures created none. Every browser launch has a matching
exit, and source, reader and recipe verification remains unchanged through replay.

The sole canonical failure is the original `edit-growth-shrink` first-row
witness: 105 CSS pixels of movement. As declared before this run in the
center-edit contract, that assertion does not establish the accepted center
reading policy when the resized row lies between the first and center rows.
The raw failure remains preserved. Repairing that false oracle is distinct
from changing production scrolling. The separately registered center-character
case is incomplete in this attempt because of reading and neighboring-row
capture gaps; its earlier sampled pass does not qualify this capture.

Five two-account cases fail before measured actions because fake TEN's Home
setup does not become ready within the existing 60-second bound: remote append
at latest/history, thinking at latest/history, and thread unread update. Their
missing product evidence stays incomplete. The immediate-Back case also fails
its exact reply-count preparation. Other incomplete results retain their
existing headed-browser, input-caret, capture or provenance requirements; no
headless evidence is promoted through a headed-only contract.

The 18 sampled passes include channel/thread sending from history, composer
growth/clear at latest and history, hover/action menus, latest landing and both
control-visibility cycles, selected-reference centering, thread return, reaction
resize, quote preview, viewport resize, and five delayed-image/content cases.
They are sampled desktop behavior, not delivered production-bundle or presented
frame qualification. The run does not close the accepted final matrix gates.

Raw report SHA-256:
`3cd502837b85c5a0a04216eac81fd4d21c9c930b067d18154b5156d7d5753c02`.
Evidence: `/private/tmp/scroller-broad-web-r2-20260908/independent.json`,
`/private/tmp/scroller-broad-web-r2-20260908/capture-end.json`, and the matching
`source-before.json` / `source-after-replay.json` in that directory.

## R16 warm image recovery

The corrected recovery records the two missing image cases on the exact verified
R15 artifact without a rebuild. The end case independently passes sampled
geometry. The history case remains incomplete because one JS measurement bracket
is 79.174 ms, above the unchanged 32 ms limit. Both native buffers are complete,
with 147 observations each. These are separate new records; the original R15
42-of-44 inventory remains unchanged.

An initial warm recovery timed out because its recipe assumed launch only brought
the app forward. The wrapper actually restarts the process, and that recipe omitted
the existing post-launch Ready gate. The failed 38.835-second attempt is preserved.
The corrected recipe explicitly restarts, waits for Ready, verifies the owned local
asset server, dispatches only the declared two cases, independently replays them,
verifies the same installed artifact, and closes its own asset server.

Total elapsed time, including that failed attempt and diagnosis/preparation, was
**5 minutes 15.615 seconds**. The corrected run took **47.615 seconds**, including
24.669 seconds for readiness and 13.346 seconds for dispatch/collection. These
intervals are not isolated app latency. Evidence:
`/private/tmp/scroller-native-image-recovery-r15-20260908` and
`/private/tmp/scroller-native-image-recovery-r16-20260908/terminal-receipt.json`.

## Post-run focused reproductions

The existing RN READ host harness reproduces three failures in 94 controls:
same-mount legal-end clamping followed by relative compensation, the same clamp
one mount before delivery, and a second cumulative delivery. All 87 original
controls and four new unchanged/ownership controls pass. These execute the
installed coordinator and native method bodies while modeling UIKit's clamp
and transaction delivery. They reproduce a double-counting boundary, but do not
establish that one modeled sequence explains all of R15's 27.3333-point drift.
The delayed-delivery case also requires exact change ownership; an unbounded
ledger of previous clamps would be an unsafe fix. No correction is integrated
at this checkpoint. Evidence:
`/private/tmp/scroller-native-near-remove-clamp-20260908`.

Four actual PostList/installed Legend boundary controls also reproduce late
movement after route cover: two focused positives pass and both covered-route
cases fail, in CJS and ESM. A request accepted before focus loss retains its
dependency revision and dispatches one nonanimated native scroll when its held
commit is released, even though the app visit is no longer current. Native
delivery is modeled; these controls do not claim to cancel an already running
UIKit animation. Earlier harness setup failures remain preserved. Evidence:
`/private/tmp/scroller-native-route-command-cancel-20260908/original-dispatch-evidence.json`.

## Focused repair follow-up

The five two-account Home failures share a concrete setup cause: the TEN Vite
process returns HTTP 500 while resolving existing `nativeRead` imports in
ContentRenderer and BlockRenderer. The same source modules return 200 from the
other frontend, and TEN can serve `nativeRead.tsx` directly. Restarting only the
verified TEN process restores all three module responses without source or
account changes. Actual TEN Home readiness is a prerequisite in the prepared
seven-case follow-up; successful module requests alone do not qualify it.
Receipts are in `/private/tmp/scroller-ten-server-recovery-20260908`.

The first-row edit assertion is replaced in the active selection by the already
accepted center-reading policy. A shared real Edit/Save journey now exercises
edits both above and below the selected center character. The old assertion and
its failing raw attempt remain readable as historical evidence. Independent
review caught and fixed a below-case path that could bypass the required proof;
69 focused controls and 237 integrated app checks pass. The active selection
still contains 43 cases, with unchanged one-pixel and acquisition limits. The
new below-center product capture remains pending at this checkpoint. Evidence:
`/private/tmp/scroller-below-center-edit-20260908`.

The route-cover repair is now integrated. PostList tracks the exact promise
accepted by its Legend list and cancels that request when the owning visit or
intent expires. Cancellation retires queued dispatch and JS retries without
touching a newer request or another list. The installed dependency passes 66
completion/cancellation controls; native ownership tests pass 67 assertions.
The combined app milestone passes **2,583 assertions**, with the same three
existing skips across 125 files; app TypeScript also passes. These controls
model native command delivery and do not establish cancellation of an already
delivered UIKit animation. Native runtime validation of this repair is pending.
The dependency lock delta changes only three occurrences of the Legend patch
hash; all prior patched package contents survive a reverse/apply roundtrip.
Evidence: `/private/tmp/scroller-native-route-command-cancel-20260908/integration-final.json`
and `/private/tmp/scroller-app-route-r16-20260908/full.json`.

## Seven-case desktop follow-up

The corrected seven-case run completes in **237.214 seconds** including
readiness and replay; its product report takes 228.078 seconds. Independent
replay qualifies **five sampled passes and two incomplete cases**, with no
qualified failure. Above-center Edit/Save retains the character within
0.1953125 px; below-center retains it exactly. Remote append at latest stays
within 0.5 px. Thinking show/clear/reply handoff passes both at latest and in
history, with zero observed end gap or history-anchor movement respectively.

Remote history stops before its measured burst because preparation samples have
a 105.1 ms interval, exceeding the existing 100 ms bound. The thread-read case
cannot find its exact `18 replies` navigation control before its ten-second
click timeout. Both remain incomplete. All seven test-created groups are
deleted, all browsers close, and source/readers remain unchanged. This normal
Vite/headless result does not qualify production bundle or presented frames.

The preceding attempt stops before any products: its ten-second Home preflight
cuts off a healthy cold module graph after the dependency lock change. The trace
retains 1,061 HTTP 200 responses and 240 pending requests, with no failed HTTP
response. One new attempt uses the existing 60-second app-readiness bound and
the same warm owned server; actual TEN Home loads in 3.406 seconds. Product and
acquisition limits are unchanged. The original abort remains preserved.
Evidence: `/private/tmp/scroller-below-center-ten-product-r1-20260908` and
`/private/tmp/scroller-below-center-ten-product-r2-20260908/independent.json`;
the latter raw SHA256 is
`ec32e5fc6ab40d6ec87c66f8b4b7ac1a36d5e6e17543feda6fc1f90d48ca3b81`.

## Native operation correction integration

The reviewed correction is integrated in RN and Legend, together with its
durable controls. **618 installed-source controls pass**: 112 native host
controls and 506 Legend controls across both bundle formats. Three actual iOS
SDK syntax units also pass. The original double-count, completed-clamp race,
negative-inset acknowledgement, owner-return and serializer compilation failures
remain preserved in `/private/tmp/scroller-native-operation-clamp-20260908`.

The native fallback now distinguishes an automatic clamp before a correction
from an already completed correction. Each operation carries an actual native
starting offset; native retains only that operation's latest confirmed bounded
result. Later changes can use it even before JS receives the acknowledgement.
Exact ownership checks retire stale operations, and acknowledgement events
cannot be lost through ordinary scroll-event coalescing. The active reading
provider retains sole correction authority. Old branch-only wire shapes are
removed from production; historical source/evidence remains independently
readable.

The final integration receipt is
`/private/tmp/scroller-native-operation-integration-20260908/final.json`.
Patch hashes are RN `3ce6e667415b0693d840f6219aaf872db446adc298c061b89969a771f177956b`
and Legend `f2105785bb3d5da245b0e956a44c4432b99984cff526654e7a47d180a231b9d4`.
Prior patched contents survive a reverse/apply roundtrip; lock changes contain
only patch hashes and their derived peer contexts. Simulator validation of this
snapshot is still pending. These controls do not establish that this writer
caused every part of R15's 27.3333 pt movement or prove presented-frame behavior.

## R17 native follow-up

The verified run completes the same **44 scenarios in 485 seconds (8m05s)**.
All 44 native recording buffers qualify as complete. Shared sampled geometry
records **21 passes, one failure and 22 incomplete results**; native entry is
four passes/two incomplete, and native mutation is two passes/one incomplete.
The final source snapshot is
`45ac43839c6741db3bb45b7c6518aedaa7c0fc3b2541db678dfbac1f406df101`.
All five frozen reader hashes are unchanged from R15.

Near-remove's final anchor returns within 0.000326 pt of its original position,
repairing R15's persistent 27.333 pt drift. However, buffered native observations
21 and 22 still shift that same anchor by 18 pt; observation 23 recovers. The
bridged samples miss both shifts. The native observations have unchanged anchor
and owner identities, valid geometry and no gesture. The required hold offset
exceeds the actual intermediate legal maximum by 17.999674 pt while the removed
cell is still mounted and its successor retains the old height. A legal clamp
explains the intermediate state; it does not qualify transition continuity.
The removed cell also lacks a current binding, so full native mutation
qualification remains incomplete. The sampled pass must not be presented as a
complete near-remove pass.

The current near-remove provider rejects `no-eligible-central-block` throughout:
its center row, message 117, renders a code block without an admitted native
interior carrier. This is the existing supported-content boundary, not evidence
that fixture positioning canceled a valid READ lease. Paragraph/image support
does not establish code, rich-content or arbitrary block coverage.

Thinking show/hide at end is the sole shared geometry failure: footer growth
precedes following by 51.999674 pt. R15's native buffer already contains the
same gap, although its bridged samples miss it. R17 observes it in both sources.
Both tails return to the legal end. These are native model observations;
presented-frame behavior remains unqualified. Route-cover cancellation is also
absent from this 44-case run and retains its source-control-only qualification.

Original raw results remain unchanged in
`/private/tmp/scroller-native-batch-r17-20260908`. The independent comparison is
`/private/tmp/scroller-native-r15-r17-near-remove-comparison-20260908/comparison.json`
(SHA256 `e57109d42b259a08cdc82c2d3e10648e29ff72b769eed88300aecf7053759691`).

## Buffered continuity reader integration

The installed public reader evaluates buffered stationary end geometry and
independently bound mutation anchors outside the JavaScript reader's early
exits. Missing mutation semantics cannot erase an independently qualified
anchor failure. Later frame-local acquisition failures preserve an already
qualified failing prefix; global contract errors still disqualify it. Native
continuity alone cannot grant an overall pass, and native presentation remains
incomplete. Stationary history families without a buffered continuity reader
are explicitly incomplete rather than inheriting a JavaScript-only pass.

The installed focused suite passes 88 recording tests and one importer test
that executes 85 corruption/composition controls. Scoped TypeScript passes.
Replaying the original recordings with the new reader reports R15 thinking
FAIL at 51.999674 pt despite its old sampled pass, and R17 near-remove FAIL at
18 pt despite sampled pass and incomplete mutation semantics. R17 thinking
also remains FAIL. No historical file was rewritten. The separate integration
and replay receipts are in
`/private/tmp/scroller-native-buffered-bottom-20260908/installed.json` and
`installed-historical-replay.json` in that directory.

## Reply-count repair and two-case desktop follow-up

The installed repair passes 23 SQLite tests. It applies complete reply
snapshots with committed membership changes that occurred during the fetch,
preserves deletion/optimistic-send ownership, and defers ambiguous partial
snapshots to one bounded existing full fetch. It adds no database schema.

The two-case headless desktop follow-up takes 91.956 seconds for products,
93.895 seconds including capture/replay, and 396.655 seconds including the
preceding aborted preflight and owned-server recovery. The incoming-reply
thread-unread scenario passes: the actual control moves from 18 to 19 replies,
unread clears, and observed end gap is zero over 133 frames. Immediate Back
now gets through the same reply-count preparation, but its cancellation starts
213.5 ms after first reveal, so pre-reveal cancellation remains incomplete.
Its separate headed-presentation provenance gate also remains incomplete.
Both test-created groups are deleted and source/reader checks remain stable.
This run does not prove backend SSE payload contents or presented frames.
Receipts are in `/private/tmp/scroller-reply-count-product-r2-20260908/handoff.json`;
the retained raw SHA256 is
`0a521a9c8d24a75f25f450992bdbdb66de5ef4b6c3582a1823f9d8f3054f0381`.

## Native FOLLOW correction integration

An explicit completed FOLLOW intent now holds the legal end during the native
mount that changes content size, through the existing guarded coordinator.
iOS no longer sends a delayed passive layout/content callback to do the same
work. READ providers and Android callbacks retain their existing behavior.
Physical owner, scope, visit, intent, screen, command and gesture changes
retire the lease. Fresh FOLLOW published during momentum may admit when the
gesture finishes at the end; an actual finish away from the end retires that
delayed declaration instead. Repeated data cannot revive a retired intent.

Installed controls pass: 126 native coordinator, 65 registration lifecycle and
49 actual PostList controls. Original failures and both review-found momentum
regressions remain preserved. The three-file RN patch preserves all 20 prior
patched files through reverse/apply verification, and the lockfile changes only
the patch hash and derived peer contexts. No package versions or other manifest
fields change. Installed receipt:
`/private/tmp/scroller-native-follow-integration-20260908/installed.json`.
The targeted eight-case simulator follow-up is prepared; these controls alone
do not establish that the recorded 52 pt gap is fixed on the simulator.

## R18 targeted FOLLOW simulator verification

The predeclared eight-case run completes in **214 seconds (3m34s)**: 138 seconds
for build/install and 40.651 seconds for scenario capture. Both changed native
translation units compile in this build; exact embedded source, executable and
installed artifact checks pass before and after capture. Snapshot:
`08c969e0cdad59a7a5885fd518bec611eed81ce89c1f48ccd18d5cb6ddc06a3b`.

All eight buffered end-continuity checks pass and all eight recording buffers
are complete. Thinking show/hide's former 51.999674 pt gap is absent; its maximum
observed end distance is 0.000326 pt. Append, burst and all three reply-handoff
orders also stay within 0.000326 pt. Empty thinking and label-only transitions
have zero observed end distance. No frames were removed and the 1 pt policy is
unchanged. Replaying the original R17 raw with the stronger reader separately
retains all six FOLLOW failures, spanning 52–169 pt, plus the 18 pt removal
failure. The original reports remain unchanged.

Combined sampled qualification records five passes and three incomplete cases:
append-end, burst-end and thinking-handoff-hide-first-end retain coherent
JavaScript/native acquisition errors. Buffered geometry does not replace those
missing proof dimensions or establish presented frames. Removal, gesture/input,
history, real-account native journeys and the full matrix remain open. This
run does not exercise removal and cannot establish that its 18 pt jump changed.

Raw, source, compilation, installation and replay receipts are in
`/private/tmp/scroller-native-follow-r18-20260908`; canonical independent results
are `independent-replay.json`. The separate unchanged-44 reclassification is
`/private/tmp/scroller-native-buffered-bottom-20260908/installed-r17-all44-replay.json`.

## Immediate Back scheduling follow-up

The test now arms the real exact-route observer before clicking and sends real
browser Back as soon as that observer resolves, joining the original click and
Back outcomes. The installed focused suite passes 93 checks. Headless navigation
behavior is reported separately; presentation remains incomplete and cannot
grant a full pass. The first installed test import error, hidden by the TMP
loader mapping, is retained; its relative path is corrected and the actual
installed suite passes.

The single headless product attempt takes 36.880 seconds, or 39.213 seconds with
capture/replay. It remains incomplete: first thread reveal is at 31693.0 ms,
Back begins at 31838.2 ms, and trusted popstate occurs at 31910.9 ms. Back is
still 145.2 ms after reveal. A 111.3 ms observation gap also exceeds the existing
bound. All 186 samples are retained; the exact created group is deleted and
final source/reader hashes match. There is no unchanged retry. A real loading
path is needed to exercise pre-reveal cancellation reliably; this fast cached
opening does not provide the required window. Evidence:
`/private/tmp/scroller-immediate-back-route-product-r1-20260908/handoff.json`.

## CodeBlock interior coverage integration

The default iOS CodeBlock now exposes its actual code paragraph to the existing
native reading provider. Its equivalent outer frame retains ownership above
the horizontal scroller; its equivalent header is a separate registration
boundary, so Code/Copy labels cannot become the source-text witness. Styling,
copy action, horizontal scrolling and the existing clipping/identity rules are
retained. Custom render/asChild variants remain explicitly unsupported.

Installed checks pass: 40 actual component controls and 153 native capture-body
controls. The original missing-carrier failure and setup failures remain
preserved; scoped TypeScript passes on the exact proposed production bytes.
The three-file integration receipt is
`/private/tmp/scroller-native-codeblock-carrier-20260908/installed.json`.
This adds previously missing content support. It does not prove the 18 pt
removal clamp is repaired; targeted simulator verification remains required.

The full app suite now passes **2,634 assertions with three existing skips**
across 126 files in 10.043 seconds using the repository's normal runner. The
earlier single-process attempt stalled and was explicitly stopped; its output
remains preserved. The first normal run exposed an old semantic-only positive
control that incorrectly expected full qualification without buffered native
evidence. It now checks sampled semantic success separately from overall
incomplete status, and its corruption controls also require sampled rejection
so missing buffered evidence cannot hide a broken semantic check. No product
threshold was weakened. Results:
`/private/tmp/scroller-app-after-follow-default-r2-20260908.json`.

## Missing-parent loading cancellation

The existing real missing-parent case passes its independent navigation
behavior check in **29.793 seconds**, or 38.474 seconds from corrected selection
validation through final replay. Real browser Back is delivered while the
original exact parent/replies GET is held. The original successful response
is released 326.1 ms after Back; the channel remains stable through the
1,219 ms response tail. No thread content is revealed. All 156 samples are
retained, with zero observed row/interior return drift, a maximum sample gap
of 70.4 ms and a maximum measurement bracket of 15.2 ms.

The sampled loading shell passes. Its own Back button, error and retry paths
were not exercised. Headless presentation and durable reads remain incomplete,
as does the separate cached immediate-Back attempt. The sole test-created group
is deleted and source/reader hashes match before and after. The first attempt
aborted before any browser opened because a runner substitution corrupted a
listener preflight; that failed setup remains preserved. Including it, elapsed
time was 198.290 seconds. Actual product attempts: one, with zero retries.
Receipt: `/private/tmp/scroller-missing-parent-loading-product-r2-20260908/handoff.json`.

## R19 removal verification after CodeBlock support

The exact two-case simulator run takes **176 seconds (2m56s)**: 133 seconds
for build/install and 9.641 seconds for capture. Snapshot:
`4b5dfa87574a34fa5f66970675cf5b08d664368029269dc4bc3b5d9025f4f760`.
Exact source, executable, warm native inputs and installed artifact checks pass.
Both native recording buffers are complete.

Near-remove still fails: frame 21 moves the bound anchor **18.333333 pt** and
the next observed frame, 17.387 ms later, restores it. READ is admitted on all
110 qualified frames, so CodeBlock support closes the missing-provider gap
without fixing this jump. The failing frame combines the reduced content extent
with the surviving anchor's old content coordinate. The desired hold offset
exceeds the new legal maximum by 18.333008 pt; the native READ coordinator
correctly records a clamp. History-remove anchor continuity passes within
0.000326 pt over 112 qualified frames. Both mutation-semantic checks remain
incomplete because the removed target's physical binding is unavailable.

The runtime defect remains open. Raw results are retained in
`/private/tmp/scroller-native-removal-r19-20260908/independent-replay.json`;
the source/geometry diagnosis is
`/private/tmp/scroller-native-r19-removal-diagnosis-20260908/handoff.md`.

## Armed input readiness and report failure precedence

The fixture now exposes `Armed <scenario>` only after the exact native recording
and action-marker acknowledgements, when its existing input listener can accept
the gesture, keyboard or composer event. The external runner can wait for this
observable state instead of sending input during recorder startup. Input and
capture deadlines are unchanged. Installed tests execute the actual fixture
branches with delayed, missing and foreign acknowledgements; device overlap
verification remains pending.

The ordinary coverage report now retains independently qualified native failure
when producer acquisition or broader near-end READ scope is incomplete. Those
limitations remain attached, and healthy geometry cannot promote an incomplete
case to pass. Existing corruption/composition controls exercise both directions.
The installed three-file test selection passes **271 assertions**, including
one importer that executes **85 mutation/reporter cases**. Formatting passes.
The source receipts are `installed.json` in
`/private/tmp/scroller-native-report-precedence-20260908` and
`/private/tmp/scroller-native-armed-input-20260908`; test results are
`/private/tmp/scroller-readiness-report-installed-tests-20260908.json`.

The subsequent normal full app run passes **2,645 assertions with three existing
skips** across 126 files in 10.240 seconds. This includes both installed changes;
it does not replace the pending runtime overlap checks. Results:
`/private/tmp/scroller-app-after-armed-default-20260908.json`.

## Coherent Fabric content extent integration

The existing native list now publishes its Fabric content extent through the
same React subscription/commit path as surviving row positions. Legacy native
keeps Animated delivery. The change affects only `ContainersLayer` in the
CommonJS and ESM dependency entries; it leaves READ bounds, commands, operation
acknowledgements and fixture expectations unchanged.

Controls execute the actual component, store and calculation bodies with real
React batching and modeled native Animated delivery. The original two bundles
produce six failures; the candidate passes all 516 dependency controls, including
horizontal parity and all existing completion/ownership controls. The generated
patch preserves all five previously patched files by reverse/apply comparison.
The lockfile changes only the Legend patch hash; package and workspace manifests
are unchanged. Installed receipt:
`/private/tmp/scroller-native-coherent-extent-integration-20260908/installed.json`.
R19 remains a recorded failure pending the next simulator run.

## R20 removal and R21/R22 real input

R20 verifies the coherent Fabric extent change in **174 seconds total**, with
**131 seconds build/install**. Both near-end and history removal pass native
anchor continuity and mutation semantics: 111 qualified frames each and maximum
drift **0.000326 pt**. Both native recording buffers are complete. The previous
18.333333 pt transient removal jump is absent; combined bridged acquisition
remains incomplete. Source and installed artifact match before and after.
Evidence: `/private/tmp/scroller-native-removal-r20-20260908`.

The separate R20 five-case input batch takes **420 seconds**, reusing that build,
and remains incomplete in all five cases. Driver exit zero did not establish
delivered input. Installed Maestro 2.6.1 unconditionally waits for screen
stability for three seconds before these gestures; its zero settle-timeout option
does not bypass that path. Exact native input timestamps show delivery over four
seconds after command start, outside the fixture's unchanged input window.
The original batch and diagnosis remain in
`/private/tmp/scroller-native-overlap-r20-20260908` and
`/private/tmp/scroller-native-overlap-r20-driver-diagnosis-20260908`.

Argent R21 delivers the real keyboard action in **3.552 seconds of driver time**.
WillShow occurs 497.745 ms after arming, and both the 52 pt thinking appearance
and its disappearance occur inside the 404.767 ms WillShow/DidShow interval.
All 244 observed native frames remain at the legal end within 0.000326 pt.
The result is still **incomplete**: five JavaScript/native acquisition brackets
exceed 32 ms, and the native recording has a **238.172 ms gap**. Missing frames
cannot qualify smoothness. No threshold or reader was changed. Evidence:
`/private/tmp/scroller-native-argent-keyboard-r21-20260908/independent-diagnosis.json`.

Argent R22 retries the remaining four exact scenarios once each on the same
verified installation. Each driver sequence delivers its actual input; the
recorded action and geometry witnesses remain independently assessed. The
image-keyboard-history producer reports a failure including anchor obstruction;
the other three producer results remain incomplete. Exact input receipts, raw
recordings and independent replay are in
`/private/tmp/scroller-native-argent-overlap-r22-20260908`. The loopback image
server and this session's Argent device services are stopped. R20 failures and
R21's separate recording are preserved.

## Stationary history, gesture tails and seeded session

Nine history cases reuse native bound-anchor checks. Unchanged R17 replay gives
eight HOLD passes/one incomplete prepend; combined sampled results remain
four passes/five incomplete. Installed tests pass 183 assertions plus 122
mutation controls. Receipts: `installed.json` in
`/private/tmp/scroller-native-stationary-hold-20260908` and
`/private/tmp/scroller-native-post-gesture-probes-20260908`.

R23 stops before recording: an already-hidden thinking indicator cannot emit
a fresh hide commit. No gesture runs; missing raw and the unattempted second
case remain incomplete. Preparation now requires an actual committed/laid-out
hidden baseline or a real hide transition; 78 controls pass. Original evidence:
`/private/tmp/scroller-native-post-gesture-r23-20260908`.

R22's four independent results remain incomplete. Keyboard image layout occurs
6.791 ms after DidShow; composer image loading precedes size change by 1.809 s.
Thinking/drag callback association correction is integrated. The reported
row/Latest/composer intersection does not identify the selected native interior
point. Original producer failure and independent results remain in
`/private/tmp/scroller-native-argent-overlap-r22-20260908`.

R24 takes **327 seconds**, including **122 seconds build/install**. Both gestures
produce complete native buffers (end 257 frames, away 264), but original replay
marks both tails incomplete. A tested numeric -0/0 bounds correction qualifies
unchanged **end PASS: 146 frames, maximum 0.000326 pt**. Away's **37.985 ms**
baseline exceeds 32 ms, so no thinking probe runs. Original and corrected replays
remain in `/private/tmp/scroller-native-post-gesture-r24-20260908` and
`/private/tmp/scroller-native-tail-signed-zero-20260908`.

R25 takes **641.9 seconds (10m42s)**, including **141 seconds build/install**;
actual native recording windows total **13.553 seconds**. Its three inputs run
once each after Armed, with the existing supported final 5000 ms driver delay
moving automatic screenshot/AX after capture. One AX reconnect is included;
no extra build or scenario retry occurs. Independent results:

| Case | Result | Evidence and limit |
| --- | --- | --- |
| Away post-gesture thinking | **PASS** | 207 qualified tail frames, **0 pt** anchor error; 272-frame native acquisition complete. Bound stationary row hold only, not finger trajectory or presentation. |
| Thinking during keyboard at end | **INCOMPLETE** | Actual overlap observed; **451.646 ms** native coverage gap and invalid sampled acquisition. |
| Thinking during drag | **INCOMPLETE** | Actual overlap observed; 268-frame native buffer complete, but sampled acquisition invalid at sample 2. |

Final source/reader/artifact checks and scoped device cleanup pass. R24/R21/R22
attempts remain unchanged; R25 does not prove the cause of R24's baseline delay.
Raw hashes, replay, timing and verification:
`/private/tmp/scroller-native-input-r25-20260908/summary.json`.

Seeded desktop R1 takes **59.970 seconds**, completes **6/50 actions**, and stays
**INCOMPLETE**. Latest times out at action 7; its correct-route button is hidden
with pointer events disabled despite a **399 px** gap because web interprets
threshold 1 as a viewport ratio. Raw evidence, exact cleanup and unchanged
source/reader hashes remain in `/private/tmp/scroller-seeded-session-product-r1-20260908`.
Latest visibility and deferred-export fixes are now installed. Full app checks
pass **2,823 actual assertions**, with **three existing skips in 130 files**, and
TypeScript passes. Subsequent collector checks pass **121 assertions**, zero
failures/skips: `/private/tmp/scroller-deferred-export-installed-20260908.json`.

Seeded R2 takes **124.647 seconds total / 109.822 seconds actual test time**.
All **50 actions complete**, with **zero action execution errors**, but the final
Playwright assertion fails. Canonical behavior and overall verdicts are **FAIL**
on `visible-message-identity-or-text`; wheel delivery, capture gaps and input
cardinality remain incomplete. All 109 identity flags concern local provisional
IDs across four own sends. Observed text matches the intended payload; the
reader admits only the later server IDs. This missing optimistic-incarnation
declaration does not establish product content corruption. The unchanged raw
assessment remains FAIL. Action 7's current visible control receives a trusted
click, reaches zero bottom gap 477 ms later and holds it for the remaining
577.6 ms of its action. Global acquisition contains 4,008 samples, with maximum
gap 80.4 ms and maximum measurement 17.2 ms; separate READ/input gaps remain.
Exact owned group `~zod/vqleckm` is deleted with no cleanup errors. Source/reader/recipe hashes
are unchanged, the browser is closed, and no retry runs. R1 remains preserved.
Evidence: `/private/tmp/scroller-seeded-session-product-r2-20260908/handoff.json`.

These results form the tested refactor-entry baseline, with failures and test
gaps explicit. They do not close final qualification, presentation, remaining
input/overlap evidence, platform breadth or soak.
