::  $wood: logging
=<  wood
|%
+$  state
  $:  ver=_|
      odd=_&
      veb=_|
  ==
+$  grain  ?(%ver %odd %veb)
++  wood
  |_  [=bowl:gall state]
  ++  get-grain
    |=  =grain
    ^-  ?
    ?-  grain
      %ver  ver
      %odd  odd
      %veb  veb
    ==
  ::
  ++  note
    |=  [=grain =tang]
    ^+  same
    ?.  (get-grain grain)
      same
    %.  tang
    %*  .  slog
      pri  2
    ==
  --
--
