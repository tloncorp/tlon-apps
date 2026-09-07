# Scroller coverage gap audit — 2026-09-06

Yes: the suite still has important user-visible gaps. The existing design is
broad; execution and observability are substantially narrower. This audit
separates missing or underspecified situations from existing requirements that
have not been implemented or proved. It is a source/coverage review, not a new
test run or a claim that the potential failures below were reproduced.

Baseline: [situation matrix](scroller-test-matrix.md),
[historical seeds](scroller-regression-history.md), and
[execution results](scroller-test-results-2026-09-06.md). The 77 registered
variants and 73 executed variants are not 77 or 73 completed situation families.
Existing failures remain blocking. Candidate IDs below are audit references,
not additions to the executable registry or its coverage denominator.

Design update after the user's latest-control/loading-flicker request: the
matrix now explicitly includes **CTL-01–14** and **FLK-01–12**. These are accepted
design requirements for the new work, not evidence that any new test ran or
passed. The execution counts above describe the earlier recorded run; adding
matrix families does not increase implemented or executed variant counts.

The subsequent [control/content-flicker extension results](scroller-chrome-results-2026-09-06.md)
record three independently replayed desktop slices, four browser collector
calibrations and 250 targeted component/oracle/reporter checks. The registry is
now 80 variants. Those executions cover the explicitly named slices, not all
26 CTL/FLK families; prior failures and native presentation gaps remain open.

Scope update: mobile web (phone/tablet browsers and mobile-web emulation) is
excluded by user instruction. Apply every web candidate below to desktop
browsers only. Native phone/tablet coverage remains required. Supported narrow
or short desktop windows remain covered; the recorded `1280 × 500` case has a
500 px **height**, not a phone-width viewport.

## 1. Close these proof gaps first

All of these are already required by the matrix. They need stronger executable
checks, not relaxed acceptance criteria.

| Gap | What could remain visible despite a narrow geometry pass | Required acceptance and evidence |
| --- | --- | --- |
| P0: painted content and occlusion | Stable row rectangles with blank children, wrong text, opacity flicker, missing rows, overlapping rows, or controls covered by a portal | AC-07/09/19: verify expected visible identities, revisions, painted regions and actual obstruction/hit targets. Measure unexplained gaps and overlaps. Exempt only declared, measured whitespace/placeholders. Native `requireVisibleContent` currently asks whether any row intersects the viewport; that cannot establish complete visible content |
| P0: terminal content and each intermediate state | Expected content appears, then an old callback restores a stale image/card/reaction; repeated thinking phases skip an intermediate transition | AC-04/09/21/22: bind each phase to its request/revision and interval before supersession; require the expected final semantic revision throughout the quiet tail. Add detector faults for correct→stale and skipped phases. A first matching commit is insufficient |
| P0: real presentation and input response | One-frame jumps, repeated old frames, slow response or stutter between samples | AC-14/15/18: correlate presented frames, layout/inset revisions and timestamped input on physical Release devices. Diagnostic JS/native geometry remains useful but cannot qualify display deadlines or certify zero jank |
| P0: first reveal and the whole journey | Wrong-end flash, oscillation, duplicate correction, or a slow recovery before a correct final landing | AC-02/04/06/08/16: assert first visible content, the declared trajectory, bounded readiness-to-landing latency, deferred callbacks and terminal quiet tail. Final settling checks alone do not establish the transition |
| P1: the exact reading point | The row's top stays fixed while the paragraph or line being read moves inside it | AC-01: track a marked text/block point in oversized/reflowing rows, its revision and neighboring witnesses. Exercise the accepted next→previous→boundary fallback when that point/row disappears |
| P1: exact input and focus | Composer changes height but drops text, duplicates a character/send, moves the caret, breaks composition, or hides the send button | AC-11/15/19 and CMP-02/08: verify the complete expected draft, selection/composition state, focus, intended action count, caret and control visibility, hit testing and acknowledgement latency |
| P1: gesture fidelity | Row displacement and scroll offset agree while motion lags, goes in the wrong direction, or fights the finger | Sharpen AC-05/15 with input coordinates/deltas, direction and axis ownership, reversal/cancellation latency and platform-declared momentum behavior. Geometry consistency is only one component |

Source evidence:

- [scrollStabilityTrace.ts](../../packages/app/fixtures/scrollStabilityTrace.ts),
  lines 1–24, 523–533 and 553–556: row snapshots contain key/y/height;
  blanking checks any intersecting row; stationary checks use row origin.
- [scrollStabilityMutation.ts](../../packages/app/fixtures/scrollStabilityMutation.ts),
  lines 133–186: finds a matching commit and size transition, without requiring
  the last committed signature to remain the expected one.
- [ScrollStability.fixture.tsx](../../packages/app/fixtures/ScrollStability.fixture.tsx),
  lines 624–641, 701–713, 735–764 and 965–980: phase witnesses, input witnesses,
  final-settling configuration and displacement residual.
- [web trace helper](../../apps/tlon-web/e2e/helpers/scrollers.ts), lines 109–157:
  animation-callback DOM geometry is explicitly not compositor presentation.

These limitations do not erase observed geometry failures. They limit what a
passing sampled-geometry result means. Report every applicable AC separately;
an unevidenced criterion must remain incomplete.

## 2. Name these additional situations explicitly

Most fit existing broad families, but a generator cannot be assumed to invent
these distinct event paths from words such as “attachments” or “navigation.”
The following are proposed concrete cases and criterion refinements.

| Candidate | Existing umbrella / gap | Situation to add | Acceptance |
| --- | --- | --- | --- |
| GAP-01 · P0 | ATT-01/04/06; ingestion routes unspecified | File drag-enter/leave/drop, clipboard image/file paste, native picker and OS share into a conversation; valid+corrupt mixed batch; cancel or switch destination during async preparation | Each input is consumed once into the intended draft/scope. Failure and cancellation leave a usable draft. No wrong-conversation attachment, stale placeholder, duplicate preview or unauthorized scroll. Preserve source position and measure destination clearance |
| GAP-02 · P0 | CMP/STA; loading inside the composer unspecified | Type/paste URL A; delete/replace it with B, clear/send, edit another post, or switch channel before metadata resolves; duplicate URLs and mixed success/failure in both orders | Only currently applicable metadata may change the draft/tray. Removed previews never resurrect; loading ends; no stale preview after send or in a replacement draft. All intermediate tray heights obey hold/follow |
| GAP-03 · P0 | ATT/SND/OVR; recorder is a distinct send path | Record voice memo, permission denial, stop/preview/cancel, rapid reopen, submit while history is visible or keyboard/sheet is closing; duration/upload completes late | Recording/playback ownership stops or persists as explicitly intended. One correctly scoped send, retained draft policy, coherent sheet/composer/list geometry and no delayed reset of a new recording |
| GAP-04 · P0 | CMP-05/A11Y-02; keyboard action priority underspecified | Slash-command and mention candidates arrive/change while using arrows, Enter, Shift+Enter, Escape, IME commit or global-search shortcut | The intended layer handles the key exactly once: candidate selection, composition, edit/save, newline, send or search. No accidental send, document scroll, focus loss or jump while popup size changes |
| GAP-05 · P0 | OVR-01/06, RAC-11; press lifecycle underspecified | Press begins on a row/control; append, reflow, deletion, virtualization or overlay movement happens before release/long-press completion | Activate the original still-valid logical target or cancel according to the control contract; never activate a replacement row under the release point. No click-through after dismissal; correct menu source and usable hit region throughout |
| GAP-06 · P0 | WEB/ENT/LIF; production execution parity | Run cold/warm entry, reconnect and deferred UI with normal production flags and built production web assets, in addition to deterministic E2E mode | Record every test-only behavior difference. Qualify actual production sync ordering and rendered UI separately; a test flag that removes a path cannot prove that path. Maintain scope and correct first reveal during the normal ordering |
| GAP-07 · P1 | LIF/UNR/STA; concurrent instances underspecified | Same conversation open in two tabs/windows/views: one FOLLOW, one READ; send/edit/read in either; transfer focus, close/reopen and restore | View-local intent, focus and scroll state stay independent even when account/channel/post IDs match. Shared durable state updates correctly. Scope identity includes the owning view/request generation; no cross-window restoration or duplicate action |
| GAP-08 · P1 | LIF-04/WEB-06; browser restore and update unnamed | Browser back/forward, eligible page-cache restore, reload on a selected thread, and application/service-worker update while a draft/load/send is pending | Restore only supported durable state, correct route and reachable target. No stale hidden DOM geometry, duplicate submission, lost acknowledged draft or permanent loading. Test built web update behavior rather than inferring it from the dev server |
| GAP-09 · P1 | GEO/ENT/OVR; actual asynchronous chrome paths unnamed | Header loading show/minimum-visible/hide timers race with connection/host status, title changes and navigation; toast/tooltip/sheet appears or disappears while reading | Correct status priority, no old-scope spinner, no wrong label flash, stable clearance and real control visibility. Same-size text changes require semantic checks even when no row moves |
| GAP-10 · P1 | WEB-04/GES-08; range and edge behavior underspecified | Drag scrollbar thumb while history loads or rows resize; nested code/media/composer scroller reaches either edge during wheel/drag; direction reverses | Thumb position and size represent the current legal range. The active pointer keeps ownership and the intended destination remains reachable. Explicit child→parent edge policy; no unintended document/body or background-list movement |
| GAP-11 · P1 | GES-07/KEY/LIF; platform interactions not enumerated | Platform scroll-to-top command if enabled, interrupted edge-back gesture that is cancelled, secondary touch/pointer cancellation, and supported accessibility alternate activation | Declare supported behavior before assertions. Correct container and cancellation; no stuck gesture, focus or inset. Disabled/unsupported commands are explicit cases, not assumed app features |
| GAP-12 · P1 | RES/transport dimensions; failure pressure unspecified | Memory pressure with cache eviction, local storage/DB write failure, stalled asset decode, unavailable persistence, and power/thermal/load transitions during active work | Preserve acknowledged content and avoid false sent/saved/read success. Show bounded recovery, retain current intent and keep the app responsive. Record resource/event evidence; do not silently discard the affected run |
| GAP-13 · P1 | CNT-14/THK/LIF; clock transitions unspecified | Midnight/timezone change and forward/backward wall-clock adjustment while dates, thinking expiry, loading timers and background resume are active | Correct ordering/grouping/expiry with no negative or endless interval. Use monotonic timing for local latency evidence; wall-clock label changes cannot take scroll ownership |
| GAP-14 · P1 | OVR/ATT/SND; forwarding distinct from own send | Forward an existing message/attachment to another channel while destination selection, delayed sheet-close callback, network completion and navigation race | Exactly one send to the selected destination; source reading point preserved; correct error/retry state and toast; delayed completion cannot act on a replacement selection or draft |
| GAP-15 · P0 | AC-12/20/21, LIF; account/session generation unnamed | Logout and log into the same or another account while load/send/read/card/attachment work is pending | Old-session work cannot change the new session's content, draft, selection, read state or scrolling. No old-account flash or stale provider/card state. Distinguish account/session identity from conversation and view identity |
| GAP-16 · P1 | LAY/CMP/LIF; fullscreen editor takeover underspecified | Notebook/gallery New/Edit opens the fullscreen composer; cancel/back/save while content arrives or changes underneath | Restore the supported reading point, draft/focus and header/pinned controls after the collection remounts. No obsolete absolute offset or duplicate safe-area/keyboard clearance |
| GAP-17 · P1 | ENT-03/THR-04; source search scroller scope unclear | Replace search query while results/page requests arrive, select a reply result, then return to results | Declare the selected reply's destination and reading point; newest query owns results; stable identity and bounded pagination. The independently scrolling search-results surface needs separate coverage if included; merely reaching its parent thread is not proof of reply landing |
| GAP-18 · P0 | OVR-01/A11Y-02/AC-19; dismissal and reachability underspecified | Menu at every edge with supported short/narrow desktop or native viewport and large text: trigger dismissal, outside click, Escape, platform Back, action selection and focus return | Every required action is reachable and correctly targeted; supported dismissal routes work once, focus returns appropriately and no click reaches the underlying row. Explicitly retain the observed 1280 × 500 desktop Edit clipping and Escape limitation until their intended contracts are resolved and verified; mobile web is excluded |

Concrete production paths supporting the additions:

- [FileDrop](../../packages/app/ui/components/FileDrop/FileDrop.tsx), lines 15–49:
  asynchronous image/video preparation before delivering the batch;
  [native paste input](../../packages/app/ui/components/BareChatInput/PasteableTextInput.native.tsx),
  lines 17–24; and
  [ShareIntentForwardSheetProvider](../../apps/tlon-mobile/src/components/ShareIntentForwardSheetProvider.tsx),
  lines 72–100 and 138–175: deduplication, consumption and destination routing.
- [BareChatInput](../../packages/app/ui/components/BareChatInput/index.tsx),
  lines 93–154: web media paste intentionally works without composer focus and
  completes asynchronously; lines 704–807: debounced metadata and input-session
  ownership; lines 1023–1075: command/mention/search/send key routing.
- [AttachmentSheet](../../packages/app/ui/components/AttachmentSheet.tsx),
  lines 207–257: voice memo duration/upload and direct send, separate from the
  normal composer send path; [AudioRecorderSheet](../../packages/app/ui/components/AudioRecorder/AudioRecorderSheet.tsx),
  lines 28–54: open/close effects and delayed reset.
- [E2E context](../../apps/tlon-web/e2e/test-fixtures.ts), lines 20–23, sets
  `TLON_IS_E2E`; [sync start](../../packages/shared/src/store/sync/sync.ts), lines
  2269–2274, skips the normal one-second ordering delay under that flag.
- The flag also disables [MobileAppPromoBanner](../../packages/app/ui/components/MobileAppPromoBanner.tsx),
  lines 12–38. Its asynchronous settings and 500 ms reveal are a concrete
  production-only UI path. **It is mounted over the sidebar ChatList**, at
  [HomeSidebar](../../packages/app/navigation/desktop/HomeSidebar.tsx), lines
  325–334, not over the conversation PostList. Sidebar coverage is an adjacent
  navigation-surface extension; do not claim this proves message occlusion.
- [useAppUpdates](../../apps/tlon-web/src/logic/useAppUpdates.ts), lines 9–43 and
  74–91: service-worker update, query-cache clearing and route reload;
  [useBrowserNotifications](../../packages/app/hooks/useBrowserNotifications.ts),
  lines 87–169: account/tab-aware foreground state.
- [Channel](../../packages/app/ui/components/Channel/index.tsx), lines 532–588:
  delayed header loading lifecycle;
  [header status helper](../../packages/app/ui/components/Channel/ChannelHeader.helpers.ts),
  lines 25–39: status priority.
- [useForwardToChannelSheet](../../packages/app/ui/components/useForwardToChannelSheet.tsx),
  lines 74–107: delayed close, send, failure and toast lifecycle.
- [native logout](../../packages/app/hooks/useHandleLogout.native.ts), lines
  20–38: client/cache/session clearing and deferred DB reset within the runtime.
- [Channel collection](../../packages/app/ui/components/Channel/index.tsx),
  lines 1023–1026: fullscreen composer conditionally removes the collection;
  [NotebookInput](../../packages/app/ui/components/draftInputs/NotebookInput.tsx),
  lines 28–40 and 78–101, and
  [GalleryInput](../../packages/app/ui/components/draftInputs/GalleryInput.tsx),
  lines 280–285: presentation and safe-area changes.
- [ChannelSearchScreen](../../packages/app/features/top/ChannelSearchScreen.tsx),
  lines 52–67: a reply result opens its parent Post route; ordinary post results
  pass the selected post ID. Specify destination acceptance before claiming
  equivalent reply-target coverage.

GAP-11–13 include adversarial environmental candidates, not claims of observed
defects or universal feature support. Define applicable platform behavior and
the exact supported persistence contract before implementing them.

## 2a. Latest control and loading flicker: explicit design before execution

The [matrix's CTL and FLK sections](scroller-test-matrix.md#latest-control-visibility-transitions-and-actions)
now spell out visibility, appearance/disappearance, every transition phase,
actual activation and latest landing, loading state, threshold jitter, timer
races, terminal revision and evidence validity. These additions refine AC-19,
NAV-01, ENT/STA and GAP-09 into individually named requirements. They do not
change the accepted READ/FOLLOW or target-landing policies. Native iOS/Android
and desktop web remain in scope; mobile web remains excluded.

| Requirement now explicit | Matrix IDs | Required observation |
| --- | --- | --- |
| Initial hidden state, show/hide boundary and tiny jitter | CTL-01–03 | Current anchor readiness, actual platform threshold inputs and requested versus painted visibility. No stale callback or control-clearance feedback causes a toggle; visibility cannot grant FOLLOW ownership |
| Animation and alternate native presentation | CTL-04/10 | Non-glass 200 ms opacity/translation/scale transition and 0 ms reduced motion; Liquid Glass direct mount/unmount. Reverse from current presentation without flash; exactly one control across list/composer placement |
| Loading glyph and repeated activation | CTL-05/07/09 | Spinner is loading after a latest press; capture chevron/spinner phases, real callback count, retries and terminal outcome. Loading is not disabled in current production code; tests must not invent that rule |
| Full trip to latest and cancellation | CTL-06/08/14 | Real main-channel cursor reset/newest query versus thread callback chain, actual scroll commands, reachable newest content, trajectory, later-intent cancellation and quiet tail. Button hiding at its proximity threshold is not completed landing |
| Hit testing, focus, geometry and surface eligibility | CTL-10–13 | No hidden actionable/announced control, covered input, duplicate hit target or stale composer-context control; verify actual taps/accessibility and supported layout, not only element existence |
| Header show/minimum-visible/hide lifecycle and status priority | FLK-02–04 | Current 180 ms show delay and 420 ms minimum visible duration, cancellation/resumption at every boundary, registered→connection→post-loading label priority and exact terminal status |
| First reveal, overlay removal and refresh without blanking | FLK-01/05/06 | Correct first painted content/anchor, permitted empty/error/loading states, no invisible overlay intercepting input, no unnecessary full-list reveal cycle when retained content is valid |
| Child content flicker, remount, multiple requests and indicator overlap | FLK-07–11 | Real content/revision in every allowed phase, no wrong-image/fallback/skeleton flash, scoped current requests and stable controls even when row rectangles never change |
| Terminal stability and detector rejection | FLK-12, all CTL/FLK through AC-04/18/22 | Ready must remain the expected final revision through all relevant timers and quiet tail. Correct→stale, missing intermediate phase, hidden ready content or incomplete capture cannot pass |

Source contracts inspected for this design:

- [Scroller](../../packages/app/ui/components/Channel/Scroller.tsx): readiness,
  compact bottom-to-top layout, `anchorToEnd`, away-from-bottom, unreads,
  pressed/loading/newer-page predicates; loading icon, next-RAF command,
  pointer-intercepting initialization overlay and composer-control cleanup.
- [conversationScrollChrome](../../packages/app/ui/components/conversationScrollChrome.tsx):
  200 ms transition, reduced motion, immediate hidden pointer/accessibility
  state and alternate Liquid Glass path. Native glass exposes a button label;
  check the actual non-glass accessibility result rather than assuming parity.
- [native scroll tracker](../../packages/app/ui/contexts/scroll.tsx),
  [native PostList](../../packages/app/ui/components/Channel/PostList/PostList.tsx)
  and [web PostList](../../packages/app/ui/components/Channel/PostList/PostList.web.tsx):
  native window-height versus desktop scroll-viewport threshold inputs, initial
  native near-end guard and boundary callbacks. Preserve this source distinction
  while independently applying accepted scroll-intent and exact-landing rules.
- [ChannelScreen](../../packages/app/features/top/ChannelScreen.tsx),
  [PostScreenView](../../packages/app/ui/components/PostScreenView.tsx) and
  [DetailView](../../packages/app/ui/components/DetailView.tsx): actual channel
  latest cursor reset and distinct thread/detail integration.
- [Channel](../../packages/app/ui/components/Channel/index.tsx) and
  [header status helper](../../packages/app/ui/components/Channel/ChannelHeader.helpers.ts):
  180/420 ms post-loading timing, cancellation/unmount and header status priority.

The new implementation must publish separate state/policy, sampled geometry,
actual control interaction and painted-frame verdicts. A policy-unit pass or
an element being visible at the end cannot certify appearance/disappearance,
flicker, hit testing or the full latest trajectory. If presentation evidence is
unavailable, the flicker criterion remains incomplete. This update performed
source review and document editing only; no tests were run as part of it.

## 3. Already considered, still not fully exercised

Do not present these as newly discovered omissions from the design:

- Actual native navigation, channel/DM/group-DM/thread reads, upload/send
  reconciliation, and durable return/draft restoration. The native fixture
  stubs important product callbacks; shared unit tests do not replace this E2E
  evidence (SND, UNR, THR, ATT, LIF).
- Every stateful content class: multiple independent loads, error/retry, stale
  responses, same-ID replacement, offscreen eviction/remount, block reordering,
  A2UI local-to-durable state, media playback/transcripts and moderation
  (CNT/STA). A gated image load proves only its exercised variants.
- Actual thinking presence lifecycle on native, concurrent bots, timeout/
  cancellation/reconnect, scoped updates, changing labels and all message-handoff
  orders. Native forced-footer geometry and web real-presence variants are
  different evidence (THK/RAC-25–27).
- Three-way overlaps, all completion orders, mutations at all gesture/momentum
  handoffs and above/inside/below the actual reading point. Sequential actions
  and intended timing are not evidence of overlap (RAC and section 7).
- First/last/empty/exact-fit/huge datasets; both pagination directions, missing
  targets, threshold epsilon boundaries and extreme heterogeneous row sizes
  (ENT/NAV/DAT/RES).
- IME, dictation, hardware/floating keyboards, selection, screen readers,
  reduced motion, large text, RTL, browser zoom, window reflow and actual
  small-viewport menu/control reachability (CMP/KEY/GEO/A11Y/WEB).
- Android, physical iPhones, refresh-rate variants, Firefox/Safari, desktop
  wrapper and the supported device fleet. Chromium plus an iOS Simulator does
  not qualify those platforms.
- The specified constrained combinations, seeded 50–200-action sequences,
  historical race repeats, 10,000-row histories and 30-minute soak/resource
  checks. A registry mapping does not mean its original historical seed ran.

The execution report also retains an observed 1280 × 500 desktop menu
reachability problem and an Escape dismissal limitation. Using a taller
edit-test viewport or the supported trigger to dismiss a menu does not qualify
those other paths. Excluding mobile web does not exclude these desktop findings.

## 4. Recommended order

1. Fix the oracle gaps that could miss visible content, terminal-state, input
   or transition failures, and add injected-fault controls for each.
2. Preserve and address the currently reproduced geometry failures; capture
   the missing real gesture and presentation evidence.
3. Implement the production native integrations and GAP-01–06/14/15/18 event paths,
   with exact payload/focus/side-effect checks as well as position checks.
4. Expand existing loading/race/accessibility/platform cases and the remaining
   candidate factors through the matrix's constrained generation and soak plan.

Every resulting case should identify the action path, corpus, initial intent,
view/scope, expected semantic states, event order, applicable ACs, and evidence
source. Publish separate geometry, content, input, lifecycle and presentation
verdicts. Neither more scenario names nor a single aggregate green count can
substitute for those measurements.
