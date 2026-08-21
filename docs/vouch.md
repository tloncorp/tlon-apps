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

## Consumer: the `%contacts` bot-profile resolver

A bot moon never boots, so a subscriber has no way to `%watch` it directly for
its profile — the watch just hangs. `%contacts` resolves this by asking the
moon's host instead, at `/v1/vouch/<moon>`.

### Host side (`++ peer`, `[%v1 %vouch her=@ ~]`)

The host asserts it actually sponsors `her` (`%earl` clan, `^sein:title her ==
our`), then branches on its own `%vouch` scry for the moon:

- **`%bot`** — serve the bot's profile as a normal `%contact-update-1` `%full`
  fact, both on this initial watch and on every subsequent `%contact-bot-0`
  poke that updates it (see `/app/contacts` state).
- **`%real`** — the moon isn't actually a bot (or no longer is). Give a
  `%vouch-real` fact carrying the moon's `@p`, then `%kick`. The subscriber is
  expected to switch to a direct subscription and record the correction.
- **`%unknown`** — crash. The subscriber's normal watch-nack retry logic
  handles it; there is nothing to serve or redirect to yet.

The host never routes this through `++ pub` (that machinery tracks revision
history for our *own* profile) — it gives facts directly.

### Subscriber side (`++ sub`, `+si-meet` / `+si-take-vouch`)

`+si-meet` decides how to reach a peer:

- Our own bot moons: never subscribed to (unchanged, see above).
- A foreign moon (`%earl`, sponsor ≠ us) that our own `%vouch` scry says is
  `%bot` or `%unknown`: watch the moon's host at
  `/contact/vouch/<moon>` → `[%agent [host %contacts] %watch /v1/vouch/<moon>]`,
  recording `sag = %vouch`.
- Everything else, including a foreign moon already known `%real`: watch the
  peer directly at `/contact`, recording `sag = %want` (unchanged).

`+si-take-vouch` handles what comes back on the resolver wire:

- `%contact-update-1` fact — accepted **only** from the moon's sponsor
  (`src == ^sein:title(moon)`); otherwise crash. The update is applied via the
  same `+si-hear` used for direct subscriptions. If our `%vouch` scry still
  said `%unknown` for this moon, this is also treated as organic confirmation:
  fire a local `%vouch-learn` poke recording it `%bot`.
- `%vouch-real` fact — accepted only from the sponsor. Records `%vouch-learn
  [moon %real]`, then immediately switches to a direct subscription (`sag =
  %want`, watch `/contact` on the moon) without waiting for the `%kick` that
  follows it.
- `%kick` — if `sag` is still `%vouch` (the host ended our resolver sub), reset
  and re-run `+si-meet` to re-decide. If `sag` is already `%want` (we already
  switched on `%vouch-real`), it's the tail of a redirect already handled —
  no-op.
- `%watch-ack` failure — same 30-minute retry-timer scheduling as a direct
  subscription failure; the retry re-runs `+si-meet`, which re-derives
  direct-vs-resolver freshly from the current `%vouch` classification.

Every request on `/v1/vouch/<moon>` is served, redirected, or nacked — never
queued.

## Consumer: `%presence`

`%presence` decides routing the same way as `%chat` and `%contacts`, but
never runs a redirect protocol of its own -- it just re-derives the answer on
every periodic setup.

A subscriber's `+dm-contexts` consults `%vouch` for each `%earl` DM partner
that isn't one of its own moons (a self-hosted bot's presence is always
local, unchanged from before `%vouch` existed): a moon classified `%real` is
watched directly, like any ship; `%bot` or `%unknown` keeps watching through
the moon's sponsor on the `/vouched/<moon>/dm/<us>` context. Because setup
re-runs periodically and always recomputes routing from scratch, once the
contacts resolver's `%vouch-real` redirect (or organic confirmation) updates
the local `%vouch` store, the next setup cycle naturally switches the
subscription to direct -- there is no presence-specific redirect protocol.

On the host side, `+is-participant` additionally requires that the moon
named in a `/vouched/<moon>/dm/<counterparty>` context actually be
classified `%bot` by the host's own `%vouch` store, on top of the existing
sponsor and counterparty checks. A watch for a moon not (yet) classified
`%bot` is nacked; the subscriber's normal retry/backoff, and the next setup
cycle, re-decide once classification catches up.
