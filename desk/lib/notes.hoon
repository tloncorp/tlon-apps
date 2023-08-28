/-  d=diary
::  convert a note to a preview for a "said" response
::
|%
++  said
  |=  [=flag:d =plan:d =notes:d]
  ^-  cage
  =/  note=(unit (unit note:d))  (get:on-notes:d notes p.plan)
  =/  =outline:d
    ?~  note
      ::TODO  give "outline" that formally declares deletion
      [0 ~ 'This post was deleted.' '' ~ ~nul *@da]
    ?~  u.note
      ::TODO  give "outline" that formally declares deletion
      [0 ~ 'Unknown post' '' ~ ~nul *@da]
    (trace u.u.note)
  [%diary-said !>(`said:d`[flag outline])]
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
