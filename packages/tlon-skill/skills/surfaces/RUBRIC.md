# The preview rubric

Read this with the screenshots open. It is the checklist you score
`tlon surface preview` output against before you publish — you are the only
reviewer this app gets, and the vision pass is the only check that can see
what a member will see. The gate reads the source; this reads the screen.

Almost nothing here is automated, and the part that is says so out loud.
`surface preview` renders, captures, and runs a **machine defect pass** over
what it rendered — viewport overflow from layout metrics, tap-target
geometry, and the jargon denylist against the text a real browser painted.
It then **walks what a member can reach by pressing things**: from the
opening screen it presses every rendered control, folds what that control
invokes through the real reducer, and repeats. It prints what both found as
one concrete list, and it prints what neither checked on every run,
including clean ones.

That pass reaches parts of checks 1, 2 and 6, and — since the walk — part of
check 7: it can tell you that a column is only reachable through another
one, or that a declared action has no control on any screen a member can get
to. It reaches **no part** of checks 3, 4 or 5, it still knows nothing about
what was ASKED for, and it cannot tell whether a single sentence means
anything. A clean machine pass is not a clean app; scoring is still your
job, with your own eyes, on the images it wrote.

**And it is now required.** `surface publish` refuses without a completed
scoring sheet — see "Recording the scoring" at the bottom.

---

## What preview gives you

```
tlon surface preview app.js spec.json --out surface-preview
```

Twelve PNGs, a `manifest.json`, and a `rubric.template.json` in the output
directory. Read the images in this order — the order the report prints
them:

| cell         | size     | what it answers                                         |
| ------------ | -------- | ------------------------------------------------------- |
| `phone`      | 390×844  | what a member actually opens. **The primary artifact.** |
| `phone-full` | 390×2000 | the same width with the fold removed — the whole app    |
| `desktop`    | 1280×900 | that the layout does not fall apart wide                |

Each in `light` and `dark`, and in two states:

- **`initial`** — `initialState`, exactly. This is the screen the first
  member ever sees, and it is the one most often shipped unlooked-at.
- **`populated`** — **a synthetic board.** Produced by folding **every
  declared action**, twice, through the real reducer as `~zod`, `~ten` and
  `~palfun-foslup`. Nothing was invented — every op is one the app declares —
  but no group behaves like that: every action goes to every member, so
  wherever two actions write the same thing the last one _declared_ wins it,
  and no count is held to any limit the app keeps in its own state. Six of the
  nine shipped templates fold to a board nobody could plausibly reach. The
  potluck sheet reads **"Dessert 4 of 3"** over "10 more wanted"; the RSVP
  reads a headline **"0 Coming"** with all three members on "Can't make it".
  Those numbers are the harness's, not the app's.

`manifest.json` records which invokes were folded, in order, and the scoring
sheet stamps the same fact onto check 5 as a `populated` line you cannot
delete — because this page has said it since before the templates shipped and
a careful reader still scored those cells as the app's own output.

---

## The checks

Seven apply to every app. An eighth applies only to an app whose spec claims
to be display-only; the scoring sheet `surface preview` writes for you carries
it exactly when it applies, so you never have to work out which.

Score every one against both themes. A finding on any is a repair round,
not a note-to-self. Each heading below says what the machine pass reaches,
so you know which half is still entirely yours.

### 1. Nothing overflows the viewport

_Machine pass: measures it._ It reports the page's own horizontal scroll and
names the outermost element crossing the right edge, per cell. What it
cannot see is a chart whose **data** runs off, or a layout that technically
fits and reads as cramped.

Look at `phone` first, then `phone-full`.

- No horizontal scrolling, no content cut off at the right edge, no
  element wider than its card.
- **Charts especially.** A chart that runs past the card edge on a phone is
  the exact bug this whole step exists for: it shipped twice, and it was
  invisible on desktop both times. If your chart is below the fold, it is
  in the `phone-full` capture — go look at it there, do not assume.
- Long ship names, long labels and long option text wrap rather than
  push the layout sideways.

### 2. Tap targets are reachable

_Machine pass: measures the geometry only._ It reports controls under 40px
tall, under 44px wide, clipped by their own label, or sitting less than 6px
apart on one row. It has no opinion about whether a tappable thing **looks**
tappable, and it does not look at vertical spacing at all.

The `Button` primitive renders **42px tall** by default, which is already
about as small as a control should be. So the finding is never "the
primitive is too small" — it is:

- Two buttons crowded on one row with no gap between them.
- A button squeezed narrower than its label by a row that ran out of width.
- A tappable thing that does not look tappable — a bare count, a label
  that is actually the control.

If you find yourself wanting a smaller button, that is the finding.

### 3. Both themes are readable

_Machine pass: reaches none of this._ No colour is measured anywhere. This
check is entirely yours.

Open the `dark` captures and read every string on them.

- Secondary and tertiary text (`Stat` hints, `EmptyState` descriptions,
  progression footnotes) is the first thing to go. If you have to squint at
  it in dark, it is too quiet for the thing it says — promote it or cut it.
- Chart axis labels, legends and gridlines: are they visible against the
  dark card, and are the series distinguishable from each other?
- Nothing you drew should have a hardcoded color, so a string that is
  invisible in one theme means it is carrying meaning by color alone.
  Fix the meaning, not the color.

### 4. The empty state explains itself

_Machine pass: reaches none of this._

The `initial` captures are the whole test. A first member opens this and
must know, without asking anybody:

- **what this is** — a title in the domain's own words;
- **what will appear here** — "Your past sessions will appear here", not a
  blank card;
- **what to do first** — the action is present, labelled with the verb of
  the thing, and reachable.

An empty screen that shows only a heading fails. So does one that shows a
control with nothing explaining what pressing it does.

### 5. The populated state is scannable

_Machine pass: reaches none of this. It stamps the sheet instead._ Check 5's
entry in `rubric.template.json` carries a `populated` line preview wrote,
saying which fold these captures came from — `folded:`, `folded onto a
supplied state:` or `not folded:` — and the sheet is refused without it.

**Score the LAYOUT here, never the numbers.** The board is synthetic (see
above): a tally, a ranking, a "0 of 3" or an over-capacity count on a
`populated` capture is the fold talking. If one looks wrong, check it against
the `initial` capture and the `--state` capture before you write it down as a
finding — the last three "this template is broken" findings, all filed in one
sitting against potluck, expense-split and kanban, were every one of them this
mistake.

On the `populated` captures, at a glance and without reading carefully:

- Can you tell **who did what**? Every member who acted is visible; the
  crew is not collapsed into a count.
- Is the **most important number** the most prominent thing, or is it
  buried in a run of equally-weighted rows? (Whether that number is
  _believable_ is not this check — it is the fold's.)
- Do repeated rows have a visible rhythm — separators, alignment,
  consistent columns — or is it a wall?
- Does the screen still make sense with **three** members? Some layouts
  are fine with one and break with three; that is what the third actor is
  for.

### 6. No mechanism vocabulary anywhere on screen

_Machine pass: matches six words._ `rollover`, `revision`, `invoke`, `spec`,
`scratch` and `$actor`, against the text each cell actually painted — which
catches a word assembled at runtime that the gate's source scan cannot see.
The wider list below is NOT matched, because "state", "action", "event" and
"host" are legitimate words in plenty of real apps' own domains and a
denylist that cried wolf on them would teach you to ignore it.

Read every word in the images. This is `PARADIGM.md` §8 and it is the
check the gate cannot make for you: the gate has a denylist, and a
denylist cannot tell whether your copy makes sense.

Nothing a member reads may describe how the app works. No "rollover", no
"scratch", no "invoke", "action", "event", "state", "fold", "spec",
"revision", "host", "sandbox", "bundle", "$actor". No `~zod`'s entry in
prose where "your entry" is meant.

Ask of every sentence: **would a member of this group say it out loud to
another member?** A gym board says "session" and "missed". A potluck sheet
says "bringing". If a sentence explains the machine rather than the
subject, delete it — deleting is almost always the right repair.

### 7. The screen is the thing that was asked for

_Machine pass: reaches none of this, and could not._ Nothing mechanical has
access to what was asked.

Put the request next to the screenshots — and score this one off an
`initial` capture. The `populated` ones are the fold's board, so "the headline
number is 0" or "everything is in one column" there is the harness answering,
not the app; check 5's `populated` line says what that board is.

- Is the thing they asked for the thing that is biggest on the screen?
- Is anything on screen that nobody asked for?
- Is anything they asked for missing, or reachable only by scrolling past
  three cards they did not ask for?

An app that passes checks 1–6 and answers a different question than the one
that was asked is a failure, and it is the failure that is hardest to see
from inside the work.

**Score this one against the reachability report, not only against the
stills.** This check has passed three real defects, and every one of them
was about what happens when you PRESS something — most recently a board
whose new Blocked column became mandatory, because the revision added a
column and left one button per card. The note that passed it was "Blocked is
visibly present as its own section between Doing and Done": true of the
screen, silent about the board. Twelve stills cannot see that, however
carefully they are read.

So preview now walks it. From the opening screen it presses every rendered
control, folds what that control invokes through the real reducer, and
repeats — and prints, under `Reachability`:

- **how much of the app it saw**: `closed` means every screen a member can
  reach was walked; `TRUNCATED` means it ran into a bound and stopped, and a
  truncated walk asserts nothing;
- **every declared action no control on any reachable screen invokes** — a
  button that exists in the code and on no screen anyone can get to;
- **mandatory checkpoints**: a value at some place in the state that no
  sequence of presses reaches except through another one. That is the D140
  line, and it reads `"done" at /tasks/*/status is reachable only through
"doing", then "blocked"`;
- **a control drawn where pressing it changes nothing**: a member presses,
  and the board is byte-identical to what it already was. The repair is not
  to render the control in the state it is already in — the shipped `kanban`
  template drops a card's OWN column from its button row for exactly this
  reason. An action whose EVERY op writes `$actor` is exempt and never
  appears here, because re-pressing your own answer is a radio button and
  correctly does nothing. Every op, not some: an action that records your
  claim and also moves a shared task is dead in its shared half, and that is
  the board this finding was written about;
- **the values each part of the state actually took**, so a column, an
  option or an answer that nothing ever produced is visible as an absence.

**The same line is already in your scoring sheet.** `rubric.template.json`'s
entry for this check carries a `reachability` field preview stamped, and it
begins with one of three words that are not interchangeable:

- `measured:` — the walk covered every screen a member can reach, and what
  follows is what it found, including "nothing".
- `not measured:` — it ran into a bound or could not press something, so a
  path it never took could contradict anything it saw. **This is not a clean
  result.** Score this check the way it was scored before the walk existed,
  from the captures and the request alone, and say in your note that
  reachability was not established.
- `not walked:` — it never ran. Same as above, for a different reason.

Leave that line alone — it is the tool's, not yours, and publish refuses a
sheet that lost it. Write your verdict and note against it, and say in the
note what it told you. It still does not know what was asked — that half is
yours, and it always will be. What it removes is the excuse that the screens
looked right.

### 8. Display-only is what was asked for, not what was convenient

_Scored only when the spec declares `memberInteraction`. Machine pass:
reaches none of this either._

The gate warns when an app declares no actions, and the marker turns that
warning off. So the marker is where an app that forgot its member action
goes to look finished. It has happened three times, twice silently and once
declared, always to the same shape of app: a board that renders "who owes
what" and offers nobody a way to add anything.

The subject of this check is the `because` sentence in the spec, held next to
the request:

- Does the request actually want a board nobody can touch? "Count down to
  launch day" does. "Who owes what for the trip" does not — somebody has to
  add an expense.
- Is the host event named in `because` a real one, that this bot will really
  post? "The bot archives the day's log on its next interaction" is real.
  "The organizer edits it and I republish" is not an app.
- Would a member looking at this screen reach for a button that is not there?

A `fail` here is not a copy repair. It means the app is missing an action,
and the repair is to add one and delete the marker.

---

## Scoring, and when to stop

Go through the checks in order. For each, write down the cell you saw it
in — "phone-populated-dark: the progression line is unreadable" — so the
repair has somewhere to aim.

Then repair, and re-run preview. **Two repair rounds, at most.** If a
finding survives both, publish anyway and say plainly what is still wrong;
a third round on the same finding means the fix is not in the copy or the
layout, and shipping with a known residual beats looping.

---

## Recording the scoring

`surface publish` refuses without a completed scoring sheet. This is not
ceremony. It exists because across six measured runs that reached preview,
the number of capture cells actually opened was 3, 3, **0**, 1, 1 and 3 out
of twelve, and the complete written rubric output for four of those runs was
four sentences. `surface rubric` — this document — was read in three of them
and changed nothing. Doctrine asking for self-assessment did not produce
self-assessment; a refusal does.

Preview writes `rubric.template.json` into its output directory, already
keyed for the twelve cells and every check that applies to your spec, and
stamped with the
bundle's own sha256, the spec's, and the state its captures opened on. Fill it
in and hand it to publish:

```
tlon surface publish <channel> --bundle app.js --spec spec.json \
  --rubric surface-preview/rubric.template.json
```

- **`cells`** — one observation per capture cell, twelve of them. A short
  sentence naming what you saw in that image. Twelve copies of one string is
  refused: that is one observation written down twelve times.
- **`checks`** — one entry per numbered check above: a `verdict` of `pass`,
  `fail`, `repaired` or `residual`, the `cell` you scored it on, and a
  `note`. A residual is publishable and is echoed into publish's own output,
  so shipping a known defect leaves a record instead of being laundered into
  a `pass`.
- **Two lines you did not write, and must not delete.** Check 5 carries
  `populated` — what the populated captures are — and check 7 carries
  `reachability` — what the walk over the reachable screens found. They are
  preview's, not yours: they are what those two verdicts are scored _against_.
  Publish refuses a sheet missing either, and refuses one whose line did not
  come from preview.

Two things the tool checks and one it does not:

- **Completeness.** Every cell has an observation, every check has a verdict
  and a note, every verdict cites a real cell.
- **Identity.** The sheet names the app being published, the exact bundle
  bytes, the exact spec, and the state its captures opened on. A repair round
  changes one of them and therefore invalidates the sheet — so re-run preview
  and re-score. That is deliberate: the twelve images behind a sheet must be
  the twelve images this build produces.

  **This includes `--state`.** A sheet from a `--state` run is scored on a
  board the app does not open on, and publish refuses it by name. Score such
  a run for your own eyes — it is often the only way to see a state no button
  reaches — and fold what you learn into the notes on the sheet you publish,
  which must come from a run without `--state`. Run the plain preview last
  and the file is already the right one, because each run overwrites
  `rubric.template.json`.

- **Not quality.** Nothing reads your notes and decides whether they are any
  good. A validator that tried would either be gameable or would reject
  accurate short observations. A complete sheet is a sheet you filled in,
  not a sheet that says anything true.

---

## What is preview's artifact, not the app's

Do not raise these as findings against the app.

- **Everyone in one bucket, and every count the fold produced.** For any app
  whose actions are (item × state) — a board with columns, a ladder with
  results, a sheet with courses — the populated state folds every declared
  action in order, so each item ends at its last-declared action and the
  capture piles everything into one column. No ordering of the spec avoids
  it, and nothing stops the pile going past a limit the app keeps in its own
  state: the potluck sheet folds to "Dessert 4 of 3". Check
  `manifest.json`'s invoke list, read check 5's `populated` line on the
  scoring sheet, and read the `--state` capture instead — a `state.json` you
  wrote is the realistic board.

  **`--state` does not make the populated cell realistic either.** It puts a
  realistic board underneath and then folds on top of it, overwriting every
  supplied member who shares a name with `~zod`, `~ten` or `~palfun-foslup`.
  That is how the potluck's `initial` cell reads "Mains 2 of 4 … 9 more
  wanted" and its `populated` cell reads "Mains 0 of 4 … Dessert 4 of 3, 10
  more wanted" off the same file. Under `--state` the realistic board is the
  **`initial`** capture.

  **A member who logged nothing used to belong on this list and no longer
  does.** The fold once handed a reset (`clear-today` and friends) to
  whichever actor the rotation reached last, and that member was
  legitimately missing from the crew list. The fold now replays every
  constructive action once per actor after the rounds, so an actor-shaped
  hole is a finding about the app again. `manifest.json` records
  `populated.restoredAfterDestructive` when that pass ran, so the extra
  invokes are attributable to the tool rather than mistaken for the
  spec's.

- **The populated state looking identical to the empty one.** The report
  says so when it happens. That means folding every action changed nothing
  — which is a finding about the _spec_, not about the render.

  **Unless the app declares `memberInteraction`** and the run carried no
  `--host-ops`, in which case it is the app being exactly what it says it
  is: nothing a member can press and no host event supplied means nothing
  to fold, and preview's own report says so correctly. Hand such an app
  `--host-ops` and folding resumes — a display-only app moves only by host
  event, so that is the only run that ever populates its cells; score it
  instead. Without `--host-ops`, the twelve cells collapse to six pairs, so
  honest scoring is six distinct images plus a separate `--state` run
  against the example board. Publish on the sheet from the plain run — the
  `--state` run's sheet names a board this app does not open on and is
  refused — and carry what the `--state` run showed you into that sheet's
  notes.

- **Blank space below a short app.** The captures are a fixed viewport; an
  app shorter than it leaves the rest as background. That is what the app
  screen looks like too.
- **`phone-full` being a tall thin image.** It is 390px wide on purpose —
  the same width as `phone`, with the fold removed so you can see the
  bottom of the app. Judge width and layout on it; judge the fold on
  `phone`.
- **The crew's sigils.** The three actors are synthetic — they are not the
  group's members, and which ships they are is an artifact of the harness.
  A sigil's own look is never a quality signal: judge whether avatars are
  the right **size**, aligned, and legible against the background, not
  whether a particular one is busy or plain. `~zod` and `~ten` are
  galaxies, and at the icon grade the avatar uses a galaxy sigil is **one
  featureless glyph** — a bare circle for `~zod`, a bare square for `~ten`
  — which is what a galaxy looks like everywhere in Tlon, not a rendering
  failure. `~palfun-foslup` is a planet and draws four glyphs, like most
  real members. All three are correct.
- **Anything a host event would have produced.** `--host-ops <file>` folds
  real host events into the populated state, validated against the same
  schema the reducer applies, so a host-is-the-clock app (`PARADIGM.md`
  §2) can be previewed rolling a period over, archiving a session, or
  writing a date. Skip the flag and the populated state still folds
  **declared actions only** — history lists, charts over past periods,
  streaks read **empty in all twelve cells**, and that is the flag you
  didn't pass, not the harness. Pass it and the same emptiness is a
  finding to chase: check `manifest.json`'s `populated.hostOps` and
  `populated.hostOpsSource` for what was actually folded, and
  `tlon surface state` on a live channel if the two disagree.
- **A `preserveState` spec's populated cell.** Preview stands in a snapshot
  of the spec's `initialState`, because a preserving spec holds no state
  until the host posts a migration snapshot. Production does the opposite —
  `surface publish --preserve-state` carries the state the channel already
  had, and never reads the new `initialState`. So for a revision of a live
  channel, the populated capture shows the state the spec asks for, not the
  state members will meet. What preview equals production on **by
  construction** is the assembled document — the same assembler, shell,
  CSP and bridge — not the state that document is handed.
