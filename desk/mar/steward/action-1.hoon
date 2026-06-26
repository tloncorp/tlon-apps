::  %steward-action-1: steward-core config (set the shared owner)
::
::    module actions have their own marks (%steward-lens-action-1,
::    %steward-gateway-action-1); this carries only cross-cutting config.
::
/-  s=steward
|_  =action:v1:s
++  grad  %noun
++  grow
  |%
  ++  noun  action
  ++  json
    =,  enjs:format
    ?-  -.action
        %configure
      %-  frond  :-  'configure'
      %-  frond  :-  'owner'
      s+(scot %p owner.action)
    ::
        %trust-bot
      %-  frond  :-  'trust-bot'
      %-  frond  :-  'ship'
      s+(scot %p ship.action)
    ::
        %untrust-bot
      %-  frond  :-  'untrust-bot'
      %-  frond  :-  'ship'
      s+(scot %p ship.action)
    ==
  --
++  grab
  |%
  ++  noun  action:v1:s
  ++  json
    =,  dejs:format
    %-  of
    :~  [%configure (ot ~[owner+(se %p)])]
        [%trust-bot (ot ~[ship+(se %p)])]
        [%untrust-bot (ot ~[ship+(se %p)])]
    ==
  --
--
