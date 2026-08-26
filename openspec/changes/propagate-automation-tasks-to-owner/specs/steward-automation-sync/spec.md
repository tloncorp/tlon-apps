# steward-automation-sync Specification (Delta)

## Purpose

Keep the owner ship's `%steward` automation store in sync with each
trusted bot's task projection over a Gall subscription, and serve the
resulting per-ship task state to subscribers and clients through a
single feed and scry surface.

## ADDED Requirements

### Requirement: Automation state is served on a single feed

`%steward` SHALL expose one automation watch path at
`/v1/automation/tasks` serving the per-ship task state. On subscribe
it SHALL give exactly one initial fact carrying the complete
ship-keyed task map, including when the map is empty. When an
entry's tasks change — through an accepted `%project` or an applied
subscription fact — the path SHALL give per-task delta facts, each
naming the ship whose entry they touch. When an entry is deleted on
untrust, the path SHALL give an entry-removal fact, distinct on the
wire from an empty entry. A change not expressible as task-level
deltas — an entry appearing, in the extreme with no tasks at all —
SHALL be conveyed by a
fresh complete snapshot fact; subscribers SHALL treat every snapshot
fact as a full replacement. An accepted `%project` that leaves the
stored map unchanged SHALL NOT emit any facts. Updates SHALL carry
the harness-neutral task representation with no harness-specific
fields beyond the existing task type.

#### Scenario: Subscriber receives the complete state

- **WHEN** a permitted source subscribes to the automation watch
    path
- **THEN** it receives exactly one initial fact carrying the
    complete ship-keyed task map

#### Scenario: Subscriber receives the empty state

- **WHEN** a permitted source subscribes while the task map is empty
- **THEN** it receives one initial fact carrying the empty map

#### Scenario: Projection change produces deltas

- **WHEN** an accepted `%project` adds, modifies, and removes tasks
    relative to the local ship's entry
- **THEN** subscribers receive delta facts naming the local ship,
    covering each added or changed task and each removed task ID

#### Scenario: Equivalent projection produces no facts

- **WHEN** an accepted `%project` carries a task set equal to the
    local ship's stored entry
- **THEN** no facts are emitted

#### Scenario: First empty projection creates the local entry

- **WHEN** the first accepted `%project` carries an empty task list
    while a subscriber is attached
- **THEN** the subscriber receives a fact after which the local
    ship's entry is present and empty

#### Scenario: Untrusted bot's removal reaches subscribers

- **WHEN** `%untrust-bot` deletes a mirrored bot's entry while a
    subscriber is attached
- **THEN** the subscriber receives an entry-removal fact for that
    ship, after which it holds no entry for it

#### Scenario: Applied bot updates are re-served

- **WHEN** the owner applies a trusted bot's snapshot or deltas to
    its store while a client is subscribed
- **THEN** the client receives corresponding facts naming that bot,
    and applying received facts in order reproduces the owner's
    store

#### Scenario: Self-owned bot serves its own tasks

- **WHEN** a client subscribes on a self-owned bot ship whose local
    projection is non-empty
- **THEN** the initial snapshot contains that projection under the
    local ship's key, with no subscription from the ship to itself

### Requirement: Automation watch authorization is per-path

The automation watch path SHALL admit subscriptions from the local
ship and from the configured owner ship only. Every other `%steward`
watch path SHALL be local-only. A subscription attempt from any
other source SHALL be rejected. When the configured owner changes,
existing automation subscriptions from sources no longer permitted
SHALL be kicked.

#### Scenario: Configured owner subscribes cross-ship

- **WHEN** the configured owner ship subscribes to the automation
    watch path
- **THEN** the subscription is accepted

#### Scenario: Unrelated ship subscribes

- **WHEN** a ship that is neither the local ship nor the configured
    owner subscribes to the automation watch path
- **THEN** the subscription is rejected

#### Scenario: No owner is configured

- **WHEN** no owner is configured and a remote ship subscribes to
    the automation watch path
- **THEN** the subscription is rejected while local subscriptions
    remain accepted

#### Scenario: Owner is replaced

- **WHEN** core configuration sets a new owner while the previous
    owner holds an automation subscription
- **THEN** the previous owner's subscription is kicked and it
    receives no further automation facts

### Requirement: Owner mirrors trusted bots

The owner-side `%steward` SHALL maintain per-bot task entries for
trusted bots, keyed by bot ship. It SHALL subscribe to a bot's
automation watch path when that bot enters the trusted-bot set and
SHALL leave the subscription and delete that bot's entry when the
bot is untrusted — except the local ship: untrusting the local ship
SHALL NOT emit a leave or touch its entry, which is owned by
`%project`. A trusted bot's entry is created only when a received
snapshot contains it; subscribing SHALL NOT create an entry, so a
failed or unanswered subscription leaves nothing to clean up.
Trusting the local ship SHALL NOT create a subscription: the local
ship's entry is written by accepted `%project` actions, never by a
subscription.

#### Scenario: Bot becomes trusted

- **WHEN** the owner pokes `%trust-bot` for a bot ship
- **THEN** the owner's `%steward` subscribes to that bot's
    automation watch path

#### Scenario: Trusted bot has not yet delivered a snapshot

- **WHEN** a bot is trusted but no snapshot fact has arrived from it
- **THEN** the store has no entry for that bot

#### Scenario: Bot becomes untrusted

- **WHEN** the owner pokes `%untrust-bot` for a mirrored bot
- **THEN** the owner's `%steward` leaves the automation subscription
    and removes that bot's entry

#### Scenario: Local ship is trusted

- **WHEN** the owner pokes `%trust-bot` for the local ship
- **THEN** no automation subscription is created and the local
    ship's entry is unaffected

#### Scenario: Local ship is untrusted

- **WHEN** the owner pokes `%untrust-bot` for the local ship
- **THEN** no leave is emitted and the local ship's entry is
    unaffected

#### Scenario: Bot is untrusted before its first snapshot

- **WHEN** `%untrust-bot` targets a bot that is subscribed but has
    delivered no snapshot fact
- **THEN** the subscription is left and no entry is ever created for
    that bot

### Requirement: Owner store converges on bot state

The owner-side `%steward` SHALL apply only content attributed to the
bot whose subscription delivered it: entries and deltas naming any
other ship SHALL be ignored. On receiving a snapshot fact from a
bot, it SHALL replace that bot's entry with the bot's entry in the
snapshot, deleting the entry when the snapshot lacks it. On
receiving delta facts it SHALL upsert the carried task for an
add/change and remove the carried ID for a removal; removing an ID
that is not present SHALL leave the store unchanged, and a delta for
a ship with no entry SHALL be ignored rather than creating one.
After a snapshot and its subsequent deltas are applied, the owner's
entry for that bot SHALL equal the bot's stored projection.

#### Scenario: Snapshot replaces the bot's entry

- **WHEN** the owner receives a snapshot fact from a mirrored bot
- **THEN** that bot's entry equals exactly the bot's entry in the
    snapshot, with previously stored tasks absent from it removed

#### Scenario: Snapshot lacking the entry clears it

- **WHEN** the owner holds an entry for a bot and receives a
    snapshot from it that contains no entry for that bot
- **THEN** the bot's entry is deleted

#### Scenario: Deltas keep the store in sync

- **WHEN** the bot's projection changes on task create, update, and
    delete and the corresponding delta facts arrive
- **THEN** the owner's entry for that bot matches the bot's stored
    projection

#### Scenario: Removal of an unknown task ID

- **WHEN** a removal delta arrives for an ID not present in the
    bot's entry
- **THEN** the store is unchanged and the agent does not crash

#### Scenario: Foreign-attributed content is ignored

- **WHEN** a fact delivered on one bot's subscription names a
    different ship
- **THEN** that content is not applied to the store

### Requirement: Owner subscription self-heals

When the owner's automation subscription to a bot is kicked and the
bot is still in the trusted-bot set, the owner-side `%steward` SHALL
resubscribe, and the resulting initial snapshot fact SHALL repair
any updates missed while unsubscribed. It SHALL NOT resubscribe on a
kick for a bot no longer in the trusted-bot set. A rejected (nacked)
automation watch SHALL be surfaced visibly in logs and SHALL NOT
crash the agent or disturb existing stored state. Re-poking
`%trust-bot` for an already-trusted bot SHALL re-establish the
subscription when none is live and SHALL NOT duplicate one that is.

#### Scenario: Subscription is kicked

- **WHEN** a still-trusted bot's automation subscription is kicked
- **THEN** the owner resubscribes and the initial snapshot fact
    replaces that bot's entry with the bot's current projection

#### Scenario: Kick after untrust

- **WHEN** a kick arrives for a bot no longer in the trusted-bot set
- **THEN** no resubscription is attempted

#### Scenario: Watch is rejected

- **WHEN** an automation watch attempt is nacked
- **THEN** previously stored state is preserved and the agent does
    not crash

#### Scenario: Trust is re-poked after a rejected watch

- **WHEN** a bot's automation watch was nacked and the owner
    re-pokes `%trust-bot` for that bot
- **THEN** the owner attempts the subscription again

#### Scenario: Trust is re-poked while subscribed

- **WHEN** the owner re-pokes `%trust-bot` for a bot with a live
    automation subscription
- **THEN** no duplicate subscription is created

### Requirement: Automation updates serialize to JSON

Automation updates SHALL be carried by a single versioned mark whose
JSON form identifies the update variant. A snapshot SHALL carry the
ship-keyed task map; a task delta SHALL name the ship and task ID,
carrying the task value only for an add/change; an entry removal
SHALL carry only the ship. Task values SHALL use the same field
names and value shapes as the established automation task JSON,
without duplicating a task ID inside its task value.

#### Scenario: Snapshot is serialized

- **WHEN** a snapshot update is grown to JSON
- **THEN** the result identifies the variant and carries the
    ship-keyed object whose values are ID-keyed task maps

#### Scenario: Deltas are serialized

- **WHEN** a task delta or entry removal is grown to JSON
- **THEN** the result identifies the variant and the ship, carrying
    the task ID (and the task value only for an add/change) for a
    task delta, and only the ship for an entry removal

### Requirement: Automation state is scriable

`%steward` SHALL expose a scry at `/x/v1/automation/tasks` returning
the complete ship-keyed task state as the feed's snapshot variant,
in the same mark and JSON form: a `tasks` object keyed by ship whose
values are ID-keyed task maps, the empty state as an empty `tasks`
object. The scry SHALL execute locally against current agent state
without authorizing a caller source.

#### Scenario: State is read

- **WHEN** a client scries the automation tasks path while entries
    exist
- **THEN** it receives the snapshot form with one property per
    entry, each value that ship's ID-keyed task map

#### Scenario: Empty state is read

- **WHEN** a client scries the automation tasks path while no
    entries exist
- **THEN** it receives the snapshot form with an empty `tasks`
    object rather than an error
