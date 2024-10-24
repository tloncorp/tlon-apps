/-  c=channels, g=groups, ci=cite
/+  em=emojimart
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
::  versioning scheme
::
::  +arm convert to v1:old:c type
::  +arm-1 convert to v7:old:c type
::  +arm-2 convert to v8 (current) type
:: 
++  uv-channels-1
  |=  =v-channels:c
  ^-  channels-0:c
  %-  ~(run by v-channels)
  |=  channel=v-channel:c
  ^-  channel-0:c
  %*  .  *channel-0:c
    posts  *posts:v7:old:c
    perm   +.perm.channel
    view   +.view.channel
    sort   +.sort.channel
    order  +.order.channel
  ==
::
++  uv-channels
  |=  [=v-channels:c full=?]
  ^-  channels:v1:old:c
  %-  ~(run by v-channels)
  |=  channel=v-channel:c
  ^-  channel:v1:old:c
  =/  base
    %*  .  *channel:v1:old:c
      perm   +.perm.channel
      view   +.view.channel
      sort   +.sort.channel
      order  +.order.channel
      pending  pending.channel
    ==
  ?.  full  base
  %_  base
    posts  (uv-posts posts.channel)
    net  net.channel
    remark  remark.channel
  ==
::
++  uv-channels-2
  |=  [=v-channels:c full=?]
  ^-  channels:c
  %-  ~(run by v-channels)
  |=  channel=v-channel:c
  ^-  channel:c
  =/  base
    %*  .  *channel:c
      perm     +.perm.channel
      view     +.view.channel
      sort     +.sort.channel
      order    +.order.channel
      pending  pending.channel
    ==
  ?.  full  base
  %_  base
    posts   (uv-posts-2 posts.channel)
    net     net.channel
    remark  remark.channel
  ==
::
++  uv-posts
  |=  =v-posts:c
  ^-  posts:v1:old:c
  %+  gas:on-posts:v1:old:c  *posts:v1:old:c
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(unit v-post:c)]
  ^-  [id-post:c (unit post:v1:old:c)]
  [id-post ?~(v-post ~ `(uv-post u.v-post))]
::
++  uv-posts-1
  |=  =v-posts:c
  ^-  posts:v7:old:c
  %+  gas:on-posts:v7:old:c  *posts:v7:old:c
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(unit v-post:c)]
  ^-  [id-post:c (unit post:v7:old:c)]
  [id-post ?~(v-post ~ `(uv-post-1 u.v-post))]
::
++  uv-posts-2
  |=  =v-posts:c
  ^-  posts:c
  %+  gas:on-posts:c  *posts:c
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(unit v-post:c)]
  ^-  [id-post:c (unit post:c)]
  [id-post ?~(v-post ~ `(uv-post-2 u.v-post))]
::
++  s-posts-1
  |=  =posts:c
  ^-  simple-posts:v7:old:c
  %+  gas:on-simple-posts:v7:old:c  *simple-posts:v7:old:c
  %+  turn  (tap:on-posts:c posts)
  |=  [=id-post:c post=(unit post:c)]
  ^-  [id-post:c (unit simple-post:v7:old:c)]
  [id-post ?~(post ~ `(s-post-1 u.post))]
::
++  suv-posts
  |=  =v-posts:c
  ^-  simple-posts:v1:old:c
  %+  gas:on-simple-posts:v1:old:c  *simple-posts:v1:old:c
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(unit v-post:c)]
  ^-  [id-post:c (unit simple-post:v1:old:c)]
  [id-post (bind v-post suv-post)]
::
++  suv-posts-1
  |=  =v-posts:c
  ^-  simple-posts:v7:old:c
  %+  gas:on-simple-posts:v7:old:c  *simple-posts:v7:old:c
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(unit v-post:c)]
  ^-  [id-post:c (unit simple-post:v7:old:c)]
  [id-post (bind v-post suv-post-1)]
::
::
++  uv-post
  |=  =v-post:c
  ^-  post:v1:old:c
  :_  +.v-post
  :*  id.v-post
      (reacts-1 (uv-reacts-1 reacts.v-post))
      (uv-replies id.v-post replies.v-post)
      (get-reply-meta v-post)
  ==
::
++  uv-post-1
  |=  =v-post:c
  ^-  post:v7:old:c
  :_  +.v-post
  :*  id.v-post
      (reacts-1 (uv-reacts-1 reacts.v-post))
      (uv-replies-1 id.v-post replies.v-post)
      (get-reply-meta v-post)
  ==
::
++  uv-post-2
  |=  =v-post:c
  ^-  post:c
  :_  +.v-post
  :*  id.v-post
      seq.v-post
      mod-at.v-post
      (uv-reacts-1 reacts.v-post)
      (uv-replies-2 id.v-post replies.v-post)
      (get-reply-meta v-post)
  ==
::
++  s-post-1
  |=  =post:c
  ^-  simple-post:v7:old:c
  :_  +>.post
  ::XX a nicer way to write this?
  =/  seal
    %=  -.post
      reacts   (reacts-1 reacts.post)
      replies  (s-replies-1 replies.post)
    ==
  ::  remove .seq and .mod-at
  [- |3]:seal
::
++  s-post-2
  |=  =post:c
  ^-  simple-post:c
  :_  +>.post
  ::XX a nicer way to write this?
  =/  seal
    =<  -  :: seal
    %=  post
      reacts   (reacts-1 reacts.post)
      replies  (s-replies-1 replies.post)
    ==
  ::  remove .seq and .mod-at
  [- |3]:seal
::
++  suv-post
  |=  =v-post:c
  ^-  simple-post:v1:old:c
  (s-post-1 (uv-post-2 v-post))
::
::
++  suv-post-1
  |=  =v-post:c
  ^-  simple-post:v7:old:c
  (s-post-1 (uv-post-2 v-post))
::
++  uv-posts-without-replies
  |=  =v-posts:c
  ^-  posts:v1:old:c
  %+  gas:on-posts:v1:old:c  *posts:v1:old:c
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(unit v-post:c)]
  ^-  [id-post:c (unit post:v1:old:c)]
  [id-post ?~(v-post ~ `(uv-post-without-replies u.v-post))]
::
++  uv-posts-without-replies-1
  |=  =v-posts:c
  ^-  posts:v7:old:c
  %+  gas:on-posts:v7:old:c  *posts:v7:old:c
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(unit v-post:c)]
  ^-  [id-post:c (unit post:v7:old:c)]
  [id-post ?~(v-post ~ `(uv-post-without-replies-1 u.v-post))]
::
++  uv-posts-without-replies-2
  |=  =v-posts:c
  ^-  posts:c
  %+  gas:on-posts:c  *posts:c
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(unit v-post:c)]
  ^-  [id-post:c (unit post:c)]
  [id-post ?~(v-post ~ `(uv-post-without-replies-2 u.v-post))]
::
++  suv-posts-without-replies
  |=  =v-posts:c
  ^-  simple-posts:v1:old:c
  %+  gas:on-simple-posts:v1:old:c  *simple-posts:v1:old:c
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(unit v-post:c)]
  ^-  [id-post:c (unit simple-post:v1:old:c)]
  [id-post ?~(v-post ~ `(suv-post-without-replies u.v-post))]
::
++  suv-posts-without-replies-1
  |=  =v-posts:c
  ^-  simple-posts:v7:old:c
  %+  gas:on-simple-posts:v7:old:c  *simple-posts:v7:old:c
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(unit v-post:c)]
  ^-  [id-post:c (unit simple-post:v7:old:c)]
  [id-post (bind v-post suv-post-without-replies-1)]
::
++  uv-post-without-replies
  |=  post=v-post:c
  ^-  post:v1:old:c
  :_  +.post
  :*  id.post
      (uv-reacts-1 reacts.post)
      *replies:v1:old:c
      (get-reply-meta post)
  ==
::
++  uv-post-without-replies-1
  |=  post=v-post:c
  ^-  post:v7:old:c
  :_  +.post
  :*  id.post
      (uv-reacts-1 reacts.post)
      *replies:v7:old:c
      (get-reply-meta post)
  ==
::
++  uv-post-without-replies-2
  |=  post=v-post:c
  ^-  post:c
  :_  +.post
  :*  id.post
      seq.post
      mod-at.post
      (uv-reacts-1 reacts.post)
      *replies:c
      (get-reply-meta post)
  ==
::
++  suv-post-without-replies
  |=  post=v-post:c
  ^-  simple-post:v1:old:c
  (s-post-1 (uv-post-without-replies-2 post))
::
++  suv-post-without-replies-1
  |=  post=v-post:c
  ^-  simple-post:v7:old:c
  (s-post-1 (uv-post-without-replies-2 post))
::
++  suv-post-without-replies-2
  |=  post=v-post:c
  ^-  simple-post:c
  (s-post-2 (uv-post-without-replies-2 post))
::
++  uv-replies
  |=  [parent-id=id-post:c =v-replies:c]
  ^-  replies:v1:old:c
  %+  gas:on-replies:v1:old:c  *replies:v1:old:c
  %+  murn  (tap:on-v-replies:c v-replies)
  |=  [=time v-reply=(unit v-reply:c)]
  ^-  (unit [id-reply:c reply:v1:old:c])
  ?~  v-reply  ~
  `[time (uv-reply-1 parent-id u.v-reply)]
::
++  uv-replies-1
  |=  [parent-id=id-post:c =v-replies:c]
  ^-  replies:v7:old:c
  %+  gas:on-replies:v7:old:c  *replies:v7:old:c
  %+  murn  (tap:on-v-replies:c v-replies)
  |=  [=time v-reply=(unit v-reply:c)]
  ^-  (unit [id-reply:c (unit reply:v7:old:c)])
  ?~  v-reply  `[time ~]
  `[time `(uv-reply-1 parent-id u.v-reply)]
::
++  uv-replies-2
  |=  [parent-id=id-post:c =v-replies:c]
  ^-  replies:c
  %+  gas:on-replies:c  *replies:c
  %+  murn  (tap:on-v-replies:c v-replies)
  |=  [=time v-reply=(unit v-reply:c)]
  ^-  (unit [id-reply:c (unit reply:c)])
  ?~  v-reply  `[time ~]
  `[time `(uv-reply-2 parent-id u.v-reply)]
::
++  s-replies-1
  |=  =replies:c
  ^-  simple-replies:v7:old:c
  %+  gas:on-simple-replies:v7:old:c  *simple-replies:v7:old:c
  %+  murn  (tap:on-replies:c replies)
  |=  [=time reply=(unit reply:c)]
  ^-  (unit [id-reply:c simple-reply:v7:old:c])
  ?~  reply  ~
  (some [time (s-reply-1 u.reply)])
::
++  s-replies-2
  |=  =replies:c
  ^-  simple-replies:c
  %+  gas:on-simple-replies:c  *simple-replies:c
  %+  murn  (tap:on-replies:c replies)
  |=  [=time reply=(unit reply:c)]
  ^-  (unit [id-reply:c simple-reply:c])
  ?~  reply  ~
  (some [time (s-reply-2 u.reply)])
::
++  suv-replies-1
  |=  [parent-id=id-post:c =v-replies:c]
  ^-  simple-replies:v7:old:c
  (s-replies-1 (uv-replies-2 parent-id v-replies))
::
++  uv-reply-2
  |=  [parent-id=id-reply:c =v-reply:c]
  ^-  reply:c
  :_  +.v-reply
  [id.v-reply parent-id (uv-reacts-1 reacts.v-reply)]
::
++  uv-reply-1
  |=  [parent-id=id-reply:c =v-reply:c]
  ^-  reply:v7:old:c
  :_  +.v-reply
  [id.v-reply parent-id (uv-reacts-1 reacts.v-reply)]
::
++  s-reply-1
  |=  =reply:c
  ^-  simple-reply:v7:old:c
  :-  -.reply(reacts (reacts-1 reacts.-.reply))
  +>.reply
::
++  s-reply-2
  |=  =reply:c
  ^-  simple-reply:c
  [-.reply +>.reply]
::
++  suv-reply-1
  |=  [parent-id=id-reply:c =v-reply:c]
  ^-  simple-reply:v7:old:c
  (s-reply-1 (uv-reply-1 parent-id v-reply))
::
++  suv-reply-2
  |=  [parent-id=id-reply:c =v-reply:c]
  ^-  simple-reply:c
  (s-reply-2 (uv-reply-2 parent-id v-reply))
::
++  uv-reacts-2
  |=  =v-reacts:c
  ^-  reacts:c
  %-  ~(gas by *reacts:c)
  %+  murn  ~(tap by v-reacts)
  |=  [=ship (rev:c react=(unit react:c))]
  ?~  react  ~
  (some ship u.react)
::
++  uv-reacts-1
  |=  =v-reacts:c
  ^-  reacts:v7:old:c
  %-  ~(gas by *reacts:v7:old:c)
  %+  murn  ~(tap by v-reacts)
  |=  [=ship (rev:c react=(unit react:c))]
  ?~  react  ~
  ?~  react-1=(react-1 u.react)  ~
  (some ship u.react-1)
::
::
++  react-1
  |=  =react:c
  ^-  (unit react:v7:old:c)
  ?@  react
    ?~  short=(rave:em react)  ~
    (some u.short)
  ?-  -.react
    %any  (some p.react)
  ==
::
++  reacts-1
  |=  =reacts:c
  ^-  reacts:v7:old:c
  %-  ~(rep by reacts)
  |=  [[=ship =react:c] =reacts:v7:old:c]
  ?~  react=(react-1 react)
    reacts
  (~(put by reacts) ship u.react)
::
++  replies-1
  |=  =replies:c
  ^-  replies:v7:old:c
  %+  run:on-replies:c  replies
  |=  reply=(unit reply:c)
  ^-  (unit reply:v7:old:c)
  ?~  reply  ~
  (some u.reply(reacts (reacts-1 reacts.u.reply)))
::
++  seal-1
  |=  =seal:c
  ^-  seal:v7:old:c
  %*  .  *seal:v7:old:c
    id       id.seal
    reacts   (reacts-1 reacts.seal)
    replies  (replies-1 replies.seal)
    reply-meta  reply-meta.seal
  ==
::
++  post-1
  |=  =post:c
  ^-  post:v7:old:c
  %*  .  *post:v7:old:c
    -  (seal-1 -.post)
    +  +.post
  ==
::
++  posts-1
  |=  =posts:c
  ^-  posts:v7:old:c
  %+  gas:on-posts:v7:old:c  *posts:v7:old:c
  %+  turn  (tap:on-posts:c posts)
  |=  [=id-post:c post=(unit post:c)]
  ^-  [id-post:c (unit post:v7:old:c)]
  :-  id-post
  ?~  post  ~
  %-  some
  (post-1 u.post)
::
++  r-channels-1
  |=  =r-channels:c
  ^-  r-channels:v7:old:c
  =+  r-channel=r-channel.r-channels
  :-  nest.r-channels
  ^-  r-channel:v7:old:c
  ?+  r-channel  r-channel
    [%posts *]
  :-  %posts
  (posts-1 posts.r-channel)
  ::
    [%post id=id-post:c %set *]
  ?~  post.r-post.r-channel
    r-channel
  r-channel(post.r-post `(post-1 u.post.r-post.r-channel))
  ::
    [%post id=id-post:c %reacts *]
  r-channel(reacts.r-post (reacts-1 reacts.r-post.r-channel))

    [%post id=id-post:c %reply =id-reply:c ^ %reacts *]
  %=  r-channel
    reacts.r-reply.r-post
  (reacts-1 reacts.r-reply.r-post.r-channel)
  ==
  ::
    [%post id=id-post:c %reply =id-reply:c ^ %set *]
  ?~  reply.r-reply.r-post.r-channel
    r-channel
  %=  r-channel
    reacts.u.reply.r-reply.r-post
  (reacts-1 reacts.u.reply.r-reply.r-post.r-channel)
  ==
  ==
::
++  simple-post-1
  |=  post=simple-post:c
  ^-  simple-post:v7:old:c
  %=  post
    reacts  (reacts-1 reacts.post)
    replies  (simple-replies-1 replies.post)
  ==
::
++  simple-reply-1
  |=  =simple-reply:c
  ^-  simple-reply:v7:old:c
  simple-reply(reacts (reacts-1 reacts.simple-reply))
::
++  simple-replies-1
  |=  replies=simple-replies:c
  ^-  simple-replies:v7:old:c
  %+  run:on-simple-replies:c  replies
  simple-reply-1
::
++  to-said-1
  |=  =said:c
  ^-  said:v7:old:c
  %=  said
    q  ?-  -.q.said
         %post
       q.said(post (simple-post-1 post.q.said))
          %reply
       q.said(reply (simple-reply-1 reply.q.said))
       ==
  ==
::
++  said-1
  |=  [=nest:c =plan:c posts=v-posts:c]
  ^-  cage
  =/  post=(unit (unit v-post:c))  (get:on-v-posts:c posts p.plan)
  ?~  q.plan
    =/  post=simple-post:v7:old:c
      ?~  post
        ::TODO  give "outline" that formally declares deletion
        :-  *simple-seal:v7:old:c
        ?-  kind.nest
          %diary  [*memo:c %diary 'Unknown post' '']
          %heap   [*memo:c %heap ~ 'Unknown link']
          %chat   [[[%inline 'Unknown message' ~]~ ~nul *@da] %chat ~]
        ==
      ?~  u.post
        :-  *simple-seal:v7:old:c
        ?-  kind.nest
            %diary  [*memo:c %diary 'This post was deleted' '']
            %heap   [*memo:c %heap ~ 'This link was deleted']
            %chat
          [[[%inline 'This message was deleted' ~]~ ~nul *@da] %chat ~]
        ==
      (suv-post-without-replies-1 u.u.post)
    [%channel-said !>(`said:v7:old:c`[nest %post post])]
  ::
  =/  reply=[reply-seal:v7:old:c memo:c]
    ?~  post
      [*reply-seal:v7:old:c ~[%inline 'Comment on unknown post']~ ~nul *@da]
    ?~  u.post
      [*reply-seal:v7:old:c ~[%inline 'Comment on deleted post']~ ~nul *@da]
    =/  reply=(unit (unit v-reply:c))  (get:on-v-replies:c replies.u.u.post u.q.plan)
    ?~  reply
      [*reply-seal:v7:old:c ~[%inline 'Unknown comment']~ ~nul *@da]
    ?~  u.reply
      [*reply-seal:v7:old:c ~[%inline 'This comment was deleted']~ ~nul *@da]
    (suv-reply-1 p.plan u.u.reply)
  [%channel-said !>(`said:v7:old:c`[nest %reply p.plan reply])]
::
++  said-2
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
      (suv-post-without-replies-2 u.u.post)
    [%channel-said-2 !>(`said:c`[nest %post post])]
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
    (suv-reply-2 p.plan u.u.reply)
  [%channel-said-2 !>(`said:c`[nest %reply p.plan reply])]
::
++  scan-1
  |=  =scan:c
  ^-  scan:v7:old:c
  %+  turn  scan
  |=  ref=reference:c
  ?-  -.ref
    %post
  %=  ref
    reacts.post  (reacts-1 reacts.post.ref)
    replies.post  (simple-replies-1 replies.post.ref)
  ==
    %reply
  ref(reacts.reply (reacts-1 reacts.reply.ref))
  ==
::
++  scam-1
  |=  =scam:c
  ^-  scam:v7:old:c
  scam(scan (scan-1 scan.scam))
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
::
++  channel-head-1
  =|  slip=_|
  |=  [since=(unit id-post:c) =nest:c v-channel:c]
  ^-  (unit [_nest time (unit post:v7:old:c)])
  ::  if there is no latest post, give nothing
  ::
  ?~  vp=(ram:on-v-posts:c posts)  ~
  ::  if latest was deleted, try the next-latest message instead
  ::
  ?~  val.u.vp
    $(slip &, posts +:(pop:on-v-posts:c posts))
  =*  result
    `[nest recency.remark `(uv-post-without-replies-1 u.val.u.vp)]
  ::  if the request is bounded, check that latest message is "in bounds"
  ::  (and not presumably already known by the requester)
  ::
  ?:  ?|  ?=(~ since)
          |((gth key.u.vp u.since) (gth recency.remark u.since))
      ==
    ::  latest is in range (or recency was changed), give it directly
    ::
    result
  ::  "out of bounds", ...but! latest may have changed itself, or only
  ::  be latest because something else was deleted. the latter case we
  ::  already detected, and so easily branch on here:
  ::
  ?:  slip  result
  ::  edits are detected through changelogs. look at the relevant log range,
  ::  and see if any update affects the latest post.
  ::NOTE  if our mops were the other way around, we could +dip:on instead
  ::
  =;  changed=?
    ?.(changed ~ result)
  %+  lien  (bap:log-on:c (lot:log-on:c log since ~))
  |=  [key=time val=u-channel:c]
  &(?=([%post * %set *] val) =(id.val key.u.vp))
::
++  channel-head-2
  =|  slip=_|
  |=  [since=(unit id-post:c) =nest:c v-channel:c]
  ^-  (unit [_nest time (unit post:c)])
  ::  if there is no latest post, give nothing
  ::
  ?~  vp=(ram:on-v-posts:c posts)  ~
  ::  if latest was deleted, try the next-latest message instead
  ::
  ?~  val.u.vp
    $(slip &, posts +:(pop:on-v-posts:c posts))
  =*  result
    `[nest recency.remark `(uv-post-without-replies-2 u.val.u.vp)]
  ::  if the request is bounded, check that latest message is "in bounds"
  ::  (and not presumably already known by the requester)
  ::
  ?:  ?|  ?=(~ since)
          |((gth key.u.vp u.since) (gth recency.remark u.since))
      ==
    ::  latest is in range (or recency was changed), give it directly
    ::
    result
  ::  "out of bounds", ...but! latest may have changed itself, or only
  ::  be latest because something else was deleted. the latter case we
  ::  already detected, and so easily branch on here:
  ::
  ?:  slip  result
  ::  edits are detected through changelogs. look at the relevant log range,
  ::  and see if any update affects the latest post.
  ::NOTE  if our mops were the other way around, we could +dip:on instead
  ::
  =;  changed=?
    ?.(changed ~ result)
  %+  lien  (bap:log-on:c (lot:log-on:c log since ~))
  |=  [key=time val=u-channel:c]
  &(?=([%post * %set *] val) =(id.val key.u.vp))
::
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
::
++  cite
  |%
  ++  grab-post
    |=  [=bowl:gall ref=cite:ci]
    ^-  (unit [=nest:g =post:c])
    ?.  ?=(%chan -.ref)
      ~
    ::TODO  the whole "deconstruct the ref path" situation is horrendous
    ?.  ?=([?(%msg %note %curio) @ ~] wer.ref)
      ~
    =,  ref
    =/  base=path
      %+  weld
        /(scot %p our.bowl)/channels/(scot %da now.bowl)
      /v2/[p.nest]/(scot %p p.q.nest)/[q.q.nest]
    ?.  .^(? %gu base)  ~
    :+  ~  nest
    .^  post:c  %gx
      %+  weld  base
      /posts/post/(scot %ud (rash i.t.wer dum:ag))/channel-post-2
    ==
  ::
  ++  from-post
    |=  [=nest:g =id-post:c =kind-data:c]
    ^-  cite:ci
    =/  kind
      ?-  -.kind-data
        %chat   %msg
        %diary  %note
        %heap   %curio
      ==
    [%chan nest /[kind]/(crip (a-co:co id-post))]
  --
::
++  flatten-inline
  |=  i=inline:c
  ^-  cord
  ?@  i  i
  ?-  -.i
    ?(%italics %bold %strike %blockquote)  (rap 3 (turn p.i flatten-inline))
    ?(%inline-code %code %tag)  p.i
    %ship   (scot %p p.i)
    %block  q.i
    %link   q.i
    %task   (rap 3 (turn q.i flatten-inline))
    %break  '\0a'
  ==
::
++  first-inline
  |=  content=story:c
  ^-  (list inline:c)
  ?~  content  ~
  ?:  ?=(%inline -.i.content)
    p.i.content
  ?+  -.p.i.content  $(content t.content)
    %header   q.p.i.content
  ::
      %listing
    |-
    ?-  -.p.p.i.content
      %list  ::TODO  or check listing first?
              ?.  =(~ r.p.p.i.content)
                r.p.p.i.content
              ?~  q.p.p.i.content  ~
              =/  r  $(p.p.i.content i.q.p.p.i.content)
              ?.  =(~ r)  r
              $(q.p.p.i.content t.q.p.p.i.content)
      %item  p.p.p.i.content
    ==
  ==
::
++  en-manx  ::NOTE  more commonly, marl, but that's just (list manx)
  ::  anchors: whether to render <a> tags around images and links.
  ::           you may not want this when nesting the content inside of another
  ::           <a>, browsers consider this illegal and will mangle the document.
  =/  anchors=?  &
  |%
  ++  content  story
  ++  story
    |=  content=story:c
    ^-  marl
    (zing (turn content verse))
  ::
  ++  verse
    |=  =verse:c
    ^-  marl
    ?-  -.verse
      %block  (block p.verse)
    ::
        %inline
      ;+
      ?:  ?=([[%break ~] ~] p.verse)
        ;br;
      ;p
        ;*  (turn p.verse inline)
      ==
    ==
  ::
  ++  block
    |=  =block:c
    ^-  marl
    ?-  -.block
        %image
      ;+
      =/  src=tape  (trip src.block)
      ;div.image
        ;+
        =/  img
          ;img@"{src}"
            =height  "{(a-co:co height.block)}"
            =width   "{(a-co:co width.block)}"
            =alt     "{?:(=('' alt.block) "image" (trip alt.block))}";
        ?.  anchors  img
        ;a/"{src}"(target "_blank", rel "noreferrer")
          ;+  img
        ==
      ==
    ::
        %cite
      ;+
      ;div.cite
        ; [reference]  ::TODO  link to /expose if chan ref?
      ==
    ::
        %header
      ;+
      ?-  p.block
        %h1  ;h1  ;*  (turn q.block inline)  ==
        %h2  ;h2  ;*  (turn q.block inline)  ==
        %h3  ;h3  ;*  (turn q.block inline)  ==
        %h4  ;h4  ;*  (turn q.block inline)  ==
        %h5  ;h5  ;*  (turn q.block inline)  ==
        %h6  ;h6  ;*  (turn q.block inline)  ==
      ==
    ::
        %listing
      ?-  -.p.block
          %item
        |-  ^-  marl
        ?:  ?=([[%break ~] ~] p.p.block)
          ~  ::  filter out trailing newlines
        ?~  p.p.block  ~
        :-  (inline i.p.p.block)
        $(p.p.block t.p.p.block)
      ::
          %list
        %+  weld
          `marl`(turn r.p.block inline)
        ^-  marl
        ;+
        ?-  p.p.block
            %ordered
          ;ol
            ;*  %+  turn  q.p.block
                |=  l=listing:c
                ;li
                  ;*  (^block %listing l)
                ==
          ==
        ::
            %unordered
          ;ul
            ;*  %+  turn  q.p.block
                |=  l=listing:c
                ;li
                  ;*  (^block %listing l)
                ==
          ==
        ::
            %tasklist
          ;ul.tasklist
            ;*  %+  turn  q.p.block
                |=  l=listing:c
                ;li
                  ;*  (^block %listing l)
                ==
          ==
        ==
      ==
    ::
        %rule
      ;+  ;hr;
    ::
        %code
      ;+
      ;pre
        ;code:"{(trip code.block)}"
      ==
    ==
  ::
  ++  inline
    |=  =inline:c
    ^-  manx
    ?@  inline
      ;span:"{(trip inline)}"
    ?-  -.inline
        %italics
      ;em
        ;*  (turn p.inline ^inline)
      ==
    ::
        %bold
      ;strong
        ;*  (turn p.inline ^inline)
      ==
    ::
        %strike
      ;s
        ;*  (turn p.inline ^inline)
      ==
    ::
        %blockquote
      ;blockquote
        ;*  (turn p.inline ^inline)
      ==
    ::
        %inline-code
      ;code.inline-code:"{(trip p.inline)}"
    ::
        %code
      ;pre.code
        ;code:"{(trip p.inline)}"
      ==
    ::
        %ship
      ;span.ship:"{(scow %p p.inline)}"
    ::
        %block
      ;span.block:"[block xx]"
    ::
        %tag
      ;span.tag:"[tag xx]"
    ::
        %link
      =/  url=tape  (trip p.inline)
      =?  url  ?=(~ (find "://" url))
        (weld "//" url)
      =/  txt=tape  ?:(=('' q.inline) url (trip q.inline))
      ?.  anchors
        ;span.faux-a:"{txt}"
      ;a/"{url}"
        =target  "_blank"
        =rel     "noreferrer"
        ::NOTE  sail inserts trailing \0a if we do ; {txt},
        ::      which looks bad when links get underlined
        ;+  [%$ [%$ "{txt}"]~]~
      ==
    ::
        %task
      ;div.task
        ;+  ?.  p.inline  ;input(type "checkbox", disabled "");
            ;input(type "checkbox", checked "", disabled "");
        ;*  (turn q.inline ^inline)
      ==
    ::
        %break
      ;br;
    ==
  --
--
