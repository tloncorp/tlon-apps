::  tests for groups-conv
::
/-  gv=groups-ver
/+  *test, gc=groups-conv
::
|%
::  +roster: .n seats, each sent an invite before joining, plus an
::  invite to ~fun that is still pending
::
++  roster
  |=  n=@ud
  ^-  group:v11:gv
  =|  =group:v11:gv
  =/  ships=(list ship)  (turn (gulf 1 n) |=(i=@ `ship`i))
  %_  group
    seats  (malt (turn ships |=(=ship [ship [~ ~2000.1.1]])))
::
    invited.admissions
      (malt (turn [~fun ships] |=(=ship [ship [~2000.1.1 ~]])))
  ==
::
::  +test-drop-seats-keeps-pending-invites: a light roster lists only
::  the invites still pending, whichever seats it keeps
::
++  test-drop-seats-keeps-pending-invites
  =/  light  (drop-seats:group:v11:gc (roster 20) ~nec)
  %+  expect-eq
    !>([15 (sy ~[~fun])])
  !>([~(wyt by seats.light) ~(key by invited.admissions.light)])
::
++  test-drop-seats-small-group
  =/  light  (drop-seats:group:v11:gc (roster 5) ~nec)
  %+  expect-eq
    !>([5 (sy ~[~fun])])
  !>([~(wyt by seats.light) ~(key by invited.admissions.light)])
--
