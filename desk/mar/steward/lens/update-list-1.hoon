::  %steward-lens-update-list-1: a batch of stored lens runs, served to
::  clients as a json array (the /x/v1/lens/recent backfill scry)
::
/-  l=steward-lens
|_  ups=(list update:v1:l)
++  grad  %noun
++  grow
  |%
  ++  noun  ups
  ++  json
    =,  enjs:format
    :-  %a
    %+  turn  ups
    |=  upd=update:v1:l
    %-  pairs
    :~  ['bot' s+(scot %p bot.upd)]
        ['id' s+id.upd]
        ['complete' b+complete.run.upd]
        ['received' s+(scot %da received.run.upd)]
        ['payload' payload.run.upd]
    ==
  --
++  grab
  |%
  ++  noun  (list update:v1:l)
  --
--
