/-  d=channel, g=groups
::  convert a post to a preview for a "said" response
::
|%
::  +uv-* functions convert posts, quips, and feels into their "unversioned"
::  forms, suitable for responses to our subscribers
::
++  uv-channels
  |=  =v-channels:d
  ^-  channels:d
  %-  ~(run by v-channels)
  |=  channel=v-channel:d
  ^-  channel:d
  %*  .  *channel:d
    posts  *posts:d
    perm   +.perm.channel
    view   +.view.channel
    sort   +.sort.channel
    order  +.order.channel
  ==
++  uv-posts
  |=  =v-posts:d
  ^-  posts:d
  %+  gas:on-posts:d  *posts:d
  %+  turn  (tap:on-v-posts:d v-posts)
  |=  [=id-post:d v-post=(unit v-post:d)]
  ^-  [id-post:d (unit post:d)]
  [id-post ?~(v-post ~ `(uv-post u.v-post))]
::
++  uv-post
  |=  =v-post:d
  ^-  post:d
  :_  +>.v-post
  :*  id.v-post
      (uv-feels feels.v-post)
      (uv-quips id.v-post quips.v-post)
      (get-quip-meta v-post)
  ==
::
++  uv-posts-without-quips
  |=  =v-posts:d
  ^-  posts:d
  %+  gas:on-posts:d  *posts:d
  %+  turn  (tap:on-v-posts:d v-posts)
  |=  [=id-post:d v-post=(unit v-post:d)]
  ^-  [id-post:d (unit post:d)]
  [id-post ?~(v-post ~ `(uv-post-without-quips u.v-post))]
::
++  uv-post-without-quips
  |=  post=v-post:d
  ^-  post:d
  :_  +>.post
  :*  id.post
      (uv-feels feels.post)
      *rr-quips:d
      (get-quip-meta post)
  ==
::
++  uv-quips
  |=  [parent-id=id-post:d =quips:d]
  ^-  rr-quips:d
  %+  gas:rr-on-quips:d  *rr-quips:d
  %+  murn  (tap:on-quips:d quips)
  |=  [=time quip=(unit quip:d)]
  ^-  (unit [id-quip:d rr-quip:d])
  ?~  quip  ~
  %-  some
  [time (uv-quip parent-id u.quip)]
::
++  uv-quip
  |=  [parent-id=id-quip:d =quip:d]
  ^-  rr-quip:d
  :_  +.quip
  [id.quip parent-id (uv-feels feels.quip)]
::
++  uv-feels
  |=  =feels:d
  ^-  (map ship feel:d)
  %-  ~(gas by *(map ship feel:d))
  %+  murn  ~(tap by feels)
  |=  [=ship (rev:d feel=(unit feel:d))]
  ?~  feel  ~
  (some ship u.feel)
::
++  said
  |=  [=nest:d =plan:d posts=v-posts:d]
  ^-  cage
  =/  post=(unit (unit v-post:d))  (get:on-v-posts:d posts p.plan)
  ?~  q.plan
    =/  =post:d
      ?~  post
        ::TODO  give "outline" that formally declares deletion
        :-  *rr-seal:d
        ?-  han.nest
          %diary  [*memo:d %diary 'Unknown post' '']
          %heap   [*memo:d %heap ~ 'Unknown link']
          %chat   [[[%inline 'Unknown message' ~]~ ~nul *@da] %chat ~]
        ==
      ?~  u.post
        :-  *rr-seal:d
        ?-  han.nest
            %diary  [*memo:d %diary 'This post was deleted' '']
            %heap   [*memo:d %heap ~ 'This link was deleted']
            %chat
          [[[%inline 'This message was deleted' ~]~ ~nul *@da] %chat ~]
        ==
      (uv-post-without-quips u.u.post)
    [%channel-said !>(`said:d`[nest %post post])]
  ::
  =/  =rr-quip:d
    ?~  post
      [*rr-cork:d ~[%inline 'Comment on unknown post']~ ~nul *@da]
    ?~  u.post
      [*rr-cork:d ~[%inline 'Comment on deleted post']~ ~nul *@da]
    =/  quip=(unit (unit quip:d))  (get:on-quips:d quips.u.u.post u.q.plan)
    ?~  quip
      [*rr-cork:d ~[%inline 'Unknown comment']~ ~nul *@da]
    ?~  u.quip
      [*rr-cork:d ~[%inline 'This comment was deleted']~ ~nul *@da]
    (uv-quip p.plan u.u.quip)
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
  |=  post=v-post:d
  ^-  outline:d
  =;  quippers=(set ship)
    [~(wyt by quips.post) quippers +>.post]
  =-  (~(gas in *(set ship)) (scag 3 ~(tap in -)))
  %-  ~(gas in *(set ship))
  %+  murn  (tap:on-quips:d quips.post)
  |=  [@ quip=(unit quip:d)]
  ?~  quip  ~
  (some author.u.quip)
::
++  get-quip-meta
  |=  post=v-post:d
  ^-  quip-meta:d
  :*  (wyt:on-quips:d quips.post)
      (get-last-quippers post)
      (biff (ram:on-quips:d quips.post) |=([=time *] `time))
  ==
::
++  get-last-quippers
  |=  post=v-post:d  ::TODO  could just take =quips
  ^-  (set ship)
  =|  quippers=(set ship)
  =/  entries=(list [time (unit quip:d)])  (bap:on-quips:d quips.post)
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
