# Surface Channels v0 — Session 6a.5 report

Branch `patrick/mini-app-mvp`, PR #6380 (draft). Seven commits
(`64f05f9159` … `1f5ab7c4c1`). Full CI green — all three workflows, nine
checks, zero failures.

Decisions **D112–D122** appended, plus a correction to D111.

Split-review-ready: §2 is the loop fixes (correctness), §3 is the harness,
§4 is the measurement and is where the judgment lives.

---

## 1. The one-sentence version

6a produced a measurement that could not support a verdict. This session
fixed the four things that confounded it, re-ran, and **every headline number
moved** — but the discriminator still does not settle the format question,
for a new and better-understood reason.

---

## 2. What was wrong with the loop, and what each fix cost to find

**The cap was never a property of the loop.** 6a measured an entire authoring
loop against a 120s ceiling and read the result as the loop scraping its
limit. The deployed ceiling is 300s. The 120s came from
`DEFAULT_RUN_TIMEOUT_MS` in the plugin, applied precisely when the config key
is absent — and production never reaches it, because `tlawn.py` _writes_ the
key. The prompt's diagnosis ("a stale value the dev entrypoint re-copies") was
wrong in both halves: nothing was copied, because nothing was set.

The class is **one value with two hand-maintained definitions in two
repositories, only one of which is ever exercised.** The gap that let it
survive is worth its own sentence: the pre-existing test passed the value in
explicitly and so never covered the default, while the compaction test one
case below _does_ cover its own absent-key path.

**The loop could not read what it was revising.** `SKILL.md` had instructed it
to read the published `recipe` back for four sessions, and no command returned
it. `surface show` now does; the doctrine points at it.

**The rubric was requested, not enforced.** Six runs reached preview and scored
it zero times. `surface publish` now refuses without a completed sheet, bound
to the bundle's sha256.

**Two requests never reached the skill at all** — and what beat it was not a
competing description but a _tool schema_: 5,942 chars of `message` with nine
`poll*` fields against a 749-char skill block.

**Announce failed 28 times out of 28, and the model was right.** Core's error
instructs `action: "poll"`; core's own enum is
`["send","react","delete","reply"]`. Unsatisfiable by construction.

Each of these was found by _running the thing_, not by reading it. That is the
session's method finding, and §5 draws it out.

---

## 3. Harness

Three safety and hygiene closures landed alongside:

- **`channels update`/`rename` refuse to unpublish** without an explicit
  acknowledgment that names the app being destroyed. `rename` shared the path,
  so a title-only edit was destroying apps too.
- **Publishing over an unreadable definition refuses.** The prompt asked to
  remove a generic-file fallback; there is none in the CLI. What existed was
  worse — the `surfaceId` guard never ran on a channel whose definition had
  stopped validating, and the potluck published onto the kanban at revision 1
  with `"ok": true`.
- **Two preflights that cannot be skipped**, converting D111's catalog trap and
  D112's skill-delivery bug into assertions demonstrated failing against
  _recorded real_ bad conditions rather than mocks.

---

## 4. The measurement

### 4.1 What moved

|                               | 6a                                             | 6a.5                                                 |
| ----------------------------- | ---------------------------------------------- | ---------------------------------------------------- |
| read its own published bundle | **0 / 8** turns                                | **5 / 5**                                            |
| `recipe` consulted            | 1/8, by accident                               | 5/5                                                  |
| revision mechanism            | 4/4 regeneration                               | 2 local edits, 3 correct no-ops, **0 regenerations** |
| line survival                 | 25–48%                                         | **97–98%**                                           |
| rubric                        | 4/8 published-and-scored, four sentences total | **4/4 publishes, 12/12 cells + 7/7 notes each**      |
| announce landed               | **0 / 28**                                     | **2 / 2**                                            |
| unrecoverable failures        | 2                                              | **0**                                                |
| repair cap exceeded           | 0/8                                            | 0 (max one lint round)                               |
| longest turn                  | 122.7s, killed at 120                          | 129.6s against 300                                   |

The two edits were surgical. The kanban rename changed a column's _label_
while keeping its `id`, so all twelve `move-*-doing` actions and every existing
card key stayed valid — which is the behaviour the format's fluency premium was
supposed to buy.

### 4.2 Why this still is not a verdict

**Four of the five revision requests were already satisfied before the run.**
6a's own revisions had landed them, and the recipes say so verbatim. So the
loop was rarely put in a position where regenerating was even tempting, and the
empty regeneration column rests on five observations **none of which were
forced**. The genuine sample of local-edit opportunities was one or two.

This is the same shape as 6a's failure with a different cause: a discriminator
that cannot discriminate. 6a's version was "the loop could not reach the thing
it would edit." This one is "the loop was not asked to change anything."

The strongest single data point is the kanban rename — a genuinely new
requirement, one line, ids preserved so state survived. Its nearest peer is the
movie-night poll: an existing app changed by two lines rather than regenerated.

**What a conclusive run needs:** revision requests that are _not_ already
satisfied, against apps whose current behaviour is known not to cover them.
That is cheap to construct now that read-back works.

### 4.3 The forcing function's limit, observed

One run opened **11 of 12** captures and wrote an observation for the twelfth
anyway. Completeness is checkable; looking is not. That is exactly the limit
D119 claims for itself, realised once in four on the first enforced run set —
worth knowing before anyone reads a completed sheet as a reviewed app.

### 4.4 Timing

The full rigorous loop — lint, preview, twelve image reads, twelve-cell rubric,
publish, read-back, announce — costs **100–130s**, one third to two fifths of
the deployed budget, with model latency 80–106s of it. The modelled estimate
was 200–250s; measured is roughly half.

### 4.5 Question C

**Did not recur.** Zero runs published and reported failure; every final
message checked true against ship state. But **nothing failed in this session**,
so the truthful-lifecycle path was never re-exercised under stress. Whether the
6a outcome was cap-coupled needs a run that is _made_ to fail.

---

## 5. Method

The session's recurring lesson is that **the defects were all found by running
the thing, and none of them by reading it.**

- The stale-binary guard caught a container whose CLI predated three of _this
  session's own fixes_ by twenty minutes. Without it the re-run would have
  reproduced 6a's result for the wrong reason and looked like a clean
  replication.
- `surfaces-run.sh`'s refusal path initially **exited 0** —
  `if ! node …; then status=$?` captures the negated status — found by
  demonstrating the refusal rather than reading the code.
- The rubric agent went looking for the fallback it was told to remove, did not
  find it, and found a worse defect adjacent to it.
- The routing agent reconstructed the tool schema byte-exactly rather than
  trusting the schema file, and that is the only reason "the model was right
  about the enum" is a fact rather than a guess.

Two guards this session are honest about not covering their own incident: the
doc-command test would not have caught the `recipe` gap that prompted it, and
the rubric's completeness check cannot tell a looked-at cell from a
written-about one. Both say so in their own text.

---

## 6. Open

- **The format question.** Needs revision requests that are not already
  satisfied. Everything else is in place.
- **`readTemplateSummary` has a literal generic-file fallback** — when a
  template directory lacks the expected names it returns an arbitrary `.js`
  file and hands it to the bot as the template's bundle. This is the path 6b
  leans on when it writes seven templates.
- **A capped run poisons its session for ~17 minutes** — a write lock with
  `maxHoldMs: 1020000` that is never released.
- **`channels.tlon.lifecycle.toolTimeoutMs` is inert** — parsed, normalized,
  read by nothing, never written by `tlawn.py`. Same species as D113.
- **`applyMetadataEdit` would retire `--allow-unpublish` entirely** and restore
  retitling a dashboard, which no CLI path currently offers.
- **Core's poll schema defect** — the one-line fix is to gate `buildPollSchema()`
  on a capability, exactly as presentation and delivery-pin already are.
- **Both "who owes what" apps ship with `actions: []`** — surfaces no member can
  add an expense to. Check 7 passed them.
- **Hermes**: scheduling and timeout both unverified; doctrine delivery verified
  only as a property.
- `packages/tlon-skill` still has no `lint` script, so `pnpm -r lint` skips it.

---

## Notes for 6b

Written against a verdict this session did not make.

1. **Still do not author templates.** The gate in M2 is unchanged and the
   format question is unresolved. What changed is that resolving it is now
   cheap: one more revision run, against requirements the apps do not already
   meet. Do that first, and it costs an afternoon rather than seven templates.
2. **Close `readTemplateSummary`'s fallback before writing any template.** It is
   the exact "falls back to whatever files are lying around" shape, in the path
   template authoring depends on.
3. **The budget is not the constraint it appeared to be.** 100–130s against
   300s leaves room for a genuinely more rigorous loop. If something has to
   give later, the two-repair-round cap is the thing to reconsider, not the
   sha-binding — the binding is what stops a sheet scoring revision 1 from
   being spent on revision 3.
4. **Assume the rubric can be complete without being observed.** If that matters
   for a template's acceptance, the check needs to be per-capture and
   tool-side, not an attestation.
5. **Countdown remains viable** via scheduled host events at a daily cadence
   (D67 resolved in 6a); finer cadence is a design tradeoff because every tick
   costs a post, and Hermes scheduling is still unverified.
6. **Seed a clean group for any future measurement.** Both generations in this
   run landed on boards built hours earlier by the routing verification, which
   turned half the generation measurement into a revision measurement.
