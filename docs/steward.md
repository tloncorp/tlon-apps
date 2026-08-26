# %steward

Ship-native umbrella agent: the durable, always-on ship-side half of an ephemeral bot harness. A harness (openclaw, hermes, or any future harness) talks to one agent regardless of which features it uses.

## concept: modules

`%steward` is built around **modules**, each a cohesive feature area. Each module is independently versioned and owns its own protocol types and mark family, so modules can evolve without dragging each other along:

| Module    | sur file                  | marks                                                  |
|-----------|---------------------------|--------------------------------------------------------|
| (core)    | `sur/steward.hoon`        | `%steward-action-1`                                    |
| `lens`    | `sur/steward/lens.hoon`   | `%steward-lens-action-1`, `%steward-lens-update-1`     |
| `gateway` | `sur/steward/gateway.hoon`| `%steward-gateway-action-1`, `%steward-gateway-update-1` |
| `prompts` | `sur/steward/prompts.hoon`| `%steward-prompts-action-1`, `%steward-prompts-update-1` |

Each sur file is versioned on its own (`++v1`), referenced by callers as `action:v1:lens`, `update:v1:gateway`, etc. The core `sur/steward.hoon` carries only cross-cutting config (currently just `%configure`); each module's protocol lives in its own file.

Modules:

| Module    | Purpose                                                                |
|-----------|------------------------------------------------------------------------|
| `lens`    | Per-run bot introspection (folded in from the former `%context-lens`). |
| `gateway` | Harness liveness tracking + offline DM auto-replies.                   |
| `prompts` | Ship-durable, owner-editable gateway system prompts.                   |

The app helper core keeps each module's logic in its own sub-core: `le-core` for lens, `ga-core` for gateway, `pr-core` for prompts. Adding a new module means a new `sur/steward/<module>.hoon`, its own mark family, and a dispatch arm in the app — existing modules and marks are untouched.

## state model

State is versioned (`state-0` → `state-1`, migrated in `on-load`). Cross-cutting config is top level; each module owns its own slice, typed from its own sur file:

```
state-1
  owner    (unit ship)                  shared config: bot sends runs to it / its DMs are watched; ~ = inert
  bots     (set ship)                   owner-side trusted bots: who may send lens %entry and prompts %sync pokes cross-ship
  lens     state:v1:lens                 stored lens run records (owner role)
  gateway  state:v1:gateway              harness liveness + auto-reply bookkeeping
  prompts  state:v1:prompts              canonical prompt set (bot role) + per-bot mirrors (owner role)
```

`owner` is shared: the lens module sends runs to it, the gateway module treats its DMs as owner activity worth auto-replying to, and the prompts module fans its canonical set to it. `bots` is the owner-side allowlist of ships permitted to fan lens runs and prompt syncs in (see the `%entry`/`%sync` gates below); managed via the core `%trust-bot`/`%untrust-bot` pokes.

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
- **owner ship role** (`src` is a trusted bot — in our `bots` set): a bot sent us its run. `le-poke-action` stores it keyed `[bot=src id]`, gives a fact on `/v1/lens`, and answers scries for clients.

A self-owned bot (`owner` equal to `our`) is stored directly during send with no network hop.

The lens action is a tagged union of three shapes:

- **`%entry`** `[%entry id=@t payload=json final=?]` — a run record from the gateway. `final=&` marks the run complete; `final=|` is an in-progress milestone that upserts a partial record. A finalized run is never demoted back to partial by a late `final=|` (the late partial is dropped). Oversized payloads (jammed size over 512KB) are dropped to bound loom usage.
- **`%retry`** `[%retry bot=ship id=@t]` — an owner-initiated request to re-dispatch a failed/aborted run. The symmetric case to `%entry` (bot → owner): retry flows owner → bot. If `bot == our`, the agent emits a `%retry-requested` fact on `/v1/lens` for the local gateway to act on; if `bot != our`, the owner's steward relays a cross-ship `%retry` poke to that bot's steward, which then emits the fact for its own gateway. Retry never mutates stored state — the gateway creates a fresh run and pokes it back via `%entry`.
- **`%configure`** `[%configure max-runs-per-bot=@ud]` — set the per-ship retention cap (local only); applied to every bot immediately.

### retention

Count-bounded only — lens runs are durable memory, not transient logs, so there is **no time-based expiry**. Each bot keeps at most `max-runs-per-bot` records (default 3,000, seeded at install; changed via `%configure`). When a bot exceeds the cap, the oldest by `received` are dropped. Enforced on every insert (bounds that bot's tail) and on `%configure` (re-applies a new cap to every bot). No prune timer.

## module: gateway

Tracks the liveness of an external harness process and sends offline DM auto-replies on the bot's behalf while it's down — the part the harness can't do for itself, since no harness code runs during downtime. Ported from the former standalone `%gateway-status` agent, which has since been removed — harnesses poke this module directly.

The harness reports its lifecycle via the gateway action: `%gateway-start` (with a `boot-id` and a lease expiry), periodic `%gateway-heartbeat`s that extend the lease, and a graceful `%gateway-stop`. A behn timer on `/gateway/lease-check` fires at the lease expiry; if no heartbeat renewed it, the gateway is marked `%down`. `boot-id` matching distinguishes graceful-stop recovery from crash recovery exactly as in the original agent (stop clears `boot-id` so late heartbeats can't revive it; crash/expiry retains it so a delayed heartbeat can).

While the gateway is not live, a DM from the configured `owner` triggers a canned offline auto-reply to that ship (subject to a dedupe on the triggering message key and a `reply-cooldown`). Around stop/start transitions, a "restarting" / "back online" notice is sent to the owner if they messaged within `active-window`. Inbound owner DMs are observed via a subscription to `%activity /v5`.

`owner` is the shared top-level `(unit ship)`, set via the core `%configure`, so a harness sends two pokes at startup: the core `%configure` for the owner, then the gateway `%configure` for timings. The gateway action's own `%configure` carries only timing (`active-window`, `reply-cooldown`); the owner is set once at the core level.

## module: prompts

Makes the gateway's system-prompt files (`SOUL.md`, `AGENTS.md`, …) durable on the ship and editable from any client. The harness container is ephemeral — its workspace is rebuilt from archives on every boot — so the ship, not the gateway, is the store of record.

One agent, two roles, same as lens:

- **bot ship role**: `own` holds the canonical prompt set. The local gateway pokes `%seed` at startup with the full effective file contents (after applying any stored edits to the workspace), and applies `%set` facts it receives on `/v1/prompts` by writing the workspace file, persisting `channels.tlon.prompts` in its config, and restarting.
- **owner ship role**: `mirror` holds a per-bot copy of each bot's canonical set, fanned in via `%sync` (gated on the trusted-bots set, exactly like lens `%entry`). Clients read and edit prompts entirely through their own ship.

The prompts action is a tagged union of three shapes:

Each stored prompt carries an `edited` flag: `&` for text that came from an owner `%set` (pinned intent the gateway re-applies on boot), `|` for entries that merely mirror the gateway's effective files (so upstream prompt-set updates keep flowing through them).

- **`%set`** `[%set bot=ship name=@t text=@t]` — an owner edit, stored with `edited=&`. Carries `.bot` for routing: a local poke targeting a remote bot is relayed to that bot's steward (owner → bot, like lens `%retry`); a poke targeting `bot == our` (locally, or cross-ship from the configured owner) stores the prompt, facts `[%set name prompt]` on `/v1/prompts` for the gateway, and re-syncs the owner mirror. Only local pokes relay outward — a cross-ship `%set` must target us, so the agent never proxies a non-local edit to a third ship. Ames retries the relay until ack, so an edit made while the gateway is down is stored and applied on the gateway's next boot.
- **`%seed`** `[%seed prompts=(map @t @t)]` — the local gateway reports the full effective prompt set (`src == our` only). Un-edited entries adopt it wholesale; edited entries are pinned — a seed with different text never overwrites one (that race is a `%set` landing between the gateway's scry and its seed), and an edited entry missing from the seed is kept rather than dropped. Entries with unchanged text keep their stored timestamp, and an identical re-seed (every gateway boot) is a no-op. Synced to the owner on change. When the core `%configure` points the owner at a **new** ship, the set is re-fanned to it and the previous owner is sent a `%revoke`; re-configuring the same owner is a no-op.
- **`%sync`** `[%sync prompts=(map @t [text=@t updated=@da edited=?])]` — bot → owner fan-out of the canonical set, stored in `mirror` keyed by `src` and facted on `/v1/prompts`.
- **`%request`** `[%request ~]` — ask the bot to re-fan its canonical set. Sent automatically by `%trust-bot`; accepted from the configured owner (or locally).
- **`%revoke`** `[%revoke ~]` — a bot tells a former owner to drop its mirror. Sent automatically when the bot's configured owner changes; accepted from any ship holding a mirror entry with us (a ship can only drop its own). The revoke is emitted on the same wire as `%sync` pokes to that ship (`/prompts/sync/<ship>`), so it shares their ames flow and is guaranteed to be delivered after any pre-transition `%sync` still in flight — a revoke on its own flow could be overtaken by a delayed sync, which would recreate the stale mirror.

Size caps: a `%set` over 64KB nacks at the first hop (so the editing client sees the failure); seed/sync maps are capped at 512KB jammed, mirroring the lens payload ceiling.

## poke surface

Four inbound marks, each ownership-gated to admit exactly the right source.

### `%steward-action-1` (core config) — `src == our`

```json
{ "configure": { "owner": "~sampel-palnet" } }
{ "unconfigure": null }
```

```
[%configure owner=ship]               top-level: set the shared owner
[%unconfigure ~]                      clear the shared owner
[%trust-bot ship=ship]                add a ship to the trusted-bots set
[%untrust-bot ship=ship]              remove a ship from the trusted-bots set
```

`%unconfigure` clears the shared owner and sends the former owner a prompts `%revoke` (on the shared `/prompts/sync/<ship>` wire, like the owner-change revoke), so a config that stops naming an owner also stops that ship's prompt visibility and edit rights. A no-op when no owner is set — the gateway re-sends it on every ownerless boot.

`%trust-bot`/`%untrust-bot` manage the owner-side `bots` allowlist that gates lens `%entry` and prompts `%sync` fan-in. Trust is explicit and ship-class-agnostic — a bot may be a planet, moon, comet, star, or galaxy, and moon sponsorship is **not** an auto-trust. Granting trust also sends the bot a prompts `%request` (a `%sync` delivered before trust was granted has already been nacked and won't retry), and revoking trust drops the bot's prompt mirror and facts the now-empty set so clients stop treating the bot as owned.

### `%steward-lens-action-1` (lens)

Auth is **per-variant**, since each shape expects a different `src`:

- `%entry` — accepted iff `src` is `our`, or `src` is in the owner-side trusted-bots set (`bots`, granted via the core `%trust-bot` poke). Ship-class-agnostic: a trusted bot may be a planet, moon, comet, etc. Moon sponsorship is **not** an auto-trust — even a moon the owner sponsors must be explicitly `%trust-bot`'d. This is the one shape a trusted remote ship may submit (its own runs, stored keyed by `src`).
- `%retry` — accepted iff `src` is `our` (a local client, or an owner-side relay forwarding to its own bot when `bot == our`) or the configured `owner` (relaying a retry to its bot moon).
- `%configure` — `src == our` only.

```json
{ "entry": { "id": "<lensId>", "payload": { ... run record ... }, "final": true } }
{ "retry": { "bot": "~sampel-palnet", "id": "<lensId>" } }
{ "configure": { "max-runs-per-bot": 10000 } }
```

```
[%entry id=@t payload=json final=?]   a lens run milestone (final=& finalizes)
[%retry bot=ship id=@t]               owner-initiated re-dispatch request
[%configure max-runs-per-bot=@ud]     set the per-bot retention cap
```

### `%steward-gateway-action-1` (gateway) — `src == our`

Only the local gateway drives liveness, so this requires `src == our`.

```
[%configure active-window=@dr reply-cooldown=@dr]   set notice/cooldown timing (owner set separately)
[%gateway-start boot-id=@t lease-until=@da]          a gateway instance started
[%gateway-heartbeat boot-id=@t lease-until=@da]      extend the lease (boot-id must match)
[%gateway-stop boot-id=@t reason=@t]                 graceful stop (boot-id must match)
```

### `%steward-prompts-action-1` (prompts)

Auth is **per-variant**, since each shape expects a different `src`:

- `%set` — accepted iff `src` is `our` (a local client editing, or the start of an owner-side relay) or the configured `owner` targeting `bot == our` (relaying an edit to its bot).
- `%seed` — `src == our` only (the local gateway).
- `%sync` — accepted iff `src` is `our` (a self-owned bot storing directly) or a ship in the owner-side trusted-bots set.
- `%request` — accepted iff `src` is `our` or the configured `owner`.
- `%revoke` — accepted iff `src` holds a mirror entry with us.

```json
{ "set": { "bot": "~sampel-palnet", "name": "SOUL.md", "text": "..." } }
{ "seed": { "SOUL.md": "...", "AGENTS.md": "..." } }
{ "sync": { "SOUL.md": { "text": "...", "updated": "~2026.8.26..12.00.00..0000", "edited": true } } }
```

```
[%set bot=ship name=@t text=@t]                          owner edit (relayed owner -> bot when bot != our)
[%seed prompts=(map @t @t)]                               gateway reports the effective prompt set
[%sync prompts=(map @t [text=@t updated=@da edited=?])]   bot -> owner fan-out of the canonical set
```

## subscription surface

- `/v1/lens` (local only, `?> =(src our)`): `%steward-lens-update-1` facts (`update:v1:lens`, a tagged union) — `%entry` (a stored run, one per insert; the owner-side client reads these) and `%retry-requested` (emitted on the bot ship for its local gateway to re-dispatch). No initial backfill fact — clients scry `/x/v1/lens/recent` for backfill.
- `/v1/gateway` (local only): `%steward-gateway-update-1` facts (`update:v1:gateway`) — `%status` (on lifecycle transitions, plus an initial fact on subscribe), `%owner-activity`, and `%auto-reply`.
- `/v1/prompts` (local only): `%steward-prompts-update-1` facts (`update:v1:prompts`) — `[%set name prompt]` (a stored edit; the bot's gateway applies it and restarts) and `[%prompts bot prompts]` (a full set changed; owner-side clients refresh from it). No initial fact — clients backfill via the `/x/v1/prompts` scries.

## scry surface

All lens scries return the `%steward-lens-update-1` mark so the HTTP client reads them as JSON.

- `/x/v1/lens/recent` → `[%recent entries]` — newest 50 runs across all bots, for backfill. Grows to `{ "recent": [ entry, … ] }` (a JSON array of entry objects).
- `/x/v1/lens/recent/[count]` → `[%recent entries]` — newest `count` runs.
- `/x/v1/lens/since/[da]` → `[%recent entries]` — every run with `received >= da`, newest first; paginate history by passing the oldest `received` from the last page.
- `/x/v1/lens/run/[ship]/[id]` → `[%entry entry]`, or empty (`[~ ~]`) when absent.
- `/x/v1/prompts` → `[%prompts our own]` — the canonical prompt set on the bot ship (the gateway reads this at boot). Returns the `%steward-prompts-update-1` mark.
- `/x/v1/prompts/[ship]` → `[%prompts ship prompts]` — a bot's mirrored set on the owner ship (clients read this); our own ship serves the canonical set so self-owned bots read the same path. Empty (`[~ ~]`) when the bot has no mirror entry.
- `/x/v1/gateway/status` → `%noun` `[status:v1:gateway (unit @da)]` — current liveness and lease expiry.
- `/x/v1/gateway/owner-activity` → `%noun` `@da` — timestamp of the most recent owner DM.

`entry` is `[bot=ship id=@t run]`. The `%entry` update grows to JSON for Eyre, embedding the stored payload directly:

```json
{ "entry": { "bot": "~zod", "id": "...", "complete": true, "received": "~2026.6.10..12.00.00..0000", "payload": { ... run record ... } } }
```

## lifecycle and invariants

- `on-init` subscribes to `%activity /v5` for the gateway module and seeds the default lens retention cap. There is no prune timer (retention is count-only, enforced on insert/configure).
- `on-load` accepts `state-0` (migrated: empty prompts slice) or `state-1`; anything else crashes so a pre-release state nukes rather than silently wiping.
- Wires: lens send on `/lens/send/[owner-p]/[id-t]`, lens retry relay on `/lens/retry/[bot-p]/[id-t]`, prompt edit relay on `/prompts/set/[bot-p]/[name-t]`, prompt owner sync on `/prompts/sync/[owner-p]`, the gateway lease timer on `/gateway/lease-check`, gateway auto-reply/notice DM sends on `/gateway/dm/send`. The `%activity` subscription is re-watched on `%kick`. Poke/DM nacks are logged and ignored (Ames retries).
- `on-watch` and `on-peek` assert `=(src our)` — no cross-ship subscriptions or foreign scries. Only the lens poke is ownership-gated (to admit a bot's runs).

## integration notes

- The gateway (openclaw-tlon / hermes) pokes core `%configure` on monitor activation and `%steward-lens-action-1` run milestones from its run event stream. Lens recording is config-gated on the gateway side (`channels.tlon.contextLens`).
- Clients store runs locally, subscribe to `/v1/lens` for live updates, and scry on cache miss. The channel post pointer blob carries `botShip` so the client knows which `[bot id]` key to look up.
- The gateway's HTTP/SSE routes remain an optional desktop enhancement for fine-grained live streaming; `%steward`'s lens module is the durable source of truth.
- The `%steward-lens-*` marks replace the former `%context-lens-*` marks. There is no separate cross-ship `signal` mark — sending reuses `%steward-lens-action-1`, gated by ownership.
