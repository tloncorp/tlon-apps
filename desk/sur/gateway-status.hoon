::  gateway-status: types for the gateway liveness and offline-reply agent
::
/-  a=activity
|%
::  $state-0: agent state
::
::    .owner: ship whose DMs trigger offline replies (~ = unconfigured/inert)
::    .status: gateway liveness as seen by the ship
::    .boot-id: identifies the current gateway process (~ after graceful stop)
::    .lease-until: when the current heartbeat lease expires
::    .pending-restart-notice: whether to send a back-online DM on next start
::    .last-owner-message-id: last owner DM key, used for reply deduplication
::    .last-offline-auto-reply-to: key of the DM that last triggered an auto-reply
::    .active-window: how recently owner must have messaged to get notices
::    .offline-reply-cooldown: minimum interval between offline auto-replies
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
::  $action-1: inbound poke protocol from openclaw-tlon
::
+$  action-1
  $%  [%configure owner=ship active-window=@dr offline-reply-cooldown=@dr]
      [%gateway-start boot-id=@t lease-until=@da]
      [%gateway-heartbeat boot-id=@t lease-until=@da]
      [%gateway-stop boot-id=@t reason=@t]
  ==
::  $update-1: outbound subscription facts for status observers
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
