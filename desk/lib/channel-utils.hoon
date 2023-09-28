/-  d=channel, g=groups
::  convert a note to a preview for a "said" response
::
|%
::  +rr-* functions convert notes, quips, and feels into their "rr"
::  forms, suitable for responses to our subscribers
::
++  channels
  |=  =v-channels:d
  ^-  channels:d
  %-  ~(run by v-channels)
  |=  =diary:d
  ^-  rr-diary:d
  %*  .  *rr-diary:d
    notes  *rr-notes:d
    perm   +.perm.diary
    view   +.view.diary
    sort   +.sort.diary
    order  +.order.diary
  ==
++  rr-notes
  |=  =notes:d
  ^-  rr-notes:d
  %+  gas:rr-on-notes:d  *rr-notes:d
  %+  turn  (tap:on-notes:d notes)
  |=  [=id-note:d note=(unit note:d)]
  ^-  [id-note:d (unit rr-note:d)]
  [id-note ?~(note ~ `(rr-note u.note))]
::
++  rr-note
  |=  =note:d
  ^-  rr-note:d
  :_  +>.note
  :*  id.note
      (rr-feels feels.note)
      (rr-quips id.note quips.note)
      (get-quip-meta note)
  ==
::
++  rr-notes-without-quips
  |=  =notes:d
  ^-  rr-notes:d
  %+  gas:rr-on-notes:d  *rr-notes:d
  %+  turn  (tap:on-notes:d notes)
  |=  [=id-note:d note=(unit note:d)]
  ^-  [id-note:d (unit rr-note:d)]
  [id-note ?~(note ~ `(rr-note-without-quips u.note))]
::
++  rr-note-without-quips
  |=  =note:d
  ^-  rr-note:d
  :_  +>.note
  :*  id.note
      (rr-feels feels.note)
      *rr-quips:d
      (get-quip-meta note)
  ==
::
++  rr-quips
  |=  [parent-id=id-note:d =quips:d]
  ^-  rr-quips:d
  %+  gas:rr-on-quips:d  *rr-quips:d
  %+  murn  (tap:on-quips:d quips)
  |=  [=time quip=(unit quip:d)]
  ^-  (unit [id-quip:d rr-quip:d])
  ?~  quip  ~
  %-  some
  [time (rr-quip parent-id u.quip)]
::
++  rr-quip
  |=  [parent-id=id-quip:d =quip:d]
  ^-  rr-quip:d
  :_  +.quip
  [id.quip parent-id (rr-feels feels.quip)]
::
++  rr-feels
  |=  =feels:d
  ^-  (map ship feel:d)
  %-  ~(gas by *(map ship feel:d))
  %+  murn  ~(tap by feels)
  |=  [=ship (rev:d feel=(unit feel:d))]
  ?~  feel  ~
  (some ship u.feel)
::
++  said
  |=  [=nest:d =plan:d =notes:d]
  ^-  cage
  =/  note=(unit (unit note:d))  (get:on-notes:d notes p.plan)
  ?~  q.plan
    =/  =rr-note:d
      ?~  note
        ::TODO  give "outline" that formally declares deletion
        :-  *rr-seal:d
        ?-  han.nest
          %diary  [*memo:d %diary 'Unknown post' '']
          %heap   [*memo:d %heap ~ 'Unknown link']
          %chat   [[[%inline 'Unknown message' ~]~ ~nul *@da] %chat ~]
        ==
      ?~  u.note
        :-  *rr-seal:d
        ?-  han.nest
            %diary  [*memo:d %diary 'This post was deleted' '']
            %heap   [*memo:d %heap ~ 'This link was deleted']
            %chat
          [[[%inline 'This message was deleted' ~]~ ~nul *@da] %chat ~]
        ==
      (rr-note-without-quips u.u.note)
    [%channel-said !>(`said:d`[nest %note rr-note])]
  ::
  =/  =rr-quip
    ?~  note
      [*rr-cork:d ~[%inline 'Comment on unknown post']~ ~nul *@da]
    ?~  u.note
      [*rr-cork:d ~[%inline 'Comment on deleted post']~ ~nul *@da]
    =/  quip=(unit (unit quip:d))  (get:on-quips:d quips.u.u.note u.q.plan)
    ?~  quip
      [*rr-cork:d ~[%inline 'Unknown comment']~ ~nul *@da]
    ?~  u.quip
      [*rr-cork:d ~[%inline 'This comment was deleted']~ ~nul *@da]
    (rr-quip p.plan u.u.quip)
  [%channel-said !>(`said:d`[nest %quip p.plan rr-quip])]
::
++  was-mentioned
  |=  [=story:d who=ship]
  ^-  ?
  %+  lien  story
  |=  =verse:d
  ?:  ?=(%block -.verse)  |
  %+  lien  p.verse
  (cury test [%ship who])
::
++  flatten
  |=  content=(list verse:d)
  ^-  cord
  %+  rap   3
  %+  turn  content
  |=  v=verse:d
  ^-  cord
  ?-  -.v
      %block  ''
      %inline
    %+  rap  3
    %+  turn  p.v
    |=  c=inline:d
    ^-  cord
    ?@  c  c
    ?-  -.c
        %break                 ''
        %tag                   p.c
        %link                  q.c
        %block                 q.c
        ?(%code %inline-code)  ''
        %ship                  (scot %p p.c)
        %task                  (flatten [%inline q.c]~)
        ?(%italics %bold %strike %blockquote)
      (flatten [%inline p.c]~)
    ==
  ==
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
++  get-quip-meta
  |=  =note:d
  ^-  quip-meta:d
  :*  (wyt:on-quips:d quips.note)
      (get-last-quippers note)
      (biff (ram:on-quips:d quips.note) |=([=time *] `time))
  ==
::
++  get-last-quippers
  |=  =note:d  ::TODO  could just take =quips
  ^-  (set ship)
  =|  quippers=(set ship)
  =/  entries=(list [time (unit quip:d)])  (bap:on-quips:d quips.note)
  |-
  ?:  |(=(~ entries) =(3 ~(wyt in quippers)))
    quippers
  =/  [* quip=(unit quip:d)]  -.entries
  ?~  quip  $(entries +.entries)
  ?:  (~(has in quippers) author.u.quip)
    $(entries +.entries)
  (~(put in quippers) author.u.quip)
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
