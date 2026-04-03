/-  gs=gateway-status
|_  =action-1:gs
++  grad  %noun
++  grow
  |%
  ++  noun  action-1
  ++  json
    =,  enjs:format
    ^-  ^json
    ?-  -.action-1
        %configure
      %-  frond  :-  'configure'
      %-  pairs
      :~  ['owner' s+(scot %p owner.action-1)]
          ['active-window' s+(scot %dr active-window.action-1)]
          ['offline-reply-cooldown' s+(scot %dr offline-reply-cooldown.action-1)]
      ==
        %gateway-start
      %-  frond  :-  'gateway-start'
      %-  pairs
      :~  ['boot-id' s+boot-id.action-1]
          ['lease-until' s+(scot %da lease-until.action-1)]
      ==
        %gateway-heartbeat
      %-  frond  :-  'gateway-heartbeat'
      %-  pairs
      :~  ['boot-id' s+boot-id.action-1]
          ['lease-until' s+(scot %da lease-until.action-1)]
      ==
        %gateway-stop
      %-  frond  :-  'gateway-stop'
      (pairs ~[['reason' s+reason.action-1]])
    ==
  --
++  grab
  |%
  ++  noun  action-1:gs
  ++  json
    |=  jon=^json
    ^-  action-1:gs
    =,  dejs:format
    %.  jon
    %-  of
    :~  [%gateway-stop (ot ~[reason+so])]
        [%gateway-start (ot ~[boot-id+so lease-until+(se %da)])]
        [%gateway-heartbeat (ot ~[boot-id+so lease-until+(se %da)])]
        [%configure (ot ~[owner+(se %p) active-window+(se %dr) offline-reply-cooldown+(se %dr)])]
    ==
  --
--
