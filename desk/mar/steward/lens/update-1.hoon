::  %steward-lens-update-1: a lens module update, served to clients as json
::
::    %entry / %retry-requested ride the /v1/lens subscription; %recent is
::    the /recent and /since scry result (a json array). jsn captures the
::    real $json type so the +json arms don't shadow the embedded payload.
::
/-  l=steward-lens
=>  |%
    +$  jsn  json
    --
|_  upd=update:v1:l
++  grad  %noun
++  grow
  |%
  ++  noun  upd
  ++  json
    =,  enjs:format
    ?-  -.upd
        %entry
      (frond 'entry' (entry-json entry.upd))
    ::
        %retry-requested
      %-  frond  :-  'retry-requested'
      %-  pairs
      :~  ['id' s+id.upd]
          ['requester' s+(scot %p requester.upd)]
      ==
    ::
        %recent
      %-  frond  :-  'recent'
      a+(turn entries.upd entry-json)
    ==
  ++  entry-json
    |=  =entry:v1:l
    ^-  jsn
    =,  enjs:format
    %-  pairs
    :~  ['bot' s+(scot %p bot.entry)]
        ['id' s+id.entry]
        ['complete' b+complete.run.entry]
        ['received' s+(scot %da received.run.entry)]
        ['payload' payload.run.entry]
    ==
  --
++  grab
  |%
  ++  noun  update:v1:l
  --
--
