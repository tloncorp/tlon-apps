::  gateway-status-action-1: mark for gateway-status inbound actions
::
/-  gs=gateway-status
|_  =action:v1:gs
++  grad  %noun
++  grow
  |%
  ++  noun  action
  ++  json
    =,  enjs:format
    ^-  ^json
    ?-  -.action
        %configure
      %-  frond  :-  'configure'
      %-  pairs
      :~  ['owner' s+(scot %p owner.action)]
          ['active-window' s+(scot %dr active-window.action)]
          ['offline-reply-cooldown' s+(scot %dr reply-cooldown.action)]
      ==
        %gateway-start
      %-  frond  :-  'gateway-start'
      %-  pairs
      :~  ['boot-id' s+boot-id.action]
          ['lease-until' s+(scot %da lease-until.action)]
      ==
        %gateway-heartbeat
      %-  frond  :-  'gateway-heartbeat'
      %-  pairs
      :~  ['boot-id' s+boot-id.action]
          ['lease-until' s+(scot %da lease-until.action)]
      ==
        %gateway-stop
      %-  frond  :-  'gateway-stop'
      (pairs ~[['boot-id' s+boot-id.action] ['reason' s+reason.action]])
    ==
  --
++  grab
  |%
  ++  noun  action:v1:gs
  ++  json
    |=  jon=^json
    ^-  action:v1:gs
    =,  dejs:format
    %.  jon
    %-  of
    :~  [%gateway-stop (ot ~[boot-id+so reason+so])]
        [%gateway-start (ot ~[boot-id+so lease-until+(se %da)])]
        [%gateway-heartbeat (ot ~[boot-id+so lease-until+(se %da)])]
        [%configure (ot ~[owner+(se %p) active-window+(se %dr) offline-reply-cooldown+(se %dr)])]
    ==
  --
--
