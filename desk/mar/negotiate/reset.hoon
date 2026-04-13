::  negotiate-reset: operator poke to clear heed entries and re-negotiate
::
::    target is (unit gill:gall):
::      ~         reset every heed entry (noisy — every peer re-negotiates)
::      [~ gill]  reset all heed entries for that gill
::
|_  target=(unit gill:gall)
++  grad  %noun
++  grow
  |%
  ++  noun  target
  --
++  grab
  |%
  ++  noun  (unit gill:gall)
  --
--
