/-  d=diary, h=heap
::  convert a note to a preview for a "said" response
::
|%
++  said
  |=  [=nest:d =plan:d =notes:d]
  ^-  cage
  =/  note=(unit (unit note:d))  (get:on-notes:d notes p.plan)
  =/  =outline:d
    ?~  note
      ::TODO  give "outline" that formally declares deletion
      ?-  han.nest
        %diary  [0 ~ ~ ~nul *@da %diary 'Unknown post' '']
        %heap   [0 ~ ~ ~nul *@da %heap ~ 'Unknown link']
      ==
    ?~  u.note
      ?-  han.nest
        %diary  [0 ~ ~ ~nul *@da %diary 'This post was deleted' '']
        %heap   [0 ~ ~ ~nul *@da %heap ~ 'This link was deleted']
      ==
    (trace u.u.note)
  [%said !>(`said:d`[nest outline])]
::
++  trace
  |=  =note:d
  ^-  outline:d
  =;  quippers=(set ship)
    [~(wyt by quips.note) quippers +>.note]
  =-  (~(gas in *(set ship)) (scag 3 ~(tap in -)))
  %-  ~(gas in *(set ship))
  %+  murn  (tap:on-quips:d quips.note)
  |=  [@ quip=(unit quip:d)]
  ?~  quip  ~
  (some author.u.quip)
--
