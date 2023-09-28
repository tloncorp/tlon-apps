/-  d=channel, g=groups
::  convert a post to a preview for a "said" response
::
|%
::  +uv-* functions convert posts, replies, and feels into their "unversioned"
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
      (uv-replies id.v-post replies.v-post)
      (get-reply-meta v-post)
  ==
::
++  uv-posts-without-replies
  |=  =v-posts:d
  ^-  posts:d
  %+  gas:on-posts:d  *posts:d
  %+  turn  (tap:on-v-posts:d v-posts)
  |=  [=id-post:d v-post=(unit v-post:d)]
  ^-  [id-post:d (unit post:d)]
  [id-post ?~(v-post ~ `(uv-post-without-replies u.v-post))]
::
++  uv-post-without-replies
  |=  post=v-post:d
  ^-  post:d
  :_  +>.post
  :*  id.post
      (uv-feels feels.post)
      *replies:d
      (get-reply-meta post)
  ==
::
++  uv-replies
  |=  [parent-id=id-post:d =v-replies:d]
  ^-  replies:d
  %+  gas:rr-on-replies:d  *replies:d
  %+  murn  (tap:on-v-replies:d v-replies)
  |=  [=time v-reply=(unit v-reply:d)]
  ^-  (unit [id-reply:d reply:d])
  ?~  v-reply  ~
  %-  some
  [time (uv-reply parent-id u.v-reply)]
::
++  uv-reply
  |=  [parent-id=id-reply:d =v-reply:d]
  ^-  reply:d
  :_  +.v-reply
  [id.v-reply parent-id (uv-feels feels.v-reply)]
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
      (uv-post-without-replies u.u.post)
    [%channel-said !>(`said:d`[nest %post post])]
  ::
  =/  =reply:d
    ?~  post
      [*rr-cork:d ~[%inline 'Comment on unknown post']~ ~nul *@da]
    ?~  u.post
      [*rr-cork:d ~[%inline 'Comment on deleted post']~ ~nul *@da]
    =/  reply=(unit (unit v-reply:d))  (get:on-v-replies:d replies.u.u.post u.q.plan)
    ?~  reply
      [*rr-cork:d ~[%inline 'Unknown comment']~ ~nul *@da]
    ?~  u.reply
      [*rr-cork:d ~[%inline 'This comment was deleted']~ ~nul *@da]
    (uv-reply p.plan u.u.reply)
  [%channel-said !>(`said:d`[nest %reply p.plan reply])]
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
  =;  replyers=(set ship)
    [~(wyt by replies.post) replyers +>.post]
  =-  (~(gas in *(set ship)) (scag 3 ~(tap in -)))
  %-  ~(gas in *(set ship))
  %+  murn  (tap:on-v-replies:d replies.post)
  |=  [@ reply=(unit v-reply:d)]
  ?~  reply  ~
  (some author.u.reply)
::
++  get-reply-meta
  |=  post=v-post:d
  ^-  reply-meta:d
  :*  (wyt:on-v-replies:d replies.post)
      (get-last-repliers post)
      (biff (ram:on-v-replies:d replies.post) |=([=time *] `time))
  ==
::
++  get-last-repliers
  |=  post=v-post:d  ::TODO  could just take =v-replies
  ^-  (set ship)
  =|  replyers=(set ship)
  =/  entries=(list [time (unit v-reply:d)])  (bap:on-v-replies:d replies.post)
  |-
  ?:  |(=(~ entries) =(3 ~(wyt in replyers)))
    replyers
  =/  [* reply=(unit v-reply:d)]  -.entries
  ?~  reply  $(entries +.entries)
  ?:  (~(has in replyers) author.u.reply)
    $(entries +.entries)
  (~(put in replyers) author.u.reply)
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
