# %steward

Ship-native umbrella agent: the durable, always-on ship-side half of an ephemeral bot harness. A harness (openclaw, hermes, or any future harness) talks to one agent regardless of which features it uses.

## concept: modules

`%steward` is built around **modules**, each a cohesive feature area. All modules share two mark families — `%steward-action-1` (inbound) and `%steward-update-1` (outbound facts + scry results) — dispatched by a module key in the payload:

```json
{ "lens": { ... lens action ... } }
```

A handful of cross-cutting actions (e.g. `%configure`) live at the top level rather than inside a module. Adding a new module means adding a variant to the `$action` / `$update` unions in `sur/steward.hoon` and a dispatch arm in the app — no new mark files.

Modules:

| Module    | Purpose                                                                |
|-----------|------------------------------------------------------------------------|
| `lens`    | Per-run bot introspection (folded in from the former `%context-lens`). |
| `gateway` | Harness liveness tracking + offline DM auto-replies.                   |

The app helper core keeps each module's logic in its own sub-core: `le-core` for lens, `ga-core` for gateway.

## state model

State is `state-1`, defined in the app file. Cross-cutting config is top level; each module owns its own slice:

```
state-1
  owner    (unit ship)                  shared config: bot fans runs out to it / its DMs are watched; ~ = inert
  lens     state:lens                   stored lens run records + retention cap (owner role)
  gateway  <gateway state>              harness liveness + auto-reply bookkeeping
```

`lens` itself is a record:

```
runs                (map [bot=ship id=@t] run)   stored lens run records
max-runs-per-bot    @ud                          retention cap; default 10,000, set by %lens %configure
```

`state-0` (legacy: `lens` was a bare map, no cap field) is migrated forward by `on-load`.

`owner` is shared: the lens module fans runs out to it, and the gateway module treats its DMs as owner activity worth auto-replying to.

`run` (in `sur/steward.hoon`, under `++lens`):

```
complete  ?      whether a finalized (final=&) record has been received for this id
received  @da    when the latest poke for this id arrived
payload   @t     opaque serialized-JSON run record
```

Run payloads are opaque serialized JSON (a cord, `@t`) with an inner `schemaVersion`. The gateway enforces size caps and truncation before poking; the ship relays and stores without interpreting the contents. The payload is a cord rather than a `$json` because embedding the recursive `$json` type in mark sample types makes ford's tube nest checks diverge — every json conversion build for the desk stack-overflows.

## module: lens

Makes a bot's run records — trigger, tool calls, timings, output — durable on the owner's ship and reachable from any client (including mobile), without the client ever talking to the gateway.

One agent, two roles; the same code runs on every ship, and the role is determined by **who poked it** (the `%steward-action-1` ownership gate has already vetted the source — see below):

- **bot ship role** (`src == our`): the local gateway pokes `%steward-action-1` with a run record (`{"lens": {...}}`). `le-poke-action` fans it out to the configured `owner` as a `%steward-action-1` poke. Ames retries until ack, so owner-ship downtime or gateway restarts don't drop finalized runs once poked.
- **owner ship role** (`src` is a moon we sponsor): a bot sent us its run. `le-poke-action` stores it keyed `[bot=src id]`, gives a fact on `/v1/lens`, and answers scries for clients.

A self-owned bot (`owner` equal to `our`) is stored directly during fan-out with no network hop.

Lens actions form a tagged union: `%entry` carries a run milestone and is the data ingress path; `%retry` is an owner-initiated request to re-dispatch a finalized run. `%entry` is `[%entry id=@t payload=@t final=?]` — `final=&` marks the run complete, `final=|` upserts an in-progress partial, and a finalized run is never demoted by a late `final=|` (the late partial is dropped). `%retry` is `[%retry id=@t]`; it emits a `%retry-requested` fact on `/v1/lens` for the local gateway to pick up and dispatch, but does not mutate stored state — the new run lands later as an `%entry` from the gateway with a fresh `id` (and `retryOf` pointing to the original).

### retention

Count-bounded per bot, no time-based expiry — lens runs are durable memory of agent activity, not transient logs. The cap is `max-runs-per-bot` in lens state; default is 10,000 (set on init or on state-0 → state-1 migration), and configurable per-ship via the `%lens %configure` action. Enforced in two places:

- **on store**: every incoming `%entry` prunes that bot's records to the cap (oldest by `received` dropped first).
- **on `%configure`**: changing the cap applies it to every bot immediately, so a lowered cap takes effect without waiting for the next per-bot insert.

There is no periodic prune timer and no read-time filter — the cap is the only bound, and runs are never silently aged out.

## module: gateway

Tracks the liveness of an external harness process and sends offline DM auto-replies on the bot's behalf while it's down — the part the harness can't do for itself, since no harness code runs during downtime. Ported from the former standalone `%gateway-status` agent (now a thin proxy; see `docs/gateway-status.md`).

The harness reports its lifecycle via the `%gateway` action: `%gateway-start` (with a `boot-id` and a lease expiry), periodic `%gateway-heartbeat`s that extend the lease, and a graceful `%gateway-stop`. A behn timer on `/gateway/lease-check` fires at the lease expiry; if no heartbeat renewed it, the gateway is marked `%down`. `boot-id` matching distinguishes graceful-stop recovery from crash recovery exactly as in the original agent (stop clears `boot-id` so late heartbeats can't revive it; crash/expiry retains it so a delayed heartbeat can).

While the gateway is not live, a DM from the configured `owner` triggers a canned offline auto-reply to that ship (subject to a dedupe on the triggering message key and a `reply-cooldown`). Around stop/start transitions, a "restarting" / "back online" notice is sent to the owner if they messaged within `active-window`. Inbound owner DMs are observed via a subscription to `%activity /v5`.

`owner` is the shared top-level `(unit ship)`, set via the top-level `%configure`. This matches `%gateway-status`'s original single-owner model.

## poke surface — `%steward-action-1`

Auth is per-variant rather than blanket-gated:

- `%configure` and `%gateway` require `src == our` (local only).
- `%lens %entry` requires `src == our` or `src` is a moon `our` sponsors — the data ingress shape, used by the bot's local gateway and by cross-ship fan-out from a moon to its sponsor (a moon's sponsor is its immutable low 32 bits, derived directly — no jael scry).
- `%lens %retry` requires `src == our` or `src` is the configured `owner` — covers a cross-ship retry poke from an owner planet to a bot moon (the `%entry` gate would reject this direction since the owner isn't a moon the bot sponsors).

JSON poke forms (as sent over Eyre / Ames):

```json
{ "configure": { "owner": "~sampel-palnet" } }
{ "lens": { "entry": { "id": "<lensId>", "payload": "<serialized JSON>", "final": true } } }
{ "lens": { "retry": { "id": "<lensId>" } } }
{ "lens": { "configure": { "max-runs-per-bot": 25000 } } }
```

Hoon types (`sur/steward.hoon`):

```
[%configure owner=ship]               top-level: set the shared owner
[%lens action:lens]                   inner: %entry, %retry, or %configure
[%gateway action:gateway]             gateway lifecycle (configure/start/heartbeat/stop)

++  lens
  +$  action
    $%  [%entry id=@t payload=@t final=?]  a lens run milestone (final=& finalizes)
        [%retry id=@t]                     owner-initiated re-dispatch request
        [%configure max-runs-per-bot=@ud]  set the per-bot retention cap
    ==
```

The gateway action wraps the harness liveness protocol (see the gateway module above):

```
[%gateway %configure active-window=@dr reply-cooldown=@dr]   set notice/cooldown timing (owner set separately)
[%gateway %gateway-start boot-id=@t lease-until=@da]         a gateway instance started
[%gateway %gateway-heartbeat boot-id=@t lease-until=@da]     extend the lease (boot-id must match)
[%gateway %gateway-stop boot-id=@t reason=@t]                graceful stop (boot-id must match)
```

## subscription surface

- `/v1/lens` (local only, `?> =(src our)`): `%steward-update-1` lens facts. Two variants:
  - `[%lens %entry entry]` — emitted on every store and on every retry receipt? No: only on entry store. Clients backfill via `/x/v1/lens/recent`.
  - `[%lens %retry-requested id=@t requester=ship]` — emitted when an owner pokes `%retry`, to signal the local gateway to re-dispatch.
- `/v1/gateway` (local only): `%steward-update-1` `[%gateway ...]` facts — `%status` (on lifecycle transitions, plus an initial fact on subscribe), `%owner-activity`, and `%auto-reply`.

## scry surface

- `/x/v1/lens/recent` → `%noun` `(list update:lens)` — newest 50 runs across all bots as `%entry` updates, for first-page backfill.
- `/x/v1/lens/recent/[count]` → `%noun` `(list update:lens)` — newest `count` runs across all bots; paginate by varying count.
- `/x/v1/lens/since/[da]` → `%noun` `(list update:lens)` — every run with `received >= da`, newest first; paginate back through history by passing the oldest `received` from the previous page.
- `/x/v1/lens/run/[ship]/[id]` → `%steward-update-1` `[%lens %entry entry]`, or empty (`[~ ~]`) when absent.
- `/x/v1/gateway/status` → `%noun` `[status (unit @da)]` — current liveness and lease expiry.
- `/x/v1/gateway/owner-activity` → `%noun` `@da` — timestamp of the most recent owner DM.

`entry` is `[bot=ship id=@t run]`. The lens update mark grows to JSON for Eyre:

```json
{ "lens": { "entry": { "bot": "~zod", "id": "...", "complete": true, "received": "~2026.6.10..12.00.00..0000", "payload": "<serialized JSON>" } } }
{ "lens": { "retry-requested": { "id": "...", "requester": "~sampel-palnet" } } }
```

## lifecycle and invariants

- `on-init` seeds the lens config (`max-runs-per-bot` = `default-max-runs-per-bot`) and subscribes to `%activity /v5` for the gateway module. There is no prune timer.
- `on-load` tries state-1 first, then state-0 with migration (legacy lens map is wrapped into the new record, default cap applied), then bunt on failure.
- Wires: lens fan-out on `/lens/fanout/[owner-p]/[id-t]`, gateway lease timer on `/gateway/lease-check`, gateway auto-reply/notice DM sends on `/gateway/dm/send`. The `%activity` subscription is re-watched on `%kick`. Poke/DM nacks are logged and ignored (Ames retries).
- `on-watch` and `on-peek` assert `=(src our)` — no cross-ship subscriptions or foreign scries. The `%steward-action-1` poke is gated per-variant (see "poke surface" above).

## integration notes

- The gateway (openclaw-tlon / hermes) pokes top-level `%configure` on monitor activation and `%lens` run milestones from its run event stream. Lens recording is config-gated on the gateway side (`channels.tlon.contextLens`).
- Clients store runs locally, subscribe to `/v1/lens` for live updates, and scry on cache miss. The channel post pointer blob carries `botShip` so the client knows which `[bot id]` key to look up.
- The gateway's HTTP/SSE routes remain an optional desktop enhancement for fine-grained live streaming; `%steward`'s lens module is the durable source of truth.
- The mark family `%steward-action-1` / `%steward-update-1` replaces the former `%context-lens-*` marks; the JSON adds one level of module-key wrapping. There is no separate cross-ship `signal` mark — fan-out reuses `%steward-action-1`, gated by ownership.
