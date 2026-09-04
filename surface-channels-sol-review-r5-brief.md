# Sol review brief — a correctness fix round, and whether its guards hold

You are reviewing a corrective change to Surface Channels in
`tloncorp/tlon-apps`, branch `patrick/mini-app-mvp`. Read-only: make no edits,
run no ship, commit nothing.

## This is one independent pass

You have no memory of this repository and are not expected to. Nothing in this
brief assumes you have seen the code before, and nothing you find will be
weighed against anything you found elsewhere. Judge what is in front of you.

## What Surface Channels is, in four sentences

A surface channel is an ordinary `%chat` channel whose description cell carries
a `surfaceSpec` — an app definition. Member interactions and host updates are
posted as blob entries on chat posts, so the channel's post list IS the event
log. A pure reducer folds that log into state; a bundled JS module renders it.
There is no new backend: no Hoon was written for any of this.

## Review target

**`2a81fab03b..46efb254c6` — 46 files, +3,506/−354.** Decisions `D187`–`D197`
in the repo-root `DECISIONS.md` cover it. Twelve of those files are tests.

Every change in that range repairs a control that already existed and did not
protect what it claimed to. No new capability was added. The three named
authors of the range are the two commits `95e8d7edb0` (the work) and
`46efb254c6` (a documentation stamp).

**This is a data-integrity and state-correctness review.** The question is
whether a member's or a host's state can be lost, duplicated, frozen, or made
to differ between two clients holding the same posts.

**Read the diff, but do not review only the diff.** A fix placed one layer
away from the property it protects is the exact failure this range is about,
and that is not visible in a diff — it is visible in the surrounding module.
Open the files the changes live in.

### What each change claims to fix

`surface-channels-sol-review-r4-fixdiff.md` at the repo root is the author's
own account, one paragraph per item, naming the control for each. Read it
FIRST — it is the claim you are testing, and it is more useful to you as a
list of assertions to attack than as an explanation.

`surface-channels-review-dispositions-r4.md` carries the reasoning and the
residuals. `surface-channels-sol-review-r4-findings.md` carries the defect
reports these changes respond to, verbatim.

### Secondary target — the doctrine, as a bounded read

Four documents plus nine template `NOTES.md` files under
`packages/tlon-skill/skills/surfaces/`. Several were corrected in this range
because they described tool behaviour the tools no longer have. Prose that
describes tool behaviour is a claim like any other, and an authoring bot reads
these as instructions. Bound this to the parts the range touched unless
something pulls you further.

## Out of scope — do not read these

Browser-sandbox containment is being reviewed separately and is **not part of
this review**. Nothing in this range touches it — `git diff --name-only` over
the range returns no file under those paths — so excluding it costs you
nothing here. This is a hard exclusion, not a matter of emphasis: do not open
these paths, and do not go looking for the subject matter elsewhere.

```
apps/tlon-web/sandbox-posture/       (all files)
apps/tlon-web/hostCsp.ts
surface-channels-f1-sandbox-egress.md
surface-channels-6d-review-containment.md
sol-review-r1.log, r2.log, r3.log, r3b.log, r4.log, r4-refused.log
```

Also skip, inside files that are otherwise in scope: the `navigation-vector`
and `forbidden-api` rule bodies in `packages/tlon-skill/scripts/surface-lint.ts`,
and §5 of `surface-channels-plan.md`. Everything else in those files is in
scope — `surface-lint.ts`'s fold, idempotency and `inert-action` logic
especially, since one of them changed here.

`surface-channels-claims-index.md` is in the range and is 341 changed lines of
claim-to-control ledger, a third of which concerns the excluded material. **Do
not read it.** The part of it worth your attention is the validator that now
checks it — `scripts/check-claims-index.mjs`, which is in scope and is ordinary
code: it decides what counts as a dead citation and what counts as drift, and
it can be wrong about both.

If a question you want to answer requires that material, **stop and say so as a
finding** rather than reading around it. "I could not judge X without the
excluded material" is a useful result and costs nothing.

## The house rule this range was built under

**A guard enters the tree with its negative control demonstrated — the mutation
that should break it, applied, and observed breaking it. A guard without one is
a claim, not a control.**

Every change in this range is asserted to have met that rule. That assertion is
the most valuable thing for you to attack, because it is the one that makes
everything else believable. A test that passes both before and after the fix is
worse than no test: it certifies the defect.

Concretely, for each item in the fix-diff summary, the questions are:

1. **Does the fix hold at the boundary the property has to hold at**, or has it
   moved the same mistake one layer over?
2. **Can the named control actually fail?** Read the test. Construct the input
   that should break it. If the assertion would survive the defect it names,
   that is a finding regardless of what the summary says.
3. **What did the fix newly break?** Several of these changes are invasive —
   a required field on an exported type, a page cursor, a schema refusal, a
   removed CLI flag. Fixes introduce defects.

## Where I would attack it

Ranked by what I think is most likely to be wrong, which is a hypothesis and
not a hint. Disagreeing with this ordering is a useful result.

1. **The page cursor.** `getSequencedChannelPosts` in
   `packages/shared/src/db/queries.ts` now orders and pages on the pair
   `(sequenceNum, id)` across four modes, and `mode: 'around'` was deliberately
   left with only half the change. Paging is where off-by-one lives. Can a row
   be returned twice? Skipped? Can the `newer` and `around` modes disagree with
   `older` about what a "contiguous" window is? Does the chat scroller, which
   is the other caller of this function, still get what it expects?
2. **`SurfacePostView.id` is now required**, and the reducer SKIPS a post that
   arrives without one rather than folding it. That is a silent drop. Is there
   any production path that reaches the reducer without an id — a sequence
   stub, an optimistic post, a migration, a test double that mirrors
   production? Silently dropping an event is worse than the ordering bug it
   replaced.
3. **The write-time re-read** in `packages/tlon-skill/scripts/commands/surface-writer.ts`
   (`readDefinitionForWrite`) and its sibling in `channels.ts`. It refuses when
   the target moved between the check and the write. Does it refuse when it
   should NOT — a legitimate republish, a retry, a no-op? Is the identity it
   compares stable across two reads that should be identical? What does it do
   when the read fails rather than differs?
4. **The comparator.** `comparePostIds` is asserted to be a total order over
   two id classes. It is small enough to check exhaustively by reading. If it
   is not a total order, the sort it feeds is undefined behaviour.
5. **The schema refusal** of `memberInteraction` beside a nonempty action map.
   A schema refusal is not local: everything that validates a spec now refuses
   that shape, including read-back of a spec already published. Can an
   existing, live channel become unreadable because of it?
6. **`headExceededSnapshots`** — a new field on the fold's result, populated on
   two branches. Is it populated on every branch that can skip a snapshot for
   that reason, and does every consumer that must act on it do so?

## Known-open, so you do not spend a finding on them

These are recorded in `DECISIONS.md` and in the plan. Naming one is not a
finding; showing that one is WORSE than recorded, or that a stated mitigation
does not do what it says, is.

- **`%groups` has no compare-and-swap on the channel description cell.** The
  write-time re-read narrows the race to one round trip and does not close it.
  Recorded as a v1 item (D188).
- **`mode: 'around'` keeps the deterministic sort but not the tie retention**
  (D187). Deliberate; it is the chat scroller's path.
- **Removing `--surface-id` removes the override, not every path to a reused
  id** — a hand-edited staged spec still reaches a sheet keyed to whatever was
  written (D193).
- **The claims-index drift check is scoped by ownership**, so drift outside
  surface paths is reported and not failed (D197).
- Native (iOS/Android) has no test of any kind.
- The eval-corpus run over freeform generation has not happened.

## What "done" looks like

A report with:

**§A — findings.** Each with: severity, the file and line, the concrete input
that produces the wrong outcome, whether you REPRODUCED it or traced it in
source, and the negative control that would catch it. Say plainly which of
those two you did; a source-traced finding is welcome and is not the same
claim as a reproduced one.

**§B — the fixes you checked and believe hold**, briefly. A verified-correct
fix is a result, and I need to know which ones you actually looked at as
opposed to accepted.

**§C — your own coverage, as a ledger.** Which files you opened; which you
judged from `DECISIONS.md`, the plan or the fix-diff summary rather than from
source; and where you ran out of room. **An unopened file is a category of
result, not a pass** — I would rather have "I did not open these eleven" than
a silence I have to interpret.

**§D — a risk ranking.** Rank your own §A findings by damage-if-true, and
separately name the three changes in this range you consider most likely to be
harbouring something you did not have room to find. The second list is the more
useful one.

**A verdict**, in your own words, on the question this range exists to answer:
**is this safe for preserving live member state?**
