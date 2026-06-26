::  %steward-lens-action-1: a lens module action (entry / retry / configure)
::
::    %entry's payload is opaque $json (the run record); we relay it
::    untouched. jsn captures the real $json type so the +json arms below
::    don't shadow it.
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
    ?-  -.act
        %entry
      %-  frond  :-  'entry'
      %-  pairs
      :~  ['id' s+id.act]
          ['payload' payload.act]
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
  --
++  grab
  |%
  ++  noun  action:v1:l
  ++  json
    =,  dejs:format
    |=  jon=jsn
    ^-  action:v1:l
    %.  jon
    %-  of
    :~  [%entry (ot id+so payload+same final+bo ~)]
        [%retry (ot bot+(se %p) id+so ~)]
        [%configure (ot max-runs-per-bot+ni ~)]
    ==
  --
--
