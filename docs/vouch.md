# %vouch

`%vouch` is the moon-classification store. It answers one question for the rest
of the system: **is this moon a real (booted) ship, one of our synthetic bots,
or unknown?** Everything that wants to talk to a moon scries `%vouch` first to
decide whether to talk to it directly or route through its host.

It is deliberately a *store*, not a proxy. It never relays or dispatches a poke;
it only remembers classifications. Routing lives in whichever agent owns the
flow (chat, contacts, presence), which reads `%vouch` and acts itself.

## Why classification exists

A moon `@p` is ambiguous: it may be a real person's booted moon, or a synthetic
bot hosted by its sponsor and addressed by the sponsor on its behalf. The two
must be reached differently — a real moon directly, a bot through its host — so
we track which is which.

Classification comes only from **authority**, never inference:

- A moon we have received network traffic from is **real**. Only a booted ship
  can transmit; a synthetic bot never boots, so it is never `src`.
- A moon's **sponsor** is trusted to declare its own moons. A sponsor is fixed
  and derivable from the moon's `@p` via the pure `^sein:title` (no Jael scry),
  so this holds even for a moon that has never booted.

We do **not** infer "real" from keys in Jael or a known Ames route: a
spawned-but-unbooted bot has both and never answers, so trusting them would
misclassify a bot as real and any direct traffic to it would hang forever.

## State

```
+$  state-0  [%0 moons=(map ship known:vouch)]
```

`known` is `?(%real %bot)`. `%unknown` is not stored — it is the absence of a
record, returned by scry as the default.

## Poke surface

- `%vouch-learn` — `[=ship known=?(%real %bot)]`. Local only
  (`src == our`). A local agent records a moon it has classified: `%real` when
  it saw the moon as `src`, `%bot` when steward spawned it.
- `%vouch-real` — `ship` (a moon). A foreign sponsor's declaration that one of
  its moons is real. Accepted only when `src` sponsors the moon
  (`+vouches-for`: `src == moon` or `src == ^sein:title(moon)`). Used on a
  forward, so a correspondent stops proxying through the host and goes direct.

We never accept a foreign `%bot`: `%bot` and `%unknown` route identically (both
through the host), so there is nothing to push and no reason to trust the claim.

## Scry surface

- `/x/status/<moon>` → `?(%unknown %real %bot)`. The moon's status, `%unknown`
  when there is no record.

## Invariants

- Writes are authority-gated: local for `%vouch-learn`, `src == sein(moon)` for
  `%vouch-real`. There is no unauthenticated way to set a classification.
- The store never emits a card in response to a classification write — it only
  updates its map. No routing, no relaying, no proxying.
