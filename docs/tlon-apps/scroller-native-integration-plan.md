# Native scroller integration checks

This plan is recorded before the tests run. It complements the sampled native
fixture and desktop extension; mobile web remains excluded. These checks render
the production `Scroller`, `DetailView`, and `ThinkingState`. React Native view
primitives and the physical `PostList` are boundaries: the list test adapter
delivers real callbacks and records commands, but does not calculate a scroll
policy or simulate passing geometry. Data/presence hooks supply controlled input.
Assertions are about production wiring and lifecycle, not native presentation.

## Situations and acceptance

| ID | Situation | Acceptance |
| --- | --- | --- |
| NINT-01 | Start/end pagination arrives repeatedly before anchor readiness | Neither request escapes before the current anchor is ready; each pending direction flushes once, then fresh boundary events dispatch once each |
| NINT-02 | Channel or selected/unread anchor changes with pending work | Pending pagination from the prior scope is discarded; only current-scope readiness reveals content or flushes current requests; captured old boundary callbacks cannot dispatch requests after replacement or disposal |
| NINT-03 | A prior readiness callback runs before or after new-scope readiness | It cannot reveal the new scope prematurely, re-hide already ready content, or flush requests for the wrong scope |
| NINT-04 | Latest press with cached data or a page already loading | The actual caller callback runs once per press; cached data requests one animated end command on the next animation frame, while an already-loading list issues no premature command |
| NINT-05 | Latest press followed by scope replacement or unmount before its animation frame | The old action cannot scroll the replacement scope or disposed list |
| NINT-06 | Read/unread, loading, anchor readiness and bottom callbacks change | The real control stays hidden during initialization and at bottom; unread removal while reading does not take scroll ownership; background loading shows no press-only loading glyph; a latest press during loading does show it; that press state cannot leak into a replacement scope |
| NINT-07 | Control switches between list and Liquid Glass composer placement; owner disposes | Exactly one active presentation owner; the composer receives the current visibility/loading/callback, and disposal clears it |
| NINT-08 | Composer grows or empty thinking footer becomes the first reply on iOS | Native composer inset is passed once, without equivalent bottom padding; empty above-composer extent is nonnegative; inserting content preserves the existing footer component identity |
| NINT-09 | Chat thread reverses newest-first replies and changes unread state | Production `DetailView` supplies parent then oldest-to-newest replies; exactly the intended row receives the unread divider; unread changes cannot invoke scroll commands |
| NINT-10 | Bot presence ends before, with, or after its reply; another author replies first | Production thread footer sees the newest reply identity/author, holds for its expected responder, collapses after both response and presence-end conditions, and retains the footer instance |
| NINT-11 | Thread/channel scope changes during the thinking grace period | Previous-scope thinking state and its timer cannot make the replacement conversation show an old hold state |
| NINT-12 | Selected target and imperative navigation are forwarded; editing begins/ends | Exact target ID/options reach the current list; selected highlight and unread marker remain distinct; editing disables native list scrolling and restores it afterward |

Ordering coverage enumerates all six orders of start-boundary, end-boundary and
initial-ready delivery, and all six orders of presence-end, expected bot reply
and unrelated-author reply. Scope tests also revisit A after A→B so a repeated
channel/anchor key cannot authorize an old generation's completion (ABA).

## What this closes, and what still needs the app

The existing `ScrollStability.fixture.tsx` passes no-op older/newer loading and
mark-read callbacks, replaces media navigation with a fixture modal, and uses a
forced thinking label. These new tests exercise the real Scroller callback and
thread/footer integration contracts around those boundaries. They do not claim
that controlled callbacks are network pagination or durable read receipts.

The native `ChannelScreen` owns the selected/unread cursor reset, switches the
posts query to newest mode, snapshots unreads on focus, and clears navigation
selection. `Channel` owns active/in-view/loaded read marking. Those complete
screen and persistence paths, actual uploads/sends and their reconciliation,
real presence subscriptions, navigation restoration, keyboard/focus/caret,
pointer targeting and animation progress still require production app execution.
The thread footer currently consumes channel-scoped computing presence; these
tests preserve that existing contract rather than inventing thread-scoped data.

## Native presented-frame route

`scripts/collect-scroll-stability-ios.mjs` collects serialized fixture samples
from an explicitly identified Simulator and writes
`nativePresentation: INCOMPLETE`. The native evidence replay also assesses
sampled geometry only. Neither existing script captures presented frames.

The prior run attempted Animation Hitches through Xcode instrumentation; attach
failed and no frame trace was produced. Argent's installed Xcode 26.4+ profiling
path yielded CPU sampling, which cannot qualify presentation. A successful
Animation Hitches / Core Animation capture correlated to timestamped input and
the scenario's scope/geometry trace is still required on a verified physical
Release build. A screen recording may expose visible flashes, but does not
replace display-deadline or input-response evidence. Preserve explicit UDID,
worktree snapshot, build receipt and runtime provenance through the required
`tlon-mobile-run` workflow before device execution.

## Results

### Additional lifecycle acceptance, recorded before the next baseline

These are lifecycle integration cases against the real `Scroller`, `DetailView`
and `ThinkingState`. Native views/list commands remain controlled boundaries.
They do not establish visible native behavior, geometry or presentation.

| ID | Situation | Acceptance |
| --- | --- | --- |
| NINT-13a | Latest's caller clears the selected cursor and synchronously starts loading in the same conversation | Preserve the user-initiated latest state across its own cursor change; do not execute an old cached RAF against a now-loading list. Current readiness/bottom delivery may complete the intent |
| NINT-13b | Latest's caller clears its own selected cursor while newest data is cached | Invoke the caller once and retain one valid deferred end command after current-scope readiness; cursor retirement alone must not cancel the requested follow |
| NINT-14 | Thread A begins thinking grace, then same-channel thread B and a new A visit mount | Channel-scoped presence remains unchanged, but the old thread's hold state cannot appear in B or the new A visit, including before its old timer expires |

The latest caller adapter changes only the external anchor/loading inputs in
response to the real button callback. The screen's real cursor/query reset is
covered separately by `ChannelScreen` integration tests; this adapter does not
claim an end-to-end screen composition.

The first valid baseline ran 41 cases: **31 passed, 10 failed**. Raw evidence:
`/private/tmp/scroller-native-integration-baseline-final-20260907.json`.
No production component was changed to obtain this baseline. Passing component
integration tests do not change prior native geometry or presentation verdicts.

The 10 failing cases expose these controlled component-level behaviors:

- Captured start/end pagination callbacks still dispatch for the previous scope;
  a captured end callback also dispatches after disposal (three cases).
- Old ready/pending callbacks revoke replacement readiness; repeating A→B→A
  accepts an earlier visit's completion or retained ready state (four cases).
- A queued latest animation-frame callback scrolls replacement channel B (one).
- A prior latest press makes replacement background loading show the pressed
  spinner (one).
- A thread's old thinking grace state keeps a 52-point footer after changing
  conversation (one).

These are reproducible callback/state failures in real components, not new
Simulator reproductions or proof that each captured callback ordering occurs
in a current native gesture. Their accepted contracts remain strict; the tests
are intentionally red until the production lifecycle handles them.

Passing cases include all six boundary/ready orders, all six bot/presence/other
reply handoff orders, pending boundary coalescing, scope reset of queued flags,
actual latest-callback dispatch, composer ownership cleanup, iOS inset wiring,
real thread ordering/unread dividers, and imperative/selected/edit forwarding.

### Expanded lifecycle baseline

The three additional cases bring this file to **44 cases: 32 pass, 12 fail**.
NINT-13a fails because a frame scheduled using the old cached/loading state
still sends an end command after the real latest callback clears the cursor
and starts loading. NINT-14 fails because another thread in the same channel
inherits the old 52-point thinking hold. NINT-13b passes: the cached latest
command survives its own selected-cursor retirement and runs once.

Combined with both screen integration files, the expanded baseline is **110
cases: 74 pass, 36 fail**. The original 22 failures remain ordinary failures;
the 16 additions contribute 14 failures and two passing controls. Raw evidence:
`/private/tmp/scroller-lifecycle-additions-baseline-final-20260907.json`.
These are lifecycle and callback results, not visible native or presentation
qualification. No production code was changed for this baseline.

Source/report SHA-256 values are retained in
`/private/tmp/scroller-lifecycle-additions-baseline-final-20260907-sources.json`.
App TypeScript checking passes. Scoped lint reports no errors and the same 15
explicit-any warnings in the existing native boundary adapter; none were added
by these lifecycle cases.

Setup corrections are retained: the first run lacked React Native's `__DEV__`
global; the second presence mock could not independently notify a memoized
footer. The corrected boundary uses `useSyncExternalStore`, so actual presence
notifications reach the production footer without relying on parent prop
changes. Neither setup failure is reported as a production defect.

### Final pre-refactor lifecycle criteria

Recorded before adding or running these controls. The boundary adapter may
deliver native-list callbacks from a real child layout effect; it does not
implement readiness or request ownership itself.

| ID | Situation | Acceptance |
| --- | --- | --- |
| NINT-15 | A child layout effect reports both pagination boundaries and initial readiness before Scroller's parent layout effect runs | The initial current-scope requests survive parent activation and each direction dispatches exactly once after readiness; repeated readiness cannot replay the drain |
| NINT-16 | React Strict Mode runs child layout setup, cleanup and setup again during one Scroller mount | First prove the renderer performed the actual replay. The surviving setup's pending pagination must not be erased by parent activation, and the replay must produce only one request per direction after readiness |
| NINT-17 | Draining a pending end request synchronously delivers one new current end boundary while start is also pending | Dispatch the original end, the distinct reentrant end and the original start exactly once each. A repeated ready callback cannot duplicate consumed requests; ownership must not swallow the fresh event |

The Strict Mode qualification checks exact setup/cleanup order before the
product assertion. These controls cover React commit and callback ordering;
they provide no physical list, native geometry or presented-frame evidence.

The final pre-refactor baseline has **114 cases: 75 pass, 39 ordinary fail**.
All prior 110 statuses are unchanged. The Scroller file now has **47 cases:
33 pass, 14 fail**. NINT-15 and NINT-16 fail because the parent layout reset
erases the child layout's queued boundaries, yielding zero pagination calls.
NINT-16 first passes its exact `setup → cleanup → setup` qualification, so
this result is based on actual Strict Mode effect replay. NINT-17 passes:
the distinct reentrant end boundary survives without duplicate draining.

Raw baseline and matching source/report hashes are preserved at
`/private/tmp/scroller-pre-refactor-controls-baseline-final-20260907.json` and
`/private/tmp/scroller-pre-refactor-controls-baseline-final-20260907-sources.json`.
The six production source hashes are unchanged from the 110-case baseline.
App TypeScript checking passes; scoped lint has no errors and only the same
15 existing explicit-any warnings. Test formatting completed.
