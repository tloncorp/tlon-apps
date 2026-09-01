# Kanban board

A shared board of fixed cards moving through fixed columns. Anybody can move
any card, the column is one value the whole group shares, and moving a card
puts the mover's marker on it so the board shows where everyone is standing.

Copy this for anything shaped like **a set of known things, each in exactly
one of a set of known states**: a production checklist, a sprint board, a
reading list (To read / Reading / Finished), a house move, an approval queue.
It is the counterpart to `poll/` and `workout-tracker/`, which both hold
per-member state; here the interesting value belongs to the group, and the
per-member part is only the marker.

Does not fit: anything where members write the cards themselves. Members
supply no values — only which declared button they pressed — so "add a task"
is not a variant of this board, it is a different design. Same for due dates,
free-text notes, and per-member private boards.

## Customize

- **`initialState.board`** — the board's name, in the group's own words.
- **`initialState.tasks` and `taskOrder`** — `{ label, note, status }` per
  card. `label` and `note` are the only strings a member reads; `status` is a
  column key and appears in no copy. `taskOrder` fixes the order cards appear
  in within a column, so everybody sees the same board.
- **`COLUMNS` in `app.js`** — the columns, in board order. Keep them few and
  keep the labels short: every column is a button on every card.
- **`spec.json` `actions` and the `MOVE` table in `app.js`** — one action and
  one table line per (card, column). Both name the same literal id and the
  gate checks the table against the spec, so adding a card is three
  consistent edits: the card in `tasks` + `taskOrder`, its four actions, its
  `MOVE` entry.
- **The `Stat` label** — `cards in Done` is built from the last column's
  label, so the headline number counts whatever column you put last. If your
  last column is not an end state ("Parked", "Archived"), rewrite the label
  rather than leaving a headline number that means nothing.
- **The one instruction line** under the progress bar. It is a plain line and
  not the `Stat`'s `hint` on purpose: hints render tertiary, and tertiary is
  the first text to go unreadable in dark — which is no place for the only
  sentence telling a first-time member what to do.
- **`recipe`** — rewrite it for this board. It rides in the channel
  description and every member of the group can read it, so it describes what
  the board is for, never who asked for it or why.
- **`surfaceId`** — any stable string. It identifies this board's state within
  the channel; changing it after publishing orphans every card.

## Leave alone

- **`set /tasks/<card>/status` — a fixed path, not `$actor`-keyed.** This is
  the one place a template deliberately does _not_ key by member. A board's
  whole premise is that there is one answer to "where is this card", so the
  last press wins on purpose. It is still idempotent: pressing "Done" twice
  writes the same word to the same place. Never `append` a move — a
  double-tap, a transport retry and the same member on two devices all
  produce a byte-identical entry, and nothing downstream can tell them apart.
- **The marker at `/claims/$actor`.** One key per member, so a member's marker
  is on exactly one card and a second press never adds a second marker. This
  is what lets the board show people at all: the app is never told who is
  looking at it, so it renders everybody and lets the viewer find their own
  row.
- **The literal `invoke('layout-blocked')` arguments in `MOVE`.**
  `invoke(id + '-' + key)` is much shorter and turns off the gate's
  cross-reference for the whole app — on a board this size, that is 24 buttons
  whose ids nothing checks. A wrong id is not a runtime error: the press
  returns `false` and the button does nothing.
- **The disabled fallback** (`!has(moves, destination.key)`). A card with no
  `MOVE` entry renders visibly dead buttons instead of live ones that do
  nothing.
- **`disabled=${!canInvoke()}`** — read-only viewers see the same screen with
  the controls off, rather than a different screen.
- **The first-column fallback in `columnOf`.** A card whose stored column is
  not one of `COLUMNS` lands in the first column rather than falling off the
  board. That is graceful degradation, and it is also the exact symptom of a
  renamed column key — see below.
- **Defaulted reads** (`state.tasks || {}`, `has(...)`). State is shared, so
  one odd entry throws the board for the whole group, not just its author.
- **`bundle` in `spec.json`.** `assetRef`, `sha256` and `size` are
  placeholders; `surface publish` computes and overwrites all three, plus the
  version number. Do not hand-edit them.
- **`state.json`** is not published and is not the starting state. It is a
  populated example — cards spread across all four columns, three members with
  markers down — that CI renders through the shell, because the starting state
  puts every card in the first column and exercises no marker and no sigil.
  Keep it in step with the board.

## Ids are permanent once the board is running

**This is the rule this template exists to teach.** A label is copy and you
may rewrite it whenever you like. An **id** is a record: by the time you want
to rename one, it has already been written down — into state, and into every
press members have already made — and renaming it does not go back and change
what was written. Three kinds of id are load-bearing here.

**A column key** (`todo`, `doing`, `blocked`, `done`) is the literal that
every move action writes into `/tasks/<card>/status`, so every card on the
board is already storing one, and it is the `key` in `COLUMNS` that decides
which column that card shows up in. Rename `blocked` to `stuck` and the six
new actions write `stuck`, while every card that was already blocked still
says `blocked` — a key no column has any more. Those cards do not disappear;
they fall into the first column. The board reshuffles itself in front of the
group with nobody having moved anything, and the only repair is a host event
rewriting each stranded card's status.

**An action id** (`layout-blocked`) lives in `spec.json`, in `MOVE`, and
inside every press a member has already made. Rename it and every press that
was in flight, or that arrived tagged with the older board, is dropped — an
id nothing declares any more is an id nothing can apply. The gate is the
consolation here: it cross-references `MOVE` against the spec, so a rename in
one place and not the other fails the build rather than shipping a dead
button.

**A card id** (`layout`) is a path segment in all four of that card's actions
(`/tasks/layout/status`), a key in `tasks`, an entry in `taskOrder`, and the
value every marker in `/claims` holds. Rename it and the card's state is
orphaned under the old key while its new actions write to a fresh, empty
card — and every marker pointing at the old name now points at nothing.

The pattern behind all three: **the label is the copy, the id is the record.**
Ids appear in no copy — that is why they look private and renameable, and why
it is worth writing down that they are neither.

## Adding a column between two others

This is safe, and it is the change this board has actually been through — a
`blocked` column went in between `doing` and `done` on a live board, with
every card keeping its place. Four edits, none of which touches anything that
already exists:

1. **`COLUMNS` in `app.js`** — insert `{ key: 'blocked', label: 'Blocked' }`
   between `doing` and `done`. Position in the array is the only thing that
   decides where the column appears; no existing key moves.
2. **`spec.json`** — one new action per card, `<card>-blocked`, with the same
   two ops every other move has. Six cards, six new actions, no existing
   action touched.
3. **`app.js`** — one new line in each card's `MOVE` entry. Six lines, no
   existing line touched.
4. **Republish with `--preserve-state`**, so the cards keep the columns they
   are in.

What survives, and why: every card's stored column is still a key `COLUMNS`
still has, so no card moves. Every action id members have pressed still exists
with the same ops, which is also why every action here carries
`acceptStale: true` — a press that was in flight while you were publishing
still means what it meant. The new column renders empty until somebody moves
a card into it; that is correct, not a missing step.

What is _not_ safe in the same change: renaming `done` to `shipped` while you
are in there. Every finished card holds `done`, no column would have that key
any more, and all of them would reappear in the first column.

**Removing a column is the mirror image, and it needs a host event first.**
Move every card out of the doomed column with a host event, _then_ publish the
revision that drops its key, its actions and its table lines. Publish first
and every card left in it lands in the first column.

## The 64-action ceiling

Cards × columns must be at most 64. Four columns caps this board at sixteen
cards; a fifth column drops the ceiling to twelve. That is a real design
constraint, not a technicality — a board that needs thirty cards needs fewer
columns, or needs to be two boards. Count before you add either.

## The v0 simplification: no history of who moved what when

The board shows where each card is now and whose marker is on it. It does not
show that ~zod moved it out of Blocked on Tuesday, and it cannot: a per-move
log would have to `append`, and an append cannot be trusted here — a
double-tap and a transport retry both produce a byte-identical entry, so a
count of moves would be wrong in a way nothing downstream could detect. The
timestamp is missing for a second, independent reason: the sandbox's clock is
the viewer's, so the only time a board may show is one the channel host handed
it, never one the app read for itself.

If a group genuinely needs the history, the shape is host-is-the-clock — see
`workout-tracker/` — with the host archiving a snapshot of the board under a
date it computes. That is a different template, not a flag on this one.

## Revising it later

Copy and label changes are revisions, not events; card additions and removals
are both (`PARADIGM.md` §13) — the actions and the `MOVE` lines come in with
the revision, and the card itself goes into `tasks` with a host event, because
`--preserve-state` means the new starting state is never read. Republish with
`--preserve-state` to keep the board as it stands; without it every card
resets to the first column. Every action carries `acceptStale: true` because
"move this to Done" means the same thing before and after a copy change — drop
it on any action whose ops you change to mean something different.
