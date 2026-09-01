# Surface Channels — decision brief for the reviewing agent

Replaces the previous peer report, which was three sessions stale.

This is **not** a session recap. Three session reports already exist
(`surface-channels-session6a-report.md`, `-6a5-report.md`,
`-verdict-run-report.md`) and `DECISIONS.md` runs to D129. This document exists
because one decision has been deferred by three consecutive session prompts and
is now answerable, and because a second reader is worth more on that decision
than on any of the work leading to it.

Branch `patrick/mini-app-mvp`, head `82062f8e9b`, PR #6380 draft.

---

## The decision

**Does the bundle format earn its keep?**

The premise all along: if the loop _edits_ an existing app when asked to change
it, the format's fluency premium is real and template investment is justified.
If it _regenerates_ from a template with the requirement folded in, the loop is
slot-filling, any format serves equally, and the seven remaining templates are
being written against the wrong thing.

M2 gates template authoring on this reading. Nobody has made it.

## The evidence, and why it took three attempts

|                                                       | 6a               | 6a.5              | verdict run                            |
| ----------------------------------------------------- | ---------------- | ----------------- | -------------------------------------- |
| requests **forced** (proved unsatisfied before issue) | 0 of 4           | 0 of 5            | **7 of 7**                             |
| read its own published bundle first                   | 0/8 turns        | 5/5               | 6/7                                    |
| **mechanism**                                         | 4/4 regeneration | 2 edits, 3 no-ops | **6 edits, 1 no-op, 0 regenerations**  |
| line survival                                         | 25–48%           | 97–98%            | 73.5 / 82.3 / 98.5 / 98.7 / 100 / 100% |
| word survival                                         | —                | —                 | **94–100%**, four at 100%              |

**6a's result was uninterpretable**: the loop read its own published bundle in
zero of eight turns — not for want of trying, but because no command returned
it. "The loop slot-fills" and "the loop cannot reach what it would edit"
produce identical diffs.

**6a.5's was uninterpretable for the opposite reason**: `surface show` existed,
read-back went to 5/5 — but four of five requests turned out to be _already
satisfied_, because 6a's own revisions had landed them. The empty regeneration
column rested on observations none of which were forced.

**The verdict run gates every request behind a preflight** that proves the
requested behaviour absent from the action map, the recipe, the painted render
_and_ the bundle source before it is issued. It refused four candidates,
including the session prompt's own literal poll request — the app already
painted `Turnout 2 votes so far`.

The strongest single observation is the structural case: kanban
`['todo','doing','done']` → `['todo','doing','blocked','done']`, six actions
added, **all 18 originals kept by id**, four member-moved cards still in their
columns after the migration.

## The case against reading this as a green light

The six edits answer a question about the **format**. Three things went wrong
in the same run and not one of them is a format question:

- **It published to the wrong board.** Given two similarly-named boards it
  wrote to a fixture in an off-limits group. The preflight exited 0, the CLI
  exited 0, lint passed, the rubric completed, publish read back. Its report —
  _"existing signups were preserved"_ — was true of what it did and silently
  wrong about which board, because it never named the channel.
- **Grammar decided the mechanism.** Interrogative phrasing produced a no-op
  with a byte-identical bundle; imperative phrasing, _same witness, same
  target_, produced a 7-line edit. The same failure appeared at generation
  time, with the skill's own matching phrasing already in context.
- **A guard produced the defect it was written to prevent** (below).

A loop that edits beautifully and edits the wrong board is not obviously better
than one that regenerates the right one. **Every guard now in place is blind to
all of these.**

## The finding I think generalises past this project

Session 6a.5 found two "who owes what" apps shipped with `actions: {}` —
expense splits nobody can add an expense to. Every gate rule passed and the
rubric's "answers the request" check passed, because a screenshot of a board
nobody can touch looks exactly like one somebody can.

The verdict run added a rule: warn on an empty action map unless the spec
declares `memberInteraction: 'none'`.

**The next expense app shipped inert again, declared, and the rule never
fired.** The marker was in the first spec written, _before any lint ran_. It
came from the doctrine — where the copyable JSON example sat eleven lines below
the paragraph naming that exact app shape as the wrong reason to use it, with
the honesty test after the snippet.

The rule did exactly what it promised: made the inertness declared instead of
silent. The effect was that the defect shipped again, one session after being
named.

**Adding a warning creates a way to silence it, and doctrine that teaches the
hatch is read before the rule that motivates it.** A rule of this shape wants
designing hatch-first. I have fixed the doctrine; I have not fixed the method
that produced it.

## Where I would attack this

Four places, roughly in order of how much they would change the reading.

**1. Is "forced" really forced?** The preflight's witness is _author-supplied_.
Its self-test proves a pattern set separates two named strings; it cannot prove
the set is the right set for the behaviour, and no test of patterns against
examples could. A request could pass because the witness looked slightly in the
wrong place, and the resulting observation would be forced only nominally. The
built-in defence is that a correct no-op against a preflight-passed request is
treated as a contradiction and investigated as an instrument failure first —
which happened once, and the preflight held. Is one such check enough?

**2. Does six-of-seven survive the confounds?** Four of the six edits were on
apps the same loop had generated minutes earlier, in a clean group, from
templates it had just read. That is the friendliest possible case for editing.
6a.5's revisions were against boards from a prior session and produced no-ops
and regenerations. How much of the improvement is the instrument and how much
is recency?

**3. Has three sessions of adding guards been the right method?** Each session
answered findings with another guard: a gate rule, a preflight, a forcing
function, an assertion. The `memberInteraction` result is the first
counter-example — a guard whose own escape hatch was the vector. I do not know
whether that is one bad rule or a property of the approach.

**4. The addressing gap is unguarded and I did not fix it.** `surfaces-run.sh`
binds the _sentence_ to the record so a preflight cannot be cleared against one
phrasing while another goes down the wire. It does not bind the _target_. The
structural fix — assert the published channel equals the asserted one — is
about an hour's work and is not built. I would rather you tell me whether it
belongs before the verdict is read than discover afterwards that it does.

## Two corrections to things I told you previously

- I said the publish pipeline was "proven end to end on fakeships via the CLI."
  That was accurate, but it later failed for weeks on a stale fakeship desk —
  a develop merge added a mark and flipped the client to poke it in one commit,
  and the running ships were never re-synced. Worth knowing the claim had a
  shelf life.
- I described the 120s turn cap as a property of the loop and "probably the
  highest-leverage single fix." It was a dev-environment artefact: our plugin's
  default was half the deployed value, and production writes the key so never
  reaches it. Every timing number in the 6a report was measured against a
  ceiling 2.5× lower than reality.

## What I am not asking for

Not a review of the code — CI is green across three workflows and the work has
had per-item negative controls throughout. Not a verdict from you alone; the
prompts specify a joint reading and I have deliberately not made one.

What would help most is an answer to (1) and (2): **whether the sample is
strong enough to carry the decision, or whether it needs one more run against
apps the loop did not just write.**
