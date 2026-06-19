::  steward-action-1: mark for steward inbound actions (LOCAL ONLY)
::
::    dispatched by module key: {"configure": {...}} or {"lens": {...}}
::      or {"gateway": {...}}
::    %configure sets the owner (top-level, not module-scoped).
::    %lens wraps a single run action {id, payload, final}.
::    %gateway wraps a gateway lifecycle action (configure/start/heartbeat/stop).
::    adding a future module means adding a variant to $action in sur/steward,
::    not a new mark file.
::
::    NOTE: the %gateway configure maps offline-reply-cooldown → reply-cooldown
::    in the gateway sub-grab, mirroring gateway-status.
::
/-  s=steward
|_  =action:v1:s
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
      %-  frond  :-  'owner'
      s+(scot %p owner.action)
    ::
        %lens
      %-  frond  :-  'lens'
      %-  pairs
      :~  ['id' s+id.action.action]
          ['payload' s+payload.action.action]
          ['final' b+final.action.action]
      ==
    ::
        %gateway
      %-  frond  :-  'gateway'
      (gateway-grow action.action)
    ==
  ++  gateway-grow
    |=  act=action:gateway:s
    ^-  ^json
    =,  enjs:format
    ?-  -.act
        %configure
      %-  frond  :-  'configure'
      %-  pairs
      :~  ['active-window' s+(scot %dr active-window.act)]
          ['offline-reply-cooldown' s+(scot %dr reply-cooldown.act)]
      ==
    ::
        %gateway-start
      %-  frond  :-  'gateway-start'
      %-  pairs
      :~  ['boot-id' s+boot-id.act]
          ['lease-until' s+(scot %da lease-until.act)]
      ==
    ::
        %gateway-heartbeat
      %-  frond  :-  'gateway-heartbeat'
      %-  pairs
      :~  ['boot-id' s+boot-id.act]
          ['lease-until' s+(scot %da lease-until.act)]
      ==
    ::
        %gateway-stop
      %-  frond  :-  'gateway-stop'
      (pairs ~[['boot-id' s+boot-id.act] ['reason' s+reason.act]])
    ==
  --
++  grab
  |%
  ++  noun  action:v1:s
  ++  json
    |=  jon=^json
    ^-  action:v1:s
    =,  dejs:format
    ?.  ?=([%o *] jon)  ~|(bad-steward-action-json+jon !!)
    =/  kv  ~(tap by p.jon)
    ?~  kv  ~|(empty-steward-action-json+jon !!)
    =/  key=@t  p.i.kv
    =/  val=^json  q.i.kv
    ?+  key  ~|(unknown-steward-action-key+key !!)
        'configure'
      [%configure ((ot ~[owner+(se %p)]) val)]
    ::
        'lens'
      [%lens ((ot ~[id+so payload+so final+bo]) val)]
    ::
        'gateway'
      [%gateway (gateway-grab val)]
    ==
  ++  gateway-grab
    |=  jon=^json
    ^-  action:gateway:s
    =,  dejs:format
    %.  jon
    %-  of
    :~  [%gateway-stop (ot ~[boot-id+so reason+so])]
        [%gateway-start (ot ~[boot-id+so lease-until+(se %da)])]
        [%gateway-heartbeat (ot ~[boot-id+so lease-until+(se %da)])]
        [%configure (ot ~[active-window+(se %dr) offline-reply-cooldown+(se %dr)])]
    ==
  --
--
