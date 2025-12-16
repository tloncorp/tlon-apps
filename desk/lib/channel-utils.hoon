/-  c=channels, cv=channels-ver, gv=groups-ver, ci=cite, s=story, m=meta, h=hooks
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
  ~>  %spin.['libcu-uv-channels-1']
  ^-  channels-0:v7:cv
  %-  ~(run by v-channels)
  |=  channel=v-channel:c
  ^-  channel-0:v7:cv
  %*  .  *channel-0:v7:cv
    posts  *posts:v7:cv
    perm   +.perm.channel
    view   +.view.channel
    sort   +.sort.channel
    order  +.order.channel
  ==
::
++  uv-channels
  |=  [=v-channels:c full=?]
  ~>  %spin.['libcu-uv-channels']
  ^-  channels:v1:cv
  %-  ~(run by v-channels)
  |=  channel=v-channel:c
  ^-  channel:v1:cv
  =/  base
    %*  .  *channel:v1:cv
      perm   +.perm.channel
      view   +.view.channel
      sort   +.sort.channel
      order  +.order.channel
      pending  (v1:pending-messages:v9:ccv pending.channel)
    ==
  ?.  full  base
  %_  base
    posts  (uv-posts posts.channel)
    net  [p load]:net.channel
    remark  remark.channel
  ==
::
++  uv-channels-2
  |=  [=v-channels:c full=?]
  ~>  %spin.['libcu-uv-channels-2']
  ^-  channels:v8:cv
  %-  ~(run by v-channels)
  |=  channel=v-channel:c
  ^-  channel:v8:cv
  =/  base
    %*  .  *channel:v8:cv
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
    net     [p load]:net.channel
    remark  remark.channel
  ==
::
++  uv-channels-3
  |=  [=v-channels:c full=?]
  ~>  %spin.['libcu-uv-channels-3']
  ^-  channels:v9:cv
  %-  ~(run by v-channels)
  |=  channel=v-channel:c
  ^-  channel:v9:cv
  =/  base
    %*  .  *channel:v9:cv
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
    net     [p load]:net.channel
    remark  remark.channel
  ==
::
++  uv-channels-4
  |=  [=v-channels:c full=?]
  ~>  %spin.['libcu-uv-channels-4']
  ^-  channels:v10:cv
  %-  ~(run by v-channels)
  |=  channel=v-channel:c
  ^-  channel:v10:cv
  =/  base
    %*  .  *channel:v10:cv
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
  ~>  %spin.['libcu-uv-posts']
  ^-  posts:v1:cv
  %+  gas:on-posts:v1:cv  *posts:v1:cv
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(may:c v-post:c)]
  ^-  [id-post:c (unit post:v1:cv)]
  [id-post ?:(?=(%| -.v-post) ~ `(uv-post +.v-post))]
::
++  uv-posts-1
  |=  =v-posts:c
  ~>  %spin.['libcu-uv-posts-1']
  ^-  posts:v7:cv
  %+  gas:on-posts:v7:cv  *posts:v7:cv
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(may:c v-post:c)]
  ^-  [id-post:c (unit post:v7:cv)]
  [id-post (bind (mu-v-post v-post) uv-post-1)]
::
++  uv-posts-2
  |=  =v-posts:c
  ~>  %spin.['libcu-uv-posts-2']
  ^-  posts:v8:cv
  %+  gas:on-posts:v8:cv  *posts:v8:cv
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(may:c v-post:c)]
  ^-  [id-post:c (unit post:v8:cv)]
  [id-post (bind (mu-v-post v-post) uv-post-2)]
::
++  uv-posts-3
  |=  =v-posts:c
  ~>  %spin.['libcu-uv-posts-3']
  ^-  posts:v9:cv
  %+  gas:on-posts:v9:cv  *posts:v9:cv
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(may:c v-post:c)]
  ^-  [id-post:c (may:c post:v9:cv)]
  [id-post ?:(?=(%| -.v-post) v-post [%& (uv-post-3 +.v-post)])]
::
++  s-posts-1
  |=  =posts:c
  ~>  %spin.['libcu-s-posts-1']
  ^-  simple-posts:v7:cv
  %+  gas:on-simple-posts:v7:cv  *simple-posts:v7:cv
  %+  turn  (tap:on-posts:c posts)
  |=  [=id-post:c post=(may:c post:c)]
  ^-  [id-post:c (unit simple-post:v7:cv)]
  [id-post ?:(?=(%| -.post) ~ `(s-post-1 +.post))]
::
++  suv-posts
  |=  =v-posts:c
  ~>  %spin.['libcu-suv-posts']
  ^-  simple-posts:v1:cv
  %+  gas:on-simple-posts:v1:cv  *simple-posts:v1:cv
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(may:c v-post:c)]
  ^-  [id-post:c (unit simple-post:v1:cv)]
  [id-post ?:(?=(%| -.v-post) ~ `(suv-post +.v-post))]
::
++  suv-posts-1
  |=  =v-posts:c
  ~>  %spin.['libcu-suv-posts-1']
  ^-  simple-posts:v7:cv
  %+  gas:on-simple-posts:v7:cv  *simple-posts:v7:cv
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(may:c v-post:c)]
  ^-  [id-post:c (unit simple-post:v7:cv)]
  [id-post ?:(?=(%| -.v-post) ~ `(suv-post-1 +.v-post))]
::
::
++  uv-post
  |=  =v-post:c
  ~>  %spin.['libcu-uv-post']
  ^-  post:v1:cv
  :_  [rev.v-post (v7:essay:v9:ccv +>.v-post)]
  :*  id.v-post
      (v7:reacts:v9:ccv (uv-reacts reacts.v-post))
      (uv-replies id.v-post replies.v-post)
      (v7:reply-meta:v9:ccv (get-reply-meta v-post))
  ==
::
++  uv-post-1
  |=  =v-post:c
  ~>  %spin.['libcu-uv-post-1']
  ^-  post:v7:cv
  :_  [rev.v-post (v7:essay:v9:ccv +>.v-post)]
  :*  id.v-post
      (v7:reacts:v9:ccv (uv-reacts reacts.v-post))
      (uv-replies-1 id.v-post replies.v-post)
      (v7:reply-meta:v9:ccv (get-reply-meta v-post))
  ==
::
++  uv-post-2
  |=  =v-post:c
  ~>  %spin.['libcu-uv-post-2']
  ^-  post:v8:cv
  =/  =replies:v8:cv
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
  ~>  %spin.['libcu-uv-post-3']
  ^-  post:v9:cv
  =/  =replies:v9:cv
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
  ~>  %spin.['libcu-s-post-1']
  ^-  simple-post:v7:cv
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
  ~>  %spin.['libcu-s-post-2']
  ^-  simple-post:v8:cv
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
  ~>  %spin.['libcu-s-post-3']
  ^-  simple-post:c
  :_  +>.post
  %=  -.post
    reacts   (v7:reacts:v9:ccv reacts.post)
    replies  (s-replies-2 replies.post)
  ==
++  suv-post
  |=  =v-post:c
  ~>  %spin.['libcu-suv-post']
  ^-  simple-post:v1:cv
  (s-post-1 (uv-post-3 v-post))
::
::
++  suv-post-1
  |=  =v-post:c
  ~>  %spin.['libcu-suv-post-1']
  ^-  simple-post:v7:cv
  (s-post-1 (uv-post-3 v-post))
::
++  uv-posts-without-replies
  |=  =v-posts:c
  ~>  %spin.['libcu-uv-posts-without-replies']
  ^-  posts:v1:cv
  %+  gas:on-posts:v1:cv  *posts:v1:cv
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(may:c v-post:c)]
  ^-  [id-post:c (unit post:v1:cv)]
  [id-post (bind (mu-v-post v-post) uv-post-without-replies)]
::
++  uv-posts-without-replies-1
  |=  =v-posts:c
  ~>  %spin.['libcu-uv-posts-without-replies-1']
  ^-  posts:v7:cv
  %+  gas:on-posts:v7:cv  *posts:v7:cv
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(may:c v-post:c)]
  ^-  [id-post:c (unit post:v7:cv)]
  [id-post (bind (mu-v-post v-post) uv-post-without-replies-1)]
::
++  uv-posts-without-replies-2
  |=  =v-posts:c
  ~>  %spin.['libcu-uv-posts-without-replies-2']
  ^-  posts:v8:cv
  %+  gas:on-posts:v8:cv  *posts:v8:cv
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(may:c v-post:c)]
  ^-  [id-post:c (unit post:v8:cv)]
  [id-post (bind (mu-v-post v-post) uv-post-without-replies-2)]
::
++  uv-posts-without-replies-3
  |=  =v-posts:c
  ~>  %spin.['libcu-uv-posts-without-replies-3']
  ^-  posts:v9:cv
  %+  gas:on-posts:v9:cv  *posts:v9:cv
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(may:c v-post:c)]
  ^-  [id-post:c (may:v9:cv post:v9:cv)]
  :-  id-post
  ?:  ?=(%| -.v-post)  v-post
  &+(uv-post-without-replies-3 +.v-post)
::
++  suv-posts-without-replies
  |=  =v-posts:c
  ~>  %spin.['libcu-suv-posts-without-replies']
  ^-  simple-posts:v1:cv
  %+  gas:on-simple-posts:v1:cv  *simple-posts:v1:cv
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(may:c v-post:c)]
  ^-  [id-post:c (unit simple-post:v1:cv)]
  [id-post (bind (mu-v-post v-post) suv-post-without-replies)]
::
++  suv-posts-without-replies-1
  |=  =v-posts:c
  ~>  %spin.['libcu-suv-posts-without-replies-1']
  ^-  simple-posts:v7:cv
  %+  gas:on-simple-posts:v7:cv  *simple-posts:v7:cv
  %+  turn  (tap:on-v-posts:c v-posts)
  |=  [=id-post:c v-post=(may:c v-post:c)]
  ^-  [id-post:c (unit simple-post:v7:cv)]
  [id-post (bind (mu-v-post v-post) suv-post-without-replies-1)]
::
++  uv-post-without-replies
  |=  post=v-post:c
  ~>  %spin.['libcu-uv-post-without-replies']
  ^-  post:v1:cv
  :_  [rev.post (v7:essay:v9:ccv +>.post)]
  :*  id.post
      (v7:reacts:v9:ccv (uv-reacts reacts.post))
      *replies:v1:cv
      (v7:reply-meta:v9:ccv (get-reply-meta post))
  ==
::
++  uv-post-without-replies-1
  |=  post=v-post:c
  ~>  %spin.['libcu-uv-post-without-replies-1']
  ^-  post:v7:cv
  :_  [rev.post (v7:essay:v9:ccv +>.post)]
  :*  id.post
      (v7:reacts:v9:ccv (uv-reacts reacts.post))
      *replies:v7:cv
      (v7:reply-meta:v9:ccv (get-reply-meta post))
  ==
::
++  uv-post-without-replies-2
  |=  post=v-post:c
  ~>  %spin.['libcu-uv-post-without-replies-2']
  ^-  post:v8:cv
  :_  +.post
  :*  id.post
      seq.post
      mod-at.post
      (uv-reacts reacts.post)
      *replies:v8:cv
      (get-reply-meta post)
  ==
::
++  uv-post-without-replies-3
  |=  post=v-post:c
  ~>  %spin.['libcu-uv-post-without-replies-3']
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
  ~>  %spin.['libcu-suv-post-without-replies']
  ^-  simple-post:v1:cv
  (s-post-1 (uv-post-without-replies-3 post))
::
++  suv-post-without-replies-1
  |=  post=v-post:c
  ~>  %spin.['libcu-suv-post-without-replies-1']
  ^-  simple-post:v7:cv
  (s-post-1 (uv-post-without-replies-3 post))
::
++  suv-post-without-replies-2
  |=  post=v-post:c
  ~>  %spin.['libcu-suv-post-without-replies-2']
  ^-  simple-post:v8:cv
  (s-post-2 (uv-post-without-replies-3 post))
::
++  suv-post-without-replies-3
  |=  post=v-post:c
  ~>  %spin.['libcu-suv-post-without-replies-3']
  ^-  simple-post:c
  (s-post-3 (uv-post-without-replies-3 post))
::
++  uv-replies
  |=  [parent-id=id-post:c =v-replies:c]
  ~>  %spin.['libcu-uv-replies']
  ^-  replies:v1:cv
  %+  gas:on-replies:v1:cv  *replies:v1:cv
  %+  murn  (tap:on-v-replies:c v-replies)
  |=  [=time v-reply=(may:c v-reply:c)]
  ^-  (unit [id-reply:c reply:v1:cv])
  ?:  ?=(%| -.v-reply)  ~
  `[time (uv-reply-1 parent-id +.v-reply)]
::
++  uv-replies-1
  |=  [parent-id=id-post:c =v-replies:c]
  ~>  %spin.['libcu-uv-replies-1']
  ^-  replies:v7:cv
  %+  gas:on-replies:v7:cv  *replies:v7:cv
  %+  turn  (tap:on-v-replies:c v-replies)
  |=  [=time v-reply=(may:c v-reply:c)]
  ^-  [id-reply:c (unit reply:v7:cv)]
  ?:  ?=(%| -.v-reply)  [time ~]
  [time `(uv-reply-1 parent-id +.v-reply)]
::
++  uv-replies-2
  |=  [parent-id=id-post:c =v-replies:c]
  ~>  %spin.['libcu-uv-replies-2']
  ^-  replies:v8:cv
  %+  gas:on-replies:v8:cv  *replies:v8:cv
  %+  turn  (tap:on-v-replies:c v-replies)
  |=  [=time v-reply=(may:c v-reply:c)]
  ^-  [id-reply:c (unit reply:v8:cv)]
  ?:  ?=(%| -.v-reply)  [time ~]
  [time `(uv-reply-2 parent-id +.v-reply)]
::
++  uv-replies-3
  |=  [parent-id=id-post:c =v-replies:c]
  ~>  %spin.['libcu-uv-replies-3']
  ^-  replies:c
  %+  gas:on-replies:c  *replies:c
  %+  turn  (tap:on-v-replies:c v-replies)
  |=  [=time v-reply=(may:c v-reply:c)]
  ^-  [id-reply:c (may:c reply:c)]
  ?:  ?=(%| -.v-reply)  [time v-reply]
  [time [-.v-reply (uv-reply-2 parent-id +.v-reply)]]
++  s-replies-1
  |=  =replies:c
  ~>  %spin.['libcu-s-replies-1']
  ^-  simple-replies:v7:cv
  %+  gas:on-simple-replies:v7:cv  *simple-replies:v7:cv
  %+  murn  (tap:on-replies:c replies)
  |=  [=time reply=(may:c reply:c)]
  ^-  (unit [id-reply:c simple-reply:v7:cv])
  ?:  ?=(%| -.reply)  ~
  (some [time (s-reply-1 +.reply)])
::
++  s-replies-2
  |=  =replies:c
  ~>  %spin.['libcu-s-replies-2']
  ^-  simple-replies:c
  %+  gas:on-simple-replies:c  *simple-replies:c
  %+  murn  (tap:on-replies:c replies)
  |=  [=time reply=(may:c reply:c)]
  ^-  (unit [id-reply:c simple-reply:v8:cv])
  ?:  ?=(%| -.reply)  ~
  (some [time (s-reply-2 +.reply)])
::
++  suv-replies-1
  |=  [parent-id=id-post:c =v-replies:c]
  ~>  %spin.['libcu-suv-replies-1']
  ^-  simple-replies:v7:cv
  (s-replies-1 (uv-replies-3 parent-id v-replies))
::
++  uv-reply-2
  |=  [parent-id=id-reply:c =v-reply:c]
  ~>  %spin.['libcu-uv-reply-2']
  ^-  reply:c
  :_  +.v-reply
  [id.v-reply parent-id (v7:reacts:v9:ccv (uv-reacts reacts.v-reply))]
::
++  uv-reply-1
  |=  [parent-id=id-reply:c =v-reply:c]
  ~>  %spin.['libcu-uv-reply-1']
  ^-  reply:v7:cv
  :_  [rev.v-reply (v7:memo:v9:ccv +>.v-reply)]
  [id.v-reply parent-id (v7:reacts:v9:ccv (uv-reacts reacts.v-reply))]
::
++  s-reply-1
  |=  =reply:c
  ~>  %spin.['libcu-s-reply-1']
  ^-  simple-reply:v7:cv
  (simple-reply-1 -.reply +>.reply)
::
++  s-reply-2
  |=  =reply:c
  ~>  %spin.['libcu-s-reply-2']
  ^-  simple-reply:c
  [-.reply +>.reply]
::
++  suv-reply-1
  |=  [parent-id=id-reply:c =v-reply:c]
  ~>  %spin.['libcu-suv-reply-1']
  ^-  simple-reply:v7:cv
  (s-reply-1 (uv-reply-1 parent-id v-reply))
::
++  suv-reply-2
  |=  [parent-id=id-reply:c =v-reply:c]
  ~>  %spin.['libcu-suv-reply-2']
  ^-  simple-reply:c
  (s-reply-2 (uv-reply-2 parent-id v-reply))
::
++  uv-reacts
  |=  =v-reacts:c
  ~>  %spin.['libcu-uv-reacts']
  ^-  reacts:c
  %-  ~(gas by *reacts:c)
  %+  murn  ~(tap by v-reacts)
  |=  [=author:c (rev:c react=(unit react:c))]
  ?~  react  ~
  (some author u.react)
::
++  simple-post-1
  |=  post=simple-post:c
  ~>  %spin.['libcu-simple-post-1']
  ^-  simple-post:v7:cv
  :_  (v7:essay:v9:ccv +.post)
  ^-  simple-seal:v7:cv
  =,  -.post
  :*  id
      (v7:reacts:v9:ccv reacts.post)
      (simple-replies-1 replies.post)
      (v7:reply-meta:v9:ccv reply-meta.post)
  ==
::
++  simple-reply-1
  |=  =simple-reply:c
  ~>  %spin.['libcu-simple-reply-1']
  ^-  simple-reply:v7:cv
  %=  simple-reply
    +  (v7:memo:v9:ccv +.simple-reply)
    reacts  (v7:reacts:v9:ccv reacts.simple-reply)
  ==
::
++  simple-replies-1
  |=  replies=simple-replies:c
  ~>  %spin.['libcu-simple-replies-1']
  ^-  simple-replies:v7:cv
  %+  run:on-simple-replies:c  replies
  simple-reply-1
::
++  reference-1
  |=  ref=reference:c
  ~>  %spin.['libcu-reference-1']
  ^-  reference:v7:cv
  ?-  -.ref
      %post
    =-  ref(post -)
    ?:  ?=(%& -.post.ref)
      (simple-post-1 +.post.ref)
    %*  .  *simple-post:v7:cv
      content  `story:v7:cv`[%inline ['[deleted message]']~]~
      author  ~nul
    ==
  ::
      %reply
    =-  ref(reply -)
    ?:  ?=(%& -.reply.ref)
      (simple-reply-1 +.reply.ref)
    %*  .  *simple-reply:v7:cv
      content  `story:v7:cv`[%inline ['[deleted reply]']~]~
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
  ~>  %spin.['libcu-said-1']
  ^-  cage
  =/  post=(unit (may:c v-post:c))  (get:on-v-posts:c posts p.plan)
  ?~  q.plan
    =/  post=simple-post:v7:cv
      ?~  post
        ::TODO  give "outline" that formally declares deletion
        :-  *simple-seal:v7:cv
        ?-  kind.nest
          %diary  [*memo:v7:cv %diary 'Unknown post' '']
          %heap   [*memo:v7:cv %heap ~ 'Unknown link']
          %chat   [[[%inline 'Unknown message' ~]~ ~nul *@da] %chat ~]
        ==
      ?:  ?=(%| -.u.post)
        :-  *simple-seal:v7:cv
        ?-  kind.nest
            %diary  [*memo:v7:cv %diary 'This post was deleted' '']
            %heap   [*memo:v7:cv %heap ~ 'This link was deleted']
            %chat
          [[[%inline 'This message was deleted' ~]~ ~nul *@da] %chat ~]
        ==
      (suv-post-without-replies-1 +.u.post)
    [%channel-said !>(`said:v7:cv`[nest %post post])]
  ::
  =/  reply=[reply-seal:v7:cv memo:v7:cv]
    ?~  post
      [*reply-seal:v7:cv ~[%inline 'Comment on unknown post']~ ~nul *@da]
    ?:  ?=(%| -.u.post)
      [*reply-seal:v7:cv ~[%inline 'Comment on deleted post']~ ~nul *@da]
    =/  reply=(unit (may:c v-reply:c))  (get:on-v-replies:c replies.+.u.post u.q.plan)
    ?~  reply
      [*reply-seal:v7:cv ~[%inline 'Unknown comment']~ ~nul *@da]
    ?:  ?=(%| -.u.reply)
      [*reply-seal:v7:cv ~[%inline 'This comment was deleted']~ ~nul *@da]
    (suv-reply-1 p.plan +.u.reply)
  [%channel-said !>(`said:v7:cv`[nest %reply p.plan reply])]
::
++  said-2
  |=  [=nest:c =plan:c posts=v-posts:c]
  ~>  %spin.['libcu-said-2']
  ^-  cage
  =/  post=(unit (may:c v-post:c))  (get:on-v-posts:c posts p.plan)
  ?~  q.plan
    =/  post=simple-post:v8:cv
      ?~  post
        :-  *simple-seal:v8:cv
        ?-  kind.nest
          %diary  [*memo:c /diary/unknown ~ ~]
          %heap   [*memo:c /heap/unknown ~ ~]
          %chat   [*memo:c /chat/unknown ~ ~]
        ==
      ?:  ?=(%| -.u.post)
        :-  *simple-seal:v8:cv
        ?-  kind.nest
            %diary  [*memo:c /diary/deleted ~ ~]
            %heap   [*memo:c /heap/deleted ~ ~]
            %chat   [*memo:c /chat/deleted ~ ~]
        ==
      (suv-post-without-replies-2 +.u.post)
    [%channel-said-1 !>(`said:v8:cv`[nest %post post])]
  =/  reply=[reply-seal:v8:cv memo:v8:cv]
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
  [%channel-said-1 !>(`said:v8:cv`[nest %reply p.plan reply])]
::
++  said-3
  |=  [=nest:c =plan:c posts=v-posts:c]
  ~>  %spin.['libcu-said-3']
  ^-  cage
  =/  post=(unit (may:c v-post:c))  (get:on-v-posts:c posts p.plan)
  ?~  q.plan
    =/  post=(may:v9:cv simple-post:v9:cv)
      ?~  post
        :-  %&  ::TODO  should eventually just unitize $reference
        :-  *simple-seal:v9:cv
        ?-  kind.nest
          %diary  [*memo:c /diary/unknown ~ ~]
          %heap   [*memo:c /heap/unknown ~ ~]
          %chat   [*memo:c /chat/unknown ~ ~]
        ==
      ?:  ?=(%| -.u.post)  u.post
      &+(suv-post-without-replies-3 +.u.post)
    [%channel-said-2 !>(`said:v9:cv`[nest %post post])]
  =/  reply=(may:v9:cv simple-reply:v9:cv)
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
  [%channel-said-2 !>(`said:v9:cv`[nest %reply p.plan reply])]
++  may-bind
  |*  f=$-(* *)
  |*  v=(may:c *)
  ?:  ?=(%| -.v)  ~
  `(f +.v)
++  mu-v-post
  |=  v-post=(may:c v-post:c)
  ~>  %spin.['libcu-mu-v-post']
  ^-  (unit v-post:c)
  ((may-bind same) v-post)
++  mu-v-reply
  |=  v-reply=(may:c v-reply:c)
  ~>  %spin.['libcu-mu-v-reply']
  ^-  (unit v-reply:c)
  ((bake (may-bind same) (may:c v-reply:c)) v-reply)
++  was-mentioned
  |=  [=story:s who=ship seat=(unit seat:v7:gv)]
  ~>  %spin.['libcu-was-mentioned']
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
    |=  chan=v-channel:v9:cv
    ~>  %spin.['libcu-channel']
    ^+  chan
    %_  chan
        posts
      %+  run:on-v-posts:v9:cv
        posts.chan
      |=  post=(may:c v-post:v9:cv)
      ?.  ?=(%& -.post)  post
      post(+>+ (essay +>+.post))
    ::
        log
      %+  run:log-on:v9:cv
        log.chan
      |=  upd=u-channel:v9:cv
      ?.  ?=([%post * ?([%set %& *] [%essay *])] upd)  upd
      ?-  -.u-post.upd
        %set    upd(+>+.post.u-post (essay +>+.post.u-post.upd))
        %essay  upd(essay.u-post (essay essay.u-post.upd))
      ==
    ==
  ++  said
    |=  =said:c
    ~>  %spin.['libcu-said']
    ?+  q.said  said
      [%post %& *]     said(+>.post.q (essay +>.post.q.said))
      [%reply @ %& *]  said(content.reply.q (story content.reply.q.said))
    ==
  ++  essay
    |=  =essay:c
    ~>  %spin.['libcu-essay']
    %_  essay
      content  (story content.essay)
      meta     (bind meta.essay meta)
    ==
  ++  meta
    |=  =data:m
    ~>  %spin.['libcu-meta']
    %_  data
      image  ?:((is-good-link image.data) image.data '')
      cover  ?:((is-good-link cover.data) cover.data '')
    ==
  ++  story
    |=  content=story:c
    ~>  %spin.['libcu-story']
    ^+  content
    (turn content verse)
  ++  verse
    |=  =verse:s
    ~>  %spin.['libcu-verse']
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
    ~>  %spin.['libcu-is-good-link']
    ?|  =('' cord)
        =('http' (end 3^4 cord))
        =('#' (end 3 cord))
        =('/' (end 3 cord))
    ==
  --
::
++  flatten
  |=  content=(list verse:s)
  ~>  %spin.['libcu-flatten']
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
  ~>  %spin.['libcu-get-reply-meta']
  ^-  reply-meta:c
  :*  (get-non-null-reply-count replies.post)
      (get-last-repliers post ~)
      (biff (ram:on-v-replies:c replies.post) |=([=time *] `time))
  ==
::
++  get-non-null-reply-count
  |=  replies=v-replies:c
  ~>  %spin.['libcu-get-non-null-reply-count']
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
  ~>  %spin.['libcu-get-last-repliers']
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
  ^-  (unit [_nest time (may:c post:v9:cv)])
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
    ~>  %spin.['libcu-is-admin']
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
    ~>  %spin.['libcu-can-read']
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
    ~>  %spin.['libcu-can-write']
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
    ~>  %spin.['libcu-ref-to-pointer']
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
    ~>  %spin.['libcu-grab-post']
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
    ~>  %spin.['libcu-from-post']
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
  ~>  %spin.['libcu-flatten-inline']
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
  ~>  %spin.['libcu-first-inline']
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
    ~>  %spin.['libcu-story']
    ^-  marl
    (zing (turn content verse))
  ::
  ++  verse
    |=  =verse:s
    ~>  %spin.['libcu-verse']
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
    ~>  %spin.['libcu-block']
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
    ~>  %spin.['libcu-inline']
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
  |=  [n=nest:v9:cv v=v-channel:v9:cv]
  ~>  %spin.['libcu-repair-channel']
  ^+  v
  ::  renumber posts based on the order in which they show up,
  ::  dropping bad tombstones along the way
  ::
  ::TODO  could do +drop-bad-tombstones separately here
  ::      if we no longer need .dead
  =^  [count=@ud seqs=(map id-post:v9:cv @ud) dead=(set id-post:v9:cv)]  posts.v
    (renumber-posts posts.v)
  =.  count.v  count
  =.  log.v  (renumber-log n log.v seqs dead)
  v
++  renumber-posts
  |=  posts=v-posts:v9:cv
  ~>  %spin.['libcu-renumber-posts']
  =/  state  ,[count=@ud seqs=(map id-post:v9:cv @ud) dead=(set id-post:v9:cv)]
  ^-  [state _posts]
  %-  (dip:on-v-posts:v9:cv state)
  :+  posts  *state
  |=  [state =id-post:v9:cv post=(may:v9:cv v-post:v9:cv)]
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
  |=  posts=v-posts:v9:cv
  ~>  %spin.['libcu-drop-bad-tombstones']
  ^+  posts
  =<  +
  %-  (dip:on-v-posts:v9:cv ,~)
  :+  posts  ~
  |=  [~ =id-post:v9:cv post=(may:v9:cv v-post:v9:cv)]
  ^-  [(unit _post) stop=? ~]
  :_  [| ~]
  ?.  ?=(%| -.post)  `post
  ?:  &(=(*@ud seq.post) =(*@p author.post))
    ~
  `post
++  renumber-log
  |=  [n=nest:v9:cv =log:v9:cv seqs=(map id-post:v9:cv @ud) dead=(set id-post:v9:cv)]
  ~>  %spin.['libcu-renumber-log']
  ^+  log
  ::  do a "repair" pass over the log: walk it and re-apply sequence nrs,
  ::  ensuring that the log contains consistent sequence nrs for every post id.
  ::
  =<  +
  %-  (dip:log-on:v9:cv ,~)
  :+  log  ~
  |=  [~ =time update=u-channel:v9:cv]
  ^-  [(unit u-channel:v9:cv) stop=? ~]
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
  ~>  %spin.['libcu-get-author-ship']
  ^-  ship
  ?@  author  author
  ship.author
::
++  get-person-ship
  |=  =author:c
  ~>  %spin.['libcu-get-person-ship']
  ^-  (unit ship)
  ?^  author  ~
  (some author)
::
++  subject  ^~(!>(..compile))
::
++  compile
  |=  src=@t
  ~>  %spin.['libcu-compile']
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
  ~>  %spin.['libcu-run-hook']
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
