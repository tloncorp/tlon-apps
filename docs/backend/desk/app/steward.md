# %steward

Ship-native umbrella agent: the durable, always-on ship-side half of an ephemeral bot harness. A harness (openclaw, hermes, or any future harness) talks to one agent regardless of which features it uses.

## concept: modules

`%steward` is built around **modules**, each a cohesive feature area. Each module is independently versioned and owns its own protocol types and mark family, so modules can evolve without dragging each other along:

| Module       | sur file                         | marks                                                                    |
|--------------|----------------------------------|--------------------------------------------------------------------------|
| (core)       | `sur/steward.hoon`               | `%steward-action-1`                                                      |
| `lens`       | `sur/steward/lens.hoon`          | `%steward-lens-action-1`, `%steward-lens-update-1`                       |
| `gateway`    | `sur/steward/gateway.hoon`       | `%steward-gateway-action-1`, `%steward-gateway-update-1`                 |
| `automation` | `sur/steward/automation.hoon`    | `%steward-automation-action-1`, `%steward-automation-update-1`, `%steward-automation-mirror-1`, `%steward-automation-task-map-1`, `%steward-automation-mirror-map-1` |

Each sur file is versioned on its own (`++v1`), referenced by callers as `action:v1:lens`, `update:v1:gateway`, etc. The core `sur/steward.hoon` carries only cross-cutting config (currently just `%configure`); each module's protocol lives in its own file.

Modules:

| Module       | Purpose                                                                |
|--------------|------------------------------------------------------------------------|
| `lens`       | Per-run bot introspection (folded in from the former `%context-lens`). |
| `gateway`    | Harness liveness tracking + offline DM auto-replies.                   |
| `automation` | Durable best-effort mirror of OpenClaw cron task definitions, propagated bot → owner → client. |

The app helper core keeps each module's logic in its own sub-core: `le-core` for lens, `ga-core` for gateway, and `au-core` for automation. Adding a new module means a new `sur/steward/<module>.hoon`, its own mark family, and a dispatch arm in the app — existing modules and marks are untouched.

## state model

`%steward` is released and loads a `versioned-state` union. The released shape remains `state-0`; fresh installs and migrated agents use the current `state-1`:

```
state-0 (%0, released)
  owner       (unit ship)        shared owner config; ~ = inert
  bots        (set ship)         owner-side trusted lens bots
  lens        state:v1:lens      stored lens run records
  gateway     state:v1:gateway   liveness + auto-reply bookkeeping

state-1 (%1, current)
  owner       (unit ship)        copied unchanged from state-0
  bots        (set ship)         copied unchanged from state-0
  lens        state:v1:lens      copied unchanged from state-0
  gateway     state:v1:gateway   copied unchanged from state-0
  automation  state:v1:automation
    mirror    (map ship (map @t task))   per-ship ID-keyed task maps
```

The automation `mirror` holds one entry per ship: the **local projection** lives under `our`, written only by accepted `%project` actions, and each **mirrored remote bot** lives under its own ship, written only by facts from the subscription to that bot. The writers are disjoint by key, so the two never collide. Every entry follows the same presence rule: absent until its first projection or snapshot arrives, present (possibly empty) afterward — an empty entry means "synced, zero tasks", an absent one means "never synced". `state-1` is unreleased, so this shape replaced the earlier flat task map in place with no extra state version; `state-0-to-1` is unchanged (it initializes automation from the bunt, which yields an empty mirror).

`owner` is shared: the lens module sends runs to it, and the gateway module treats its DMs as owner activity worth auto-replying to. `bots` is the owner-side allowlist of ships permitted to fan lens runs in (see the `%entry` gate below); managed via the core `%trust-bot`/`%untrust-bot` pokes.

`on-load` decodes the persisted vase as `versioned-state`. A current `%1` state is restored unchanged. Loading a released `%0` state runs the explicit `state-0-to-1` migration: `owner`, `bots`, `lens`, and `gateway` are copied unchanged, and `automation` starts with an empty mirror. Migration does not auto-subscribe an already-trusted bot set — mirroring starts only from an explicit `%trust-bot` poke. `on-save` always writes the current `state-1` shape, so a migrated state remains current on later save/load cycles. A malformed or unrecognized persisted state fails visibly during decode; it is not replaced with bunt state. This is intentional protection against silent loss of released Steward data.

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

Tracks the liveness of an external harness process and sends offline DM auto-replies on the bot's behalf while it's down — the part the harness can't do for itself, since no harness code runs during downtime. Ported from the former standalone `%gateway-status` agent (now a thin proxy; see `backend/desk/app/gateway-status.md`).

The harness reports its lifecycle via the gateway action: `%gateway-start` (with a `boot-id` and a lease expiry), periodic `%gateway-heartbeat`s that extend the lease, and a graceful `%gateway-stop`. A behn timer on `/gateway/lease-check` fires at the lease expiry; if no heartbeat renewed it, the gateway is marked `%down`. `boot-id` matching distinguishes graceful-stop recovery from crash recovery exactly as in the original agent (stop clears `boot-id` so late heartbeats can't revive it; crash/expiry retains it so a delayed heartbeat can).

While the gateway is not live, a DM from the configured `owner` triggers a canned offline auto-reply to that ship (subject to a dedupe on the triggering message key and a `reply-cooldown`). Around stop/start transitions, a "restarting" / "back online" notice is sent to the owner if they messaged within `active-window`. Inbound owner DMs are observed via a subscription to `%activity /v5`.

`owner` is the shared top-level `(unit ship)`, set via the core `%configure`. This matches `%gateway-status`'s original single-owner model. The gateway action's own `%configure` carries only timing (`active-window`, `reply-cooldown`); the owner is set once at the core level.

## module: automation

Stores the latest complete OpenClaw cron definition set successfully submitted by the local harness, and propagates it bot → owner → client. OpenClaw remains authoritative for scheduling and execution; this module is a durable, locally readable, best-effort mirror and must not be treated as continuously fresh while the harness is offline or reconciliation is failing.

Like lens, one agent serves two roles. On the **bot ship**, an accepted `%project` writes the local projection and broadcasts it on the projection feed `/v1/automation/tasks`, which admits the configured owner cross-ship. On the **owner ship**, `%trust-bot`/`%untrust-bot` drive a subscription per trusted bot, whose facts maintain that bot's mirror entry; the whole mirror is re-broadcast to local clients on `/v1/automation/mirror` and scriable at `/x/v1/automation/mirror`. A self-owned bot (`owner` equal to `our`) serves both roles with no self-subscription: `%project` writes `mirror[our]` directly and the client feed reads it like any other entry.

The v1 state is `mirror=(map ship (map @t task))` (see the [state model](#state-model) for the per-entry writer and presence rules). The OpenClaw job ID is used only as the inner map key. A stored `task` value has no ID field, so the ID is neither duplicated in state nor inside the JSON value returned by the scry. Every supported definition field is optional and retains its presence or absence:

| Task field | Hoon value | JSON field |
|------------|------------|------------|
| agent assignment | `(unit @t)` | `agentId` |
| display metadata | `(unit @t)` for name and description | `name`, `description` |
| enabled state | `(unit ?)` | `enabled` |
| schedule | `(unit cron-schedule)` | `schedule` |
| execution target | `(unit @t)` for each value | `sessionTarget`, `wakeMode` |
| payload definition | optional `kind` and `message` | `payload` |
| definition timestamps | `(unit @da)` for each value | `createdAtMs`, `updatedAtMs` |

Supported schedules are `cron` (`expr`, `tz`, and `staggerMs`), `at` (`at`), and `every` (`everyMs` and `anchorMs`). Millisecond duration and timestamp fields cross the JSON boundary as non-negative integer milliseconds. Pinned OpenClaw returns an `at` timestamp as ISO text; the TypeScript normalizer validates and converts it to Unix milliseconds before `%steward` receives it.

### projection behavior

The inbound action, the two feed updates, and the two scry maps use separate, independently versioned marks so their JSON shapes can evolve separately. `%steward-automation-action-1` accepts one action, `%project`, from the local Gall source only (`src.bowl == our.bowl`). Its JSON shape is:

```json
{
  "project": {
    "tasks": [
      {
        "id": "job-id",
        "agentId": "main",
        "name": "Daily status",
        "enabled": false,
        "schedule": {
          "kind": "cron",
          "expr": "0 9 * * *",
          "tz": "UTC"
        },
        "payload": {
          "kind": "agentTurn",
          "message": "Send the daily status."
        }
      }
    ]
  }
}
```

The list is the complete projection, not a delta. The action mark parses and validates the JSON fields, while `au-build-task-map` rejects duplicate IDs and constructs the entire replacement map before the agent assigns it to state. Any invalid field, unsupported schedule, duplicate ID, foreign source, or other validation failure leaves the previous map unchanged — the crash fires before any state change or fact, so a rejected projection emits nothing. A valid action replaces `mirror[our]` in one state transition: omitted IDs are removed, an empty `tasks` list clears the projection, and repeating the same logical snapshot produces the same state without duplicate records. After ingestion, each inbound `id` exists only as its map key.

An equal projection against an existing entry is a complete no-op: no state write, no facts on either feed — the harness reconciler re-reads on every `cron_changed` (including execution-only events), and those re-submissions must be silent. Equal-but-absent is the exception: the very first projection creates the `mirror[our]` entry even when its task list is empty. A first projection is announced to clients as one snapshot fact rather than deltas (even when empty), while the projection feed emits its ordinary diff against the empty map — `%set` per task, nothing for a first empty projection. Once the entry exists, a changed projection emits per-task deltas on both feeds, described below.

Automation intentionally has no task mutation surface — tasks change only through the harness's `%project` — and excludes cron execution state, execution events, run history, delivery data, session keys, `deleteAfterRun`, and other runtime-only OpenClaw fields. Those values do not enter the Hoon task type, the automation facts, or the JSON scries.

### projection feed: `/v1/automation/tasks`

The bot-side broadcast — the one watch path in the agent that admits a cross-ship source: the configured `owner` (plus the local ship). On subscribe, the new subscriber alone receives one initial `%steward-automation-update-1` `%tasks` fact carrying the complete current projection, including when it is empty. When an accepted `%project` changes the stored map, `au-core` diffs old vs new and gives a `%set` fact per added or changed ID and a `%del` fact per removed ID; an equal projection gives total silence. The facts carry no ship identity — a subscriber attributes the feed to the ship it subscribed to, which Gall authenticates, rather than trusting a payload field a peer could fill arbitrarily. When core `%configure` replaces the owner, the previous owner is kicked off this path (the local ship is always permitted and never kicked; kicking a ship with no subscription is harmless).

### owner-side mirroring

The owner's subscriptions are driven by the core `%trust-bot`/`%untrust-bot` pokes:

- **`%trust-bot`** watches the bot's `/v1/automation/tasks` on wire `/automation/tasks/(scot %p bot)`. The watch is guarded on subscription liveness in `wex.bowl` — not trust-set membership — so re-poking `%trust-bot` is an idempotent "ensure subscribed": a no-op while a subscription is live, a repair after a nacked watch. Subscribing does not create a mirror entry; a bot becomes mirrored only when its first snapshot fact arrives.
- **`%untrust-bot`** leaves the subscription unconditionally (a `%leave` with no live subscription is harmless), deletes the bot's mirror entry, and emits `%gone` on the client feed — but only if the entry existed, so untrusting a bot before its first snapshot leaves nothing behind and emits nothing. The mirror is current state, not history: a stale entry for an untrusted bot would misrepresent "bots we manage" (contrast lens, which keeps runs on untrust because runs are history).
- Trusting or untrusting the **local ship** is an automation no-op: there is never a self-subscription, and `mirror[our]` is `%project`-owned, untouched by trust changes.

Every received fact is attributed to the ship in the subscription wire, never to a payload field. A `%tasks` snapshot atomically replaces (and creates) that bot's entry, so any missed-delta window — kick, revive, upgrade — self-heals on the next snapshot; a snapshot equal to the stored entry changes nothing and emits nothing. `%set` upserts and `%del` removes within the entry; `%del` of an unknown ID is a no-op (the snapshot-replace path can legitimately race a delta in flight), and any delta for a ship with no mirror entry is ignored rather than creating one. On `%kick`, the owner resubscribes iff the bot is still trusted. A watch-nack is slogged and otherwise ignored — mirrored state is preserved, and the manual recovery is re-poking `%trust-bot`.

### client feed: `/v1/automation/mirror`

The local-only client broadcast, serving the mirror itself. On subscribe, the new subscriber alone receives one `%steward-automation-mirror-1` `%tasks` snapshot fact per mirror entry, each attributed to its ship; an empty mirror gives no initial facts. Thereafter every mirror mutation re-emits on the path as a `mirror-update`:

- a bot's snapshot or delta facts, attributed to the wire's bot;
- an accepted `%project`, attributed to `our` — the first accepted projection announces the entry as one snapshot (even when empty), later changes flow as per-task `%set`/`%del` deltas;
- an untrust deletion, as `%gone` — distinct on the wire from an empty `%tasks` snapshot, because presence semantics distinguish "synced, zero tasks" from "entry removed".

A received snapshot or an accepted `%project` that leaves the stored entry unchanged produces no client facts. A subscribed client applying facts in order reproduces the mirror.

### OpenClaw reconciliation

The implementation targets pinned OpenClaw `2026.5.28`, which provides `gateway_start`, `cron_changed`, `gateway_stop`, and `getCron()`, but not `cron_reconciled`. On `gateway_start` and on every `cron_changed` action—including execution-related `started` and `finished` actions—the Tlon plugin calls `getCron().list({ includeDisabled: true })`, normalizes the complete result, and submits one `%project` poke. A genuinely successful empty list therefore clears the projection; unavailable cron access or a failed read does not masquerade as an empty list.

The v1 adapter uses one process-global monitor connection slot, so projection is enabled only when exactly one Tlon account is runnable (enabled with ship, URL, and code configured). Additional disabled or incomplete entries do not disable projection. With zero or multiple runnable accounts, gateway-start and cron-change hooks start no projection work; a one-to-many transition stops the active reconciliation epoch on the next trigger and preserves the last stored snapshots instead of targeting whichever monitor most recently published its connection.

Reconciliation work is serialized so the worker does not deliberately start overlapping snapshots. Triggers that arrive while listing or waiting for poke acknowledgement are coalesced into one follow-up read using the latest cron accessor. Cron access, normalization, connection, read, and poke-acknowledgement failures retry the complete operation after a delay while the gateway epoch remains active. Each read-and-submit attempt has a 30-second local deadline so a promise that never settles cannot permanently own the process-lifetime worker. A timed-out list is fenced before submission, and late promise rejection remains observed. Until a later operation succeeds, the ship retains its last successful projection.

`gateway_stop` cancels retry delays, abandons the current operation wait, rejects queued work, and prevents new cron-change work without clearing Steward state. An epoch check immediately before invoking the poke adapter prevents a list from an ended gateway epoch from starting a stale submission. A later `gateway_start` begins a fresh epoch and complete read without waiting for an abandoned old-epoch promise to settle. The local deadline cannot revoke a remote side effect after a poke has already been issued; acknowledgement routing and transport behavior must account for that uncertain-outcome boundary. The reconciler itself lives in process-shared state and is reused across OpenClaw discovery, full activation, and prewarm registration passes; each pass binds its own hooks to that one process-lifetime worker. Projection errors and cron telemetry errors are observed independently, so neither path suppresses the other.

These triggers repair missed changes when a later complete operation succeeds, but they do not provide exact continuous freshness. A process crash, missed event, offline OpenClaw instance, or repeated failure can leave the mirror stale.

## poke surface

Four inbound marks, each ownership-gated to admit exactly the right source.

### `%steward-action-1` (core config) — `src == our`

```json
{ "configure": { "owner": "~sampel-palnet" } }
```

```
[%configure owner=ship]               top-level: set the shared owner
[%trust-bot ship=ship]                add a ship to the trusted-bots set
[%untrust-bot ship=ship]              remove a ship from the trusted-bots set
```

`%trust-bot`/`%untrust-bot` manage the owner-side `bots` allowlist that gates lens `%entry` fan-in. Trust is explicit and ship-class-agnostic — a bot may be a planet, moon, comet, star, or galaxy, and moon sponsorship is **not** an auto-trust.

The same pokes also drive the [owner-side automation mirror](#owner-side-mirroring): `%trust-bot` ensures a subscription to the bot's `/v1/automation/tasks` (idempotent, guarded on `wex.bowl`), and `%untrust-bot` leaves it and deletes that bot's mirror entry. Both are automation no-ops for the local ship. `%configure` with a new owner additionally kicks the replaced owner off `/v1/automation/tasks`.

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

### `%steward-automation-action-1` (automation) — `src == our`

Only the local harness may replace the automation projection.

```
[%project tasks=(list identified-task:v1:automation)]
```

Each `identified-task` is `[id=@t task]` on the noun side. The mark's JSON form and complete-replacement behavior are described under [projection behavior](#projection-behavior). A `%project` that changes `mirror[our]` also emits facts on both automation feeds.

## subscription surface

- `/v1/lens` (local only, `?> =(src our)`): `%steward-lens-update-1` facts (`update:v1:lens`, a tagged union) — `%entry` (a stored run, one per insert; the owner-side client reads these) and `%retry-requested` (emitted on the bot ship for its local gateway to re-dispatch). No initial backfill fact — clients scry `/x/v1/lens/recent` for backfill.
- `/v1/gateway` (local only): `%steward-gateway-update-1` facts (`update:v1:gateway`) — `%status` (on lifecycle transitions, plus an initial fact on subscribe), `%owner-activity`, and `%auto-reply`.
- `/v1/automation/tasks` (local **or** configured owner): `%steward-automation-update-1` facts (`update:v1:automation`) — one initial `%tasks` snapshot on subscribe (including when empty), then un-attributed `%set`/`%del` deltas whenever an accepted `%project` changes the projection. See [projection feed](#projection-feed-v1automationtasks).
- `/v1/automation/mirror` (local only): `%steward-automation-mirror-1` facts (`mirror-update:v1:automation`) — one initial `%tasks` snapshot per mirror entry on subscribe (none when the mirror is empty), then bot-attributed snapshots, `%set`/`%del` deltas, and `%gone` entry removals as the mirror changes. See [client feed](#client-feed-v1automationmirror).

Bare `/v1/automation` binds nothing — the two feeds are distinct resources, so neither sits at the namespace root.

The projection-feed update grows to JSON with no ship field, one shape per variant (`%tasks` carries the bare ID-keyed task object under `tasks`):

```json
{ "tasks": { "job-id": { "agentId": "main", "enabled": false } } }
{ "set": { "id": "job-id", "task": { "agentId": "main", "enabled": false } } }
{ "del": { "id": "job-id" } }
```

The mirror update carries the same task shapes plus a `bot` attribution (`scot %p` / `se %p` on the wire), and the `%gone` variant carries only the ship:

```json
{ "tasks": { "bot": "~zod", "tasks": { "job-id": { "agentId": "main" } } } }
{ "set": { "bot": "~zod", "id": "job-id", "task": { "agentId": "main" } } }
{ "del": { "bot": "~zod", "id": "job-id" } }
{ "gone": { "bot": "~zod" } }
```

## scry surface

Dotket scries execute locally against the agent's current state and do not carry a foreign caller source to authorize. Lens scries return the `%steward-lens-update-1` mark so the HTTP client reads them as JSON.

- `/x/v1/lens/recent` → `[%recent entries]` — newest 50 runs across all bots, for backfill. Grows to `{ "recent": [ entry, … ] }` (a JSON array of entry objects).
- `/x/v1/lens/recent/[count]` → `[%recent entries]` — newest `count` runs.
- `/x/v1/lens/since/[da]` → `[%recent entries]` — every run with `received >= da`, newest first; paginate history by passing the oldest `received` from the last page.
- `/x/v1/lens/run/[ship]/[id]` → `[%entry entry]`, or empty (`[~ ~]`) when absent.
- `/x/v1/gateway/status` → `%noun` `[status:v1:gateway (unit @da)]` — current liveness and lease expiry.
- `/x/v1/gateway/owner-activity` → `%noun` `@da` — timestamp of the most recent owner DM.
- `/x/v1/automation/tasks` → `%steward-automation-task-map-1` `(map @t task:v1:automation)` — the complete latest accepted local automation projection. Reads `mirror[our]` (the empty map when the entry is absent); the returned JSON contract is unchanged from when the projection was a flat state field.
- `/x/v1/automation/mirror` → `%steward-automation-mirror-map-1` `(map ship (map @t task:v1:automation))` — the complete per-ship mirror, for client backfill.

The automation task-map mark grows to a JSON object whose property names are the sole serialized task IDs:

```json
{
  "tasks": {
    "job-id": {
      "agentId": "main",
      "enabled": false,
      "schedule": { "kind": "every", "everyMs": 60000 }
    }
  }
}
```

With no stored tasks the exact JSON shape is `{ "tasks": {} }`. Task values use the supported OpenClaw field names listed above, omit absent optional fields, and never contain `id` or runtime cron state.

The mirror-map mark grows to the bare ship-keyed object — no wrapper key, since ship keys are self-identifying — with each entry's value in the same ID-keyed task shape:

```json
{
  "~zod": {
    "job-id": {
      "agentId": "main",
      "enabled": false
    }
  }
}
```

With an empty mirror the exact JSON shape is `{}`.

`entry` is `[bot=ship id=@t run]`. The `%entry` update grows to JSON for Eyre, embedding the stored payload directly:

```json
{ "entry": { "bot": "~zod", "id": "...", "complete": true, "received": "~2026.6.10..12.00.00..0000", "payload": { ... run record ... } } }
```

## lifecycle and invariants

- `on-init` creates `state-1`, subscribes to `%activity /v5` for the gateway module, seeds the default lens retention cap, and leaves automation empty. There is no lens prune timer (retention is count-only, enforced on insert/configure).
- `on-load` decodes `versioned-state`: current `state-1` loads directly and released `state-0` migrates through `state-0-to-1`. Decode or migration failure is visible and never resets to bunt. `on-save` writes `state-1`.
- Wires: lens send on `/lens/send/[owner-p]/[id-t]`, lens retry relay on `/lens/retry/[bot-p]/[id-t]`, the gateway lease timer on `/gateway/lease-check`, gateway auto-reply/notice DM sends on `/gateway/dm/send`, and the owner-side automation watches on `/automation/tasks/[bot-p]` — everything arriving on an automation wire is attributed to the ship in the wire. The `%activity` subscription is re-watched on `%kick`; an automation watch is re-watched on `%kick` iff its bot is still trusted. Poke/DM nacks are logged and ignored (Ames retries); a nacked automation watch is slogged and left for a `%trust-bot` re-poke to repair.
- `on-watch` auth is per-path: lens, gateway, and `/v1/automation/mirror` require `=(src our)`; `/v1/automation/tasks` also admits the configured owner. Rejection is a crash (watch nack). Dotket `on-peek` calls execute locally against current state without caller-source authorization. Core, gateway, and automation pokes are local only; lens applies its per-action source rules to admit trusted bot runs and owner relays.

## integration notes

- The gateway (openclaw-tlon / hermes) pokes core `%configure` on monitor activation and `%steward-lens-action-1` run milestones from its run event stream. Lens recording is config-gated on the gateway side (`channels.tlon.contextLens`).
- Clients store runs locally, subscribe to `/v1/lens` for live updates, and scry on cache miss. The channel post pointer blob carries `botShip` so the client knows which `[bot id]` key to look up.
- The gateway's HTTP/SSE routes remain an optional desktop enhancement for fine-grained live streaming; `%steward`'s lens module is the durable source of truth.
- The `%steward-lens-*` marks replace the former `%context-lens-*` marks. There is no separate cross-ship `signal` mark — sending reuses `%steward-lens-action-1`, gated by ownership.
