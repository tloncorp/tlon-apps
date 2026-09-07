# Buffered native acquisition

This contract is saved before implementation and execution. It augments, and
does not rewrite, the 2026-09-07 async geometry baseline. Existing 1-point
position, 32 ms operation and 125 ms coverage limits remain unchanged.

The old collector brackets a main-thread view read with a JavaScript promise.
A slow promise return makes that interval incomplete even when the native read
was fast. The new collector records bounded main-thread observations in native
memory and transfers the finished recording once. Transfer latency is reported
separately; it cannot change the recorded observation times.

| Situation | Acceptance |
| --- | --- |
| Start, stop and duplicate start | An explicit fixture request creates one uniquely owned recording. A second start is rejected while it is active. A stop with another ID cannot stop it. Record the original request, actual start/end, terminal reason and every issue. |
| Native cadence | A CADisplayLink callback reads the same model geometry as the existing collector in one synchronous main-thread operation. Record callback sequence, timestamp/target timestamp, read start/end and gaps. Missing, duplicate, reordered or over-budget observations remain incomplete. These callbacks are not proof of presented frames. |
| Memory and lifetime | At most 900 frames and 15 seconds, at most 128 rows and 20,000 visited views per read. Deadline, capacity, requested stop and invalid requests have distinct results. Never silently discard early frames or replace an active recording. Inactive application display-link gaps remain visible. |
| Row membership and identity | Inventory every uniquely tagged mounted row inside the requested root on each read. Preserve native object/window identities, including detached/missing or duplicate witnesses. A dynamic inventory cannot silently substitute a replacement reading row. Required witness IDs come from the declared scenario contract. |
| Semantic association | Read opt-in fixture row metadata from the same native view operation as its geometry. Metadata is attached by the real renderer's wrapper from the actual post props it receives, not the mutation request. Record exact scope, post identity and content/reaction/reply fingerprints. Missing, malformed or wrong-scope metadata makes semantic evidence incomplete. Root input keys are explicitly requested input membership, not a claim about LegendList's committed internal data. |
| Expected entry concealment | A structurally measurable hidden view is recorded as hidden. The scenario's declared entry phase decides whether concealment is permitted. This is separate from unavailable geometry and does not permit hidden content during READ/FOLLOW. |
| Actions and clocks | Native markers use CACurrentMediaTime and stay in that clock domain. A marker proves delivery of that marker, not delivery of the subsequent product action. Assert actual geometry/content/interaction evidence as well. JavaScript event times retain their own clock and must not be directly compared with native timestamps. |
| Independent qualification | Replay raw recording ownership, timing, native geometry, semantic metadata and the fixed scenario contract. Deliberate corruptions must be rejected, including a late transfer with good native cadence versus a real native gap, a wrong reading identity, stale revision, missing terminal frames and a hidden entry incorrectly relabeled as ordinary READ. |

The new recording initially accompanies the existing raw trace. Existing
failures and incomplete attempts remain preserved. It cannot make a whole
scenario pass until all required actions, semantics and end-to-end dimensions
have independently qualified; valid buffered geometry alone cannot certify
read/send/backend journeys, media pixels, caret exposure or presentation.

The initial implementation still binds a recording to one native root and
scroll-view identity. Entry scenarios that replace the root need a declared
scope itinerary before they can qualify; permitting expected concealment does
not permit silently adopting the replacement. Root metadata records the fixture
input keys, not LegendList's committed internal membership. Native buffer
acquisition therefore remains a separate result from the existing product
verdict until action and semantic association have also been replayed.

The next acquisition attempt will keep the native recording active for the
declared scenario duration after the start acknowledgement reaches JavaScript.
This prevents setup/bridge latency from consuming that window. Record both the
acknowledgement and the preplanned earliest stop in the JavaScript clock; native
cadence and lifetime must still be checked only in the native clock. The native
15-second/capacity bound remains authoritative. Preserve the existing JavaScript
trace's original fixed window and any resulting incomplete dimensions; the
additional native tail cannot fabricate JavaScript observations or claim that an
external typing command completed inside the capture.

## Entry itinerary for the next native run

The persistent fixture root keeps one diagnostic ID. Its generation remains in
the semantic scope. Before reset, declare exactly two owners: the outgoing
scope with its exact scroll ID, then generation + 1 under the same root with the
production outer-scroll tag prefix. The new native itinerary API discovers and
records the destination's exact tag and object identity; it does not infer an
arbitrary replacement from whichever view is visible.

Require a monotonic outgoing-to-destination transition. Reject a third or
reverted scope, multiple tagged hosts, mixed row scopes and a replacement scroll
host within one scope. Native raw inventory must preserve duplicate-host evidence
even if another field claims acquisition succeeded. A structurally measurable
hidden or empty destination can be acquired; it is not a landing success.

Return two distinct frame indices: the first exposed destination viewport and
the first exposed destination content. Content requires a valid frame and a
matching-scope actual row intersecting the usable viewport above the composer.
Neither index is a PASS or a correct-target claim. A separate position check must
inspect the first readable frame, including the accepted centered selected-post
target or latest target, and preserve any later regression. The ordinary
single-owner API and its populated-list guards remain unchanged; ordinary
scenarios cannot enable entry itinerary exceptions.

## First-content landing qualification

Saved before the new entry checks execute. Apply only to `entry-latest`,
`entry-selected` and `entry-delayed` in the local component fixture. This adds
sampled model-geometry and visible-row revision checks; it does not establish
actual navigation, durable reads, painted content or presented-frame timing.

Before recording, declare the destination generation and all 90 expected post
identities and content/reaction/reply signatures from the scenario input. Never
copy expected signatures from the recorded result. The target is fixed by the
case: post 65 centered for selected entry, post 119 at the reachable bottom for
latest and delayed entry. Use the accepted 1-point tolerance and actual legal
range, with the composer excluded from the usable viewport.

Record unique native-clock reset and data markers immediately before the real
state updates. The delayed case must acquire its empty destination before the
data marker, which follows the controlled 900 ms wait. Marker acknowledgement
alone is insufficient: require the actual outgoing-to-destination ownership
transition and expected signatures on exposed destination rows.

The first readable destination frame must land correctly. Evaluate every later
valid destination frame for displacement, target loss, concealment and stale
visible content. A correct final frame cannot erase an earlier failure. Preserve
acquisition deficiencies separately from independently established failures.

The non-resetting completion deadline is 2,800 ms after the native reset marker,
followed by a full 1,000 ms tail. The existing JavaScript capture stays 2,800 ms;
the native stop waits until 3,800 ms after the reset acknowledgement. That
acknowledgement and transfer bracket retain their JavaScript clock; independent
replay uses the actual native marker and observation times. The original native
4,300 ms capacity/deadline bound remains authoritative. A truncated recording
cannot qualify by shortening the tail.

This bounded completion deadline does not itself qualify AC-16's 250 ms latency
from usable target data/layout. That requires an independently acquired readiness
witness. Report that dimension separately, together with incomplete physical
presentation. Controls must reject a wrong first landing followed by recovery,
reconcealment, another readable row substituting for the target, stale terminal
content, missing/duplicate markers, wrong scope, and an absent terminal tail.
