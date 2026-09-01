# Countdown

A board counting down to one day the group has already agreed on, with the
dates in the run-up to it and who to ask about each. Nobody can press anything;
the screen still moves, every minute, on every viewer's device, with no timer,
no bot and no network.

Copy this for anything shaped like **a fixed date and the wait for it** — a
launch, a trip, a move, a deadline the group set, a season opener, an
anniversary. Copy the _mechanism_ — a host-written date plus `context.now` —
for any screen that has to stay current between host events.

Does not fit: anything a member should be able to change. A board where people
tick items off, say they are coming, claim a job or add a date is not a
countdown with buttons bolted on; it is `kanban/`, `rsvp/`, `potluck/` or
`poll/`. See "The `because` sentence" below.

## Why this is the purest derived-state template

Every other template derives numbers from a log that members wrote. This one
derives everything from **two numbers and a clock**: a `targetMs` written into
state once, and `context.now`, handed to `render` beside the state on every
paint. Nothing is stored that could go stale, because nothing about "16 days,
16 hours and 30 minutes" is stored at all — it is recomputed from scratch every
time the screen is drawn, on the viewer's device, with no round trip.

That gives it three properties nothing else here has:

- **It is live to the minute with zero scheduled machinery.** No cron, no bot
  turn, no host event after the day it was published. The spec's
  `timeDisplay` declaration is the whole mechanism — it is what makes the
  host resend `now` every sixty seconds. The app itself owns nothing that
  ticks.
- **It works offline and forever.** A viewer with no connection still sees a
  correct countdown, because the only inputs are the state they already have
  and the clock the host handed them. There is nothing to fetch and nothing to
  fold.
- **It cannot drift.** There is no stored "days left" for a missed update to
  leave wrong. The failure mode of a derived value is that it is briefly stale;
  the failure mode of a stored one is that it is wrong and looks right.

`context.now` is `null` when the host supplied nothing, and this app renders
sanely for that: the plan, with the counting left off. Never assume a number
there.

## The line: display is not a write

**This is the rule this template exists to teach, and it is the one that gets
blurred.**

A date that has gone by is something this board may **show**. It is not
something this board may **write**.

- "Passed" on a run-up row is a word derived at paint time from `at - now`. It
  is per-viewer, like the theme; it is recomputed on every refresh; nothing
  anywhere records it. Two members can briefly disagree about it and neither is
  wrong.
- "Done", "closed", "settled", "expired" — as **stored facts** — are host
  events and nothing else. No value of `now` can ever produce one: `render`
  writes nothing, `invoke` carries no arguments, and an action's ops are fixed
  in the spec. There is no path from the clock to state, by construction.

So "the poll closes when the date passes" is **not** a countdown feature. It is
two different things wearing one sentence:

1. _Showing_ the poll as past its date — that is this template, and it is free.
2. _Closing_ the poll — a state transition, which is a host event the bot
   posts (`tlon surface event <channel> --set /closed true`), on whatever
   cadence that app's host runs. `workout-tracker/` and `habit-tracker/` are
   the worked examples of a host writing a time-dependent fact.

The test, whenever you are unsure: **does this change what is IN the board, or
what is ON the screen?** In the board is the host's. On the screen is yours.
A greyed-out row you derived is fine; a row you decided is expired in state is
not, and no amount of `timeDisplay` makes it otherwise.

The tempting mistake is one line of code away and looks harmless — deriving a
`closed` flag in `render` and then rendering from it. That is still only
display, so it is legal; the danger is that it reads exactly like state and the
next author will try to persist it. If a fact matters enough to be relied on,
it has to be written by the host, and then it is not derived at all.

## The `because` sentence, and check 8

This spec carries the display-only marker:

```json
"memberInteraction": {
  "mode": "none",
  "because": "The date and the run-up were written down once when this board went up, and no button anybody could press would move when the weekend happens. …"
}
```

Rewrite it for your board; do not copy this one. The marker suppresses the
gate's empty-action-map warning and draws rubric check 8, which is scored
against **the request**, not against the sentence's fluency. It is asking: does
this group actually want a board nobody can touch?

A countdown does. It is the canonical case: the date is not a member's to
change, and a screen showing a fixed date and the time left needs no input from
anybody. What it must not become is the place an app that forgot its member
action goes to look finished — which has happened three times, always to an
expense split, always with a board that renders "who owes what" and offers
nobody a way to add anything.

The honest question to ask of these captures: **would a member looking at this
screen reach for a button that is not there?** On this board there is one place
where they might — the run-up rows look tickable. They are not, deliberately.
They are dates that arrive whether or not anybody acts, and the row's job is to
say when and who to chase. A group that wants to tick these off wants a
different app, and the right answer is to build them `kanban/`, not to add a
button here.

## Customize

- **`initialState.event`, `detail`** — the name of the day and one line of
  practical detail. Both are read exactly as written.
- **`targetMs` and `targetLabel` — write BOTH, and keep them in step.**
  `targetMs` is epoch milliseconds and is the only thing the arithmetic uses;
  `targetLabel` is the human date, written by whoever sets the board up. The
  app deliberately never formats a calendar date from a number: `Date` is
  refused by the gate, and `Intl` would render in the _viewer's_ timezone,
  which is how "Friday 4:30pm" quietly becomes Saturday for one member of the
  group. An absolute date is a string the host should have written.
- **`startedMs`** — when the wait started, for the bar. Usually the day the
  board goes up. Leave it out and the bar is simply not drawn.
- **`steps` and `stepOrder`** — `{ label, when, atMs, owner }` per date in the
  run-up, in date order. `when` is the written date and `atMs` is the same
  moment as a number, the same pairing as the target. `owner` is a ship and
  draws its sigil; omit it and the row renders without one.
- **`recipe`** — rewrite it for this board; it is member-visible.
- **`surfaceId`** — any stable string.

## Leave alone

- **`timeDisplay: { refreshSeconds: 60 }`.** Sixty seconds is what "live to the
  minute" costs, and the screen shows minutes. The schema allows 1 to 86400; a
  busier timer buys nothing a viewer can read, and a slower one leaves the
  minutes visibly wrong. **Drop the declaration and this board freezes** at the
  reading it was opened with — the gate catches that as an error, because a
  screen that moves with the clock and a spec that says nothing is a screen
  that was reviewed in a state it will not stay in.
- **The integer breakdown.** Days, hours and minutes are floor divisions of an
  integer millisecond span, each subtracted off before the next. No division
  reaches a displayed number. Do not reach for a float "days = ms / 86400000"
  and round it — that is how a member gets told "3 days" on the last afternoon
  of the second.
- **`Math.max(0, …)` in `breakdown` and the clamp in `elapsedFraction`.** Both
  inputs can be on either side of the boundary and the four cases in
  `headlineOf` are all real: no clock, waiting, the day itself, afterwards.
- **`msAt`** — every number off state is checked before arithmetic. A string
  where a timestamp was expected would otherwise render "NaN days" for the
  whole group.
- **No `Date`, no `setTimeout`, no `performance.now`.** The gate refuses all of
  them lexically, and the reason is not the gate: the sandbox's clock is the
  VIEWER's, and a board that read it would show a different countdown to a
  member in Lisbon than to one in Los Angeles with nothing telling either.
- **`bundle` in `spec.json`.** Placeholders; `surface publish` overwrites them.
- **`state.json`** is not published and is not the starting state. It is the
  same board two days out with two run-up dates behind it, which is what a
  reviewer needs in order to score "Passed" and an hours-scale badge — the
  starting state is sixteen days out and exercises neither.

## Why the twelve captures come in six pairs

This spec declares no actions, so `surface preview` has nothing to fold and the
populated cells are byte-identical to the initial ones. The report says so. On
any other app that is a finding about the spec; here it is the app being what
it says it is. Score the six distinct images, and score `state.json` separately
with `--state` — that is the only run that exercises "Passed" and "in 12
hours".

## Revising it later

Copy changes are revisions. **The date is not.** `targetMs`, `targetLabel` and
the steps all live in state, and `--preserve-state` carries the state the
channel already has and never reads the new `initialState`. Moving the event is
therefore a host event:

```
tlon surface event <channel> --set /targetMs 1737131400000 \
  --set /targetLabel '"Saturday 18 January, 4:30pm"'
```

Edit `initialState` instead and you will tell the group the date moved while
they look at the old one. Read it back with `tlon surface state <channel>`
before you say it landed.
