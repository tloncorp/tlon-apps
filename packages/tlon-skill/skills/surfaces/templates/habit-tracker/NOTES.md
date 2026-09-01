# Habit tracker

A shared daily board: each member marks a habit done for the day, and the app
works out how many marks are in, each member's current run, and the strip of
past days from the log alone.

Copy this for anything where **the group does the same small things every day
and wants to see each other doing them** — a habit board, a practice log, a
medication check, a chore rota, a reading streak. It is the same shape as
`workout-tracker/` (members log an outcome per period; the interesting numbers
are derived, not stored) with one difference that is the whole point of this
template: **the period closes lazily**, not on a schedule. If a group needs the
day boundary to land at midnight to the minute, this is the wrong template —
see "When lazy is wrong" below.

Does not fit: anything where a member writes the habit themselves, or records
how much they did. Members supply no values, only which declared button they
pressed, so "45 minutes" and "add a habit" are both a different design.

## Customize

- **`initialState.board`** — the board's name, in the group's own words.
- **`initialState.habits` and `habitOrder`** — `{ label, detail }` per habit.
  Both strings are read by members; the id appears in no copy. Keep `detail`
  to the thing that settles an argument — "Two litres", "Before eleven".
- **`daysShown`** — how many past days the strip and the past-days list carry.
  Seven is a week at a glance; more makes the strip unreadable on a phone.
- **`spec.json` `actions` and the `MARK` table in `app.js`** — one action and
  one table line per habit, plus `clear-today`. Both name the same literal id
  and the gate checks the table against the spec, so adding a habit is three
  consistent edits: the habit in `habits` + `habitOrder`, its action, its
  `MARK` entry.
- **`recipe`** — rewrite it for this group. It rides in the channel description
  and every member can read it, so describe the board, never who asked for it.
- **`surfaceId`** — any stable string. It identifies this board's state within
  the channel; changing it after publishing orphans every mark.

## Leave alone

- **`set /today/$actor/<habit>` with a literal `true`.** One key per member per
  habit: a double-tap re-sets the same path to the same value and changes
  nothing. Never `append` a mark — a double-tap, a transport retry and the same
  member on two devices all produce a byte-identical entry, and nothing
  downstream could tell them apart, so every count on this board would be
  wrong in a way nobody could see.
- **`clear-today` as `del /today/$actor`, not `del /today`.** The label says it
  clears only your own marks and the op has to mean it. A member clearing the
  whole group's day is not a feature this board is asking for.
- **The literal `invoke('did-water')` arguments in `MARK`.**
  `invoke('did-' + id)` is shorter and turns off the gate's action
  cross-reference for the whole app; a mistyped id then does nothing at all,
  silently, and the button still looks live.
- **The disabled fallback** (`!has(MARK, id)`). A habit with no table entry
  renders a visibly dead button rather than a live one that does nothing.
- **`disabled=${!canInvoke()}`** — read-only viewers see the same screen with
  the controls off, rather than a different screen.
- **No `Date`, anywhere, and no `timeDisplay`.** Nothing on this screen depends
  on what time it is. The day in progress is "today" until the host closes it,
  and every date on the board is one the host wrote. A board that read the
  sandbox's clock would be reading the VIEWER's, and would draw the day
  boundary in a different place for a member in Lisbon than for one in Los
  Angeles without telling either of them.
- **Defaulted reads** (`objectAt(...)`, `has(...)`). State is shared, so one
  member's odd entry throws the board for the whole group, not just its author.
- **`bundle` in `spec.json`.** `assetRef`, `sha256` and `size` are
  placeholders; `surface publish` computes and overwrites all three, plus the
  revision number. Do not hand-edit them.
- **`state.json`** is not published and is not the starting state. It is a
  populated example — five saved days and a day in progress, three members —
  that CI renders through the shell, because the starting state is empty and an
  empty board exercises no crew list, no sigil and no run. Keep it in step with
  the habits.

## The rollover, and why it is lazy

**This app does not close the day. The channel host does — and it does it on
its next ordinary visit to this channel, not at midnight.**

`/today` is where members mark. Finished days live in `/history` keyed by
date, and only one thing puts them there: a host event, posted by the channel
host ship, carrying two raw ops in one entry —

```json
{ "op": "set", "path": "/history/2026-08-31", "value": { "…": "a copy of /today" } }
{ "op": "del", "path": "/today" }
```

The host computes both the date and the copied value from its own fold; members
never supply either, which is why this is not an `append` and why nothing here
is forgeable by a member.

**Both ops go in that order, in one entry, and that is load-bearing.** The
archiving `set` is the op that can fail — near the 128 KB live-state cap,
because it grows state while the `del` shrinks it; at any size if `/history`
is holding something other than an object; at any size if the path is simply
mistyped. When an op is refused, every remaining op in that entry is refused
too, so the clear is unreachable unless the archive landed. Split them across
two host events and that protection is gone: the second event is its own entry
and applies on its own, clearing a day that was never saved.

### Why there is no timer

**Because a scheduled rollover would be an agent turn.** An OpenClaw cron job
is not a shell script on a crontab — it wakes the agent and runs a model turn.
Putting the rollover on a schedule therefore means running inference in a timer
path: every night at midnight, a model wakes up, works out what channel it is
dealing with, works out what date to write, and composes a two-op bookkeeping
post. That turn costs tokens, can fail, can decide to do something else, and
can post something into the channel that nobody asked for — every night,
forever, for a write that has no judgement in it at all. Inference belongs
where somebody asked a question. So the bot closes the day when it is next in
this channel for a reason of its own, and it does it as part of that turn.

**Because a habit log tolerates it.** Nothing on this board is paid, awarded,
closed or expired at midnight. Nobody loses money, nobody is late, no outcome
turns on which side of the boundary a mark fell. So the cost of closing the day
at nine in the morning instead of at midnight is exactly this: a mark somebody
tapped at half past midnight lands in the day that just ended rather than in
the new one. That is a rounding error a group can absorb, and it is one they
can even see and talk about — which is the test. **If you cannot say out loud
what a late close costs, the period is load-bearing and this is not the
template.**

### When lazy is wrong

Ask what happens if the boundary lands hours late.

- If the answer is "one mark is filed under the day before", lazy is fine and
  this template is the right shape.
- If the answer is money, a deadline, a winner, a fine, or anything a member
  could reasonably dispute, **lazy is wrong** — and so is every other option
  v0 has, because a scheduled host event is still a bot turn and a bot turn is
  still not a clock. Do not paper over it with a `timeDisplay` and a derived
  "closed" label either: what a member sees expiring and what the board records
  as expired are different things (`countdown/NOTES.md` draws that line), and a
  screen that says "closed" over state that says "open" is worse than either.

### What a missed day looks like

A day nobody closed is not lost — it just keeps accumulating, and the next
close archives everything since the last one under a single date.

- **An entry covers everything since the last close, and the marks in it are
  the union.** A member who did the habit on Monday and not on Tuesday shows as
  having done it for a merged Monday-Tuesday entry. The board is not wrong; the
  day it is describing is just longer than a day.
- **A run counts days on the board, not calendar days.** `runFor` walks the
  archived dates backwards, so two calendar days merged into one entry count
  once. That is why the copy says "days running" against a board whose days the
  host defines, and why nothing here claims a calendar streak.
- **Nothing ever prunes.** `history` grows one dated entry per close against a
  128 KB live-state cap. The repair is a host snapshot plus a prune, not a
  bigger cap — and at the cap the surface shows "dashboard full" and no further
  archive will land until somebody trims it.

### If nothing ever closes the day

The board still reads correctly. "Today" grows without end, the crew card shows
everybody's marks with no run badges, and the past-days card says "No days
saved yet" — which is true, not broken. That is the degradation this shape is
chosen for: a board that is behind is still a board, where a board that cleared
a day it never saved would be a board that lied.

## Previewing the archived half

`surface preview` folds **declared actions only**, so on this app it can fill
"today" and nothing else: the crew's runs, the strip and the past-days card are
empty in all twelve cells, because only the host can produce them.
`--host-ops <file>` is the fix — a JSON array of host events folded around the
invokes, `"at": "before"` ahead of them:

```json
[
  {
    "at": "before",
    "note": "the day of 30 August, as the crew left it",
    "ops": [
      { "op": "set", "path": "/today", "value": { "~zod": { "water": true } } }
    ]
  },
  {
    "at": "before",
    "note": "the host closing that day",
    "ops": [
      {
        "op": "set",
        "path": "/history/2026-08-30",
        "value": { "~zod": { "water": true } }
      },
      { "op": "del", "path": "/today" }
    ]
  }
]
```

Two of those pairs, then the ordinary fold fills today, and the populated
capture shows saved days and a day in progress at once — which is the only
state a reviewer can score the crew card and the past-days card against. It
also folds the real rollover through the real reducer, so a mistyped path in
your host event fails here rather than on a live channel.

## Adding a habit

Three edits, none of which touches anything that already exists: the habit in
`habits` and `habitOrder`, its `did-<id>` action in `spec.json`, its line in
`MARK`. Republish with `--preserve-state` so the log survives. Every action
carries `acceptStale: true` because "I drank the water" means the same thing
before and after a copy change — drop it on any action whose ops you change to
mean something different.

**On a live board, adding a habit to `initialState` does nothing.**
`--preserve-state` carries the state the channel already has and never reads
the new `initialState`. The habit list lives in state, so a new habit needs a
host event too (`tlon surface event <channel> --set /habits/<id> '…'` plus a
new `/habitOrder`), exactly as `PARADIGM.md` §13 describes. Publish the
revision alone and members will see a button for a habit the board does not
have.

## Ids are permanent once the board is running

A **habit id** is a path segment in its action (`/today/$actor/water`), a key in
`habits`, an entry in `habitOrder`, a key in `MARK`, and a key inside every day
already archived. Renaming it strands every mark ever made under the old key
while the new action writes into a fresh, empty one, and no past day will ever
count toward a run again. The label is the copy; the id is the record. Rewrite
labels whenever you like; leave ids alone.
