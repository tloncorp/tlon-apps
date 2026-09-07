# Scroller suite results — 2026-09-06

The suite is red. It detects geometry violations; full matrix acceptance and zero
presentation jank have not been established.

## Scope

The [matrix](scroller-test-matrix.md) was created before testing: **219 situation
families and 22 acceptance criteria**. The [history audit](scroller-regression-history.md)
contains **86 regression scenarios and 109 verified commit links** from available
repository refs. This is not a claim to have found every undocumented or external
issue. The [execution guide](scroller-test-execution.md) provides repeatable commands.

There are **77 registered product variants: 21 web and 56 native**. Native includes
38 automatic cases, 14 meaningful armed cases, and four observation-only variants.
The final native execution runs the first 52. Registration covers the stated
variant, not every combination of a matrix family.

The suite includes actual delayed image requests and decoding with unchanged
post content, thinking-footer transitions, real web computing presence,
keyboard/composer interactions, sends, threads, reactions, references, edits,
unreads, viewport changes, bursts and history mutations. Loading tests distinguish
the initial data update from later internal component layout changes. Native
pairwise loading/keyboard overlap is separate from web expanded-composer and
interleaved-wheel sequences.

## Final results

| Platform | Executed variants | Qualified PASS | Geometry FAIL | INCOMPLETE |
| --- | ---: | ---: | ---: | ---: |
| Chromium web, latest evidence per variant | 21 | 15 | 4 | 2 |
| iOS Simulator, audited core and armed captures | 52 | 27 | 8 | 17 |

`PASS` means the declared sampled geometry and action evidence passed. It does
not establish every presented frame, every content type, full matrix acceptance,
or physical-device performance. Incomplete captures block acceptance too. This
table selects the latest qualified attempt per variant. Earlier valid failures
remain open evidence in the separate all-attempt report, even after a later pass.

222 controls passed separately from these product variants. This includes
adversarial tests for jump-and-return, lost witnesses, wrong destinations, missing
timing coverage, no-op rendering, invalid baselines, false interaction overlap,
and corrupted reports. Six browser detector controls are also separate from the
21 web product variants. App TypeScript checking and scoped formatting passed.

### Web findings

Four cases have valid continuous sampled geometry failures:

| Case | Observed behavior |
| --- | --- |
| Composer growth at latest | 80 px bottom gap for a 13.1 ms sampled interval before compensation |
| Return from a thread | Same reading post remains 6 px higher throughout the one-second observation |
| Incoming reply in the visible thread | 73 px transient bottom separation |
| Thinking show/clear/reply handoff at latest | Real footer appearance leaves 52 px gap for 12.8 ms; reply insertion leaves 73 px gap for 16.0 ms |

All four image-loading variants passed with explicit proof linking the held
request, decoded image, unchanged backend content, retained row identity, and
measured height change. Actual thinking presence in history also passed. Other
passes cover channel/thread own send, composer history, menu opening/dismissal,
latest and reference landing, reactions, quote preview, viewport resize, and
incoming bursts in history.

Two web cases remain incomplete: edit grow/shrink had a 188.4 ms capture gap;
latest incoming burst had a 113.2 ms gap. The latter also contains a repeated
73 px bottom separation, retained as an observation rather than a clean
whole-trace verdict. The unchanged capture limit is 100 ms.

Two additional UI limitations were preserved: Escape did not dismiss the action
menu, and at a **1280 px wide × 500 px high desktop viewport** the menu extended
below the screen and hid Edit. The geometry replays use the documented trigger
dismissal and an explicitly recorded 1280 × 800 edit viewport. They do not
establish those shorter-desktop-viewport or keyboard-dismissal behaviors.

Subsequent scope clarification: mobile web is excluded by user instruction.
These runs used desktop viewports, so that exclusion does not change the
recorded results or remove the short-desktop-window menu finding.

Full first run: 28 attempted, including two auth setups and five detector controls;
10 product cases passed and 11 failed at the runner level, taking 15.4 minutes.
After demonstrated harness corrections, 12 affected product cases were replayed
once with retries disabled: nine passed, two lacked timing coverage, and thinking
at latest failed geometry. That run took 5.5 minutes including authentication.
The latest-per-variant table preserves confirmed earlier failures; it does not
replace historical failures with a later green result.

Evidence:

- `/private/tmp/scroller-web-final-manifest.json` and
  `/private/tmp/scroller-web-final-traces/` — latest variant identity and raw samples.
- `/private/tmp/scroller-web-full-current-run.json` and
  `/private/tmp/scroller-web-full-current-artifacts/` — full first execution.
- `/private/tmp/scroller-web-focused-recapture.json` and
  `/private/tmp/scroller-web-focused-recapture-artifacts/` — corrected focused run.
- `/private/tmp/scroller-final-latest-coverage.json` — independently replayed report.

### Native findings

The audited core (`ios-core-20260906-r4`) completed 38 cases in 179.1 seconds.
Raw and replayed verdicts were 18 PASS, 16 FAIL, four INCOMPLETE. Eight raw failures
use programmatic near-bottom positions without deliberate user READ intent;
those are scope-qualified incomplete. This leaves eight geometry failures:

| Case | Measured result |
| --- | --- |
| Selected-message entry | Approximately 23.833 pt landing error across 20 settled samples |
| Prepend history | 3,795 pt displacement at sample 1 before recovery |
| Image finishes loading at latest | 234 pt bottom gap at sample 2 |
| Incoming burst at latest | 121.667 pt delayed end adjustment at sample 9 |
| Media replacement in history | 495.667 pt transient displacement at sample 1 |
| Removal in history | Maximum 146.667 pt; final 137.667 pt displacement |
| Reaction insertion in history | Persistent 42 pt displacement |
| Reply-footer insertion in history | Transient 25.667 pt displacement at sample 1 |

All 16 targeted row-mutation variants now include the expected committed target state
and actual size/removal evidence. Reference content can qualify with its exact
committed signature and post-commit native geometry without a size change.
The native reply case is the first valid execution with the metadata required
to render its footer; the earlier zero-drift reply result did not establish that.

The final 14 armed variants have nine qualified passes and five incomplete
results. Passing cases cover keyboard show at latest/history, dismissal in
history, composer growth at latest/history, thinking changes during keyboard
animation at latest/history, and image loading during keyboard animation at
latest/history. The three drag cases remain incomplete because asynchronous
measurements and unexplained extent changes prevent a synchronized displacement
judgment. Two image/composer cases miss strict overlap; the history case also
lacks an independent baseline reading witness.

`ios-armed-20260906-r3` retains all 14 initial captures. Its composer-history case
received no input because focus was not established. One focused repeat,
`ios-armed-20260906-r4`, first verified the actual keyboard and then passed with
18 input events and zero anchor drift over 273 samples. The original no-action
capture remains intact. Composer-latest also established a valid bottom baseline
and passed in this final execution; its earlier 301 pt setup gap is preserved.

Each final run directory contains `native-geometry-analysis.json` and
`qualification.json`; all passing evidence was independently replayed.

Earlier mounted-row runs remain available:

| Run | Raw PASS | Raw FAIL | Raw INCOMPLETE | Qualification |
| --- | ---: | ---: | ---: | --- |
| `ios-core-20260906-r2` | 15 | 20 | 3 | Earlier sampled evidence; estimated row acquisition |
| `ios-core-20260906-r3` | 15 | 19 | 4 | All mounted row refs measured; later audit strengthened action proof |
| `ios-armed-20260906-r2` | 8 | 3 | 3 | Qualified as eight passes and six incomplete; no confirmed armed product failure |

The r3 analysis identified eleven measured geometry violations: selected landing
off about 24.167 pt, prepend displacement of 3,795 pt, image-load bottom gap of
234 pt, burst lag of 121.667 pt, and transient/persistent history shifts. Eight
other cases used programmatic near-bottom positions and did not prove deliberate
user-gesture policy. Earlier r2 also recorded a 234 pt history-anchor shift during
real image loading. Subsequent passes do not erase those samples.

The three raw armed failures needed qualification: composer-bottom started
301 pt short of the native legal end; image/composer-history had no separate
baseline reading witness; plain drag mixed row coordinates with an older native
scroll event. Both image/composer cases received real typing and image completion
but missed strict resize overlap. Thinking/image drag witnessed real overlap but
had unexplained extent changes. The final oracles reject invalid setup or missing
effects as incomplete, retaining residual issues for diagnosis.

The combined machine-readable qualification ledger is
`/private/tmp/scroller-final-latest-coverage.json`; the preserved aggregate of
all attempts is `/private/tmp/scroller-final-all-attempts-coverage.json`.
The latter intentionally retains earlier incomplete attempts. The selected
manifest is `/private/tmp/scroller-latest-evidence-manifest.json`.

Raw native directories are under `/private/tmp/tlon-scroll-stability/` with
per-run analysis/qualification files. The first core run (`ios-core-20260906-r1`)
was INVALID_HARNESS because its fallback renderer bypassed measured wrappers;
its 34 raw failures are not product bugs.

## Provenance and limits

- Checkout: `/Users/danielbrewster/Projects/landscape-apps`.
- Branch: `db/scroll-stability-fixture`; HEAD:
  `0084cc91f64472848a4e6c75da4256e13d642819`.
- Audited native source snapshot:
  `913943b2b720cdfc65b0eec6c0e552120b4d2fb30c8e9593126dd954ace6e3c7`.
- iPhone 17 Pro Simulator, iOS 26.4,
  `47BA41EE-F11D-4FA3-A8A1-B1400A511A96`; Release arm64 fixture build.
- Installed executable and JavaScript bundle hashes matched the built artifact:
  `/private/tmp/scroller-ios-installed-provenance-r5.json`. Final wrapper check:
  `/private/tmp/scroller-ios-audited-final-verify.log`.
- Web uses isolated local zod/ten ships running the checked-out desk. No messages
  were sent to external people.

The cold native build needed the share-intent pod's deployment floor raised to
the app's existing iOS 16.4 floor and a real pod install to repair an existing
Hermes checksum mismatch. Dependency versions did not change. The diagnostic
handler initially invoked a Reanimated event object as a function; it now uses
the supported composed-handler path. Earlier launch/build logs are retained.

The audit strengthened tests rather than relaxing tolerances: prop mutations
require exact committed state plus actual size/removal evidence; reply mutations
include the metadata needed to render the footer; baseline conditions are checked;
motion overlap must occur within one matched interaction; the reporter replays
raw oracle inputs. Identical web samples at the same clock value are coalesced
and counted; changed geometry at the same timestamp is still rejected.

**Presentation remains INCOMPLETE.** Argent's installed Xcode 26.4+ path falls
back to CPU profiling. One bounded direct Animation Hitches attempt failed to
attach after 1.87 seconds while the verified app remained alive. No frame trace
was produced; `/private/tmp/scroller-native-hitches-d46fao7o/` retains the receipt
and log. Neither CPU sampling nor asynchronous geometry proves zero painted-frame
stutter. Native drag evidence currently checks displacement consistency, not
finger-coordinate/velocity fidelity.

Unimplemented combinations remain visible in the coverage inventory: complete
native navigation/read/send reconciliation, actual upload lifecycles, A2UI state
transitions, multiple simultaneous loads, cache/failure/retry permutations,
momentum and gesture takeover, complete platform/device/content combinations,
and presentation deadlines. No full family is marked accepted merely because
one mapped variant passed.

Timing: approximately 3 hours 26 minutes total wall-clock time from the recorded 18:45:37 UTC
start. The final native core took 179.1 seconds; the armed sequence spanned
289.8 seconds plus a 4.5-second focused capture. Recorded native app observation
windows total 144.3 seconds across those attempts, excluding setup and operator
time. The full web run took 15.4 minutes and focused replay 5.5 minutes, including
authentication and fixture preparation. The latest web artifacts contain 22
app observation windows totaling 55.7 seconds, excluding setup and navigation.
Most earlier elapsed time was build,
environment preparation, harness correction, and validation; this total is not
an app performance measurement.

The final report-only corrections were validated after native UI execution;
they do not change the verified native fixture bundle.

Task-owned web frontends, browsers, image gate and isolated test ships were
stopped. Argent services were stopped only for the tested Simulator; the shared
Argent server and unrelated processes/devices were preserved. Artifacts remain.

No commit, pull request, deployment, or fix for the observed scroller behavior is
claimed. Unrelated checkout changes were preserved.
