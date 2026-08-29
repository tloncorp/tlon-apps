# Poll

One question, a fixed set of choices, one vote each. The smallest complete
surface app — start here for anything shaped like "everyone picks one".

Fits: lunch, a meeting slot, a movie, a name, any single choice from a list
the publisher writes.

Does not fit: anything where members supply their own option ("suggest a
restaurant"), rank choices, or vote more than once. Members supply no values
at all — only which declared button they pressed — so a write-in is not a
poll variant, it is a different design.

## Customize

- **`initialState.question`** — the question, in the group's own words.
- **`initialState.options`** — `{ id, label }` per choice. The `id` is a
  state key and appears in no copy; the `label` is what members read.
- **`spec.json` `actions` and the `VOTE` table in `app.js`** — one action
  and one table entry per choice. Both name the same literal action id, and
  the gate checks that every id in the table is declared. Adding a fourth
  choice is three edits: the option, the action, the table line.
- **`title`** — the channel-level name.
- **`recipe`** — rewrite it for this poll. It rides in the channel
  description and every member of the group can read it, so it describes
  what the app is for, never who asked for it or why.
- **`surfaceId`** — any stable string. It identifies this app's state within
  the channel; changing it after publishing orphans every vote.

## Leave alone

- **`ops` shape: `set /votes/$actor`.** One key per member is what makes a
  second tap change nothing and what makes "one vote each" true without any
  duplicate checking. Never `append` a vote — a double-tap, a transport
  retry and the same member on two devices all produce a byte-identical
  entry, and nothing downstream can tell them apart.
- **The literal `invoke('vote-…')` arguments.** Building the id from data
  (`invoke('vote-' + option.id)`) reads better and silently turns off the
  gate's only check that a button is wired to something that exists. A
  wrong id is not an error at runtime: the invoke returns `false` and the
  button does nothing.
- **The disabled fallback** (`!has(VOTE, id)`). A choice with no table entry
  renders a visibly dead button instead of a live one that does nothing.
- **`disabled=${!canInvoke()}`** — read-only viewers see the same screen
  with the controls off, rather than a different screen.
- **The crew card.** The app cannot know who is looking at it, so it shows
  everyone and lets the viewer find their own row. That is also why the
  rows carry sigils: `<${Avatar} ship=${ship} />` takes the ship name
  exactly as `$actor` wrote it into state.
- **`bundle` in `spec.json`.** `assetRef`, `sha256` and `size` are
  placeholders; `surface publish` computes and overwrites all three, plus
  `specRevision`. Do not hand-edit them.

## Revising it later

Copy and label changes are revisions, not events. Republish with
`surface publish --preserve-state` to keep the votes; without it the tally
resets from `initialState`. The actions carry `acceptStale: true` because a
vote means the same thing before and after a copy change — drop it on any
action whose ops you change to mean something different.
