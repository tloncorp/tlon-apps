# 05 — `$actor`: the reducer's substitution vs the gate's exemption

Read-only audit. Nothing in the worktree was changed; the only write is this file.
Two throwaway probes were run from the scratchpad **outside** the worktree
(`/private/tmp/claude-501/.../scratchpad/actor-probe.ts`,
`analyzer-probe.ts`). They import the real modules by absolute path and call
`applyOp`, `parsePointer`, `actionWritesOnlyTheActor` and `analyzeReachability`.
No ship, channel, container or shell script was touched.

---

## Verdict

The two readers of `$actor` agree almost exactly on **what the token is** — the
gate's `valueNamesActor` is a faithful transliteration of the reducer's
`valueContainsActorPlaceholder`, and on any path the lint will pass, the gate's
whole-element path test is exactly the reducer's whole-segment test. There is
essentially no token-level drift to exploit. The hole is one level up: the gate
treats _"the reducer will substitute somewhere in this op"_ as a proxy for
_"this op writes only the presser's own data"_, and those are not the same
predicate. Substitution is a property of **where the author put the token**,
which the author fully controls; ownership is a property of **where the op
writes**, which the gate never looks at. So the "EVERY op, not merely one"
defence — the discriminator the commit message names as the whole point — is
defeated by moving the token, not by removing it. I confirmed at the
`analyzeReachability` level that the exact defect the rule was built for
(`set /tasks/theme/status "doing"` + `set /claims/$actor "theme"`, correctly
reported) goes completely silent under three separate one-line rewrites that
change nothing about what the board does. All three are live: they pass
`spec-schema`, `pointer-hygiene`, `action-idempotency` and every other rule in
`surface-lint.ts`. And the aggravating factor is that the finding's own printed
message — the text the generating model reads out of `surface preview` — states
the exemption rule verbatim, so the gate hands the model the bypass in the same
sentence it reports the defect.

Separately and more narrowly, there is one genuine _mechanism_ disagreement: the
reducer has a **fold-time** `$actor` grammar (partial-segment use is a `grammar`
refusal) that neither the gate's static test nor `pointer-hygiene`'s
`parsePointer` models, and the resulting always-refusing op is laundered into
invisibility by `collectNoOpControls`' `edge.aborted` exclusion.

---

## The two rules, side by side

Reducer: `packages/api/src/client/surface/reducer.ts` (`:302-320` sets
`actor = authorId` for `mode:'invoke'`; `:322-339` aborts the entry on any
refusal) delegating to `packages/api/src/client/surface/jsonPointer.ts`.

Gate: `packages/tlon-skill/scripts/surface-transitions.ts:695-724`
(`actionWritesOnlyTheActor` + `valueNamesActor`), consumed at `:740-778`
(`collectNoOpControls`).

|                       | **Reducer — what actually happens at fold time**                                                                                                                                                                                                | **Gate — the static exemption test**                                                                                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| where read            | `applyOp` per op, per event, at fold (`jsonPointer.ts:340-408`)                                                                                                                                                                                 | once per action, over `spec.actions[actionId].ops`                                                                                                                                          |
| actor value           | `post.authorId` (verified sender); `undefined` for host raw ops                                                                                                                                                                                 | never resolved — only the token's presence is read. The walk always presses as one ship, `GATE_ACTOR_SHIP = '~sampel-palnet'` (`surface-lint.ts:363`, used at `surface-transitions.ts:431`) |
| **path — parse**      | `parsePointer` (`:92-121`): must start with `/`; ≤200 chars; ≤12 segments; each segment RFC-6901-**unescaped** (`~0`→`~`, `~1`→`/`, dangling/other `~` ⇒ refusal); no `__proto__`/`constructor`/`prototype`                                     | none. Raw string, `path.split('/')`, leading empty element included, **no unescaping**, no caps, no leading-`/` requirement, `?? ''` if absent                                              |
| **path — match**      | `resolveActorSegments` (`:133-158`): segment **exactly** `$actor` ⇒ substitute; segment merely **containing** `$actor` ⇒ **whole op refused** (`grammar`); actor `undefined` ⇒ any `$actor` refused; actor that is a forbidden key ⇒ refused    | element **exactly** `$actor` ⇒ this op qualifies. A containing-but-not-equal element is simply "not a match" and falls through to the value test — the refusal is not modelled              |
| **value — which ops** | `set` and `append` only; `del` has no value                                                                                                                                                                                                     | same in effect (`del` carries no `value` after schema parse ⇒ `valueNamesActor(undefined)` is false)                                                                                        |
| **value — traversal** | `substituteActorInValue` (`:178-193`): string **exactly** `'$actor'` ⇒ actor; recurse into array elements and `Object.keys(v)` → values. **Object keys are never substituted.** Substrings left literal (`"went to $actor town"` stays literal) | `valueNamesActor` (`:713-724`): string exactly `'$actor'`, recurse `Array.some` and `Object.values(...).some`. **Keys not inspected.** Substrings not matched                               |
| depth                 | unbounded within the JSON depth cap                                                                                                                                                                                                             | unbounded                                                                                                                                                                                   |
| case                  | exact, case-sensitive                                                                                                                                                                                                                           | exact, case-sensitive                                                                                                                                                                       |
| host ops              | `valueContainsActorPlaceholder` (`:160-171`) refuses the op if the token is in a **value**; a token as an object **key** is accepted and written literally (probe-confirmed, and this contradicts the module doc at `jsonPointer.ts:30`)        | n/a — the gate only ever reads declared actions, which always fold with an actor                                                                                                            |
| action lookup         | `getDeclaredAction` (`schemas.ts:496-503`), own-property only                                                                                                                                                                                   | `spec.actions[actionId]`, prototype-chain reachable                                                                                                                                         |
| combination           | per op, independently                                                                                                                                                                                                                           | `ops.length > 0 && ops.every(qualifies)` — empty `ops` is deliberately **not** exempt                                                                                                       |

**Member-supplied data.** There is none. `SurfaceEventEntrySchema`
(`schemas.ts:390-403`) gives `mode:'invoke'` exactly one field, `actionId`. A
member cannot ship a byte of content; every op value is a spec literal written
by the app author. So a literal `"$actor"` string can only reach state via
`initialState`, a host snapshot's `state`, or a host op's object **key** — and
in none of those does anything ever re-scan it. Substitution is a property of
_the op being applied_, never of the state; nothing walks state looking for the
token. A literal `$actor` in state is inert and stays literal forever. Both
readers agree on this by not participating in it.

---

## Disagreements

Shapes are described, not published. `C` is the control (the real shipped
kanban action shape); `S1`–`S3` are the ones that matter. All rows verified with
the real modules by the two probes; the `S1`/`S2`/`S3` rows were additionally
verified through `analyzeReachability` on a one-node self-loop graph.

| #       | Shape (ops of one action)                                                                | Gate says                                                             | Reducer does                                                                  | Direction                                                                                               | Live?                                                                                                                                                                                                                                         |
| ------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C**   | `set /tasks/theme/status "doing"` + `set /claims/$actor "theme"`                         | **not exempt** (op 1 has no token)                                    | writes both; re-press by the same actor is byte-identical                     | correctly reported                                                                                      | control — works                                                                                                                                                                                                                               |
| **S1**  | one op: `set /tasks/theme` `{"status":"doing","claimedBy":"$actor"}`                     | **exempt** — the single op names the token in its value               | substitutes `claimedBy`; writes a **shared** path; self-loop on re-press      | gate exempts a real dead control                                                                        | **LIVE**                                                                                                                                                                                                                                      |
| **S2**  | `set /tasks/theme/status {"v":"doing","by":"$actor"}` + `set /claims/$actor "theme"`     | **exempt** — now every op names the token                             | identical board behaviour to C                                                | gate exempts a real dead control                                                                        | **LIVE**                                                                                                                                                                                                                                      |
| **S3**  | `set /config/mode ["fixed","$actor"]`                                                    | **exempt** via array recursion                                        | substitutes element 1 into a shared slot                                      | gate exempts a real dead control                                                                        | **LIVE**                                                                                                                                                                                                                                      |
| **S4**  | `set /board/x$actor 1`                                                                   | not exempt                                                            | `resolveActorSegments` refuses (`grammar`, partial-segment); the entry aborts | control is dead on **every** screen, and `collectNoOpControls` drops it because `edge.aborted` (`:753`) | **LIVE** (different mechanism — see below)                                                                                                                                                                                                    |
| **S5**  | `set /shared/slot {"$actor":true}`                                                       | not exempt (keys not read)                                            | writes the literal key; no substitution                                       | agree — reported if it self-loops                                                                       | not a hole                                                                                                                                                                                                                                    |
| **S6**  | `set $actor 1` (no leading `/`)                                                          | **exempt** — `'$actor'.split('/')` is `['$actor']`                    | `parsePointer` refuses "path must start with /"                               | gate exempts an op that can never apply                                                                 | **blocked** — `pointer-hygiene` (`surface-lint.ts:1315-1348`) errors, and `surface publish` hard-fails on any lint violation (`commands/surface-publish.ts:599-611`)                                                                          |
| **S6′** | same family: `>12` segments, `>200` chars, or a forbidden segment, with `$actor` present | exempt                                                                | `parsePointer` refuses                                                        | same                                                                                                    | **blocked** by `pointer-hygiene`                                                                                                                                                                                                              |
| **S7**  | `set /votes/a~1$actor 1`                                                                 | not exempt (raw element is `a~1$actor`)                               | unescapes to `a/$actor`, contains-but-≠ ⇒ refused                             | both say "not exempt"; the op always aborts, so like S4 it is dropped by the `aborted` clause           | **LIVE** as an S4 variant; the exemption itself is not the hole                                                                                                                                                                               |
| **S8**  | action id that is an inherited `Object.prototype` name                                   | `spec.actions[id]` returns a function; `action.ops.length` **throws** | `getDeclaredAction` returns `undefined`, invoke skipped                       | gate crashes rather than exempts                                                                        | **blocked** — `ActionIdSchema` is `/^[a-z0-9-]+$/` plus a `isForbiddenObjectKey` refine, and `constructor` is the only lowercase inherited name                                                                                               |
| **S9**  | a `del` op carrying a stray `value:"$actor"`                                             | would be exempt on a **raw** spec                                     | ignores values on `del` entirely                                              | gate over-reads                                                                                         | **blocked in production** — `surface preview` parses through `SurfaceSpecSchema` before the walk (`surface-preview.ts:1240ff`, `:1331`) and `z.object` strips the key. Latent for any other caller of the exported `actionWritesOnlyTheActor` |

### The live findings in words

**S1/S2/S3 — the exemption is bought, not earned.** The commit message states the
discriminator plainly: _"a self-loop in a closed walk is a defect unless EVERY op
of the action mentions `$actor`. Every, not some — the kanban action writes a
task's status AND the actor's claim, and an any-op test exempts it on the half
that is not dead."_ That reasoning is correct about the **op boundary** and
silent about the **op interior**. Merging the two writes into one op (S1), or
stapling `"by": "$actor"` onto the shared op's value (S2), satisfies "every op"
without changing anything a member experiences. Probe output, `analyzeReachability`
over the same one-node self-loop graph:

```
C   two ops, shared + actor    noOpControls=[{theme-doing, deadStates:1, renderedStates:1}]  findings=no-op-control
S1  merged into one op         noOpControls=[]  findings=(none)
S2  stamp on the shared op     noOpControls=[]  findings=(none)
S3  actor buried in an array   noOpControls=[]  findings=(none)
```

Nothing else in the gate objects. `pointer-hygiene` passes (well-formed
pointers), `spec-schema` passes, `action-idempotency` (`surface-lint.ts:2230-2280`)
folds once vs twice and gets identical state so it passes, `undeclared-action`
is about bundle/spec agreement, and no rule anywhere constrains _which_ paths an
action may write.

**Load-bearing detail: the recursive value traversal is required by no shipped
template.** Across all nine templates, `$actor` appears in a value in exactly one
shape — the whole value is the bare string `"$actor"` (expense-split's four
`paid-*` actions). Nowhere is it nested inside an object or an array. The array
and nested-object arms of `valueNamesActor` are exercised only by a synthetic
test (`surface-transitions.test.ts:569-577`) and are otherwise pure attack
surface. Narrowing the value arm to _"the value **is** exactly `\"$actor\"`"_
would keep all nine templates green and kill S1, S2 and S3 outright. That is the
cheapest available hardening and it is checkable against the templates today.

**S4 — abort-laundering at the `$actor` grammar seam.** The reducer's `$actor`
rules are split across two layers: `parsePointer` does the pointer grammar, and
`resolveActorSegments` does the `$actor` grammar. `pointer-hygiene` calls only
the first. So `set /board/x$actor 1` is a well-formed pointer that the reducer
refuses on **every** fold, forever. The control is dead on every screen — the
strongest possible form of the defect — and `collectNoOpControls` skips it,
because `edge.aborted` is true and the code deliberately excludes aborted edges
so as not to confuse a refused fold with a pointless control. `aborted` is read
nowhere else in the entire module (grep: `surface-transitions.ts:203, 453, 753`),
so an always-aborting action is invisible in the whole reachability report.
`action-idempotency` also passes it, because once-vs-twice are both "nothing
happened". Two notes on scope: (a) this is a general abort-laundering hole — an
`append` onto a non-existent array, or a `set` writing through a scalar, does the
same thing — but the `$actor` variant is the one that slips past
`pointer-hygiene`, because every other always-refusing path shape is either
caught statically or depends on state; (b) the fix is one line in
`checkPointerHygiene`: after `parsePointer` succeeds, reject any segment that
contains `$actor` but is not equal to it.

**S6/S6′ are genuinely blocked** and should not be treated as findings against
the gate; `pointer-hygiene` runs ahead of the walk in gate order and `surface
publish` refuses on any violation. They are listed because they are the shapes
one would reach for first, and because they document that the gate's path test
is only safe _because_ another rule is doing the parsing it skips — a coupling
that is nowhere stated in either file.

---

## What the tests pin

**Reducer side — well pinned.** `packages/api/src/__tests__/surfaceJsonPointer.test.ts:271-325`
pins, as named tests: whole-path-segment substitution; deep exact-string value
substitution through objects and arrays with **substrings explicitly left
literal**; partial-segment rejection (`/votes/x$actor`); host-op rejection in
all three spellings; and normal host ops unaffected. Property tests at `:394-460`
add "op application never mutates input" and "`set` at `/votes/$actor` is
idempotent per actor". `packages/api/src/__tests__/surfaceReducer.test.ts:134`
pins that `$actor` keys per-user state by the _verified author_, and `:239`,
`:624`, `:841` pin that `$actor` in a host op invalidates the op and stops the
entry. This side is not the risk.

Gaps on the reducer side: nothing pins that an object **key** equal to `$actor`
is left literal, in either direction — which means `jsonPointer.ts:30`'s claim
that "any `$actor` use invalidates the op" for host ops is untested and, as
probed, false for keys.

**Gate side — strongly pinned for intent, unpinned at the seam.**
`surface-transitions.test.ts:529-670` is a good suite: it pins path-`$actor`
exempt, bare-value-`$actor` exempt, nested-value exempt, a shared write with no
token **reported**, "EVERY op, not merely one" (the exact C shape),
zero-op actions not exempt, aborted edges excluded, and findings withheld on a
non-closed walk. `:266-322` walks all nine templates asserting
`noOpControls === []`, with two explicit vacuity guards — one asserting that at
least seven templates _do_ contain self-loops (so the exemption is doing work),
one asserting at most one template fails to close.

What nothing pins:

- **No differential test ties the two readers together.** No test anywhere
  imports both `actionWritesOnlyTheActor` and `applyOp` and asserts that
  "the gate says this op mentions `$actor`" implies "the reducer substitutes in
  this op" or anything about the converse. The two `$actor` readers were written
  eight days apart in different packages and are held together only by sharing
  the `ACTOR_PLACEHOLDER` constant — which is the string, not the semantics.
- **No test of S1/S2** — a single op carrying both a shared write and an actor
  stamp. The nearest test (`:569-577`, "exempts `$actor` nested inside a value",
  `set /claims/ferry {by:['$actor']}`) blesses precisely the traversal S1 and S3
  exploit, framed as legitimate.
- **No test of the partial-segment path shape at the gate.** The reducer pins it;
  the gate never sees it.
- No test that `$actor` as an object key does not grant the exemption.

**One structural fact worth putting beside the tests.** The shipped `kanban`
template — the app family this whole rule exists for — is the one template whose
walk does **not** close (24577 states; the test at `:311-322` names it). On a
non-closed walk, `analyzeReachability` emits no findings at all, and
`reachabilityCitation` writes _"not measured: … Score check 7 from the captures
and the request alone, as it was scored before the walk existed"_. So for the
real board the rule was written about, the rule asserts nothing. It is proven to
work on a 3-card, 193-state fixture.

---

## Ranked risks

1. **The finding text publishes its own bypass.** The `no-op-control` message ends
   _"(An idempotent re-press of your own answer is not this: an action whose every
   op writes `$actor` is exempt.)"_ — and `commands/surface-preview.ts:331-340`
   prints `finding.message` verbatim into the numbered defect list that the
   generating model reads and repairs against. A model told "your control is dead,
   and here is the exemption criterion" can satisfy the criterion (S1/S2) more
   cheaply than it can fix the button row. The exemption is self-granted _and_
   self-documented. If nothing else changes, the exemption sentence should come
   out of the member-facing message and live only in the source comment.

2. **The value-side exemption is far wider than any template needs.** Restricting
   it to a value that is exactly `"$actor"` closes S1, S2 and S3 in one line and
   costs nothing against the nine shipped templates (verified from their
   `spec.json`s: every template value-use is the bare string). This is the single
   highest-value change in this note.

3. **S4 / abort-laundering.** An action whose ops always refuse is dead on every
   screen and is reported nowhere. Reachable today via partial-segment `$actor`,
   which `pointer-hygiene` does not check. Two independent fixes, either
   sufficient for the `$actor` case: teach `checkPointerHygiene` the
   `$actor`-grammar rule, or report always-aborted self-loop edges as their own
   finding kind rather than silently dropping them.

4. **The clean rubric citation is stale.** `reachabilityCitation`'s
   `findings.length === 0` branch still writes _"every declared action has a
   control a member can press, and no value is reachable only through another"_ —
   it was never updated when `no-op-control` was added, unlike
   `formatReachabilityReport`'s clean line, which gained "every control drawn can
   move the board" in the same commit. So a self-exempting app gets a rubric line
   that positively asserts cleanliness on two properties and is silent on the
   third, which reads as coverage the sheet does not have.

5. **`actionWritesOnlyTheActor` bypasses `getDeclaredAction`.** Not exploitable
   today (`ActionIdSchema` blocks `constructor`, and preview always validates),
   but it is a second, divergent reader of `spec.actions` in a codebase whose
   stated principle is "one shared implementation so the client, tlon-skill, and
   tests cannot drift" (`reducer.ts:17-19`). Using the shared accessor costs one
   import.

6. **Single-actor walk.** `GATE_ACTOR_SHIP` is one ship for the entire graph, so
   "idempotent for me" and "dead for everyone" are literally the same edge and
   _some_ static exemption is unavoidable in the current design. Worth recording
   as the root cause, but I do **not** recommend a two-actor walk as the fix: it
   would not separate the kanban case either (pressing as a second actor moves
   `/claims/$actor`, so the action is not a self-loop for them, while the status
   write is still dead). The property that actually distinguishes them is per-op
   — "this op wrote a value that was already there" — which `applyOp` computes
   internally today but `reduceSurface` does not surface. That is a plan-level
   observation, not a patch.

---

## What I could not determine, and what I would have needed

- **Whether a real generating model actually takes the S1/S2 route.** I showed the
  bypass is available and that the model is shown the criterion; I did not show
  it is taken. Would need an eval run through
  `packages/openclaw/dev/surfaces-eval-probe.ts` with a `no-op-control` finding in
  the repair loop — a live-model run, out of scope for a read-only pass.
- **Whether the proposed narrowing (value must be exactly `"$actor"`) leaves the
  nine templates green under the actual walk.** I verified it from the templates'
  `spec.json` op values, which is sufficient for the _predicate_, but I did not
  re-run the nine walks, since that requires editing the source. Would need the
  one-line change plus `surface-transitions.test.ts` (~5 min of walk time, the
  suite budgets 300 s for the nine).
- **Whether S1/S2 survive a full `surface preview` end-to-end.** I verified the
  predicate against the real modules and the analyzer against a hand-built
  one-node graph, which covers every line of the exemption path. I did not author
  a bundle and run `surface preview`, because that writes captures and a rubric
  template. Closing it properly means a fixture bundle in
  `surface-transition-fixtures.ts` shaped like S1, asserting `noOpControls === []`
  — i.e. the missing regression test, which is itself the recommendation.
- **Whether any consumer other than `surface preview` calls
  `actionWritesOnlyTheActor` or `analyzeReachability`.** Grep found none outside
  the module and its tests, plus the rubric artifact consuming the report. If the
  exported predicate acquires a caller that passes a raw spec, S9 becomes live.

### Tooling note

`surface-transitions.ts` contains two literal `\x00` bytes, in the projection and
checkpoint signature template strings (`:1109`, `:1232`). `file(1)` therefore
reports it as `data` and plain `grep` skips it as binary **without a message**,
including under `grep -r`. Anyone grepping this file for `$actor` or anything
else will silently get zero hits. Use `grep -a`.
