# Session 6d — correctness half, for review

The containment half is a separate document
(`surface-channels-6d-review-containment.md`) and is deliberately split from
this one; see its header for why. This half carries everything else, at full
detail.

**The session added no capability.** Every item repaired an instrument, a
claim, or a record. It exists because the end-of-6c audit found that guards
written before this project adopted its own rules were never re-audited under
them. The house rule now held literally: a guard, test, lint rule or CI job
enters the tree with its negative control demonstrated, or it enters as a claim.

Each item below names its control and the demonstration that the control can
fail. `DECISIONS.md` D171–D184 carries the reasoning.

---

## The authoring gate

**The `$actor` ownership exemption fell to relocating the token rather than
removing it.** The gate exempts an action from the dead-control finding when
every op "writes `$actor`". Its predicate was a faithful transliteration of the
reducer's substituter, recursive descent included — and the fidelity was the
bug. Substitution is a property of where the author put the token; ownership is
a property of where the op writes, and the gate never looked at the second. An
audit built three shapes that bury the token in an object value, in a nested
object value, and in an array element, each writing a shared path, and all three
took the exemption while passing every other rule. Narrowing the value arm to
"the value _is_ exactly the token" closes all three at zero cost: across all
nine shipped templates the token appears in a value four times, all in one
template, all as the bare string. _Control:_ the three shapes are now fixtures;
with the recursive arms restored they report nothing, with the narrowing all
three report. Both directions were run. `surface-transitions.test.ts`.

**The finding's own text published the bypass to the party that benefits from
it.** The message ended by naming the exemption's condition, and `surface
preview` prints `finding.message` verbatim into the defect list the generating
model reads and repairs against. Stripped; the rule stays documented for humans
in `RUBRIC.md`. A model repairing a defect needs to know what is wrong, not
which shape makes the check stop looking. _Control:_ a test asserts the message
contains neither "exempt" nor the token.

**Nothing imported both readers of `$actor`, and now something does.** The
gate's detector and the reducer's substituter were written days apart in
different packages and held together only by sharing a string — not its
semantics. The new differential test asserts the agreement that must hold
(nothing the gate exempts is a token the reducer would ignore or refuse) and
pins the divergence that must _not_ be closed (the gate is strictly narrower on
values). _Control:_ widening the gate back to parity fails it; that edit was
made and reverted. `surface-actor-differential.test.ts`.

**An action the reducer refuses on every path shipped green.** An op with a
partial-segment `$actor` is a hard grammar refusal, so the action is declared,
drawn, pressable and incapable of ever moving the board. Every existing rule was
structurally blind: the pointer rule sees a legal pointer; the idempotency rule
sees two identical states, _because a refused fold is trivially idempotent_; the
activation check sees a control that does invoke it; and the dead-control
finding excludes it, because the walk skips aborted edges. New rule 18,
`inert-action`, reading the `abortedSequenceNums` the reducer already returned
and nothing had ever looked at. Scoped to yield when an earlier rule already
reported on the same action, so a statically-malformed pointer is one defect
rather than two. _Control:_ the fixture spec lints `ok: true` with the rule
disabled and `ok: false` with it.

## The reducer

**Two posts sharing a sequence number made the fold order-dependent, and every
determinism property excluded the case.** There is no unique index on
`(channelId, sequenceNum)`; two posts sharing one tied completely in the
comparator, so sort stability handed the result to arrival order — two clients
holding identical posts could hold different state, which §6 promises cannot
happen. The four order-invariance properties could not see it: all four shuffle
a hand-built array whose sequence numbers come from a strictly-increasing
counter, so **the failing input was outside the generator of the property meant
to cover convergence.** Duplicates are now in it. The tie-break is the
host-stamped post id, compared numerically rather than lexicographically —
canonical ids are dot-grouped variable-length renders, so a plain string compare
puts `9` after `10`. _Control:_ removing the tie-break fails the property plus
two ordering tests.

**An inflated snapshot boundary could brick a channel permanently.** A snapshot
claiming coverage far beyond the real head wins selection forever, freezes every
real event beneath its boundary, and leaves the board at zero folded events —
recoverable only by deleting that specific post. The realistic trigger is a
writer putting a millisecond timestamp in the field, not an attacker. Hydration
already held the server-advertised head and never passed it; it is now threaded
through, and selection skips any snapshot claiming coverage beyond it. Skipping
rather than clamping, because a boundary that wrong means the writer's state is
untrustworthy too. _Control:_ the inflated snapshot freezes the board without a
head and folds normally with one; both are pinned, including the boundary case
where the claim equals the head exactly, which must still be accepted.

**`--preserve-state`'s semantic is a writer obligation and is now recorded as
one.** The existing guard lives only in `surface publish`; the reducer replaces
`initialState` wholesale and every merge rule that would carry an edit is
unsafe. So any other writer — the Python adapter, a hand-edited channel
description, the client-executed publish v1 contemplates — reintroduces the bug
at full strength. It had been written down only in a test comment and a decision
entry, nowhere in the plan. Now in plan §4.3 and §7 alongside the snapshot
obligation, and as a named out-of-scope case in the hooks design note: both are
host-authored, and the pre-filter must allow every host event, so neither is
reachable there. _Control:_ tests pin replace-wholesale as the documented
contract, so a future "helpful merge" has to delete an explicit test.

## The render path

**A bundle that threw before registering left a blank board forever, and wiring
the existing callback would not have fixed it.** The audit read this as an
unplumbed callback; it is worse. On a module-evaluation throw the shell posts
_only_ `ready` — its own script has completed, the bundle's separate script
aborts, registration never happens, and every render short-circuits. The host
sees a healthy handshake and an app that never draws. There was no error message
to route, so passing the callback would have changed nothing. Two halves,
therefore: the shell installs window error handlers that report while no app is
registered (after registration the render path owns errors and reports them with
the correct phase), and the host renders a defined halted state with a reload
that bumps the session key rather than reassigning the frame's source — since
reloading the same element is indistinguishable from the frame navigating
itself, which the host tears down. _Control:_ a bundle with a reference error on
line one reports; with the handlers removed the report array is empty. Also
pinned at the container level: a render-phase error must _not_ trigger the
halted state, because the shell already handles that case in-frame.

**The two halves of the render path were each tested against a fake of the
other, and the composition had a live bug neither could see.** The host suite
mocks the shell artifact to a no-op and hand-dispatches the handshake, so no
shell runs and no real message is parsed. The shell suite drives a hand-rolled
frame with no schema validation and no revision cross-check, posting a
fabricated spec. Both were green while the bug above was live. `composed.spec.ts`
runs the real shell artifact in a real browser frame driven by the real host
session layer, with validation and the revision check active; the session is
transport-agnostic by construction, so the test supplies only the wire. The
halves' own tests stay.

_Two things worth a reviewer's attention here, both mine:_ I wrote a
stale-revision test on a false premise — the session sends its spec in the
handshake, so the shell echoes back whatever revision the host gave it and the
two cannot disagree while the frame is the one that session initialized. It is
rewritten to assert that premise compositionally, with the check itself
exercised by a labelled synthetic message rather than a hand-made message
dressed up as shell behaviour. And I removed a "the frame really is blank"
assertion before it shipped: it read the frame's document across an opaque
origin, where the result is null and the assertion would have passed whether or
not the frame was blank. A guard that cannot fail, written into the file whose
purpose is removing them.

**The hydration hook had no test, and under the app's global `staleTime:
Infinity` its dependency predicate is the only thing that ever refreshes a
board.** The predicate reads one specific position in the query key and nothing
else; the hook uses a raw query rather than the wrapped helper, so the position
is hand-placed and nothing type-checks it. A key that moved it would silently
never refresh again, with no error. The key is now exported so a test can assert
the real one, and the tests drive the real invalidation path — a live observer
on the module's own client, with real writes — rather than re-implementing the
predicate, which would have been this session's characteristic trap. _Control:_
moving the position fails three tests, not just the shape guard: the board keeps
rendering its first fold forever.

## Record and hygiene

**The decision record's location is now checked mechanically.** Three entries
have been written to a `DECISIONS.md` other than the tracked one, the third on
the day the manual check was written down. A script fails if any second record
exists, and fails if any document cites a decision the tracked record does not
define. It runs in the one CI job with no path filter, for the same reason its
sibling does: a stray root file matches no filter, so a gated guard would be
skipped exactly when needed. It caught this session's own forward references on
its first run. Stated rather than implied: there is no working pre-commit hook
to attach it to — the configured hooks path points outside the repository at a
file that does not exist — so CI is the enforceable half.

**The NUL separators are gone, and the fix is an injective join rather than a
prettier delimiter.** Two files used control characters as signature separators,
which made `grep` skip them silently, with zero hits and no message; three
investigations lost time to it. The obvious fix is wrong — those separators were
collision-proof for a real reason, and every printable candidate can appear in a
value, where a collision does not crash but silently merges two distinct groups
into one wrong row. The signatures are now `JSON.stringify` of an array:
injective by construction, printable, and needing no argument about the token
alphabet. One consequence recorded because it is not cosmetic: the eval scorer's
corpus digest changed, so its baseline was regenerated in the same commit; a
stale one would have reported the corpus as edited.

**The plan described the `$actor` key incorrectly, on six of nine templates.**
It said path substitution emits the escaped form; the code substitutes into an
already-unescaped segment list, so the real key is plain. The behaviour was
right and the description was wrong, which is the dangerous direction. **The
parity check the session asked for cannot be run from this repo:** there is no
Python surface implementation here — the Python adapter has 53 files and zero
hits for the token, the placeholder constant, or any pointer or spec symbol.
Recorded as an open question against the out-of-tree repository rather than
answered by inference.

**Housekeeping, each with its reason.** A truncated 309-byte stub ending
mid-word is deleted. Two seed fixtures that cannot pass the gate they predate
are marked ungated-by-design in the seed doc, with the note that the right
resolution is neither to rename the fixture nor to weaken the rule. All 29
`data-testid` attributes are removed from the templates and the primitives doc
now says not to write them: nothing reads one, so they are markup that looks
load-bearing and is not. One recorded-not-fixed item: a host op can write a
literal `$actor` object _key_, contradicting a doc comment, because substitution
walks keys to recurse but never rewrites them.

---

## What a reviewer of this half should press on

1. **`inert-action`'s suppression rule.** It yields to any finding already filed
   against the same action. That is right for a malformed pointer, but I did not
   enumerate every rule it now defers to; a rule that reports on an action for an
   unrelated reason would mask a genuinely dead action.
2. **The tie-break's id comparison.** It handles canonical dotted renders and
   falls back to a plain string compare for anything else (sequence stubs carry
   synthetic ids). Any total order is correct as long as every client picks the
   same one, but I have not proved the two id families can never interleave in a
   way that matters.
3. **The advertised head is a ceiling, not a proof.** A caller supplying no head
   gets the old behaviour, deliberately and with a test. Whether every real
   caller supplies one is a question I answered for the client and not for the
   CLI, which has no equivalent watermark.
4. **The composed test runs the session layer in node and the shell in the
   browser.** That is a real composition, but it is not the React component; the
   container's own wiring is covered separately in jsdom with the state
   components stubbed.
5. **Whether the claims index (`surface-channels-claims-index.md`) is honest.**
   It is the session's other deliverable and its value is entirely in whether
   the empty rows are really empty.
