/-  c=channels, gv=groups-ver, ci=cite, s=story, m=meta, h=hooks
/+  em=emojimart, ccv=channel-conv
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
::  +arm convert to v1:c type
::  +arm-1 convert to v7:c type
::  +arm-2 convert to v8 (current) type
::
++  uv-channels-1
  |=  =v-channels:c
  ^-  channels-0:c
  %-  ~(run by v-channels)
  |=  channel=v-channel:c
  ^-  channel-0:c
  %*  .  *channel-0:c
    posts  *posts:v7:c
    perm   +.perm.channel
    view   +.view.channel
    sort   +.sort.channel
    order  +.order.channel
  ==
::
++  uv-channels
  |=  [=v-channels:c full=?]
  ^-  channels:v1:c
  %-  ~(run by v-channels)
  |=  channel=v-channel:c
  ^-  channel:v1:c
  =/  base
    %*  .  *channel:v1:c
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
  ^-  channels:v8:c
  %-  ~(run by v-channels)
  |=  channel=v-channel:c
  ^-  channel:v8:c
  =/  base
    %*  .  *channel:v8:c
      count    count.channel
      meta     +.meta.channel
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
++  uv-channels-3
  |=  [=v-channels:c full=?]
  ^-  channels:c
  %-  ~(run by v-channels)
  |=  channel=v-channel:c
  ^-  channel:c
  =/  base
    %*  .  *channel:c
      count    count.channel
      meta     +.meta.channel
      perm     +.perm.channel
      view     +.view.channel
      sort     +.sort.channel
      order    +.order.channel
      pending  pending.channel
    ==
  ?.  full  base
  %_  base
    posts   (uv-posts-3 posts.channel)
    net     net.channel
    remark  remark.channel
  ==
::
++  uv-posts
  |=  =v-posts:c
  ^-  posts:v1:c
  %+  gas:on-posts:v1:c  *posts:v1:c
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(may:c v-post:c)]
  ^-  [id-post:c (unit post:v1:c)]
  [id-post ?:(?=(%| -.v-post) ~ `(uv-post +.v-post))]
::
++  uv-posts-1
  |=  =v-posts:c
  ^-  posts:v7:c
  %+  gas:on-posts:v7:c  *posts:v7:c
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(may:c v-post:c)]
  ^-  [id-post:c (unit post:v7:c)]
  [id-post (bind (mu-v-post v-post) uv-post-1)]
::
++  uv-posts-2
  |=  =v-posts:c
  ^-  posts:v8:c
  %+  gas:on-posts:v8:c  *posts:v8:c
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(may:c v-post:c)]
  ^-  [id-post:c (unit post:v8:c)]
  [id-post (bind (mu-v-post v-post) uv-post-2)]
::
++  uv-posts-3
  |=  =v-posts:c
  ^-  posts:v9:c
  %+  gas:on-posts:v9:c  *posts:v9:c
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(may:c v-post:c)]
  ^-  [id-post:c (may:c post:v9:c)]
  [id-post ?:(?=(%| -.v-post) v-post [%& (uv-post-3 +.v-post)])]
::
++  s-posts-1
  |=  =posts:c
  ^-  simple-posts:v7:c
  %+  gas:on-simple-posts:v7:c  *simple-posts:v7:c
  %+  turn  (tap:on-posts:c posts)
  |=  [=id-post:c post=(may:c post:c)]
  ^-  [id-post:c (unit simple-post:v7:c)]
  [id-post ?:(?=(%| -.post) ~ `(s-post-1 +.post))]
::
++  suv-posts
  |=  =v-posts:c
  ^-  simple-posts:v1:c
  %+  gas:on-simple-posts:v1:c  *simple-posts:v1:c
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(may:c v-post:c)]
  ^-  [id-post:c (unit simple-post:v1:c)]
  [id-post ?:(?=(%| -.v-post) ~ `(suv-post +.v-post))]
::
++  suv-posts-1
  |=  =v-posts:c
  ^-  simple-posts:v7:c
  %+  gas:on-simple-posts:v7:c  *simple-posts:v7:c
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(may:c v-post:c)]
  ^-  [id-post:c (unit simple-post:v7:c)]
  [id-post ?:(?=(%| -.v-post) ~ `(suv-post-1 +.v-post))]
::
::
++  uv-post
  |=  =v-post:c
  ^-  post:v1:c
  :_  [rev.v-post (v7:essay:v9:ccv +>.v-post)]
  :*  id.v-post
      (v7:reacts:v9:ccv (uv-reacts reacts.v-post))
      (uv-replies id.v-post replies.v-post)
      (v7:reply-meta:v9:ccv (get-reply-meta v-post))
  ==
::
++  uv-post-1
  |=  =v-post:c
  ^-  post:v7:c
  :_  [rev.v-post (v7:essay:v9:ccv +>.v-post)]
  :*  id.v-post
      (v7:reacts:v9:ccv (uv-reacts reacts.v-post))
      (uv-replies-1 id.v-post replies.v-post)
      (v7:reply-meta:v9:ccv (get-reply-meta v-post))
  ==
::
++  uv-post-2
  |=  =v-post:c
  ^-  post:v8:c
  =/  =replies:v8:c
    (uv-replies-2 id.v-post replies.v-post)
  :_  +.v-post
  :*  id.v-post
      seq.v-post
      mod-at.v-post
      (uv-reacts reacts.v-post)
      replies
      (get-reply-meta v-post)
  ==
::
++  uv-post-3
  |=  =v-post:c
  ^-  post:v9:c
  =/  =replies:v9:c
    (uv-replies-3 id.v-post replies.v-post)
  :_  +.v-post
  :*  id.v-post
      seq.v-post
      mod-at.v-post
      (uv-reacts reacts.v-post)
      replies
      (get-reply-meta v-post)
  ==
::
++  s-post-1
  |=  =post:c
  ^-  simple-post:v7:c
  :_  (v7:essay:v9:ccv +>.post)
  =/  seal
    %=  -.post
      reacts      (v7:reacts:v9:ccv reacts.post)
      replies     (s-replies-1 replies.post)
      reply-meta  (v7:reply-meta:v9:ccv reply-meta.post)
    ==
  ::  remove .seq and .mod-at
  [- |3]:seal
::
++  s-post-2
  |=  =post:c
  ^-  simple-post:v8:c
  :_  +>.post
  =/  seal
    =<  -  :: seal
    %=  post
      reacts   (v7:reacts:v9:ccv reacts.post)
      replies  (s-replies-1 replies.post)
    ==
  ::  remove .seq and .mod-at
  [- |3]:seal
::
++  s-post-3
  |=  =post:c
  ^-  simple-post:c
  :_  +>.post
  %=  -.post
    reacts   (v7:reacts:v9:ccv reacts.post)
    replies  (s-replies-2 replies.post)
  ==
++  suv-post
  |=  =v-post:c
  ^-  simple-post:v1:c
  (s-post-1 (uv-post-3 v-post))
::
::
++  suv-post-1
  |=  =v-post:c
  ^-  simple-post:v7:c
  (s-post-1 (uv-post-3 v-post))
::
++  uv-posts-without-replies
  |=  =v-posts:c
  ^-  posts:v1:c
  %+  gas:on-posts:v1:c  *posts:v1:c
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(may:c v-post:c)]
  ^-  [id-post:c (unit post:v1:c)]
  [id-post (bind (mu-v-post v-post) uv-post-without-replies)]
::
++  uv-posts-without-replies-1
  |=  =v-posts:c
  ^-  posts:v7:c
  %+  gas:on-posts:v7:c  *posts:v7:c
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(may:c v-post:c)]
  ^-  [id-post:c (unit post:v7:c)]
  [id-post (bind (mu-v-post v-post) uv-post-without-replies-1)]
::
++  uv-posts-without-replies-2
  |=  =v-posts:c
  ^-  posts:v8:c
  %+  gas:on-posts:v8:c  *posts:v8:c
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(may:c v-post:c)]
  ^-  [id-post:c (unit post:v8:c)]
  [id-post (bind (mu-v-post v-post) uv-post-without-replies-2)]
::
++  uv-posts-without-replies-3
  |=  =v-posts:c
  ^-  posts:v9:c
  %+  gas:on-posts:v9:c  *posts:v9:c
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(may:c v-post:c)]
  ^-  [id-post:c (may:v9:c post:v9:c)]
  :-  id-post
  ?:  ?=(%| -.v-post)  v-post
  &+(uv-post-without-replies-3 +.v-post)
::
++  suv-posts-without-replies
  |=  =v-posts:c
  ^-  simple-posts:v1:c
  %+  gas:on-simple-posts:v1:c  *simple-posts:v1:c
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(may:c v-post:c)]
  ^-  [id-post:c (unit simple-post:v1:c)]
  [id-post (bind (mu-v-post v-post) suv-post-without-replies)]
::
++  suv-posts-without-replies-1
  |=  =v-posts:c
  ^-  simple-posts:v7:c
  %+  gas:on-simple-posts:v7:c  *simple-posts:v7:c
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(may:c v-post:c)]
  ^-  [id-post:c (unit simple-post:v7:c)]
  [id-post (bind (mu-v-post v-post) suv-post-without-replies-1)]
::
++  uv-post-without-replies
  |=  post=v-post:c
  ^-  post:v1:c
  :_  [rev.post (v7:essay:v9:ccv +>.post)]
  :*  id.post
      (v7:reacts:v9:ccv (uv-reacts reacts.post))
      *replies:v1:c
      (v7:reply-meta:v9:ccv (get-reply-meta post))
  ==
::
++  uv-post-without-replies-1
  |=  post=v-post:c
  ^-  post:v7:c
  :_  [rev.post (v7:essay:v9:ccv +>.post)]
  :*  id.post
      (v7:reacts:v9:ccv (uv-reacts reacts.post))
      *replies:v7:c
      (v7:reply-meta:v9:ccv (get-reply-meta post))
  ==
::
++  uv-post-without-replies-2
  |=  post=v-post:c
  ^-  post:v8:c
  :_  +.post
  :*  id.post
      seq.post
      mod-at.post
      (uv-reacts reacts.post)
      *replies:v8:c
      (get-reply-meta post)
  ==
::
++  uv-post-without-replies-3
  |=  post=v-post:c
  ^-  post:c
  :_  +.post
  :*  id.post
      seq.post
      mod-at.post
      (uv-reacts reacts.post)
      *replies:c
      (get-reply-meta post)
  ==
++  suv-post-without-replies
  |=  post=v-post:c
  ^-  simple-post:v1:c
  (s-post-1 (uv-post-without-replies-3 post))
::
++  suv-post-without-replies-1
  |=  post=v-post:c
  ^-  simple-post:v7:c
  (s-post-1 (uv-post-without-replies-3 post))
::
++  suv-post-without-replies-2
  |=  post=v-post:c
  ^-  simple-post:v8:c
  (s-post-2 (uv-post-without-replies-3 post))
::
++  suv-post-without-replies-3
  |=  post=v-post:c
  ^-  simple-post:c
  (s-post-3 (uv-post-without-replies-3 post))
::
++  uv-replies
  |=  [parent-id=id-post:c =v-replies:c]
  ^-  replies:v1:c
  %+  gas:on-replies:v1:c  *replies:v1:c
  %+  murn  (tap:on-v-replies:c v-replies)
  |=  [=time v-reply=(may:c v-reply:c)]
  ^-  (unit [id-reply:c reply:v1:c])
  ?:  ?=(%| -.v-reply)  ~
  `[time (uv-reply-1 parent-id +.v-reply)]
::
++  uv-replies-1
  |=  [parent-id=id-post:c =v-replies:c]
  ^-  replies:v7:c
  %+  gas:on-replies:v7:c  *replies:v7:c
  %+  turn  (tap:on-v-replies:c v-replies)
  |=  [=time v-reply=(may:c v-reply:c)]
  ^-  [id-reply:c (unit reply:v7:c)]
  ?:  ?=(%| -.v-reply)  [time ~]
  [time `(uv-reply-1 parent-id +.v-reply)]
::
++  uv-replies-2
  |=  [parent-id=id-post:c =v-replies:c]
  ^-  replies:v8:c
  %+  gas:on-replies:v8:c  *replies:v8:c
  %+  turn  (tap:on-v-replies:c v-replies)
  |=  [=time v-reply=(may:c v-reply:c)]
  ^-  [id-reply:c (unit reply:v8:c)]
  ?:  ?=(%| -.v-reply)  [time ~]
  [time `(uv-reply-2 parent-id +.v-reply)]
::
++  uv-replies-3
  |=  [parent-id=id-post:c =v-replies:c]
  ^-  replies:c
  %+  gas:on-replies:c  *replies:c
  %+  turn  (tap:on-v-replies:c v-replies)
  |=  [=time v-reply=(may:c v-reply:c)]
  ^-  [id-reply:c (may:c reply:c)]
  ?:  ?=(%| -.v-reply)  [time v-reply]
  [time [-.v-reply (uv-reply-2 parent-id +.v-reply)]]
++  s-replies-1
  |=  =replies:c
  ^-  simple-replies:v7:c
  %+  gas:on-simple-replies:v7:c  *simple-replies:v7:c
  %+  murn  (tap:on-replies:c replies)
  |=  [=time reply=(may:c reply:c)]
  ^-  (unit [id-reply:c simple-reply:v7:c])
  ?:  ?=(%| -.reply)  ~
  (some [time (s-reply-1 +.reply)])
::
++  s-replies-2
  |=  =replies:c
  ^-  simple-replies:c
  %+  gas:on-simple-replies:c  *simple-replies:c
  %+  murn  (tap:on-replies:c replies)
  |=  [=time reply=(may:c reply:c)]
  ^-  (unit [id-reply:c simple-reply:v8:c])
  ?:  ?=(%| -.reply)  ~
  (some [time (s-reply-2 +.reply)])
::
++  suv-replies-1
  |=  [parent-id=id-post:c =v-replies:c]
  ^-  simple-replies:v7:c
  (s-replies-1 (uv-replies-3 parent-id v-replies))
::
++  uv-reply-2
  |=  [parent-id=id-reply:c =v-reply:c]
  ^-  reply:c
  :_  +.v-reply
  [id.v-reply parent-id (v7:reacts:v9:ccv (uv-reacts reacts.v-reply))]
::
++  uv-reply-1
  |=  [parent-id=id-reply:c =v-reply:c]
  ^-  reply:v7:c
  :_  [rev.v-reply (v7:memo:v9:ccv +>.v-reply)]
  [id.v-reply parent-id (v7:reacts:v9:ccv (uv-reacts reacts.v-reply))]
::
++  s-reply-1
  |=  =reply:c
  ^-  simple-reply:v7:c
  (simple-reply-1 -.reply +>.reply)
::
++  s-reply-2
  |=  =reply:c
  ^-  simple-reply:c
  [-.reply +>.reply]
::
++  suv-reply-1
  |=  [parent-id=id-reply:c =v-reply:c]
  ^-  simple-reply:v7:c
  (s-reply-1 (uv-reply-1 parent-id v-reply))
::
++  suv-reply-2
  |=  [parent-id=id-reply:c =v-reply:c]
  ^-  simple-reply:c
  (s-reply-2 (uv-reply-2 parent-id v-reply))
::
++  uv-reacts
  |=  =v-reacts:c
  ^-  reacts:c
  %-  ~(gas by *reacts:c)
  %+  murn  ~(tap by v-reacts)
  |=  [=author:c (rev:c react=(unit react:c))]
  ?~  react  ~
  (some author u.react)
::
++  simple-post-1
  |=  post=simple-post:c
  ^-  simple-post:v7:c
  :_  (v7:essay:v9:ccv +.post)
  ^-  simple-seal:v7:c
  =,  -.post
  :*  id
      (v7:reacts:v9:ccv reacts.post)
      (simple-replies-1 replies.post)
      (v7:reply-meta:v9:ccv reply-meta.post)
  ==
::
++  simple-reply-1
  |=  =simple-reply:c
  ^-  simple-reply:v7:c
  %=  simple-reply
    +  (v7:memo:v9:ccv +.simple-reply)
    reacts  (v7:reacts:v9:ccv reacts.simple-reply)
  ==
::
++  simple-replies-1
  |=  replies=simple-replies:c
  ^-  simple-replies:v7:c
  %+  run:on-simple-replies:c  replies
  simple-reply-1
::
++  reference-1
  |=  ref=reference:c
  ^-  reference:v7:c
  ?-  -.ref
      %post
    =-  ref(post -)
    ?:  ?=(%& -.post.ref)
      (simple-post-1 +.post.ref)
    %*  .  *simple-post:v7:c
      content  `story:v7:c`[%inline ['[deleted message]']~]~
      author  ~nul
    ==
  ::
      %reply
    =-  ref(reply -)
    ?:  ?=(%& -.reply.ref)
      (simple-reply-1 +.reply.ref)
    %*  .  *simple-reply:v7:c
      content  `story:v7:c`[%inline ['[deleted reply]']~]~
      author   ~nul
    ==
  ==
::
++  have-plan  ::NOTE  matches +said-*
  |=  [=nest:c =plan:c posts=v-posts:c]
  ^-  ?
  =/  post=(unit (may:c v-post:c))
    (get:on-v-posts:c posts p.plan)
  ?&  ?=(^ post)        ::  known post, and
  ?|  ?=(~ q.plan)      ::  no reply requested, or
      ?=(%| -.u.post)   ::  no replies available, or
      ?=(^ (get:on-v-replies:c replies.+.u.post u.q.plan))  ::  depth found
  ==  ==
::
++  said-1
  |=  [=nest:c =plan:c posts=v-posts:c]
  ^-  cage
  =/  post=(unit (may:c v-post:c))  (get:on-v-posts:c posts p.plan)
  ?~  q.plan
    =/  post=simple-post:v7:c
      ?~  post
        ::TODO  give "outline" that formally declares deletion
        :-  *simple-seal:v7:c
        ?-  kind.nest
          %diary  [*memo:v7:c %diary 'Unknown post' '']
          %heap   [*memo:v7:c %heap ~ 'Unknown link']
          %chat   [[[%inline 'Unknown message' ~]~ ~nul *@da] %chat ~]
        ==
      ?:  ?=(%| -.u.post)
        :-  *simple-seal:v7:c
        ?-  kind.nest
            %diary  [*memo:v7:c %diary 'This post was deleted' '']
            %heap   [*memo:v7:c %heap ~ 'This link was deleted']
            %chat
          [[[%inline 'This message was deleted' ~]~ ~nul *@da] %chat ~]
        ==
      (suv-post-without-replies-1 +.u.post)
    [%channel-said !>(`said:v7:c`[nest %post post])]
  ::
  =/  reply=[reply-seal:v7:c memo:v7:c]
    ?~  post
      [*reply-seal:v7:c ~[%inline 'Comment on unknown post']~ ~nul *@da]
    ?:  ?=(%| -.u.post)
      [*reply-seal:v7:c ~[%inline 'Comment on deleted post']~ ~nul *@da]
    =/  reply=(unit (may:c v-reply:c))  (get:on-v-replies:c replies.+.u.post u.q.plan)
    ?~  reply
      [*reply-seal:v7:c ~[%inline 'Unknown comment']~ ~nul *@da]
    ?:  ?=(%| -.u.reply)
      [*reply-seal:v7:c ~[%inline 'This comment was deleted']~ ~nul *@da]
    (suv-reply-1 p.plan +.u.reply)
  [%channel-said !>(`said:v7:c`[nest %reply p.plan reply])]
::
++  said-2
  |=  [=nest:c =plan:c posts=v-posts:c]
  ^-  cage
  =/  post=(unit (may:c v-post:c))  (get:on-v-posts:c posts p.plan)
  ?~  q.plan
    =/  post=simple-post:v8:c
      ?~  post
        :-  *simple-seal:v8:c
        ?-  kind.nest
          %diary  [*memo:c /diary/unknown ~ ~]
          %heap   [*memo:c /heap/unknown ~ ~]
          %chat   [*memo:c /chat/unknown ~ ~]
        ==
      ?:  ?=(%| -.u.post)
        :-  *simple-seal:v8:c
        ?-  kind.nest
            %diary  [*memo:c /diary/deleted ~ ~]
            %heap   [*memo:c /heap/deleted ~ ~]
            %chat   [*memo:c /chat/deleted ~ ~]
        ==
      (suv-post-without-replies-2 +.u.post)
    [%channel-said-1 !>(`said:v8:c`[nest %post post])]
  =/  reply=[reply-seal:v8:c memo:v8:c]
    ::XX the missing/deleted handling here is not great,
    ::   and can't be fixed in the same manner as above.
    ::   it seems $reference should explicitly support
    ::   missing/deleted content
    ::
    ?~  post
      [*reply-seal:c ~[%inline 'Comment on unknown post']~ ~nul *@da]
    ?:  ?=(%| -.u.post)
      [*reply-seal:c ~[%inline 'Comment on deleted post']~ ~nul *@da]
    =/  reply=(unit (may:c v-reply:c))
      (get:on-v-replies:c replies.+.u.post u.q.plan)
    ?~  reply
      [*reply-seal:c ~[%inline 'Unknown comment']~ ~nul *@da]
    ?:  ?=(%| -.u.reply)
      [*reply-seal:c ~[%inline 'This comment was deleted']~ ~nul *@da]
    (suv-reply-2 p.plan +.u.reply)
  [%channel-said-1 !>(`said:v8:c`[nest %reply p.plan reply])]
::
++  said-3
  |=  [=nest:c =plan:c posts=v-posts:c]
  ^-  cage
  =/  post=(unit (may:c v-post:c))  (get:on-v-posts:c posts p.plan)
  ?~  q.plan
    =/  post=(may:v9:c simple-post:v9:c)
      ?~  post
        :-  %&  ::TODO  should eventually just unitize $reference
        :-  *simple-seal:v9:c
        ?-  kind.nest
          %diary  [*memo:c /diary/unknown ~ ~]
          %heap   [*memo:c /heap/unknown ~ ~]
          %chat   [*memo:c /chat/unknown ~ ~]
        ==
      ?:  ?=(%| -.u.post)  u.post
      &+(suv-post-without-replies-3 +.u.post)
    [%channel-said-2 !>(`said:v9:c`[nest %post post])]
  =/  reply=(may:v9:c simple-reply:v9:c)
    ::XX the missing/deleted handling here is not great,
    ::   and can't be fixed in the same manner as above.
    ::   it seems $reference should explicitly support
    ::   missing/deleted content
    ::
    ?~  post
      &+[*reply-seal:c ~[%inline 'Comment on unknown post']~ ~nul *@da]
    ?:  ?=(%| -.u.post)
      &+[*reply-seal:c ~[%inline 'Comment on deleted post']~ ~nul *@da]
    =/  reply=(unit (may:c v-reply:c))  (get:on-v-replies:c replies.+.u.post u.q.plan)
    ?~  reply
      &+[*reply-seal:c ~[%inline 'Unknown comment']~ ~nul *@da]
    ?:  ?=(%| -.u.reply)  u.reply
    &+(suv-reply-2 p.plan +.u.reply)
  [%channel-said-2 !>(`said:v9:c`[nest %reply p.plan reply])]
++  may-bind
  |*  f=$-(* *)
  |*  v=(may:c *)
  ?:  ?=(%| -.v)  ~
  `(f +.v)
++  mu-v-post
  |=  v-post=(may:c v-post:c)
  ^-  (unit v-post:c)
  ((may-bind same) v-post)
++  mu-v-reply
  |=  v-reply=(may:c v-reply:c)
  ^-  (unit v-reply:c)
  ((bake (may-bind same) (may:c v-reply:c)) v-reply)
++  was-mentioned
  |=  [=story:s who=ship seat=(unit seat:v7:gv)]
  ^-  ?
  %+  lien  story
  |=  =verse:s
  ?:  ?=(%block -.verse)  |
  %+  lien  p.verse
  |=  =inline:s
  ?@  inline  |
  ?+  -.inline  |
    %ship  =(who p.inline)
  ::
      %sect
    ?~  p.inline  &
    ?~  seat  |
    (~(has in roles.u.seat) `role-id:v7:gv`p.inline)
  ==
::
++  drop-bad-links
  |%
  ++  channel
    |=  chan=v-channel:c
    ^+  chan
    %_  chan
        posts
      %+  run:on-v-posts:c
        posts.chan
      |=  post=(may:c v-post:c)
      ?.  ?=(%& -.post)  post
      post(+>+ (essay +>+.post))
    ::
        log
      %+  run:log-on:c
        log.chan
      |=  upd=u-channel:c
      ?.  ?=([%post * ?([%set %& *] [%essay *])] upd)  upd
      ?-  -.u-post.upd
        %set    upd(+>+.post.u-post (essay +>+.post.u-post.upd))
        %essay  upd(essay.u-post (essay essay.u-post.upd))
      ==
    ==
  ++  said
    |=  =said:c
    ?+  q.said  said
      [%post %& *]     said(+>.post.q (essay +>.post.q.said))
      [%reply @ %& *]  said(content.reply.q (story content.reply.q.said))
    ==
  ++  essay
    |=  =essay:c
    %_  essay
      content  (story content.essay)
      meta     (bind meta.essay meta)
    ==
  ++  meta
    |=  =data:m
    %_  data
      image  ?:((is-good-link image.data) image.data '')
      cover  ?:((is-good-link cover.data) cover.data '')
    ==
  ++  story
    |=  content=story:c
    ^+  content
    (turn content verse)
  ++  verse
    |=  =verse:s
    ^+  verse
    ?-  -.verse
        %block
      ?+  -.p.verse  verse
        %image  ?:((is-good-link src.p.verse) verse verse(src.p ''))
        %link   ?:((is-good-link url.p.verse) verse verse(url.p ''))
      ==
    ::
        %inline
      :-  %inline
      %+  turn  p.verse
      |=  =inline:s
      ?+  inline  inline
        [%link *]  ?:((is-good-link p.inline) inline inline(p ''))
      ==
    ==
  ++  is-good-link
    |=  =cord
    ?|  =('' cord)
        =('http' (end 3^4 cord))
        =('#' (end 3 cord))
        =('/' (end 3 cord))
    ==
  --
::
++  flatten
  |=  content=(list verse:s)
  ^-  cord
  %+  rap   3
  %+  turn  content
  |=  v=verse:s
  ^-  cord
  ?-  -.v
      %block  ''
      %inline
    %+  rap  3
    %+  turn  p.v
    |=  c=inline:s
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
    ::
        ?(%italics %bold %strike %blockquote)
      (flatten [%inline p.c]~)
    ::
        %sect
      ?~  p.c  '@all'
      (cat 3 '@' (scot %tas p.c))
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
  =/  entries=(list [time (may:c v-reply:c)])  (bap:on-v-replies:c replies)
  =/  count  0
  |-  ^-  @ud
  ?:  =(~ entries)
    count
  =/  [* reply=(may:c v-reply:c)]  -.entries
  ?:  ?=(%| -.reply)  $(entries +.entries)
  $(entries +.entries, count +(count))
::
++  get-last-repliers
  |=  [post=v-post:c pending=(unit author:c)]  ::TODO  could just take =v-replies
  ^-  (set author:c)
  =/  replyers=(set author:c)  ?~(pending ~ (sy u.pending ~))
  =/  entries=(list [time (may:c v-reply:c)])  (bap:on-v-replies:c replies.post)
  |-
  ?:  |(=(~ entries) =(3 ~(wyt in replyers)))
    replyers
  =/  [* reply=(may:c v-reply:c)]  -.entries
  ?:  ?=(%| -.reply)  $(entries +.entries)
  ?:  (~(has in replyers) author.+.reply)
    $(entries +.entries)
  =.  replyers  (~(put in replyers) author.+.reply)
  $(entries +.entries)
::
++  channel-head
  =|  slip=_|
  |=  [since=(unit id-post:c) =nest:c v-channel:c]
  ^-  (unit [_nest time (may:c post:v9:c)])
  ::  if there is no latest post, give nothing
  ::
  ?~  vp=(ram:on-v-posts:c posts)  ~
  ::  if latest was deleted, try the next-latest message instead
  ::
  ?:  ?=(%| -.val.u.vp)
    $(slip &, posts +:(pop:on-v-posts:c posts))
  =*  result
    `[nest recency.remark %& (uv-post-without-replies-3 +.val.u.vp)]
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
  ::TODO  there's +dop in the mop extensions!
  ::
  =;  changed=?
    ?.(changed ~ result)
  %+  lien  (bap:log-on:c (lot:log-on:c log since ~))
  |=  [key=time val=u-channel:c]
  &(?=([%post * %set *] val) =(id.val key.u.vp))
::
++  perms
  |_  [our=@p now=@da =nest:c group=flag:gv]
  ++  our-host  =(our ship.nest)
  ++  groups-scry
    ^-  path
    :-  (scot %p our)
    /groups/(scot %da now)/v2/groups/(scot %p p.group)/[q.group]
  ::
  ++  is-admin
    |=  her=ship
    ?:  =(ship.nest her)  &
    .^  admin=?
    ;:  weld
        /gx
        groups-scry
        /seats/(scot %p her)/is-admin/noun
    ==  ==
  ::
  ++  can-read
    |=  her=ship
    ?:  =(our her)  &
    =/  =path
      %+  welp  groups-scry
      /channels/can-read/noun
    =/  test=$-([ship nest:gv] ?)
      =>  [path=path nest=nest:gv ..zuse]  ~+
      .^($-([ship nest] ?) %gx path)
    (test her nest)
  ::
  ++  can-write
    |=  [her=ship writers=(set role-id:v7:gv)]
    ?:  =(ship.nest her)  &
    =/  =path
      %+  welp  groups-scry
      :+  %channels
        kind.nest
      /(scot %p ship.nest)/[name.nest]/can-write/(scot %p her)/noun
    =+  .^(write=(unit [admin=? roles=(set role-id:v7:gv)]) %gx path)
    ?~  write  |
    =/  perms  (need write)
    ?:  |(admin.perms =(~ writers))  &
    !=(~ (~(int in writers) roles.perms))
  --
::
++  cite
  |%
  ++  ref-to-pointer  ::TODO  formalize "pointer" type?
    |=  ref=cite:ci
    ^-  (unit [=nest:gv =plan:c])
    ?.  ?=(%chan -.ref)
      ~
    ::TODO  the whole "deconstruct the ref path" situation is horrendous
    ?.  ?=([?(%msg %note %curio) ?([@ ~] [@ @ ~])] wer.ref)
      ~
    =,  ref
    ?~  pid=(rush i.t.wer dum:ag)  ~
    ?@  t.t.wer.ref
      `[nest u.pid ~]
    ?~  rid=(rush i.t.t.wer dum:ag)  ~
    `[nest u.pid `u.rid]
  ::
  ++  grab-post
    |=  [=bowl:gall ref=cite:ci]
    ^-  (unit [=nest:gv =post:c])
    ?~  point=(ref-to-pointer ref)
      ~
    =,  u.point
    ?^  q.plan  ~  ::TODO  support?
    =/  base=path
      %+  weld
        /(scot %p our.bowl)/channels/(scot %da now.bowl)
      /v3/[p.nest]/(scot %p p.q.nest)/[q.q.nest]
    ?.  .^(? %gu base)  ~
    :+  ~  nest
    .^  post:c  %gx
      %+  weld  base
      /posts/post/(scot %ud p.plan)/channel-post-3
    ==
  ::
  ++  from-post
    |=  [=nest:gv =id-post:c kind=path]
    ^-  cite:ci
    =/  kind=@ta
      ?+  kind  ~&([%from-post-strange-kind kind] %msg)
        [%chat *]   %msg
        [%diary *]  %note
        [%heap *]   %curio
      ==
    [%chan nest /[kind]/(crip (a-co:co id-post))]
  --
::
++  flatten-inline
  |=  i=inline:s
  ^-  cord
  ?@  i  i
  ?-  -.i
    ?(%italics %bold %strike %blockquote)  (rap 3 (turn p.i flatten-inline))
    ?(%inline-code %code %tag)  p.i
    %ship   (scot %p p.i)
    %sect   ?~(p.i '@all' (cat 3 '@' p.i))
    %block  q.i
    %link   q.i
    %task   (rap 3 (turn q.i flatten-inline))
    %break  '\0a'
  ==
::
++  first-inline
  |=  content=story:s
  ^-  (list inline:s)
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
    |=  content=story:s
    ^-  marl
    (zing (turn content verse))
  ::
  ++  verse
    |=  =verse:s
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
    |=  =block:s
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
                |=  l=listing:s
                ;li
                  ;*  (^block %listing l)
                ==
          ==
        ::
            %unordered
          ;ul
            ;*  %+  turn  q.p.block
                |=  l=listing:s
                ;li
                  ;*  (^block %listing l)
                ==
          ==
        ::
            %tasklist
          ;ul.tasklist
            ;*  %+  turn  q.p.block
                |=  l=listing:s
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
    ::
        %link
      ::TODO  render w/ preview data
      ;*  :~
        (inline %link url.block url.block)
        ;br;
      ==
    ==
  ::
  ++  inline
    |=  =inline:s
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
        %sect
      ?~  p.inline  ;span.sect:"@all"
      ;span.sect:"@{<p.inline>}"
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
++  said-7-to-8  v8:said:v7:ccv
++  said-8-to-9  v9:said:v8:ccv
++  v-channels-8-to-9  v9:v-channels:v8:ccv
++  v-posts-8-to-9  v9:v-posts:v8:ccv
++  v-replies-8-to-9  v9:v-replies:v8:ccv
++  log-8-to-9  v9:log:v8:ccv
++  v-channels-7-to-8  v8:v-channels:v7:ccv
++  pending-7-to-8  v8:pending:v7:ccv
++  memo-7-to-8  v8:memo:v7:ccv
++  essay-7-to-8  v8:essay:v7:ccv
++  v-posts-7-to-8  v8:v-posts:v7:ccv
++  v-replies-7-to-8  v8:v-replies:v7:ccv
++  v-reacts-7-to-8  v8:v-reacts:v7:ccv
++  react-7-to-8  v8:react:v7:ccv
++  u-post-set-7-to-8  v8:u-post-set:v7:ccv
++  u-post-not-set-7-to-8  v8:u-post-not-set:v7:ccv
++  log-7-to-8  v7:log:v8:ccv
::  +repair-channel: patches seq nr and tombstone problems
::
::    various migrations and adjustments might have caused channel state to
::    become inconsistent. the below addresses the following problems:
::    - orphaned/bunted tombstones, in both the log and posts lists
::    - inconsistent sequence nrs between log entries
::    - inconsistent sequence nrs between log and posts
::    - gaps in sequence nrs in the posts
::    - duplicate sequence nrs in the posts
::    it achieves this by walking the posts from past to present. it tracks a
::    fresh .count, incrementing only for every known top-level message, and
::    tracks an id->seq mapping. that mapping is then used in walking the log,
::    making sure the log has matching and consisent sequence numbers.
::    after you run this (on the channel host), take care to make clients
::    (re-)request the seqs and tombs!
::
++  repair-channel
  |=  [n=nest:v9:c v=v-channel:v9:c]
  ^+  v
  ::  renumber posts based on the order in which they show up,
  ::  dropping bad tombstones along the way
  ::
  ::TODO  could do +drop-bad-tombstones separately here
  ::      if we no longer need .dead
  =^  [count=@ud seqs=(map id-post:v9:c @ud) dead=(set id-post:v9:c)]  posts.v
    (renumber-posts posts.v)
  =.  count.v  count
  =.  log.v  (renumber-log n log.v seqs dead)
  v
++  renumber-posts
  |=  posts=v-posts:v9:c
  =/  state  ,[count=@ud seqs=(map id-post:v9:c @ud) dead=(set id-post:v9:c)]
  ^-  [state _posts]
  %-  (dip:on-v-posts:v9:c state)
  :+  posts  *state
  |=  [state =id-post:v9:c post=(may:v9:c v-post:v9:c)]
  ^-  [(unit _post) stop=? state]
  ?:  &(?=(%| -.post) =(*@ud seq.post) =(*@p author.post))
    [~ | count seqs (~(put in dead) id-post)]
  =.  count  +(count)
  =.  seqs   (~(put by seqs) id-post count)
  =.  post
    ?-  -.post
      %&  post(seq count)
      %|  post(seq count)
    ==
  [`post | count seqs dead]
++  drop-bad-tombstones
  |=  posts=v-posts:v9:c
  ^+  posts
  =<  +
  %-  (dip:on-v-posts:v9:c ,~)
  :+  posts  ~
  |=  [~ =id-post:v9:c post=(may:v9:c v-post:v9:c)]
  ^-  [(unit _post) stop=? ~]
  :_  [| ~]
  ?.  ?=(%| -.post)  `post
  ?:  &(=(*@ud seq.post) =(*@p author.post))
    ~
  `post
++  renumber-log
  |=  [n=nest:v9:c =log:v9:c seqs=(map id-post:v9:c @ud) dead=(set id-post:v9:c)]
  ^+  log
  ::  do a "repair" pass over the log: walk it and re-apply sequence nrs,
  ::  ensuring that the log contains consistent sequence nrs for every post id.
  ::
  =<  +
  %-  (dip:log-on:v9:c ,~)
  :+  log  ~
  |=  [~ =time update=u-channel:v9:c]
  ^-  [(unit u-channel:v9:c) stop=? ~]
  =*  info  [nest=n id=id.update log=time]
  ?+  update  [`update | ~]
      [%post * %set *]
    ~|  info
    ?.  (~(has by seqs) id.update)
      ?:  (~(has in dead) id.update)
        ::NOTE  since we removed the matching post from the post list,
        ::      we must drop this related log entry too.
        [~ | ~]
      ~&  >>>  [%log-for-unknown id=id.update]
      [~ | ~]
    =+  seq=(~(got by seqs) id.update)
    =.  update
      ?-  -.post.u-post.update
        %&  update(seq.post.u-post seq)
        %|  update(seq.post.u-post seq)
      ==
    [`update | ~]
  ::
    ::NOTE  we do not worry about replies
  ==
::
++  get-author-ship
  |=  =author:c
  ^-  ship
  ?@  author  author
  ship.author
::
++  get-person-ship
  |=  =author:c
  ^-  (unit ship)
  ?^  author  ~
  (some author)
::
++  subject  ^~(!>(..compile))
::
++  compile
  |=  src=@t
  ^-  (each vase tang)
  =/  tonk=(each vase tang)
    =/  vex=(like hoon)  ((full vest) [0 0] (trip src))
    ?~  q.vex  |+~[leaf+"\{{<p.p.vex>} {<q.p.vex>}}" 'syntax error']
    %-  mule
    |.((~(mint ut p:subject) %noun p.u.q.vex))
  %-  (slog (crip "parsed hoon: {<-.tonk>}") ~)
  ?:  ?=(%| -.tonk)
    %-  (slog 'returning error' p.tonk)
    tonk
  &+p.tonk
::
++  run-hook
  |=  [=args:h =hook:h]
  ^-  (unit return:h)
  %-  (slog (crip "running hook: {<name.hook>} {<id.hook>}") ~)
  %-  ?~  channel.bowl.args  same
      (slog (crip "on channel: {<nest.u.channel.bowl.args>}") ~)
  ?~  compiled.hook  ~
  =/  gate  [p.u.compiled.hook .*(q:subject q.u.compiled.hook)]
  =+  !<(=outcome:h (slam gate !>(args)))
  %-  (slog (crip "{(trip name.hook)} {<id.hook>} hook run:") ~)
  %-  (slog >outcome< ~)
  ?:  ?=(%.y -.outcome)  `p.outcome
  ((slog 'hook failed:' p.outcome) ~)
--
