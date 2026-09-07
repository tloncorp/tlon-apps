# Native screen integration acceptance

Recorded before execution. These tests render the production `ChannelScreen`
and `PostScreenView` and exercise their real callback/effect wiring. Physical
views, navigation, database reads and transport writes are observable boundaries.
Promises and timers are controlled so exact ordering is deterministic. The
tests do not replace React Query, SQLite invalidation, backend acknowledgements,
native gestures or presented-frame evidence. Mobile web is excluded.

The local DB/React Query contract was read before designing these tests:
`staleTime: Infinity` requires explicit invalidation; cached values may survive
invalidations and failed refreshes. No test below infers a durable database or
cache update from invoking a mocked write. It checks exact arguments, scope and
timing at the production screen boundary.

## Channel screen situations

| ID | Situation | Acceptance |
| --- | --- | --- |
| CS-01 | Entry with deferred unread snapshot and cached posts | Posts query remains disabled and Channel does not mount before the current entry snapshot resolves; unread entry selects the exact around cursor |
| CS-02 | Latest while selected/unread history or newest page is loading | Actual latest callback retires cursor, requests newest/50 query, removes selected navigation param once and does not restore retired unread cursor when the router applies the change |
| CS-03 | A new selection, channel, or focused visit follows latest | A new valid selected/unread cursor belongs to that entry; retained draft surface may survive refresh, but old snapshot work cannot enable reads for the replacement |
| CS-04 | Old unread promise resolves after channel switch, blur, unmount or A→B→A | Only the current focused entry's request can publish unread state or enable its posts query; all stale completion orders are ignored |
| CS-05 | Mark-read while unfocused, initializing, pending, or after callback ownership changes | Only current, focused, initialized, nonpending channel may issue an exact channel/group read write; captured old callbacks cannot acknowledge a replacement or disposed view |
| CS-06 | Around query fails, target is deleted, or sparse/hidden older pages load | The screen falls back only for applicable unread/hidden targets, preserves explicit selection otherwise, loads older pages only while eligible, and forwards exact live pagination callbacks |
| CS-07 | Thread-unread sync overlaps navigation/unmount or pending channel resolution | The previous request's AbortSignal is aborted; the new eligible channel has its own live request |
| CS-08 | Failed send/edit/delete retry and asynchronous DM navigation | Retry dispatches exact post/channel/edit metadata once. A DM completion after screen disposal or scope replacement cannot push a stale destination |

## Thread screen situations

| ID | Situation | Acceptance |
| --- | --- | --- |
| PS-01 | Deferred initial thread unread snapshot resolves before/after parent replacement | Only current parent/visit may publish the initial divider; stale completion or stale retained snapshot cannot replace the current one |
| PS-02 | Thread read timer overlaps unread clearing, activity loss, new reply, scope change or unmount | No write before 150 ms; exactly current eligible channel/parent/latest reply is marked; obsolete timers are cancelled |
| PS-03 | New reply send, edit, failure, deferred completion or replacement | New reply targets current parent once, edit keeps its own target, failure does not scroll; successful current reply requests one next-frame end command; obsolete completion cannot scroll replacement/disposed thread |
| PS-04 | Ref points to parent/loaded reply, missing reply, other thread or channel | Existing same-thread target gets one exact centered scroll/highlight without navigation; otherwise the real navigation boundary receives the exact destination |
| PS-05 | Selected reply becomes hidden, highlight is replaced, or user exits | Hidden replies are not anchored/highlighted, replacement highlight gets its full own duration, and leaving clears attachments exactly once before navigation |

## Evidence scope

### Additional lifecycle acceptance, recorded before the next baseline

| ID | Situation | Acceptance |
| --- | --- | --- |
| CS-09 | Capture latest for selected A, then select B before invoking that old callback | B's around query and route selection remain intact; the obsolete callback cannot issue a route-param clear |
| CS-10a | Capture an initialized read callback, blur/refocus, then initialize a fresh unread snapshot | Old callback cannot write while the new snapshot is pending or after it becomes ready; the new current callback writes the exact current channel/group once |
| CS-10b | Initialized channel becomes pending and later resolves with the same ID | Revocation permanently retires the old read permit; the restored current callback may write once |
| CS-10c | Initialized channel A is replaced by B and a newly initialized A visit | Old A's callback remains retired despite equal IDs; only the new A callback may write |
| PS-06 | Same-channel thread A→B→A with all six completion orders of old-A/B/new-A unread requests | At every intermediate step only the new A request may publish a divider; a final correct value cannot hide a stale intermediate divider |
| PS-07a | Old A send resolves after same-channel A→B→A | Preserve the original send target, but do not scroll the new visit |
| PS-07b | Old A send resolves and queues a frame before same-channel A→B→A | Even delivery of the captured old frame cannot scroll the replacement visit |
| PS-08 | Current focused thread read eligibility changes active→inactive→active while a timer is pending | Revocation cancels the first deadline; reactivation waits a full fresh 150 ms and then writes the exact current parent/latest reply once |

These add 13 screen lifecycle integration cases (PS-06 expands to six orders)
and complement three new Scroller lifecycle cases. Database reads, transport,
navigation and native list surfaces remain controlled boundaries. No visible
native behavior, geometry, frame pacing or presentation pass is inferred.

These are screen integration checks above the previous native fixture's no-op
load/read seams. They observe real query selection and screen-owned callback
behavior; a store hook receives controlled data and no query engine is claimed
to have loaded a page. A DetailView boundary records imperative commands without
calculating geometry. Final acceptance still requires actual app navigation,
network pagination, durable read receipts, real input/send reconciliation and
native presentation measurement.

## Baseline

The final baseline ran **53 cases: 41 passed, 12 failed**. Failures remain
ordinary failing assertions and are retained before any production refactor.
The earlier native component suite is unchanged.

Raw combined baseline:
`/private/tmp/scroller-screen-integration-baseline-final-20260907.json`.

`ChannelScreen.scroller-integration.test.tsx` has 28 cases: 22 pass, six fail:

- A captured initialized mark-read callback still writes for its previous scope
  after channel switch, blur or disposal (three cases).
- Changing the same channel to pending does not update the memoized mark-read
  callback's eligibility (one case).
- Deferred DM creation still pushes its destination after channel replacement
  or disposal (two cases).

Passing channel cases prove actual around→newest/50 query selection, selected
route reset, focused unread initialization/reentry and A→B→A stale-promise
guards, exact current read/retry arguments, sparse page loading and aborting
thread sync requests. Healthy and rejected DM completions are separate controls.

`PostScreenView.scroller-integration.test.tsx` has 25 cases: 19 pass, six fail:

- A previous parent's unread promise publishes into a retained replacement
  thread in either completion order (two cases), and an already-loaded old
  divider remains while the replacement snapshot is pending (one).
- A send completion and a send's queued animation frame each scroll the
  replacement thread through its current ref (two cases).
- Deleting the selected reply clears its anchor but retains its old highlight
  state (one case).

Passing thread cases include 150 ms read timing and cancellation, actual new
reply versus edit target handling, rejected-send and disposed-send behavior,
same-thread centered reference jumps versus external navigation, replacement
highlight duration, and clearing attachments before Back. The send boundary
resolves/rejects explicitly; these cases do not establish backend delivery
success or the store's definitive-failure reconciliation semantics.

The controlled stale callbacks and retained screen replacements are real
component-level reproductions. Whether every ordering occurs through current
native routing still requires app execution. No position, native frame or
durable storage result is inferred from these component tests.

Verification: both new test files passed app TypeScript checking and lint with
no diagnostics; formatting completed. An earlier ChannelScreen run used a
matcher unavailable in this repository's Vitest version; it was replaced with
equivalent exact call-array assertions. The initial raw report is retained and
its matcher errors are not counted as product failures.

### Expanded lifecycle baseline

The additional screen cases produce these totals:

- `ChannelScreen`: **32 cases, 22 pass, 10 fail**. All four new cases fail:
  obsolete latest clears a subsequently selected target, and captured read
  callbacks remain usable across refocus, a pending/resolved eligibility cycle,
  and a new A visit after A→B→A.
- `PostScreenView`: **34 cases, 20 pass, 14 fail**. All six unread ABA orders
  expose a stale intermediate divider, and both old send completion/frame
  variants scroll the replacement A visit. The new activity-rearm control
  passes and requires the complete new 150 ms deadline.

Together with Scroller's three additional cases, the 16 new lifecycle cases
yield **two passes and 14 ordinary failures**. The combined three-file baseline
is **110 cases: 74 pass, 36 fail**, including all 22 original failures.
Raw evidence is retained at
`/private/tmp/scroller-lifecycle-additions-baseline-final-20260907.json`.
These results do not upgrade native visual, geometry or presentation evidence.
No production implementation was changed.

The final expanded baseline uses the formatted source captured in
`/private/tmp/scroller-lifecycle-additions-baseline-final-20260907-sources.json`
(SHA-256 for the report, three integration files and six relevant production
files). App TypeScript checking passes. Scoped lint has no errors; its 15
existing explicit-any warnings are confined to the original Scroller native
boundary adapter. The added lifecycle cases introduce no such warnings.

### Final pre-refactor lifecycle criterion

Recorded before adding or running the control. The real single-thread screen
and its internal focus provider remain under test; no focus-context override
will make the replacement appear eligible artificially.

| ID | Situation | Acceptance |
| --- | --- | --- |
| PS-09 | A visible, active single-thread screen replaces parent A with same-channel parent B 100 ms into A's read delay; B has a current reply and unread data | A's deadline is retired. The visible B thread is genuinely read-eligible, receives a fresh full 150 ms deadline and marks exactly B's latest reply once; a false pass caused by B never becoming focused is rejected |

The test verifies the actual displayed parent/reply and resolved unread input
before timing assertions. Database and native view boundaries remain controlled;
this is lifecycle integration evidence, not visible native or durable-read proof.

PS-09 fails its ordinary exact read-write assertion: B's parent, reply and
resolved unread state are current, but the real single-thread focus provider
retains A, leaving B ineligible and producing zero writes. Earlier cancellation
controls therefore did not establish healthy replacement-thread reads.
`PostScreenView` now has **35 cases: 20 pass, 15 fail**; `ChannelScreen` remains
**32 cases: 22 pass, 10 fail**. With Scroller the final pre-refactor baseline is
**114 cases: 75 pass, 39 fail**. All previous 110 case statuses remain unchanged.

The final formatted-source report and SHA-256 manifest are
`/private/tmp/scroller-pre-refactor-controls-baseline-final-20260907.json` and
`/private/tmp/scroller-pre-refactor-controls-baseline-final-20260907-sources.json`.
Production hashes match the previous baseline. App TypeScript checking passes;
scoped lint adds no warnings or errors. Native visual, geometry, durable-read
and presentation evidence remain separate requirements.
