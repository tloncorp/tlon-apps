# %steward

Ship-native umbrella agent: the durable, always-on ship-side half of an ephemeral bot harness. A harness (openclaw, hermes, or any future harness) talks to one agent regardless of which features it uses.

## concept: modules

`%steward` is built around **modules**, each a cohesive feature area. Each module is independently versioned and owns its own protocol types and mark family, so modules can evolve without dragging each other along:

| Module    | sur file                  | marks                                                  |
|-----------|---------------------------|--------------------------------------------------------|
| (core)    | `sur/steward.hoon`        | `%steward-action-1`                                    |
| `lens`    | `sur/steward/lens.hoon`   | `%steward-lens-action-1`, `%steward-lens-update-1`     |
| `gateway` | `sur/steward/gateway.hoon`| `%steward-gateway-action-1`, `%steward-gateway-update-1` |

Each sur file is versioned on its own (`++v1`), referenced by callers as `action:v1:lens`, `update:v1:gateway`, etc. The core `sur/steward.hoon` carries only cross-cutting config (currently just `%configure`); each module's protocol lives in its own file.

Modules:

| Module    | Purpose                                                                |
|-----------|------------------------------------------------------------------------|
| `lens`    | Per-run bot introspection (folded in from the former `%context-lens`). |
| `gateway` | Harness liveness tracking + offline DM auto-replies.                   |

The app helper core keeps each module's logic in its own sub-core: `le-core` for lens, `ga-core` for gateway. Adding a new module means a new `sur/steward/<module>.hoon`, its own mark family, and a dispatch arm in the app — existing modules and marks are untouched.

## state model

State is `state-0`, defined in the app file. Cross-cutting config is top level; each module owns its own slice, typed from its own sur file:

```
state-0
  owner    (unit ship)                  shared config: bot sends runs to it / its DMs are watched; ~ = inert
  lens     state:v1:lens                 stored lens run records (owner role)
  gateway  state:v1:gateway              harness liveness + auto-reply bookkeeping
```

`owner` is shared: the lens module sends runs to it, and the gateway module treats its DMs as owner activity worth auto-replying to.

`run` (in `sur/steward/lens.hoon`):

```
complete  ?       whether a finalized (final=&) record has been received for this id
received  @da     when the latest poke for this id arrived
payload   json    the run record, stored as typed JSON
```

The lens payload is stored as a typed `$json` value (`enjs:format`/`dejs:format` on the wire). The gateway enforces size caps and truncation before poking; the ship relays and stores the parsed JSON without interpreting its contents, and re-serializes it on read. (Storing typed `$json` is fine — an earlier worry that embedding `$json` in a mark sample made ford's tube checks diverge turned out to be a mark-arm/type **shadowing** bug, not a property of `$json`. The mark captures the real type in an outer core, `=> |% +$ jsn json --`, and uses `same` as the json fist so the `++json` grow/grab arms don't shadow the `$json` type.)

## module: lens

Makes a bot's run records — trigger, tool calls, timings, output — durable on the owner's ship and reachable from any client (including mobile), without the client ever talking to the gateway.

One agent, two roles; the same code runs on every ship, and the role is determined by **who poked it** (the `%steward-lens-action-1` ownership gate has already vetted the source — see below):

- **bot ship role** (`src == our`): the local gateway pokes `%steward-lens-action-1` with a run record. `le-poke-action` sends it to the configured `owner` as a `%steward-lens-action-1` poke. Ames retries until ack, so owner-ship downtime or gateway restarts don't drop finalized runs once poked.
- **owner ship role** (`src` is a moon we sponsor): a bot sent us its run. `le-poke-action` stores it keyed `[bot=src id]`, gives a fact on `/v1/lens`, and answers scries for clients.

A self-owned bot (`owner` equal to `our`) is stored directly during send with no network hop.

A lens action is a single shape — `[id=@t payload=json final=?]`. `final=&` marks the run complete; `final=|` is an in-progress milestone that upserts a partial record. A finalized run is never demoted back to partial by a late `final=|` (the late partial is dropped).

### retention

Bounds, per bot: runs older than 90 days are dropped; at most 1000 live runs per bot (oldest beyond the cap dropped). Enforced in three places:

- **on store**: every incoming run prunes that bot's records.
- **on a daily timer**: a recurring behn wake on the `/lens/prune` wire prunes all bots and re-arms itself, so storage is reclaimed even when a bot goes quiet.
- **on read**: `/x/v1/lens/recent` and `/x/v1/lens/run` filter expired runs, so the age bound holds observably regardless of timer cadence (gall scries cannot mutate state, so this is a filter, not a prune).

## module: gateway

Tracks the liveness of an external harness process and sends offline DM auto-replies on the bot's behalf while it's down — the part the harness can't do for itself, since no harness code runs during downtime. Ported from the former standalone `%gateway-status` agent (now a thin proxy; see `backend/desk/app/gateway-status.md`).

The harness reports its lifecycle via the gateway action: `%gateway-start` (with a `boot-id` and a lease expiry), periodic `%gateway-heartbeat`s that extend the lease, and a graceful `%gateway-stop`. A behn timer on `/gateway/lease-check` fires at the lease expiry; if no heartbeat renewed it, the gateway is marked `%down`. `boot-id` matching distinguishes graceful-stop recovery from crash recovery exactly as in the original agent (stop clears `boot-id` so late heartbeats can't revive it; crash/expiry retains it so a delayed heartbeat can).

While the gateway is not live, a DM from the configured `owner` triggers a canned offline auto-reply to that ship (subject to a dedupe on the triggering message key and a `reply-cooldown`). Around stop/start transitions, a "restarting" / "back online" notice is sent to the owner if they messaged within `active-window`. Inbound owner DMs are observed via a subscription to `%activity /v5`.

`owner` is the shared top-level `(unit ship)`, set via the core `%configure`. This matches `%gateway-status`'s original single-owner model. The gateway action's own `%configure` carries only timing (`active-window`, `reply-cooldown`); the owner is set once at the core level.

## poke surface

Three inbound marks, each ownership-gated to admit exactly the right source.

### `%steward-action-1` (core config) — `src == our`

```json
{ "configure": { "owner": "~sampel-palnet" } }
```

```
[%configure owner=ship]               top-level: set the shared owner
```

### `%steward-lens-action-1` (lens)

Gated on **ownership**, not strict locality: accepted iff `src` is `our`, or `src` is a ship `our` sponsors (per jael, via `+sein:title`). A bot is typically a moon of the owner planet, so the owner accepts lens runs from itself and from its own moons; sponsorship rejects comets and unrelated ships. This is the one action a sponsored moon may submit (its own runs, stored keyed by `src`).

```json
{ "id": "<lensId>", "payload": { ... run record ... }, "final": true }
```

```
[id=@t payload=json final=?]          a lens run milestone (final=& finalizes)
```

### `%steward-gateway-action-1` (gateway) — `src == our`

Only the local gateway drives liveness, so this requires `src == our`.

```
[%configure active-window=@dr reply-cooldown=@dr]   set notice/cooldown timing (owner set separately)
[%gateway-start boot-id=@t lease-until=@da]          a gateway instance started
[%gateway-heartbeat boot-id=@t lease-until=@da]      extend the lease (boot-id must match)
[%gateway-stop boot-id=@t reason=@t]                 graceful stop (boot-id must match)
```

## subscription surface

- `/v1/lens` (local only, `?> =(src our)`): `%steward-lens-update-1` facts (`update:v1:lens`, i.e. a bare `entry`), one per stored run. No initial backfill fact — clients scry `/x/v1/lens/recent` for backfill.
- `/v1/gateway` (local only): `%steward-gateway-update-1` facts (`update:v1:gateway`) — `%status` (on lifecycle transitions, plus an initial fact on subscribe), `%owner-activity`, and `%auto-reply`.

## scry surface

- `/x/v1/lens/recent` → `%steward-lens-update-list-1` `(list update:v1:lens)` — newest 50 non-expired runs across all bots, for backfill. Grows to a JSON array of entry objects so the HTTP client can consume it directly.
- `/x/v1/lens/run/[ship]/[id]` → `%steward-lens-update-1` `update:v1:lens` (an `entry`), or empty (`[~ ~]`) when absent or expired.
- `/x/v1/gateway/status` → `%noun` `[status:v1:gateway (unit @da)]` — current liveness and lease expiry.
- `/x/v1/gateway/owner-activity` → `%noun` `@da` — timestamp of the most recent owner DM.

`entry` is `[[bot=ship id=@t] run]`. The lens update mark grows to JSON for Eyre, embedding the stored payload directly:

```json
{ "bot": "~zod", "id": "...", "complete": true, "received": "~2026.6.10..12.00.00..0000", "payload": { ... run record ... } }
```

## lifecycle and invariants

- `on-init` arms the daily lens prune timer (`/lens/prune` behn wire) and subscribes to `%activity /v5` for the gateway module. The prune timer is armed once; reloading at `%0` does not stack a second one.
- `on-load` accepts state `%0` only — `%steward` is greenfield with no prior versions; an unreadable state resets to bunt and re-arms the timers/subscriptions.
- Wires: lens send on `/lens/send/[owner-p]/[id-t]`, lens prune on `/lens/prune`, the gateway lease timer on `/gateway/lease-check`, gateway auto-reply/notice DM sends on `/gateway/dm/send`. The `%activity` subscription is re-watched on `%kick`. Poke/DM nacks are logged and ignored (Ames retries).
- `on-watch` and `on-peek` assert `=(src our)` — no cross-ship subscriptions or foreign scries. Only the lens poke is ownership-gated (to admit a bot's runs).

## integration notes

- The gateway (openclaw-tlon / hermes) pokes core `%configure` on monitor activation and `%steward-lens-action-1` run milestones from its run event stream. Lens recording is config-gated on the gateway side (`channels.tlon.contextLens`).
- Clients store runs locally, subscribe to `/v1/lens` for live updates, and scry on cache miss. The channel post pointer blob carries `botShip` so the client knows which `[bot id]` key to look up.
- The gateway's HTTP/SSE routes remain an optional desktop enhancement for fine-grained live streaming; `%steward`'s lens module is the durable source of truth.
- The `%steward-lens-*` marks replace the former `%context-lens-*` marks. There is no separate cross-ship `signal` mark — sending reuses `%steward-lens-action-1`, gated by ownership.
