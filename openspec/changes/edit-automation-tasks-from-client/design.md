## Context

See `proposal.md` for motivation and `specs/steward-automation-edit/spec.md` for required behavior.

The automation module today is a one-way projection: the OpenClaw plugin submits complete snapshots through `%project`, the bot's `%steward` serves them on `/v1/automation/tasks`, and the owner mirrors trusted bots onto the same feed for clients. The archived designs for those two legs listed a client → owner → bot → harness modify path as a non-goal and deferred it to this change.

Three facts shape the design.

First, OpenClaw is not a Gall agent. It is an HTTP client of the bot ship that pokes and subscribes with the ship's own credentials. The bot cannot push a command into the plugin; the plugin must subscribe to something and poke a result back. The monitor already holds a subscription to the `%steward` lens feed, so this hop has a working precedent.

Second, the gateway hands plugins the real `CronService` through `getCron()`, not a narrowed wrapper. `add`, `update`, and `remove` accept the full gateway schema — `cron`, `at`, and `every` schedules, `agentId`, `enabled`, `sessionTarget`, `wakeMode`, `systemEvent` and `agentTurn` payloads — and `add` returns the created job. `add` also accepts a caller-supplied id and rejects a duplicate, which is what makes a replayed create idempotent. This holds on the pinned 2026.5.28, the deployed 2026.7.1-2, and 2026.8.2, whose additions are purely additive. The plugin SDK's `.d.ts` understates the accepted input, so the plugin casts past it exactly as the projection code already does for reads.

Third, `%notes` v1 already solved the shape of a correlated, multi-hop, typed request/response loop in this desk: a `request-id` wrapper around the ordinary action pipeline, watch-before-poke on a per-request path, typed errors returned as data, `pending` as a first-class response, a held-open HTTP `POST`, and a bounded request record swept on a timer. This change ports that shape rather than inventing another.

## Goals / Non-Goals

**Goals:**

- Let the configured owner create, update, and delete a bot's automation tasks from any Tlon client, over HTTP, with one typed terminal response per request.
- Keep `%steward` a pure relay. Convergence comes from the existing projection pipeline, never from steward mutating its own task map.
- Make every hop's failure distinguishable to the client: not authorized, not found, invalid, harness offline, harness error, harness timeout, unknown.
- Reuse the notes request/response discipline so the desk has one way of doing this.

**Non-Goals:**

- Desired-state or offline editing on the owner. Edits require a live bot and a live harness.
- Run-now, pause-all, or any operation beyond create/update/delete.
- Non-OpenClaw harnesses. The harness feed is harness-neutral, but only the OpenClaw plugin is implemented.
- Client store, db, sync, or UI. This change ends at a typed api-package client.
- Multi-owner fan-out or edits by trusted bots or group hosts.
- Any change to the read-side feed, scry, mirror, or `%project` semantics.
- Automatic recovery of a nacked owner → bot watch beyond reporting it as a typed error.

## Decisions

### 1. ACUR roles, with a request-id ported from `%notes` v1

The loop is laid out on the ACUR pattern (`docs` in tloncorp/hoon-reference; channels, groups, and notes in this desk). Each hop is one letter:

- `a-automation`, local-only, gated `src == our`: `%project tasks` from the harness (existing), `%edit rid bot edit` from a client, `%finalize rid body` from the harness.
- `c-automation`, owner → bot, gated `src == owner`: `%edit rid edit`.
- `u-automation`, canonical task state on `/v1/automation/tasks`: the existing `update` (`%tasks`, `%set`, `%del`, `%gone`). `r-automation` aliases it; the owner re-serves it unchanged.
- `response [id body]`, the per-request terminal, bot → owner and owner → client, mirroring notes v1's `response`/`response-body`.
- `dispatch [id edit]`, bot → harness on the harness feed: the pending command handed to the executor.

Placement follows the reference's trust-boundary test: a verb belongs in `a-*` iff `src == our` would not crash a legitimate caller. `%project`, `%edit`, and `%finalize` pass; the owner's command does not, so it is a `c-*` with its own mark, exactly as `%channel-action` and `%channel-command` split.

The request id is a `@uv` minted from `eny.bowl` when the client omits or mangles one, and honored when the client supplies a parseable one. It lives inside the variants that need it rather than wrapping the union, because `%project` has none. The `edit` union is flat — `%create task`, `%update id task`, `%delete id` — reusing the existing `task` type whose all-optional fields make `update` a natural patch. `response-body` is `%created id`, `%updated id`, `%deleted id`, `%error type message`, or `%pending status`; `action-error` names the six error types. No type carries an actor field: `src.bowl` is the actor at every hop, and the requester appears only in the per-request path for routing.

The owner keeps an `incoming-request` record per id — held-open HTTP id, poke status, terminal result, finalization time, fetched flag — and delivers the terminal result three ways at once: completing the held HTTP request, giving a fact on the local `/v1/automation/request/<uv>` path, and serving `GET` by id. A 20-second behn wake closes the HTTP wait with `[%pending status]` while keeping the record alive for the late answer. A periodic sweep evicts terminal records on the notes schedule.

**Alternative considered:** `trackedPoke`-style correlation by predicate on the mirror feed. Rejected: a projection `%set` cannot be attributed to a particular edit, there is no typed error channel, and a rejected edit produces no fact at all.

### 2. Steward is a pure relay

No edit writes the automation task map on any ship. The owner records and forwards; the bot records, forwards to the harness, and forwards the response back. The change becomes visible when OpenClaw emits `cron_changed`, the plugin re-projects, and the mirror emits `%set` or `%del`. The client treats the edit response as "OpenClaw accepted or rejected this" and the mirror delta as confirmation.

This keeps `%project`'s complete-replacement semantics intact and avoids a desired-state layer that would fight the reconciler. The cost is that an edit cannot be applied while the harness is down; that is surfaced immediately as `harness-offline` rather than hidden behind a pending wait.

**Alternative considered:** an owner-side desired-state map applied optimistically and reconciled against projections. Rejected as the explicit non-goal: it introduces a second truth, conflict rules, and clobber detection for a benefit the client can approximate with optimistic UI keyed by request id.

### 3. Owner → bot relay: watch first, then poke

The owner watches the bot's `/v1/automation/request/<owner>/<uv>` on a wire encoding `bot` and `rid`, then pokes `c-automation` `%edit`, then arms the 20-second wake. The bot admits the watch only when `src.bowl` equals the requester named in the path and is the configured `owner`, and admits the command poke only from the configured `owner`. A watch nack finalizes `not-authorized`; a poke nack finalizes `unknown`. The owner leaves the watch as soon as the response fact lands. The owner always pokes the bot, and Gall loops the poke back when the bot is us, so there is one code path (the reference's "always poke the host"). Because the client's `%edit` and the owner's `%edit` arrive under different marks, the receiver tells the roles apart by mark even on a self-owned ship.

### 4. Bot → harness: a local-only feed with replay, and a fail-fast presence check

The bot exposes `/v1/automation/harness`, admitting only `src.bowl == our.bowl`. On subscribe it gives one fact per outstanding command so a restarted plugin resumes in-flight work; thereafter it gives one fact per accepted command. The plugin pokes `%finalize rid result`, admitted only from the local source, and the bot finalizes on the per-request path.

Before forwarding, the bot checks `sup.bowl` for a live subscriber on the harness path. With none, it finalizes `harness-offline` at once. With one, it records the pending command and forwards it. There is no bot-side deadline: a timeout would hand the client a definite failure that the mirror may contradict moments later, and would discard the one place the client learns the created id or the harness's error. Instead the owner's 20-second wake returns `pending` and keeps its record, and a late `%finalize` completes the request normally for pickup by id. Pending commands are bounded only by the sweep, on the order of an hour. A `%finalize` naming an unknown id is ignored. Because steward never mutated state, whatever OpenClaw actually did shows up in the projection regardless.

**Alternative considered:** letting the plugin poll a scry for pending commands. Rejected: a subscription gives push latency, natural presence detection, and matches the monitor's existing lens subscription.

### 5. The plugin applies commands through the real `CronService`

The monitor owns the SSE client and already subscribes to the lens feed, while the cron service is only reachable from gateway hook contexts, which the telemetry observer already bridges by stashing `getCron` in a shared slot at `gateway_start`. So the monitor subscribes to the bot's harness feed next to the lens subscription, reads the cron service through that slot (waiting briefly at startup if a dispatch lands before the hook has run), and for each command: validates it with Zod, maps it to `CronService` input, calls `add`, `update`, or `remove`, and pokes the typed response. Mapping mirrors the projection normalizer in reverse: `at` crosses as integer milliseconds and becomes ISO for OpenClaw, `payload.kind`/`message` become a `systemEvent` `text` or an `agentTurn` `message`, and `create` requires the fields OpenClaw requires (`name`, `schedule`, `sessionTarget`, `wakeMode`, `payload`) or returns `invalid` before touching the service. `remove` reporting `removed: false` returns `not-found`. A thrown service error returns `harness-error` with the message as the tang. For `create` the plugin passes a job id derived deterministically from the request id. OpenClaw accepts a caller-supplied id and rejects a duplicate, so a create replayed after a crash between apply and response is answered `created` with the same id instead of producing a second job. The id still comes back in `%created`; only its bytes are predictable.

The subscription is gated by the same exactly-one-runnable-account rule as projection, because it shares the process-global connection slot. Command handling is serialized per bot so two edits to one job cannot race inside the plugin; OpenClaw's own store lock protects across processes.

### 6. HTTP on the owner ship

`%steward` binds `/steward/~/v1` in Eyre. `POST /steward/~/v1/automation` takes `{ requestId?, bot, action }` and is held open until the terminal response or the pending wake. `GET /steward/~/v1/automation/request/<uv>` returns the record and marks it fetched. `GET /steward/~/v1/automation/tasks` returns the mirror scry JSON so a client can read and write through one transport. Authorization is Eyre's authenticated-session check, the same as the rest of the desk's HTTP mounts; a request id is not a capability, so `GET` is gated identically to `POST`.

**Alternative considered:** poke-only for the app, HTTP later. Rejected: the app, the tlon-skill CLI, and LLM tool callers all want the same envelope, and the notes HTTP handler ports nearly verbatim.

### 7. Marks follow the ACUR boundaries

- `%steward-automation-action-1`, extended: `a-automation`. Poked by the client to the owner and by the harness to the bot. Gate `src == our`. JSON in; `%edit` is also the HTTP POST body. The parser gains two tagged keys and the harness's existing `%project` poke is unaffected.
- `%steward-automation-command-1`, new: `c-automation`. Poked by the owner to the bot. Gate `src == owner`. Noun only; it never crosses a JSON boundary.
- `%steward-automation-dispatch-1`, new: `dispatch`. Given by the bot on `/v1/automation/harness`, which admits only `src == our`. JSON out.
- `%steward-automation-response-1`, new: `response`. Given by the bot on `/v1/automation/request/<owner>/<uv>` (admits only the requester named in the path) and by the owner on `/v1/automation/request/<uv>` (local only); also the body of the completed HTTP POST and of the GET by id. Noun and JSON out.
- `%steward-automation-update-1` and `%steward-automation-tasks-1` are unchanged, so facts and scries keep separate marks per the module's convention.

**Alternative considered:** one action union holding the owner's command too. Rejected: the command needs `src == owner`, and the reference's principle 4 makes the a/c split a trust boundary, not a vocabulary; a local-only action mark cannot admit it.

### 8. State

`state-1` is unreleased on this branch (PR 6267 is a draft), so per the repository rule against bridging branch-only state the automation slice is extended in place rather than bumped. If 6267 ships before this change, a `state-2` migration becomes necessary. The slice gains two request maps: the owner-side `requests=(map request-id incoming-request)` and the bot-side `pending=(map request-id [requester=ship =edit sent-at=@da])`. Migration bunts both empty. Every record carries the timestamps the sweep needs, so an unreachable bot or a dead harness cannot leak the maps.

## Risks / Trade-offs

- **Pending will be common.** The held-open `POST` spans two ships and a gateway hop; a slow bot or harness routinely exceeds 20 seconds. Mitigation: `pending` is a normal response, the record stays alive for late pickup, and the client module treats it as a first-class outcome with the request id and the reads that confirm it.
- **Applied but unreported.** A harness that applies a command and dies before poking `%finalize` leaves the request pending until the sweep, while the projection shows the change. This is the same uncertain-outcome boundary the projection design already documents for pokes. Mitigation: the client relies on the mirror delta as confirmation, never on the response alone; replay on resubscribe usually recovers the response, and the derived create id makes that replay safe.
- **Narrow SDK types.** The plugin casts past the `.d.ts` create input to reach the service's real schema. Mitigation: Zod validation on our side, and a fixture test against each supported OpenClaw version's schema.
- **Older plugin.** A bot running a plugin without the harness subscription returns `harness-offline` for every edit. Mitigation: the error is typed and the read-side mirror keeps working; the client can show "update the bot" rather than a generic failure.

## Migration Plan

1. Land the desk change: types, marks, Eyre binding, paths, relay, timeouts, sweep, state migration, tests.
2. Land the plugin change behind the existing single-account gate; a plugin without it degrades to `harness-offline`.
3. Land the api-package client.
4. Deploy the desk to owner and bot ships, then upgrade the bot's plugin. Order does not matter for safety; edits simply fail typed until both halves are present.
5. Rollback is removing the plugin subscription or the desk change independently; neither leaves durable state beyond request records the sweep evicts.

## Open Questions

- Whether `GET /steward/~/v1/automation/tasks` should live in this change or wait for the client store work. It is included because it costs one route and makes the api client self-sufficient.
- Whether the owner should additionally give the `%pending` fact on the per-request path at the wake, or only complete the HTTP request. Notes completes HTTP only; this design follows notes.
