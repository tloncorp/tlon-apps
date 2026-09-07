# Continuous desktop navigation evidence

Acceptance recorded before implementation or execution. This bounded addition
uses actual local-ship conversations, ordinary application flags and the real
channel/thread navigation. Mobile web is excluded. The existing separate
before/after thread-return capture cannot establish the first reveal or the
interval while the list is replaced.

| Situation | Acceptance |
| --- | --- |
| Prepared channel history → cached thread → channel return | Declare exact routes, channel/thread row IDs and immutable text before capture. A page-owned observer records the entire journey without retaining one scroller element as its subject. Hidden stacked screens cannot supply active-view evidence. |
| First destination content | The first exposed destination list has the expected scope, exact known row content and landing: thread's newest reply at the legal bottom; channel's original reading row and interior text point at their recorded offsets within 1 CSS px. A later correct landing never excuses an earlier wrong reveal. |
| Pending navigation | The URL and visible content may commit in either order. Only the declared outgoing or destination scope may appear, with route/content convergence within 250 ms of the trusted action. Check exposed content against its actual declared scope, including a destination first reveal before the URL updates. Once destination content appears, outgoing content cannot reappear; once the destination URL arrives, the source URL cannot reappear. An explicit production progress indicator may precede content with a fixed 1 s deadline. Unlabelled blank frames are failures, not inferred loading. |
| Return retention | From the first returned content through a fixed 1 s quiet tail, scope, row identity, immutable message text, row offset and interior point remain correct. Continuous capture includes late old-thread callbacks; a wrong-scope or blank interval remains a failure even if it recovers. |
| Immediate second navigation | Request thread opening, then browser Back immediately after the thread route is observed, without waiting for content. The second request owns the destination. This cancellation variant qualifies only if capture proves the second request preceded the first destination reveal; otherwise retain it as incomplete cancellation evidence. |
| Detector calibration | Pure controls reject wrong-end flashes, early-wrong/eventual-correct landing, blank/drop, stale scope after return, incorrect text/IDs, ambiguous active lists, missing/slow samples, absent actions, missing first reveal and truncated tails. Healthy replacement and explicit bounded loading controls must pass. |

The observer records rAF and DOM-mutation observations on the same page clock,
current URL, document visibility, opaque scroll-container identities, clipped
and hit-tested DOM exposure, exact row/text witnesses, scroll bounds, loading
indicators and predeclared driver-operation brackets. It never mutates product
DOM, history or navigation. The real UI click or browser Back performs the
action. Every raw sample and operation is retained; no settle/poll may erase
earlier samples or determine the expected landing.

The capture begins at least 200 ms before the first command, has a maximum
100 ms observation gap and 32 ms measurement duration, and ends at a fixed
deadline after the final command rather than after a success poll. These are
sampled DOM continuity criteria, not physical presented-frame or click-to-paint
proof. Text clipping and hit witnesses do not establish every painted pixel.
Native behavior, durable read receipts, network delivery, arbitrary navigation,
uncached thread loading and all animation trajectories remain separate work.

The seeded plain-message wire text includes exactly one terminal ASCII space,
declared as part of each expected string before capture. R1's independent
`channel-action-2` post-add request records that serialization; it is not an
inference from the DOM alone. `convertInlineContent` in
`packages/api/src/client/postContentInlines.ts` preserves the string and
`InlineText` in `packages/app/ui/components/PostContent/InlineRenderer.tsx`
renders it unchanged. No whitespace is trimmed or normalized by the oracle.
The complete raw rendered string is retained and compared exactly. Acquisition
uses the existing `.is_ContentFrame > .is_ContentBlock > span.is_TlonText`
boundary and requires exactly one matching message block. Matching an ancestor,
author label or duplicated paragraph is not sufficient.

The first actual-app run reached both prepared channel/thread conversations but
failed before capture: the literal text acquisition did not account for that
terminal padding. Those are acquisition failures, not navigation regressions.
The original report, projected stable attachment paths and complete artifacts
are retained under `/private/tmp/scroller-navigation-product-r1-20260907*`.
The acquired shape is replayed against the real helper in DOM controls before
rerunning; no production code changes are made.

The independent request excerpt is
`/private/tmp/scroller-navigation-r1-wire-serialization.json`. After correcting
the declared wire text and using the semantic block boundary, 52 controls
passed: 41 pure navigation controls and 11 tests invoking the actual browser
helper on captured nested markup with controlled geometry. They cover the
terminal space exactly, wrong/interior whitespace, duplicate blocks, nested
inline text, preceding siblings and legitimate wrapper replacement. These
validate acquisition only. Raw result:
`/private/tmp/scroller-navigation-controls-r3-20260907.json`. Focused TypeScript
checking and scoped lint pass. The final ownership controls increase that baseline
to 55 (44 pure and 11 DOM); raw result is
`/private/tmp/scroller-navigation-controls-r4-20260907.json`.

R2 completed both real journeys. Its original failures are retained unchanged.
Both first thread lists were already correct while the URL still held the
source route for one sample. The original oracle incorrectly checked that
destination content against the outgoing channel. Before replay, the pending
navigation criterion above now explicitly permits either route/content commit
order while preserving bounded convergence, strict first reveal, exact content,
and rejection of rollback. This is an oracle correction, not a production fix.
Controls must accept both legal orders and reject wrong first content, outgoing
content restoration after reveal, undeclared scopes and late route convergence.

Independent replay contract: attachment `navigation-plan` is declared before
actions; `navigation-raw` contains all samples, driver brackets, errors and
start/end times and every trusted/untrusted click or popstate delivery;
`navigation-assessment` is diagnostic only. Exactly two declared operations
must bind to their exact targets and delivered event timestamps within the
recorded driver brackets. Extra, missing, wrong-target or out-of-command
deliveries cannot be ignored. Deadlines use source event timestamps, not a
later listener observation. Importers must
recompute `assessScrollNavigationTrace(raw, plan)` from the first two attachments
and retain its separate incompleteness dimensions. `navigation-preparation`
records normal flags, browser/version, Vite/build mode, origin, exact corpus,
routes and baseline geometry. A producer PASS cannot override raw evidence.

The standalone importer is `scripts/scroll-stability-navigation-replay.mjs`.
Its scenario registry, attachment-name function and `replayWebNavigation`
validate the exact registered contract, original corpus, normal flags, bounded
warmup, enclosing attempt duration and two navigation commands before replay.
Missing, duplicate or corrupt attachments, weakened declarations and a missed
cancellation cannot qualify even when a producer assessment says PASS.

Independent replay of unchanged r2 raw samples after the commit-order oracle
correction qualifies the ordinary journey as **PASS for sampled DOM navigation**:
307 observations, 74 ms maximum gap, 25.1 ms maximum measurement duration.
The thread first appears 88.5 ms after the click, at bottom; returned channel
content first appears 16 ms after Back with zero measured row/interior drift.
Both quiet tails are retained. The cancellation attempt is **INCOMPLETE**:
its 182 observations show the thread already exposed 251.1 ms before Back.
No retry or production change was made to obtain these replay results.
The original two failing Playwright attempts remain unchanged at
`/private/tmp/scroller-navigation-product-r2-20260907.json`; corrected independent
results are in the sibling `-replay.json`, with importer records in `-records.json`.
The seven new commit-order controls and thirteen importer controls bring the
scoped suite to 75: 51 oracle, 11 DOM acquisition and 13 importer controls.

Still open: actual cancellation before reveal, uncached/pending thread loading,
read-state effects, additional navigation routes, physical presentation and
native navigation. A cached real-conversation journey with correct sampled DOM
does not close these dimensions or prove zero painted-frame jank.

## Pending-thread cancellation additions (declared before implementation)

| Situation | Acceptance |
| --- | --- |
| Parent cached, replies absent locally, full-thread GET pending | Create committed replies in an admin context, then use a fresh reader context that has never opened the thread. Its normal channel outline contains the parent; the real thread query must report zero local replies while the intercepted full-thread GET is still held. The parent may reveal at its legal bottom with exact text. Back must be delivered after that reveal and before response release. This is cancellation of pending reply synchronization, not cancellation before first thread content. |
| Parent absent, actual reply reference opens its thread | Prepare a reply reference in another reader channel; the source parent is outside the reader's startup history. The actual reference hydrates the reply only. Clicking it uses production navigation to the missing parent. A successful local parent query with null data and an intercepted full-thread GET prove the pending path. Back must be delivered before any thread content reveals. A blank destination without an exposed production progress indicator remains a UI failure; pending transport never excuses an unlabeled blank. |
| Late original completion after Back | Retain an exact GET URL/method, request/response identity, independently read committed parent/reply essays, and timestamps on the reader clock. Release the original request only after Back has been delivered and the returned route has been sampled; preserve its real response body without rewriting. Observe at least one second after browser request completion. The returned scope, original row, interior text point and exact content must not change. Missing request interception, failed/changed response, missing local-query witness, premature release, or late/truncated capture makes that transport dimension incomplete. |
| Content and measurement ownership | Declare any quoted reply text as an ordered additional semantic block in its containing row before capture. Retain every measured block's raw text and exposure; missing/duplicate blocks remain acquisition-incomplete, while wrong text, wrong scope or a measured blank remains failure. Read the existing query cache only; never clear caches, fabricate data or invoke production navigation callbacks from the harness. |

These additions use a separate `navigation-pending` attachment, with version,
kind (`reply-sync` or `missing-parent`), exact backend parent/reply snapshot,
target request URL, fresh-context preparation, read-only local-query witnesses,
intercept/release/response/completion timestamps and the original response body.
The plan's return command declares `cancelsPending` for the cached-parent case;
the missing-parent case retains strict pre-first-reveal `cancels`. The importer
replays both DOM and transport evidence. It must preserve a UI failure even if
transport cancellation qualifies. Neither request completion nor query-cache
inspection proves durable read effects or physical presentation.

Implementation is ready for the two actual pending-request captures. **115/115
scoped controls pass**, including exact original response/author/parent binding,
local query eligibility, malformed clocks/payloads, request release ordering,
quiet tail after completion, quoted-text ownership and importer replay. A valid
held GET with a blank missing-parent sample still fails the UI oracle. Raw
controls: `/private/tmp/scroller-navigation-pending-controls-r3-20260907.json`.
Focused TypeScript and scoped lint pass. These counts are detector/contract
calibration; the two new product cases have not yet run.

Pending r1 independently qualifies the cached-parent case: 157 observations,
63.6 ms maximum gap, 19.7 ms maximum measurement, a successful local query with
zero replies while the parent reports 18, and the exact original 200 response
released after Back with a 1215.3 ms post-completion tail. The missing-parent
attempt is incomplete: its inner-text click was intercepted by the actual
pressable `ReferenceFrame`; no first navigation was delivered before timeout.
The original report, trace, independent replay and source hashes remain under
`/private/tmp/scroller-navigation-pending-product-r1-20260907*`.

Before correcting that action target, acceptance now specifies the actual
pressable reference frame and an event-path witness: exactly one reference frame
in the exact declared containing row, with the exact independently committed
reply text among its semantic content blocks. A click on the caption, another
row, a duplicate/other reference, or a synthetic event cannot satisfy it. Every
measured click and Back has an explicit timeout of at most 10 seconds. Reserve
time after setup for draining raw evidence and cleanup; a closed page records
capture-unavailable evidence and must not replace the original action error with
a secondary cleanup error. No force click, DOM attribute injection, or success
poll changes the declared destination or first-reveal acceptance.

The corrected pressable-frame/event-path implementation passes **124/124** scoped
controls, including three controls that invoke the actual page-owned collector
on reference, caption and duplicate-frame events. Six oracle controls reject
wrong row/reply, caption-only delivery, duplicate frames and untrusted input.
Raw controls: `/private/tmp/scroller-navigation-pending-controls-r4-20260907.json`.
Focused TypeScript and scoped lint pass. Only the missing-parent product case
will be captured again; r1 and its qualified cached-parent case are retained.
