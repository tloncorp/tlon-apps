# Real browser keyboard editing evidence

This contract is recorded before the new controls and product cases run. It
extends the exact composer contract through the production web BareChatInput.
It does not change the existing fill-based evidence or acceptance thresholds.
Use the normal application flags, headed Chromium, verified local ships and
an actual overflowing conversation. Synthetic oracle controls are separate.

| Situation                          | Independently declared acceptance                                                                                                                                                                                                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Incremental typing                 | Each character has its own driver key dispatch and trusted keydown/keyup plus beforeinput/input delivery. Every intermediate exact draft and collapsed selection is acknowledged and retained. A final correct string cannot hide a lost/repeated character.                                            |
| Mid-text selection and replacement | Ten ArrowLeft operations and four Shift+ArrowRight operations select `beta` in the middle of `keyboard TOKEN alpha beta omega`; one character replaces precisely that selection and the trailing ` omega` must remain intact. Selection indices are asserted after every operation.                     |
| Delete, undo and redo              | Backspace removes the declared character. The platform undo chord restores precisely that deletion; redo reapplies it. Native inputType evidence must identify deletion/historyUndo/historyRedo.                                                                                                        |
| Focus away and return              | Tab focuses the existing send control without submitting; Shift+Tab returns to the same textarea, retaining its value and selection. An unexpected focus target is a failure, not an inferred successful blur.                                                                                          |
| Newline routing                    | Shift+Enter inserts a newline and does not submit. Subsequent individual key presses extend that multiline draft.                                                                                                                                                                                       |
| Send routing                       | Plain Enter clears the draft once through the real app. One actual channel-post request and one committed backend post have the exact expected text in the current channel; no earlier key, focus move or newline can submit.                                                                           |
| At latest                          | The baseline legal bottom gap is <=1 CSS px. Typing, selection, history edits, focus and composer reflow retain that bound throughout the capture.                                                                                                                                                      |
| READ                               | Actual upward wheel input prepares a gap >100 CSS px after composer focus. A declared visible post keeps its top within1 CSS px until Enter; that explicit own-send action may navigate to latest. Arrival is required by the declared1,000ms local landing deadline and through its1,000ms quiet tail. |

The complete command/state plan is frozen before the first dispatch. A command
may take at most250ms and has a fixed120ms observation hold afterward. Every
delivered key event retains both the browser's event.timeStamp and collector
observedAt. Require one main keydown and keyup per dispatch, the exact modifier
state and target, the expected input type/data, and no extra input/key action
outside a dispatch. Focus events must match the two declared focus transitions. A temporary `document.body` focus is allowed only between the actual blur and focus event timestamps, with the exact retained value and selection; it cannot persist after target focus.
No DOM value or selection setter is used to perform these edits.

Allow at most100ms from the main keydown to the first matching state sample;
require p95 acknowledgement <=50ms. The state must stay correct from that first
acknowledgement until the next independently dispatched command. During the
command, only its declared before/after state is permitted. Sampling gaps over
100ms, acquisitions over32ms, missing event/phase or a missing tail are
incomplete evidence. Complete witnessed content, focus, selection, routing or
position violations remain failures even if an unrelated evidence dimension
is incomplete. A baseline acquisition/precondition failure cannot be called a
mutation defect.

Capture ends at the final Enter dispatch completion plus2,000ms, independently
of observed success. Backend confirmation can be read after capture with a
bounded10-second lookup, retaining actual request time, channel, author, raw
essay and post identity. Record transport observations separately from the
original DOM key time; a Node request callback is not the input creation time.

The DOM exposes textarea value, selection offsets and focus, but not its actual
caret rectangle. Record that caret geometry as INCOMPLETE and do not substitute
a mirror. These checks are sampled DOM/input evidence, not OS keyboard hardware,
OS IME, native iOS input or presented frames. Browser protocol composition is
deferred from this bounded sequence.

Controls must accept a healthy independently authored plan and reject dropped,
duplicated, reordered, untrusted or wrong-target keys; wrong inputType/data;
selection drift; premature send/newline routing; undo/redo no-ops; stale
restoration; focus leaks; false timing/deadline declarations; invalid/gapped
capture; wrong channel/text/author backend confirmation; and transient geometry
loss with an eventually correct landing. Independent replay must rebuild the
fixed command plan and ignore producer PASS flags.

Browser focus transfer can expose `document.body` between blur and focus. That
bridge is permitted only between those actual event timestamps, with the exact
retained draft and selection. It cannot persist after the target focus event.

A separate plain native textarea/button calibration fixes the platform-native
undo contract: deleting the inserted middle `z` and undoing restores `z` selected
(start24/end25 in this corpus); redo collapses to24. Native Tab must reach a plain
button in the same browser configuration before an app Send Tab failure is
qualified. This calibration is detector evidence, never app/scroller coverage.

The existing `processLine` encoder appends one literal space to each plain
paragraph. The fixed ASCII corpus therefore requires exact editor text and,
separately, exact outgoing/committed wire text formed by adding precisely one
space per paragraph. No general trimming or whitespace normalization is allowed.
A cadence gap remains incomplete coverage; a later structurally valid sample
with valid baseline, same scope and witnessed keyboard actions can still prove
a position failure. Invalid baselines, scope changes or missing actual key
witnesses cannot be promoted to geometry failures.

## Bounded pending-send takeover regression

Declared before implementation checks and execution. One normal-app channel case
starts at latest, types `Pending send TOKEN keeps later reading intent.` and
presses actual Enter. Hold the exact outgoing post-add PUT **before forwarding**:
Urbit.poke resolves only from the matching SSE poke acknowledgement, so delaying
an HTTP response after forwarding would not establish a pending send.

Require one actual optimistic row/delivery indicator, empty draft and zero exact
matching backend posts while held. Then deliver trusted upward wheel input to the
real list and verify upward displacement greater than20px and a positive bottom
gap greater than20px. Acquire an exposed immutable reading character after motion
settles. Release the original request unchanged; require one exact backend commit
with original author/sent/content, one reconciled row and no late draft restoration
or reading-point movement beyond1px. Scope and source row identity stay fixed.
The original single-line encoder's exact trailing space remains required.

Capture continuously from before typing through a fixed release+5000ms deadline.
Actual terminal reconciliation must be witnessed by release+4000ms, and the
existing reading oracle checks its one-second terminal tail plus every other
captured reading sample through the full fixed deadline. The terminal marker
records observed completion; it cannot shorten the fixed overall observation.
Maximum sampling gap remains100ms and acquisition duration32ms. The independent
reading contract starts after the real wheel settles and before release; this
case does not apply stationary assertions during the user's motion.

Observe the existing fetch-SSE passively with CDP Network.streamResourceContent
where supported. Match the actual successful poke ID and channel request URL;
retain callback receipt timestamps separately from browser input timestamps.
Unsupported stream observation leaves callback-completion qualification incomplete.
Request held/released, backend zero/one and actual delivery reconciliation remain
separate evidence; do not replace fetch, fabricate a completion, or add a proxy.

Record actual script URLs and development-runtime detection. Reusing existing
bundled assets after test-only edits is not a new build receipt qualification and
must not be relabelled Vite development evidence. Presented pixels, native caret,
network latency and cross-scope send cancellation remain outside this one case.

### Pending-send proof replay corrections

Recorded before the new broken-proof controls. Every request hold/release/forward,
SSE receipt and sample geometry timestamp/number must be finite; missing values,
NaN and infinities cannot pass relational checks. Preserve native input timestamps
and wire receipt times as their distinct observations.

The fixed 36-message corpus fits wholly in the requested newest 50 window. The held
and terminal scries must therefore report complete windows (older/newer null,
total/newest 36 then 37), 36/37 unique canonical post IDs and matching map keys/seal
IDs. The 36 original identities and essays must survive unchanged; the only added
identity is the exact outgoing message. Grouped decimal UI IDs and ungrouped seal
IDs are compared as the same canonical positive decimal ID, without accepting
malformed separators or aliases as extra posts.

Every terminal sampled delivery row must use that committed canonical identity.
An old optimistic ID with matching text and a cleared status icon is not proof of
reconciliation. A complete but wrong terminal UI identity is a failure; malformed
or incomplete backend inventory remains incomplete evidence. A separately valid
reading-position failure remains a failure when an unrelated wire receipt is
unavailable. These checks tighten evidence qualification, not scroller policy.

### Failed own send and trusted Retry (SND-05/08; AC-09/12/20)

Declared before controls and execution. A separate normal-app case starts at
Latest, sends the exact owned text once with Enter, and holds only that matching
channel post-add request before forwarding. Once the actual pending row appears,
fail that one request locally with `blockedbyclient`. No ship, authentication,
global offline state or unrelated request changes. Require the actual failed-row
Retry affordance, empty draft, unchanged provisional identity/text, zero backend
copies, and measured legal-end gap at most1px throughout the failed interval.

Click that exposed row's real Retry affordance once and hold its new PUT. Require
a trusted click receipt with the actual provisional ID and unchanged
channel/author/sent/content with a distinct poke ID. Then deliver real upward
wheel input, acquire an exposed immutable reading-character baseline, and forward
only the held Retry request unchanged. This deliberately puts newer READ intent
after Retry; it never scrolls an offscreen Retry target back into view. Require
one real success acknowledgement, one durable reconciled post, no restored draft
or late return to Latest, and a reading point held within1px.

Reuse the existing release+5000ms fixed capture, terminal-by4000ms, one-second
tail, 100ms maximum sample gap and 32ms acquisition. Here release means forwarding
the held retry. Observe the failed state for at least200ms before Retry. Missing
Retry, unobserved/virtualized failed target, callback error or unavailable exact
transport evidence is INCOMPLETE. Independently valid wrong identity, duplicate
send or reading movement remains FAIL. Finalizers remove only this route and its
listeners even if capture export or attachment fails.

Retry timestamp correction, declared before its controls: preserve the existing
100ms Retry-to-request bound and measure it from the trusted click's native
timestamp to the browser's actual `Network.requestWillBeSent`, not the later
route observer's `heldAt`. The existing CDP session records only the exact owned
initial and Retry PUTs, including their unchanged bodies, distinct poke/request
IDs, document/loader identity, monotonic timestamp and epoch `wallTime`. Bind the
epoch timestamp to the same page's retained `performance.timeOrigin`; require
finite, ordered initiation evidence within the declared scope and before each
route hold. Preserve `heldAt` as a separate observation, not an initiation alias.
Missing, duplicate, mismatched or unavailable browser evidence remains INCOMPLETE.
This changes no sampling/acquisition limits and cannot upgrade old attempts that
lack the browser initiation record. HAR observer times are not a substitute.

Canonical replay binds the distinct title, raw attachment and attempt; producer
assessment cannot substitute for replay. Headless and headed Chromium both retain
their actual mode, while presented pixels/caret stay unqualified. This closes only
the failed-send/retry portion of SND-08. Offline, background, reconnect,
navigation-away cancellation and duplicate server-event injection remain separate
accepted situations. No product runtime has yet qualified this new case.

#### Exact rendered-string correction after the first Retry attempt

R1 observed the genuine failed row, but its rendered Retry label is exactly
`Send failed,click to retry` (no space after the comma). The plain-message leaf
retains the existing encoder's trailing space: input text plus one U+0020. Bind
those exact strings in the locator, captured event, counter and reader; do not
trim, collapse or generically normalize either. The original attempt remains
INCOMPLETE, with no Retry/READ phase executed. All geometry, phase, acquisition,
transport and fixed-tail limits remain unchanged.

R4's production build preserves a space after the comma while Vite development
omits it. The locator, Retry leaf/counter and reader therefore use only the
anchored label pattern `/^Send failed,\s*click to retry$/`. Retain the actual raw
label and every same-post, hit-target and timing check; message-body whitespace
remains exact. Other wording, prefixes or suffixes are rejected. R1–R4 remain
unchanged evidence, and this correction makes no product UI change.

R1's retained screenshot and actual DOM show the complete message/Retry text while
the row wrapper includes additional bottom padding. Visibility therefore measures
the unique message leaf and actual Retry label boxes, their ancestor clipping and
actual hit targets, not empty wrapper space. Retain these rectangles in the same
sample. Dispatch the trusted mouse click at the freshly observed Retry box
center, without locator scrolling. The existing one-pixel movement, sampling and
phase limits are unchanged; clipped or intercepted content remains INCOMPLETE.
