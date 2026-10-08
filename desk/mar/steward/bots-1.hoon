::  %steward-bots-1: the owner's trusted bots, returned by the bots scry
::
::    json is the ships as a sorted array of @p strings
::
|_  bots=(set ship)
++  grad  %noun
++  grow
  |%
  ++  noun  bots
  ++  json
    :-  %a
    %+  turn  (sort ~(tap in bots) aor)
    |=(=ship s+(scot %p ship))
  --
++  grab
  |%
  ++  noun  (set ship)
  --
--
