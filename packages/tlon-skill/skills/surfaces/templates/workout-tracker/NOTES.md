# Workout tracker

A shared 5×5 board: each member marks every lift as done or missed, and the
app derives working weight, the A/B alternation, miss streaks, the deload
and the chart from the log alone.

Copy this for anything where **members log an outcome per period and the
interesting numbers are computed, not stored** — a habit board, a reading
streak, a practice log, a chore rota. The op language has no arithmetic, so
"add 2.5 kg" cannot be an op; state holds the log and `render` does the
maths.

## Customize

- **`initialState.lifts`, `liftOrder`, `workouts`** — the program. Labels,
  schemes, starting weights and per-session increments are all data.
- **`progression`** — the one-line summary under the session count. It is
  copy, not logic: change the numbers above and this string too.
- **`plateStep`, `barWeight`, `deloadAfter`, `deloadFactor`** — the rules
  the derivation applies.
- **`chartLift`** — which lift the chart plots.
- **`spec.json` `actions` and the `LOG` table in `app.js`** — two actions
  per lift plus `clear-today`. Both name the same literal ids and the gate
  checks the table against the spec, so adding a lift is three consistent
  edits: `lifts` + `liftOrder` + its workout, its two actions, its table
  entry.
- **`recipe`** — rewrite it for this crew's program. It rides in the channel
  description, so every member can read it: describe the board, not the
  conversation that produced it.

## Leave alone

- **Integer tenths.** Weights are carried as whole tenths of a kilo and
  divided only in `formatWeight`. `25 * 0.9` is `22.499999999999996`, and an
  obvious floor to the nearest plate turns that into 20 kg where 22.5 was
  meant — a wrong number that looks right. Any new arithmetic goes through
  `tenths`/`kg` the same way.
- **`set /today/$actor/<lift>` with a literal outcome.** One key per member
  per lift: a double-tap re-sets the same path to the same value and changes
  nothing. Never `append` a lift.
- **No `Date`, anywhere.** The sandbox's clock is the viewer's; the day
  boundary is the host's. The UI says "this session", which is true for
  every viewer in every timezone, and the only dates on screen are the ones
  the host wrote into state.
- **The literal `invoke('squat-ok')` arguments in `LOG`.** `invoke(id +
'-ok')` is shorter and turns off the gate's cross-reference for the whole
  app; a mistyped id then does nothing at all, silently.
- **The chart primitive's props.** No width, no height, no colors, no
  `responsive`. The primitive owns the container and colors series from the
  theme; the gate checks this after rendering, and a hand-built canvas
  overflows every phone.
- **Defaulted reads** (`state.today || {}`, `has(...)`). State is shared, so
  one odd entry throws the app for the whole group, not just its author.
- **`bundle.assetRef`, `bundle.sha256` and `bundle.size` in `spec.json`.**
  Placeholders; `surface publish` computes and overwrites all three, plus
  `specRevision`. Do not hand-edit them. `bundle.shellVersion` is not one
  of them — it is yours, and publish preserves it exactly as written.
- **`state.json`** is not published and is not the starting state. It is a
  populated example — three saved sessions and a session in progress — that
  CI renders through the shell, because the starting state is empty and an
  empty board exercises no crew list, no sigil and no chart. Keep it in step
  with the program.

## The v0 simplification: no per-set rep entry

A member marks a lift **All reps** or **Missed** — nothing records "4, 5, 5,
5, 3". That is not an omission to fix here: an action carries no arguments,
so the only way to record a number is to declare an action per possible
number, and reps per set is far past the 64-action cap. Recording actual
reps needs input-carrying actions, which is a v1 feature. Until then the
board is deliberately binary, and the progression rules read the same way a
lifter would: made it, or did not.

## The host-is-the-clock dependency

**This app does not save a session. The channel host does, and if it never
runs, "this session" grows forever.**

`/today` is where members log. Finished sessions live in `/history` keyed by
date, and only one thing can put them there: a host event, posted by the
channel host ship, carrying two raw ops —

```json
{ "op": "set", "path": "/history/2026-08-21", "value": { "…": "a copy of /today" } }
{ "op": "del", "path": "/today" }
```

The host computes both the date and the copied value from its own fold;
members never supply either, which is exactly why this is not an `append`
and why nothing here is forgeable by a member.

Consequences to plan for:

- **The chart and the past-sessions card stay empty until the first save.**
  On a freshly published board they are correct-but-empty, and they stay
  that way for as long as nobody archives.
- **A missed save is graceful, not broken** — the session in progress just
  keeps accumulating, and the next save archives it under a later date. A
  crew that trains three times a week and archives once a week gets three
  sessions merged into one entry, with the last outcome per lift winning.
- **Working weight only advances at a save.** `/today` is deliberately not
  replayed into the progression: the weight on the board is the weight to
  lift right now.
- **Nothing ever prunes.** `history` grows one dated entry per save per
  member against a 128 KB live-state cap; the repair is a host snapshot plus
  a prune, not a bigger cap.

If nothing on the channel is going to post that host event on a schedule,
this template is the wrong shape — use one that has no periods in it.

## Revising it later

Republish with `surface publish --preserve-state` to keep the log across a
copy or program change. The actions carry `acceptStale: true` because
"missed the squat" means the same thing before and after such a change;
drop it on any action whose ops you change to mean something different.
