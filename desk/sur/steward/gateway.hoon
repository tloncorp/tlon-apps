/-  a=activity
::  steward gateway module: harness liveness + offline auto-reply types
::
|%
::  $status: gateway liveness as seen by the ship
::
+$  status  $~(%unknown ?(%unknown %up %down))
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
::  $action: inbound liveness protocol from the gateway harness
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
++  v1  .
--
