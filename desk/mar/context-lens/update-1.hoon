::  context-lens-update-1: mark for lens outbound updates and scry results
::
/-  l=context-lens
|_  =update:v1:l
++  grad  %noun
++  grow
  |%
  ++  noun  update
  ++  json
    |^
    =,  enjs:format
    ^-  ^json
    ?-  -.update
      %run   (frond 'run' (entry entry.update))
      %runs  (frond 'runs' a+(turn entries.update entry))
    ==
    ++  entry
      |=  e=entry:v1:l
      ^-  ^json
      =,  enjs:format
      %-  pairs
      :~  ['bot' s+(scot %p bot.e)]
          ['id' s+id-run.e]
          ['complete' b+complete.run.e]
          ['received' s+(scot %da received.run.e)]
          ['payload' s+payload.run.e]
      ==
    --
  --
++  grab
  |%
  ++  noun  update:v1:l
  --
--
