## Why

OpenClaw currently keeps automation definitions inside the external
harness, so the bot ship has no durable ship-native view of its
configured tasks. Mirroring the authoritative OpenClaw task set
introduces an automation module to the released `%steward` agent while
leaving owner access, manipulation, and additional harnesses for later
work.

## What Changes

- Add an automation module to the released `%steward` agent that
	persistently stores the bot's current OpenClaw cron task
    definitions.
- Migrate existing deployed `%steward` state to initialize the
    automation module without losing core, lens, or gateway state.
- Add an independently versioned `%project` automation action that
    accepts only the local Gall poke source and atomically commits a
    complete task projection as the current stored snapshot.
- After OpenClaw `gateway_start`, have the OpenClaw harness read all
    jobs, including disabled jobs, and submit the complete snapshot
    through `%project`.
- Treat `cron_changed` events as reconciliation triggers: have the
    harness reread and submit the complete current job list through
    `%project` rather than applying event payloads as deltas.
- Serialize and coalesce reconciliation so snapshots cannot overtake
    one another, and retry transient failures while the gateway
    remains active.
- Enable the v1 projection only when exactly one runnable Tlon account
    is configured; fail closed rather than selecting an arbitrary ship
    from the process-global monitor connection slot.
- Keep the current OpenClaw version and document that, without
    `cron_reconciled`, this is a best-effort mirror repaired on
    gateway startup and subsequent cron changes rather than an
    authoritative external projection.
- Add a `%steward` dotket scry, which executes locally against the
    current agent state without caller-source authorization, that
    returns the complete stored task projection as a JSON object keyed
    by task ID without duplicating IDs inside task values.
- Exclude execution tracking, run history, owner-ship replication,
    owner-client integration, cron manipulation, and non-OpenClaw
    harnesses from this change.

## Capabilities

### New Capabilities

- `steward-automation-projection`: Durable, best-effort mirroring of
    complete OpenClaw cron task snapshots into the bot's local
    `%steward`, with a JSON scry read surface.

### Modified Capabilities

None.

## Impact

- Backend: a versioned `%steward` state migration, automation
    dispatch, new automation action and task-map marks, JSON
    conversion, scry handling, and Hoon tests.
- OpenClaw plugin: `gateway_start`/`cron_changed` full-snapshot
    reconciliation, serialized retry behavior, snapshot encoding and
    poking, and TypeScript tests.
- Documentation: `%steward` automation module state, poke interface,
    and scry interface.
- Compatibility: existing deployed `%steward` state must migrate
    without losing core, lens, or gateway data. Existing marks remain
    unchanged, and OpenClaw remains the sole source of truth for
    scheduling and execution.
