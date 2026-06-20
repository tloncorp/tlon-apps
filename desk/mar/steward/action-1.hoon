::  steward-action-1: mark for steward inbound actions.
::
::    dispatched by module key: {"configure": {...}}, {"lens": {...}}, or
::    {"gateway": {...}}.
::    %configure sets the owner (top-level, not module-scoped).
::    %lens wraps a lens-module action — see lens variants below.
::    %gateway wraps a gateway lifecycle action (configure/start/heartbeat/stop).
::    adding a future module means adding a variant to $action in sur/steward,
::    not a new mark file.
::
::    lens variants:
::      {"entry": {"id":..., "payload":..., "final":...}}
::          gateway pushes a run record. local-only path (src=our or moon).
::      {"retry": {"bot":"~ship", "id":...}}
::          owner-initiated retry of a finalized run. routed via the
::          owner's steward to the bot's steward (cross-ship).
::      {"configure": {"max-runs-per-bot":N}}
::          per-ship retention cap; applied to every bot immediately.
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
      (lens-grow action.action)
    ::
        %gateway
      %-  frond  :-  'gateway'
      (gateway-grow action.action)
    ==
  ++  lens-grow
    |=  act=action:lens:s
    ^-  ^json
    =,  enjs:format
    ?-  -.act
        %entry
      %-  frond  :-  'entry'
      %-  pairs
      :~  ['id' s+id.act]
          ['payload' s+payload.act]
          ['final' b+final.act]
      ==
    ::
        %retry
      %-  frond  :-  'retry'
      %-  pairs
      :~  ['bot' s+(scot %p bot.act)]
          ['id' s+id.act]
      ==
    ::
        %configure
      %-  frond  :-  'configure'
      %-  frond  :-  'max-runs-per-bot'
      (numb max-runs-per-bot.act)
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
      [%lens (lens-grab val)]
    ::
        'gateway'
      [%gateway (gateway-grab val)]
    ==
  ++  lens-grab
    |=  jon=^json
    ^-  action:lens:v1:s
    =,  dejs:format
    %.  jon
    %-  of
    :~  [%entry (ot ~[id+so payload+so final+bo])]
        [%retry (ot ~[bot+(se %p) id+so])]
        [%configure (ot ~[max-runs-per-bot+ni])]
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
