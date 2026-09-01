# Potluck sheet

A sign-up sheet for one shared meal. Members say which course they are
bringing — mains, sides, drinks, dessert — and can mark their dish
vegetarian. The sheet shows how many of each course are covered, how many
are still wanted, and who is bringing what, each row led by that member's
sigil.

Copy this for anything shaped like **"everybody signs up for one of a few
buckets, and their entry carries a small qualifier"** — a potluck, a
carpool by pickup point, a kit list, a rota where each slot has a type. It
is the RSVP shape (`templates/rsvp/`) with a second field on the entry; read
that one first if you only need the bucket.

Does not fit: anything where a member names the thing they are bringing,
brings more than one thing, or picks a qualifier off a long list. See "What
v0 cannot do here".

## The pattern this template exists to teach

A member's entry is an **object under their own key**, and every field of it
has its own idempotent action:

```
set /bringing/$actor/course  "mains"    ← which course
set /bringing/$actor/veg     true       ← the marker
del /bringing/$actor/veg                ← taking the marker back
del /bringing/$actor                    ← clearing the whole entry
```

An action carries no values, so a qualifier a member supplies has to be a
declared button. The obvious way to do that is to fold it into the choice —
`bring-mains`, `bring-mains-veg`, `bring-sides`, `bring-sides-veg`, … — and
it is the wrong way, because every new marker multiplies the action list.
Four courses and one marker: **6 actions** as separate fields, 8 folded in.
Four courses and three markers: **7 actions** as separate fields, **32**
folded in, against a cap of 64.

Separate fields also behave the way a member expects. Marking your dish
vegetarian does not disturb which course it is; changing course does not
silently drop the marker. Folded into one value, every change to either has
to restate both.

Both fields are still ordinary idempotent writes, so a double-tap, a
transport retry and the same member on two devices all land on the same
state. Nothing here uses `append` and nothing here counts posts.

## Customize

- **`initialState.occasion`, `when`, `where`** — the copy at the top. `when`
  is printed exactly as written; nothing here interprets it (see "No clock"
  in `../rsvp/NOTES.md` — the same rule applies).
- **`initialState.courses` and `courseOrder`** — `{ label, want }` per
  course. `want` is how many of that course the sheet is asking for and
  drives both the "1 of 4" badge and the "N more wanted" total. Set `want`
  to `0` on a course with no target and the badge shows a bare count.
- **`initialState.markLabel`, `markQuestion`** — the qualifier's name on the
  badge and the question on its row. Swap "Vegetarian" for whatever the group
  actually needs to know (gluten-free, alcohol-free, nut-free).
- **`spec.json` `actions` and the `BRING` table in `app.js`** — one action
  and one table entry per course, both naming the same literal id. The gate
  checks the table against the spec, so adding a fifth course is three
  consistent edits: the entry in `courses`, its action, its table line.
- **`recipe`** — rewrite it for this meal. It rides in the channel
  description and every member of the group can read it, so it describes what
  the sheet is for, never who asked for it or why.
- **`surfaceId`** — any stable string. It identifies this app's state within
  the channel; changing it after publishing orphans every entry.

## Adding a second marker

One field, one pair of actions, one row. `set /bringing/$actor/gf` /
`del /bringing/$actor/gf`, a second badge beside the first in the crew rows,
and a second question row. Nothing about the courses changes, and the action
count goes from 7 to 9 rather than from 7 to 14.

## Leave alone

- **`clear-mine` is declared FIRST in the `actions` map.** The reducer does
  not care about order, but `surface preview` folds the actions in the order
  they are declared, rotating three members through them — so a reset
  declared last lands on the last member and leaves them missing from the
  populated screenshots. Declared first, all three appear across three
  different courses with two markers between them, which is what those
  screenshots are for.
- **`unmark-veg` is a `del`, not `set … false`.** `del` on a path that is not
  there does nothing, so pressing "No" before ever pressing "Yes" is a no-op
  rather than an entry that means "explicitly not vegetarian". The sheet
  records the marker or nothing; it does not record its absence.
- **The literal `invoke('bring-…')` arguments.** Building the id from data
  (`invoke('bring-' + id)`) reads better and silently turns off the gate's
  only check that a button is wired to something that exists — for the whole
  bundle, not just that line.
- **The disabled fallback** (`!has(BRING, id)`). A course with no table entry
  renders a visibly dead button instead of a live one that does nothing.
- **`disabled=${!canInvoke()}`** — read-only viewers see the same screen with
  the controls off, rather than a different screen.
- **The "Not decided yet" group.** A member who marks their dish before
  picking a course has an entry with no course in it. They get their own
  group at the bottom rather than vanishing. The same handling catches a
  member holding a course the sheet no longer offers.
- **The summary badge is a single total.** A per-course breakdown lived there
  for one round: spelled out ("Mains 4 · Sides 3 · Drinks 2 · Dessert 2") it
  was far too long for the slot and squeezed the line beside it to one word
  per line on a phone. Every course row already carries its own "1 of 4".
- **`bundle` in `spec.json`.** `assetRef`, `sha256` and `size` are
  placeholders; `surface publish` computes and overwrites all three, plus
  `specRevision`. Do not hand-edit them.
- **`state.json`** is not published and is not the starting state. It is a
  populated example — six members across four courses, three markers and one
  undecided entry — that CI renders through the shell, because the starting
  state is empty and an empty sheet exercises no crew list, no sigil and no
  badge. Keep it in step with the courses.

## Whole numbers only

Every number on screen is a count of people or the difference between two
counts, so nothing here divides at all. A "62% covered" would be the one
place a rounding error could produce a plausible wrong number, and "1 of 4"
says the same thing better.

## What v0 cannot do here

- **The dish name.** There is no way for a member to supply "aubergine
  parmigiana". An action carries no values, so the only expressible form of a
  name is a declared button per name, which nobody can write in advance. The
  sheet therefore records the **kind** of thing and the marker, and the name
  goes in the channel next to the sheet. That is a real limitation, not a
  simplification this template chose: it is the same wall that stops a
  workout board recording actual reps, and it needs input-carrying actions to
  come down.
- **Bringing two things.** One entry per member, at their own key, is what
  makes every write idempotent. Two entries per member would need `append`,
  and an `append` cannot be made idempotent in v0 — a double-tap, a retry and
  a second device produce byte-identical entries that nothing downstream can
  tell apart, and the per-course counts would be wrong. If a group really
  needs it, the shape is a second named field
  (`set /bringing/$actor/also "dessert"`), not a list.
- **Claiming a specific numbered slot.** "I'll take mains #2" would be
  `set /slots/mains-2/by "$actor"` — expressible, and idempotent, but keyed
  by the slot rather than by the member, so anyone can overwrite anyone
  else's claim and nothing records that they did. This template stays keyed
  by `$actor` and counts the claims instead.
- **Knowing whether _you_ have signed up.** The app is never told who is
  looking at it, so no row can be highlighted as yours. Every control is
  labelled for the viewer in the abstract ("This clears only your own row")
  and the effect lands on the right member because the ops target `$actor`.

## Revising it later

Copy, course and target changes are revisions, not events. Republish with
`surface publish --preserve-state` to keep the entries; without it the sheet
resets from `initialState`. The actions carry `acceptStale: true` because
"I'm bringing a main" means the same thing before and after a copy change —
drop it on any action whose ops you change to mean something different.
