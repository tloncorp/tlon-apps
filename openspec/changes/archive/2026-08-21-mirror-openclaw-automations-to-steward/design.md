## Context

See `proposal.md` for motivation and
`specs/steward-automation-projection/spec.md` for required behavior.

`%steward` is a released Gall agent whose persisted state already
contains core configuration, lens state, and gateway state. Adding
automation therefore requires a compatible state migration rather than
an in-place shape change or reset.

The pinned OpenClaw version provides `gateway_start`, `cron_changed`,
`gateway_stop`, and access to the current cron service through
`getCron()`, but not the newer `cron_reconciled` hook. Gateway startup
can also precede cron-service readiness. These constraints make the
mirror best-effort: OpenClaw remains authoritative, while `%steward`
stores the latest complete snapshot the harness successfully
submitted.

## Goals / Non-Goals

**Goals:**

- Establish a repairable projection boundary between the OpenClaw
    harness and `%steward`.
- Prevent concurrent reconciliation from leaving an older snapshot
    as the final stored result.
- Preserve all released `%steward` state while adding automation
    storage.
- Keep the automation protocol independently evolvable from existing
    Steward modules.

**Non-Goals:**

- Making `%steward` authoritative for scheduling or execution.
- Providing freshness guarantees while OpenClaw is unavailable.
- Extending the OpenClaw compatibility floor.
- Designing cross-ship synchronization or task mutation APIs.

## Decisions

### 1. Commit complete snapshots atomically with `%project`

The OpenClaw harness will submit the complete current task-definition
set through `%project` as a list of identified task entries.
`%steward` will validate the complete input, separate each ID from its
task definition, and commit the resulting task map in one state
transition. Task IDs provide stable map keys, and a successful
`%project` with an empty task list represents no configured tasks.

The `%project` name describes committing the harness's complete
external projection rather than mutating individual tasks. This makes
startup and later cron events use the same repair path, makes repeated
submissions idempotent, and removes tasks that disappeared while the
integration was unavailable.

**Alternative considered:** Applying `cron_changed` payloads as
additions, updates, or removals would use less data, but those events
are not an ordered, durable delta log and cannot repair missed events.

### 2. Use the current OpenClaw hook surface without upgrading

Gateway startup and every cron-change event will trigger a complete
read of the current cron task set, including disabled tasks. The
harness will obtain that set through the cron access available in the
pinned OpenClaw version. Gateway stop ends active reconciliation
without clearing the durable Steward snapshot.

Unavailable cron access is treated as temporary failure, not as an
empty task list. This distinction prevents scheduler startup timing or
disablement from accidentally erasing the last successful projection.

**Alternative considered:** Upgrading to a version with
`cron_reconciled` would provide a stronger lifecycle boundary, but
upgrading OpenClaw is outside this change.

### 3. Serialize and coalesce reconciliation

Only one complete read-and-submit reconciliation will be active at a
time. Triggers received while it is active will be coalesced into one
follow-up reconciliation. Failed reads or submissions will be retried
while the gateway remains active.

Serialization prevents overlapping submissions from completing out of
order. Coalescing preserves repair behavior without issuing one full
read for every event in a burst. The detailed worker lifecycle, retry
policy, and race tests belong in the implementation tasks rather than
this design.

**Alternative considered:** Independent work per event is simpler
locally, but an older request could finish last and overwrite a newer
snapshot.

### 4. Store typed task definitions and exclude execution state

The automation model will represent each submitted OpenClaw job as an
identified task entry pairing its ID with a typed task definition.
`%steward` will store `(map @t task)`, using the ID only as the map
key and not duplicating it inside the stored task value. The task
definition will cover the supported fields and schedule variants
identified by the capability spec. Optional values will remain
optional, and boundary conversion will preserve OpenClaw's JSON
shapes. Cron job state and execution events will not be part of the
stored model.

A typed model gives `%steward` a versioned, validated representation
and prevents execution tracking from entering scope implicitly.

Testing will preserve the projection boundary. TypeScript
normalization tests will consume JSON fixtures captured from actual
`getCron().list()` traces, including fields intentionally omitted from
the projection. Once the production JSON marks exist, Hoon JSON
conversion tests will parse normalized `%project` JSON through the
production `dejs` path and serialize task maps through the production
`enjs` path. Hand-constructed tests will remain only for focused
primitive conversion boundaries.

**Alternatives considered:** Storing the normalized projection as
opaque JSON would reduce backend conversion work and schema coupling,
but would delegate structural validation to the harness. Storing raw
OpenClaw job JSON would additionally persist fields outside this
change.

### 5. Use separate action and task-map marks

The automation module will use an independently versioned `%project`
action mark for complete projection commits and a dedicated task-map
mark for the JSON scry. The scry mark will directly accept
`(map @t task)` and grow it to `{ "tasks": { "<id>": <task>, ... } }`;
the JSON object key will be the sole serialized task ID. Automation
has no subscription surface or heterogeneous scry results that would
justify a tagged `$update` union. Keeping the inbound action and
outbound task-map representations separate allows either side to
evolve independently.

The OpenClaw harness is the submitting actor. `%steward` does not
authenticate a distinct harness identity in this increment; it
authorizes `%project` pokes through the existing local Gall source
boundary and rejects foreign poke sources. Dotket scries execute
locally against the current agent state and have no foreign source to
authorize.

**Alternative considered:** Reusing one mark for both directions would
conflate action parsing with scry serialization. A tagged scry-result
union would duplicate information already carried by the scry path and
dedicated task-map mark.

### 6. Add an explicit migration from the released Steward state

A new persisted state version will add the automation slice. Loading
the released version will copy core configuration, trusted bots, lens
state, and gateway state unchanged, then initialize automation as
empty. Fresh installations will start directly with the new state
version.

Migration failure must be visible rather than falling back to default
state. This protects existing deployed data from accidental reset.

**Alternative considered:** Extending the released state shape in
place or resetting state on decode failure risks making deployed state
unloadable or silently losing existing data.

### 7. Keep projection and telemetry failures isolated

The existing cron telemetry observer and the new Steward projection
may share access to the current cron service, but neither path will
depend on the other's success. Projection delivery failures must not
suppress telemetry, and telemetry failures must not stop later
projection attempts.

This retains the current operational observer while keeping the new
durable projection independently testable and recoverable.

**Alternative considered:** Combining both behaviors into one
operation would reduce calls but would couple unrelated failure
handling and broaden the impact of either subsystem failing.

### 8. Fail closed when multiple Tlon accounts can run

The v1 adapter reads one process-global monitor connection slot and
cannot identify which account published it. Projection will therefore
run only when configuration contains exactly one enabled, fully
configured Tlon account. Zero runnable accounts leave projection
inactive. More than one runnable account stops the active
reconciliation epoch, ignores later change triggers, and preserves
each ship's last accepted Steward snapshot rather than selecting the
last monitor to publish.

Disabled or incomplete account entries do not make the active
connection ambiguous and therefore do not disable projection. The
eligibility check reloads current OpenClaw configuration for every
gateway-start and cron-change hook, so one-to-zero and one-to-many
configuration transitions fail closed on the next projection trigger
even when no replacement account monitor starts.

**Alternative considered:** Indexing monitor connections by account
and fanning every complete snapshot out to every bot ship would provide
full multi-account support, but requires per-account delivery,
acknowledgement, retry, and shutdown state and is outside this v1
projection.

## Risks / Trade-offs

- **[Startup can precede cron-service readiness]** → Retry complete
    reconciliation while preserving the last successful snapshot.
- **[Missed events or process crashes can leave the mirror stale]**
    → Reconcile from a complete list on the next gateway startup or
    observed cron change, and document best-effort freshness.
- **[Execution-related events can cause unnecessary full reads]** →
    Coalesce triggers; prefer a simple repair path until operational
    evidence requires filtering.
- **[Future OpenClaw task variants may not fit the v1 action and
    task types]** → Reject unsupported `%project` submissions without
    changing the last known-good projection, then add a later protocol
    version.
- **[Large snapshots increase poke and loom usage]** → Test
    realistic payloads and defer explicit limits until usage data
    justifies them.
- **[Migration defects could damage released state]** → Test
    migration with populated values in every existing state slice and
    fail rather than reset on decode errors.

## Migration Plan

1. During development, introduce the new current state shape with a
   deliberately failing released-state migration stub, nuke only the
   disposable development agent state, and initialize the new state
   fresh.
2. Implement and exercise `%project`, storage, marks, and the scry
   against that fresh state.
3. After the state and API shapes have been validated in practice,
   implement and test migration from the released state.
4. Deploy the completed migration, automation types and marks,
   storage, and scry before or together with the harness projection.
5. Enable the harness projection; its first successful startup
   reconciliation populates the initially empty automation slice.
6. To roll back the harness integration, disable projection and leave
   the last Steward snapshot intact; OpenClaw remains authoritative.
