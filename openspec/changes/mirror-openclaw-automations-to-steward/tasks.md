## 1. Automation Types and Conversions

- [x] 1.1 Finalize the v1 automation types for identified inbound
        tasks, ID-free stored task definitions, automation state keyed
        by task ID, complete `%project` actions, and task-map scry
        results, excluding cron job state and execution events.
- [x] 1.2 Complete the Hoon millisecond, date, and duration
        conversions required by supported schedule and timestamp
        fields.
- [x] 1.3 Extend conversion tests with boundary, round-trip,
        optional-field, and supported-schedule cases.

## 2. Steward State, Storage, and JSON API

- [x] 2.1 Introduce the new current Steward state version with an
        empty automation slice for fresh initialization. Stub the
        released-state migration to fail visibly, and use a nuked
        disposable development agent while validating the new state
        shape.
- [x] 2.2 Implement atomic `%project` commits keyed by task ID,
        including empty and repeated projections, removal by omission,
        duplicate-ID rejection, and unchanged state after invalid
        input.
- [x] 2.3 Enforce the local Gall source boundary for `%project` and
        reject foreign sources without changing state.
- [x] 2.4 Add the versioned automation action mark and dedicated
        task-map scry mark with validated `%project` JSON/noun
        conversion, `{ "tasks": { "<id>": <task>, ... } }` JSON
        serialization, no duplicated IDs in task values, and no cron
        job state.
- [x] 2.5 Add the local `/x/v1/automation/tasks` scry that returns
        the stored task map and `{ "tasks": {} }` for empty state.
- [x] 2.6 Test the fresh-state implementation through the production
        marks and scry: populated, empty, repeated, invalid, and
        foreign `%project` submissions, supported task fields,
        persistence, JSON conversion, and scry behavior. Replace the
        hand-constructed type and schedule tests from 1.3 with
        realistic normalized `%project` JSON fixtures derived from
        captured OpenClaw traces while retaining focused conversion
        boundary tests.
- [ ] 2.7 After the state shape, storage behavior, marks, and scry
        have been validated in practice, implement released-state
        migration preserving populated core, trusted-bot, lens, and
        gateway values while initializing automation empty.
- [ ] 2.8 Add migration tests for populated released state, fresh
        initialization, persistence, and visible failure instead of
        silent reset.

## 3. OpenClaw Harness Projection

- [ ] 3.1 Add task normalization that preserves supported definition
        fields, omits execution state, and produces complete Steward
        `%project` payloads.
- [ ] 3.2 Add a local Steward adapter that submits `%project`
        through the monitor-published ship connection and requires
        successful poke acknowledgement.
- [ ] 3.3 Trigger complete reads with disabled tasks included after
        `gateway_start` and every `cron_changed` event using the
        pinned OpenClaw cron access.
- [ ] 3.4 Serialize reconciliation, coalesce triggers received while
        busy into one follow-up, and prevent snapshots from overtaking
        one another.
- [ ] 3.5 Retry unavailable cron reads and failed Steward
        submissions while the gateway remains active, preserving the
        last successful projection.
- [ ] 3.6 Stop new reconciliation and retry activity on
        `gateway_stop` without clearing the durable Steward snapshot.
- [ ] 3.7 Replace the temporary diagnostic handler with projection
        registration while keeping cron telemetry failures isolated.

## 4. Projection Verification

- [ ] 4.1 Using captured OpenClaw `getCron().list()` trace fixtures,
        test normalization of optional fields and all supported
        schedules, inclusion of disabled tasks, and omission of cron
        job state.
- [ ] 4.2 Test startup reconciliation when cron access is ready,
        temporarily unavailable, empty, and restored after a stale
        period.
- [ ] 4.3 Test complete rereads after definition-related and
        execution-related `cron_changed` events.
- [ ] 4.4 Test serialized delivery, coalesced triggers, trigger
        arrival during submission, and the worker-exit race.
- [ ] 4.5 Test read failures, submission failures, retry behavior,
        acknowledgement failures, and gateway shutdown.
- [ ] 4.6 Add ship-level verification that additions, updates,
        removals, disabled tasks, and restart reconciliation appear in
        the automation JSON scry.

## 5. Documentation and Validation

- [ ] 5.1 Document the Steward automation state, migration, local
        harness `%project` action and atomic projection-commit
        semantics, best-effort OpenClaw flow, exclusions, and JSON
        scry.
- [ ] 5.2 Run the targeted Hoon tests, applicable backend suite, and
        desk compilation on the development ship.
- [ ] 5.3 Run OpenClaw formatting, linting, type checking, unit
        tests, and relevant integration tests against the existing
        pinned runtime.
- [ ] 5.4 Run strict OpenSpec validation and verify implementation
        coverage for every capability scenario.
