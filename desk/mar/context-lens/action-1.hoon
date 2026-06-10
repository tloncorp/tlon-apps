::  context-lens-action-1: mark for lens inbound actions
::
/-  l=context-lens
|_  =action:v1:l
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
      %-  frond  :-  'owners'
      ::  @p face: =,  enjs:format shadows the ship type with its +ship arm
      a+(turn ~(tap in owners.action) |=(her=@p s+(scot %p her)))
    ::
        %run-event
      %-  frond  :-  'run-event'
      (pairs ~[['id' s+id-run.action] ['payload' s+payload.action]])
    ::
        %run-final
      %-  frond  :-  'run-final'
      (pairs ~[['id' s+id-run.action] ['payload' s+payload.action]])
    ==
  --
++  grab
  |%
  ++  noun  action:v1:l
  ++  json
    |=  jon=^json
    ^-  action:v1:l
    =,  dejs:format
    %.  jon
    %-  of
    :~  [%configure (ot ~[owners+(cu ~(gas in *(set ship)) (ar (se %p)))])]
        [%run-event (ot ~[id+so payload+so])]
        [%run-final (ot ~[id+so payload+so])]
    ==
  --
--
