# RSVP

One occasion, three answers, one answer each. Members say **Coming**,
**Maybe** or **Can't make it**; the sheet shows the head count, the seats
still free, and who said what, each row led by that member's sigil.

This is the reference for **per-member state**: one key per member, written
by an idempotent `set` at `/responses/$actor`, plus one `del` to take it
back. Copy it for anything shaped like "everyone answers for themselves and
can change their mind" — a head count, a shift sign-up, a yes/no check-in, a
who-is-in for a game.

Does not fit: anything where a member supplies a value ("+2 guests", "I'll
be late", a dish name), anything ranked, anything where one member answers
for another. Members supply no values at all — only which declared button
they pressed.

## Customize

- **`initialState.occasion`, `when`, `where`** — the copy at the top. `when`
  and `where` are printed exactly as written and nothing on this sheet
  interprets them; see "No clock" below.
- **`initialState.seats`** — the cap. The "N seats left" badge is derived
  from it; set it to `0` and the badge disappears.
- **`initialState.answers` and `answerOrder`** — `{ label, button, tone }`
  per answer. `label` is the long form on the row and the crew heading;
  `button` is the short word on the control (it has to fit beside the label
  on a 390px phone); `tone` is `positive`, `neutral` or `negative`.
- **`initialState.headline`** — which answer the big number counts. It is
  `yes` here because "how many are coming" is the question an RSVP is asked.
- **`spec.json` `actions` and the `ANSWER` table in `app.js`** — one action
  and one table entry per answer, both naming the same literal id. The gate
  checks the table against the spec, so adding a fourth answer is three
  consistent edits: the entry in `answers`, its action, its table line.
- **`recipe`** — rewrite it for this occasion. It rides in the channel
  description and every member of the group can read it, so it describes
  what the sheet is for, never who asked for it or why.
- **`surfaceId`** — any stable string. It identifies this app's state within
  the channel; changing it after publishing orphans every answer.

## Leave alone

- **`ops` shape: `set /responses/$actor`.** One key per member is what makes
  a second tap change nothing and what makes "one answer each" true without
  any duplicate checking. Never `append` an answer — a double-tap, a
  transport retry and the same member on two devices all produce a
  byte-identical entry, and nothing downstream can tell them apart.
- **`clear-answer` is `del /responses/$actor`.** `del` on a path that is not
  there does nothing and is therefore just as idempotent as the `set`. It is
  the whole of "take my name off", and it needs no guard.
- **`clear-answer`'s position in the `actions` map no longer costs an
  actor.** `surface preview` runs a restore pass after the rotation — every
  constructive action, once per actor — so a reset no longer strands a
  member off the populated screenshots regardless of where it sits in the
  map. That pass is not a realistic spread, though: it folds `answer-yes`,
  `answer-maybe` and `answer-no` in declaration order for every actor, so
  the last one declared wins for all three. The populated crew card shows
  three members under **Can't make it**, not one under each answer — read
  it for "does every actor survive the fold," not for "what does a mixed
  RSVP look like."
- **The literal `invoke('answer-…')` arguments.** Building the id from data
  (`invoke('answer-' + id)`) reads better and silently turns off the gate's
  only check that a button is wired to something that exists — for the whole
  bundle, not just that line. A wrong id is not an error at runtime: the
  call returns `false` and the button does nothing.
- **The disabled fallback** (`!has(ANSWER, id)`). An answer with no table
  entry renders a visibly dead button instead of a live one that does
  nothing.
- **`disabled=${!canInvoke()}`** — read-only viewers see the same screen with
  the controls off, rather than a different screen.
- **The crew card.** The app cannot know who is looking at it, so it shows
  everybody grouped by answer and lets the viewer find their own row. That is
  also why the rows carry sigils: `<${Avatar} ship=${ship} />` takes the ship
  name exactly as `$actor` wrote it into state.
- **The leftover-answer handling in `answerIds`.** A member holding an answer
  the sheet no longer offers still gets a group. Dropping an answer from the
  sheet must not drop the people who gave it.
- **`bundle.assetRef`, `bundle.sha256` and `bundle.size` in `spec.json`.**
  Placeholders; `surface publish` computes and overwrites all three, plus
  `specRevision`. Do not hand-edit them. `bundle.shellVersion` is not one
  of them — it is yours, and publish preserves it exactly as written.
- **`state.json`** is not published and is not the starting state. It is a
  populated example — five members across all three answers — that CI renders
  through the shell, because the starting state is empty and an empty screen
  exercises no crew list and no sigil. Keep it in step with the app.

## No clock

`when` is a string somebody wrote. Nothing here counts down, nothing goes
"past", and there is no "3 days left" anywhere. The sandbox has a clock but
it is the **viewer's**, and a deadline shown from the viewer's clock says
something different to a member in another timezone. If a countdown is
genuinely wanted, the number has to come from the channel host, written into
state, and the sheet prints it like any other value.

## Whole numbers only

Every number on screen is a count of people or the difference between two
counts, so nothing here divides at all. That is worth keeping: a proportion
would be the one place a rounding error could produce a plausible wrong
number, and an RSVP has no need of one.

## What v0 cannot do here

- **A guest count.** "Coming, plus two" needs a value from the member, and
  an action carries none. It is expressible only by enumerating it — one
  action per number (`coming-plus-1`, `coming-plus-2`, …) against the cap of
  64 — which is fine for "+1 / +2" and silly beyond that. This template
  leaves it out; add it as its own field under the member's own key
  (`set /guests/$actor` with a literal) rather than by multiplying the
  answers.
- **A note beside an answer.** "Coming but late" is free text and there is no
  free text. It belongs in the channel next to the sheet.
- **Knowing whether _you_ have answered.** The app is never told who is
  looking at it, so no row can be highlighted as yours and no button can read
  "your answer". Every control is labelled for the viewer in the abstract
  ("This clears only your own answer") and the effect lands on the right
  member because the ops target `$actor`, not because the app worked out who
  you are.

## Revising it later

Copy and label changes are revisions, not events. Republish with
`surface publish --preserve-state` to keep the answers; without it the sheet
resets from `initialState`. The actions carry `acceptStale: true` because
"coming" means the same thing before and after a copy change — drop it on
any action whose ops you change to mean something different.
