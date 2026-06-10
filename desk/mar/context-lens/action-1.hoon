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
      a+(turn ~(tap in owners.action) |=(=ship s+(scot %p ship)))
    ::
        %run-event
      %-  frond  :-  'run-event'
      (pairs ~[['id' s+id-run.action] ['payload' payload.action]])
    ::
        %run-final
      %-  frond  :-  'run-final'
      (pairs ~[['id' s+id-run.action] ['payload' payload.action]])
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
        [%run-event (ot ~[id+so payload+|=(j=^json j)])]
        [%run-final (ot ~[id+so payload+|=(j=^json j)])]
    ==
  --
--
