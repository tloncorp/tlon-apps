# Leaderboard

A standings table for a group playing the same game over a listed set of
rounds. Members say how they got on — won or lost — and the app counts
everything else: played, won, lost, the run somebody is on, their position and
their win rate.

Copy this for anything shaped like **"who is ahead"** — a table tennis ladder,
a chess club, a pub quiz, a step-count contest, a sales board — where results
arrive per member per period and the interesting numbers are counted rather
than kept.

## Nothing here is a running total

State holds exactly one word per member per round:

```json
{ "results": { "r3": { "~zod": "won", "~ten": "lost" } } }
```

Wins, losses, runs, positions and rates are all derived in `render`, every
time it draws. That is not tidiness, it is the only shape that works:

- **The op language has no arithmetic.** An action writes a literal, so
  `wins = wins + 1` is not expressible at all.
- **The shapes that fake it break on a duplicate.** An `append` per win
  counts a double tap, a transport retry and the same member on two devices
  as three wins, and because members supply no values those three entries are
  byte-identical — nothing downstream can tell them apart.
- **A stored total cannot be corrected.** `set /results/<round>/$actor` is
  idempotent: pressing twice writes the same word to the same place, pressing
  the other button fixes a mis-tap, and the table is recounted from scratch
  either way.

If you add a number to this board, count it in `render`. Do not store it.

## Integer arithmetic, on display

`won / played` is `0.7777777777777778`, and any board that carries that
number around is one formatter away from printing it. So the rate is held as
**whole basis points** — multiply by 10000 first, round once — and turned
into a percentage only in `percent()`, by integer division:

```js
rate: played === 0 ? 0 : Math.round((won * 10000) / played); // 7778
percent(7778); // "77.8%"
```

The row also says **"won 7 of 9"**, which is the honest form: it is exact, it
carries the sample size a percentage hides, and a table where somebody is 1
of 1 does not read as a 100% player.

The one fraction in the file is the `Progress` bar's `value`, which is
geometry rather than a number anybody reads, and it is derived from the
integer (`rate / 10000`) rather than recomputed from the log.

## Customize

- **`initialState.ladder`** — what the group calls this thing.
- **`initialState.rounds` and `roundOrder`** — the rounds, `{ label }` each.
  The order is the order the form strip reads in, so keep it chronological.
- **`spec.json` `actions` and the `LOG` table in `app.js`** — two actions
  (`won-<id>`, `lost-<id>`) and one table entry per round. Both name the same
  literal ids and the gate checks the table against the spec, so adding a
  round is three consistent edits: `rounds` + `roundOrder`, its two actions,
  its table entry.
- **The ranking rule** in `tableOf` — wins, then fewest losses, then
  alphabetically. Change it to points, or to wins minus losses, if that is how
  the group keeps score; keep the tie handling.
- **`recipe`** — rewrite it for this group's game. It rides in the channel
  description and every member can read it.

## Leave alone

- **`set /results/<round>/$actor` with a literal outcome.** One key per member
  per round. Never `append` a result.
- **A round somebody sat out is not a loss.** It counts as nothing and it does
  not break a run — a board that treated a missed week as a defeat would
  quietly punish anybody who was away.
- **Joint positions.** Players level on wins and losses share a position;
  printing 3 and 4 beside identical records reads as a bug.
- **No `Date`, anywhere.** The rounds are the ones the board lists. Which one
  is "this week" is not something the viewer's clock is allowed to decide, and
  a board that highlighted a different round per timezone would be worse than
  one that highlights none.
- **The literal `invoke('won-…')` arguments in `LOG`.** `invoke(id + '-won')`
  is shorter and turns off the gate's cross-reference for the whole app; a
  mistyped id then does nothing at all, silently.
- **The chart primitive's props.** No width, no height, no colors, no
  `responsive`. The primitive owns the container and colors the series from
  the theme; the gate checks this after rendering, and a hand-built canvas
  overflows every phone.
- **Defaulted reads** (`state.results || {}`, `has(...)`). State is shared, so
  one odd entry throws the board for the whole group, not just its author.
- **`bundle.assetRef`, `bundle.sha256` and `bundle.size` in `spec.json`.**
  Placeholders; `surface publish` computes and overwrites all three, plus
  `specRevision`. Do not hand-edit them. `bundle.shellVersion` is not one
  of them — it is yours, and publish preserves it exactly as written.
- **`state.json`** is not published and is not the starting state. It is a
  populated example — four players, five rounds, somebody who missed a week
  and a tie for third — that CI renders through the shell, because the
  starting state is empty and an empty board exercises no table, no sigil and
  no chart. Keep it in step with the app.

## The v0 simplification: self-reported, and no scores

A member says **won** or **lost**. Nothing records 21–17, and nothing checks
that the two people in a game agree about who won. Both are the same limit:
an action carries no arguments, so recording a score means declaring an action
per possible score, and confirming a result means a second member acting on
the first member's entry, which needs an action that names somebody other
than `$actor`.

So this is a board for a group that trusts each other. If a result is wrong,
the member who logged it presses the other button — there is deliberately no
third "clear" button on every row, because it would crowd the row on a phone
for something the two buttons already do.

## Ending a season

The board has as many rounds as the spec lists. When they run out, that is a
revision: add the next block of rounds (each with its two actions and its
table entry) and republish with `--preserve-state` so the season so far
survives, or publish without it to start a new season from an empty table.
Both are deliberate choices — make it the one the group asked for, and read
the board back before telling them it worked.

Nothing prunes: `results` grows one word per member per round against a
128 KB cap, which is thousands of rounds, but a board that has run for years
is a host snapshot plus a prune, not a bigger cap.
