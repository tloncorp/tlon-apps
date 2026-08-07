## Purpose

Provide the bot ship with a durable, locally readable, best-effort mirror of complete OpenClaw cron task definitions while OpenClaw remains authoritative for scheduling and execution.

## ADDED Requirements

### Requirement: Gateway startup triggers a complete task read

After `gateway_start`, the OpenClaw harness SHALL read the complete current task-definition set, including disabled tasks, and submit it to the bot's local `%steward` through `%project`. The submitted definitions SHALL exclude cron job `state` and execution events.

#### Scenario: Task definitions are available at startup

- **WHEN** OpenClaw emits `gateway_start` and the current task-definition set is available
- **THEN** the harness reads all tasks with disabled tasks included and submits the complete definition set to `%steward` through `%project`

#### Scenario: Task definitions are not yet available at startup

- **WHEN** OpenClaw emits `gateway_start` but the current task-definition set is not yet available
- **THEN** the harness keeps the existing `%steward` projection and retries the complete read while the gateway remains active

#### Scenario: Startup list is empty

- **WHEN** the complete startup read succeeds and returns no tasks
- **THEN** the integration projects an empty task set to `%steward`

### Requirement: Cron changes trigger complete rereads

The OpenClaw harness SHALL treat every `cron_changed` event as a reconciliation trigger rather than applying the event payload as a task delta. Each event SHALL request reconciliation from a complete read, subject to the serialization and coalescing requirements below.

#### Scenario: Cron change occurs

- **WHEN** OpenClaw emits `cron_changed`
- **THEN** the harness reads the complete current task set, including disabled tasks, and submits it through `%project` rather than applying the event payload directly

#### Scenario: Execution-related cron event occurs

- **WHEN** a `cron_changed` event describes execution activity rather than a task-definition change
- **THEN** the harness handles it through the same complete-reread reconciliation path and omits execution-event fields and cron job state from the submitted definitions

### Requirement: Reconciliation is serialized and coalesced

The OpenClaw harness SHALL allow at most one complete read-and-submit operation to be outstanding. Triggers received while that operation is outstanding SHALL cause one additional complete reconciliation after the outstanding operation settles, and multiple such triggers SHALL be coalesced into that one follow-up operation.

#### Scenario: Trigger arrives during listing

- **WHEN** one or more triggers arrive while the integration is listing tasks
- **THEN** no concurrent list-and-project operation starts and a follow-up complete reconciliation runs afterward

#### Scenario: Trigger arrives during Steward delivery

- **WHEN** one or more triggers arrive while a complete snapshot is being delivered to `%steward`
- **THEN** the current delivery finishes before one follow-up complete reconciliation begins

#### Scenario: Many triggers arrive while busy

- **WHEN** multiple triggers arrive during one outstanding reconciliation
- **THEN** the harness coalesces them into one subsequent complete read and replacement

### Requirement: Failed reconciliation is retried

A failed complete read or `%project` delivery SHALL NOT clear the last successfully stored projection. The OpenClaw harness SHALL retry the complete reconciliation while the gateway remains active without starting a concurrent reconciliation.

#### Scenario: Complete read fails

- **WHEN** reading the complete task-definition set fails
- **THEN** the harness retains the last successful `%steward` projection and retries the complete reconciliation

#### Scenario: Steward delivery fails

- **WHEN** `%steward` does not accept a `%project` submission
- **THEN** the harness retains the last successful projection and retries without starting a concurrent delivery

#### Scenario: Gateway stops

- **WHEN** OpenClaw emits `gateway_stop`
- **THEN** the integration stops starting retries and new reconciliations while preserving the last successfully stored `%steward` projection

### Requirement: Mirror freshness is best-effort

The `%steward` automation state SHALL represent the latest complete OpenClaw task list that the integration successfully read and delivered. The system SHALL NOT claim that this mirror is authoritative or current while OpenClaw is offline or before a successful startup/change-triggered reconciliation.

#### Scenario: Change is missed while the integration is offline

- **WHEN** OpenClaw task state changes without a corresponding successful reconciliation
- **THEN** `%steward` retains its last successful snapshot until a later gateway startup or cron-change trigger repairs it

#### Scenario: Reconciliation succeeds after stale period

- **WHEN** a later complete reconciliation succeeds after the mirror has been stale
- **THEN** `%steward` atomically replaces the stale task set with the newly read complete set

### Requirement: Steward atomically commits the current task projection

The local `%steward` `%project` automation action SHALL accept a complete list of task definitions from the local OpenClaw harness only when the poke's Gall source is the local ship. It SHALL atomically commit the submitted complete projection as the current task set, keyed by OpenClaw task ID. Repeating an equivalent `%project` submission SHALL leave the same stored result.

#### Scenario: Complete snapshot is accepted

- **WHEN** the local OpenClaw harness submits a valid `%project` action through the local ship source
- **THEN** `%steward` stores exactly those task definitions and removes every task absent from the snapshot

#### Scenario: Empty snapshot is accepted

- **WHEN** the local OpenClaw harness submits `%project` with an empty task list through the local ship source
- **THEN** `%steward` stores no automation tasks

#### Scenario: Equivalent snapshot is repeated

- **WHEN** the local OpenClaw harness submits the same logical `%project` action more than once through the local ship source
- **THEN** `%steward` retains the same task projection without duplicate records

#### Scenario: Foreign ship submits a snapshot

- **WHEN** a source other than the local ship submits a `%project` action
- **THEN** `%steward` rejects it without changing stored tasks

### Requirement: Task definitions preserve supported OpenClaw fields

Each stored task SHALL preserve its ID and the definition fields supplied by OpenClaw for agent ownership, display metadata, enabled state, schedule, session target, wake mode, payload, and creation/update timestamps when those fields are present. The projection SHALL support `cron`, `at`, and `every` schedule variants and SHALL not store the cron job `state` object.

#### Scenario: Fully populated task is mirrored

- **WHEN** a complete snapshot contains a task with supported optional definition fields
- **THEN** the stored task and JSON representation preserve those fields and their absence/presence semantics

#### Scenario: Optional fields are absent

- **WHEN** an OpenClaw task omits optional definition fields
- **THEN** `%steward` accepts and stores the task without inventing values for those fields

### Requirement: Released Steward state migrates safely

Upgrading the released `%steward` agent SHALL preserve its existing core configuration, trusted-bot set, lens state, and gateway state while initializing the new automation state with an empty task map. Recognizable deployed state SHALL NOT be silently reset when migration fails.

#### Scenario: Existing Steward state is upgraded

- **WHEN** `%steward` loads a valid state from the released version
- **THEN** it migrates all existing core, lens, and gateway values unchanged and initializes automation tasks as empty

#### Scenario: Fresh Steward installation starts

- **WHEN** `%steward` initializes without prior state
- **THEN** it creates the current state shape with an empty automation task map

#### Scenario: Deployed state cannot be migrated

- **WHEN** `%steward` recognizes a deployed state version but cannot migrate it safely
- **THEN** loading fails visibly rather than silently replacing existing data with default state

### Requirement: Local JSON task scry

`%steward` SHALL expose a local-only scry at `/x/v1/automation/tasks` that returns the complete currently stored task projection as JSON. The response SHALL contain a `tasks` array, and each task SHALL use the supported OpenClaw field names and JSON value shapes while omitting cron job state.

#### Scenario: Stored tasks are read

- **WHEN** a local client scries `/x/v1/automation/tasks` after a snapshot has been accepted
- **THEN** it receives a JSON object containing every currently stored task exactly once in the `tasks` array

#### Scenario: No tasks are stored

- **WHEN** a local client scries `/x/v1/automation/tasks` while the projection is empty
- **THEN** it receives `{ "tasks": [] }`

#### Scenario: Foreign client attempts to read tasks

- **WHEN** a non-local source attempts the automation task scry
- **THEN** `%steward` rejects the request
