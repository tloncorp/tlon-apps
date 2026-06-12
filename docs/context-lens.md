# %context-lens

Ship-native agent for per-run bot introspection ("context lens"). Makes a bot's run records — trigger, tool calls, timings, output — durable on the owner's ship and reachable from any client (including mobile), without the client ever talking to the gateway.

One agent, two roles. The same code runs on every ship; which role is active is determined by who pokes it.

The agent is named `%context-lens` (not `%lens`) because `%base` already bills a `%lens` agent (the HTTP dojo API); gall agent names are global across desks, and the collision makes the groups desk commit silently fail.

## overview

The openclaw gateway records a run record per bot response and stamps the resulting channel post with a pointer blob (`{type: 'tlon-context-lens', lensId, botShip}`). The gateway's own HTTP/SSE routes only work for desktop clients that can reach it directly; gateway disk is also not durable on hosted infrastructure. `%context-lens` moves the durable home to the owner's ship:

-   **bot ship role**: the local gateway pokes `%context-lens-action-1` with run records; the agent fans them out to configured owners as `%context-lens-signal-1` pokes. Ames retries until ack, so owner-ship downtime or gateway restarts don't drop finalized runs once poked.
-   **owner ship role**: stores incoming runs keyed `[bot id-run]` — the poke source (`src.bowl`) is the trust anchor for `bot` — gives facts on `/v1`, and answers scries for clients.

A self-owned bot (owner ship == bot ship) is handled without a network hop: the fan-out stores directly.

Run payloads are opaque serialized JSON (a cord, `@t`) with an inner `schemaVersion`. The gateway enforces size caps and truncation before poking; the ship relays and stores without interpreting the contents. The payload is a cord rather than a `$json` because embedding the recursive `$json` type in mark sample types makes ford's tube nest checks diverge — every json conversion build for the desk stack-overflows.

## state model

State is `state-1`, defined in the app file (the `%0` → `%1` upgrade arms the retention timer exactly once; the shape is unchanged):

```
owners  (set ship)                       fan-out targets (bot role); ~ means inert
runs    (map [bot=ship id-run=@t] run)   stored run records (owner role)
```

`run` (in `desk/sur/context-lens.hoon`):

```
complete  ?      whether a %run-final has been received for this id
received  @da    when the latest poke for this id arrived
payload   @t     opaque serialized-JSON run record
```

`%run-event` upserts a partial record (`complete=|`); `%run-final` marks it complete. A finalized run is never demoted back to partial by a late `%run-event`.

### retention

Bounds, per bot:

-   runs older than 90 days are dropped
-   at most 1000 live runs per bot; oldest beyond the cap are dropped

Enforcement happens in three places:

-   **on store**: every incoming signal prunes that bot's runs
-   **on a daily timer**: a recurring behn wake on the `/prune` wire prunes all bots, so storage is reclaimed even when a bot stops sending signals
-   **on read**: `/x/recent` and `/x/run` filter expired runs, so the age bound holds observably regardless of timer or signal cadence (gall scries cannot mutate state, so this is a filter, not a prune)

## poke surface

### `%context-lens-action-1` (local gateway only, `?> =(src our)`)

```
[%configure owners=(set ship)]            set fan-out targets
[%run-event id-run=@t payload=@t]       incremental run milestone
[%run-final id-run=@t payload=@t]       finalized run record
```

JSON poke form (as sent by the gateway over Eyre):

```json
{ "configure": { "owners": ["~sampel-palnet"] } }
{ "run-event": { "id": "<lensId>", "payload": "<serialized JSON>" } }
{ "run-final": { "id": "<lensId>", "payload": "<serialized JSON>" } }
```

### `%context-lens-signal-1` (cross-ship, bot → owner)

```
[%run-event id-run=@t payload=@t]
[%run-final id-run=@t payload=@t]
```

Accepted from any ship; records are keyed by the sending ship, so a malicious ship can only write under its own identity. Storage is bounded by per-bot retention. Clients decide which bots they care about.

## subscription surface

-   `/v1` (local only, `?> =(src our)`): `%context-lens-update-1` facts, one `[%run entry]` per stored run. No initial backfill fact — clients scry `/x/recent` for backfill.

## scry surface

-   `/x/recent` → `%context-lens-update-1` `[%runs (list entry)]` — newest 50 runs across all bots
-   `/x/run/[ship]/[id-run]` → `%context-lens-update-1` `[%run entry]`, or empty (`[~ ~]`) when absent or expired

`entry` is `[bot=ship id-run=@t run]`. The update mark grows to JSON for Eyre:

```json
{ "run": { "bot": "~zod", "id": "...", "complete": true, "received": "~2026.6.10..12.00.00..0000", "payload": "<serialized JSON>" } }
```

## integration notes

-   The gateway (openclaw-tlon) pokes `%configure` on monitor activation and `%run-event` / `%run-final` from its context-lens event stream. Lens recording is config-gated on the gateway side (`channels.tlon.contextLens`).
-   Clients store runs in a local `context_lens_runs` table, subscribe to `/v1` for live updates, and scry on cache miss. The channel post pointer blob carries `botShip` so the client knows which `[bot id-run]` key to look up.
-   The gateway's HTTP/SSE routes remain an optional desktop enhancement for fine-grained live streaming; `%context-lens` is the durable source of truth.
