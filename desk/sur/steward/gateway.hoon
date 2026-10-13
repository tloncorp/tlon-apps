/-  a=activity
::  steward gateway module: harness liveness + offline auto-reply types
::
|%
::  $status: gateway liveness as seen by the ship
::
+$  status  $~(%unknown ?(%unknown %up %down))
::  $state: the gateway state as seen by the ship
::
::    .notify-on-start: an owner-initiated stop (a hosted model change) is
::    pending, so the next %gateway-start sends the back-online notice even
::    if the owner hasn't messaged recently.
::    .last-interaction: when anyone last engaged the bot — a group @-mention,
::    a reply in one of its threads, or a DM — which widens the restart-notice
::    window beyond the owner's own DMs (.last-owner-msg).
::    .status-messages-enabled: allow restart, back-online and offline DMs.
::
+$  state
  $:  status-messages-enabled=$~(& ?)
      notify-on-start=?
      last-interaction=@da
      last-owner-msg=@da
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
      [%status-messages enabled=?]
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
