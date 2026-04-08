::  gateway-status: shared types for the gateway liveness agent
::
|%
::  $status: gateway liveness as seen by the ship
::
+$  status  $~(%unknown ?(%unknown %up %down))
::  $action: inbound poke protocol from openclaw-tlon
::
+$  action
  $%  [%configure owner=ship active-window=@dr reply-cooldown=@dr]
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
++  v1  .
--
