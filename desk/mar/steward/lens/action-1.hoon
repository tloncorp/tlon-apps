::  %steward-lens-action-1: a lens run milestone from the gateway
::
::    payload is opaque $json (the run record); we relay it untouched.
::    jsn captures the real $json type so the +json arms below don't
::    shadow it.
::
/-  l=steward-lens
=>  |%
    +$  jsn  json
    --
|_  act=action:v1:l
++  grad  %noun
++  grow
  |%
  ++  noun  act
  ++  json
    =,  enjs:format
    %-  pairs
    :~  ['id' s+id.act]
        ['payload' payload.act]
        ['final' b+final.act]
    ==
  --
++  grab
  |%
  ++  noun  action:v1:l
  ++  json
    =,  dejs:format
    |=  jon=jsn
    ^-  action:v1:l
    %.  jon
    (ot id+so payload+same final+bo ~)
  --
--
