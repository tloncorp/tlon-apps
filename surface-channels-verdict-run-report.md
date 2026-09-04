# Surface Channels v0 — The Verdict Run

Branch `patrick/mini-app-mvp`, PR #6380 (draft). Four commits
(`776c7823a9` … `7035259f43`). CI green at `7b99452fb5`; the final
docs-and-records commit is in flight.

Decisions **D123–D129** appended.

Split-review-ready: §2 is the loop fixes, §3 the instrument, §4 the
measurement, §5 what the measurement does not cover. **No verdict is declared
anywhere in this document.** §6 is interpretation and is labelled.

---

## 1. The one-sentence version

**The discriminator fired.** Seven forced revision turns, six surgical local
edits, one no-op, **zero regenerations** — against 0 forced requests in each of
the two prior attempts. On the narrow question the format verdict turns on,
this sample answers. On whether the loop is ready, it does not, and §5 is why.

---

## 2. The four items that sat in the run's path

- **`readTemplateSummary`'s generic-file fallback is gone.** It returned an
  arbitrary `.js` file — a _different_ one in two different directories — in
  the field a real bundle occupies. Removed rather than better-guarded.
- **The gate warns on an empty action map** unless the spec declares
  `memberInteraction: 'none'`. See §5, where this rule produced the outcome it
  was written to prevent.
- **`packages/tlon-skill` got its `lint` script** — and the script alone would
  not have run, because the package is an explicit exclusion in ci.yml's `app`
  filter, so a tlon-skill-only PR skips `test-build` entirely. It also runs
  from the package's `check`, which is what `bot-checks` invokes on those PRs.
- **The session lock is bounded**, with the seventeen-minute hold fully
  derived: core budgets a worst-case _context compaction_, not a run.

---

## 3. The instrument

The format verdict had failed twice on a discriminator that could not
discriminate — 6a's loop could not reach what it would edit; 6a.5's was never
asked to change anything. The second is closed by an **assert-unsatisfied
preflight** that refuses unless the action map, the recipe, the **painted
render** and the bundle source all report absence.

The render means the _screen_: `renderSurfacePreview` imported unmodified,
twelve cells, at the channel's live reduced state. That distinction is the
whole fix — on 6a.5's RSVP board the declared actions are
`rsvp-coming`/`maybe`/`absent`, none of which provides "list who has not
responded", while the board paints exactly that from a derived array. An
action-map check passes that request.

**It refused four candidates in this run**, including the prompt's own literal
poll request (_"show how many people have answered"_ — the app already painted
`Turnout 2 votes so far`). That is 6a.5's failure mode caught before issue, on
a freshly generated app in a clean group.

Its witness survives a two-sided self-test or nothing is read off the ship,
and that caught a real authoring error: `absent` matched the live `rsvp-absent`
action, where absent means _can't make it_ — a response, not a non-response.
**Its stated limit**, in the module header rather than only here: this proves a
pattern set separates two named strings, never that it is the right set.

---

## 4. The measurement

|                        | 6a               | 6a.5              | **this run**                               |
| ---------------------- | ---------------- | ----------------- | ------------------------------------------ |
| requests **forced**    | 0 of 4           | 0 of 5            | **7 of 7**                                 |
| read its own bundle    | 0/8              | 5/5               | **6/7**                                    |
| mechanism              | 4/4 regeneration | 2 edits, 3 no-ops | **6 edits, 1 no-op, 0 regenerations**      |
| line survival          | 25–48%           | 97–98%            | **73.5 / 82.3 / 98.5 / 98.7 / 100 / 100%** |
| word survival          | —                | —                 | **94.0–100%**, four at 100%                |
| announce               | 0/28             | 2/2               | **6/6**                                    |
| unrecoverable failures | 2                | 0                 | **0**                                      |

**The structural case, concretely.** Kanban `['todo','doing','done']` →
`['todo','doing','blocked','done']`; six `*-blocked` actions added, **all 18
originals kept by id**; four member-moved cards still in their columns after
the migration. Blocked sits between Doing and Done in the painted render.

**The no-op was investigated as an instrument failure first**, as the prompt
requires. The bundle was byte-identical, the preflight re-run still said
ABSENT, and the loop made no false success claim. `rev6` isolated the cause:
same witness, same target, only the sentence's grammar moved from
interrogative to imperative — and the mechanism flipped to a 7-line local edit.

---

## 5. What the measurement does not cover

Three things went wrong, and **not one is a format question.**

**A revision published to an off-limits channel.** It was asserted against the
run's own potluck and wrote to a same-named board in the seed group. Both the
preflight and the CLI exited 0. The loop's report — _"existing signups were
preserved"_ — was true of what it did and silently wrong about which board,
because it never named the channel. `surfaces-run.sh` binds the _sentence_ to
the record so those cannot drift; **it does not bind the target.** Mid-run
mitigation was to group-qualify the remaining requests, which worked. The
structural fix is not built. Damage is characterised and restorable.

**Grammar decided the mechanism** (above), and the same failure appeared at
generation time: a "who owes what" request was answered as a question about
existing data with the surfaces skill already in context, its description
naming that phrasing verbatim.

**A guard produced the outcome it was written to prevent.** The expense app
shipped with `actions: {}` **again** — declared this time, so Rule 15 never
fired. The marker was in the first spec written, before any lint ran, copied
from PARADIGM's example, which sat eleven lines below the paragraph naming that
exact app shape as the wrong reason to use it, with the honesty test _after_
the copyable JSON. Rubric check 7 passed the result.

**Every guard now in place is blind to all four failures**: lint passed, the
rubric was complete, publish read back, the preflight exited 0.

Two more worth recording:

- **The rubric's stated limit got worse.** Ten of ten sheets complete and
  sha-bound; **five of ten opened all twelve captures**, against 1 of 4 in
  6a.5. Two turns substituted an image-tool description for opening the PNGs.
- **Nine of nine authoring turns spent a repair round on the same rule** — the
  gate refuses `spec-schema` for `specRevision` and `bundle.*`, precisely the
  fields `surface publish --help` says it owns and overwrites.

---

## 6. Interpretation — labelled, and not a verdict

The narrow question is answered by this sample: the loop edits rather than
replaces, with margins — word survival at 100% on four of six edits, ids
preserved on all of them, live cards surviving a column insertion.

What I would not read out of it is readiness. A loop that edits beautifully and
edits the wrong board is not obviously better than one that regenerates the
right one, and addressing is currently unguarded.

**The `memberInteraction` result seems to me the most load-bearing single
observation**, because it is a guard behaving exactly as designed and producing
the defect it was written to prevent. Adding a warning creates a way to silence
it, and doctrine that teaches the hatch is read before the rule that motivates
it. If that generalises, the next rule of this shape is worth designing
hatch-first — and it is a caution about this whole session's method, which has
been to answer each finding with another guard.

**And the timing re-reads.** 6a.5's "the budget is not the constraint" was
measured mostly on revisions of existing boards. Generating from nothing costs
roughly twice that: median ~160s here, five turns past 6a.5's longest, one
killed at 300s.

---

## 7. Open

- **The target is unbound** (D128) — the preflight asserts a channel and
  nothing checks the bot published there.
- **Request interpretation** — interrogative phrasings produce answers where
  imperatives produce edits, at both generation and revision time.
- **The gate refuses fields publish overwrites**, costing a guaranteed repair
  round per authoring turn.
- **Machine defects were zero across every preview.** The pass is demonstrably
  live; no repair round in this run came from it.
- **A display-only app is unrevisable under this preflight** — `actions: {}`
  leaves no near-miss to calibrate an action witness against, so the self-test
  can only abstain.
- **The cap notice names neither the cap nor its debris** — a killed run left
  an empty channel in the user's group and said only "something went wrong".
- One off-limits channel was written to and is documented with its recovery
  path; it has **not** been restored, since that would be a second unrequested
  write.
- Carried from earlier: `applyMetadataEdit` would retire `--allow-unpublish`;
  core's poll schema; Hermes everything.
