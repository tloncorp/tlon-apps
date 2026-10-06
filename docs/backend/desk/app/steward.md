# %steward

Ship-native umbrella agent: the durable, always-on ship-side half of an ephemeral bot harness. A harness (openclaw, hermes, or any future harness) talks to one agent regardless of which features it uses.

## concept: modules

`%steward` is built around **modules**, each a cohesive feature area. Each module is independently versioned and owns its own protocol types and mark family, so modules can evolve without dragging each other along:

| Module       | sur file                         | marks                                                                    |
|--------------|----------------------------------|--------------------------------------------------------------------------|
| (core)       | `sur/steward.hoon`               | `%steward-action-1`                                                      |
| `lens`       | `sur/steward/lens.hoon`          | `%steward-lens-action-1`, `%steward-lens-update-1`                       |
| `gateway`    | `sur/steward/gateway.hoon`       | `%steward-gateway-action-1`, `%steward-gateway-update-1`                 |
| `automation` | `sur/steward/automation.hoon`    | `%steward-automation-action-1`, `-command-1`, `-dispatch-1`, `-response-1`, `-update-1`, `-tasks-1` |
| `prompts`    | `sur/steward/prompts.hoon`       | `%steward-prompts-action-1`, `-command-1`, `-dispatch-1`, `-response-1`, `-update-1`, `-files-1` |
| `journey`    | —                                | —                                                                        |

Each sur file is versioned on its own (`++v1`), referenced by callers as `action:v1:lens`, `update:v1:gateway`, etc. The core `sur/steward.hoon` carries only cross-cutting config (currently just `%configure`); each module's protocol lives in its own file.

Modules:

| Module       | Purpose                                                                |
|--------------|------------------------------------------------------------------------|
| `lens`       | Per-run bot introspection (folded in from the former `%context-lens`). |
| `gateway`    | Harness liveness tracking + offline DM auto-replies.                   |
| `automation` | Durable best-effort mirror of OpenClaw cron task definitions, propagated bot → owner → client. |
| `prompts`    | Projection of the OpenClaw workspace prompt files, with edits relayed back to the harness. |
| `journey`    | Content-free OpenClaw DM and channel delivery telemetry.                |

The app helper core keeps each module's logic in its own sub-core: `le-core` for lens, `ga-core` for gateway, `au-core` for automation, `po-core` for prompts, and the stateless `jo-core` for journey telemetry. Adding a stateful or protocol-bearing module means a new `sur/steward/<module>.hoon`, its own mark family, and a dispatch arm in the app — existing modules and marks are untouched.

## state model

State is versioned (`state-5` today), defined in the app file; `on-load` migrates older shapes forward one version per step. Cross-cutting config is top level; each module owns its own slice, typed from its own sur file:

```
state-5 (%5, current)
  owner       (unit ship)        shared owner config; ~ = inert
  bots        (set ship)         owner-side trusted lens bots
  lens        state:v1:lens      stored lens run records
  gateway     state:v1:gateway   liveness + auto-reply bookkeeping
  automation  state:v1:automation
    tasks     (map ship tasks)   per-ship ID-keyed task maps (+$ tasks is (map @t task))
    requests  (map request-id incoming-request)   owner-side in-flight edits (see edit loop)
    pending   (map request-id pending-command)    bot-side commands awaiting the harness
    sweep     @da                when the armed cleanup timer wakes
  prompts     state:v1:prompts
    files     (map ship prompts) per-ship file maps: the local projection and mirrored bots
    requests  (map request-id incoming-request)   owner-side in-flight edits
    pending   (map request-id pending-command)    bot-side commands awaiting the harness
    rewatch   (map ship [attempt=@ud wake=@da])   owner-side retries of nacked mirror watches
    sweep     @da                when the armed cleanup timer wakes
```

Migrations so far:

- `%0 → %1`: the gateway slice gained two leading fields — `notify-on-start=?` (an owner-initiated stop is pending) and `last-interaction=@da` (when anyone last engaged the bot). They lead so the migration is a one-line cons, `[| *@da gateway.old]`. A migrated bot whose gateway is already `%up` or `%down` also seeds its `bot-liveness` claim (see the gateway module).
- `%1 → %2`: the automation module arrives with an empty slice. The app keeps the pre-%2 shapes (`state-1`, `state-0`, `gateway-0`) only for `on-load`.
- `%2 → %3`: the gateway slice gained the status-message toggle.
- `%3 → %4`: every stored task gains `delivery`, and every `agentTurn` payload gains `tools-allow`. Both migrate as `~` and the harness's next projection supplies them, since the mirror is derived. A bot-side `pending-command` carries a task inside its `edit`, so pending commands are widened too rather than dropped. The pre-%4 shapes live in the sur under `+v0`, alongside the current ones, with `+widen-task` and `+widen-edit` beside them; `on-load` is their only caller.
- `%4 → %5`: the prompts module arrives with an empty slice, and the automation slice gains `sweep`, the wake time of its armed cleanup timer. Both sweep times start in the past, so the load's reconcile step arms both sweeps and subscribes the trusted set to the new prompts feed. `state-4` (with its `automation-4` slice) and earlier remain only for `on-load`.

The automation `tasks` map holds one entry per ship: the **local projection** lives under `our`, written only by accepted `%project` actions, and each **mirrored remote bot** lives under its own ship, written only by facts from the subscription to that bot. The writers are disjoint by key, so the two never collide. Every entry follows the same presence rule: absent until its first projection or snapshot arrives, present (possibly empty) afterward — an empty entry means "synced, zero tasks", an absent one means "never synced". `state-1` is unreleased, so this shape replaced the earlier flat task map in place with no extra state version; `state-0-to-1` is unchanged (it initializes automation from the bunt, which yields an empty map).

`owner` is shared: the lens module sends runs to it, and the gateway module treats its DMs as owner activity worth auto-replying to. `bots` is the owner-side allowlist of ships permitted to fan lens runs in (see the `%entry` gate below); managed via the core `%trust-bot`/`%untrust-bot` pokes.

`on-load` delegates to `load`, which decodes the persisted vase as `versioned-state` and migrates one version per step (`state-0-to-1` through `state-4-to-5`). Automation's migration never auto-subscribes an already-trusted bot set — its mirroring starts only from an explicit `%trust-bot` poke; the `%4 → %5` prompts step does subscribe them (see the prompts module). `on-save` always writes the current `state-5` shape. A malformed or unrecognized persisted state fails visibly during decode; it is not replaced with bunt state.

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

While the gateway is not live, a DM from the configured `owner` triggers a canned offline auto-reply to that ship (subject to a dedupe on the triggering message key and a `reply-cooldown`). Around stop/start transitions, a "restarting" 🔧 / "back online" ✅ notice is sent to the owner if the bot was **recently active** — within `active-window`, either the owner DM'd it (`last-owner-msg`) or anyone engaged it (`last-interaction`: a group @-mention of the bot, a reply in one of its threads, or a DM from any ship but itself). Plain traffic in channels the bot merely observes does not count. Both signals come from the subscription to `%activity /v5`; the auto-reply stays owner-DM-only.

### owner-initiated restarts

The `reason` on `%gateway-stop` is free text; most stops carry the harness's generic reason (OpenClaw core sends `"gateway stopping"`). A stop whose reason names something the owner did themselves is **owner-initiated** and skips the activity gate — the owner just asked for the restart in the app and would otherwise hear nothing:

| reason         | 🔧 text                                                                      |
| -------------- | ---------------------------------------------------------------------------- |
| `model-change` | "Your Tlon bot is restarting to switch models. I should be back shortly. 🔧" |

An owner-initiated stop also latches `notify-on-start`, so the next `%gateway-start` sends ✅ regardless of activity. The latch is honoured only while the stop is recent (`now - last-stop < ~m15`, evaluated at start — no timer); a restart that takes longer falls back to the activity gate. Start clears the latch either way. There is no dedupe: rapid model cycling sends one 🔧/✅ pair per restart.

### stop-reason marker (hosted)

Hosted bots are restarted by their supervisor (`tlawn.py`), not by anything the ship can see, so the truthful reason has to be handed to the plugin out of band:

- `tlawn.py` sets `TLON_GATEWAY_STOP_REASON_FILE` in the gateway's environment (hosted path `/tmp/tlon-gateway-stop-reason`). Unset ⇒ the plugin never looks for a marker (self-hosted, dev, integration harnesses).
- When a reload is a primary-model change, `tlawn.py` writes the token `model-change` to that file immediately before terminating the gateway; it clears the file at boot, before every write, and after the reload cycle consumes it. The file is created root-owned with `O_CREAT|O_EXCL|O_NOFOLLOW` after an `unlink`, so a path planted by the gateway's uid is never followed.
- The plugin's `gateway_stop` handler reads the marker (regular file, owned by uid 0, mtime under 5 minutes, one token matching `^[a-z][a-z0-9-]{0,63}$`) and passes it as the poke `reason`; otherwise it forwards core's reason unchanged. The plugin never deletes the marker.
- Version skew is safe in both directions: an old plugin sends the generic reason (today's behaviour); an old desk ignores an unknown reason (`reason+so` accepts any cord).

### liveness publication

On every liveness transition the module publishes a `bot-liveness` claim into the bot's own `%contacts` profile (`%contact-action-1` `%self`, wire `/gateway/liveness`): `offline` on `%gateway-stop` and on lease expiry, `online` on `%gateway-start` and on a heartbeat that revives an expired lease. Peers who have met the bot see it as a dimmed avatar / "Bot · Offline" badge. Format, semantics and audience are in [bot-liveness.md](../../../bot-liveness.md).

`owner` is the shared top-level `(unit ship)`, set via the core `%configure`, so a harness sends two pokes at startup: the core `%configure` for the owner, then the gateway `%configure` for timings. The gateway action's own `%configure` carries only timing (`active-window`, `reply-cooldown`); the owner is set once at the core level.

## module: journey

Emits content-free delivery telemetry for OpenClaw bot DMs and new chat/gallery posts and replies. The module watches `%chat /v4` on `/journey/chat` and `%channels /v4` on `/journey/channels`. It checks the relevant `%contacts` profile for a valid `bot-info` claim identifying `"harness":"openclaw"`. Missing contacts, unavailable `%contacts`, and missing or malformed claims emit nothing. The observer stores no state and adds no poke, watch, or scry surface.

DM stages are `owner_message_sent`, `bot_message_received`, `bot_message_sent`, and `owner_message_received`. Bot-side stages use the configured owner; owner-side stages apply only to structurally sponsored moons. Channel stages are `group_host_message_received` and `owner_group_message_received`; the latter requires the bot's moon sponsor to have the channel locally. Edits, reactions, legacy diary channels, and Notes notebooks emit no channel stages.

DM and channel observations share the same best-effort contact check: profiles already delivered by ordinary peering qualify later messages, with no profile fetch or backfill. Events use the canonical DM ID or the channel message's sender `author/sent` correlation key and emit through `%logs` with source `steward/journey`. Channel host IDs differ from the sender key. See [Bot message journey observability](../../../../packages/openclaw/docs/message-journey-observability.md) for the cross-system event contract and correlation details.

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
| payload definition | optional `kind`, `message`, and `tools-allow` | `payload` |
| delivery | `(unit delivery)` | `delivery` |
| definition timestamps | `(unit @da)` for each value | `createdAtMs`, `updatedAtMs` |

`delivery` is where a run's output goes: `mode` (`%none`, `%announce`, `%webhook`), `channel` naming the transport (`'tlon'`), `to` giving the address within it — a channel nest, or a ship for a DM — and an optional `failure-destination` for failure notices. The host's cron store carries it and routes on it, but `openclaw/plugin-sdk/types` does not declare it, so both the projection and the edit mapping read and write it off the host's own shape rather than the plugin declaration. The host requires `mode` when a create sets a delivery and allows a patch to omit it, so the create mapping requires it and the update mapping does not. The host's `thread-id`, `best-effort` and `completion-destination` are not mirrored; a patch that omits a field leaves the host's value alone, so they survive an edit from here. The same holds for the agentTurn payload fields this does not model (`model`, `fallbacks`, `thinking`, `timeoutSeconds`, `lightContext`).

`tools-allow` is the host's tool allow-list: when set, only those tools are offered to the model. The host's own `tools-allow-is-default` marker is server-managed and not mirrored. The bot's own onboarding sets it so publishing stays out of the model's reach, so a create that means to match an onboarding job must set it too.

These shapes were checked against the cron store types of openclaw 2026.5.28, 2026.7.1 and 2026.9.4: `delivery` is unchanged across all three apart from a `completion-destination` added in 7.1, and `tools-allow` stays `payload.toolsAllow` on the wire (9.4 moves it from the agentTurn fields into a mixin shared by every payload kind). The plugin-facing `PluginHookGatewayCronCreateInput` declares neither field in any of the three.

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

`%project` carries the complete task set, never a delta. Accepting one replaces the `our` entry in a single state transition: an ID missing from the list is removed, an empty list clears the entry, and resubmitting the same snapshot leaves state unchanged. Validation happens before anything is written — the mark parses the JSON, and `au-build-task-map` builds the whole replacement map, crashing on a duplicate ID — so a rejected projection (bad field, unsupported schedule, duplicate ID, foreign source) leaves the previous map untouched and emits nothing. Each inbound `id` lives only as its map key.

An equal projection against an existing entry is a complete no-op: no state write, no facts — the harness reconciler re-reads on every `cron_changed` (including execution-only events), and those re-submissions must be silent. Equal-but-absent is the exception: the very first projection creates the `our` entry even when its task list is empty. Entry creation is inexpressible as task-level deltas, so the first accepted projection announces itself on the feed as one fresh full `%tasks` snapshot (even when empty); once the entry exists, a changed projection emits per-task `%set`/`%del` deltas naming the local ship, described below.

The task map has exactly one writer per entry: the harness's `%project` for `our`, a bot's subscription for that bot. The [edit loop](#edit-loop) never writes it — an edit is relayed to the harness and becomes visible only through the harness's next `%project`. Automation excludes cron execution *state*: execution events, run history, delivery outcome and status, session keys, `deleteAfterRun`, and other runtime-only OpenClaw fields. Those values do not enter the Hoon task type, the automation facts, or the JSON scries. The delivery *definition* — where a run's output is addressed — is part of the task and is mirrored; see [`delivery`](#module-automation) above.

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
4. **harness → bot** (`POST /steward/~/v1/automation/finalize` on the bot, or `a-automation` `%finalize rid body`; both local only). The plugin uses the HTTP route because its synchronous reply confirms the arm ran, where a channel poke's acknowledgement is only logged. The bot gives the `response` on the requester's per-request path under `%steward-automation-response-1` and drops the pending record. A finalize for an unknown id is ignored. There is no bot-side deadline: a late answer still completes the request.
5. **bot → owner → client.** On the response fact the owner finalizes: stores the body, gives the `response` on the local `/v1/automation/request/<uv>` path, completes a held HTTP request exactly once, and leaves the bot watch. A watch nack finalizes `%not-authorized`; a poke nack finalizes `%unknown`; a poke ack records `%acked`.

**Pending.** When the 20-second wake fires before a terminal response, the owner completes the held HTTP request with `%pending status`, gives the same on the local path, and keeps the record. A late response overwrites it and is served by GET and on the per-request path, which replays a stored result at subscribe time.

**Sweep.** `/automation/cleanup` fires every five minutes on both sides. Terminal records go once fetched or after a day; a `%pending` result and a bot-side `pending-command` each live an hour; a record with no result yet is left for its wake.

#### HTTP surface

`%steward` binds `/steward` in Eyre on init and on every load. Every route requires Eyre's authenticated session; a request id is not a capability, so GET is gated like POST.

- `POST /steward/~/v1/automation` — body `{ "requestId"?: "0v…", "bot": "~ship", "action": { "create": { …task } } | { "update": { "id": "…", …task } } | { "delete": { "id": "…" } } }`. Held open until the terminal response or the pending wake; the body is the `response` JSON. Malformed input is a 400.
- `GET /steward/~/v1/automation/request/<uv>` — the current record as `response` JSON (`%pending` with the poke status while in flight); marks it fetched. Unknown is 404.
- `GET /steward/~/v1/automation/tasks` — the mirror, as the tasks scry's JSON.
- `POST /steward/~/v1/automation/finalize` — bot side, for the harness. Body is the `response` JSON `{ "requestId": "0v…", "body": { … } }`; answers `{ "requestId", "finalized" }`, with `finalized` false when the id is no longer pending, so a retry after a lost reply is harmless. Malformed input is a 400.

The `response` JSON is type-discriminated like the notes v1 envelope, with the message as an array of strings:

```json
{ "requestId": "0v4.jd3o0", "body": { "type": "created", "id": "job-id" } }
{ "requestId": "0v4.jd3o0", "body": { "type": "error", "errorType": "harness-offline", "message": [] } }
{ "requestId": "0v4.jd3o0", "body": { "type": "pending", "status": "acked" } }
```

### OpenClaw reconciliation

The implementation targets OpenClaw `2026.7.1-2`, the hosted version (the plugin's SDK devDependency stays on `2026.5.28` only because 7.1 requires Node ≥ 22.22.3 and the repo pins 22.22.0; the dev container runs 7.1-2), which provides `gateway_start`, `cron_changed`, `gateway_stop`, and `getCron()`, but not `cron_reconciled`. A job the plugin cannot represent (an unsupported schedule kind such as `on-exit`, a malformed field, a duplicate ID) is dropped from the snapshot and reported to telemetry rather than failing it, so one odd job cannot leave the mirror permanently stale. On `gateway_start` and on every `cron_changed` action—including execution-related `started` and `finished` actions—the Tlon plugin calls `getCron().list({ includeDisabled: true })`, normalizes the complete result, and submits one `%project` poke. A genuinely successful empty list therefore clears the projection; unavailable cron access or a failed read does not masquerade as an empty list.

Two descriptions are refused at the plugin, as typed `invalid` answers rather than silent corrections. Agent onboarding keeps its primary job's slot key in `description` (`tlon-agent-primary:<groupId>`) and finds that job by matching the string exactly, so an edit may neither rename a slot description — which orphans the slot and makes onboarding create a duplicate job — nor mint one on an ordinary job. Resending a slot description unchanged is allowed, so a client that round-trips a whole task is unaffected, and an edit that leaves `description` alone never reads the job list.

The v1 adapter uses one process-global monitor connection slot, so projection is enabled only when exactly one Tlon account is runnable (enabled with ship, URL, and code configured). Additional disabled or incomplete entries do not disable projection. With zero or multiple runnable accounts, gateway-start and cron-change hooks start no projection work; a one-to-many transition stops the active reconciliation epoch on the next trigger and preserves the last stored snapshots instead of targeting whichever monitor most recently published its connection.

Reconciliation work is serialized so the worker does not deliberately start overlapping snapshots. Triggers that arrive while listing or waiting for poke acknowledgement are coalesced into one follow-up read using the latest cron accessor. Cron access, normalization, connection, read, and poke-acknowledgement failures retry the complete operation after a delay while the gateway epoch remains active. Each read-and-submit attempt has a 30-second local deadline so a promise that never settles cannot permanently own the process-lifetime worker. A timed-out list is fenced before submission, and late promise rejection remains observed. Until a later operation succeeds, the ship retains its last successful projection.

`gateway_stop` cancels retry delays, abandons the current operation wait, rejects queued work, and prevents new cron-change work without clearing Steward state. An epoch check immediately before invoking the poke adapter prevents a list from an ended gateway epoch from starting a stale submission. A later `gateway_start` begins a fresh epoch and complete read without waiting for an abandoned old-epoch promise to settle. The local deadline cannot revoke a remote side effect after a poke has already been issued; acknowledgement routing and transport behavior must account for that uncertain-outcome boundary. The reconciler itself lives in process-shared state and is reused across OpenClaw discovery, full activation, and prewarm registration passes; each pass binds its own hooks to that one process-lifetime worker. Projection errors and cron telemetry errors are observed independently, so neither path suppresses the other.

These triggers repair missed changes when a later complete operation succeeds, but they do not provide exact continuous freshness. A process crash, missed event, offline OpenClaw instance, or repeated failure can leave the mirror stale.

## module: prompts

`%steward` keeps a projection of the six workspace prompt files OpenClaw owns: `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, and `BOOTSTRAP.md`. The OpenClaw workspace is authoritative. Steward keeps the last accepted projection and never changes its file map itself for an edit: an edit goes to the harness, the harness writes the file, and the change becomes visible when the harness projects again.

### pokes are canonical, HTTP wraps them

Every operation is a poke first. Each HTTP route is there to give a client what a poke cannot: a synchronous reply, and a 4xx it can act on. `/project` and `/finalize` are thin wrappers over the same arm as their poke (`po-project`, `po-handle-finalize`). The edit route keeps its own record so it can hold the request: it shares only the relay with the `%edit` poke, answers a repeated request id from the record, and answers a conflicting one 409 where the poke ignores the first and crashes on the second. The harness uses HTTP for `/project` and `/finalize` because a rejected channel poke surfaces only as a log line, while the HTTP reply confirms the ship stored the projection or settled the request. The pokes stay, and a client that has no HTTP channel can use them.

### projection

The local harness projects its complete allowlisted file map with `%project`, by poke or by `POST /steward/~/v1/prompts/project`. A projection is all-or-nothing: every name must be on the allowlist and every file at most 64 KiB, or none of it is stored (the poke crashes, the route answers 400). An identical re-projection is silent. The first projection creates the `our` entry and goes out as a full `%files` snapshot, since entry creation cannot be said as file deltas; later ones go out as `%set`/`%del` deltas. An empty projection is present: it means "synced, no files", where an absent entry means "never synced".

### owner-side mirroring

Trust changes drive the mirror the way they drive automation's. `%trust-bot` subscribes to the bot's `/v1/prompts/files` (idempotent, guarded on `wex.bowl`); `%untrust-bot` leaves, deletes that bot's entry, and gives `%gone`; `%configure` with a new owner kicks the replaced owner off the feed. Every load also re-subscribes any trusted bot whose watch is missing (see [lifecycle and invariants](#lifecycle-and-invariants)), which is how a ship upgrading into `%5` subscribes the bots it already trusts.

Facts on `/prompts/files/<bot>` apply only to the bot in the wire. A snapshot replaces that bot's entry with the bot's own entry in the snapshot and ignores every other ship in it, since a bot that is itself an owner includes its mirrors; a snapshot without the bot deletes the entry. Deltas naming another ship are ignored, and a delta never creates an entry. Mirrored content is validated again on arrival, against the same allowlist and per-file cap as `%project`. An invalid snapshot or `%set` is dropped with a `Mirror Fact Rejected` log line and the mirror kept as it was; crashing instead would kick the watch into an immediate re-watch that replays the same fact, a loop on every owner older than its bot the first time a release widens either limit. The owner republishes what it mirrors on its own feed: a first snapshot as a `%files` snapshot, later ones as deltas, and deltas and `%gone` as they come.

A `%kick` re-subscribes while the bot is still trusted; the fresh snapshot repairs anything missed. A nacked watch keeps the last good projection rather than wiping it, and is retried while the bot stays trusted, on a `/prompts/rewatch/<bot>/<wake>` timer: 1, 2, 4 … minutes, capped at an hour. The usual cause is an upgrade race, where this ship reached the prompts module before the bot did and the bot has no files path yet. `rewatch` holds the wake time of the retry armed last, and a wake for any other time is ignored, so a `%trust-bot` re-poked during the backoff, or an untrust and re-trust, cannot start a second chain. A positive ack or an untrust clears the backoff. Each nack logs `Mirror Watch Nacked` as a tell, not a fault: during a rollout it is expected, and repeats on every retry.

### edit loop

An edit goes client → owner → bot → harness, and the result walks back the same way.

1. A local client sends `%edit` to the owner, by `%steward-prompts-action-1` poke or `POST /steward/~/v1/prompts`. Only a bot this ship manages may be sent an edit: this ship itself, or a bot in its trusted set. A self-edit completes only on a ship that is its own owner (it runs its own harness and is both owner and bot); on any other bot the bot side refuses a command not sent by its owner, so the edit ends `%not-authorized` or `%unknown`. The route answers 403 for anything else, and the poke crashes, exactly as automation does. The name must be allowlisted and the text at most 64 KiB.
2. The owner watches the bot's `/v1/prompts/request/<owner>/<uv>`, then pokes it `%steward-prompts-command-1` `%edit`. The two go out on different wires, and Ames orders messages only within one flow, so the command can reach the bot first. The bot therefore keeps its answer as the command's result and replays it to a requester watch that arrives later; the one exception is `%invalid`, which is answered but not stored, so a healthy owner can resend the command.
3. The bot records the command and gives a `dispatch` on its local `/v1/prompts/harness` feed. With no harness subscribed it answers `%harness-offline` at once, as a final result.
4. The harness writes the file atomically, projects the whole workspace again, then finalizes with `POST /steward/~/v1/prompts/finalize` (or the `%finalize` poke).
5. The bot gives the result to the requester, and the owner settles its record, answers any held HTTP request, and gives the result on the local `/v1/prompts/request/<uv>`.

The `dispatch` carries the `requester` that authorized it. The harness compares it with its own configured owner and refuses the edit when they differ: the harness watch goes live before the harness's `%configure` lands, so a replay after an owner change would otherwise write the previous owner's text into the workspace. A reconnecting harness is replayed only the unanswered commands whose requester is the current owner, in sent order. A finalize settles the requester captured on the command, whoever the owner is by then, so the harness's `%not-authorized` verdict on a stale command closes it.

`%pending` only closes a held HTTP request; it is not a terminal harness result, and a later finalize still completes the record. A `%kick` on the owner's per-request watch re-subscribes rather than giving up, and the bot hands a re-subscribing requester any result the harness already reported, so a dropped subscription cannot lose it. A duplicate command with the same id and edit gets the stored result again once one exists, and is otherwise ignored; the same id with a different edit crashes on the bot and answers 409 on the owner's route.

An untrust leaves an edit already sent to that bot alone: its open request watch still settles it with the bot's answer. A kicked request watch is re-opened only while the bot is still one this ship manages, so an untrusted bot is never watched again.

### sweep

A `/prompts/cleanup` timer runs every five minutes. On the owner, a terminal record goes once a client has fetched it (a GET that returned it) or after a day, a `%pending` record after two hours, and a record with no result yet is left for its wake. Every eviction kicks local watchers of the request, and evicting a `%pending` record also leaves the bot's request watch. On the bot, a command lives an hour from sending. One the harness never answered is closed out to its requester when it is dropped, so the owner's record finalizes instead of ageing out as pending: `%harness-offline`, or `%not-authorized` when the requester is no longer the owner (a reconnecting harness is never handed a previous owner's command). The two hours on the owner side leave time for that answer to land. A finalize after the hour finds nothing to settle.

That only works while the bot is reachable. With the bot down, the owner's record goes `%pending` after 20 seconds and is evicted two hours later with a `Request Expired` log line. The command itself has no deadline, as in automation: Ames still delivers it when the bot returns, and the harness may apply it then.

The timer's wire carries its wake time (`/prompts/cleanup/<wake>`), and the slice records it in `sweep`, so a stale wake is ignored and a load re-arms a sweep whose wake has passed (see [lifecycle and invariants](#lifecycle-and-invariants)).

### HTTP routes

All routes sit under the shared `/steward` binding and need a session logged in as this ship. Eyre answers an expired session 401 itself. A request with no session, or a guest one, reaches the agent under the guest's own identity, and the `%handle-http-request` source check refuses it, so Eyre answers 500. The dispatcher answers 404 for a path outside `/steward/~/v1/automation` and `/steward/~/v1/prompts`. Every `POST` must send `content-type: application/json` or it gets 415: a cross-site form can only send text, urlencoded or multipart bodies, so this forces a CORS preflight and blocks a forged edit. Errors are `text/plain` bodies.

| route | side | body | reply |
| --- | --- | --- | --- |
| `POST /steward/~/v1/prompts` | owner | `{ requestId?, bot, action: { set: { name, text } } }`, at most 512 KiB | the `response` once the bot answers, or a pending `response` (`{ requestId, body: { type: "pending", status } }`) after 20 seconds. A repeated `requestId` with the same edit is answered at once from the record. 400 for a missing body, invalid JSON, a missing or malformed `bot`, `action` or `requestId`, or an unsupported file or oversized text; 403 when `bot` is not managed; 409 when `requestId` names another edit; 413 when too large |
| `GET /steward/~/v1/prompts/request/<uv>` | owner | — | the current `response` for that request, pending or terminal; a terminal one marks the record fetched. 400 for a malformed id, 404 for an unknown one |
| `GET /steward/~/v1/prompts/files` | any | — | the ship-keyed file map |
| `POST /steward/~/v1/prompts/project` | bot | `{ project: { <name>: <text> } }`, at most 1 MiB | `{ projected: true }`. 400 for a missing body, invalid JSON, a malformed projection, or an unsupported file or oversized text; 413 only for a body over 1 MiB |
| `POST /steward/~/v1/prompts/finalize` | bot | `{ requestId, body }`, at most 64 KiB | `{ requestId, finalized }`. `finalized` is false when the id is unknown or already settled, so retrying a lost reply is harmless. 400 for a missing body, invalid JSON or a malformed or `%pending` body; 413 when too large |

A `POST` without a JSON content type gets 415 before anything else. Any other method on these paths is 405, and any other path under `/steward/~/v1/prompts` is 404. Every prompts 4xx reports to `%logs` as `HTTP Error`, on the owner and on the bot (for `/project` and `/finalize`); the dispatcher's own 404 reports at `%dbug`.

## poke surface

Eight inbound marks, each ownership-gated to admit exactly the right source: the core, lens and gateway actions, an action and a command for each of automation and prompts, and Eyre's `%handle-http-request`.

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

### `%steward-prompts-action-1` (prompts, `a-prompts`) — `src == our`

Every variant is local-only: the harness and the local client. Each one also has an HTTP route (see [HTTP routes](#http-routes)); the poke is the canonical form.

```
[%project =prompts]                                     harness: replace the projection, all-or-nothing
[%edit =request-id bot=ship =edit]                      client: edit one of .bot's files
[%finalize =request-id body=outcome]                    harness: report a dispatched command's outcome
```

`%project` crashes on a name off the allowlist or a file or map over the limits; `%edit` crashes for a bot this ship does not manage, or an unsupported file or oversized text. `%finalize` takes an `outcome`, a terminal response body, so `%pending` cannot be sent. JSON forms: `{ "project": { "<name>": "<text>" } }`, `{ "edit": { "requestId", "bot", "action": { "set": { "name", "text" } } } }`, `{ "finalize": { "requestId", "body" } }`.

### `%steward-prompts-command-1` (prompts, `c-prompts`) — `src == owner`

The owner → bot leg of the edit loop. Noun only.

```
[%edit =request-id =edit]
```

A repeat with the same id and edit is answered with the stored result; the same id with another edit crashes.

### `%handle-http-request` — Eyre

The HTTP surface for both modules' edit loops, described under automation's [HTTP surface](#http-surface) and prompts' [HTTP routes](#http-routes).

## subscription surface

- `/v1/lens` (local only, `?> =(src our)`): `%steward-lens-update-1` facts (`update:v1:lens`, a tagged union) — `%entry` (a stored run, one per insert; the owner-side client reads these) and `%retry-requested` (emitted on the bot ship for its local gateway to re-dispatch). No initial backfill fact — clients scry `/x/v1/lens/recent` for backfill.
- `/v1/gateway` (local only): `%steward-gateway-update-1` facts (`update:v1:gateway`) — `%status` (on lifecycle transitions, plus an initial fact on subscribe), `%owner-activity`, and `%auto-reply`.
- `/v1/automation/tasks` (local **or** configured owner): `%steward-automation-update-1` facts (`update:v1:automation`) — one initial `%tasks` snapshot of the complete ship-keyed map on subscribe (including when empty), then ship-attributed `%set`/`%del` deltas, fresh full `%tasks` snapshots when an entry appears, and `%gone` entry removals. See [feed](#feed-v1automationtasks).

- `/v1/automation/harness` (local only): `%steward-automation-dispatch-1` facts (`dispatch`, `[rid edit]`) — the bot's pending edit commands for its harness; every outstanding command is replayed on subscribe, oldest first.
- `/v1/automation/request/<owner>/<uv>` (the requester named in the path, and only when it is the configured owner): one `%steward-automation-response-1` fact (`response`) when the bot finalizes that request.
- `/v1/automation/request/<uv>` (local only): one `%steward-automation-response-1` fact when the owner finalizes that request; a stored result is replayed at subscribe time.

The prompts module has the same four paths:

- `/v1/prompts/files` (local **or** configured owner): `%steward-prompts-update-1` facts (`update:v1:prompts`) — one initial `%files` snapshot of the ship-keyed map on subscribe, then ship-attributed `%set`/`%del` deltas, fresh full `%files` snapshots when an entry appears, and `%gone` entry removals.
- `/v1/prompts/harness` (local only): `%steward-prompts-dispatch-1` facts (`dispatch`, `[rid requester edit]`) — the bot's pending edit commands for its harness. On subscribe it replays only the unanswered commands whose requester is the current owner, oldest first, where automation replays every outstanding one. `requester` is the owner that authorized the command, so a harness can also refuse a replay itself.
- `/v1/prompts/request/<owner>/<uv>` (the requester named in the path, and only when it is the configured owner): a `%steward-prompts-response-1` fact whenever the bot answers that request — the harness's finalize, an immediate `%harness-offline` or `%invalid` refusal, a duplicate command, or the sweep's `%harness-offline` — and the stored result again on a re-subscribe.
- `/v1/prompts/request/<uv>` (local only): one `%steward-prompts-response-1` fact when the owner finalizes that request; a stored result is replayed at subscribe time.

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

- `/x/v1/lens/recent` → `[%recent entries]` — newest 50 runs across all bots, for backfill. Grows to `{ "recent": [ entry, … ] }` (a JSON array of entry objects).
- `/x/v1/lens/recent/[count]` → `[%recent entries]` — newest `count` runs.
- `/x/v1/lens/since/[da]` → `[%recent entries]` — every run with `received >= da`, newest first; paginate history by passing the oldest `received` from the last page.
- `/x/v1/lens/run/[ship]/[id]` → `[%entry entry]`, or empty (`[~ ~]`) when absent.
- `/x/v1/gateway/status` → `%noun` `[status:v1:gateway (unit @da)]` — current liveness and lease expiry.
- `/x/v1/gateway/owner-activity` → `%noun` `@da` — timestamp of the most recent owner DM.
- `/x/v1/prompts/files` → `%steward-prompts-files-1` `(map ship prompts:v1:prompts)` — the complete ship-keyed file map, the same value as `GET /steward/~/v1/prompts/files`.
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

- `on-init` creates `state-5`, subscribes to `%activity /v5`, `%chat /v4`, and `%channels /v4`, seeds the default lens retention cap, and leaves automation and prompts empty. There is no lens prune timer (retention is count-only, enforced on insert/configure).
- `on-load` delegates to `load`, which migrates one version per step (`state-0-to-1` through `state-4-to-5`) in the same shape as `%activity`'s `load`. The one card a migration step emits is the `bot-liveness` seed for a `%0` bot whose gateway is already `%up` or `%down` (owner configured): heartbeats advertise only on an up transition, so an already-up gateway would otherwise stay unknown until its next restart. Decode or migration failure is visible and never resets to bunt. `on-save` writes `state-5`.
- `on-init` and every load end in `reconcile`, which restores what state cannot carry. A suspended agent's due Behn wakes are dropped, a crashed sweep discards its own re-arm, and a mirror watch can be lost to a nack or a kick that never arrived. So `reconcile` re-emits the Eyre binding for `/steward`; re-watches any missing `%activity`, `%chat` or `%channels` subscription; re-arms each module's sweep whose recorded wake has passed; and re-watches every trusted bot's automation and prompts feed whose wire is missing, except a prompts bot whose retry is still ahead. Each step acts only on what is missing, so a load with everything live emits just the Eyre binding. This is also how the upgrade into `%5` arms both sweeps and subscribes the trusted set to the prompts feed.
- Wires: lens send on `/lens/send/[owner-p]/[id-t]`, lens retry relay on `/lens/retry/[bot-p]/[id-t]`, the gateway lease timer on `/gateway/lease-check`, gateway auto-reply/notice DM sends on `/gateway/dm/send`, liveness publication to `%contacts` on `/gateway/liveness`, journey observations on `/journey/chat` and `/journey/channels`, journey log pokes on `/journey/logs`, the owner-side automation watches on `/automation/tasks/[bot-p]`, the automation sweep on `/automation/cleanup/[wake-da]`, and for prompts the owner-side mirror watches on `/prompts/files/[bot-p]`, their retry timers on `/prompts/rewatch/[bot-p]/[wake-da]`, the per-request owner → bot legs on `/prompts/req/[bot-p]/[uv]/{watch,poke,wake}`, and the sweep on `/prompts/cleanup/[wake-da]`. A sweep or retry wake whose time does not match the one recorded in state is stale and ignored. Everything arriving on an automation or prompts mirror wire is applied only for the ship in the wire (facts naming other ships are ignored). The activity and journey subscriptions are re-watched on `%kick`; an automation watch is re-watched on `%kick` iff its bot is still trusted. Poke/DM nacks are logged and ignored (Ames retries); a nacked automation watch is logged and re-sent on the next load or `%trust-bot` re-poke, while a nacked prompts mirror watch is retried on a backoff (see [owner-side mirroring](#owner-side-mirroring-1)). A kicked prompts request watch re-subscribes while its bot is still managed.
- `on-watch` auth is per-path: lens and gateway paths require `=(src our)`; `/v1/automation/tasks` and `/v1/prompts/files` also admit the configured owner, the two `/v1/*/request/<owner>/<uv>` paths admit only that owner, and the harness and local request paths are local only. Rejection is a crash (watch nack). Dotket `on-peek` calls execute locally against current state without caller-source authorization. Core, gateway, and automation pokes are local only; lens applies its per-action source rules to admit trusted bot runs and owner relays.

## reporting

`%steward` reports through `/lib/logs`, like `%activity` and `%groups`: `on-fail` sends the crash, and the arms below send named events. `%logs` forwards everything at or above its volume threshold (`%info` after `on-init`) to PostHog as `Backend Log`, and to OTLP when an endpoint is set, so a fleet-wide question does not depend on reading one ship's terminal. Only a fault is sent as a `%fail`, because that is what the crash dashboards and the unknown-crash burst alert count; an expected outcome, however unwelcome, is a `%tell`.

Every automation event carries `flow: steward-automation`, and each one names the request it belongs to, so one query follows an edit across both ships.

| event | volume | where | property |
| --- | --- | --- | --- |
| `Edit Relayed` | `%dbug` | owner | `requestId`, `bot` |
| `Edit Pending` | `%dbug` | owner | `requestId`, `bot` |
| `Edit Settled` | `%dbug` | owner | `requestId`, `bot` |
| `Edit Failed` | `%error` fail, or `%info`/`%warn` | owner | `requestId`, `bot`, `errorType` |
| `Request Expired` | `%warn` | owner | `requestId`, `bot` |
| `Command Refused` | `%info` | bot | `requestId`, `requester` |
| `Command Dispatched` | `%dbug` | bot | `requestId`, `requester` |
| `Command Expired` | `%warn` | bot | `requestId`, `requester` |
| `Finalize Unknown` | `%dbug` | bot | `requestId` |
| `HTTP Error` | `%info` | owner | `status`, `detail` |
| `Mirror Watch Nacked` | `%error` fail | owner | `bot` |
| `Lens Fan-out Nacked`, `Lens Retry Nacked` | `%error` fail | bot, owner | — |
| `Lens Payload Oversized` | `%warn` | owner | `ship` |
| `Activity Watch Nacked`, `Gateway DM Send Failed`, `Gateway Liveness Nacked` | `%error` fail | any | — |
| `Gateway Lease Expired` | `%warn` | bot | — |

`Edit Failed` is the one event whose volume depends on its cause: `not-authorized`, `unknown` and `harness-error` carry a stack trace and report as faults, `harness-offline` is the bot saying its plugin is down and reports at `%info`, and a client-shaped `invalid` or `not-found` reports at `%warn`.

The two expiries are the ones worth alerting on. `Request Expired` means a client asked for an edit and nothing ever came back; `Command Expired` means the bot accepted a command its harness never answered.

Prompts sends these events with `flow: steward-prompts`: `Mirror Watch Nacked` (owner, `%info`, with `bot`; a tell, since it is expected during a rollout), `Mirror Fact Rejected` (owner, `%warn`, with `bot` and `update`), `Request Expired` (owner, `%warn`, with `requestId` and `bot`), `Command Expired` (bot, `%warn`, with `requestId` and `requester`), and `HTTP Error` (`%info`, with `status` and `detail`, on owner and bot). Its two expiries mean the same as automation's. `Request Expired` fires only when the bot was unreachable for two hours, since a reachable bot closes an unanswered request itself. Unknown-route requests are answered by the shared dispatcher and log `HTTP Error` at `%dbug`, under no flow.

The plugin reports its own side to PostHog through `reportTelemetryError`: `steward_automation_edit` with `finalize_abandoned` (the answer never reached the bot, so the request is stranded), `apply_failed` (the cron service could not apply the edit) and `cron_unavailable`; `steward_automation_projection` with `projection_failed` / `projection_exhausted` (the mirror is going stale) and one event per cron job dropped from a snapshot.

## integration notes

- The gateway (openclaw-tlon / hermes) pokes core `%configure` on monitor activation and `%steward-lens-action-1` run milestones from its run event stream. Lens recording is config-gated on the gateway side (`channels.tlon.contextLens`).
- Clients store runs locally, subscribe to `/v1/lens` for live updates, and scry on cache miss. The channel post pointer blob carries `botShip` so the client knows which `[bot id]` key to look up.
- The gateway's HTTP/SSE routes remain an optional desktop enhancement for fine-grained live streaming; `%steward`'s lens module is the durable source of truth.
- The `%steward-lens-*` marks replace the former `%context-lens-*` marks. There is no separate cross-ship `signal` mark — sending reuses `%steward-lens-action-1`, gated by ownership.
