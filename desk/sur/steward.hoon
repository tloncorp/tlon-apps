/-  a=activity
::  steward: shared protocol types for the umbrella harness agent
::
|%
+$  action
  $%  [%configure owner=ship]
      [%lens =action:lens]
      [%gateway =action:gateway]
  ==
+$  update
  $%  [%lens =update:lens]
      [%gateway =update:gateway]
  ==
::  lens module types
::
++  lens
  |%
  ::  $state-0: legacy lens state (steward state-0). Plain map of runs.
  ::
  +$  state-0  (map [bot=ship =id] run)
  ::  $state: lens module state.
  ::
  ::    .runs is the durable store of finalized + partial run records,
  ::    keyed by [bot id].
  ::    .max-runs-per-bot caps the count per bot (oldest beyond the cap
  ::    are pruned on next insert or %configure). No time-based expiry —
  ::    lens runs are durable memory, not transient logs.
  ::
  +$  state
    $:  runs=(map [bot=ship =id] run)
        max-runs-per-bot=@ud
    ==
  ::  $id: gateway-assigned run identifier (the lensId stamped on posts)
  ::
  +$  id  @t
  ::  $payload: is opaque serialized JSON with an inner schemaVersion;
  ::  ships relay and store it without interpreting its contents.
  ::  it is a cord rather than a $json because embedding the recursive
  ::  $json type in mark sample types makes ford's tube nest checks
  ::  diverge (stack overflow on every json conversion build).
  ::
  +$  payload  @t
  ::  $run: a stored lens run record
  ::
  ::    .complete: whether a finalized (final=&) record has been received
  ::    .received: the timestamp when the run was received
  ::    .payload: the opaque serialized JSON payload
  ::
  +$  run
    $:  complete=?
        received=@da
        =payload
    ==
  ::  $entry: a run plus its identity, as exposed to observers
  ::
  +$  entry  [bot=ship =id =run]
  ::
  ::  $action: lens module inbound actions.
  ::
  ::    %entry: gateway pushes a run record (partial or final). authoritative
  ::            data flow into the store; src is self (gateway local poke) or
  ::            a moon we sponsor (cross-ship fan-out from a bot to its owner).
  ::    %retry: owner-initiated request to re-dispatch a finalized run that
  ::            failed or aborted. carries .bot so the agent can route it:
  ::            received locally (src=our) and bot == our, emit a fact for
  ::            the local gateway; received locally but bot != our, cross-
  ::            ship poke the bot's steward; received cross-ship from the
  ::            configured owner with bot == our, emit a fact. (the symmetric
  ::            case to %entry, which is bot → owner; %retry is owner → bot.)
  ::    %configure: set the per-ship lens config. Currently the only knob is
  ::            .max-runs-per-bot. Local only (src=our). On set, applies the
  ::            new cap immediately by pruning every bot to size.
  ::
  +$  action
    $%  [%entry =id payload=@t final=?]
        [%retry bot=ship =id]
        [%configure max-runs-per-bot=@ud]
    ==
  ::  $update: lens subscription update.
  ::
  ::    %entry: a stored run record (insert or update).
  ::    %retry-requested: a retry was requested for run .id by .requester;
  ::                      the local gateway should re-dispatch. Only emitted
  ::                      on the bot ship (the owner-side relay forwards the
  ::                      poke to the bot, which then emits this fact).
  ::
  +$  update
    $%  [%entry =entry]
        [%retry-requested =id requester=ship]
    ==
  --
::  gateway module types
::
++  gateway
  |%
  ::  $state: the gateway state as seen by the ship
  ::
  +$  state
    $:  last-owner-msg=@da
        last-owner-msg-id=(unit message-key:a)
        =status
        boot-id=(unit @t)
        lease-until=(unit @da)
        last-heartbeat=(unit @da)
        last-stop=(unit @da)
        last-start=(unit @da)
        pending-restart=?
        last-auto-reply=(unit @da)
        last-auto-reply-to=(unit message-key:a)
        reply-cooldown=@dr
        active-window=@dr
    ==
  ::  $status: gateway liveness as seen by the ship
  ::
  +$  status  $~(%unknown ?(%unknown %up %down))
  ::  $action: inbound poke protocol from openclaw-tlon
  ::
  +$  action
    $%  [%configure active-window=@dr reply-cooldown=@dr]
        [%gateway-start boot-id=@t lease-until=@da]
        [%gateway-heartbeat boot-id=@t lease-until=@da]
        [%gateway-stop boot-id=@t reason=@t]
    ==
  ::  $update: outbound subscription facts for status observers
  ::
  +$  update
    $%  [%status =status lease-until=(unit @da)]
        [%owner-activity last-owner-msg=@da]
        [%auto-reply =ship at=@da]
    ==
  ::
  --
++  v1  .
--
