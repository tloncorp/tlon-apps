# The preview rubric

Read this with the screenshots open. It is the checklist you score
`tlon surface preview` output against before you publish — you are the only
reviewer this app gets, and the vision pass is the only check that can see
what a member will see. The gate reads the source; this reads the screen.

Almost nothing here is automated, and the part that is says so out loud.
`surface preview` renders, captures, and runs a **machine defect pass** over
what it rendered — viewport overflow from layout metrics, tap-target
geometry, and the jargon denylist against the text a real browser painted.
It prints what it found as a concrete list, and it prints what it did not
check on every run, including clean ones.

That pass reaches parts of checks 1, 2 and 6. It reaches **no part** of
checks 3, 4, 5 or 7, and it cannot tell whether a single sentence means
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
- **`populated`** — produced by folding **every declared action**, twice,
  through the real reducer as `~zod`, `~ten` and `~palfun-foslup`. Not a
  state anybody invented: if it looks wrong, the app's own actions produce
  something wrong.

`manifest.json` records which invokes were folded, in order.

---

## The seven checks

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

_Machine pass: reaches none of this._

On the `populated` captures, at a glance and without reading carefully:

- Can you tell **who did what**? Every member who acted is visible; the
  crew is not collapsed into a count.
- Is the **most important number** the most prominent thing, or is it
  buried in a run of equally-weighted rows?
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

Put the request next to the screenshots.

- Is the thing they asked for the thing that is biggest on the screen?
- Is anything on screen that nobody asked for?
- Is anything they asked for missing, or reachable only by scrolling past
  three cards they did not ask for?

An app that passes checks 1–6 and answers a different question than the one
that was asked is a failure, and it is the failure that is hardest to see
from inside the work.

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
keyed for the twelve cells and the seven checks and stamped with the
bundle's own sha256. Fill it in and hand it to publish:

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

Two things the tool checks and one it does not:

- **Completeness.** Every cell has an observation, every check has a verdict
  and a note, every verdict cites a real cell.
- **Identity.** The sheet names the app being published and the exact bundle
  bytes. A repair round changes the bytes and therefore invalidates the
  sheet — so re-run preview and re-score. That is deliberate: the twelve
  images behind a sheet must be the twelve images this build produces.
- **Not quality.** Nothing reads your notes and decides whether they are any
  good. A validator that tried would either be gameable or would reject
  accurate short observations. A complete sheet is a sheet you filled in,
  not a sheet that says anything true.

---

## What is preview's artifact, not the app's

Do not raise these as findings against the app.

- **A member who logged nothing.** The populated state folds _every_
  declared action, including a reset (`clear-today` and friends). Whoever
  the rotation hands the reset to last ends up empty, and will legitimately
  be missing from the crew list. Check `manifest.json`'s invoke list before
  concluding the app drops members.
- **The populated state looking identical to the empty one.** The report
  says so when it happens. That means folding every action changed nothing
  — which is a finding about the _spec_, not about the render.
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
- **Anything a host event would have produced.** The populated state folds
  **declared actions only** — preview cannot post a host event, so it
  cannot roll a period over, archive a session, or write a date. In any
  host-is-the-clock app (`PARADIGM.md` §2) everything downstream of a
  rollover — history lists, charts over past periods, streaks — is
  **empty in all twelve cells**, and that is the harness, not the app.
  Score the pre-rollover half; check the archived half by reading
  `tlon surface state` on a live channel instead.
- **A `preserveState` spec's populated cell.** Preview stands in a snapshot
  of the spec's `initialState`, because a preserving spec holds no state
  until the host posts a migration snapshot. Production does the opposite —
  `surface publish --preserve-state` carries the state the channel already
  had, and never reads the new `initialState`. So for a revision of a live
  channel, the populated capture shows the state the spec asks for, not the
  state members will meet. What preview equals production on **by
  construction** is the assembled document — the same assembler, shell,
  CSP and bridge — not the state that document is handed.
