/-  a=activity
|%
::  $state-0: agent state
::
+$  state-0
  $:  %0
      owner=(unit ship)
      last-owner-message-at=@da
      last-owner-message-id=(unit message-key:a)
      status=$~(%unknown ?(%unknown %up %down))
      boot-id=(unit @t)
      lease-until=(unit @da)
      last-heartbeat-at=(unit @da)
      last-stop-at=(unit @da)
      last-start-at=(unit @da)
      pending-restart-notice=?
      last-offline-auto-reply-at=(unit @da)
      last-offline-auto-reply-to=(unit message-key:a)
      offline-reply-cooldown=@dr
      active-window=@dr
  ==
::  $action-1: inbound poke protocol
::
+$  action-1
  $%  [%configure owner=ship active-window=@dr offline-reply-cooldown=@dr]
      [%gateway-start boot-id=@t lease-until=@da]
      [%gateway-heartbeat boot-id=@t lease-until=@da]
      [%gateway-stop boot-id=@t reason=@t]
  ==
::  $update-1: outbound subscription facts
::
+$  update-1
  $%  [%status status=?(%unknown %up %down) lease-until=(unit @da)]
      [%owner-activity last-owner-message-at=@da]
      [%auto-reply =ship at=@da]
  ==
::  +is-gateway-live: check if the gateway is currently available
::
++  is-gateway-live
  |=  [status=?(%unknown %up %down) lease-until=(unit @da) now=@da]
  ^-  ?
  ?&  ?=(%up status)
      ?=(^ lease-until)
      (gth u.lease-until now)
  ==
--
