# Fix diff for round two — Surface Channels

The changes made in response to `surface-channels-sol-review-r4-findings.md`,
one paragraph per finding. Written for the round-two reviewer: it says what
moved and names the control, so a re-review can start from the control and work
outward rather than re-deriving the finding.

**This round is on the correctness track only. Nothing in it touches the
browser-containment surface** — no file under `apps/tlon-web/sandbox-posture/`,
no `hostCsp.ts`, no CSP or sandbox-token change, no navigation lint change.
`git diff` for those paths is empty. The two lint rule bodies excluded from
round one are likewise untouched.

Dispositions and the reasoning behind each are in
`surface-channels-review-dispositions-r4.md`. Decisions D187–D197 in
`DECISIONS.md`.

---

## High 1 — pagination discarded a tied row before the reducer saw it

`getSequencedChannelPosts` ordered by `sequenceNum` alone with a `< N` cursor.
Ordering and the page cursor are now the pair `(sequenceNum, id)`, and the
contiguity walks in `newest`, `older` and `newer` treat a repeated sequence
number as another row on the same rung rather than a gap.
`packages/shared/src/store/surface/hydration.ts` passes the oldest loaded row's
id as the second half of the cursor. The SQL order is byte order on the id —
deliberately not the reducer's canonical order — because its only job is to
enumerate each row exactly once; which tied row wins stays the reducer's, over
the complete set. **Control:** `hydration.test.ts`, "a sequence-number tie folds
identically in either insertion order" — conflicting same-sequence posts
inserted in opposite orders into two databases, hydrated at `pageSize: 1` (the
tie split across a page boundary) and at `pageSize: 50` (both rows in one page),
requiring both rows to reach the reducer and the canonically greater id to win.
**Residual:** `mode: 'around'` gets the deterministic sort but not the tie
retention; it is the chat scroller's path and its windowing arithmetic would
need its own control (D187).

**A reading you asked for implicitly and we did explicitly:** duplicate sequence
numbers ARE producible. `desk/lib/channel-utils.hoon:1584-1598` is a repairer
whose docstring lists "duplicate sequence nrs in the posts" among the things past
migrations caused, wired into `state-10-to-11`; the 7→8 conversion numbered
`posts` and the `log` from two independent counters. Normal posting cannot
produce one. So this is a migration-and-mirror class, not a live-write class,
and the fix is not defense in depth.

## High 2 — the write fence checked at check time

Publish, fork and `channels update`/`rename` now re-read the target immediately
before `writeGroupChannel` (`readDefinitionForWrite` in
`packages/tlon-skill/scripts/commands/surface-writer.ts`; `channelWriteIdentity`
in `channels.ts`), refuse on any change naming both identities, and write
nothing. The identity compared is the definition cell alone — narrower than the
operator's pre-state bound, which folds the post head in and would fail a
publish because a member said hello during the upload. The payload is built from
the FRESH channel, so a concurrent edit to an unrelated field is carried forward
rather than clobbered. **Control:** the fake ship is mutated during the command,
in the upload seam, in each of the three paths; each must refuse with **zero**
description writes, asserted against the double's write log rather than its
final value. Publish additionally pins that it cannot report success over a
definition it did not write — the self-certifying read-back was what made this
silent. **Residual, stated in plan §4.3 and in the fence's own contract comment:**
this narrows the window to one round trip; it does not close it. Closing it needs
CAS on the description cell in `%groups`, recorded as a v1 item (D188). Also
recorded: a full-cell write cannot merge a concurrent edit the way an
append-only log can, so only one half of this wire format converges.

## The survivor — the D175 head guard did not reach the CLI

`advertisedHead` appeared zero times in `packages/tlon-skill`. `hydratePosts`
now returns the head it observed from the ship and both `surface state` and
`surface snapshot` pass it. The fold reports what it stepped over
(`headExceededSnapshots`, on the reduced and migration-pending branches both)
rather than only logging it, so a writer can obey the obligation without
re-deriving snapshot selection. `surface state` folds the real log and names the
post; `surface snapshot` **refuses** — selection takes the greatest boundary, so
a fresh honest snapshot loses to the bad one and writing would report a repair
that changed nothing. **Control:** `surface-records.test.ts`, a snapshot claiming
`upTo: 1_000_000`. Pre-fix `surface state` returns the laundered state; post-fix
it returns the real fold and names sequence 2, and `surface snapshot` exits 1
with `snapshot-head-exceeded` and zero posts written. A third case pins an
honest snapshot still being folded from, so the guard is observed not firing.

## Finding 3 — a healthy revision could not clear a halted sandbox

The halt now names the session that produced it and is rendered only when that
session is the one being mounted, so a new revision clears it by not matching.
`reloadSurface` no longer clears it separately — a reload is already a new
session. **Control:** `SurfaceSandboxContainer.test.tsx`, halt v1 then rerender
with healthy v2, requiring the halt to clear and a live frame to appear; plus
its converse, that re-rendering the SAME revision keeps the halt, so the fix
cannot degenerate into never halting. Both fail under the pre-fix shape.

## Finding 4 — the countdown note implied publish owns `shellVersion`

Corrected, and pinned across all nine templates rather than only the one that
drifted, because the wording was copied between templates. Three templates
carried no bundle note at all and have one now. **Control:**
`surface-templates.test.ts` requires every template's `NOTES.md` to name the
three publisher-owned fields and to name `shellVersion` as the author's;
reverting countdown's note fails it.

## Finding 5 — two obsolete execution models in the preview doctrine

`RUBRIC.md`'s "preview folds actions only / host archives will be empty" and the
`rsvp`/`potluck` destructive-first ordering advice are corrected against source.
The ordering advice was replaced rather than deleted: your observation that the
restore pass does not yield one actor per answer — later constructive actions
overwrite earlier ones for the same actor — is now stated in each file, so the
replacement is accurate rather than merely un-stale. A grep for the same claim
found two more instances (RUBRIC's `memberInteraction` bullet, and
habit-tracker's notes, which contradicted their own next sentence); both fixed.

## Finding 6 — the claims index could not describe any commit

Regenerated at a clean head with the eight stale rows corrected and the
now-false-and-fixed "host events cannot be previewed" claim added, and validated
in CI by `scripts/check-claims-index.mjs`, wired beside the decision-record check
in `ci-config-check`. It fails on a dead file anchor, a line number past
end-of-file, a cited SURFACE-owned file changed since the recorded head, and the
self-declared dirty-tree wording. **Control:** each of those failure modes
demonstrated by making the breaking change and observing the failure. **The
drift rule is scoped by ownership on purpose and it is a weaker guarantee than
"the index describes exactly this tree":** the index cites `DECISIONS.md`,
`ci.yml`, `e2e/test-fixtures.ts` and `db/queries.ts` among 113 paths, so a flat
repo-wide gate would turn most unrelated pull requests red until somebody
regenerated a document they do not own. Drift outside surface-owned paths is
reported by name with the run green (D197).

## Finding 7 — fork's fresh-id invariant was asserted, not enforced

`--surface-id` is removed. The landing run takes the id from the completed
rubric sheet, which already binds it to these bytes and this definition and was
already required; passing the flag is an unknown-option refusal. **Control:** `'refuses --surface-id on every run there
is'` asserts the refusal — exit 1, `usage`, `Unknown option: --surface-id`,
nothing staged, nothing written — on the staging, landing and regenerate runs
alike, so a build that accepted and ignored the flag would fail it. Re-adding
the flag to the parser does fail exactly that test and nothing else. A second
test covers a sheet naming the source's own id, now `rubric-mismatch`. **Stated plainly, because "impossible" is a word this project
has had to retract before:** this removes the OVERRIDE, not every path to a
reused id. A caller who hand-edits the staged spec before previewing gets a sheet
keyed to whatever they wrote — forging the binding artifact rather than using a
documented flag, which is materially different but is not impossibility (D193).

## Finding 8 — the reducer's "posts, any order" contract was false

`SurfacePostView.id` is required at the type level and enforced at runtime: a
post with no string id is structurally unfoldable, like one with no sequence
number, and is skipped rather than folded in arrival order. `comparePostIds`
orders the two id classes first, then digit count, then digit string, then the
raw string — fixing both the `1.000`/`1000` antisymmetry break you named and a
transitivity break you did not, where numeric and non-numeric ids compared raw
against each other closed the cycle `"2" > "1x" > "10" > "2"`. The gate, the
preview and the transition walk mint deterministic synthetic ids; without them
those tools would fold in array order while a real channel folds in id order.
**Controls:** a property test over a corpus spanning both classes asserting
antisymmetry and transitivity directly, plus your own reproduction — two tied
conflicting host writes reducing to the same state under both input orders. The
no-id half of that reproduction now fails to typecheck.

## Finding 9 — `inert-action` suppression was prefix-based

`specPathIsUnder` compares path segments: equal, or followed by `.` or `[`.
**Control:** your exact fixture — dead `vote`, malformed `vote-no` — must report
both findings; pre-fix it reports one. Plus a direct unit test of the segment
comparison covering exact match, both child forms, and the prefix-collision
non-match.

## Finding 10 — `memberInteraction` could contradict a nonempty action map

Refused at the SCHEMA, not in lint: the contradiction is readable by everything
that validates a spec — the reducer's read-back, `surface show`, the preview,
the client — and a gate-only rule would leave all of those agreeing that a
self-contradicting spec is fine. **Control:** the compliant interactive fixture
plus the marker must fail schema validation, with both non-contradicting shapes
still passing so the rule can be observed not firing. Note the knock-on, and one place it
cost coverage: the fork test fixture used the marker on an actionful spec
precisely to make rubric check 8 apply to the copy, which is no longer
expressible. The fixture was rewritten rather than exempted —
`duplicatesTolerated` carries the "a declared marker survives the copy" claim
alone, and the check-8 claim moved to a display-only fixture of its own. That
second claim is now made about a display-only app rather than about the actionful
one, which is narrower than what it replaced.

## Finding 11 — SKILL's date rule was false against its own countdown

`SKILL.md` now matches `PARADIGM.md` — dates exist where a host event wrote
them, or where they were fixed once at creation — and names the countdown as the
case the old sentence got wrong.

---

## Not done, and deliberately

Your five ranked verification rows are recorded verbatim in plan §10 as the work
order M3 opens from, not actioned here: each is a measurement against a live ship
or a first piece of Hoon testing. Row 4 additionally wants a deliberate yes
before it starts, since it would be this project's first Hoon test.

Also untouched: native, containment, hooks, the corpus run, the tlonbot delivery
change, the invisible spinner (routed to its app owner), and `data:`/`blob:`
navigation targets.

## Two local-environment facts, so they are not read as regressions

Both are byte-identical to the pre-round HEAD and fail there too:

- `surface-lint.ts`'s behavioral phase reports `render: TypeError: Attempting to
  define property on object that is not extensible` on this machine's
  bun/happy-dom, which skips the behavioral rules and fails ~14 template and
  preview cases locally. CI runs them green.
- `media-guard.test.ts`'s four pinned-TLS transport cases fail locally.
  `media-guard.ts` and its test are unchanged by this round.
