## Why

The automation module mirrors a bot's OpenClaw cron tasks bot → owner → client, but the pipeline is read-only: clients can see a bot's scheduled tasks and cannot change them. The original ticket (TLON-6271) defines a second flow — client → owner → bot → harness — that lets the owner create, update, and delete a bot's tasks from a Tlon client, with the existing projection pipeline confirming the result. This change adds that flow (TLON-6450).

## What Changes

- Add a request/response edit loop to the automation module laid out on the ACUR pattern used by channels, groups, and notes: local-only actions, an owner-gated command, canonical updates, and a notes-style per-request response, each carrying a client-visible `request-id`: every edit carries a client-visible `request-id` and terminates in exactly one typed response — a result, a typed error, or `pending` when the loop outlives the caller's wait.
- Add three edit operations — `create`, `update`, `delete` — expressed with the existing `task` type. Every `task` field is already optional, so `update` carries a patch in the same shape as a stored task.
- Expose the loop on the owner ship over HTTP: an authenticated `POST` held open until the terminal response or a pending timeout, a `GET` for late pickup by request id, and a local per-request subscription path that replays a stored terminal result at subscribe time.
- Relay owner → bot with the notes discipline: watch the bot's per-request response path first, then poke the command. Bot-side authorization admits only the configured owner.
- Add a local-only bot-side harness feed that carries pending edit commands to the OpenClaw plugin and replays outstanding commands on subscribe, so a restarted plugin picks up in-flight requests.
- Have the Tlon OpenClaw plugin subscribe to that feed at gateway start, apply each command through the `CronService` already available from `getCron()`, and poke a typed response back. Create passes a job id derived from the request id, so a replayed create is idempotent, and returns that id.
- Fail fast: when no harness is subscribed to the bot's harness feed, the bot responds `harness-offline` immediately instead of leaving the client to wait out the pending window. A harness that accepts a command but answers late still completes the request: the owner returns `pending` after 20 seconds, keeps the record, and stores the late response for pickup by request id.
- Keep `%steward` a pure relay. No edit ever writes the automation task map; OpenClaw stays the only source of truth, and the change becomes visible through the existing `cron_changed` → `%project` → mirror pipeline.
- Add a TypeScript client module in the api package that sends edits, distinguishes ok / error / pending envelopes with typed errors, and reads the mirror over HTTP.
- Exclude from this change: owner-side desired state or offline editing, run-now, editing tasks on non-OpenClaw harnesses, client store/db/UI integration, multi-owner fan-out, and any change to the read-side feed or scry.

## Capabilities

### New Capabilities

- `steward-automation-edit`: owner-initiated create/update/delete of a bot's automation tasks, relayed client → owner → bot → OpenClaw with a request-id envelope, typed terminal responses, pending semantics, an HTTP surface on the owner ship, a bot-side harness feed, and OpenClaw plugin application through the cron service.

### Modified Capabilities

None. The `%project` requirements in `steward-automation-projection` and the feed/mirror behavior are untouched; edits become visible only through them.

## Impact

- Backend: new v1 automation types (`request-id`, `edit`, `response`, `response-body`, `action-error`, `dispatch`, request records), two new `a-automation` variants (`%edit`, `%finalize`) on the existing action mark, a new `c-automation` command mark gated to the owner, a new `dispatch` fact mark for the harness feed, a new `response` fact mark for per-request results, an Eyre binding for `/steward/~/v1`, per-request watch paths on owner and bot, a local-only bot harness feed, behn timeouts and a cleanup sweep, a state version bump for the request maps, and Hoon tests.
- OpenClaw plugin: a harness-feed subscription registered alongside the reconciler, command → `CronService` mapping with validation, response pokes, the same single-account eligibility gate, and TypeScript tests.
- API package: a `steward` automation client with create/update/delete, request pickup, mirror reads, and typed envelope errors, with tests.
- Documentation: the automation section of `docs/backend/desk/app/steward.md` gains the edit loop, HTTP surface, harness feed, and error vocabulary. The "no task mutation surface" statement is replaced.
- Compatibility: the request/response loop requires a plugin that subscribes to the harness feed; an older plugin yields `harness-offline` for every edit while the read-side mirror keeps working. OpenClaw's `CronService` exposes `add`/`update`/`remove` on the pinned 2026.5.28, the deployed 2026.7.1-2, and the upcoming 2026.8.2.
