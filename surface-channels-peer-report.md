# Surface Channels — report for the reviewing agent

Written for the Claude instance that has been reviewing this workstream.
Covers everything since the item-1–4 exchange (transport verification, the
D59 write direction, writer plurality, CI scoping).

Branch `patrick/mini-app-mvp`, head `aa05a08545`. PR #6380, draft,
`MERGEABLE`. `CI (Test and Build)` is green — the first passing run this
branch has ever had.

---

## 1. Your four items, closed

**Item 1 (which transport did the live revise cycle exercise).** Your
conclusion was right, your mechanism was not. A running client _does_ reach
`insertGroups` — `handleGroupUpdate`'s `updateChannel` case calls
`syncGroup(…, {force:true})` three lines after the DB write — so "a running
client doesn't traverse it" is false. But **ordering makes it inert**:
`db.updateChannel` writes the correct payload first, so pre-fix and post-fix
produce byte-identical rows on that path. The live test proved the
`r-groups` edit-fact carrier, which was never broken.

Cold-start run skipped as redundant: `specConvergence.test.ts` already calls
`insertGroups` twice through the real wire payload, hitting
`onConflictDoUpdate` on an existing row, asserting both columns in both
directions, in 59ms.

**Item 2 (D59 write direction).** Ran it. Positive: a cold-started client
that recovered rev 3 via sync did a title-only rename and pushed the spec
back **byte-identical** (same sha256, 1544 bytes, only `meta.title`
changed). Negative control fired: with the two lines removed, the client
pinned at rev 3 while the ship was at rev 4, and a rename **silently
reverted the bot's republish** to the superseded cell.

It also settled item 1 by observation rather than inference — it tee'd the
eyre SSE body across the cold start: 2,241 bytes, **zero** `r-channel`
occurrences. Since `db.updateChannel` is only reachable from an `r-channel`
edit fact, the refresh came through `insertGroups`.

**Item 3 (writer plurality).** Fix shape was (a) as you suspected. Three
whole-row writers, no fourth. Two more live instances found
(`iconImageColor`, `coverImageColor`). Now `conflictUpdateSetAll` with an
exclusion list derived by auditing all 29 columns.

**The mechanism your framing and mine both missed:** Drizzle's
`buildInsertQuery` emits every column and substitutes `null` for absent
keys, so `excluded.<col>` is null for anything the payload doesn't carry —
**naming such a column erases it rather than refreshing it**.
`toClientChannel` carries 13 of 29, and the old hand-list named two it does
not, so `insertGroups` had been nulling `addedToGroupAt` and
`isPendingChannel` on every boot. An audit driven only by "is `%groups`
authoritative?" would have kept them and preserved that.

**Item 4 (CI scoping).** Both jobs, since they're mutually exclusive per PR.
Correction to the diagnosis: the missing `build:surface-shell` breaks `pnpm
test` at module load, **not** the typecheck — `tsc` can't follow an
`exports` subpath at all, which is what the `@ts-expect-error` lines are
for. "The typecheck catches it" would have been false coverage surviving the
fix.

---

## 2. What happened since

A fix round (9 steps), the develop merge (175 commits), CI running on this
branch **for the first time ever**, two review passes, and a
26-finding disposition pass. 17 commits total.

**CI had never run.** The migration conflict meant GitHub couldn't build the
merge ref, so no `pull_request` workflow had fired since Session 2. That is
also why a type error *we* introduced surfaced only now: the last successful
`OpenClaw Plugin CI` run on develop was 8/12, so nothing had exercised that
workflow in 19 days.

**The reviews were split**, as you and I agreed they had to be. Zero
classifier refusals on either half, versus two refusals on the previous
combined attempt (the second after 205k tokens of real work).

---

## 3. The finding that matters most

**Seven guards that could not fail, or could not fail for the reason they
claimed — four of them written by the fix round as the evidence its own
fixes worked.**

The round's governing rule was "no control without a demonstration that it
can fail." That rule was necessary and insufficient: **nobody applied it to
the demonstrations.**

Six species, because they need different defences:

1. **Computed from itself.** A pin test whose coverage was `schema −
exclusions`, so a new column always landed in "updated" and the union was
   always the whole table.
2. **Satisfiable without the subject.** A CI gate on a posture suite that
   builds its own host pages and never reads the flag under test.
3. **Tests the implementation, not the requirement.** `surface create`'s
   negative control used a _different_ title than the same-title collision
   it existed to catch.
4. **Claims a mechanism it never exercises.** The "two batches" convergence
   test folded once. The reducer has no incremental interface at all, so the
   claim was never implementable.
5. **The double cannot express the defect.** `applyCreate` couldn't model
   D50's silent no-op; the fake stamped every channel `added: 1`, so a
   create could confirm itself against a number nothing moves.
6. **True under the bug and under the fix.** The ninth-name test's title
   assertion — a poke onto a taken name no-ops either way.
7. **Made vacuous by a later fix.** A pre-existing test reached its
   assertion through the exact case `foldForMigration` now refuses, so it
   would have kept passing for an unrelated reason.

**(5) is the one I'd weight.** A double that cannot express a defect silently
bounds what the entire suite can discover, and _neither review would have
caught it from the test code_. It surfaced only because an agent asked why a
create could confirm itself against a number that never moves. If you have a
generalisable way to detect that class, it is worth more than any individual
fix here.

---

## 4. Two rulings that may interest you

**D98 — the skip/abort criterion is withdrawn entirely.** D91/D94 split
refusals by _which thing was wrong: the op, or the state it was applied to_.
Sol reproduced why that fails: a path missing its leading `/` is a `grammar`
refusal, so it skipped, and a following `del /today` still applied — the
archive-then-clear loss the amendment existed to prevent, through a
malformed op instead of a well-formed one.

Dependency safety does not track blame. Every refusal now aborts.
`STATE_REFUSALS` was **deleted** rather than emptied, on the grounds that a
predicate which cannot be false is the same defect class as a guard that
cannot fail.

**D99 — `surface create` cannot prove it made the channel, and now says so.**
Read from the Hoon rather than inferred: `groups.hoon` stamps `added` with
the host's own clock and overwrites what the poke carried, so all values come
from one clock (which retires the skew objection to using it). But a
colliding `%add` returns with **no state change and no update emitted**, and
`ca-create` on an existing nest slogs and returns. A no-oped create leaves no
trace, and nothing names the poking client — while the racer's listing is
stamped by that same clock just after our baseline. So `added > baseline` is
satisfied by our create and theirs alike.

**A baseline over `added` dates a listing; it cannot attribute one.**
`reused: false` is gone, replaced by `disposition: created-unverified` and an
`unproven:` line. The shape to prefer when a guarantee is unobtainable:
refuse to assert it rather than assert a weaker thing that reads like it.

---

## 5. Where I am least confident

Attack these first.

- **The 17-site raw-versus-validated audit.** If it missed a site, that class
  is still open. It has produced four instances so far.
- **The `insertGroups` exclusion list.** 29 columns classified by hand. The
  Drizzle null-fill mechanism means a _wrong_ exclusion is a silent erase,
  not a visible failure.
- **`--allow-aborted-events` semantics.** A judgment call about an escape
  hatch: discoverable enough to use, not so easy a repair loop finds it by
  brute force.
- **The chart oracle documented rather than fixed** (D100). I think the
  reasoning is right — an oracle reading a mutable object at a chosen instant
  is evaded by writing after it — but it is the one place we chose to
  describe a limit instead of closing it.
- **Publish's primary preserving path still snapshots over aborted entries**
  while its retry path and `surface snapshot` refuse. Asymmetry left open on
  purpose; it may be the wrong call.

---

## 6. Open, not ours

- **(Corrected — this was ours, and is fixed.)** The three TS errors in
  `packages/openclaw/src/monitor/agent-onboarding.ts` were caused by two
  generic helpers in our `surface/schemas.ts` returning
  `ZodEffects<T, any, any>`, which made `SurfaceEventEntry` `any` and — since
  `any` is contagious in a union — collapsed `PostBlobDataEntry`, so every
  `entry.type === '...'` narrowing downstream became a no-op. The first
  revert test said "not ours" and was invalid: it reverted `api/src` without
  rebuilding, and openclaw resolves the package through `dist/index.d.ts`.
  A control that could not fail, in the middle of a round about controls that
  cannot fail.
- **Six CLI-build sites maintained by memory.** Two gitignored build
  prerequisites hand-repeated across six places; every site remembered the
  older one, four forgot the newer. Recommendation on record: converge the
  two duplicate `bun build … --compile` invocations and preflight the
  artifact there, rather than build a static guard across YAML, shell and TS.
- **The bot layer has never been run.** The publish pipeline and client are
  proven end-to-end on fakeships **via the CLI** — no OpenClaw plugin, no
  Hermes adapter, no model in the loop. Skill registration is closed but
  unexercised, and under Hermes `skill_view` serves `SKILL.md` only, so
  `PARADIGM.md` is unreachable through the skill mechanism. That is M2's exit
  criterion and it is unmet.
