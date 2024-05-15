/-  c=channels, g=groups
::  convert a post to a preview for a "said" response
::
|%
::  +uv-* functions convert posts, replies, and reacts into their "unversioned"
::  forms, suitable for responses to our subscribers.
::  +s-* functions convert those posts and replies into their "simple" forms,
::  suitable for responses to subscribers that use an older version of the api,
::  or just don't care about details like edit status.
::  +suv-* functions do both, sequentially.
::
++  uv-channels-1
  |=  =v-channels:c
  ^-  channels-0:c
  %-  ~(run by v-channels)
  |=  channel=v-channel:c
  ^-  channel-0:c
  %*  .  *channel-0:c
    posts  *posts:c
    perm   +.perm.channel
    view   +.view.channel
    sort   +.sort.channel
    order  +.order.channel
  ==
::
++  uv-channels-2
  |=  =v-channels:c
  ^-  channels:c
  %-  ~(run by v-channels)
  |=  channel=v-channel:c
  ^-  channel:c
  %*  .  *channel:c
    posts  *posts:c
    perm   +.perm.channel
    view   +.view.channel
    sort   +.sort.channel
    order  +.order.channel
    pending  pending.channel
  ==
::
++  uv-posts
  |=  =v-posts:c
  ^-  posts:c
  %+  gas:on-posts:c  *posts:c
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(unit v-post:c)]
  ^-  [id-post:c (unit post:c)]
  [id-post ?~(v-post ~ `(uv-post u.v-post))]
::
++  s-posts
  |=  =posts:c
  ^-  simple-posts:c
  %+  gas:on-simple-posts:c  *simple-posts:c
  %+  turn  (tap:on-posts:c posts)
  |=  [=id-post:c post=(unit post:c)]
  ^-  [id-post:c (unit simple-post:c)]
  [id-post ?~(post ~ `(s-post u.post))]
::
++  suv-posts
  |=  =v-posts:c
  ^-  simple-posts:c
  %+  gas:on-simple-posts:c  *simple-posts:c
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(unit v-post:c)]
  ^-  [id-post:c (unit simple-post:c)]
  [id-post ?~(v-post ~ `(suv-post u.v-post))]
::
++  uv-post
  |=  =v-post:c
  ^-  post:c
  :_  +.v-post
  :*  id.v-post
      (uv-reacts reacts.v-post)
      (uv-replies id.v-post replies.v-post)
      (get-reply-meta v-post)
  ==
::
++  s-post
  |=  =post:c
  ^-  simple-post:c
  :_  +>.post
  -.post(replies (s-replies replies.post))
::
++  suv-post
  |=  =v-post:c
  ^-  simple-post:c
  (s-post (uv-post v-post))
::
++  uv-posts-without-replies
  |=  =v-posts:c
  ^-  posts:c
  %+  gas:on-posts:c  *posts:c
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(unit v-post:c)]
  ^-  [id-post:c (unit post:c)]
  [id-post ?~(v-post ~ `(uv-post-without-replies u.v-post))]
::
++  suv-posts-without-replies
  |=  =v-posts:c
  ^-  simple-posts:c
  %+  gas:on-simple-posts:c  *simple-posts:c
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(unit v-post:c)]
  ^-  [id-post:c (unit simple-post:c)]
  [id-post ?~(v-post ~ `(suv-post-without-replies u.v-post))]
::
++  uv-post-without-replies
  |=  post=v-post:c
  ^-  post:c
  :_  +.post
  :*  id.post
      (uv-reacts reacts.post)
      *replies:c
      (get-reply-meta post)
  ==
::
++  suv-post-without-replies
  |=  post=v-post:c
  ^-  simple-post:c
  (s-post (uv-post-without-replies post))
::
++  uv-replies
  |=  [parent-id=id-post:c =v-replies:c]
  ^-  replies:c
  %+  gas:on-replies:c  *replies:c
  %+  murn  (tap:on-v-replies:c v-replies)
  |=  [=time v-reply=(unit v-reply:c)]
  ^-  (unit [id-reply:c reply:c])
  ?~  v-reply  ~  ::REVIEW  discrepance w/ +uv-posts?
  %-  some
  [time (uv-reply parent-id u.v-reply)]
::
++  s-replies
  |=  =replies:c
  ^-  simple-replies:c
  %+  gas:on-simple-replies:c  *simple-replies:c
  %+  turn  (tap:on-replies:c replies)
  |=  [=time =reply:c]
  ^-  [id-reply:c simple-reply:c]
  [time (s-reply reply)]
::
++  suv-replies
  |=  [parent-id=id-post:c =v-replies:c]
  ^-  simple-replies:c
  (s-replies (uv-replies parent-id v-replies))
::
++  uv-reply
  |=  [parent-id=id-reply:c =v-reply:c]
  ^-  reply:c
  :_  +.v-reply
  [id.v-reply parent-id (uv-reacts reacts.v-reply)]
::
++  s-reply
  |=  =reply:c
  ^-  simple-reply:c
  [-.reply +>.reply]
::
++  suv-reply
  |=  [parent-id=id-reply:c =v-reply:c]
  ^-  simple-reply:c
  (s-reply (uv-reply parent-id v-reply))
::
++  uv-reacts
  |=  =v-reacts:c
  ^-  reacts:c
  %-  ~(gas by *reacts:c)
  %+  murn  ~(tap by v-reacts)
  |=  [=ship (rev:c react=(unit react:c))]
  ?~  react  ~
  (some ship u.react)
::
++  said
  |=  [=nest:c =plan:c posts=v-posts:c]
  ^-  cage
  =/  post=(unit (unit v-post:c))  (get:on-v-posts:c posts p.plan)
  ?~  q.plan
    =/  post=simple-post:c
      ?~  post
        ::TODO  give "outline" that formally declares deletion
        :-  *simple-seal:c
        ?-  kind.nest
          %diary  [*memo:c %diary 'Unknown post' '']
          %heap   [*memo:c %heap ~ 'Unknown link']
          %chat   [[[%inline 'Unknown message' ~]~ ~nul *@da] %chat ~]
        ==
      ?~  u.post
        :-  *simple-seal:c
        ?-  kind.nest
            %diary  [*memo:c %diary 'This post was deleted' '']
            %heap   [*memo:c %heap ~ 'This link was deleted']
            %chat
          [[[%inline 'This message was deleted' ~]~ ~nul *@da] %chat ~]
        ==
      (suv-post-without-replies u.u.post)
    [%channel-said !>(`said:c`[nest %post post])]
  ::
  =/  reply=[reply-seal:c memo:c]
    ?~  post
      [*reply-seal:c ~[%inline 'Comment on unknown post']~ ~nul *@da]
    ?~  u.post
      [*reply-seal:c ~[%inline 'Comment on deleted post']~ ~nul *@da]
    =/  reply=(unit (unit v-reply:c))  (get:on-v-replies:c replies.u.u.post u.q.plan)
    ?~  reply
      [*reply-seal:c ~[%inline 'Unknown comment']~ ~nul *@da]
    ?~  u.reply
      [*reply-seal:c ~[%inline 'This comment was deleted']~ ~nul *@da]
    (suv-reply p.plan u.u.reply)
  [%channel-said !>(`said:c`[nest %reply p.plan reply])]
::
++  was-mentioned
  |=  [=story:c who=ship]
  ^-  ?
  %+  lien  story
  |=  =verse:c
  ?:  ?=(%block -.verse)  |
  %+  lien  p.verse
  (cury test [%ship who])
::
++  flatten
  |=  content=(list verse:c)
  ^-  cord
  %+  rap   3
  %+  turn  content
  |=  v=verse:c
  ^-  cord
  ?-  -.v
      %block  ''
      %inline
    %+  rap  3
    %+  turn  p.v
    |=  c=inline:c
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
  |=  post=v-post:c
  ^-  outline:c
  =;  replyers=(set ship)
    [~(wyt by replies.post) replyers +>.post]
  =-  (~(gas in *(set ship)) (scag 3 ~(tap in -)))
  %-  ~(gas in *(set ship))
  %+  murn  (tap:on-v-replies:c replies.post)
  |=  [@ reply=(unit v-reply:c)]
  ?~  reply  ~
  (some author.u.reply)
::
++  get-reply-meta
  |=  post=v-post:c
  ^-  reply-meta:c
  :*  (get-non-null-reply-count replies.post)
      (get-last-repliers post ~)
      (biff (ram:on-v-replies:c replies.post) |=([=time *] `time))
  ==
::
++  get-non-null-reply-count
  |=  replies=v-replies:c
  ^-  @ud
  =/  entries=(list [time (unit v-reply:c)])  (bap:on-v-replies:c replies)
  =/  count  0
  |-  ^-  @ud
  ?:  =(~ entries)
    count
  =/  [* reply=(unit v-reply:c)]  -.entries
  ?~  reply  $(entries +.entries)
  $(entries +.entries, count +(count))
::
++  get-last-repliers
  |=  [post=v-post:c pending=(unit ship)]  ::TODO  could just take =v-replies
  ^-  (set ship)
  =/  replyers=(set ship)  ?~(pending ~ (sy u.pending ~))
  =/  entries=(list [time (unit v-reply:c)])  (bap:on-v-replies:c replies.post)
  |-
  ?:  |(=(~ entries) =(3 ~(wyt in replyers)))
    replyers
  =/  [* reply=(unit v-reply:c)]  -.entries
  ?~  reply  $(entries +.entries)
  ?:  (~(has in replyers) author.u.reply)
    $(entries +.entries)
  =.  replyers  (~(put in replyers) author.u.reply)
  $(entries +.entries)
++  perms
  |_  [our=@p now=@da =nest:c group=flag:g]
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
        /fleet/(scot %p her)/is-bloc/loob
    ==  ==
  ::
  ++  can-write
    |=  [her=ship writers=(set sect:g)]
    ?:  =(ship.nest her)  &
    =/  =path
      %+  welp  groups-scry
      :+  %channel  kind.nest
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
      /can-read/noun
    =/  test=$-([ship nest:g] ?)
      =>  [path=path nest=nest:g ..zuse]  ~+
      .^($-([ship nest] ?) %gx path)
    (test her nest)
  --
--
