# Sol review brief — the delta since the authoring-layer review was fixed

This branch has been cold-reviewed three times by `gpt-5.6-sol` — not by you;
those were separate, independent runs, and you carry nothing from them.
**This brief is deliberately narrow, and the narrowness is the point**: their
findings were fixed, and the base of the range below is the head at which that
fix work was re-verified. What follows is the part that has never had cold eyes.

## This is one independent pass

You get one look at this. There is no continuation, no follow-up round you are
pacing yourself for, and nothing you defer will be picked up by a later you.

So report everything you find, ranked, in this pass. Do not hold a weaker
finding back as not-worth-the-space — rank it low and include it. The only thing
that carries forward is what you write down here.

## Review target

```
git diff d5c41acdc5..HEAD -- \
  packages/api/src/client/surface \
  packages/api/src/__tests__/surface* \
  packages/shared/src/store/surface \
  packages/shared/src/db/schema.ts \
  packages/surface-shell/src \
  packages/app/ui/components/SurfaceChannel \
  packages/tlon-skill/scripts
```

**87 files, +23,914/−882.** Decisions `D100`–`D186` in the repo-root
`DECISIONS.md` cover this range.

**This is a data-integrity and state-correctness review.** The question
throughout is whether state can be lost, duplicated, stranded, or made to
diverge between two clients holding the same inputs — and whether the checks
that claim to prevent that can actually fail.

### Secondary target — the skill doctrine, as a read

```
git diff d5c41acdc5..HEAD -- packages/tlon-skill/skills/surfaces
```

**34 files, +5,299/−111** — `SKILL.md`, `PARADIGM.md`, `PRIMITIVES.md`,
`RUBRIC.md`, and nine app templates. These have never had cold eyes, and they
are executable in the sense that matters: a bot's behaviour is determined by
them.

Two specific things, and not a general audit:

1. **Doctrine statements that are false against the code.** An audit found four,
   two of them capable of real damage — the worst told a revising bot that
   `bundle.shellVersion` was its own field to set, which would have had it drop
   the field on every revision.
2. **Any place the doctrine teaches an escape hatch before the rule that
   motivates it.** The `memberInteraction` pattern is the known instance: a bot
   that reads the opt-out before the requirement learns the wrong lesson.

This is a read, not an analysis, and a fresh reader catches this class better
than anyone who has been living in the documents.

The full branch delta is 390 files; the path filter above drops develop-merge
churn and `packages/openclaw/dev` (the eval harness and corpus — measurement
tooling, not the shipped path). If you find yourself needing the harness to
judge something in scope, say so rather than reading it speculatively.

## Out of scope — do not read these

Browser sandbox containment is reviewed on a separate track and is **not** part
of this review. This is a hard exclusion, not a matter of emphasis: do not open
these paths, and do not go looking for the subject matter elsewhere.

```
apps/tlon-web/sandbox-posture/       (all files)
apps/tlon-web/hostCsp.ts
surface-channels-f1-sandbox-egress.md
surface-channels-6d-review-containment.md
sol-review-r1.log, r2.log, r3.log, r3b.log, r4.log
```

Also skip, inside files that are otherwise in scope: the `navigation-vector`
and `forbidden-api` rule bodies in `packages/tlon-skill/scripts/surface-lint.ts`,
and §5 of `surface-channels-plan.md`. Everything else in those files is in
scope — `surface-lint.ts`'s fold, idempotency and `inert-action` logic
especially.

If a question you want to answer requires that material, **stop and say so as a
finding** rather than reading around it. "I could not judge X without the
excluded material" is a useful result and costs nothing.

## What those runs found, and what happened to it

The most recent of those runs (the first cold review of the authoring layer,
logged at `sol-review-r3b.log`) returned **not yet safe for preserving live
state**, with four verified data-loss/state-stranding Highs and four Mediums:

1. High — a 65–128 KiB live state makes `--preserve-state` strand the channel
2. High — an identical app carrying `duplicatesTolerated` is treated as changed and can reset live state
3. High — `surface snapshot --up-to N` writes the full fold under a smaller boundary → permanent replay duplication
4. High — the prescribed host rollover can erase unarchived data at the live-state cap
5. Medium — hydration's completeness predicate can certify a partial history
6. Medium — the chart rule uses a recording stub, not live Chart.js state
7. Medium — post/create observations accept pre-existing state as proof of a new write
8. Medium — spec/event byte caps applied after unknown fields are stripped

All eight were dispositioned in a ten-commit fix round
(`surface-channels-fixround-summary.md`, `12fc12ed80..4edbe7ab62`), each with a
named negative control, followed by two re-verification passes actioned across
`202c98e7bc..d5c41acdc5`.

**You are not being asked to re-verify those.** If you happen to see one of them
alive again, that is a high-value finding — but do not spend this pass hunting
for it. `d5c41acdc5` is the review target's base precisely so that closed ground
is behind you.

## The house rule this range was built under

**A guard enters the tree with its negative control demonstrated — the mutation
that should break it applied and observed breaking it — or it enters as a
claim.** The most recent session (`surface-channels-session6d-report.md`) exists
because an audit found five guards that passed *because they could not fail*,
including the one protecting execution of untrusted model-generated JavaScript:
its five network probes all targeted an RFC-6761 hostname that can never
resolve, so every "blocked" verdict was the branch a DNS failure takes.

So the sharpest question you can ask of anything in this range is not "is this
check correct" but **"can this check fail, and has anyone shown it failing."**

## Where I would attack it

These are my own stated weak points, offered so you can skip finding them and go
past them. Disagreeing with the framing is itself useful.

1. **`inert-action`'s suppression rule** (`surface-lint.ts`). The new rule yields
   to any finding already filed against the same action, so a statically
   malformed pointer is reported once rather than twice. I did not enumerate
   every rule it now defers to — a rule that reports on an action for an
   unrelated reason would mask a genuinely dead action.
2. **The `$actor` narrowing** (`surface-transitions.ts`, D172). The gate's
   ownership exemption now requires the op's value to *be* exactly `"$actor"`.
   Three relocation bypasses motivated it. I do not know that three is all of
   them; the question is whether "the value is the token" is the right
   discriminator for "this action writes only the presser's own data", or merely
   a narrower proxy that a fourth shape walks around.
3. **The sequence-number tie-break** (`reducer.ts`, D174). Ties break on the
   host-stamped post id, compared numerically for canonical dotted `@ud` renders
   and by plain string compare otherwise. Sequence stubs carry synthetic
   non-numeric ids. Any total order is correct so long as every client picks the
   *same* one — I have not proved the two id families cannot interleave in a way
   that makes two clients disagree.
4. **`advertisedHead` is a ceiling, not a proof** (D175). A snapshot claiming
   coverage beyond the channel's advertised head is refused — but a caller that
   supplies no head gets the old behaviour, deliberately and with a test. I
   answered "does every real caller supply one?" for the client and not for the
   CLI, which has no equivalent watermark.
5. **`--preserve-state` is a writer obligation, not an enforced invariant**
   (D176, and your finding #1's descendant). The publish path refuses; the
   reducer still replaces `initialState` wholesale, because every merge rule that
   would carry an edit is unsafe. Any other writer — Hermes, a hand-edited
   channel description, the client-executed publish v1 contemplates —
   reintroduces the original hazard at full strength. Is "document it in the plan
   and pin the contract with a test" actually sufficient here?
6. **The host/shell seam, from the in-scope side only.** The React host is
   tested in jsdom (`SurfaceSandboxContainer.test.tsx`) with the shell artifact
   mocked to a no-op, the ready handshake hand-dispatched, and the §6 state
   components stubbed. `sandboxSession.ts` — schema validation, the
   spec-revision cross-check, the permission re-check, the declared-action
   check — is the real logic under that stub. Judge whether the jsdom suite
   plus `sandboxSession.test.ts` actually pin that logic, or whether they pin a
   shape the stub makes true. (A browser-side composition test exists and is
   out of scope; do not go find it.)

7. **The claims index** (`surface-channels-claims-index.md`). It enumerates 126
   claims across the plan, the PR body and the how-it-works doc: 97 with a
   control, 89 of those with a demonstrated negative control, **29 with none**
   (§A), plus 13 controls with no negative control (§B). Its entire value is
   whether the empty rows are really empty. If §A overstates or understates, say
   which rows and why.

   Then do the thing the index does not: **rank §A's rows by damage-if-false.**
   Accuracy and stakes are different questions, and only the second one produces
   a work order. The top five become a verification backlog; each of the rest
   gets a one-line reason it is acceptable to leave uncontrolled. "Uncontrolled
   and harmless" is a legitimate verdict — say it explicitly rather than leaving
   the row silent.

## Known-open, so you do not spend a finding on them

- **Native containment is unverified on device.** iOS/Android have no mechanism
  and no test. Stated in the PR's Risks and in the report's §10.
- **`data:` / `blob:` navigation targets** are unmeasured — the other half of a
  named residual.
- **`LoadingSpinner` renders an invisible spinner** app-wide (`$color.gray700`
  does not resolve; the stroke computes to `none`). Found by looking at pixels,
  deliberately not fixed inside a verification session: 33 call sites across
  three packages.
- **The plan, the how-it-works doc and the PR body have no drift control** —
  `surface-doc-constants.test.ts` pins only the four skill documents. Five stale
  or false claims in those documents were found and fixed by hand this session.
- Four `media-guard` TLS tests fail on a local macOS run and pass in CI.

## What "done" looks like

Findings ranked, each with: the concrete failure (inputs → wrong result), whether
you verified it or reasoned it, and — where you assert a guard is inadequate —
what would demonstrate it failing. A finding I cannot reproduce is worth less
than a smaller one I can.

State your own coverage: which of the 90 files you opened, which you judged from
DECISIONS.md or a report rather than source, and where the budget ran out. An
unopened file is a category of result, not a pass.

This is not bookkeeping. Without it, "this range is sound" and "I ran out of
budget at file 40" are the same sentence, and the second one is the more
important of the two.

If the honest answer is "this range is sound and here are three things I could
not check," that is a legitimate result. Do not manufacture findings to fill it.
