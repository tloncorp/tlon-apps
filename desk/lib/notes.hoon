/-  d=diary, g=groups
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
  [%channel-said !>(`said:d`[nest outline])]
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
::
++  perms
  |_  [our=@p now=@da =nest:d group=flag:g]
  ++  am-host  =(our ship.nest)
  ++  groups-scry
    ^-  path
    :-  (scot %p our)
    /groups/(scot %da now)/groups/(scot %p p.group)/[q.group]
  ::
  ++  is-admin
    |=  her=ship
    ?:  =(ship.nest her)  &
    .^  admin=?
    ;:  weld
        /gx
        groups-scry
        /channel/[han.nest]/(scot %p ship.nest)/[name.nest]
        /fleet/(scot %p her)/is-bloc/loob
    ==  ==
  ::
  ++  can-write
    |=  [her=ship writers=(set sect:g)]
    ?:  =(ship.nest her)  &
    =/  =path
      %+  welp  groups-scry
      :+  %channel  han.nest
      /(scot %p ship.nest)/[name.nest]/can-write/(scot %p her)/noun
    =+  .^(write=(unit [bloc=? sects=(set sect:g)]) %gx path)
    ?~  write  |
    =/  perms  (need write)
    ?:  |(bloc.perms =(~ writers))  &
    !=(~ (~(int in writers) sects.perms))
  ::
  ++  can-read
    |=  her=ship
    ?:  =(our her)  &
    =/  =path
      %+  welp  groups-scry
      :+  %channel  han.nest
      /(scot %p ship.nest)/[name.nest]/can-read/(scot %p her)/loob
    .^(? %gx path)
  --
--
