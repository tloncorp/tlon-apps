# Native reading metadata

The membership revision identifies a loaded row incarnation. It remains stable
when `useLivePost` updates content independently of the list query, and changes
when a removed key is reinserted. Invalid membership is unavailable and cannot
claim an authoritative empty list.

Before the size-limit regression controls: scope `dataRevision` is a compact,
exact decimal generation scoped by the list's scope/visit. Every changed ordered
key list advances it, including reorder, removal/reinsertion and invalid input;
unchanged copies retain it. Returning to an earlier key order cannot reuse its
generation. Row incarnations remain independent. The pure reconciler leaves
committed state untouched when a candidate render is abandoned. Decimal-string
increment avoids numeric precision collisions; no hash or native parser limit
change is involved. A 300-row descriptor must retain all rows without expanding
`dataRevision` beyond the native 16,384-unit field limit.

The row carrier publishes block membership in the same render as its content.
Block revisions describe actual rendered content, including local edit fallback
and stateful content selection. Native geometry comes from the mounted renderer.

Converted blocks have no durable IDs. Unique unchanged blocks retain identity
through insertion and reorder. One edited block between unambiguous neighbors
retains identity, allowing the native text mapper to resolve its old span.
Ambiguous splits, merges and repeated text preserve old IDs in
`unresolvedBlockIds`, disjoint from current block IDs. Those witnesses are
unavailable; they cannot trigger removal fallback. An empty, unambiguous gap
proves deletion. The pure reconciler does not mutate committed state during an
abandoned React render.

Metadata controls prove identity decisions only. Their passes do not qualify
native mounting, visual continuity, attachment loading or presentation timing.

## Optional provider timing diagnostics

The fixture may explicitly request `nativeReadTimingSession=<token>` for a core
suite or standalone scenario. Tokens contain 1–128 ASCII letters, digits, dots,
underscores, colons or hyphens. The request commits before scenario preparation
and forwards only the scope descriptor field `diagnosticTimingSession`. Missing
or invalid native metadata disables timing without invalidating READ metadata.
Ordinary conversations omit this field.

Changing only the timing session must preserve the physical scope, visit,
membership, intent, reading lease, correction policy and diagnostic attachments.
Counters reset for the exact physical scope/visit/session; a retired provider or
in-flight span cannot contribute to its replacement. The optional existing
`nativeReading.provider.durations` payload records inclusive capture, query and
exposure elapsed times using `CACurrentMediaTime` milliseconds. Nested totals
must not be added or described as CPU time. Peak timestamps support comparison
with recorder gaps; they do not attribute every missing frame. Disabled timing
performs no timing clock reads or counter allocation. The getter starts no work.

These diagnostics do not alter acquisition or outcome qualification: the 32 ms
JS bracket, native gap limits, landing tolerances, semantic checks and preserved
incomplete results remain unchanged. Runtime timing requires an explicitly
instrumented capture; host controls alone cannot establish frame performance.
