# Scroller test hardening and refactor

## Structural refactor checkpoint — September 8

The tested baseline is committed as `025f83098b`. The subsequent refactor
separates message actions and overlays, keeps readiness private to each entry,
names the Latest request ownership checks, and removes duplicate row-divider
rendering. Independent review found no behavior changes. The combined app run
passes **2,865 assertions**, with **three existing skips across 130 files**;
TypeScript passes.

Fresh desktop R5 completes **50/50 actions** in **2m22s total / 117.670s test
time**. Its Playwright assertion remains **failed** because the independent
assessment is **INCOMPLETE**: eight wheel-delivery mismatches, one reading
capture gap and one invalid input-sample assessment. There are no qualified
behavior failures. Temporary send IDs are now independently derived from the
original wire timestamp; multiline input events are joined to their recorded
dispatch. Neither correction changes acquisition limits. R4's earlier startup
failure is retained; refreshing the two stale Vite resolvers repairs it without
a source change. R5 source/reader/recipe checks and owned cleanup complete.

Fresh iOS R26 retains all three native buffers. Selected-entry landing passes
within **0.167 pt**; removal passes sampled geometry and native mutation/anchor
continuity with **0 pt drift**. The broader entry assessment and reaction
continuity remain incomplete. Total **7m04s** includes **135s build/install**
and **3m12s held for capture release**; dispatch through collection takes
28.653s. One final screenshot, source/artifact verification and scoped cleanup
complete. These are fixture geometry results, not native overlay or presented
frame qualification.

**The structural checkpoint is ready; final suite qualification remains open.**
Outstanding work includes wheel mapping and input acquisition, native overlap
and interior content changes, presentation/caret/IME, remaining platform coverage
and the accepted seed/soak runs. Mobile web remains excluded. Exact receipts and
preserved attempts are linked in the [results ledger](scroller-refactor-results-2026-09-07.md).

## Prior baseline checkpoint

Current checkpoint: R20 removal passes native continuity and mutation semantics
within **0.000326 pt**. R24's corrected end tail passes, and fresh **R25 away
tail passes: 207 qualified frames, 0 pt error** through thinking growth/hide.
R25 takes **10m42s total**, including **141s build/install** and **13.553s of
native recording windows**. Keyboard overlap remains incomplete with a
451.646 ms native gap; thinking/drag has a complete native buffer but invalid
sampled acquisition. Original R24, R21 and R22 incompletes remain preserved.
These are bounded geometry results, not whole-gesture or presentation proof.

Seeded desktop R1 stops at action 7 Latest after **6/50 actions**. The visibility
and deferred-export fixes are installed. Fresh R2 completes **all 50 actions**
with **zero action execution errors** in **124.647s total / 109.822s test time**,
but its final assertion and canonical behavior/overall verdicts **FAIL** on
`visible-message-identity-or-text`. Wheel delivery, gaps and input cardinality
also remain incomplete. The 109 identity flags concern provisional local IDs
across four own sends; observed text matches the intended messages. The reader
lacks the optimistic-to-server ID declaration, so these flags do not establish
content corruption. Action 7's trusted click reaches zero bottom gap in 477 ms
and retains it through its tail. Global sampling improves from 458 ms to 80.4 ms
maximum gap. Exact owned cleanup completes and source/reader/recipe hashes are
unchanged. Both attempts remain preserved; no retry runs.

Full app checks pass **2,823 actual assertions**, with **three existing skips
across 130 files**; TypeScript passes. Subsequent installed collector checks
pass **121 assertions**. This is the tested baseline for the **refactor entry
gate**, with remaining failures and test gaps explicit. Final qualification remains
open: model provisional send identity and qualify overlap, input/presentation,
platform and soak evidence. Missing-parent Back passes separately; cached Back
and the full matrix remain incomplete. See the
[current results](scroller-refactor-results-2026-09-07.md).

Earlier FOLLOW checkpoint:

R18 targeted FOLLOW verification completes in **3m34s**, with 40.651 seconds
of scenario capture. All eight buffered native end checks pass within
0.000326 pt, and all eight recording buffers are complete. The 52 pt thinking
gap and related message-arrival gaps observed in R17 are absent in this run.
Five scenarios pass the combined sampled checks; append, burst and hide-first
handoff remain incomplete for coherent JavaScript/native acquisition. This is
not presented-frame proof or a full matrix pass. The 18 pt removal jump remains
open. Source, compiled native inputs and installed artifact are verified.

Buffered reader integration: the public native reader now checks buffered end and
bound-anchor continuity even when the JavaScript or mutation evidence is
incomplete. Installed validation passes 88 recording tests plus the importer
test's 85 corruption/composition controls. Replaying unchanged raw recordings
correctly fails R15 thinking (52 pt) and R17 near-remove (18 pt); their older
sampled passes remain preserved. This strengthens detection, without claiming
that either runtime defect is fixed. The reply-count repair passes 23 installed
SQLite tests and the real two-account thread unread scenario. Immediate Back
still reaches cancellation after the first reveal and remains incomplete.

Earlier native checkpoint: R17 completes the same 44 scenarios in **8m05s**, with
all 44 native acquisition buffers complete. Shared sampled geometry records
21 passes, one failure and 22 incomplete results. The persistent 27.333 pt
near-remove drift is repaired, but its native buffer still contains two 18 pt
anchor shifts that the bridged samples miss. Near-remove continuity therefore
remains open. Thinking show/hide at end records a 52 pt transient gap; the same
gap exists in R15's native buffer. This is a stronger observation, not proof of
a newly introduced regression. The near-remove center anchor is a code block,
which has no admitted interior carrier; its current provider rejection is
`no-eligible-central-block`. Exact source/artifact verification and acquisition
completion do not close these content, trajectory or presentation gates.

Earlier milestone: the current app run passes 2,583 assertions with three existing
skips, and TypeScript passes. The full 43-case headless desktop run takes 21m45s:
independent replay records 18 sampled passes, one old first-row edit assertion
failure and 24 incomplete results. Five two-account cases fail at Home setup;
headed-only, caret and acquisition gates remain open. All 43 cleanup receipts
complete. R15 requests 44 native recordings and retains 42: 22 sampled passes,
one 27.3333 pt removal-drift failure and 21 incomplete results; native acquisition
is 41 complete and three incomplete. A separate verified warm recovery records
the two missing image cases: end sampled-pass, history incomplete for a 79.174 ms
JS bracket, both native buffers complete. The original missing/failed attempts
remain unchanged. The active edit test now checks the accepted center-reading
policy above and below the selected character; both qualify in a separate
seven-case desktop run taking 3m57s. That run records five sampled passes and
two incomplete cases: a history preparation sampling gap and a missing thread
reply control. Actual second-account Home readiness succeeds after repairing
the stale Vite resolver and allowing its cold compilation the existing app
startup bound. Original failures remain preserved. Exact queued-scroll cancellation
is integrated and passes app/dependency controls; native runtime proof remains
pending. Native removal correction is still in progress. Full matrix,
production-bundle, presented-frame and remaining platform qualification are
still open. See the [current results](scroller-refactor-results-2026-09-07.md).

Earlier R13 update: the same nine-case native batch completes in 229 seconds and
qualifies five sampled passes/four incomplete; native acquisition is eight
complete/one incomplete. First center now lands directly on the target, with no
recorded 502 pt intermediate stop. Offscreen retains 236/142 ms native gaps;
opt-in timing records repeated provisional capture work during both intervals.
Combined app tests pass 2,560 assertions with three existing skips. Desktop
input R3 passes its geometry/input slice with zero observed end gap and retains
28 PNGs, but remains incomplete for caret coverage and a 180-second teardown
stall. R4 verifies bounded test-created-group cleanup and completes the focused
case in 21.849 seconds, again passing geometry/input; optional PNG timing,
caret attribution and full-importer coverage remain incomplete. The native
fragment/membership candidate is integrated but awaits runtime measurement.
The earlier R2 screenshot timeout/gap and R3 UI interception are preserved.
Subsequent diagnosis finds the R3/R4 clipped screenshot collector changed DPR
and viewport dimensions; their observed zero end gap does not qualify the
intended fixed viewport. Full-viewport capture with analysis-only cropping is
being implemented; original captures remain unchanged. Acquisition,
performance, caret/presentation and final suite qualification remain open. See
the [current results](scroller-refactor-results-2026-09-07.md).

Earlier R8 update: the reviewed message-geometry, offscreen target acquisition and
retained-route Back repairs are integrated. App r9 passes 2,406 assertions with
three preexisting provider-key skips; installed Legend dependency controls pass
322 assertions. Desktop thread-return R4 independently passes with zero measured
return drift after its reply footer grows; the earlier 6.5 px failure and setup
failures remain preserved. The combined native R8 build includes the offscreen
repair and stale-anchor guard. Its nine captures independently qualify five
sampled passes and four incomplete results: repeated center, append, cache,
thinking-label and thinking handoff pass; original center, offscreen acquisition,
growth and removal remain incomplete. Native buffer acquisition separately
qualifies eight complete and one incomplete recording after correcting the
reader's omitted offscreen-duration branch. Offscreen still records a 59.333 pt
overshoot and two native observations with no exposed measured row; removal
retains 38 pt reading drift. Both product captures remain incomplete. R7's illegal negative
offset and prior entry results remain in the ledger; a later passing landing
does not erase insufficient acquisition or establish presented-frame behavior.
These results do not close the final qualification gate. The earlier R6 results
and four-point landing failure remain preserved. See the
[current results](scroller-refactor-results-2026-09-07.md).

The seven-case desktop composer/incoming/thinking batch retains five sampled
passes, one input failure and one incomplete case in 248 seconds. A subsequent
93-control input correction declares the real select-all and Delete actions;
the original undeclared-selection failure still fails independent replay. Its
new headless calibration passes separately from product counts. Two focused
product cases then pass in 61.4 seconds: exact draft growth/clear maintains a
zero-pixel end gap and passes draft/selection/focus semantics, while remote
history qualifies a sampled pass with zero drift and a 76.8 ms maximum capture
interval. Exact-input full qualification remains incomplete solely for
unmeasured caret geometry. Neither run establishes presented frames or current
production bundle bytes; the original full-corpus baseline remains unchanged.

An isolated headless Chromium 136 CDP spike can read real caret Range rectangles
from the textarea's actual user-agent Selection. Empty input and a trailing
newline return no rectangle; a UTF-16 offset inside a surrogate pair normalizes
to a different visual position. This is calibration feasibility only: no
production collector or recapture exists, and the caret gate remains open.

Portable native host checks pass 98 assertions: 45 READ seam, 36 TextKit and
17 generic MVCP controls. Their filtered macOS CI wiring is locally validated;
hosted CI has not run. Modeled UIKit/mount delivery and host TextKit controls do
not establish native app registration, complete READ behavior or presentation.

The user authorized closing the recorded blind spots, then refactoring the
scroller. The existing situation matrix and accepted policies remain the
contract. Known failures are baseline evidence, not permission to change those
policies. Mobile web remains excluded.

**Refactor entry and final qualification are separate gates.** The recorded
114 lifecycle cases (75 passing, 39 failing), independently reproduced product
failures, production-web loading cases and actual native send/control/thread
checkpoints provide a reproducible baseline for starting the refactor. Commit
that baseline without weakening its failures. Full suite qualification still
requires the remaining applicable matrix evidence; neither this decision nor a
large detector-control count establishes zero jank.

## Order and scope

1. Strengthen semantic, visible-content, input, trajectory and presentation
   evidence. Calibrate each detector with healthy and deliberately broken input.
2. Connect those checks to real desktop and native product paths. State which
   callbacks, transport, persistence and platform boundaries are substituted.
3. Reproduce the historical and current failures under the stronger checks.
   Retain raw failing attempts and incomplete captures.
4. Refactor Scroller orchestration and its coupled list/scroll state against
   that baseline. Separate readiness, request ownership, user intent, geometry,
   controls and row interactions. Renderer replacement is a separate technical
   decision requiring evidence; it is not implied by reorganizing Scroller.
5. Repeat the same checks on desktop web and iOS Simulator, then qualify the
   remaining declared platform, physical presentation, concurrency and soak
   requirements. A shorter passing run cannot stand in for those requirements.

## Gates

| Gate | Required evidence | Evidence after initial hardening, 2026-09-07 |
| --- | --- | --- |
| Semantic states | Every required request/revision phase, correct terminal state and independently specified quiet tail; injected skipped/stale phases rejected | Strict immutable phase/revision checks implemented; 12 native mutation transitions lose acquisition coverage and remain incomplete despite expected terminal state |
| Visible content | Expected child identity/text/revision, reading point, clipping and obstruction throughout capture | Real same-message image/text loading exposes 100 px interior reading drift; real uncached reference load/edit exposes 24.90/42 px drift at latest and history; general content and native paint remain unqualified |
| Input | Exact draft, selection/composition/focus, scoped delivered actions and bounded visible acknowledgement | Three actual composer cases plus incremental keyboard latest/history runs; keyboard r3 reproduces unreachable Send by Tab and an 11.5 px latest gap during Shift+Enter. Exact draft/edit/undo/redo/send subcriteria qualify; caret, IME and presented acknowledgement remain incomplete |
| Journey and ownership | Correct first reveal and target, legal trajectory, cancellation by newer input/scope and no late correction | 114 component/screen lifecycle cases record 39 failures. Actual cached-parent pending-sync cancellation passes; missing-parent reference cancellation exposes 24 unlabelled blank DOM samples spanning 337.3 ms. Three independently qualified native entry recordings add two row-model passes and a persistent 24.167 pt selected-target error. Whole native journeys and presentation remain incomplete |
| Real product integration | Actual navigation, read/unread, thread, send/echo, attachment and thinking paths with exact side effects | Desktop image/text, composer and uncached reference load/edit cases use actual conversations and normal flags. A normal App.main iOS run adds eighteen exact channel sends, actual latest activation, a correctly parented reply and thread return/reentry checkpoints across retained continuations, with independent backend readback. It is not one uninterrupted passing journey and does not qualify continuous native geometry or read/unread effects. Fixture callbacks remain separate evidence |
| Baseline | Stronger tests preserve all reproduced failures and disqualify insufficient captures | Historical seven-case desktop replay remains 1 pass / 5 fail / 1 incomplete. Four concurrent-image cases add 2 pass / 2 fail with exact 100 px interior drift in READ. New buffered native acquisition is 38 complete / 4 incomplete, separate from those 42 cases' shared product-scope replay of 9 sampled pass / 8 fail / 25 incomplete. Programmatic `near-cache` positioning cannot establish deliberate READ; acquisition complete never grants a product pass |
| Refactor regression | Same baseline corpus, accepted policies and thresholds before/after; no test-only behavior change | Raw app assertions: r2 2,022 passed / 3 skipped; r4 2,077 passed / 3 skipped; zero failures. Seven built-web cases independently qualify on the initial refactor snapshot, preserving the original clock-incomplete report. Full 42 normal-flag Vite cases ran once in 20 minutes: browser 29 passed / 13 failed; replay 27 sampled passes / 7 failures / 8 incomplete. Buffered native r1 core qualifies 4 passes / 5 failures / 29 incomplete (acquisition separately 25 complete / 13 incomplete); entry is 2 passes / 1 old-ruler failure. The uninterrupted normal native journey and independent 18+1 backend readback remain separate evidence. New follow/ruler/focus/policy/semantic/Send supplements have controls only and await recapture |
| Presentation and breadth | Presented-frame evidence, production settings, required combinations/history seeds, device/browser coverage and soak | Earlier production-web baseline content failures and subsequent initial-refactor built passes remain distinct snapshots. The full42 Vite run does not qualify delivered production-bundle bytes. One exact-composer latest case has a single 77 px RAF gap followed by zero gap 15.6 ms later: a sampled failure, not proven presented-frame jank. Native buffered model geometry and actual-app accessibility checkpoints also do not prove presented frames. Required breadth and soak remain open |

Detector controls, production component tests, product E2E, sampled geometry and
presented-frame results must be reported separately. None is a substitute for
another. Record incomplete work as incomplete rather than widening thresholds,
discarding old failures or calling every linked matrix family covered.

The r2/r4 app totals above enumerate raw assertions, excluding the same three
preexisting live provider-key checks. Vitest's 2,025/2,080 aggregate "passed"
counts include those skipped checks. Buffered native r1 retains five transient
end-gap failures and 13 invalid fixture-command cases; eventual correct end
position cannot erase them. Its selected-entry error is 24.166748 pt under the
original ruler and is not retroactively passed by the later ruler correction.

New detailed acceptance contracts are saved before their respective tests run.
This document is a work ledger, not execution evidence or a claim that the full
suite is qualified. Refactor entry depends on retaining the concrete baseline,
not on postponing all product fixes until every broader experiment is complete.

Evidence: [actual product baseline](scroller-product-baseline-2026-09-07.md),
[normal native product checkpoints](scroller-native-product-results-2026-09-07.md),
[native acquisition and qualification](scroller-native-geometry-results-2026-09-07.md),
[Scroller lifecycle plan](scroller-native-integration-plan.md), and
[screen lifecycle plan](scroller-screen-integration-plan.md).

Current refactor evidence: [refactor validation](scroller-refactor-results-2026-09-07.md).

Latest supplements: the full r5 app run has 2,151 passing assertions and the same
three preexisting skipped provider checks. The actual headless Send verification
passes both functional cases. Focused strict r3 retains one sampled pass, one
geometry failure with acquisition gaps and four incomplete cases; its final case
was interrupted for the new focus constraint. Routine browser runs now default
to headless; visible runs are explicit and the original headed/presentation
qualification requirements remain unchanged. See [browser focus](scroller-browser-focus.md).

Later targeted headless checks qualify narrower scopes without rewriting those
full-corpus results. Latest keyboard geometry passes with a maximum 0.5 px end
gap; the full keyboard importer remains incomplete under its headed-only rule.
The actual center-character Edit/Save expansion and shrink independently pass
with 0.1953125 px maximum point movement and exact fresh durable reads. Its
earlier setup, teardown and overlapping-read attempts remain incomplete.

The exact missing-parent cancellation now passes the original sampled navigation
and transport oracle plus a continuous loading-shell supplement: 161 samples,
95.3 ms maximum gap, 19 ms maximum acquisition, exact pending text and exposed
Back affordance while the GET is held, and 0 px returned-character drift through
the 1,221 ms post-response tail. The earlier 337.3 ms blank failure is retained.
Its full headed-only importer remains incomplete. Pressing the shell's Back
button, error/absence/retry, durable read effects and presentation are not
qualified. See the [pending-shell contract and results](scroller-navigation-evidence-contract.md).
These are normal-flag Vite desktop slices, not fresh built-asset byte proof,
broader matrix completion or a claim of zero presented-frame jank.
