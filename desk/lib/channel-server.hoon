/-  d=diary, h=heap
::  convert a note to a preview for a "said" response
::
|%
++  diary-said
  |=  [=flag:d =plan:d =notes:d]
  ^-  cage
  =/  note=(unit (unit note:d))  (get:on-notes:d notes p.plan)
  =/  =outline:d
    ?~  note
      ::TODO  give "outline" that formally declares deletion
      [0 ~ 'Unknown post' '' ~ ~nul *@da]
    ?~  u.note
      [0 ~ 'This post was deleted' '' ~ ~nul *@da]
    (diary-trace u.u.note)
  [%diary-said !>(`said:d`[flag outline])]
::
++  diary-trace
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
::
++  heap-said
  |=  [=flag:h =id-curio:h =curios:h]
  ^-  cage
  =/  curio=(unit (unit curio:h))  (get:on-curios:h curios id-curio)
  =/  =curio:h
    ?~  curio
      [*seal:h `'Unkonwn link' [~ ~] ~nul *@da ~]
    ?~  u.curio
      [*seal:h `'This link was deleted' [~ ~] ~nul *@da ~]
    u.u.curio
  [%diary-said !>(`said:h`[flag curio])]
--
