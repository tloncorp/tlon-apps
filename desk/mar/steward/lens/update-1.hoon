::  %steward-lens-update-1: a stored lens run, served to clients as json
::
/-  l=steward-lens
|_  upd=update:v1:l
++  grad  %noun
++  grow
  |%
  ++  noun  upd
  ++  json
    =,  enjs:format
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
  ++  noun  update:v1:l
  --
--
