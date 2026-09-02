# %steward

Ship-native umbrella agent: the durable, always-on ship-side half of an ephemeral bot harness. A harness (openclaw, hermes, or any future harness) talks to one agent regardless of which features it uses.

## concept: modules

`%steward` is built around **modules**, each a cohesive feature area. Each module is independently versioned and owns its own protocol types and mark family, so modules can evolve without dragging each other along:

| Module       | sur file                         | marks                                                                    |
|--------------|----------------------------------|--------------------------------------------------------------------------|
| (core)       | `sur/steward.hoon`               | `%steward-action-1`                                                      |
| `lens`       | `sur/steward/lens.hoon`          | `%steward-lens-action-1`, `%steward-lens-update-1`                       |
| `gateway`    | `sur/steward/gateway.hoon`       | `%steward-gateway-action-1`, `%steward-gateway-update-1`                 |
| `automation` | `sur/steward/automation.hoon`    | `%steward-automation-action-1`, `%steward-automation-update-1`, `%steward-automation-tasks-1` |

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
    tasks     (map ship tasks)   per-ship ID-keyed task maps (+$ tasks is (map @t task))
    requests  (map request-id incoming-request)   owner-side in-flight edits (see edit loop)
    pending   (map request-id pending-command)    bot-side commands awaiting the harness
```

The automation `tasks` map holds one entry per ship: the **local projection** lives under `our`, written only by accepted `%project` actions, and each **mirrored remote bot** lives under its own ship, written only by facts from the subscription to that bot. The writers are disjoint by key, so the two never collide. Every entry follows the same presence rule: absent until its first projection or snapshot arrives, present (possibly empty) afterward — an empty entry means "synced, zero tasks", an absent one means "never synced". `state-1` is unreleased, so this shape replaced the earlier flat task map in place with no extra state version, and the edit loop's `requests` and `pending` maps were added to it the same way; `state-0-to-1` is unchanged (it initializes automation from the bunt, which yields empty maps). Both request maps are transient bookkeeping swept on a timer, never durable data.

`owner` is shared: the lens module sends runs to it, and the gateway module treats its DMs as owner activity worth auto-replying to. `bots` is the owner-side allowlist of ships permitted to fan lens runs in (see the `%entry` gate below); managed via the core `%trust-bot`/`%untrust-bot` pokes.

`on-load` decodes the persisted vase as `versioned-state`. A current `%1` state is restored unchanged. Loading a released `%0` state runs the explicit `state-0-to-1` migration: `owner`, `bots`, `lens`, and `gateway` are copied unchanged, and `automation` starts with an empty task map. Migration does not auto-subscribe an already-trusted bot set — mirroring starts only from an explicit `%trust-bot` poke. `on-save` always writes the current `state-1` shape, so a migrated state remains current on later save/load cycles. A malformed or unrecognized persisted state fails visibly during decode; it is not replaced with bunt state. This is intentional protection against silent loss of released Steward data.

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

## module: automation

Stores the latest complete OpenClaw cron definition set successfully submitted by the local harness, and propagates it bot → owner → client. OpenClaw remains authoritative for scheduling and execution; this module is a durable, locally readable, best-effort mirror and must not be treated as continuously fresh while the harness is offline or reconciliation is failing.

Like lens, one agent serves two roles, and one feed serves both. On the **bot ship**, an accepted `%project` writes the local projection (the `our` entry) and announces the change on `/v1/automation/tasks`, which admits the configured owner cross-ship. On the **owner ship**, `%trust-bot`/`%untrust-bot` drive a subscription per trusted bot, whose facts maintain that bot's entry; every applied change re-emits on the owner's own `/v1/automation/tasks` for its clients, and the whole map is scriable at `/x/v1/automation/tasks`. A self-owned bot (`owner` equal to `our`) serves both roles with no self-subscription: `%project` writes the `our` entry directly and the feed serves it like any other entry.

The v1 state is `tasks=(map ship tasks)` with `+$  tasks  (map @t task)` (see the [state model](#state-model) for the per-entry writer and presence rules). The OpenClaw job ID is used only as the inner map key. A stored `task` value has no ID field, so the ID is neither duplicated in state nor inside the JSON value returned by the scry. Every supported definition field is optional and retains its presence or absence:

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

The inbound action and the feed/scry update use separate, independently versioned marks so their JSON shapes can evolve separately. `%steward-automation-action-1` accepts one action, `%project`, from the local Gall source only (`src.bowl == our.bowl`). Its JSON shape is:

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

The list is the complete projection, not a delta. The action mark parses and validates the JSON fields, while `au-build-task-map` rejects duplicate IDs and constructs the entire replacement map before the agent assigns it to state. Any invalid field, unsupported schedule, duplicate ID, foreign source, or other validation failure leaves the previous map unchanged — the crash fires before any state change or fact, so a rejected projection emits nothing. A valid action replaces the `our` entry in one state transition: omitted IDs are removed, an empty `tasks` list clears the projection, and repeating the same logical snapshot produces the same state without duplicate records. After ingestion, each inbound `id` exists only as its map key.

An equal projection against an existing entry is a complete no-op: no state write, no facts — the harness reconciler re-reads on every `cron_changed` (including execution-only events), and those re-submissions must be silent. Equal-but-absent is the exception: the very first projection creates the `our` entry even when its task list is empty. Entry creation is inexpressible as task-level deltas, so the first accepted projection announces itself on the feed as one fresh full `%tasks` snapshot (even when empty); once the entry exists, a changed projection emits per-task `%set`/`%del` deltas naming the local ship, described below.

The task map has exactly one writer per entry: the harness's `%project` for `our`, a bot's subscription for that bot. The [edit loop](#edit-loop) never writes it — an edit is relayed to the harness and becomes visible only through the harness's next `%project`. Automation excludes cron execution state, execution events, run history, delivery data, session keys, `deleteAfterRun`, and other runtime-only OpenClaw fields. Those values do not enter the Hoon task type, the automation facts, or the JSON scries.

### feed: `/v1/automation/tasks`

The single automation feed, on every ship — the one watch path in the agent that admits a cross-ship source: the configured `owner` (plus the local ship). On subscribe, the new subscriber alone receives one initial `%steward-automation-update-1` `%tasks` fact carrying the complete ship-keyed map, including when it is empty (the fact is given on the empty path list, targeting only the new subscriber). Thereafter every applied change re-emits on the path, each fact naming the ship whose entry it touches:

- a changed entry, as per-task `%set`/`%del` deltas — `au-core` diffs old vs new and gives a `%set` fact per added or changed ID and a `%del` fact per removed ID, whether the change came from an accepted `%project` (attributed to `our`) or from a trusted bot's subscription (attributed to that bot);
- an entry appearing — inexpressible as task deltas — as one fresh full `%tasks` snapshot to every subscriber; snapshots are always full replacements;
- an entry deletion — an untrust, a received snapshot lacking the bot's entry, or an applied `%gone` — as `%gone`, distinct on the wire from an empty `%tasks` snapshot, because presence semantics distinguish "synced, zero tasks" from "entry removed".

An equal `%project`, or a received snapshot that leaves the stored entry unchanged, gives total silence. A subscribed client applying facts in order reproduces the stored map. When core `%configure` replaces the owner, the previous owner is kicked off this path (the local ship is always permitted and never kicked; kicking a ship with no subscription is harmless).

### owner-side mirroring

The owner's subscriptions are driven by the core `%trust-bot`/`%untrust-bot` pokes:

- **`%trust-bot`** watches the bot's `/v1/automation/tasks` on wire `/automation/tasks/(scot %p bot)`. The watch is guarded on subscription liveness in `wex.bowl` — not trust-set membership — so re-poking `%trust-bot` is an idempotent "ensure subscribed": a no-op while a subscription is live, a repair after a nacked watch. Subscribing does not create an entry; a bot becomes mirrored only when its first snapshot fact arrives.
- **`%untrust-bot`** leaves the subscription unconditionally (a `%leave` with no live subscription is harmless), deletes the bot's entry, and emits `%gone` on the feed — but only if the entry existed, so untrusting a bot before its first snapshot leaves nothing behind and emits nothing. The mirror is current state, not history: a stale entry for an untrusted bot would misrepresent "bots we manage" (contrast lens, which keeps runs on untrust because runs are history).
- Trusting or untrusting the **local ship** is an automation no-op: there is never a self-subscription, and the `our` entry is `%project`-owned, untouched by trust changes.

Application is **wire-ship-scoped**: every received fact arrives on a wire naming its bot, and only content attributed to that ship is applied — the receiver-side transitive-relay guard. On a `%tasks` snapshot the owner replaces (and creates) that bot's entry with **the bot's own entry in the received map**, deleting the local entry when the snapshot lacks it (the wiped-bot repair) — entries in the map naming other ships are ignored. Any missed-delta window — kick, revive, upgrade — therefore self-heals on the next snapshot, and a snapshot equal to the stored entry changes nothing and emits nothing. `%set` upserts and `%del` removes within the entry; `%del` of an unknown ID is a no-op, a delta for a ship with no entry is ignored rather than creating one, and a delta or `%gone` naming any ship other than the wire's bot is ignored. On `%kick`, the owner resubscribes iff the bot is still trusted. A watch-nack is slogged and otherwise ignored — mirrored state is preserved, and the manual recovery is re-poking `%trust-bot`.

### edit loop

The owner creates, updates, and deletes a bot's tasks through a request/response loop laid out on the ACUR pattern (see channels, groups, notes, and tloncorp/hoon-reference): `a-automation` local-only actions, a `c-automation` owner-gated command, the existing `update` as `u-automation`, and a notes-style per-request `response`. Every edit carries a `request-id` (`@uv`, minted from entropy when the client supplies none) and terminates in exactly one typed `response-body`: `%created id`, `%updated id`, `%deleted id`, `%error type message`, or `%pending status`. `action-error` is `%not-authorized`, `%not-found`, `%invalid`, `%harness-offline`, `%harness-error`, `%unknown`. Errors are returned as data, never as a crash, so the client can tell them apart.

The verb is flat and reuses `task`, whose all-optional fields make `%update` a natural patch:

```
[%create =task]
[%update id=@t =task]
[%delete id=@t]
```

**Steward is a pure relay.** No hop writes the task map. OpenClaw applies the edit, fires `cron_changed`, the plugin re-projects, and the mirror emits `%set`/`%del`; the response tells the client "accepted or rejected", the mirror delta confirms.

The hops, and the response walking back the same way:

1. **client → owner** (`a-automation` `%edit rid bot edit`, or `POST /steward/~/v1/automation`). The owner records an `incoming-request` (bot, held HTTP id, poke status, result, `final-at`, `fetched`).
2. **owner → bot.** Watch the bot's `/v1/automation/request/<owner>/<uv>` first so the response cannot be missed, then poke `c-automation` `%edit rid edit` under `%steward-automation-command-1`, then arm a 20-second behn wake. The owner always pokes the bot; gall loops the poke back when the bot is this ship, so a self-owned bot takes the same path. Wires are `/automation/req/<bot>/<uv>/{watch,poke,wake}`.
3. **bot → harness.** The bot admits the command only from its configured owner. If nothing local is subscribed to `/v1/automation/harness` (checked in `sup.bowl`), it answers `%error %harness-offline` at once. Otherwise it records a `pending-command` and gives a `dispatch` (`[rid edit]`) fact on the harness feed under `%steward-automation-dispatch-1`. A (re)subscribing harness receives every outstanding command, oldest first, so a plugin restart resumes in-flight work.
4. **harness → bot** (`a-automation` `%finalize rid body`, local only). The bot gives the `response` on the requester's per-request path under `%steward-automation-response-1` and drops the pending record. A finalize for an unknown id is ignored. There is no bot-side deadline: a late answer still completes the request.
5. **bot → owner → client.** On the response fact the owner finalizes: stores the body, gives the `response` on the local `/v1/automation/request/<uv>` path, completes a held HTTP request exactly once, and leaves the bot watch. A watch nack finalizes `%not-authorized`; a poke nack finalizes `%unknown`; a poke ack records `%acked`.

**Pending.** When the 20-second wake fires before a terminal response, the owner completes the held HTTP request with `%pending status`, gives the same on the local path, and keeps the record. A late response overwrites it and is served by GET and on the per-request path, which replays a stored result at subscribe time.

**Sweep.** `/automation/cleanup` fires every five minutes on both sides. Terminal records go once fetched or after a day; a `%pending` result and a bot-side `pending-command` each live an hour; a record with no result yet is left for its wake.

#### HTTP surface

`%steward` binds `/steward` in Eyre on init and on every load. Every route requires Eyre's authenticated session; a request id is not a capability, so GET is gated like POST.

- `POST /steward/~/v1/automation` — body `{ "requestId"?: "0v…", "bot": "~ship", "action": { "create": { …task } } | { "update": { "id": "…", …task } } | { "delete": { "id": "…" } } }`. Held open until the terminal response or the pending wake; the body is the `response` JSON. Malformed input is a 400.
- `GET /steward/~/v1/automation/request/<uv>` — the current record as `response` JSON (`%pending` with the poke status while in flight); marks it fetched. Unknown is 404.
- `GET /steward/~/v1/automation/tasks` — the mirror, as the tasks scry's JSON.

The `response` JSON is type-discriminated like the notes v1 envelope, with the message as an array of strings:

```json
{ "requestId": "0v4.jd3o0", "body": { "type": "created", "id": "job-id" } }
{ "requestId": "0v4.jd3o0", "body": { "type": "error", "errorType": "harness-offline", "message": [] } }
{ "requestId": "0v4.jd3o0", "body": { "type": "pending", "status": "acked" } }
```

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

The same pokes also drive the [owner-side automation mirror](#owner-side-mirroring): `%trust-bot` ensures a subscription to the bot's `/v1/automation/tasks` (idempotent, guarded on `wex.bowl`), and `%untrust-bot` leaves it and deletes that bot's entry. Both are automation no-ops for the local ship. `%configure` with a new owner additionally kicks the replaced owner off `/v1/automation/tasks`.

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

### `%steward-automation-action-1` (automation, `a-automation`) — `src == our`

Every variant is local-only: the harness and the local client.

```
[%project tasks=(list identified-task:v1:automation)]   harness: replace the projection
[%edit =request-id bot=ship =edit]                      client: edit one of .bot's tasks
[%finalize =request-id body=response-body]              harness: report a dispatched command's outcome
```

Each `identified-task` is `[id=@t task]` on the noun side. The mark's JSON form and complete-replacement behavior for `%project` are described under [projection behavior](#projection-behavior). A `%project` that changes the `our` entry also emits facts on `/v1/automation/tasks`. `%edit` and `%finalize` are the [edit loop](#edit-loop); their JSON forms are `{ "edit": { "requestId", "bot", "action" } }` and `{ "finalize": { "requestId", "body" } }`.

### `%steward-automation-command-1` (automation, `c-automation`) — `src == owner`

The owner → bot leg of the edit loop. Noun only; it never crosses a JSON boundary.

```
[%edit =request-id =edit]
```

### `%handle-http-request` — Eyre

The owner ship's HTTP surface for the edit loop, described under [HTTP surface](#http-surface).

## subscription surface

- `/v1/lens` (local only, `?> =(src our)`): `%steward-lens-update-1` facts (`update:v1:lens`, a tagged union) — `%entry` (a stored run, one per insert; the owner-side client reads these) and `%retry-requested` (emitted on the bot ship for its local gateway to re-dispatch). No initial backfill fact — clients scry `/x/v1/lens/recent` for backfill.
- `/v1/gateway` (local only): `%steward-gateway-update-1` facts (`update:v1:gateway`) — `%status` (on lifecycle transitions, plus an initial fact on subscribe), `%owner-activity`, and `%auto-reply`.
- `/v1/automation/tasks` (local **or** configured owner): `%steward-automation-update-1` facts (`update:v1:automation`) — one initial `%tasks` snapshot of the complete ship-keyed map on subscribe (including when empty), then ship-attributed `%set`/`%del` deltas, fresh full `%tasks` snapshots when an entry appears, and `%gone` entry removals. See [feed](#feed-v1automationtasks).

- `/v1/automation/harness` (local only): `%steward-automation-dispatch-1` facts (`dispatch`, `[rid edit]`) — the bot's pending edit commands for its harness; every outstanding command is replayed on subscribe, oldest first.
- `/v1/automation/request/<owner>/<uv>` (the requester named in the path, and only when it is the configured owner): one `%steward-automation-response-1` fact (`response`) when the bot finalizes that request.
- `/v1/automation/request/<uv>` (local only): one `%steward-automation-response-1` fact when the owner finalizes that request; a stored result is replayed at subscribe time.

Bare `/v1/automation` binds nothing — the feed is `tasks`, not the namespace root.

The automation update grows to JSON with one shape per variant. `%tasks` carries the ship-keyed object under `tasks` (each property a `scot %p` ship name, each value that ship's bare ID-keyed task object); the delta variants carry an explicit `ship` field (`scot %p` / `se %p` on the wire), and `%gone` carries only the ship:

```json
{ "tasks": { "~zod": { "job-id": { "agentId": "main", "enabled": false } } } }
{ "set": { "ship": "~zod", "id": "job-id", "task": { "agentId": "main", "enabled": false } } }
{ "del": { "ship": "~zod", "id": "job-id" } }
{ "gone": { "ship": "~zod" } }
```

With no entries at all the snapshot's exact JSON shape is `{ "tasks": {} }`. The field is `ship`, not `bot` — entries belong to ships (the local one included); "bot" is a role.

## scry surface

Dotket scries execute locally against the agent's current state and do not carry a foreign caller source to authorize. Lens scries return the `%steward-lens-update-1` mark so the HTTP client reads them as JSON.

- `/x/v1/lens/recent` → `[%recent entries]` — newest 50 runs across all bots, for backfill. Grows to `{ "recent": [ entry, … ] }` (a JSON array of entry objects).
- `/x/v1/lens/recent/[count]` → `[%recent entries]` — newest `count` runs.
- `/x/v1/lens/since/[da]` → `[%recent entries]` — every run with `received >= da`, newest first; paginate history by passing the oldest `received` from the last page.
- `/x/v1/lens/run/[ship]/[id]` → `[%entry entry]`, or empty (`[~ ~]`) when absent.
- `/x/v1/gateway/status` → `%noun` `[status:v1:gateway (unit @da)]` — current liveness and lease expiry.
- `/x/v1/gateway/owner-activity` → `%noun` `@da` — timestamp of the most recent owner DM.
- `/x/v1/automation/tasks` → `%steward-automation-tasks-1` `(map ship (map @t task:v1:automation))` — the complete per-ship task state, for client backfill. The scry has its own mark — marks are never shared between facts and scries — carrying the raw ship-keyed map.

The automation scry grows to the bare ship-keyed object, each value that ship's ID-keyed task map:

```json
{
  "~zod": {
    "job-id": {
      "agentId": "main",
      "enabled": false,
      "schedule": { "kind": "every", "everyMs": 60000 }
    }
  }
}
```

With no entries at all the exact JSON shape is `{}`. Task values use the supported OpenClaw field names listed above, omit absent optional fields, and never contain `id` or runtime cron state.

`entry` is `[bot=ship id=@t run]`. The `%entry` update grows to JSON for Eyre, embedding the stored payload directly:

```json
{ "entry": { "bot": "~zod", "id": "...", "complete": true, "received": "~2026.6.10..12.00.00..0000", "payload": { ... run record ... } } }
```

## lifecycle and invariants

- `on-init` creates `state-1`, subscribes to `%activity /v5` for the gateway module, seeds the default lens retention cap, and leaves automation empty. There is no lens prune timer (retention is count-only, enforced on insert/configure).
- `on-load` decodes `versioned-state`: current `state-1` loads directly and released `state-0` migrates through `state-0-to-1`. Decode or migration failure is visible and never resets to bunt. `on-save` writes `state-1`.
- Wires: lens send on `/lens/send/[owner-p]/[id-t]`, lens retry relay on `/lens/retry/[bot-p]/[id-t]`, the gateway lease timer on `/gateway/lease-check`, gateway auto-reply/notice DM sends on `/gateway/dm/send`, and the owner-side automation watches on `/automation/tasks/[bot-p]` — everything arriving on an automation wire is applied only for the ship in the wire (facts naming other ships are ignored). The `%activity` subscription is re-watched on `%kick`; an automation watch is re-watched on `%kick` iff its bot is still trusted. Poke/DM nacks are logged and ignored (Ames retries); a nacked automation watch is slogged and left for a `%trust-bot` re-poke to repair.
- `on-watch` auth is per-path: lens and gateway paths require `=(src our)`; `/v1/automation/tasks` also admits the configured owner. Rejection is a crash (watch nack). Dotket `on-peek` calls execute locally against current state without caller-source authorization. Core, gateway, and automation pokes are local only; lens applies its per-action source rules to admit trusted bot runs and owner relays.

## integration notes

- The gateway (openclaw-tlon / hermes) pokes core `%configure` on monitor activation and `%steward-lens-action-1` run milestones from its run event stream. Lens recording is config-gated on the gateway side (`channels.tlon.contextLens`).
- Clients store runs locally, subscribe to `/v1/lens` for live updates, and scry on cache miss. The channel post pointer blob carries `botShip` so the client knows which `[bot id]` key to look up.
- The gateway's HTTP/SSE routes remain an optional desktop enhancement for fine-grained live streaming; `%steward`'s lens module is the durable source of truth.
- The `%steward-lens-*` marks replace the former `%context-lens-*` marks. There is no separate cross-ship `signal` mark — sending reuses `%steward-lens-action-1`, gated by ownership.
