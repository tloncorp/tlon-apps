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

State is `state-0`, defined in the app file. Cross-cutting config is top level; each module owns its own slice:

```
state-0
  owners   (set ship)                  shared config: bots fan out to these / owner DMs to watch; ~ = inert
  lens     (map [bot=ship id=@t] run)   stored lens run records (owner role)
  gateway  <gateway state>              harness liveness + auto-reply bookkeeping
```

`owners` is shared: the lens module fans runs out to these ships, and the gateway module treats DMs from these ships as owner activity worth auto-replying to.

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

- **bot ship role** (`src == our`): the local gateway pokes `%steward-action-1` with a run record (`{"lens": {...}}`). `le-poke-action` fans it out to every ship in `owners` as a `%steward-action-1` poke. Ames retries until ack, so owner-ship downtime or gateway restarts don't drop finalized runs once poked.
- **owner ship role** (`src` is a moon we sponsor): a bot sent us its run. `le-poke-action` stores it keyed `[bot=src id]`, gives a fact on `/v1/lens`, and answers scries for clients.

A self-owned bot (an owner in `owners` equal to `our`) is stored directly during fan-out with no network hop.

A lens action is a single shape — `[id=@t payload=@t final=?]`. `final=&` marks the run complete; `final=|` is an in-progress milestone that upserts a partial record. A finalized run is never demoted back to partial by a late `final=|` (the late partial is dropped).

### retention

Bounds, per bot: runs older than 90 days are dropped; at most 1000 live runs per bot (oldest beyond the cap dropped). Enforced in three places:

- **on store**: every incoming run prunes that bot's records.
- **on a daily timer**: a recurring behn wake on the `/lens/prune` wire prunes all bots and re-arms itself, so storage is reclaimed even when a bot goes quiet.
- **on read**: `/x/v1/lens/recent` and `/x/v1/lens/run` filter expired runs, so the age bound holds observably regardless of timer cadence (gall scries cannot mutate state, so this is a filter, not a prune).

## module: gateway

Tracks the liveness of an external harness process and sends offline DM auto-replies on the bot's behalf while it's down — the part the harness can't do for itself, since no harness code runs during downtime. Ported from the former standalone `%gateway-status` agent (now a thin proxy; see `docs/gateway-status.md`).

The harness reports its lifecycle via the `%gateway` action: `%gateway-start` (with a `boot-id` and a lease expiry), periodic `%gateway-heartbeat`s that extend the lease, and a graceful `%gateway-stop`. A behn timer on `/gateway/lease-check` fires at the lease expiry; if no heartbeat renewed it, the gateway is marked `%down`. `boot-id` matching distinguishes graceful-stop recovery from crash recovery exactly as in the original agent (stop clears `boot-id` so late heartbeats can't revive it; crash/expiry retains it so a delayed heartbeat can).

While the gateway is not live, a DM from any ship in `owners` triggers a canned offline auto-reply to that sender (subject to a dedupe on the triggering message key and a `reply-cooldown`). Around stop/start transitions, a "restarting" / "back online" notice is sent to the most-recently-active owner if they messaged within `active-window`. Inbound owner DMs are observed via a subscription to `%activity /v5`.

`owners` is the shared top-level set. The single-owner case behaves identically to `%gateway-status`; with multiple owners, owner-activity tracking is global (most-recent across owners) and notices target the last owner to have messaged.

## poke surface — `%steward-action-1`

Gated on **ownership**, not strict locality: accepted iff `src` is `our`, or `src` is a moon `our` sponsors (a moon's sponsor is its immutable low 32 bits, derived directly — no jael scry). A bot is typically a moon of the owner planet, so the owner accepts lens runs from itself and from its own moons.

JSON poke forms (as sent over Eyre / Ames):

```json
{ "configure": { "owners": ["~sampel-palnet"] } }
{ "lens": { "id": "<lensId>", "payload": "<serialized JSON>", "final": true } }
```

Hoon types (`sur/steward.hoon`):

```
[%configure owners=(set ship)]        top-level: set fan-out / owner set
[%lens id=@t payload=@t final=?]      a lens run milestone (final=& finalizes)
[%gateway action:gateway]             gateway lifecycle (configure/start/heartbeat/stop)
```

The gateway action wraps the harness liveness protocol (see the gateway module above):

```
[%gateway %configure active-window=@dr reply-cooldown=@dr]   set notice/cooldown timing (owners set separately)
[%gateway %gateway-start boot-id=@t lease-until=@da]         a gateway instance started
[%gateway %gateway-heartbeat boot-id=@t lease-until=@da]     extend the lease (boot-id must match)
[%gateway %gateway-stop boot-id=@t reason=@t]                graceful stop (boot-id must match)
```

## subscription surface

- `/v1/lens` (local only, `?> =(src our)`): `%steward-update-1` `[%lens entry]` facts, one per stored run. No initial backfill fact — clients scry `/x/v1/lens/recent` for backfill.
- `/v1/gateway` (local only): `%steward-update-1` `[%gateway ...]` facts — `%status` (on lifecycle transitions, plus an initial fact on subscribe), `%owner-activity`, and `%auto-reply`.

## scry surface

- `/x/v1/lens/recent` → `%noun` `(list update:lens)` — newest 50 non-expired runs across all bots, for backfill.
- `/x/v1/lens/run/[ship]/[id]` → `%steward-update-1` `[%lens entry]`, or empty (`[~ ~]`) when absent or expired.
- `/x/v1/gateway/status` → `%noun` `[status (unit @da)]` — current liveness and lease expiry.
- `/x/v1/gateway/owner-activity` → `%noun` `@da` — timestamp of the most recent owner DM.

`entry` is `[bot=ship id=@t run]`. The lens update mark grows to JSON for Eyre:

```json
{ "lens": { "bot": "~zod", "id": "...", "complete": true, "received": "~2026.6.10..12.00.00..0000", "payload": "<serialized JSON>" } }
```

## lifecycle and invariants

- `on-init` arms the daily lens prune timer (`/lens/prune` behn wire) and subscribes to `%activity /v5` for the gateway module. The prune timer is armed once; reloading at `%0` does not stack a second one.
- `on-load` accepts state `%0` only — `%steward` is greenfield with no prior versions; an unreadable state resets to bunt and re-arms the timers/subscriptions.
- Wires: lens fan-out on `/lens/fanout/[owner-p]/[id-t]`, lens prune on `/lens/prune`, the gateway lease timer on `/gateway/lease-check`, gateway auto-reply/notice DM sends on `/gateway/dm/send`. The `%activity` subscription is re-watched on `%kick`. Poke/DM nacks are logged and ignored (Ames retries).
- `on-watch` and `on-peek` assert `=(src our)` — no cross-ship subscriptions or foreign scries. Only the `%steward-action-1` poke is ownership-gated (to admit a bot's runs).

## integration notes

- The gateway (openclaw-tlon / hermes) pokes top-level `%configure` on monitor activation and `%lens` run milestones from its run event stream. Lens recording is config-gated on the gateway side (`channels.tlon.contextLens`).
- Clients store runs locally, subscribe to `/v1/lens` for live updates, and scry on cache miss. The channel post pointer blob carries `botShip` so the client knows which `[bot id]` key to look up.
- The gateway's HTTP/SSE routes remain an optional desktop enhancement for fine-grained live streaming; `%steward`'s lens module is the durable source of truth.
- The mark family `%steward-action-1` / `%steward-update-1` replaces the former `%context-lens-*` marks; the JSON adds one level of module-key wrapping. There is no separate cross-ship `signal` mark — fan-out reuses `%steward-action-1`, gated by ownership.
