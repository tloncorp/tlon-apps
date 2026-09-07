# Scoped row mutation evidence

This contract tightens AC-04, AC-09, AC-21 and AC-22 without changing product
scroll policy. It addresses the first-matching-commit gap recorded in the
[gap audit](scroller-test-gap-audit-2026-09-06.md). The detector checks sampled
rendered semantics and geometry, not painted frames or backend delivery.

## Situations and acceptance

| Situation                                | Required evidence                                                                                                                                    | Rejection                                                                                           |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| One mutation                             | A predeclared expected revision, actual captured request, scoped render commit, and repeated semantic/geometry observations                          | Request/ID changes alone do not pass                                                                |
| Several successive states                | A separate request, revision, commit and fixed observation window for every expected phase, before the next request can supersede it                 | Skipped, shortened, reordered or posthoc phases are incomplete                                      |
| Correct state followed by stale callback | Every relevant commit and semantic sample remains on the current revision after its first appearance                                                 | A correct-to-stale transition fails, including a transient between samples                          |
| Same-size reference/content change       | Exact expected semantic signature and retained data membership throughout the phase                                                                  | Stable geometry with stale semantics fails; no invented target height                               |
| Size-changing content                    | The expected commit, a causally associated layout callback, and independent geometry with a real size change                                         | A callback alone or size movement with stale content is incomplete                                  |
| Removal                                  | Scoped detach, committed data absence and measured absence throughout the phase and final window                                                     | Reappearance fails; missing acquisition is incomplete                                               |
| Terminal state                           | Expected revision from its declared observation start through the planned end, including known deferred callbacks and at least a 1,000 ms quiet tail | Ending early, moving the deadline after observing success, or restoring an old revision cannot pass |
| Wrong scope/request/revision             | Observed render ownership and current capture ownership match the declaration and latest applicable request                                          | Foreign or unbound evidence cannot qualify this action                                              |
| Legacy evidence                          | Preserve first-effect diagnostic result separately                                                                                                   | No strict semantic PASS without a declared plan and continuous semantic samples                     |

## Producer contract

`RowMutationEvidence` retains `events`, `samples` and `committedKeys`, and adds
`contract` plus `semanticSamples`. The version-1 contract identifies one scoped
row and its initial semantic revision, a fixed coverage interval, a known
deferred-callback deadline, and ordered phases. Each phase declares its request
window, stable observation window, expected presence/signature and required
effect (`commit`, `resize`, or `remove`). The complete plan is serialized by
`rowMutationContractFingerprint` into a `row-mutation-plan` event at
`declaredAt`, before the first planned request window and before any request.
Declaration may follow the independently acquired baseline snapshot: resolve
fixed relative windows from that baseline, then freeze the plan before dispatch.
This avoids inventing the acquisition timestamp or deriving windows from a
successful observed outcome. Early declaration is also valid. Expected
signatures and windows must come from scenario intent, never from whichever
revision eventually appears.

Request IDs and revisions are capture ownership identifiers. They need not be
added to product posts and do not prove network delivery. Producers must assign
them using the actual request dispatch and observed rendered fingerprint, not
copy expected content into the observation. A semantic sample references the
latest actual `row-commit` or `row-detached` event by `commitId`; that event
contains the observed signature and scoped capture ownership. Emit snapshots
from committed-render diagnostics alongside each geometry sample. Store actual
committed data keys in each semantic sample, including after removal. Separate
network/load callback proof remains necessary where the scenario requires it.

A signature contains exact `content`, `reactions` and `replies` fingerprints;
`replies` may be a string or finite number for compatibility with current
instrumentation. Presence is explicit. All three fields are checked, even when
the requested action changes only one. Commit/detach and layout events must
retain their actual ordering. A later stale commit is evaluated even if no
geometry sample falls between it and recovery.

Coverage starts with at least 200 ms of baseline observation. Each required
stable phase lasts at least 200 ms and has at least three measured samples. The
last phase continues through its planned end, at least 1,000 ms beyond both its
stable start and the declared relevant deferred-callback deadline. Capture gaps
must be positive and at most the declared limit (never above 125 ms); acquisition
must be valid and at most 32 ms. These limits qualify diagnostic sampling only.
The first sample equals the planned start and the final sample reaches the
planned end. Every semantic sample pairs with the same-timestamp geometry
sample; missing or duplicate samples, unknown commit references and incomplete
data membership invalidate the proof.

During a request's transition interval the previous state may remain until the
expected state first commits. The transition may advance once; it cannot revert
or substitute an undeclared intermediate revision. At the declared stable
window start only the expected state is allowed. The next request cannot begin
until the current phase's required observation window ends. This intentionally
does not model overlapping requests whose permitted intermediate states have
not yet been declared.

## Result and integration

`observed` is true only for strict `PASS`. The result distinguishes `FAIL`
(observed semantic contradiction) from `INCOMPLETE` (missing/invalid evidence
or an unexercised required effect). Incomplete evidence takes precedence while
retaining detected violations in the issue list. Legacy callers keep their
input shape and receive `INCOMPLETE`, `observed: false`,
`evidenceLevel: legacy-first-effect`, and the former result in `legacyObserved`.
Historical raw traces remain untouched and cannot be relabeled as strict proof.

The native fixture must persist the contract, plan/request/commit ownership,
per-sample rendered state and per-sample committed data membership. The report
importer must replay the full serialized input and independently validate the
registered scenario's intended phase schedule. It must not accept a producer's
PASS flag or infer a plan from observed completion. Detector controls validate
this oracle; product scenarios require subsequent fresh device/browser runs.
