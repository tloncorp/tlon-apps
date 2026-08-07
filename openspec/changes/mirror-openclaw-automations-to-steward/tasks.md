## 1. Automation Contract and Conversions

- [ ] 1.1 Finalize the v1 automation types for supported task definitions, automation state, complete replacement actions, and task-list updates, excluding cron job state and execution events.
- [ ] 1.2 Complete the Hoon millisecond, date, and duration conversions required by supported schedule and timestamp fields.
- [ ] 1.3 Extend conversion tests with boundary, round-trip, optional-field, and supported-schedule cases.

## 2. Steward State, Storage, and JSON API

- [ ] 2.1 Introduce a new Steward state version and migrate released state while preserving populated core, trusted-bot, lens, and gateway values and initializing automation empty.
- [ ] 2.2 Add migration tests for populated released state, fresh initialization, persistence, and visible failure instead of silent reset.
- [ ] 2.3 Implement atomic complete replacement keyed by task ID, including empty and repeated snapshots, removal by omission, duplicate-ID rejection, and unchanged state after invalid input.
- [ ] 2.4 Enforce the local Gall source boundary for automation replacement and reject foreign sources without changing state.
- [ ] 2.5 Add the versioned automation action and update marks with validated JSON/noun conversion and no cron job state.
- [ ] 2.6 Add the local `/x/v1/automation/tasks` scry with deterministic task ordering and `{ "tasks": [] }` for empty state.
- [ ] 2.7 Extend Steward tests for replacement, access control, supported task fields, persistence, JSON conversion, and scry behavior.

## 3. OpenClaw Harness Projection

- [ ] 3.1 Add task normalization that preserves supported definition fields, omits execution state, and produces complete Steward replacement payloads.
- [ ] 3.2 Add a local Steward submission adapter using the monitor-published ship connection and successful poke acknowledgement.
- [ ] 3.3 Trigger complete reads with disabled tasks included after `gateway_start` and every `cron_changed` event using the pinned OpenClaw cron access.
- [ ] 3.4 Serialize reconciliation, coalesce triggers received while busy into one follow-up, and prevent snapshots from overtaking one another.
- [ ] 3.5 Retry unavailable cron reads and failed Steward submissions while the gateway remains active, preserving the last successful projection.
- [ ] 3.6 Stop new reconciliation and retry activity on `gateway_stop` without clearing the durable Steward snapshot.
- [ ] 3.7 Replace the temporary diagnostic handler with projection registration while keeping cron telemetry failures isolated.

## 4. Projection Verification

- [ ] 4.1 Test normalization of optional fields and all supported schedules, inclusion of disabled tasks, and omission of cron job state.
- [ ] 4.2 Test startup reconciliation when cron access is ready, temporarily unavailable, empty, and restored after a stale period.
- [ ] 4.3 Test complete rereads after definition-related and execution-related `cron_changed` events.
- [ ] 4.4 Test serialized delivery, coalesced triggers, trigger arrival during submission, and the worker-exit race.
- [ ] 4.5 Test read failures, submission failures, retry behavior, acknowledgement failures, and gateway shutdown.
- [ ] 4.6 Add ship-level verification that additions, updates, removals, disabled tasks, and restart reconciliation appear in the automation JSON scry.

## 5. Documentation and Validation

- [ ] 5.1 Document the Steward automation state, migration, local harness replacement action, best-effort OpenClaw flow, exclusions, and JSON scry.
- [ ] 5.2 Run the targeted Hoon tests, applicable backend suite, and desk compilation on the development ship.
- [ ] 5.3 Run OpenClaw formatting, linting, type checking, unit tests, and relevant integration tests against the existing pinned runtime.
- [ ] 5.4 Run strict OpenSpec validation and verify implementation coverage for every capability scenario.
