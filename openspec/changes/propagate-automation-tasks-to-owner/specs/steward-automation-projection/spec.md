# steward-automation-projection Specification (Delta)

## MODIFIED Requirements

### Requirement: JSON task scry

`%steward` SHALL expose a scry at `/x/v1/automation/tasks` that
returns the complete currently stored per-ship task state as JSON in
a dedicated versioned scry mark: the bare ship-keyed object with no
wrapper key, each value an ID-keyed task map. The dotket scry SHALL
execute locally against the current agent state and SHALL NOT
authorize a caller source. Each task value SHALL use the supported
OpenClaw field names and JSON value shapes while omitting the task
ID and cron job state; the property name SHALL be the sole
serialized task ID.

#### Scenario: Stored tasks are read

- **WHEN** a client scries `/x/v1/automation/tasks` after a snapshot
    has been accepted
- **THEN** it receives a JSON object containing the local ship's
    entry with one property per stored task ID and whose values do
    not duplicate those IDs

#### Scenario: No tasks are stored

- **WHEN** a client scries `/x/v1/automation/tasks` while no task
    state is stored
- **THEN** it receives `{}`
