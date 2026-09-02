# Audit 03 — the surface reducer

Read-only audit of `packages/api/src/client/surface/reducer.ts` (and the two modules it
delegates to, `jsonPointer.ts` and `schemas.ts`) against `surface-channels-plan.md`
§4.3, §4.4, §6, §7 and the M3 adversarial list. Worktree
`homestead-tlon-skill-testing-strategy-phase-3`, branch `patrick/mini-app-mvp`, at
`9fb8cab144`. Nothing was changed. Behavioural claims below were checked by running a
throwaway probe script outside the repo, at
`…/scratchpad/probe/{actor,probe2,probe3}.ts`; every quoted probe output is from that
script. The existing suite was run read-only and is green:
`surfaceReducer` + `surfaceJsonPointer` + `surfaceCaps` + `surfaceSchemas` = 171 passed.

---

## Verdict

The reducer is the strongest-tested file in this feature and its security core does what
§4.3 says: identity comes only from `post.authorId`, host authorship is checked against a
`hostShip` derived from the channel id, `$actor` substitution only ever runs over
spec-authored ops, and the revision filter has exactly the one stale exception the plan
grants. Every item on the M3 adversarial list that is the reducer's to answer is covered
by a test that asserts inertness, not merely exercises the path. What is thinner is
everything the reducer _assumes_ rather than checks. Three assumptions are unguarded,
untested, and each is load-bearing: `sequenceNum` is unique across the input post set (it
isn't checked, and two posts sharing one make the fold input-order-dependent — I
reproduced a divergence); `snapshot.upToSequenceNum` is a real boundary (a host snapshot
claiming `1_000_000` permanently freezes the channel, `foldedEventCount: 0`, with no
recovery but deleting that post); and `spec` is schema-validated (an action missing `ops`
makes the "pure and total" reducer throw a `TypeError`). Separately, the `reducer.ts:268`
data-loss bug found today was _not_ fixed in the reducer — the snapshot still replaces
`spec.initialState` wholesale — it was fenced in one CLI command, so every other writer of
a preserving revision reintroduces it. And on the question I was asked to press hardest:
the gate's new `$actor` exemption is reachable, in two ways, one of which needs a single
extra key in an op value; but it is a _gate_-check bypass, not a reducer identity forgery
— the reducer's substitution is sound and cannot be fed member-supplied data.

---

## What the reducer guarantees, arm by arm

**Entry collection (`reduceSurface`, lines 197–234).** A post contributes nothing unless
it is non-null, has a finite numeric `sequenceNum`, is not `isDeleted`, is not `isEdited`,
has a non-empty string `blob`, and has a string `authorId`. Blob text goes through
`parsePostBlob`, so an entry that fails its Zod schema has already degraded to
`{type:'unknown'}` and is invisible here — this is where every §7 cap (op count, op value
size, entry total, snapshot state size) is actually enforced. Entries whose `surfaceId`
does not match the spec are dropped. `surface-spec-mirror` and everything else is ignored.
_Guarantee: only server-sequenced, unedited, undeleted, schema-valid, same-surface entries
can move state._

**Ordering (236–238).** Sorted by `(sequenceNum, entryIndex)`. Multiple entries in one
post fold in blob order. _Guarantee: fold order is a function of the log — conditional on
sequence numbers being unique; see finding R1._

**Snapshot selection (244–260).** A candidate must be authored by `hostShip` and carry
`specRevision === spec.specRevision`. There is no cross-revision selection under any
setting. The winner is the greatest `upToSequenceNum`, ties going to the latest-sequenced
entry (`>=` over a list already sorted by sequence). Probe: tie-break is stable across
input order. _Guarantee: only the host can compact, and only at the live revision._
_Not guaranteed: that `upToSequenceNum` bears any relation to reality — see R2._

**Migration gate (264–266).** `preserveState === true` with no selected snapshot returns
`{status:'migration-pending'}` carrying no state at all, matching §6's "the partial status
carries no state." _Guarantee: a preserving revision shows nothing until the host lands a
snapshot at exactly that revision._

**Base state (268).** `state = snapshot ? snapshot.state : spec.initialState`. The
snapshot **replaces** `initialState`; there is no merge. Combined with the gate above, a
preserving spec never reads `spec.initialState` on any reachable path. This is the D165 /
D167 data-loss line. The reducer's own doc comment does not say this; the plan does not
say it; the only places it is written down are a test comment
(`surfaceReducer.test.ts:325`, "snapshot state replaces initialState wholesale") and
D167 after the fact.

**Boundary freeze (281–283).** Events with `sequenceNum <= boundary` are skipped without
counting as folded or skipped. Probe: an event at exactly the boundary sequence is frozen.
_Guarantee: matches §6 step 5's half-open `(boundary, newest]`._

**Host authorship (287–299).** `mode:'host'` requires `authorId === hostShip`, compared
**verbatim** — no canonicalization in the reducer. Then `entry.specRevision` must equal
`spec.specRevision`; there is no stale exception and no future exception. `actor` is left
`undefined`, which makes any `$actor` use in the ops a `grammar` refusal downstream.
Probe: `hostShip: 'zod'` against `authorId: '~zod'` folds nothing at all, silently.
_Guarantee: raw ops are host-only and current-revision-only, so a non-preserving reset
never replays. Precondition: both strings are canonicalized by the caller — see R6._

**Invoke resolution (302–320).** `getDeclaredAction` is an own-property lookup, so no
inherited name resolves. An undeclared `actionId` is skipped. Off-revision handling: a
**future** revision is always skipped; a **stale** revision folds only if the _current_
action sets `acceptStale === true`, and then resolves against the _current_ action's ops.
The entry carries no ops of its own — the schema's `invoke` arm has no `ops` field, so
`z.object` strips any smuggled one. `actor = authorId`, the verified post author.
_Guarantee: a hand-crafted invoke achieves exactly what tapping the control achieves; a
member cannot touch a path no action exposes and cannot forge another ship._

**`$actor` substitution (`jsonPointer.ts` 133–193).** In a **path**: substitution runs over
segments that `parsePointer` has already unescaped, so a segment exactly `$actor` becomes
the actor string and the resulting object key is the plain `~sampel-palnet` (probe
confirms). A segment merely _containing_ `$actor` is a `grammar` refusal. An actor that
would resolve to a forbidden key is refused. In a **value**: every string exactly `"$actor"`
is replaced at any depth, in arrays and in object values; substrings stay literal. With no
actor (host ops), any `$actor` _string value_ or path segment invalidates the op.
_Guarantee: the only data ever substituted originates in the admin-authored spec — members
supply no values in v0, so identity cannot be smuggled in._ _Gap: object **keys** are
walked by neither the host-op guard nor the substituter — see the `$actor` section._

**Per-op fold and caps (`foldOp` 69–89).** `applyOp` enforces pointer grammar, `$actor`
rules, `isJson` on the value (finite numbers, plain objects, no forbidden keys), and the
depth-16 cap computed as path depth + value depth. The reducer adds the one cap only it can
see: if the op `changed` state and the result exceeds `SURFACE_CAPS.reducedState` (128 KB),
it is refused as `state-cap`. A no-op `del` is `changed: false` and never cap-checked, so a
shrinking entry is never refused for size.

**Refusal handling (322–339).** Every refusal, of every kind, aborts the rest of its entry.
`stateFull` is raised only by `state-cap`. The entry's sequence number is pushed onto
`abortedSequenceNums`, and the entry still counts as folded and still advances
`newestFoldedSeq`. _Guarantee: the state after an entry is always a **prefix** of its ops,
never a subsequence — which is what makes "archive, then clear" safe._

**Unparseable input.** Nothing throws. A bad blob yields no entries; a bad entry degrades
to unknown at the schema; a bad op is refused. _Caveat: totality holds for **posts**. It
does not hold for a malformed **spec** — see R3._

---

## Coverage: the M3 adversarial list

Distinguishing "a test drives this path" from "a test asserts the hostile input is inert."

| adversarial case                                  | covered?                       | where                                                                                                                                                                                                                              | what is asserted                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| non-host raw ops                                  | **yes, inert asserted**        | `surfaceReducer.test.ts:158`; `adapter.test.ts` "non-host authors stay non-host after canonicalization"                                                                                                                            | state unchanged **and** `skippedEventCount === 1`                                                                                                                                                                                                                                                      |
| forged identity values                            | **yes, inert asserted**        | `surfaceReducer.test.ts:170`; `surfaceSchemas.test.ts` "strips smuggled ops from invoke entries"; `surfaceJsonPointer.test.ts` `$actor` block; `invoke.test.ts` (×4)                                                               | a crafted invoke carrying `actor:` and `ops:` folds as the _author's own_ vote; smuggled ops are stripped at the schema; the client writer cannot emit an undeclared or inherited action                                                                                                               |
| stale host events                                 | **yes, inert asserted**        | `surfaceReducer.test.ts:184`                                                                                                                                                                                                       | state unchanged + `skippedEventCount === 1`                                                                                                                                                                                                                                                            |
| stale invokes without `acceptStale`               | **yes, inert asserted**        | `:206`, plus `:222` (stale, `acceptStale`, id retired)                                                                                                                                                                             | `votes` untouched + skip counted                                                                                                                                                                                                                                                                       |
| stale invokes _with_ `acceptStale`                | **yes, positive asserted**     | `:213`                                                                                                                                                                                                                             | folds the **current** action's value, not any historical one                                                                                                                                                                                                                                           |
| wrong-revision snapshots                          | **yes, inert asserted**        | `:352` (older _and_ future in one test)                                                                                                                                                                                            | `baseSnapshotSeq` null and neither payload key present                                                                                                                                                                                                                                                 |
| future-revision events                            | **yes, inert asserted**        | `:194` (host and invoke together)                                                                                                                                                                                                  | both skipped                                                                                                                                                                                                                                                                                           |
| oversize entries                                  | **partial**                    | `:272` (9 KB value → entry-total cap, sibling still folds); `surfaceCaps.test.ts` boundary pairs for bundle/`initialState`/`recipe`/actions/ops/spec-total/entry-total/reduced-state/snapshot-state                                | boundary tests are exact (n accepted, n+1 rejected). **Absent:** no _reducer_-level test that an over-cap **snapshot** degrades to unknown and therefore leaves a preserving spec migration-pending. **Absent:** `provenance` has no cap test at all — the one cap whose number diverges from the plan |
| edited events                                     | **yes, inert asserted**        | `:256` (host event + invoke both edited); `:364` (edited _snapshot_ falls back to next-oldest)                                                                                                                                     | state is exactly `initialState`; fallback picks the older snapshot                                                                                                                                                                                                                                     |
| deleted events / snapshots                        | **yes**                        | `:364`, `:378`; `hydration.test.ts` "deletions below the boundary change nothing; above, they refold"                                                                                                                              | below-boundary deletion is a no-op; above-boundary refolds                                                                                                                                                                                                                                             |
| tampered bundles / hash mismatch                  | **yes, but not the reducer's** | `bundleCache.test.ts` ×9 — "fetched bytes failing the hash are never stored or returned", "a corrupt cache entry is a miss, not an error", "a ref that under-reports its size does not soften the cap"; `useSurfaceBundle.test.ts` | never returns unverified bytes. The reducer has no bundle concept, correctly                                                                                                                                                                                                                           |
| `$actor` in host ops                              | **yes, inert asserted**        | `:239`, `:623`, property test `:833`; `surfaceJsonPointer.test.ts` "rejects any $actor use in host ops"                                                                                                                            | refused **and** aborts the rest of the entry                                                                                                                                                                                                                                                           |
| partial-segment `$actor`                          | **yes at the op layer**        | `surfaceJsonPointer.test.ts` "rejects partial-segment use"                                                                                                                                                                         | `ok: false`. **But** nothing asserts what an _action_ built entirely of such ops does — see F3                                                                                                                                                                                                         |
| `$actor` as an object **key**                     | **absent**                     | —                                                                                                                                                                                                                                  | no test anywhere. Probe shows a host op writing `{"$actor":"yes"}` **succeeds**, and a member op writing the same key is **not substituted**                                                                                                                                                           |
| duplicate `sequenceNum`                           | **absent**                     | —                                                                                                                                                                                                                                  | determinism properties (`:1119`, `:893`, `:1021`) all shuffle posts with **distinct** sequence numbers, so the one input that breaks convergence is outside every generator                                                                                                                            |
| snapshot `upToSequenceNum` beyond the newest post | **absent**                     | —                                                                                                                                                                                                                                  | no test; probe shows it permanently freezes the board                                                                                                                                                                                                                                                  |
| unvalidated spec                                  | **absent**                     | —                                                                                                                                                                                                                                  | probe shows `reduceSurface` **throws** on `actions.a` with no `ops`                                                                                                                                                                                                                                    |
| prototype pollution                               | **yes**                        | `surfaceJsonPointer.test.ts` "rejects prototype-polluting segments", "treats inherited names as absent", "does not delete inherited names"; `surfaceSchemas.test.ts` "getDeclaredAction resolves only own declared actions"        | forbidden segments refused at parse; inherited names read as absent                                                                                                                                                                                                                                    |
| determinism / totality                            | **yes, property-tested**       | `:1066` (arbitrary garbage never throws), `:1119` (input order), `:893` / `:922` (convergence with an aborted entry), `:1021` (`abortedSequenceNums` identical in any order), `:1147`, `:1157` (never mutates `initialState`)      | strong                                                                                                                                                                                                                                                                                                 |

Two structural notes on the inventory. First, the abort semantics of §7 are the
best-covered thing here — three properties plus five worked examples, each of which asserts
_prefix, not subsequence_, and each of which encodes the specific data-loss shape it was
written from. Second, M3's exit phrases the adversarial list end-to-end ("a second user
votes from the rendered app; two clients converge…; adversarial inputs are all inert").
Today that list is discharged **entirely by unit tests** in `packages/api` and
`packages/shared`. There is no surface e2e spec in `apps/tlon-web/e2e/` and no two-ship
integration run — that is M4's item, but it means "all inert" is currently a statement
about one implementation in one process, not about two clients agreeing.

---

## Code vs. plan divergences

Ordered by how much they could mislead someone implementing against the plan.

**D1 — §7 describes `$actor` path substitution at the wrong layer, and a literal reading
produces the wrong key.** The plan says the segment is "substituted with the actor's ship
string **RFC 6901-escaped** (`~` → `~0`, so `~zod` becomes the segment `~0zod`)."
`resolveActorSegments` substitutes into a segment list that `parsePointer` has _already_
unescaped, so the resulting object key is the plain `~zod` — probe:
`{"votes":{"~sampel-palnet":"yes"}}`. The observable outcome is correct and the tests pin
it. But the plan sentence is the contract a parity implementation reads, and Hermes
inherits everything in the `tlon-skill` surface (§9). An implementer following §7
literally writes `~0sampel-palnet` as the state key and diverges from every TS client on
every `$actor`-keyed app — the poll, RSVP, potluck, habit-tracker, leaderboard and workout
templates, i.e. six of nine. **Direction: the plan is wrong, the code is right.**

**D2 — §7 says `$actor` is "invalid anywhere in host ops"; object keys are exempt in
practice.** `valueContainsActorPlaceholder` walks `Object.values` only. Probe:

```
host, $actor as key   -> {"ok":true,"state":{"votes":{"$actor":"yes"}},"changed":true}
host, $actor as value -> {"ok":false,"refusal":"grammar","error":"$actor is not valid in host ops"}
```

A host op can therefore write a literal `$actor` key into state. Nothing later substitutes
it, so it is inert as _identity_ — but it renders as a phantom participant in any app that
iterates `Object.keys(state.votes)`, and it is precisely the shape a reader would read as
"substitution failed." **Direction: code is more permissive than the plan.** The
symmetric member-side case (D3) is the one with teeth.

**D3 — the plan does not say object keys are never substituted, and a natural authoring
spelling silently breaks.** §7's value rule is "any string exactly `"$actor"`, anywhere in
the value tree." A key is not a string value, so the code is arguably within the letter.
But `set /votes {"$actor": "yes"}` is an obvious-looking way to write per-user state, and
probe shows it writes a shared literal key: every member's press lands on the same cell.
The gate's idempotency fold passes it (same literal twice), and `actionWritesOnlyTheActor`
correctly declines to exempt it — so it will be _reported_ as a no-op control, but only
because of a rule that exists for another reason. Nothing names the actual mistake.

**D4 — §7's caps table says `provenance` is 512 B; `SURFACE_CAPS.provenance` is 1024.**
`schemas.ts:38` explains the choice ("nothing correct comes near 1 KB"), but no
`DECISIONS.md` entry records the change and the plan still says 512 B. This is also the
only cap with **no boundary test** in `surfaceCaps.test.ts`. **Direction: code is more
permissive than the contract, undocumented.**

**D5 — §7 says the reduction reports `abortedEventCount`; it reports
`abortedSequenceNums`.** The code comment (lines 141–162) argues the change well — a
consumer waving past an abort needs to say _which_ post — and `.length` is the old number.
Plan not updated. Cosmetic, but §7 is the only place a CLI author would look.

**D6 — §4.1's `SurfaceAction` and `SurfaceSpec` are stale, and §9 states as fact something
the schema now contradicts.** §4.1 lists `ops` / `acceptStale` only; the schema also
declares `duplicatesTolerated`. §4.1's spec omits `memberInteraction` and `timeDisplay`,
both now declared. And §9 says outright: "Note `duplicatesTolerated` is not in the ratified
schema, which generalizes into a rule…". It **is** in the schema (`schemas.ts:148`), and
the comment there explains that declaring it is exactly the fix for the raw-vs-validated
comparison class (D67/D72) that §9's sentence describes as unfixed. A reader of §9 today is
told to work around a hazard that has been closed.

**D7 — nowhere in the plan does it say a snapshot replaces `initialState`.** §4.4 gives the
snapshot shape and the selection rule; §6 step 3 says a preserving spec is pending until a
snapshot lands and that non-preserving specs "absent a snapshot… fold from `initialState`."
Neither states the consequence that produced D165: with a snapshot present, `initialState`
is never consulted, so a revision that adds a key to it never reaches the board. The
semantic that cost a data-loss bug is written down only in a test comment and in D167.

---

## The `$actor` finding

The question: can an app get `$actor` treated as present when it is not, or supply a
literal `"$actor"` in member data that is then substituted — now that
`actionWritesOnlyTheActor` (`surface-transitions.ts:696–710`) exempts an action from the
no-op-control rule when **every** op names `$actor`?

**On the reducer side: no.** Substitution runs only over `action.ops` taken from the
current, schema-validated spec (`reducer.ts:318`), never over anything in the post. The
`invoke` arm of `SurfaceEventEntrySchema` has no `ops` field, so a smuggled one is stripped
by `z.object` before the reducer sees the entry, and the test at `:170` asserts that a
forged invoke folds as the author's own action. v0 invokes are parameterless, so there is
no member-supplied value anywhere for substitution to reach. The one asymmetry (D2/D3) is
that keys are never substituted by either side — which is the _safe_ direction: a member
cannot make a key become someone's ship.

**On the gate side: yes, reachable, two ways.** Probe results for
`actionWritesOnlyTheActor`:

```
exempt? true   path segment $actor            (/votes/$actor)
exempt? true   no leading slash, $actor segment (votes/$actor)
exempt? true   bare "$actor" as whole path      ($actor)
exempt? false  partial-segment $actor          (/votes/$actor-choice)
exempt? true   shared path, $actor deep in value
exempt? false  shared path, $actor as an object KEY
exempt? true   shared path, $actor in array element
exempt? true   two ops, first names actor in value
exempt? false  two ops, only second names actor
exempt? false  no ops
```

**F1 — the value branch is one key away from a self-exemption.** The doc comment names the
defence: the board that shipped D140's defect writes
`set /tasks/cover-art/status "doing"` + `set /claims/$actor "cover-art"`, and "an 'any op'
test would exempt it on the strength of the second while the first is the dead half." The
`every`-op rule catches that (probe row 9: `false`). Adding one key to the first op's
value — `set /tasks/cover-art/status {s:'doing', by:'$actor'}` — flips it to `true`
(probe row 8). The exemption's premise is "a control whose write is the presser's OWN
answer," but `valueNamesActor` cannot distinguish a write _keyed by_ the presser from a
write that merely _mentions_ them while landing on a shared cell. That is not hypothetical
shape-fitting: it is the expense-split template's own spelling (`set /paidBy/ferry
"$actor"`), which is why the value branch exists. So the rule cannot be tightened by
dropping the branch; it would need to ask whether the op's **path** is per-presser, or
whether the value's `$actor` is doing the discriminating.

**F2 — the path branch reads a raw, unparsed path.** `path.split('/').includes('$actor')`
runs on the string, without `parsePointer`, without unescaping, and without requiring a
leading `/`. `votes/$actor` and the bare `$actor` both exempt (rows 2–3) even though the
reducer refuses both outright (`path must start with /`). In today's pipeline this is
defused by `checkPointerHygiene` (`surface-lint.ts:1321`), which runs the real
`parsePointer` over every declared op path and rejects those two before the walk. So F2 is
a latent duplication of the pointer grammar, not a live hole — but it is a second answer to
a question the reducer's parser already answers, free to drift, which is the thing this
codebase repeatedly writes comments against.

**F3 — the sharper hole is next door, and it is not the `$actor` exemption.**
`collectNoOpControls` excludes aborted edges (`surface-transitions.ts:753`,
`if (edge.from !== edge.to || edge.aborted) continue`), for the stated and correct reason
that a refused fold is a different report from a pointless control. Combine that with
`checkPointerHygiene` accepting any _grammatically valid_ pointer, and an action whose ops
all use **partial-segment `$actor`** is completely inert and reported clean by the whole
gate:

```
parsePointer("/votes/$actor-choice") -> {"ok":true,"segments":["votes","$actor-choice"]}
applyOp   -> {"ok":false,"refusal":"grammar","error":"partial-segment $actor use is invalid: $actor-choice"}
inert action once  -> …"foldedEventCount":1,"abortedSequenceNums":[1]
inert action twice -> …"foldedEventCount":2,"abortedSequenceNums":[1,2]
idempotency check would see a diff? false
```

- pointer hygiene: passes — `$actor-choice` is a legal pointer segment.
- action-idempotency (`surface-lint.ts:2224–2263`): passes — it compares `once.state`
  against `twice.state` and **never reads `abortedSequenceNums`**. A permanently-refused
  action is trivially idempotent.
- activation shortfall: passes — a control does invoke it, so it is not `unreached`.
- no-op-control: does not fire — every edge is `aborted`, so the action never enters the
  `dead` map. (`actionWritesOnlyTheActor` returns `false` here, so the exemption is not
  even what saves it.)

The comment on the exemption says "An action with no ops is not exempt: it cannot change
anything anywhere, which is the strongest form of the defect." An action whose every op is
_refused_ is exactly as dead as an action with no ops, and it is the one the gate lets
through. `abortedSequenceNums` is already computed and already consumed by `surface
publish` and `surface snapshot`; the gate's fold smoke is the one place that folds and
discards it.

---

## Ranked risk

Ranked by blast radius × likelihood.

**R1 — duplicate `sequenceNum` makes the fold input-order-dependent.** _High blast radius,
low likelihood._ The whole convergence argument ("state is a pure function of the post log;
every client aborts at the same op of the same entry") rests on `(sequenceNum, entryIndex)`
being a total order. Two _different_ posts sharing a sequence number tie completely, and
`Array.prototype.sort` is stable, so the winner is whichever arrived first. Probe:

```
dup-seq order A,B -> {"t":"B"} ; order B,A -> {"t":"A"}
```

Two clients that paged the same channel in different orders would show different boards,
permanently, with every status field reporting success. `SurfacePostView` carries no post
id, so the reducer cannot dedupe even if it wanted to. Server-assigned sequence numbers
should be unique, so this needs a sync/hydration bug or a merged window to trigger — but
nothing checks the invariant, no test generator produces it, and the failure is silent and
permanent. The cheap guard is a tiebreak on a stable post identity, or an assertion.

**R2 — a host snapshot with an inflated `upToSequenceNum` bricks the channel.** _High blast
radius, low-to-medium likelihood._ Nothing requires `upToSequenceNum` to be ≤ the
snapshot's own `sequenceNum`, or ≤ the newest post. Probe:

```
future-boundary snapshot -> {"status":"reduced","state":{"frozen":true},
  "baseSnapshotSeq":1000000,"newestFoldedSeq":1000000,"foldedEventCount":0,…}
```

That snapshot also wins selection forever (greatest `upToSequenceNum`), so every subsequent
event at that revision is frozen. Recovery requires deleting or edit-retracting that
specific post — and §6's fallback then drops to the next-oldest snapshot, not to the live
log. It is host-authored and therefore inside the trust model, but the realistic trigger is
not malice: it is a bot writing `sentAt` (≈1.7e12) or another channel's watermark into the
field. §4.4's `// all folded events have sequenceNum ≤ this` reads as a checked invariant
and is a writer obligation. A one-line reducer check (`upToSequenceNum <= the snapshot
post's own sequenceNum`) would close it; a test would cost four lines.

**R3 — "pure and total" is true of posts and false of the spec.** _High blast radius,
low likelihood._ Probe: `reduceSurface` with `actions: { a: {} }` throws
`TypeError: undefined is not an object (evaluating 'ops')` at line 322. The interface
declares `spec` as "the validated, authoritative spec" and every call site today reaches it
through `readSurfaceSpec` or `SurfaceSpecSchema` — `adapter.ts` from the persisted channel,
`surface-lint.ts` after `checkSpecSchema`. So it is a documented precondition that happens
to hold. But the module header promises "Pure and total — hostile input is skipped… never
thrown on", and the renderer's whole §6 design is that a bad definition becomes the
"invalid definition" _state_ rather than an exception. One future call site that folds a
template read off disk, or a staged fork spec, turns a render into a crash. It is one
`Array.isArray(ops)` guard away.

**R4 — the `reducer.ts:268` fix lives in one CLI command, not in the contract.** _High
blast radius, medium likelihood._ D167 is a good decision — the safe merge genuinely
doesn't repair the confirmed case, so refusing is right. But the refusal is implemented in
`surface publish` (`commands/surface-publish.ts` + `surface-initial-state.ts`), the reducer
is unchanged, and the semantic is still undocumented in the plan (D7 above). Anything else
that writes a preserving revision reintroduces the bug at full strength: a Hermes-side
publish, a hand-edited channel description, a future client-executed publish (§9 explicitly
contemplates one for v1 forking), or an operator using `surface event`/`surface snapshot`
directly. D165's own account is the argument for why this matters — documentation of the
precise failure in the skill the model reads was measured and found insufficient; a guard
in one of several writers is the same category of control.

**R5 — the gate cannot see a permanently-refused action (F3).** _Medium blast radius,
medium likelihood._ A dead control ships and renders as a working button. The generating
model has to produce a grammatically-valid pointer misusing `$actor` (`/votes/$actor-vote`,
`/log/$actorEntry`) — plausible, because it is the _closest wrong spelling_ to the pattern
`PARADIGM.md` tells it to reach for first. The reducer behaves correctly throughout; the
gap is that the one instrument that folds actions throws the abort signal away.

**R6 — identity canonicalization is a client-boundary discipline the CLI does not share.**
_Medium blast radius, low likelihood._ `adapter.ts:14–25` states it plainly: "The reducer
compares author identity verbatim, so ship-string canonicalization happens HERE and nowhere
else — this boundary is part of the security invariant," and it canonicalizes both the host
(from the channel id) and every author. The `tlon-skill` boundary does neither:
`channelHostShip` returns `parseSurfaceNest(...).host` verbatim
(`commands/surface-common.ts:541`), and `toSurfacePostRecord` passes `post.authorId ?? ''`
through unchanged (`surface-runtime.ts:215`) — while a neighbouring check three files over
_does_ normalize (`commands/surface-records.ts:1014`,
`if (deps.normalizeShip(post.authorId) !== host) continue`). Probe shows the failure is
total and silent: `hostShip: 'zod'` against `authorId: '~zod'` folds no host event and
reports `skippedEventCount`, not an error. Both sources are sigged today, so this is
latent; the risk is that `surface state` is the tool used to _verify_ a publish landed, so a
desig'd string anywhere upstream makes the verification tool report an empty board for a
healthy channel. There is an `adapter.test.ts` case for the client side
("host events fold when the author is non-canonical for the channel host") and no
equivalent on the CLI side.

**R7 — `$actor` as an object key, both directions (D2/D3).** _Low blast radius, medium
likelihood._ An authoring footgun (every member's press lands on one shared cell) plus a
host-op hole the plan says shouldn't exist. No test anywhere covers keys. Would be caught
today by the no-op-control rule, for the wrong reason and with an unhelpful message.

**R8 — `provenance` cap divergence with no boundary test (D4).** _Low, low._ Recorded for
completeness: the one cap the plan and the code disagree on is the one cap
`surfaceCaps.test.ts` does not exercise.

---

## What I could not determine, and what I'd have needed

- **Whether Hermes reproduces the reducer or calls it.** §9 says "Hermes inherits
  everything here," and my memory of this project is that openclaw (TS) and hermes (Python)
  are parallel implementations. If Hermes has its own fold or its own publish path, R4 and
  D1 are live rather than latent — D1 in particular would produce silently divergent state
  keys on six of nine templates. Nothing in this worktree answers it; I'd need the hermes
  repo.
- **Whether any real channel currently carries a snapshot with an out-of-range
  `upToSequenceNum` (R2), or a spec written outside `surface publish` (R4).** Answering
  either means scrying a live channel, which the constraints correctly forbid. A read-only
  `surface state --json` over the nine template channels in `~zod/umnjhaod` would settle
  both cheaply if someone is already on a ship.
- **Whether R1's duplicate `sequenceNum` is reachable from the hydration loop.** I read the
  reducer's contract, not `hydration.ts`'s windowing and merge logic in full. The question
  is whether any path can hand `reduceSurfaceChannel` two distinct posts carrying the same
  `sequenceNum` — e.g. across a paged window boundary, or between a live SSE arrival and a
  re-fetch. That is a focused read of `packages/shared/src/store/surface/hydration.ts`
  plus the post-store query behind it, which I scoped out.
- **Whether the gate's smoke render can be made to see F3 cheaply.** I established that
  `abortedSequenceNums` is discarded at `surface-lint.ts:2224–2263` and that no other rule
  covers it, but I did not work out whether raising it there produces false positives on the
  nine shipped templates — that needs the template corpus run, which writes preview
  artifacts and was out of scope for a read-only pass.
