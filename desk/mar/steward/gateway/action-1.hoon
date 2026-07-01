::  %steward-gateway-action-1: harness liveness protocol
::
::    %configure maps the JSON `offline-reply-cooldown` field to
::    reply-cooldown, matching the gateway-status contract.
::
/-  g=steward-gateway
|_  =action:v1:g
++  grad  %noun
++  grow
  |%
  ++  noun  action
  ++  json
    =,  enjs:format
    ?-  -.action
        %configure
      %-  frond  :-  'configure'
      %-  pairs
      :~  ['active-window' s+(scot %dr active-window.action)]
          ['offline-reply-cooldown' s+(scot %dr reply-cooldown.action)]
      ==
    ::
        %gateway-start
      %-  frond  :-  'gateway-start'
      (pairs ~[['boot-id' s+boot-id.action] ['lease-until' s+(scot %da lease-until.action)]])
    ::
        %gateway-heartbeat
      %-  frond  :-  'gateway-heartbeat'
      (pairs ~[['boot-id' s+boot-id.action] ['lease-until' s+(scot %da lease-until.action)]])
    ::
        %gateway-stop
      %-  frond  :-  'gateway-stop'
      (pairs ~[['boot-id' s+boot-id.action] ['reason' s+reason.action]])
    ==
  --
++  grab
  |%
  ++  noun  action:v1:g
  ++  json
    =,  dejs:format
    %-  of
    :~  [%configure (ot ~[active-window+(se %dr) offline-reply-cooldown+(se %dr)])]
        [%gateway-start (ot ~[boot-id+so lease-until+(se %da)])]
        [%gateway-heartbeat (ot ~[boot-id+so lease-until+(se %da)])]
        [%gateway-stop (ot ~[boot-id+so reason+so])]
    ==
  --
--
