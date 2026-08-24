# steward-automation-sync Specification (Delta)

## Purpose

Keep the owner ship's `%steward` automation store in sync with each
trusted bot's task mirror over a Gall subscription, and broadcast
task state and changes to the owner's clients through a subscription
and scry surface.
## ADDED Requirements

### Requirement: Bot broadcasts automation updates

The bot-side `%steward` SHALL expose an automation watch path that,
on subscribe, gives one initial fact carrying the complete currently
stored task projection. When an accepted `%project` action changes
the stored task map, `%steward` SHALL give delta facts on that path
describing each added or changed task and each removed task ID. An
accepted `%project` that leaves the stored map unchanged SHALL NOT
emit delta facts. Updates SHALL carry the harness-neutral task
representation with no harness-specific fields beyond the existing
task type, and SHALL NOT embed a ship identity: a subscriber
attributes the feed to the ship it subscribed to.

#### Scenario: Subscriber receives the current projection

- **WHEN** a permitted source subscribes to the bot's automation
    watch path
- **THEN** it receives one initial fact containing the complete
    current task projection, with no ship identity in the payload

#### Scenario: Projection change produces deltas

- **WHEN** an accepted `%project` adds, modifies, and removes tasks
    relative to the stored map
- **THEN** subscribers receive delta facts covering each added or
    changed task and each removed task ID

#### Scenario: Equivalent projection produces no deltas

- **WHEN** an accepted `%project` carries a task set equal to the
    stored map
- **THEN** no delta facts are emitted

### Requirement: Automation watch authorization is per-path

The bot's automation watch path SHALL admit subscriptions from the
local ship and from the configured owner ship only. Every other
`%steward` watch path SHALL remain local-only. A subscription attempt
from any other source SHALL be rejected.

#### Scenario: Configured owner subscribes cross-ship

- **WHEN** the configured owner ship subscribes to the bot's
    automation watch path
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

### Requirement: Owner mirrors trusted bots

The owner-side `%steward` SHALL maintain a per-bot mirror of
automation task state, keyed by bot ship. It SHALL subscribe to a
bot's automation watch path when that bot enters the trusted-bot set
and SHALL leave the subscription and delete that bot's mirrored tasks
when the bot is untrusted. Trusting the local ship SHALL NOT create
a subscription: the local projection is served on the client surface
directly and is never duplicated into the mirror.

#### Scenario: Bot becomes trusted

- **WHEN** the owner pokes `%trust-bot` for a bot ship
- **THEN** the owner's `%steward` subscribes to that bot's automation
    watch path

#### Scenario: Bot becomes untrusted

- **WHEN** the owner pokes `%untrust-bot` for a mirrored bot
- **THEN** the owner's `%steward` leaves the automation subscription
    and removes that bot's mirrored tasks

#### Scenario: Local ship is trusted

- **WHEN** the owner pokes `%trust-bot` for the local ship
- **THEN** no automation subscription is created and the mirror does
    not gain a local-ship entry

### Requirement: Owner store converges on bot state

The owner-side `%steward` SHALL attribute every received automation
fact to the bot whose subscription delivered it, never to a
peer-supplied payload field. On receiving a snapshot fact for a bot,
it SHALL atomically replace that bot's mirrored task map with the
snapshot, removing every task absent from it. On receiving delta
facts, it SHALL upsert the carried task for an add/change and remove
the carried ID for a removal; removing an ID that is not mirrored
SHALL leave the mirror unchanged. After a snapshot and its subsequent
deltas are applied, the owner's mirrored task map for that bot SHALL
equal the bot's stored projection.

#### Scenario: Snapshot replaces the per-bot mirror

- **WHEN** the owner receives a snapshot fact for a mirrored bot
- **THEN** that bot's mirror equals exactly the snapshot's task map,
    with previously mirrored tasks absent from the snapshot removed

#### Scenario: Deltas keep the mirror in sync

- **WHEN** the bot's projection changes on task create, update, and
    delete and the corresponding delta facts arrive
- **THEN** the owner's mirror for that bot matches the bot's stored
    projection

#### Scenario: Removal of an unknown task ID

- **WHEN** a removal delta arrives for an ID not present in the
    bot's mirror
- **THEN** the mirror is unchanged and the agent does not crash

### Requirement: Owner subscription self-heals

When the owner's automation subscription to a bot is kicked, the
owner-side `%steward` SHALL resubscribe, and the resulting initial
snapshot fact SHALL repair any updates missed while unsubscribed. A
rejected (nacked) automation watch SHALL be surfaced visibly in logs
and SHALL NOT crash the agent or disturb existing mirrored state.
Re-poking `%trust-bot` for an already-trusted bot SHALL re-establish
the subscription when none is live and SHALL NOT duplicate one that
is.

#### Scenario: Subscription is kicked

- **WHEN** the bot kicks the owner's automation subscription
- **THEN** the owner resubscribes and the initial snapshot fact
    replaces that bot's mirror with the bot's current projection

#### Scenario: Watch is rejected

- **WHEN** an automation watch attempt is nacked
- **THEN** the failure is logged and previously mirrored state is
    preserved

#### Scenario: Trust is re-poked after a rejected watch

- **WHEN** a bot's automation watch was nacked and the owner
    re-pokes `%trust-bot` for that bot
- **THEN** the owner attempts the subscription again

#### Scenario: Trust is re-poked while subscribed

- **WHEN** the owner re-pokes `%trust-bot` for a bot with a live
    automation subscription
- **THEN** no duplicate subscription is created

### Requirement: Client subscription yields state then deltas

The owner-side `%steward` SHALL expose a local-only client watch
path serving the combined automation view: the local ship's task
projection when it is non-empty, attributed to the local ship, plus
the mirrored task state of every mirrored bot, each attributed to
its bot ship. On subscribe it SHALL give initial facts carrying that
combined view. When the mirror changes or an accepted `%project`
changes the local projection, it SHALL give facts carrying the
corresponding per-bot snapshot or delta so a subscribed client
converges on the combined view.

#### Scenario: Client subscribes

- **WHEN** a local client subscribes to the owner's automation
    client watch path
- **THEN** it receives the current mirrored task state for every
    mirrored bot and the local projection when non-empty, attributed
    per bot

#### Scenario: Mirror change reaches the client

- **WHEN** the owner's mirror changes for a bot after a client
    subscribed
- **THEN** the client receives a fact for that change attributed to
    that bot, and applying received facts in order reproduces the
    combined view

#### Scenario: Self-owned bot serves its own tasks

- **WHEN** a client subscribes on a self-owned bot ship whose local
    projection is non-empty
- **THEN** it receives that projection attributed to the local ship,
    with no subscription from the ship to itself and no local-ship
    mirror entry

#### Scenario: Client subscribes with an empty view

- **WHEN** a local client subscribes while no bot is mirrored and
    the local projection is empty
- **THEN** the subscription is accepted and no task state facts
    precede later changes

### Requirement: Automation updates serialize to JSON

The projection feed and the client feed SHALL be carried by
separate, independently versioned marks. Both JSON forms SHALL
identify the update variant and serialize task values with the same
field names and value shapes as the existing automation task JSON,
without duplicating a task ID inside its task value. The client-feed
form SHALL attribute the bot ship; the projection-feed form SHALL
NOT carry a ship.

#### Scenario: Projection update is serialized

- **WHEN** a projection-feed snapshot or delta is grown to JSON
- **THEN** the result identifies the update variant and carries the
    task map, or the task ID and value, in the established task JSON
    shape, with no ship field

#### Scenario: Client update is serialized

- **WHEN** a client-feed snapshot or delta is grown to JSON
- **THEN** the result identifies the update variant and the bot
    ship, carrying the task map, or the task ID and the task value
    only for an add/change

### Requirement: Mirrored tasks are scriable

The owner-side `%steward` SHALL expose a scry returning the combined
automation view as JSON keyed by bot ship — every mirrored bot plus
the local ship's projection when it is non-empty — with each bot's
value using the established ID-keyed task-map JSON shape. The scry
SHALL execute locally against current agent state without authorizing
a caller source.

#### Scenario: Mirrored state is read

- **WHEN** a client scries the mirror path while bots are mirrored
- **THEN** it receives a JSON object with one property per mirrored
    bot ship — plus the local ship when its projection is non-empty —
    whose value is that bot's ID-keyed task map

#### Scenario: Empty view is read

- **WHEN** a client scries the mirror path while no bot is mirrored
    and the local projection is empty
- **THEN** it receives the empty-mirror JSON shape rather than an
    error
