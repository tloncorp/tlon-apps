# Native mutation acquisition contract

Status: declared before implementing the native-only mutation reader. The native
physical row/cell binding, fixture request marker, and independent reader are now
integrated with 50 durable corruption controls. The first declared runtime (R14)
passes history growth and cache changes at zero measured anchor drift. Removal
remains incomplete: two native observations retain the old physical row after
loaded membership no longer contains it and its registration binding is unavailable.
No observation is discarded or relabelled to qualify that transition. See the
[R14 results](scroller-refactor-results-2026-09-07.md#native-r14).
No historical trace is promoted by this path. The existing mixed JS/native reader and its
32 ms bracket rule remain unchanged; R12/R13 growth/removal results stay
incomplete. This separate proof will explicitly declare its version before
capture and retain the mixed-source result alongside it.

A mutation changes content while the async JS/native/JS observation is in flight.
Combining native geometry with later JS membership cannot establish what was
visible at one instant. Use the existing synchronous native recorder for both
geometry and native-committed metadata. This is native model evidence, not
presented frames or a claim that the JS thread always responds within 32 ms.

## Same-observation evidence

The existing explicit diagnostic bridge may copy `committedMembership` from its
unique attached active scope registration: version 1, status, physical scope
lifetime identity, scope, visit, dataRevision, and ordered key/incarnation pairs.
It must validate the actual measured scroll owner and shared live window/screen;
malformed, duplicate, inactive or retired ownership is unavailable. UUID tokens
belong to registration and host lifetimes, avoiding native-address reuse. No
second membership store, lease change, or ordinary-chat sampling is introduced.

The same call exports `rowBindings` with the membership scope identity, scope,
visit and data revision. Each successful row entry contains its row/cell tags,
key/incarnation, fixture scope, measured row/cell lifetime identities, and native
registration/host lifetime identities. The native bridge finds the actual
associated row registration inside the measured wrapper and its nearest indexed
cell. It rejects stale descriptors, duplicate registrations, detached or hidden
hosts, retagging and ownership changes during the call. The reader joins these
entries to `lifetimeIdentity` on the raw measured views; distinct native objects
cannot share that identity or change the pointer associated with it. The native
list scope and fixture scope are separate identities and are validated separately.

Membership describes loaded list data only. Content comes from actual native
row and indexed-cell signatures copied in the same main-thread operation. A
present target requires matching key/incarnation and agreeing rendered
signatures. Cache-only edits may leave dataRevision unchanged. Removal requires
both absence from valid committed loaded membership and absence from complete
native row/cell inventory. A key still loaded but not mounted is unavailable,
never deleted. A later reinserted key cannot reuse a removed incarnation.

The mutation proof pins the actual viewport owner, native scope lifetime and
visit from a valid pre-action observation. Observed replacement, visibility loss,
malformed inventory or incompatible signatures fail closed. Requested parent
keys, eventual JS commits and a cached coordinator transaction cannot stand in
for current native membership. Every derived state must reproduce from raw
native capture; snapshots and prior verdicts remain immutable.

## Action, timing and position

Apply this first to the existing near/history row mutation scenarios. Before
execution, declare the target key, baseline/expected content signatures,
mutation kind and exact action identity. Bind the existing real mutation request
to a named native marker immediately before applying it; preserve the original
JS request-window check. Marker delivery must not wait for a stable sample or
serialize mutation behind completion of the geometry observer.

Use native timestamps for native observations and markers. Do not convert JS
times into native time or manufacture a commit event from a sampled signature.
Retain the existing 1 pt position tolerance, 32 ms maximum native operation,
125 ms maximum observation gap and at least 1,800 ms recording. Require the
expected state by 400 ms after the native mutation-request marker and for a
1,000 ms quiet tail. Declare any necessary capture window before execution.
No sample may be dropped or retried because it straddles a state transition.

A content transition can be old, expected or an explicit unexpected state at its
native observation time. Anchor geometry and unobscured visible content must
hold throughout all valid samples, including the transition. Expected final
content or a correct final landing cannot erase an earlier failed position.
Missing evidence is incomplete, never a pass. JS responsiveness, real transport,
caret, keyboard and presentation remain separate applicable gates.

## Required controls before runtime

Exercise the actual bridge and independent reader with stable present content,
cache-only edits, deletion, loaded-but-virtualized targets, reordered membership,
remove/reinsert, malformed/duplicate identities, stale native signatures,
physical owner/visit replacement, copied snapshots, missing/late action markers,
missing phases, late expected content, transient bad landings and capture gaps.
Healthy native observations crossing a JS commit may qualify only through this
explicitly declared native-only proof; the same mixed-source input must retain
its existing incomplete verdict.
