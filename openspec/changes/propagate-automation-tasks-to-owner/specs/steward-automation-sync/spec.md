# steward-automation-sync Specification (Delta)

## Purpose

Keep the owner ship's `%steward` automation store in sync with each
trusted bot's task projection over a Gall subscription, and broadcast
task state and changes to the owner's clients through a subscription
and scry surface.

## ADDED Requirements

### Requirement: Bot broadcasts automation updates

The bot-side `%steward` SHALL expose an automation watch path at
`/v1/automation/tasks` that, on subscribe, gives one initial fact carrying the complete currently
stored task projection, including when that projection is empty.
When an accepted `%project` action changes the stored task map,
`%steward` SHALL give delta facts on that path describing each added
or changed task and each removed task ID. An accepted `%project`
that leaves the stored map unchanged SHALL NOT emit any facts. Updates SHALL carry the harness-neutral task
representation with no harness-specific fields beyond the existing
task type, and SHALL NOT embed a ship identity: a subscriber
attributes the feed to the ship it subscribed to.

#### Scenario: Subscriber receives the current projection

- **WHEN** a permitted source subscribes to the bot's automation
    watch path
- **THEN** it receives one initial fact containing the complete
    current task projection, with no ship identity in the payload

#### Scenario: Subscriber receives an empty projection

- **WHEN** a permitted source subscribes while the stored projection
    is empty
- **THEN** it receives one initial fact carrying the empty task map

#### Scenario: Projection change produces deltas

- **WHEN** an accepted `%project` adds, modifies, and removes tasks
    relative to the stored map
- **THEN** subscribers receive delta facts covering each added or
    changed task and each removed task ID

#### Scenario: Equivalent projection produces no deltas

- **WHEN** an accepted `%project` carries a task set equal to the
    stored map
- **THEN** no facts are emitted

### Requirement: Automation watch authorization is per-path

The bot's automation watch path SHALL admit subscriptions from the
local ship and from the configured owner ship only. Every other
`%steward` watch path SHALL be local-only. A subscription attempt
from any other source SHALL be rejected. When the configured owner
changes, existing automation subscriptions from sources no longer
permitted SHALL be kicked.

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

#### Scenario: Owner is replaced

- **WHEN** core configuration sets a new owner while the previous
    owner holds an automation subscription
- **THEN** the previous owner's subscription is kicked and it
    receives no further automation facts

### Requirement: Owner mirrors trusted bots

The owner-side `%steward` SHALL maintain a per-bot mirror of
automation task state, keyed by bot ship. It SHALL subscribe to a
bot's automation watch path when that bot enters the trusted-bot set
and SHALL leave the subscription and delete that bot's mirrored tasks
when the bot is untrusted — except the local ship: untrusting the
local ship SHALL NOT emit a leave or touch its mirror entry, which
is owned by `%project`. A trusted bot becomes mirrored only when
its first snapshot fact arrives; subscribing SHALL NOT create a
mirror entry, so a failed or unanswered subscription leaves nothing
to clean up. Trusting the local ship SHALL NOT create a
subscription: the local ship's mirror entry is written by accepted
`%project` actions, never by a subscription.

#### Scenario: Bot becomes trusted

- **WHEN** the owner pokes `%trust-bot` for a bot ship
- **THEN** the owner's `%steward` subscribes to that bot's automation
    watch path

#### Scenario: Trusted bot has not yet delivered a snapshot

- **WHEN** a bot is trusted but no snapshot fact has arrived from it
- **THEN** the mirror has no entry for that bot

#### Scenario: Bot becomes untrusted

- **WHEN** the owner pokes `%untrust-bot` for a mirrored bot
- **THEN** the owner's `%steward` leaves the automation subscription
    and removes that bot's mirrored tasks

#### Scenario: Local ship is trusted

- **WHEN** the owner pokes `%trust-bot` for the local ship
- **THEN** no automation subscription is created and the local
    ship's mirror entry is unaffected

#### Scenario: Local ship is untrusted

- **WHEN** the owner pokes `%untrust-bot` for the local ship
- **THEN** no leave is emitted and the local ship's mirror entry is
    unaffected

#### Scenario: Bot is untrusted before its first snapshot

- **WHEN** `%untrust-bot` targets a bot that is subscribed but has
    delivered no snapshot fact
- **THEN** the subscription is left and no mirror entry is ever
    created for that bot

### Requirement: Owner store converges on bot state

The owner-side `%steward` SHALL attribute every received automation
fact to the bot whose subscription delivered it, never to a
peer-supplied payload field. On receiving a snapshot fact for a bot,
it SHALL atomically replace that bot's mirrored task map with the
snapshot, removing every task absent from it. On receiving delta
facts, it SHALL upsert the carried task for an add/change and remove
the carried ID for a removal; removing an ID that is not mirrored
SHALL leave the mirror unchanged, and a delta for a ship with no
mirror entry SHALL be ignored rather than creating one. After a
snapshot and its subsequent
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

When the owner's automation subscription to a bot is kicked and the
bot is still in the trusted-bot set, the owner-side `%steward` SHALL
resubscribe, and the resulting initial snapshot fact SHALL repair
any updates missed while unsubscribed. It SHALL NOT resubscribe on a
kick for a bot no longer in the trusted-bot set. A
rejected (nacked) automation watch SHALL be surfaced visibly in logs
and SHALL NOT crash the agent or disturb existing mirrored state.
Re-poking `%trust-bot` for an already-trusted bot SHALL re-establish
the subscription when none is live and SHALL NOT duplicate one that
is.

#### Scenario: Subscription is kicked

- **WHEN** a still-trusted bot's automation subscription is kicked
- **THEN** the owner resubscribes and the initial snapshot fact
    replaces that bot's mirror with the bot's current projection

#### Scenario: Kick after untrust

- **WHEN** a kick arrives for a bot no longer in the trusted-bot set
- **THEN** no resubscription is attempted

#### Scenario: Watch is rejected

- **WHEN** an automation watch attempt is nacked
- **THEN** previously mirrored state is preserved and the agent does
    not crash

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
path at `/v1/automation/mirror` serving the mirror: one entry per ship, each attributed to its
ship. The local ship's entry is written by accepted `%project`
actions rather than by a subscription and follows the same presence
semantics as every other entry: it appears at the first accepted
projection (an accepted empty projection yields an empty entry) and
is absent while the local harness has never projected. On subscribe
the path SHALL give initial facts carrying every current entry. When
any entry changes — through a subscription fact, an accepted
`%project`, or an untrust deleting an entry — the path SHALL give
facts carrying the corresponding per-ship snapshot, delta, or entry
removal so a subscribed client converges on the mirror; an entry
removal SHALL be distinct on the wire from an empty snapshot. A
received snapshot or an accepted `%project` that leaves the stored
entry unchanged SHALL NOT produce client facts.

#### Scenario: Client subscribes

- **WHEN** a local client subscribes to the owner's automation
    client watch path
- **THEN** it receives every current mirror entry, attributed per
    ship

#### Scenario: Mirror change reaches the client

- **WHEN** the owner's mirror changes for a bot after a client
    subscribed
- **THEN** the client receives a fact for that change attributed to
    that bot, and applying received facts in order reproduces the
    mirror

#### Scenario: Untrusted bot's removal reaches the client

- **WHEN** `%untrust-bot` deletes a mirrored bot's entry while a
    client is subscribed
- **THEN** the client receives an entry-removal fact for that bot,
    after which it holds no entry for it

#### Scenario: First empty projection creates the local entry

- **WHEN** the first accepted `%project` carries an empty task list
    while a client is subscribed
- **THEN** the client receives an empty snapshot fact attributed to
    the local ship

#### Scenario: Projection change is propagated to subscribed clients

- **WHEN** an accepted `%project` changes the local projection while
    a client is subscribed to the client watch path
- **THEN** the change is propagated to the client as facts
    attributed to the local ship

#### Scenario: Self-owned bot serves its own tasks

- **WHEN** a client subscribes on a self-owned bot ship whose local
    projection is non-empty
- **THEN** it receives that projection attributed to the local ship,
    with no subscription from the ship to itself

#### Scenario: Client subscribes with an empty view

- **WHEN** a local client subscribes while the mirror is empty
- **THEN** the watch succeeds and no initial facts are given; the
    first fact on the subscription arrives only when the view later
    changes

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

- **WHEN** a client-feed update is grown to JSON
- **THEN** the result identifies the update variant and the bot
    ship, carrying the task map for a snapshot, the task ID (and the
    task value only for an add/change) for a task delta, and only
    the ship for an entry removal

### Requirement: Mirrored tasks are scriable

The owner-side `%steward` SHALL expose a scry at
`/x/v1/automation/mirror` returning the complete mirror as JSON: the ship-keyed object itself, with no
wrapper key, each entry's value using the established ID-keyed
task-map JSON shape. The scry
SHALL execute locally against current agent state without authorizing
a caller source.

#### Scenario: Mirrored state is read

- **WHEN** a client scries the mirror path while the mirror has
    entries
- **THEN** it receives a JSON object with one property per mirror
    entry, whose value is that ship's ID-keyed task map

#### Scenario: Empty view is read

- **WHEN** a client scries the mirror path while the mirror is empty
- **THEN** it receives the empty JSON object rather than an error
