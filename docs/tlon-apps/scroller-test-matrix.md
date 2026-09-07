# Scroller situation matrix and acceptance criteria

Status: product policies accepted by Daniel on 2026-09-06; implementation and
execution are in progress. Use the execution artifacts for verdicts; this matrix
does not imply passing results.
Prepared 2026-09-06 against `0084cc91f64472848a4e6c75da4256e13d642819`,
on the existing `db/scroll-stability-fixture` checkout, including its uncommitted
diagnostic fixture. This document comes before test implementation and execution.

The goal is **zero observed unexpected movement, wrong landings, blank content,
missed animation deadlines, or lost interactions** across a reproducible set of
scenarios. A finite suite cannot establish that no possible future execution will
ever jank. It can make every known failure mode executable, exercise adversarial
combinations, and refuse to report success without the necessary evidence.

Historical regression seeds and the scope of the history search are recorded in
[scroller-regression-history.md](scroller-regression-history.md). Historical fixes
are evidence for scenarios, not proof that the current implementation is broken
or that a replacement implementation preserves the fix.

## 1. Scope and current evidence

The primary subject is the production conversation path, including main-channel
chat, DMs, group DMs, chat threads and their real composers. The shared scroller's
gallery/notebook layouts are separate variants, not substitutes for chat proof.
Run native iOS and Android separately from desktop browsers and the desktop
wrapper: their list and keyboard implementations differ.

**User scope exclusion: mobile web.** Phone/tablet browser and mobile-web
emulation profiles are excluded from required generation and release coverage.
Retain this explicit exclusion in coverage reports; missing mobile-web runs are
not incomplete requirements. Native iOS/Android remain in scope, as do supported
narrow or short desktop windows. The recorded `1280 × 500` web viewport is
desktop width with a 500 px height, not a mobile-web case; this exclusion does
not remove its observed menu-clipping result.

| Existing surface | What it provides | What it does not establish |
| --- | --- | --- |
| `packages/app/fixtures/ScrollStability.fixture.tsx` | Real channel/message/input components, 38 automated geometry cases, armed keyboard/composer/gesture cases, measured thinking footer, native scroll bounds, actual gated image loading, raw JSON diagnostics | Full product navigation, durable read state, upload/send reconciliation, native frame pacing, or every matrix variant; observation-only cases remain incomplete |
| `packages/app/fixtures/scrollStabilityTrace.ts` | Strict sampled anchor, bottom, target, coverage, action-witness and measurement-validity oracles, with adversarial controls | Every-frame continuity or native smoothness; separate presentation evidence is required |
| `PostList/postListInitialization.test.ts` | Pure anchor readiness, fallback and scope-key rules | Actual mounted-list landing, asynchronous cancellation, reveal timing, or gestures |
| `conversationInsets.test.ts` | Pure platform inset calculations | Committed native inset/offset synchronization or interactive keyboard motion |
| Web `scroll-after-send.spec.ts` and `scroll-position-preservation.spec.ts` | Product send and navigation regression scaffolding | Continuous geometric correctness; visibility at the end cannot exclude jump-and-return |
| Web `scroller-stability.spec.ts` | Product cases with continuous DOM geometry recording and separate detector calibration | Native presentation proof, every browser/device, or every documented matrix variant |
| Web unread/thread tests; shared `threadUnreads`, `mergePendingPosts`, `useChannelPosts` tests | Read, reconciliation, and page-query contracts at their respective layers | Their effect on visible rows during concurrent gestures |
| Existing scroll/keyboard analysis | Candidate races and source-level explanations | A measured native reproduction of every hypothesis |

Relevant production sources: [native PostList](../../packages/app/ui/components/Channel/PostList/PostList.tsx),
[web PostList](../../packages/app/ui/components/Channel/PostList/PostList.web.tsx),
[Scroller](../../packages/app/ui/components/Channel/Scroller.tsx),
[channel send/read handling](../../packages/app/ui/components/Channel/index.tsx),
[thread handling](../../packages/app/ui/components/PostScreenView.tsx),
[composer placement](../../packages/app/ui/components/Channel/DraftInputView.tsx),
[DB/query invalidation](db-react-query.md).

## 2. Define intent before asserting position

Position alone is insufficient: a reader can deliberately stop 1 px above the
bottom. Record these states separately, with a conversation/parent scope and an
interaction generation:

| State | Meaning | Authority over movement |
| --- | --- | --- |
| `ENTRY` | Initial data/anchor not yet visibly established | Current entry request; cancelled by newer navigation or user movement |
| `FOLLOW` | User is following the live end | Trailing content and composer/keyboard geometry may preserve the end |
| `READ` | User is reading history, including very recent history | Preserve a stable message and its readable point |
| `DRAG` | Finger, pointer, scrollbar or accessibility gesture owns motion | User input; automatic movement must not fight it |
| `MOMENTUM` | A released gesture is still moving | Native/browser motion; content compensation may preserve continuity |
| `TARGET` | An explicit latest/start/post/reference/unread navigation is running | Newest valid request only |
| `OVERLAY` | Menu, picker, media, profile, sheet or thread covers the conversation | Preserve scoped return state; restoration can be superseded |
| `INACTIVE` | Screen/app unfocused, backgrounded, suspended or unmounted | No stale callback may affect a different conversation |

Required transitions include every outgoing transition from each state supported
by the UI, including self-transitions (second send, second target, repeated
keyboard reversal). Retain state history; a post-action `nearEnd` boolean cannot
reconstruct who owned the interaction.

### Accepted product policies

Daniel accepted all suggested policy conditions on 2026-09-06: “i agree with all
suggested policy conditions.” The contracts below define expected behavior for
the suite. The current-evidence column describes the audited implementation,
which may differ from the accepted contract; it cannot override that contract.
Name these policies in scenario data so tests cannot silently bless an accidental
behavior change. No further approval is pending for these decisions.

| Question | Current evidence | Accepted contract |
| --- | --- | --- |
| Small upward movement near bottom | Native maintenance uses a one-viewport threshold; historical web fixes repeatedly changed bottom thresholds | Deliberate movement into `READ` holds position, even inside a proximity threshold. A current implementation that snaps back fails this contract |
| Incoming messages versus resizing existing rows | Native broad end maintenance can cover both | Follow incoming content in `FOLLOW`; preserve reading position in `READ`. A resize alone must not resume follow mode |
| Own send from history | Channel and thread send schedule movement to latest | Move to the sent message/latest in the same scope; a later drag or navigation supersedes delayed completion |
| Initial unread versus selected landing | Native unread aligns to top with top inset; selected aligns to center. Web currently centers either kind of anchor | Preserve these platform-specific landings: native unread at top with top inset, native selected centered, web unread and selected centered. Apply legal-range clamping |
| Marking read | Channel code marks loaded, active, in-view conversations; thread handling has its own conditions | Preserve existing product read semantics; do not invent a per-pixel read rule. Assert exact intended channel/thread scope and no movement caused by read-state refresh |
| Missing/deleted target | Native fallback and web retry lifecycles differ | Bounded explicit fallback/recovery, no permanently hidden list, and no obsolete target resurrected after newer user intent |
| Anchor itself removed | No single surviving anchor exists | Use the next surviving visible row at its prior position; otherwise the previous one; otherwise declared boundary clamp. Record which fallback was used |
| Font/window resize makes exact retention impossible | Text and legal offsets can change | Preserve message identity plus a marked intra-message reading point when measurable, then apply the minimum legal clamp; do not require an impossible old pixel position |

`POLICY_UNRESOLVED` remains available for genuinely new behavior choices not
specified here; it does not apply to the accepted decisions above. Per-field
state persistence still needs an explicit contract where the matrix only asks
for one; agreement does not imply that every local state must persist or reset.

## 3. Acceptance criteria

All numeric values below are proposed suite targets, not measured results.
`u` means one logical point on native or one CSS pixel on web. Use device scale
when also reporting physical pixels. The default positional tolerance `epsilon`
is **1 u**, solely for coordinate/raster rounding. Report the actual maximum;
do not enlarge tolerances after a failure or average away an outlier.

### Geometry model

Each coherent sample records the native/DOM scroll offset, legal offset range,
content extent, actual applied insets, viewport bounds, obstruction bounds,
visible row frames, row identity/revision, and measurement timestamps. Compute
the unobscured reading rectangle by clipping against the real header, composer,
keyboard and other declared occlusion; do not double-subtract Android resizing
or iOS content insets. Preserve disjoint visible regions for floating keyboards
or overlays rather than pretending every obstruction is a full-width rectangle.

For a stationary reading anchor, let `r(t)` be its designated point relative to
the selected viewport reference. Unexpected error is
`abs(r(t) - expected_r(t))`. Usually `expected_r(t) = r(0)`; a scenario with a
moving viewport or an intentional animation must supply its own transformation.
Use a center-visible surviving message plus neighboring witnesses, not whichever
row happens to be returned first. For a message taller than the viewport, record
an intra-message point or intersecting edge so the fixture cannot have no anchor.

For landing, derive the ideal offset independently from measured target geometry
and the declared top/center/bottom alignment. Clamp that offset to the **actual
legal range**. Compare observed offset and visible target geometry with this
reachable result. A resolved `scrollTo*` promise or `isNearEnd` is not an oracle.
On native, `contentLength - viewportHeight - offset` alone is insufficient when
insets, short-list alignment, or keyboard obstruction are present.

| ID | Requirement | Pass criterion and failure conditions |
| --- | --- | --- |
| AC-01 | Reading continuity | Same stable anchor identity and revision-aware reading point; maximum unexpected error <= epsilon throughout every stationary interval, including transient frames; all required witness rows agree |
| AC-02 | Bottom pinning | In `FOLLOW`, the declared trailing content boundary stays at the reachable visible bottom within epsilon during atomic changes; during an explicitly allowed animation it tracks the declared trajectory and settles within epsilon. Verify newest row/footer visibility as well as offset |
| AC-03 | Exact landing | Correct target ID and top/center/bottom alignment within epsilon after legal-range clamp; no covered target. Oversized rows expose the declared edge/reading point instead of an impossible fully-visible requirement |
| AC-04 | Stable completion | Require the scenario's expected terminal content/state revision, independently of observed geometry. Landing then holds for >=200 ms and >=6 consecutive presented frames with no pending request/geometry revision relevant to that action; record through known deferred callbacks plus a 1 s quiet tail. Use a non-resetting completion deadline; a stable placeholder or endless remeasurement never passes. Streams use declared checkpoints/stop events rather than infinite global quiet |
| AC-05 | Gesture ownership | No unsolicited request takes over during drag/momentum. With unchanged layout, row displacement plus native scroll displacement has residual <= epsilon. With mutations, compare a surviving row against declared compensation, not a stationary screen position |
| AC-06 | Animation continuity | No uncommanded reversal, teleport, oscillation, or duplicate correction. Intentional spring overshoot/bounce is allowed only in its declared region/trajectory. Reduced-motion actions make one coherent change without an animated detour |
| AC-07 | No blank exposure | Zero presented frames with missing expected row content or unexplained gaps inside the visible content region. Check paint/content readiness, not just mounted container rectangles. Declared separators, short-list whitespace, placeholders and loading UI are excluded by their actual geometry |
| AC-08 | Reveal correctness | Before ready, explicit loading/empty UI is allowed. First visible content frame has the correct scope and reachable anchor; no flash at the opposite end, opacity flicker, or endless invisible list after success/failure/empty data |
| AC-09 | Identity and order | Exactly one visible presentation per logical post; correct stable ID, author, content, reaction/reply state and chronological order after reconciliation. Declared stale-while-refetch/error intermediate content is permitted, with the expected terminal revision/outcome required. No recycled state leak, wrong-row highlight, duplicate page seam, or stable stale placeholder counted as success |
| AC-10 | Read/unread correctness | Expected channel/thread read cursor, count, badge and divider according to the scenario's product policy; initial unread target remains stable while live read state changes. No unrelated thread/channel cleared and no read mutation from a stale inactive callback |
| AC-11 | Composer and keyboard | Latest/anchor remains correctly exposed; composer and list use the same committed geometry. No double inset, keyboard-sized gap, covered caret/send button, clipped multiline input, or late correction after keyboard completion |
| AC-12 | Request isolation | Every programmatic movement has scope, request ID, reason and interaction generation. Newest valid request wins; old timers/promises/pagination/overlay restoration cannot move a new scope or override later input. Superseded/missing/cancelled are explicit outcomes |
| AC-13 | Pagination progress | One effective request per boundary/cursor in flight; no duplicate insertion, lost rows or unbounded request loop. Empty/filtered pages advance or terminate correctly; errors retain content and retry works without displacing the reader |
| AC-14 | UI frame smoothness | **Zero missed app presentation deadlines attributable to the tested workload** during required motion/input windows on declared Release devices. Use platform frame completion/presentation evidence and actual refresh deadlines; 60/90/120 Hz and variable refresh must not share an assumed 16.7 ms budget |
| AC-15 | Input response | Proposed target: action-to-visible-response p95 <=50 ms, max <=100 ms, with zero dropped/duplicated keystrokes, taps, sends or gesture ownership changes. Measure locally visible acknowledgement separately from network completion |
| AC-16 | Completion latency | Cached local nonanimated target: <=250 ms from usable target data/layout to stable landing; animated local target: <=1 s. Remote targets report data wait separately and settle <=250 ms after final required geometry, unless the declared animation applies. Error/retry UI must appear within the configured operation deadline; slow network is not a license for a stuck hidden list |
| AC-17 | Resource stability | Bounded mounted rows, observers, listeners, timers, outstanding requests and trace buffers. After >=100 repeated navigation/send cycles and a 30 min soak, no monotonic leak; after idle/GC, proposed retained-memory growth <=max(10 MiB, 5% of warmed baseline). Always report absolute footprint and mounted-row counts |
| AC-18 | Valid evidence | Correct artifact, scope, action and preconditions; finite monotonic timestamps, positive viewport, unique valid row keys, no defaulted missing measurements. No dropped capture interval may silently pass. Coherent acquisition must fit one presentation interval or be marked unavailable for frame-accurate claims |
| AC-19 | User controls | Latest button, unread divider/banner, spinner, highlight, selection and menu are correct throughout the transition; no one-frame wrong affordance, covered hit target, lost focus, or scroll action on a non-target container |
| AC-20 | Recovery and cleanup | Cancellation/unmount leaves no late scroll, read/send side effect, thrown rejection or retained listener. Retry resumes from a defined state. Reopen/relaunch cannot reuse a stale scope's measurements or request ownership |
| AC-21 | Stateful row lifecycle | Each row/block owns state by logical scope, post ID, block identity and applicable content revision. Expected local/durable state survives or resets according to its declared lifecycle; no state leaks to another row. Async completion applies only to its current identity/revision. Layout effects preserve the appropriate anchor throughout every intermediate state, including state changes without new post props |
| AC-22 | Action actually exercised | Record expected pre/post semantic fingerprints and causal events: tap dispatched, load callback delivered, state changed, query invalidated/refetched, row remounted or size committed as applicable. A click that never fired, a prop edit masked by cached data, or an image that never loaded cannot yield a stability pass. Intended no-ops require their own explicit unchanged-state contract |

Strict frame results require evidence of completed/presented app frames. A JS
`requestAnimationFrame` trace measures JS/main-thread availability. A native vsync
callback alone can also fire while rendering stalls. Neither certifies AC-14.
If attribution or presentation data is unavailable, report `INCOMPLETE`, never
"zero jank." Diagnostic geometry sampled every 75–100 ms can help locate large
jumps, but cannot pass AC-01/07 at display-frame resolution.

OS interruptions, thermal events and capture loss must be labeled with evidence.
Preserve the failed/interrupted run; a successful retry does not erase it. Run
instrumented diagnosis separately from a production-equivalent Release check,
and record instrumentation overhead rather than assuming it is free.

## 4. Dimensions that multiply each situation

Every generated case contains explicit values for these dimensions. The tables
below describe families, not one test each. For example, a send case must state
main chat versus thread, follow versus history, keyboard state, composer size,
payload and delivery order.

| Dimension | Required values/boundaries |
| --- | --- |
| Surface | Group chat, DM, group DM, group-chat thread, DM thread, group-DM thread; separately gallery/notebook and their detail/reply surfaces |
| Platform scope | Native iOS/Android, desktop browsers and desktop wrapper; exclude phone/tablet browsers and mobile-web emulation profiles by user instruction |
| Dataset length | 0, 1, 2; just under/exactly/just over one viewport; page-size minus/exact/plus one; 100, 1,000, 10,000 mixed rows; dense history with long gaps |
| Position | Absolute start/end; 0.5/1/2/5 u away; either side of each actual follow/load/button threshold by epsilon; 0.5/1/3 viewports back; middle; both page seams; overscrolled boundary |
| Intent/motion | Every state in section 2; stationary after a deliberate small movement is distinct from follow mode with an incidental geometric gap |
| Entry | Cold/warm; latest/unread/selected/reference/notification/search; cached/late/missing/deleted target; return state; keyboard already open |
| Data timing | Synchronous, microtask, same frame, next frame, after layout, after 2 frames, during drag, drag release, momentum, target settle, timeout minus/exact/plus one scheduler tick |
| Mutation location | Before loaded window, before viewport, partially visible first row, anchor itself, below anchor, partially visible last row, after viewport, final row/footer |
| Payload | Every content class in section 6; homogeneous worst cases and mixed neighbors; expansion/collapse, failure/retry and late dimensions |
| Composer | Absent/read-only, empty, one line, wrap threshold ±1 character, max-height threshold ±1 line, overflow internally scrolling, quote/edit banner, attachment tray, mention suggestions |
| Keyboard | Closed, opening, open, closing, interactive partial dismissal/reversal, resized/suggestion bar, alternate IME, hardware keyboard, floating/split where supported |
| Geometry | Native small/large phone and tablet; supported narrow/wide/short desktop windows; portrait/landscape, split window, safe-area/header changes, display zoom, fractional pixel scale; no mobile-web profiles |
| Rendering | Production platform renderer/settings; cold/warm image/font/cache; dark/light; default/max supported text size; RTL and long locale strings |
| Row/block lifecycle | First mount, mounted rerender, internally triggered update with unchanged props, offscreen but mounted, unmounted by virtualization, remount from cache, explicit rekey, content-revision replacement, disposal with outstanding callbacks |
| Stateful UI | Unresolved/loading/partial/ready/error/retry; collapsed/expanded; unselected/selected/submitting/acknowledged; stale-but-cached/refetching/fresh; media stopped/playing/paused where supported |
| Lifecycle | Focused, covered, inactive, background/resume, lock/unlock, detach/reattach, unmount/remount, process restart and durable draft restore |
| Transport/cache | Online, offline, reconnect, delayed/out-of-order/duplicate echo; cached/evicted/invalidated rows; partial page, failed load, exhausted history |
| Warmth | Independently cold/warm query cache, decoded image/font cache, React row mount, child block mount and list measurement cache; a warm asset with a cold component is a distinct case |
| Input method | Touch, touchpad, wheel, mouse drag/scrollbar, keyboard navigation, screen-reader scroll; nested horizontal/vertical child gestures |
| Performance | Release 60 Hz iPhone, high-refresh iPhone, lower-tier Android, high-refresh Android; supported web engines and desktop wrapper; normal and declared loaded conditions |

Unsupported combinations must have an explicit reason, not disappear from the
denominator. Device models/OS/browser versions come from the supported fleet at
execution time; record exact values, available memory and thermal/power state.

## 5. Situation matrix

Each row is a scenario family with a stable ID. "Hold" means AC-01 in a stationary
interval; "follow" means AC-02; "land" means AC-03/04; "motion" means AC-05/06.
AC-07/09/12/18/20 apply throughout unless the scenario explicitly documents an
inapplicable criterion. Each family runs with its relevant dimension values and
the concurrency expansion in section 7. `P0` families form the first blocking
suite; `P1` families remain required for full release qualification.

### Entry, loading and explicit navigation

| ID | Priority | Situation | Required result |
| --- | --- | --- | --- |
| ENT-01 | P0 | Enter latest in empty, short, exact-fit and long conversation | Correct empty/short alignment or exact latest landing; correct first visible frame |
| ENT-02 | P0 | Enter unread at first/middle/last row and close to either boundary | Platform-specific unread landing with reachable clamp; correct divider and count |
| ENT-03 | P0 | Enter selected post from search, reference, notification or deep link | Correct scoped target, alignment and highlight; no intermediate end flash |
| ENT-04 | P0 | Data resolves before/after unread metadata; target page arrives late | Readiness follows both inputs; no wrong anchor/rekey loop |
| ENT-05 | P0 | Target absent, filtered, hidden or deleted; load succeeds empty | Explicit bounded fallback; visible UI and recovery; no dead spinner |
| ENT-06 | P0 | Target arrives just before/after fallback timeout | Defined recovery without old request overriding later intent |
| ENT-07 | P0 | Keyboard already open before mount or anchor rekey | Correct applied inset before reveal; target not under composer |
| ENT-08 | P0 | Empty → thinking → first post → populated list | Stable footer/composer and first post; no header-sized shift |
| ENT-09 | P1 | Initial load error, retry, slow page and intermittent empty response | Existing/empty UI remains usable; exactly one eventual landing |
| ENT-10 | P1 | Cold image/font/layout measurement changes immediately after reveal | Retain target/reading point; no estimate-to-measurement jump |
| NAV-01 | P0 | Tap actual latest button from history with and without newer page gaps | Load actual newest range, then land; hide control only when appropriate |
| NAV-02 | P0 | Invoke start/end/selected with animated and instant modes | Correct reachable destination and declared animation trajectory |
| NAV-03 | P0 | Navigate A → B → A and repeat the same target while it is highlighted | Latest request owns movement; repeat action still works when intended |
| NAV-04 | P0 | Start target A, then choose B before A measures/retries/completes | B wins; no delayed return to A |
| NAV-05 | P0 | Drag during initial landing or programmatic scroll | User takes ownership; no old retry/settler snap |
| NAV-06 | P0 | Target post changes height or disappears during navigation | Stable target or explicit fallback; no index-based wrong-row landing |
| NAV-07 | P1 | Target first/last/oversized row, adjacent divider, fractional offsets | Independent clamped geometry; correct visible edge and highlight |
| NAV-08 | P1 | Jump to a post in a different channel/thread while current request is pending | Correct new scope; old callbacks cannot move or mark the new view |

### Latest control visibility, transitions and actions

Added as a design prerequisite on 2026-09-06, before the corresponding new
tests. CTL and FLK IDs are required situation families, not executed variants.
Apply them to native iOS/Android and desktop web; mobile web remains excluded.

The current visibility policy must be recorded independently of the accepted
scroll-intent policy. In [Scroller](../../packages/app/ui/components/Channel/Scroller.tsx),
the current predicate is `readyToDisplayPosts && compactBottomToTop &&
anchorToEnd && !isAtBottom && (hasUnreads || !hasPressedGoToBottom || isLoading
|| hasNewerPosts)`. After a press, the pressed flag is reset when away from
bottom with loading and newer-page availability both false. This render-time
reset can cause another update and is a specific transition to observe. The
spinner predicate is `isLoading && hasPressedGoToBottom`, independent of unread
count. Loading **does not disable the control**. A control hidden inside the
current proximity threshold does not establish FOLLOW or excuse movement after
a deliberate READ gesture.

The shared list receives bottom threshold `1`: desktop web compares distance
to its measured scroll viewport; native
[useScrollDirectionTracker](../../packages/app/ui/contexts/scroll.tsx) uses the
captured window height times that ratio, with the native event's bottom inset
included in distance. Native [PostList](../../packages/app/ui/components/Channel/PostList/PostList.tsx)
also reports bottom while initial anchoring is incomplete, and before user
navigation when LegendList reports near-end. Record these distinct inputs;
do not substitute the accepted 1 u landing tolerance for a visibility threshold
or silently normalize window height to list viewport height.

[ConversationScrollToBottomButton](../../packages/app/ui/components/conversationScrollChrome.tsx)
has two presentation paths: non-glass remains mounted, switches pointer/accessibility
eligibility with `visible`, and animates opacity 0↔1, translation 4↔0 and scale
0.85↔1 over 200 ms with directional cubic easing; reduced motion uses 0 ms.
Liquid Glass mounts/unmounts directly without that opacity animation. The control
moves into the composer when Liquid Glass and positive composer inset apply;
the composer subtracts reserved scroll-control clearance from its reported
height. Require one owner and one hit target across this placement change.

A real channel press clears the around/selected cursor through
[ChannelScreen](../../packages/app/features/top/ChannelScreen.tsx) and requests
the newest range; Scroller schedules animated end movement on the next RAF only
when its current loading flag is false. Chat threads reach the same Scroller via
[PostScreenView](../../packages/app/ui/components/PostScreenView.tsx) and
[DetailView](../../packages/app/ui/components/DetailView.tsx), with thread loading
and `anchorToEnd` for chat detail. Detail does not supply the channel's cursor-clear
callback or newer-page flag. Test each actual surface's callback chain, including
non-chat detail where the button is not enabled by this predicate.

For every case record requested visibility, its predicate inputs and scope,
committed presence/opacity/transform/icon, accessibility and hit-test state,
pressed/loading phases, input dispatch, all resulting data/scroll requests and
their owner, actual target/offset and terminal state. A mounted test ID is not
proof of visibility; a hidden DOM/native wrapper must not be actionable or
announced. Compare each transition against its actual triggering revision.
Unchanged inputs permit no hide/show or spinner/chevron oscillation; genuine
boundary crossings may reverse the declared animation from its current state,
without a reset flash, extra reversal or subsequent stale animation. Do not
invent a new debounce/hysteresis rule to conceal threshold failures. Require
AC-04's settled interval and quiet tail, AC-15/16 latency, and AC-19 controls;
painted-frame and accessibility proof remain separate from geometry sampling.

The first desktop latest-control slice observes two full cycles per motion
setting. Its normal 200 ms hide duration starts at the actual eligibility
change during smooth scrolling, not at click dispatch. Record the same
wrapper's own `pointer-events: none` gate with its scope and timestamp, then
observe a fixed 250 ms fade window before the stable hidden phase. Keep the
continuous trace, at most 1,000 ms from press to that phase, monotonic normal
opacity (instant reduced motion), actual latest/bottom geometry and a full
second beyond independently marked terminal readiness. Do not poll opacity
until it happens to look correct or stop when the control first hides.

| ID | Priority | Situation | Required result |
| --- | --- | --- | --- |
| CTL-01 | P0 | Cold/warm latest, unread and selected entry; empty/short/long list; delayed anchor readiness | No control before the current anchor is ready. First eligible frame reflects the current predicate; no wrong-scope or wrong-end flash before content reveal |
| CTL-02 | P0 | Follow latest → deliberate upward READ → stop → return through the actual control threshold, both directions | Exactly the eligible show/hide transitions with correct input/accessibility eligibility. Control visibility never independently changes scroll ownership or the reading point |
| CTL-03 | P0 | Hold at threshold minus/exact/plus epsilon; fractional offsets, repeat events, tiny physical jitter, resize and content measurements arrive in either order | Boundary comparison matches the recorded platform predicate. No extra toggle from stale/duplicate measurements, self-induced clearance changes or settled threshold feedback; genuine crossings use continuous declared reversal |
| CTL-04 | P0 | Rapid show→hide→show during each 200 ms transition phase; reduced motion and Liquid Glass variants | No alpha/scale reset, one-frame reappearance or late completion of the superseded phase; final eligible state is exact. Hidden controls have no active hit target or accessibility descendants |
| CTL-05 | P0 | Chevron→loading spinner→chevron while visible, while appearing/disappearing and with unread count zero/nonzero | Icon follows `loading && pressed` without blank/duplicate glyphs or size/anchor changes. Background loading before a press does not falsely claim an active latest action. Loading alone does not disable activation |
| CTL-06 | P0 | Real control tap from cached history and from around-unread/selected range with newer pages absent locally | Bind one activation to its scope/cursor transition and effective latest request. Reach the actual newest content and unobscured legal end, not the loaded slice end; apply NAV-01 and AC-02/03/04/16 across the whole journey |
| CTL-07 | P0 | Repeated taps/keyboard activation while loading or smooth scrolling; second tap at loading completion or queued RAF | Each delivered activation has one callback acknowledgement; no duplicate page insertion, request loop or competing scroll trajectory. Latest valid request owns completion; no accidental send or non-target container movement |
| CTL-08 | P0 | Tap latest → loading/RAF/animation pending → drag, selected target, thread/channel switch or unmount | Later intent wins; old completion neither scrolls nor restores control/spinner in the new scope. Returning creates or restores only the current view's eligible control |
| CTL-09 | P0 | Latest action succeeds, receives an empty/filtered page, errors, retries or exhausts the range | Distinguish terminal success/error/cancel/superseded. No endless spinner or hidden unrecoverable action; retained content remains usable. Declare existing error UI/retry behavior; do not infer success from spinner disappearance |
| CTL-10 | P0 | Show/hide or press as keyboard/composer/tray/safe area changes; glass control changes between list and composer ownership | Exactly one visible/actionable control; correct clearance and hit region, no covered input/send button, duplicate inset or movement caused solely by control chrome |
| CTL-11 | P1 | Screen-reader or hardware-keyboard activation, focus during hide, large text, supported short/narrow desktop window and native display sizes | Correct button purpose/role, visible reachable hit region and one action. Hidden control cannot retain actionable focus or intercept input. Use actual hit testing, not bounding rectangles alone |
| CTL-12 | P0 | Visibility/pressed state races with unread refresh, remote append, row load, thinking show/hide or optimistic reconciliation | Predicate changes and scroll intent remain independently correct. No autonomous press/scroll, stale unread override, spinner flicker or oscillation after content/geometry settles |
| CTL-13 | P1 | Main channel, DM/group DM, chat thread, gallery/notebook and non-chat detail; fullscreen editor, read-only and no-composer state | Correct actual surface eligibility and callback chain. No inherited chat-only control in ineligible layout; no stale composer-context control after collection removal or remount |
| CTL-14 | P0 | Latest landing crosses the hide threshold before the animation reaches bottom, then late data/layout arrives | Early hiding at the current threshold is not accepted as completed landing. Continue observing target identity, trajectory and bottom through all relevant revisions and quiet tail; no reappearance loop or delayed wrong-end snap |

### Loading and reveal flicker

These cases make AC-07/08/09/19/21/22 executable across intermediate states; they
supplement ENT, STA, THK and CTL rather than replacing their position contracts.
Each case declares the permitted sequence of loading/placeholder/partial/cached/
ready/error states and exact terminal revision **before** execution. A requested
state, mounted row, unchanged rectangle or first successful load callback is
insufficient: verify painted identity, text/image/card content, opacity, actual
obstruction and interactivity throughout the sequence, including correct→stale
regression after a first successful reveal. Permitted spinner rotation or
placeholder animation is not a content flicker. No unexplained blank/old-content
frame is permitted; unchanged readiness/revision must not blink or remount.

Current [Channel](../../packages/app/ui/components/Channel/index.tsx) header
loading uses a **180 ms show delay** and **420 ms minimum visible interval**,
only when non-notes post loading requests it. New loading cancels a pending hide;
ending before show cancels that show; unmount clears both timers. Header text
priority in [ChannelHeader.helpers](../../packages/app/ui/components/Channel/ChannelHeader.helpers.ts)
is registered subtitle, then connection/host status, then post-loading subtitle.
These are current source contracts, not a reason to show a stale status in a new
scope. They do not impose a delay on the latest-button spinner. Scroller's entry
overlay is rendered only for a nonempty supplied post list whose current anchor
is not ready, and intercepts pointer input; verify removal and return of real
input when readiness completes. Empty, error, missing-data and thread-parent
loading follow their actual UI paths and must not be mistaken for that overlay.

Record load request/revision, timer scheduled/fired/cancelled events, actual
state commits and paint, relevant row/control hit tests, scope changes and
terminal revision. Exercise timing just before/at/after the 180/420 ms boundaries,
animation boundaries, request completion, unmount and rekey; retain actual order
and monotonic evidence time. For each intended transient phase require an
independent witness before the next phase. Missing phase, dropped frame or
unavailable paint evidence is INCOMPLETE for that criterion, never a flicker pass.

| ID | Priority | Situation | Required result |
| --- | --- | --- | --- |
| FLK-01 | P0 | Initial loading→empty/content/error and retry; latest/unread/selected anchor before/after data and layout | Only declared states are painted. Correct first visible scope/anchor, no opposite-end flash, hidden ready content or stable wrong placeholder; usable terminal success/error/empty state |
| FLK-02 | P0 | Header loading ends just before/at/after show delay; becomes visible then ends before/at/after minimum duration | Cancel short-load show; if shown, preserve configured minimum interval and remove after the applicable deadline. Exactly one eligible phase, correct label and no one-frame late spinner |
| FLK-03 | P0 | Load A schedules show/hide → load B starts/completes, channel/thread changes, unmount or background/resume, including timer-boundary equality | Cancelled timer cannot affect the next request/scope. Same-scope resumed loading cancels pending hide without blink; no inherited stale status or permanently visible spinner |
| FLK-04 | P1 | Registered loading subtitle, connecting/reconnecting, host offline, post loading and title changes occur together | Correct documented priority and terminal text at every revision, including same-size label changes; no alternating labels, hidden title flash or geometry/focus loss |
| FLK-05 | P0 | Entry overlay appears/disappears during a press, keyboard focus, scroll attempt or rekey; empty/error path follows pending data | Overlay blocks only intended underlying input while present; after removal, real row/input/control receives the intended next action. No invisible hit-intercepting layer or click-through activation on a replacement row |
| FLK-06 | P0 | Loaded history stays mounted while append/prepend/catch-up, query invalidation, reconnect or background refresh loads | Preserve the declared cached/partial content, reading point and usable controls; no full-list blank/reveal cycle, stale revision restoration or loading indicator causing a new scroll owner |
| FLK-07 | P0 | Same-props image/reference/embed goes pending→partial→ready/error→retry, with old URI/request completing after replacement | Verify every expected painted phase and terminal content; no old image, skeleton resurrection, fallback flash or empty frame between placeholder and ready. Include stable-size as well as changing-size content |
| FLK-08 | P0 | Offscreen eviction/remount or unrelated post/group refresh while image/A2UI/card state is ready; cached and uncached variants | Correct cache policy and revision survive; no transient text fallback, disabled trusted controls, stale form receipt or wrong-row content merely because parent context refreshes |
| FLK-09 | P0 | Multiple child loads or multiple rows complete/fail/retry out of order while reading, scrolling, keyboard/composer changing | Independently witness each child's current request and permitted phase; one child's readiness cannot mask another's blank/stale content. Every intermediate geometry and gesture interval still obeys STA/RAC |
| FLK-10 | P0 | Latest loading spinner, header status, entry overlay and thinking/footer transition overlap, including message handoff | Each indicator reflects its own state and priority without hiding ready content or masking another failure. No duplicate overlay, wrong spinner owner, lost control or terminal thinking/loading resurrection |
| FLK-11 | P1 | Warm cached load resolves in same frame; loading pulses during reduced motion/theme/font/viewport changes | No unnecessary blank/reset or animation detour. Preserve expected semantic/paint revision through same-size transitions; permitted animations remain continuous and do not change input eligibility incorrectly |
| FLK-12 | P0 | Correct ready state is followed by delayed old callback, failed retry, scope disposal or trace ending before known timer | Require current expected terminal revision through deferred callbacks and AC-04 quiet tail. Inject correct→stale, skipped-state, invisible-ready and missing-tail detector faults; a first matching commit or premature collector stop cannot pass |

#### First executable loading-flicker slice: delayed image at latest

Pre-execution contract: one real desktop-web channel image, at rest in FOLLOW,
using `prepareDelayedImage(page, false)` in
[scroller-stability.spec.ts](../../apps/tlon-web/e2e/scroller-stability.spec.ts).
This is **partial FLK-07/12 and STA-01**: successful same-props image loading and
terminal-state retention. It does not qualify retry/error, stale URI replacement,
multiple loads, motion overlap, native behavior or presented-frame continuity.
Mobile web remains excluded. Keep the real backend essay's declared dimensions
at 0×0; hold the unique URL response, then fulfill the known 2×1 PNG without
changing post props or injecting UI state.

Production [ImageBlock](../../packages/app/ui/components/PostContent/BlockRenderer.tsx)
starts with unknown intrinsic dimensions and aspect-ratio fallback 1, then
updates dimensions from the real `onLoad` callback. It supplies **no explicit
placeholder**. [UI Image](../../packages/ui/src/components/Image.tsx) renders an
error fallback for invalid sources/errors, not ordinary pending loading. The
permitted pending appearance is the actual measured image reservation without
decoded image pixels; do not demand a spinner, skeleton, fallback label or
invented placeholder transition. Record the real pending bounds and surrounding
caption instead of treating this declared empty image area as list blanking.

| Phase | Independent precondition/action evidence | Required sampled result |
| --- | --- | --- |
| Pending baseline | Actual unique image request is held and unreleased; original committed essay and stable post ID captured; real image element has `naturalWidth === 0`; capture at least 200 ms before release | One current-source image belongs to the expected row; original caption and post identity remain correct. Retain the measured reservation and list visibility; no error fallback or unrelated row/control flicker |
| Release and load | Record browser release-request marker, actual route fulfillment evidence, actual browser image `load`/`error` events and successful `img.decode()` completion as separate events. Install load/error observation before releasing the gate; retain each clock domain explicitly | Pending may remain until bytes load. Successful readiness is witnessed by the current source, `complete === true`, intrinsic 2×1 dimensions and decode completion; no error, wrong URI, duplicate/missing current image or whole-list hide. Observe the resulting real row-height change; do not infer loading from a changed prop or dimension alone |
| Terminal ready | Verify current expected image/content and final relevant geometry, then record at least 1,000 ms beyond that independently marked terminal start | Current source stays complete and 2×1, caption/post revision stays correct, expected image region remains exposed, and no ready→pending/error/hidden regression occurs. Preserve immutable essay and surviving row identity. FOLLOW bottom remains within the existing 1 CSS px bound through all captured geometry revisions |

Use the fixture's `[data-postid]` row identity and its exact `img[src]`, normalizing
relative `src` and resolved `currentSrc` against the document URL. Inspect the
complete image inventory in that row so a replaced/duplicate image cannot hide
behind a locator selecting one match. Observe the actual row and image elements,
not only the wrapper rectangle. Record caption text, source, loaded dimensions,
connection/identity, effective ancestor opacity, display/visibility and the
intersection with the window, list viewport and every clipping ancestor. During
stable exposed intervals the content's effective opacity is 1, with only the
existing 0.01 numeric opacity tolerance; pending image pixels are intentionally
absent and must not be judged as ready pixels. No new image fade is declared for
this case. Legitimate FOLLOW movement can clip the caption as the image grows:
require its semantic identity throughout, but judge visual exposure against the
actual clipping geometry instead of demanding an impossible fixed full-row view.
The ready phase must retain an independently established exposed image region;
offscreen content cannot provide a visibility/flicker pass.

Persist raw state and geometry traces, release/load/decode evidence, unchanged
essay proof, expected phase schedule and terminal deadline even on failure.
Keep 100 ms maximum sample gap and 32 ms maximum acquisition time as evidence
guards, not frame-rate claims. Add adversarial detector controls for temporary
opacity/list hiding, wrong/duplicate image, ready→pending or wrong source after
initial success, and missing terminal samples. A missing causal phase or capture
gap is incomplete; observed content/position failures are retained. DOM state,
load/decode and screenshots cannot prove every presented frame, so report the
sampled-content and sampled-geometry verdicts separately and keep unsupported
painted-frame flicker evidence INCOMPLETE.

#### Next executable reference slice

The [real reference evidence contract](scroller-reference-evidence-contract.md)
defines uncached reference pending → first quoted revision → actual source edit,
at latest and in history, before implementation and execution. It is a partial
CNT-11 / STA-02/03 / FLK-07/12 slice with an unchanged interior reading character;
it does not qualify every reference state or painted-frame continuity.

### Gestures and data changes

| ID | Priority | Situation | Required result |
| --- | --- | --- | --- |
| GES-01 | P0 | Slow drag, short flick and long fling in both directions | Continuous motion, no blanks, correct final legal position |
| GES-02 | P0 | Reverse direction during drag; touch again during momentum | Immediate ownership transfer, no stale velocity or automatic takeover |
| GES-03 | P0 | Begin dragging one frame after append/resize queued end maintenance | Queued work respects the new gesture |
| GES-04 | P0 | Drag → release → momentum with mutation at each handoff | No dead interval where automatic following steals movement |
| GES-05 | P0 | Deliberately move 0.5/1/2/5 u off bottom, then receive/resize | Respect declared follow policy; no trap inside near-bottom threshold |
| GES-06 | P1 | Pull beyond top/bottom, release, mutate while bouncing | Native elastic trajectory only; clamp without secondary snap |
| GES-07 | P1 | Cancel gesture via system edge navigation, modal or interrupted touch | No stuck dragging flag; correct resumption and cancellation |
| GES-08 | P1 | Nested code/media/A2UI scrolling, diagonal drag and text selection | Correct child/parent ownership; no accidental vertical jump |
| GES-09 | P1 | Sustained fling across many virtualization/page boundaries | No blank frames, state reuse, mounted-row explosion or slowdown |
| DAT-01 | P0 | Remote single append at exact end and in recent/deep history | Follow or hold according to recorded intent |
| DAT-02 | P0 | Burst of 2/10/100 incoming posts, one frame versus staggered | Follow continuously or hold; no dropped follow latch or duplicate rows |
| DAT-03 | P0 | Prepend one/many older pages at rest | Hold reading anchor through estimates and final measurement |
| DAT-04 | P0 | Prepend during drag, momentum, target animation or keyboard transition | Motion compensation; no gesture theft or jump-and-return |
| DAT-05 | P0 | Load newer history while catching up, including final page | Preserve reading intent until explicit/live follow transition |
| DAT-06 | P0 | Older/newer fetches finish out of order or in same commit | Correct order, page seams and scoped anchor |
| DAT-07 | P0 | Row grows/shrinks above, at and below the reading anchor | Hold correct reading point; resizing outside viewport does not move reader |
| DAT-08 | P0 | Delete first/last/visible anchor/all visible/all remaining rows | Surviving-anchor fallback or boundary/empty alignment; no inaccessible end |
| DAT-09 | P0 | Optimistic post moves/rekeys when server echo arrives | Exactly one logical post; stable state/position across ID reconciliation |
| DAT-10 | P1 | Empty/all-filtered/all-deleted page with more history available | Continue filling correctly without empty-page loop |
| DAT-11 | P1 | Load fails, repeated retry, exhausted cursor, duplicate page | Progress/error contract; no duplicate rows or retry-induced jump |
| DAT-12 | P1 | Simultaneous edit/reaction/reply-count changes on many rows | Correct row identity and stable anchor under batched invalidation |
| DAT-13 | P1 | Reconnect backfill, stale page response after channel switch | Merge only into proper scope; no old response landing |
| DAT-14 | P1 | Row query invalidated/evicted while offscreen, then remounted | Required refetch occurs; correct final content and no unexpected geometry jump |
| DAT-15 | P1 | Hidden/deleted/moderated state or author/group metadata changes | Correct neighboring grouping/dividers and anchor; no leaked hidden row |

### Sending, composer, keyboard and attachments

| ID | Priority | Situation | Required result |
| --- | --- | --- | --- |
| SND-01 | P0 | Send text at end and from history with keyboard open/closed | Own-send policy lands on correct newest content; composer collapses coherently |
| SND-02 | P0 | Rapid consecutive sends, incoming messages between sends | Correct order, one row per send, no competing animations |
| SND-03 | P0 | Send multiline/max-height text or quote/edit payload | Collapse and insert share a stable geometry transition |
| SND-04 | P0 | Send pending, then drag, change channel or open a thread | Later intent wins; completion cannot yank the new screen |
| SND-05 | P0 | Slow/failing send, retry success, duplicate/delayed server echo | Pending/error/sent state changes preserve identity and intended anchor |
| SND-06 | P0 | Send while older/newer pagination or catch-up is pending | Message is reachable once, correct final range and landing |
| SND-07 | P1 | Edit old/newest/oversized message; save/cancel/no-op | Edit policy remains in scope; resize holds/follows correctly |
| SND-08 | P1 | Offline send → background → reconnect → echo | Durable draft/pending state; no repeat send or late unscoped scroll |
| CMP-01 | P0 | Type/delete across every line-wrap and height threshold | Hold/follow per intent on every size revision; caret remains visible |
| CMP-02 | P0 | Paste huge multiline text, select-all/delete, undo/redo | No remount/flash, correct maximum height and internal scrolling |
| CMP-03 | P0 | Composer grows/shrinks while list is dragging or decelerating | Gesture retains ownership; no double compensation |
| CMP-04 | P0 | Add/remove quote/edit header and attachment tray | Correct single inset change and list clearance |
| CMP-05 | P1 | Mention/autocomplete panel opens, filters, selects and closes | No accidental follow/focus loss; popup and caret remain usable |
| CMP-06 | P1 | Restore saved draft on entry, including max-height/attachments | Initial measured composer included in first correct landing |
| CMP-07 | P1 | Composer disabled/hidden by read-only, permission or invitation state | Correct bottom alignment and safe-area clearance after transition |
| CMP-08 | P1 | IME composition, predictive replacement, dictation and emoji insertion | No lost text, duplicate send, caret jump or intermediate resize thrash |
| KEY-01 | P0 | Focus/dismiss at end, near end, history and empty conversation | Correct hold/follow, no covered bottom or keyboard-sized gap |
| KEY-02 | P0 | Interactive dismissal halfway, pause, reverse to reopen | Continuous composer/list geometry with no late snap |
| KEY-03 | P0 | Rapid focus/blur/open/close before previous transition completes | Latest phase wins, coherent applied insets |
| KEY-04 | P0 | Keyboard transition plus append/prepend/media resize | Position contract holds throughout combined changes |
| KEY-05 | P0 | Navigate/rekey/open thread with keyboard already open | Correct first-frame clearance in destination and restoration on return |
| KEY-06 | P1 | Switch IME/language, suggestion bar or emoji keyboard height | Recompute actual obstruction once; no stuck old height |
| KEY-07 | P1 | Hardware keyboard connect/disconnect; floating/split keyboard | Correct real occlusion and focus, no phantom full-width inset |
| KEY-08 | P1 | Rotate/resize/background while keyboard is transitioning | New geometry supersedes old callbacks; input and anchor remain reachable |
| ATT-01 | P0 | Attach/remove one or multiple images/files while typing | Tray size change holds/follows correctly; no lost draft |
| ATT-02 | P0 | Send attachment with pending upload, progress, completion and failure | One stable logical row; late dimensions preserve intended position |
| ATT-03 | P0 | Image thumbnail/full-resolution decode finishes during drag/fling | No blank placeholder collapse or unauthorized compensation |
| ATT-04 | P1 | Picker/camera/document UI cancel, permission denial and successful return | Correct draft/focus/keyboard and scroll restoration |
| ATT-05 | P1 | Remove/reorder/cancel uploading item while composer/list grows | Correct item identities, bounded progress updates, stable geometry |
| ATT-06 | P1 | Retry upload, expired URL, missing metadata, unsupported/corrupt media | Bounded fallback dimensions; no infinite growth/load loop |
| ATT-07 | P1 | Open full-screen media then return after incoming/edit/delete | Restore surviving reading point, never a stale absolute offset |
| ATT-08 | P1 | Remote attachment plus local send plus keyboard shrink in one interval | One coherent final landing with no intermediate covered newest row |

### Reads, unreads and threads

| ID | Priority | Situation | Required result |
| --- | --- | --- | --- |
| UNR-01 | P0 | Enter fully read, one unread, many unread and all unread | Correct initial target/divider/count with no later read-state reanchor |
| UNR-02 | P0 | First unread at page boundary, newest row or missing/deleted row | Reachable landing or explicit fallback, no permanent loading lock |
| UNR-03 | P0 | Mark-read response updates count/divider during initial landing | Initial snapshot and live state do not fight over anchor |
| UNR-04 | P0 | Incoming unread while reading history or scrolling toward bottom | Correct count/banner and hold/motion policy |
| UNR-05 | P0 | Thread-only unread in channel/DM with zero main unread posts | Parent/thread badge correctness; no invented main unread landing |
| UNR-06 | P0 | Open one thread among several unread threads | Clear only intended scope according to read policy; retain others |
| UNR-07 | P0 | View becomes inactive/unfocused before delayed mark-read callback | No stale read mutation; no move or unrelated badge clearing |
| UNR-08 | P1 | Mark unread manually, navigate away/back, then receive more content | Durable marker and intended re-entry position |
| UNR-09 | P1 | Another device marks read/unread while local user is reading | Correct live badges without local viewport takeover |
| UNR-10 | P1 | Delete first unread, edit read row, own-send amid unread backlog | Defined cursor/divider migration and consistent send policy |
| UNR-11 | P1 | Empty cached thread-unread result then invalidation/refetch | No permanent incorrect empty state; no transient data mistaken for authoritative completion |
| THR-01 | P0 | Open thread from top/middle/bottom parent; return repeatedly | Parent stable ID and reading offset preserved |
| THR-02 | P0 | Empty, short, long and unread thread entry | Correct parent/reply layout and target, no short-thread clipping |
| THR-03 | P0 | Send first/subsequent reply at end and from thread history | Thread-scoped send and landing, correct parent reply indicator |
| THR-04 | P0 | Selected reply reference loaded/unloaded/deleted | Exact scoped landing or explicit fallback, correct highlight |
| THR-05 | P0 | Thread data/parent height changes while reply list is visible | Stable reply anchor; header resizing cannot yank the thread |
| THR-06 | P0 | Open A, then B, close, reopen with requests still pending | No stale thread handles, scroll requests, read state or draft bleed |
| THR-07 | P1 | Main and thread receive messages simultaneously | Independent following/read policy and correct background scope |
| THR-08 | P1 | Edit/delete/reaction/quote inside thread and return to parent | Correct row/menu identity and position in both lists |
| THR-09 | P1 | Thread UI changes width/modal presentation while keyboard open | Correct responsive layout and both reading anchors |
| THR-10 | P1 | Parent deleted/hidden or thread access revoked while open | Stable explicit recovery, no crash, wrong-channel send or orphaned overlay |

### Bot thinking indicator

Exercise the actual indicator and its surrounding layout. A setter invocation
alone is not proof that it appeared or disappeared. Record indicator identity,
visibility/layout, label revision, real gesture/keyboard events and the message
handoff order. Apply AC-01/02/05/08/09/12/18/20 as relevant; indicator state is not
a message and must not independently advance a read cursor.

| ID | Priority | Situation | Required result |
| --- | --- | --- | --- |
| THK-01 | P0 | Thinking appears in an empty channel/thread, then disappears without a message | Stable empty layout, composer and header; no phantom row or inaccessible gap |
| THK-02 | P0 | Thinking appears/disappears with a populated list in FOLLOW | Latest post and indicator remain correctly reachable above the composer; no tail gap or repeated correction |
| THK-03 | P0 | Thinking appears/disappears while reading near/deep history | Hold the same reading point; indicator presence must not resume following |
| THK-04 | P0 | First or subsequent bot message arrives before, with, or after thinking removal | One coherent indicator-to-message handoff, correct row order and follow/hold intent |
| THK-05 | P0 | Thinking label changes length, wraps, or returns to a shorter label | Treat the actual label-height revision as a layout mutation; no jump or clipped indicator |
| THK-06 | P0 | Thinking appears/disappears during drag, momentum or reversal | Existing gesture owns motion; no snap to bottom or momentum cancellation |
| THK-07 | P0 | Thinking changes while keyboard opens/closes/interactively dismisses and input wraps/shrinks | Coherent effective viewport and insets; readable latest content and stable history anchor |
| THK-08 | P0 | Thinking starts/stops rapidly or duplicate presence events arrive | No duplicate indicator, geometry oscillation, stuck visible state or stale delayed removal |
| THK-09 | P0 | Channel/thread switch or background occurs while thinking expiry/reply is pending | Only the current scope changes; returning uses current state and preserved scoped position |
| THK-10 | P1 | Multiple bots think concurrently; one stops while another continues | Correct label/identity aggregation with stable geometry; one completion must not clear another bot's state |
| THK-11 | P1 | Timeout, cancellation, failed reply or reconnect clears/replaces thinking | Correct terminal state without requiring a message; no orphan indicator or repeated read/scroll side effect |
| THK-12 | P1 | Large text, narrow width, reduced motion, screen reader or long-running indicator animation | Accessible label and correct wrapping; animation respects settings and does not progressively degrade scrolling |

### Overlays, lifecycle, geometry and accessibility

| ID | Priority | Situation | Required result |
| --- | --- | --- | --- |
| OVR-01 | P0 | Long press/menu open/cancel/action at top/middle/bottom | Correct source row geometry and stable underlying list |
| OVR-02 | P0 | Reaction picker/list opens/closes and row changes size | Hold/follow policy; correct source, no covered click target |
| OVR-03 | P0 | A2UI sheet opens/closes at end/history with keyboard | Coherent inset settle and scoped restoration |
| OVR-04 | P0 | Navigate/drag/change target while deferred overlay restore is pending | New intent wins; no delayed end snap |
| OVR-05 | P1 | Profile, link, group/channel preview and media navigation/return | Preserve reading point and deliberate input focus policy |
| OVR-06 | P1 | Open overlay, source row deleted or recycled, then act/dismiss | Correct fallback and target identity; no action on another row |
| OVR-07 | P1 | Copy/select/link interaction during momentum | Expected motion interruption only; no swallowed/duplicate action |
| LIF-01 | P0 | Switch channels/tabs and navigate back at arbitrary positions | Correct scope-specific restore; no stale measurements |
| LIF-02 | P0 | Background/resume while keyboard/scroll/send/load is active | Stable recovery, no stale correction or stuck input |
| LIF-03 | P1 | Lock/unlock, system interruption and activity/view reattachment | Correct actual viewport/insets, no invisible scroll layer |
| LIF-04 | P1 | Process restart with draft, unread and selected navigation state | Restore supported durable state and explicitly reset ephemeral motion |
| LIF-05 | P1 | Rapid mount/unmount or repeated push/pop 100 times | No listeners/timers/query/mounted-row leak; no late mutation |
| GEO-01 | P0 | Header, pinned banner, safe-area or bottom control changes size | One coherent clearance change; hold/follow and correct controls |
| GEO-02 | P0 | Window width/height changes across message wrap thresholds | Retain reading identity/point and exact reachable latest/target |
| GEO-03 | P1 | Orientation, split view, desktop sidebar collapse and narrow/wide switch | No double-counted insets or lost anchor after reflow |
| GEO-04 | P1 | Text scale/display zoom/locale/RTL changes | Readable oversized content, stable semantic point and correct direction |
| GEO-05 | P1 | Theme/font load/author name/avatar/grouping update | No unintended geometry or measurement churn |
| A11Y-01 | P1 | Screen-reader next/previous/scroll and activate a partially visible post | Correct focus ID, visible target and announcement order; no focus stolen by append |
| A11Y-02 | P1 | Keyboard Tab/arrows/PageUp/PageDown/Home/End where supported | Correct container/focus/landing; composer keys retain editing semantics |
| A11Y-03 | P1 | Reduced motion, maximum text size, high contrast | Same geometry/identity guarantees with declared nonanimated behavior |
| A11Y-04 | P1 | Selection/copy across long text while content is arriving | Stable selection and expected viewport; no unrelated focus reset |

### Web/desktop, other layouts and sustained work

| ID | Priority | Situation | Required result |
| --- | --- | --- | --- |
| WEB-01 | P0 | Hover row/reaction/action bar at top/bottom and near overflow boundary | No accidental scroll extent change or anchor jump |
| WEB-02 | P0 | Fractional scrollTop, browser zoom and device scale near bottom | Accurate follow detection without rounding-induced trap or missed follow |
| WEB-03 | P0 | Trackpad/wheel burst while remote messages or resize arrive | Smooth native scrolling and correct ownership |
| WEB-04 | P1 | Drag scrollbar thumb, click track, middle-click autoscroll where supported | Correct actual scroller, no document/body movement |
| WEB-05 | P1 | Browser find/selection/focus scroll and nested embedded content | Target stays visible; automatic browser scroll does not corrupt app ownership |
| WEB-06 | P1 | Chrome/Firefox/Safari resize observation and hidden tab resume | Same position contracts, no observer loops or stale RAF-derived pass |
| WEB-07 | P1 | Desktop window minimize/restore/move between display scales | Correct measured viewport and restored content position |
| WEB-08 | P1 | Expand sidebar/thread panel while entering/reading/sending | Correct window reflow; independent parent/thread anchoring |
| LAY-01 | P1 | Gallery column count changes during selected-post navigation | Correct selected tile identity and reachable row alignment |
| LAY-02 | P1 | Notebook/gallery long items, header/footer and pagination | Their declared start/end policy; no inherited chat-only assumption |
| LAY-03 | P1 | Horizontal post-detail paging during vertical reply scrolling/editing | Correct axis/parent identity and transition; no reply list reset |
| RES-01 | P0 | Mixed-content fast fling with incoming burst and image decode | AC-14/15 on real Release devices; zero blank exposure |
| RES-02 | P1 | 30 min receive/send/scroll/navigation soak with bounded seeded workload | AC-17; no progressive stutter, growing outstanding work or drift |
| RES-03 | P1 | 10,000-row history and worst-supported oversized messages | Bounded virtualization/resources, reachable first/last/selected positions |
| RES-04 | P1 | Cold versus warm content/cache and normal versus declared CPU/IO load | Separate truthful performance results; no hidden prewarming advantage |
| RES-05 | P1 | Trace storage exhausted, collector stalls or telemetry is dropped | Explicit incomplete evidence; app remains usable and collection bounded |

## 6. Content matrix

Apply each class to first/last/anchor rows and neighbors, plus homogeneous and
mixed runs. Include fully visible, partially visible and larger-than-viewport
variants where possible. Use local deterministic assets for geometry tests;
use real upload/network paths in separate integration cases.

| ID | Content class | Required mutations/stressors |
| --- | --- | --- |
| CNT-01 | Plain text | Empty/minimal/one line/multiline/extreme length; consecutive same/different authors |
| CNT-02 | Wrapping and scripts | Long unbroken URL/word, CJK, RTL/bidi, combining characters, emoji-only, ZWJ and mixed font fallback |
| CNT-03 | Rich inline text | Links, mentions, bold/italic/strike/inline code, selected text, malformed/unsupported data fallback |
| CNT-04 | Code blocks | Many lines, very long horizontal line, syntax highlighting delayed, nested horizontal scrolling |
| CNT-05 | Structured text | Lists, block quotes, headings and tables where supported; expand/collapse and width reflow |
| CNT-06 | Images | Portrait/landscape/square/panorama/tiny/huge; known/unknown/wrong dimensions; thumbnail → full; decode error/retry |
| CNT-07 | Animated image/video | Poster/metadata/controls/playback/fullscreen return, aspect change, decoder pressure; only supported renderers |
| CNT-08 | Audio/file attachments | Progress, filename wrapping, metadata/error/unsupported fallback, controls if supported |
| CNT-09 | Multi-attachment posts | Mixed media order, one item fails/loads late, many thumbnails, caption grows |
| CNT-10 | External embeds/link previews | Skeleton → success/error, late metadata, very tall preview, navigation/return |
| CNT-11 | Channel/post/group references | Cached/uncached/deleted target, nested quote, target edited, navigate within/across scopes |
| CNT-12 | Reactions and replies | First/last reaction, multiple lines, huge counts, reply preview/footer grows/shrinks, unread reply dot |
| CNT-13 | Pending/failed/edited/deleted/hidden posts | State/ID reconciliation, tombstone/filtering, retry badge and edit marker changes |
| CNT-14 | Notices and dividers | Date boundary/timezone, unread divider, membership/system notice, first/last item changes |
| CNT-15 | A2UI cards | Streaming/batched updates, controls, menus, form validation, expand/collapse, nested scroll and modal sheet |
| CNT-16 | Thinking/loading/error/onboarding | Empty/list footer transitions, spinner/error retry, first post replaces transient content |
| CNT-17 | Headers and pinned content | Parent thread post, pinned banner, read-only/invite notice, compact/expanded header |
| CNT-18 | Gallery/notebook items | Grid aspect ratios, oversized note/document and detail/reply transitions |

Do not invent unsupported content features to claim coverage. Mark renderer
support explicitly in the manifest; unsupported formats still need a bounded,
stable fallback case. Changing a synthetic prop does not establish DB-driven
updates: fixture caches must follow the repository's explicit invalidation rules.

### Stateful content and loading lifecycle matrix

**An unchanged post object does not imply an unchanged row.** A component can
change its own state after image decode, reference lookup, layout measurement,
form interaction or another subscription. Exercise these actual callbacks and
subscriptions; a test that only replaces `posts` misses this class of behavior.

Observed examples include image dimensions set by `onLoad`, expandable transcript
state and measured table columns in
[`BlockRenderer.tsx`](../../packages/app/ui/components/PostContent/BlockRenderer.tsx),
local selection/draft/consumed-choice state in
[`A2UIBlock.tsx`](../../packages/app/ui/components/PostContent/A2UIBlock.tsx),
message hover/popover state in
[`ChatMessage.tsx`](../../packages/app/ui/components/ChatMessage/ChatMessage.tsx),
and per-post subscriptions through
[`useLivePost.ts`](../../packages/app/hooks/useLivePost.ts).

For each applicable component, declare a state contract before writing assertions:
state owner/key; triggering event; permitted intermediate render states; expected
height at each stage; whether user state survives offscreen unmount/navigation;
which content revision invalidates it; and how pending work is cancelled. Durable
form answers are different from ephemeral hover/menu state. Tests must not require
every local state to persist, or let every unexpected reset count as acceptable.

| ID | Priority | Stateful transition | Required result |
| --- | --- | --- | --- |
| STA-01 | P0 | Unknown image dimensions → decoded dimensions with unchanged post props | Correct aspect ratio and row revision; hold/follow/motion contract during the actual `onLoad` update |
| STA-02 | P0 | Placeholder → partial preview → full reference/embed content | Every intermediate height preserves intent; no zero-height flash or late secondary jump |
| STA-03 | P0 | Ready content → background refetch → changed ready content | Existing content follows declared stale-data policy; refresh is explicit and eventually correct; geometry remains coherent |
| STA-04 | P0 | Load failure → visible fallback → retry → success | Bounded fallback, correct state and size at each step; no permanent skeleton or repeated automatic retry loop |
| STA-05 | P0 | Stateful row leaves mounted window and remounts after long fling | Declared state persistence/reset and correct measurement; no one-frame other-row content/state |
| STA-06 | P0 | Row A starts async load, view is disposed/reused, A completes later | Completion cannot modify B, new scope or a superseding content revision |
| STA-07 | P0 | Same row ID gets new image URL/reference/A2UI content while old request is pending | New revision wins regardless of completion order; no old dimensions/payload flashing back |
| STA-08 | P0 | Expand/collapse long quote, citation or card while reading adjacent rows | Local state actually changes; stable witness row, no virtualization oscillation |
| STA-09 | P0 | A2UI select/type/submit → pending → success/consumed/error | Correct user state and action identity; card/footer resizing does not steal the scroller |
| STA-10 | P0 | Multiple independent children resolve inside one row in every order | Correct cumulative geometry, no dropped measurement or duplicate compensation |
| STA-11 | P0 | Several visible/offscreen rows load at once during momentum | Continuous motion, no missing paint and no unbounded bridge/measurement work |
| STA-12 | P0 | Cached row has placeholder/partial data, then invalidates/remounts | Required data refresh is observed; a permanently fresh placeholder cannot pass as loaded |
| STA-13 | P1 | Ready row invalidated, background refetch fails, then later succeeds | Distinguish retained stale data from successful refresh; stable error/recovery geometry |
| STA-14 | P1 | Stateful block reordered/inserted/deleted inside same post | State follows the correct block identity or deliberate reset, never an adjacent index |
| STA-15 | P1 | User expands/selects/types, then post receives unrelated reaction/status update | Unrelated parent rerender does not unexpectedly reset local state |
| STA-16 | P1 | Remount during keyboard transition, open menu or selected text | Defined focus/menu/selection lifecycle; no stuck portal or phantom inset |
| STA-17 | P1 | Table/text measures, updates local layout state, then measures again | Converges without render/measure loop, width oscillation or repeated scroll correction |
| STA-18 | P1 | Media play/pause/control chrome or lazy child changes row size | Stable row state and viewport; playback/loading cannot leak to a reused row |
| STA-19 | P1 | Prefetch completes offscreen versus first load on entering viewport | Equivalent final content/geometry; cold-cache path receives independent coverage |
| STA-20 | P1 | Load completes after overlay opens, then overlay closes | Both underlying row and restoration use current geometry and scope |
| STA-21 | P1 | Streamed card receives rapid incremental updates and final snapshot | Correct ordered state, stable anchor, bounded render cost, no lost user selections |
| STA-22 | P1 | Cancel/dispose/retry the same load repeatedly; immediate cache hits mixed with delayed failures | Idempotent lifecycle, no late writes or retained work; explicit outcome for each revision |
| STA-23 | P0 | Previous post is deleted/hidden/author-changed while current post props remain unchanged | Current row's neighbor subscription updates author/grouping/header geometry correctly and preserves the reading witness |
| STA-24 | P0 | Failed image source replaced by a valid source in the same mounted child | Error/dimensions/loading state belongs to the new source; old failure cannot permanently hide or mis-size the replacement |
| STA-25 | P1 | Persisted card/provider selection changes after external UI return or another mounted surface updates it | Correct scoped selection and current geometry; stale global/module state cannot leak across posts |
| STA-26 | P1 | Voice transcript expands/collapses while playback state changes globally | Correct transcript/player ownership across scroll-off/remount, stable neighbors and explicit playback persistence policy |
| STA-27 | P0 | Reveal tall hidden/moderated content, then re-hide, change block state or remount | Explicit reveal persistence; never transfer reveal permission to another post; notice/content transition preserves the reading witness |
| STA-28 | P0 | Post arrives before group/agent authorization context and durable A2UI receipts | Correct interactive/fallback/consumed state as dependencies resolve; no duplicated narrative/card or temporarily re-enabled consumed action |
| STA-29 | P0 | Rapid A2UI submit, remount while pending, receipt arrives/fails/is deleted | Exactly one action per consumed interaction; declared unlock/retry behavior, correct local-to-durable handoff and no layout jump |
| STA-30 | P1 | Play/seek during audio loading, switch to another memo, then receive old progress/acknowledgement | Current source owns playback/progress/seek; stale global callbacks cannot update a replacement block or stall vertical scrolling |

Apply every STA transition at the mutation locations and motion phases in sections
4 and 7. Include **constant `posts` array and constant row props** while internal
state changes, plus actual query invalidation and virtualized remount cases. A
synthetic prop resize is only a complementary geometry test.

Record `mount`, `unmount`, logical/block ID, content revision, request start/end,
internal-state revision, render commit, measured height and visible paint state.
Separate content loading from dimension availability: a mounted correctly sized
container can still paint nothing, and a visible image may still receive revised
dimensions later. When the anchor's own content is replaced and its reading point
no longer exists, use a preselected surviving neighboring witness and an explicit
fallback contract instead of resetting the baseline after the jump.

The current chat row path disables row recycling when `anchorToEnd` is true, but
[`ContentRenderer.tsx`](../../packages/app/ui/components/PostContent/ContentRenderer.tsx)
keys child blocks by their array index. Therefore whole-row identity tests and
within-row block-reuse tests are separate requirements. Neither a non-recycling
list nor immutable post IDs eliminate child-state reuse risks.

Additional concrete state owners for these cases are
[`ContentReference`](../../packages/app/ui/components/ContentReference/ContentReference.tsx),
[`McpConnectControl`](../../packages/app/ui/components/PostContent/McpConnectControl.tsx),
[`useOneShotAction`](../../packages/app/ui/components/PostContent/useOneShotAction.ts),
[`PostModeration`](../../packages/app/ui/components/PostModeration.tsx),
[`nowPlaying`](../../packages/app/ui/contexts/nowPlaying.tsx), and the shared
[`Image`](../../packages/ui/src/components/Image.tsx). Use simulated external
authorization results for deterministic card geometry/lifecycle coverage.

## 7. Concurrency and adversarial ordering matrix

For **each geometry-changing action** (append/prepend/edit/delete/media decode,
reaction/reply indicator, header/footer, composer/keyboard resize, page response,
read divider), schedule it during each applicable motion phase:

`rest-follow`, `rest-read`, `drag-begin`, `drag`, `drag-end`, `momentum-begin`,
`momentum`, `momentum-end`, `target-start`, `target-settle`, `keyboard-start`,
`keyboard-interactive`, `keyboard-end`, `overlay-dismiss`, `scope-dispose`.

Capture preconditions before the action and inject at real lifecycle barriers,
not a guessed sleep. For queued races, test before/on/after the relevant frame or
callback boundary. On a real device replay seeded offsets around those boundaries
and record actual event order; scheduler intent alone does not prove overlap.

| ID | Required ordered combination | Contract at risk |
| --- | --- | --- |
| RAC-01 | Resize queues end maintenance → begin drag → queued callback fires | Gesture ownership and cancellation |
| RAC-02 | Target A rejects/waits → target B succeeds → A retries | Latest request wins |
| RAC-03 | Entry/unread pending → user scroll → target data arrives | Entry must not reclaim movement |
| RAC-04 | Prepend → old row measures → new row measures while flinging | Continuous visible anchor compensation |
| RAC-05 | Keyboard opens + composer wraps + image resolves in all six orders | Coherent effective viewport, no double inset |
| RAC-06 | Send inserts pending row + composer collapses + remote echo rekeys | One stable send/landing transition |
| RAC-07 | Overlay captures end → user/nested screen changes intent → delayed restore | Scoped restoration only |
| RAC-08 | Old-scope load/send/read timer resolves after channel/thread switch | No stale scroll, read or send target |
| RAC-09 | Unread is marked read while initial anchor/divider is measuring | Stable initial anchor despite live state |
| RAC-10 | Older/newer pages and remote append arrive in every order | Stable page seams and follow intent |
| RAC-11 | Delete target/anchor while it is selected or menu is open | Surviving identity/fallback; no wrong-row action |
| RAC-12 | Attachment tray opens → keyboard resizes → send clears both | Coherent bottom clearance and caret |
| RAC-13 | Background during drag/keyboard → data changes → resume | Correct current geometry and request cancellation |
| RAC-14 | Exact end → tiny deliberate upward movement → append burst | No proximity-based scroll trap |
| RAC-15 | Layout correction repeatedly mounts/unmounts a threshold row | No oscillation, blanking or runaway measurement loop |
| RAC-16 | Read/refetch invalidation → offscreen eviction → remount while scrolling | Correct eventual content and stable measured geometry |
| RAC-17 | First post + thinking removal + header measurement + open keyboard | Empty-to-populated handoff without jump |
| RAC-18 | Width/font resize + target navigation + pagination | Reachable target after final relevant geometry; no stale index |
| RAC-19 | User interrupts smooth scroll just as momentum state changes | No second scroll owner or lost cancellation |
| RAC-20 | Same reply/content ID in different scopes + delayed highlight/restore | Scope-qualified identity and state |
| RAC-21 | Load starts → row unmounts → same/different row mounts → old completion arrives | Async identity, correct dimensions and state isolation |
| RAC-22 | User edits local card state → unrelated server update → slow prior acknowledgement | Preserve valid user state; newer revision/interaction wins |
| RAC-23 | Child A loads → row expands → child B fails → retry → row collapses during fling | Every intermediate layout obeys motion contract, no state/measurement loop |
| RAC-24 | Warm cached remount renders immediately → invalidation refetch changes content → keyboard opens | Correct stale-data policy and coherent state/geometry transitions |
| RAC-25 | Thinking removal + bot append + keyboard resize in all six completion orders | One coherent handoff; correct follow/history intent and bottom clearance |
| RAC-26 | Thinking starts → user drags upward → label changes → thinking expires | Gesture/read ownership survives every indicator revision |
| RAC-27 | Bot A starts thinking → switch scope → delayed stop/reply from A arrives while bot B thinks | Scope isolation; no stale indicator, message landing or read update |

### Coverage generation rules

1. Run all P0 families on both native platforms and each applicable desktop-web
   surface. Apply the mobile-web scope exclusion before generating combinations.
2. Run every historical regression with its original triggering geometry/data,
   adapted only where the retired implementation makes direct execution
   impossible. Retain the original failure invariant and document adaptation.
3. Fully cross `intent × mutation location × motion phase` for every
   geometry-changing action. Include threshold epsilon boundaries explicitly.
4. Fully cross the high-risk triples in RAC-05/06/10/12/17, including order
   permutations, same-frame delivery and multi-frame stagger.
5. Generate constrained pairwise combinations of the remaining dimensions and
   produce a coverage report proving each applicable pair is represented.
   Pairwise coverage supplements named/race cases; it cannot replace them.
6. Add seeded state-machine sequences of 50–200 actions. Start with 100 fixed
   seeds per platform for nightly coverage and 1,000 for release qualification.
   Run historical race seeds 20 times on each designated physical device.
   These are initial breadth targets; actual device runtime is reported.
7. Persist exact seed, initial corpus and observed event order. Minimize failing
   sequences by removing actions/data while retaining the failure; add the
   minimized sequence permanently to the historical regression corpus.
8. Report covered, not implemented, not run, unsupported, policy unresolved,
   failed and incomplete separately. Do not count a generated case as executed.

## 8. Test architecture and evidence

| Layer | Responsibility | Cannot claim |
| --- | --- | --- |
| Oracle self-tests | Inject known jump-and-return, missing anchor, bad clamp, stale scope, dropped frames and corrupted telemetry; require rejection | Product correctness or device smoothness |
| Deterministic policy/scheduler tests | Request ownership, cancellation, fallback, cursor progress, read scope and event permutations | Real input delivery or native layout behavior |
| Production-component fixture | Real rows, real list, real composer/keyboard with deterministic local data and controlled geometry changes | Real upload/DB/read/navigation correctness when callbacks are stubs |
| Product integration/E2E | Real send/reconciliation, pagination, read state, navigation, threads, uploads and controls | Native frame pacing from final screenshots or JS timers |
| Physical Release performance | Presentation deadlines, blank exposure and responsiveness with production-equivalent lifecycle/settings | Other OS/device/browser configurations or untested sequences |
| Soak/fuzz | Long sequences, leaks and rare orderings with retained seeds | Universal absence of all possible bugs |

Before product execution, prove that the detector fails for a one-frame jump
that returns to its original position, a temporarily absent anchor, the wrong
but visible target, a target under the composer, a missing final trace tail, an
out-of-order timestamp, a stale scope and a renderer stall with a healthy JS or
vsync heartbeat. Use injected faults in isolated oracle/fixture tests; no shipping
fault injection. Avoid comparing the scroller's own desired offset with itself.

Each result artifact needs:

- Scenario/version, expanded dimension values, seed, precondition evidence,
  initial data and actual ordered events.
- Commit plus dirty snapshot identity, dependency/patch lock, entry point, build
  configuration, artifact/install identity, platform/device/OS/refresh rate,
  viewport, font scale, keyboard type and relevant list settings.
- Scope/request/interaction/geometry revisions, native scroll commands with
  reasons, touch/momentum/keyboard phases, applied insets/offsets, row rectangles
  and paint readiness, visible IDs and read-state transitions.
- Frame/presentation source, capture quality, input timestamps, raw trace,
  maximum errors with offending frame/event, latency distributions, memory and
  mounted-row counts; short failure video/frame strip when it aids diagnosis.
- Verdict per applicable criterion, with actual values and explanatory reasons.
  Overall results use `PASS`, `FAIL`, `INCOMPLETE`, `NOT_RUN`, `UNSUPPORTED`, or
  `POLICY_UNRESOLVED`; only fully evidenced applicable criteria yield `PASS`.

Current fixture changes needed before claiming strict results: remove hardcoded
build provenance; sample coherent native/DOM geometry and presented frames;
record actual applied insets and trace coverage; replace `observe` verdicts with
scenario-specific assertions; retain transient missing-anchor failures; collect
bounded events without truncating scenario evidence; add actual thread/read/send/
upload/navigation adapters; make global API setup/teardown and cache cleanup
scope-safe. A fake media destination or no-op `markRead` is explicitly fixture
coverage, not the corresponding real-app test.

Web additions need stable selectors for the actual scroller/latest control,
per-frame row/viewport traces, and explicit viewport sizing on each custom browser
context. Native collection must not overload the bridge by measuring every
mounted row from JS every frame. Prefer a bounded set of witness rows and a
coherent native collector, with the richer trace enabled for failure diagnosis.

## 9. Execution order and completion gate

This document and the historical ledger are the prerequisite design artifacts.
No device run, automated test, benchmark or claim of passing coverage belongs to
this design pass.

The subsequent build-out proceeds through: detector self-tests; deterministic
regressions for the accepted policies; production-fixture P0 scenarios; real-product
thread/read/send/upload cases; physical Release frame gates; then full matrix,
seeded ordering, soak and cross-platform qualification. Known failures remain
blocking evidence rather than being weakened into observations or quarantined
without an explicit tracked reason.

Use the currently authorized repository/device workflow and an explicit target
when execution begins. Match production row recycling, rendering, cache and
keyboard behavior; a faster alternative fixture configuration is a different
experiment. Preserve existing checkout work and record the exact dirty snapshot.

Full qualification requires all applicable matrix families and historical seeds
implemented, all required expanded cases executed, no unresolved policy affecting
their verdicts, no failed/incomplete mandatory evidence, and raw results available
for independent replay. Report actual breadth, device coverage, maximum errors,
missed deadlines and remaining gaps. A large green unit-test count alone cannot
meet this gate.
