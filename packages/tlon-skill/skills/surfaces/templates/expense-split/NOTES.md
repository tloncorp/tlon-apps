# Expense split

A shared cost sheet for one trip. The group's costs are listed with the price
they were agreed at; each member taps the cost they paid for and taps to put
themselves on the sheet, and the app works out the total, each person's share,
what everybody is up or down, and the shortest list of payments that squares
everyone up.

Copy this for anything shaped like **"who owes what"** — a trip, a house, a
group present, a shared subscription.

## Read this first: the failure this template exists to prevent

**Three "who owes what for the trip" apps have shipped with an empty action
map** — a board that renders the split perfectly and offers nobody a way to
add anything to it. Twice with `actions: {}` and no comment; the third time
with the display-only marker declared, one session after the failure had been
written down. Every gate rule passed all three times, and so did the rubric,
because a screenshot of a board nobody can touch looks exactly like a
screenshot of a board somebody can.

So the action map here is not an afterthought bolted to a report — it is what
the app is:

| the member does this      | the action   | what it writes             |
| ------------------------- | ------------ | -------------------------- |
| "I paid for the van"      | `paid-van`   | `/paidBy/van` = their ship |
| "I'm sharing these costs" | `join-trip`  | `/crew/<their ship>`       |
| "take me off this sheet"  | `leave-trip` | removes that key           |

Everything else on screen — the total, the per-head share, each balance, the
settle-up list — is **derived in `render`** from those two facts. Nothing is
stored that a member cannot change by pressing a button.

If you adapt this template and the result has no member actions, you have not
adapted it, you have rebuilt the bug. And `memberInteraction: {"mode":
"none"}` does not fix it: an expense split is never display-only, because
somebody has to say who paid.

## Customize

- **`initialState.trip`** — what the group calls this trip.
- **`initialState.currency`** — the symbol in front of every amount. It is
  display only; amounts are always whole cents (see below).
- **`initialState.items` and `itemOrder`** — the costs, `{ label, cents }`
  each. **`cents` is an integer**: £480.00 is `48000`, never `480.00`.
- **`spec.json` `actions` and the `CLAIM` table in `app.js`** — one
  `paid-<id>` action and one table entry per cost. Both name the same literal
  id and the gate checks the table against the spec, so adding a cost is three
  consistent edits: `items` + `itemOrder`, the action, the table entry.
- **`recipe`** — rewrite it for this group's trip. It rides in the channel
  description and every member can read it: describe the sheet, not the
  conversation that produced it.
- **`surfaceId`** — any stable string. Changing it after publishing orphans
  every claim.

## Leave alone

- **Integer cents, everywhere.** A third of `84.25` is
  `28.083333333333332`, and three of those add back up to `84.24999999999999`
  — a sheet a penny short of the money that was actually spent, which is the
  one defect nobody forgives in a bill splitter. Every amount is a whole
  number of cents from the read out of state to the `money()` call that puts
  the point back in. Any new arithmetic goes the same way.
- **The remainder loop in `sharesOf`.** An uneven split leaves at most one
  cent per person; those are handed out one each to the first names on the
  sheet so the shares total exactly what was spent. Rounding each share
  instead leaves the sheet off by a cent or two and nobody can say whose it
  is.
- **`set /paidBy/<cost>` with the value `"$actor"`.** One key per cost, so a
  double tap writes the same ship to the same place and changes nothing.
  Never `append` a payment: a double tap, a transport retry and the same
  member on two devices all produce a byte-identical entry, and a total built
  by appending would silently count one of them twice.
- **Only claimed costs count.** An unclaimed cost is money nobody has said
  they put in yet; adding it to the split would invent a debt and the
  balances would stop summing to zero.
- **A payer stays on the sheet after leaving.** `sheetOf` is the union of the
  crew and everybody who paid for something — somebody who drops out is still
  owed for the van, and dropping them would leave the sheet unbalanced.
- **No `Date`, anywhere.** There is no "added yesterday" and no deadline: the
  sandbox's clock is the viewer's, and a sheet that read differently in
  another timezone would be worse than one that never mentions time.
- **The literal `invoke('paid-…')` arguments.** Building the id from data
  (`invoke('paid-' + cost.id)`) reads better and turns off the gate's only
  check that a button is wired to something that exists — for the whole app,
  not just that line.
- **`disabled=${!canInvoke()}`** — a read-only viewer sees the same sheet
  with the controls off, not a different screen.
- **`state.json`** is not published and is not the starting state. It is a
  populated example — four people, one cost still unclaimed, an uneven split
  — that CI renders through the shell, because the starting state has nobody
  on the sheet and an empty sheet exercises no balance, no sigil and no
  settle-up. Keep it in step with the app.

## The v0 simplification: nobody types an amount

Actions carry no arguments, so a member cannot enter "£48.60". That is why
the sheet **lists costs** and members claim them, rather than accepting
receipts. It fits the way most shared trips actually work — the cabin, the
van and the ferry are known before anybody pays for them — and it is a real
limit everywhere else. If your group needs to enter arbitrary amounts, this
v0 cannot do it, and the honest answer is to say so rather than to ship a
board that looks like it can.

Two things it deliberately does not do, for the same reason:

- **No per-cost exceptions.** Everyone on the sheet shares every claimed
  cost. Adding "I'm out on the ferry" is two more actions per cost
  (`set /items/<id>/out/$actor` and a `del` to undo), plus the share
  arithmetic to match — worth it for a group that needs it, noise for one
  that does not.
- **No "I've paid you back" flag.** The settle-up list is derived, so it
  disappears when the costs it came from are corrected, not when somebody
  ticks it off.

## Adding a cost

A new cost is a **revision** (the app's shape changed: a new action and a new
table entry) **and, on a sheet that already has claims on it, a host event**
(the cost itself is data). Publishing only the revision on a live sheet
either wipes the claims — the default resets state to `initialState` — or,
with `--preserve-state`, carries the old state and never reads the new
`initialState`, so the cost you just added is not there. Both mechanisms:

1. add the cost to `initialState.items` and `itemOrder`, its action to
   `spec.json`, its entry to `CLAIM`, and publish with `--preserve-state`;
2. post the host event that puts the cost into the live sheet:

```json
{ "op": "set", "path": "/items/boat", "value": { "label": "Boat hire", "cents": 12000 } }
{ "op": "set", "path": "/itemOrder", "value": ["house", "van", "food", "ferry", "boat"] }
```

Correcting a price is the host event alone — no revision, because nothing
about the app's shape changed:

```json
{
  "op": "set",
  "path": "/items/food",
  "value": { "label": "Groceries", "cents": 9210 }
}
```

Read the sheet back before telling anyone it worked.

## Revising it later

Republish with `surface publish --preserve-state` to keep the claims across a
copy or price change. The actions carry `acceptStale: true` because "I paid
for the van" means the same thing before and after such a change; drop it on
any action whose ops you change to mean something different.
