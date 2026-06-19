/-  a=activity
::  steward: shared protocol types for the umbrella harness agent
::
|%
+$  action
  $%  [%configure owners=(set ship)]
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
  ::  $state: lens tracked bot runs
  ::
  +$  state  (map [bot=ship =id] run)
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
  ::    .complete: whether the run is complete (all owners have acknowledged)
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
  ::  $action: add new lens run
  ::
  +$  action  [=id payload=@t final=?]
  ::  $update: lens subscription update, currently only a single run update
  ::
  +$  update  entry
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
