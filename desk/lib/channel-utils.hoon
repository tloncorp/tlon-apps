/-  c=channels, gv=groups-ver, ci=cite, s=story, m=meta, h=hooks
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
  :_  [rev.v-post (essay-1 +>.v-post)]
  :*  id.v-post
      (reacts-1 (uv-reacts-1 reacts.v-post))
      (uv-replies id.v-post replies.v-post)
      (reply-meta-1 (get-reply-meta v-post))
  ==
::
++  uv-post-1
  |=  =v-post:c
  ^-  post:v7:old:c
  :_  (rev-essay-1 +.v-post)
  :*  id.v-post
      (reacts-1 (uv-reacts-1 reacts.v-post))
      (uv-replies-1 id.v-post replies.v-post)
      (reply-meta-1 (get-reply-meta v-post))
  ==
::
++  uv-post-2
  |=  =v-post:c
  ^-  post:c
  :_  +.v-post
  :*  id.v-post
      seq.v-post
      mod-at.v-post
      (uv-reacts-2 reacts.v-post)
      (uv-replies-2 id.v-post replies.v-post)
      (get-reply-meta v-post)
  ==
::
++  s-post-1
  |=  =post:c
  ^-  simple-post:v7:old:c
  :_  (essay-1 +>.post)
  =/  seal
    %=  -.post
      reacts      (reacts-1 reacts.post)
      replies     (s-replies-1 replies.post)
      reply-meta  (reply-meta-1 reply-meta.post)
    ==
  ::  remove .seq and .mod-at
  [- |3]:seal
::
++  s-post-2
  |=  =post:c
  ^-  simple-post:c
  :_  +>.post
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
  :_  [rev.post (essay-1 +>.post)]
  :*  id.post
      (uv-reacts-1 reacts.post)
      *replies:v1:old:c
      (reply-meta-1 (get-reply-meta post))
  ==
::
++  uv-post-without-replies-1
  |=  post=v-post:c
  ^-  post:v7:old:c
  :_  [rev.post (essay-1 +>.post)]
  :*  id.post
      (uv-reacts-1 reacts.post)
      *replies:v7:old:c
      (reply-meta-1 (get-reply-meta post))
  ==
::
++  uv-post-without-replies-2
  |=  post=v-post:c
  ^-  post:c
  :_  +.post
  :*  id.post
      seq.post
      mod-at.post
      (uv-reacts-2 reacts.post)
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
  :_  [rev.v-reply (memo-1 +>.v-reply)]
  [id.v-reply parent-id (uv-reacts-1 reacts.v-reply)]
::
++  s-reply-1
  |=  =reply:c
  ^-  simple-reply:v7:old:c
  (simple-reply-1 -.reply +>.reply)
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
  |=  [=author:c (rev:c react=(unit react:c))]
  ?~  react  ~
  (some author u.react)
::
++  uv-reacts-1
  |=  =v-reacts:c
  ^-  reacts:v7:old:c
  %-  ~(gas by *reacts:v7:old:c)
  %+  murn  ~(tap by v-reacts)
  |=  [=author:c (rev:c react=(unit react:c))]
  ?~  react  ~
  ?~  react-1=(react-1 u.react)  ~
  (some (get-author-ship author) u.react-1)
::
::
++  react-1
  |=  =react:c
  ^-  (unit react:v7:old:c)
  ?@  react
    (rave:em react)
  ?-  -.react
    %any  (some p.react)
  ==
::
++  reacts-1
  |=  =reacts:c
  ^-  reacts:v7:old:c
  %-  ~(rep by reacts)
  |=  [[=author:c =react:c] =reacts:v7:old:c]
  ?~  react=(react-1 react)
    reacts
  (~(put by reacts) (get-author-ship author) u.react)
::
++  replies-1
  |=  =replies:c
  ^-  replies:v7:old:c
  %+  run:on-replies:c  replies
  |=  reply=(unit reply:c)
  ^-  (unit reply:v7:old:c)
  ?~  reply  ~
  (some (reply-1 u.reply))
::
++  seal-1
  |=  =seal:c
  ^-  seal:v7:old:c
  %*  .  *seal:v7:old:c
    id       id.seal
    reacts   (reacts-1 reacts.seal)
    replies  (replies-1 replies.seal)
    reply-meta  (reply-meta-1 reply-meta.seal)
  ==
::
++  author-1
  |=  =author:c
  ^-  ship
  ?@  author  author
  ship.author
::
++  memo-1
  |=  =memo:c
  ^-  memo:v7:old:c
  %=  memo
    author   (author-1 author.memo)
    content  (turn content.memo verse-1)
  ==
::
++  verse-1
  |=  =verse:s
  ^-  verse:v7:old:c
  ?+  verse  verse
      [%inline *]
    [%inline (turn p.verse inline-1)]
  ::
      [%block %header *]
    verse(q.p (turn q.p.verse inline-1))
  ::
      [%block %listing *]
    verse(p.p (listing-1 p.p.verse))
  ::
      [%block %link *]
    [%inline [%link [. .]:url.p.verse] ~]  ::REVIEW
  ==
::
++  listing-1
  |=  =listing:s
  ^-  listing:v7:old:c
  ?-  -.listing
    %list  listing(q (turn q.listing listing-1), r (turn r.listing inline-1))
    %item  listing(p (turn p.listing inline-1))
  ==
::
++  inline-1
  |=  =inline:s
  ^-  inline:v7:old:c
  ?@  inline  inline
  ?+  -.inline  inline
      ?(%italics %bold %strike %blockquote)
    inline(p (turn p.inline inline-1))
  ::
      %task
    inline(q (turn q.inline inline-1))
  ::
      %sect
    (cat 3 '@' ?~(p.inline 'all' p.inline))
  ==
::
++  essay-1
  |=  =essay:c
  ^-  essay:v7:old:c
  :-  (memo-1 -.essay)
  ^-  kind-data:v7:old:c
  ?+    kind.essay  [%chat ~]
    [%chat $@(~ [%notice ~])]  kind.essay
    [%chat *]                  [%chat ~]
  ::
      [%diary *]
    ?~  meta.essay  [%diary '' '']
    [%diary title image]:u.meta.essay
  ::
      [%heap *]
    ?~  meta.essay  [%heap ~]
    [%heap `title.u.meta.essay]
  ==
::
++  rev-essay-1
  |=  essay=(rev:c essay:c)
  ^-  (rev:c essay:v7:old:c)
  [rev.essay (essay-1 +.essay)]
::
++  post-1
  |=  =post:c
  ^-  post:v7:old:c
  :-  (seal-1 -.post)
  [rev.post (essay-1 +>.post)]
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
++  reply-seal-1
  |=  =reply-seal:c
  ^-  reply-seal:v7:old:c
  reply-seal(reacts (reacts-1 reacts.reply-seal))
::
++  reply-1
  |=  =reply:c
  ^-  reply:v7:old:c
  %=  reply
    -  (reply-seal-1 -.reply)         :: reply seal
    +  [rev.reply (memo-1 +>.reply)]  ::  memo
  ==
++  reply-meta-1
  |=  =reply-meta:c
  ^-  reply-meta:v7:old:c
  %=  reply-meta  last-repliers
    (~(run in last-repliers.reply-meta) get-author-ship)
  ==
++  r-channels-1
  |=  =r-channels:c
  ^-  r-channels:v7:old:c
  =+  r-channel=r-channel.r-channels
  ?<  ?=(%meta -.r-channel)
  :-  nest.r-channels
  ^-  r-channel:v7:old:c
  ?+    r-channel  r-channel
      [%posts *]
    :-  %posts
    (posts-1 posts.r-channel)
    ::
      [%post id-post:c %set *]
    ?~  post.r-post.r-channel
      r-channel
    r-channel(post.r-post `(post-1 u.post.r-post.r-channel))
    ::
      [%post id-post:c %reply id-reply:c ^ %reacts *]
    %=    r-channel
        ::
        reply-meta.r-post
      (reply-meta-1 reply-meta.r-post.r-channel)
      ::
        reacts.r-reply.r-post
      (reacts-1 reacts.r-reply.r-post.r-channel)
    ==
    ::
      [%post id-post:c %reply id-reply:c ^ %set *]
    :: ?~  reply.r-reply.r-post.r-channel
    ::   %=    r-channel
    ::       reply-meta.r-post
    ::     (reply-meta-1 reply-meta.r-post.r-channel)
    ::   ==
    %=    r-channel
        ::
        reply.r-reply.r-post
      (bind reply.r-reply.r-post.r-channel reply-1)
      ::
        reply-meta.r-post
      (reply-meta-1 reply-meta.r-post.r-channel)
    ==
    ::
      [%post id-post:c %reacts *]
    r-channel(reacts.r-post (reacts-1 reacts.r-post.r-channel))
    ::
      [%post id-post:c %essay *]
    r-channel(essay.r-post (essay-1 essay.r-post.r-channel))
    ::
      [%pending client-id:c %post *]
    %=    r-channel
        essay.r-pending
      (essay-1 essay.r-pending.r-channel)
    ==
    ::
      [%pending client-id:c %reply *]
    %=    r-channel
        ::
        reply-meta.r-pending
      (reply-meta-1 reply-meta.r-pending.r-channel)
      ::
        memo.r-pending
      (memo-1 memo.r-pending.r-channel)
    ==
  ==
::
++  simple-post-1
  |=  post=simple-post:c
  ^-  simple-post:v7:old:c
  %=  post
    ::  seal
    reply-meta  (reply-meta-1 reply-meta.post)
    reacts      (reacts-1 reacts.post)
    replies     (simple-replies-1 replies.post)
    ::  essay
    +  (essay-1 +.post)
  ==
::
++  simple-reply-1
  |=  =simple-reply:c
  ^-  simple-reply:v7:old:c
  %=  simple-reply
    +  (memo-1 +.simple-reply)
    reacts  (reacts-1 reacts.simple-reply)
  ==
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
  =-  said(q -)
  ?-  -.q.said
     %post  q.said(post (simple-post-1 post.q.said))
     %reply  q.said(reply (simple-reply-1 reply.q.said))
  ==
::
++  have-plan  ::NOTE  matches +said-*
  |=  [=nest:c =plan:c posts=v-posts:c]
  ^-  ?
  =/  post=(unit (unit v-post:c))
    (get:on-v-posts:c posts p.plan)
  ?&  ?=(^ post)    ::  known post, and
  ?|  ?=(~ q.plan)  ::  no reply requested, or
      ?=(~ u.post)  ::  no replies available, or
      ?=(^ (get:on-v-replies:c replies.u.u.post u.q.plan))  ::  depth found
  ==  ==
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
          %diary  [*memo:v7:old:c %diary 'Unknown post' '']
          %heap   [*memo:v7:old:c %heap ~ 'Unknown link']
          %chat   [[[%inline 'Unknown message' ~]~ ~nul *@da] %chat ~]
        ==
      ?~  u.post
        :-  *simple-seal:v7:old:c
        ?-  kind.nest
            %diary  [*memo:v7:old:c %diary 'This post was deleted' '']
            %heap   [*memo:v7:old:c %heap ~ 'This link was deleted']
            %chat
          [[[%inline 'This message was deleted' ~]~ ~nul *@da] %chat ~]
        ==
      (suv-post-without-replies-1 u.u.post)
    [%channel-said !>(`said:v7:old:c`[nest %post post])]
  ::
  =/  reply=[reply-seal:v7:old:c memo:v7:old:c]
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
        :-  *simple-seal:c
        ?-  kind.nest
          %diary  [*memo:c /diary/unknown ~ ~]
          %heap   [*memo:c /heap/unknown ~ ~]
          %chat   [*memo:c /chat/unknown ~ ~]
        ==
      ?~  u.post
        :-  *simple-seal:c
        ?-  kind.nest
            %diary  [*memo:c /diary/deleted ~ ~]
            %heap   [*memo:c /heap/deleted ~ ~]
            %chat   [*memo:c /chat/deleted ~ ~]
        ==
      (suv-post-without-replies-2 u.u.post)
    [%channel-said-1 !>(`said:c`[nest %post post])]
  =/  reply=[reply-seal:c memo:c]
    ::XX the missing/deleted handling here is not great,
    ::   and can't be fixed in the same manner as above.
    ::   it seems $reference should explicitly support
    ::   missing/deleted content
    ::
    ?~  post
      [*reply-seal:c ~[%inline 'Comment on unknown post']~ ~nul *@da]
    ?~  u.post
      [*reply-seal:c ~[%inline 'Comment on deleted post']~ ~nul *@da]
    =/  reply=(unit (unit v-reply:c))
      (get:on-v-replies:c replies.u.u.post u.q.plan)
    ?~  reply
      [*reply-seal:c ~[%inline 'Unknown comment']~ ~nul *@da]
    ?~  u.reply
      [*reply-seal:c ~[%inline 'This comment was deleted']~ ~nul *@da]
    (suv-reply-2 p.plan u.u.reply)
  [%channel-said-1 !>(`said:c`[nest %reply p.plan reply])]
::
++  scan-1
  |=  =scan:c
  ^-  scan:v7:old:c
  %+  turn  scan
  |=  ref=reference:c
  ?-  -.ref
      %post   ref(post (simple-post-1 post.ref))
      %reply  ref(reply (simple-reply-1 reply.ref))
  ==
::
++  scam-1
  |=  =scam:c
  ^-  scam:v7:old:c
  scam(scan (scan-1 scan.scam))
::
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
  |=  [post=v-post:c pending=(unit author:c)]  ::TODO  could just take =v-replies
  ^-  (set author:c)
  =/  replyers=(set author:c)  ?~(pending ~ (sy u.pending ~))
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
++  simple-reply-7-to-8
  |=  reply=simple-reply:v7:old:c
  ^-  simple-reply:c
  reply(+ (memo-7-to-8 +.reply))  :: memo
::
++  said-7-to-8
  |=  =said:v7:old:c
  ^-  said:c
  %=  said  q
    ?-    -.q.said
        %post
      ^-  [%post simple-post:c]
      =/  replies=simple-replies:c
        %+  run:on-simple-replies:v7:old:c
          replies.post.q.said
        simple-reply-7-to-8
      =/  =simple-seal:c
        -.post.q.said(replies replies)
      =/  =essay:c
        (essay-7-to-8 +.post.q.said)
      %=  q.said
        ::  seal
        -.post   simple-seal
        ::  essay
        +.post  essay
      ==
        %reply
      ^-  $>(%reply reference:c)
      q.said(reply (simple-reply-7-to-8 reply.q.said))
    ==
  ==
::
++  v-channels-7-to-8
  |=  vc=v-channels:v7:old:c
  ^-  v-channels:c
  %-  ~(run by vc)
  |=  v=v-channel:v7:old:c
  ^-  v-channel:c
  =/  [log=log:v-channel:c mod=(map id-post:c time)]
    (log-7-to-8 log.v)
  =/  [count=@ud =v-posts:c]
    (v-posts-7-to-8 posts.v mod)
  =-  %=  w  -  :: change global in w
        :*  posts.w
            count
            order.w
            view.w
            sort.w
            perm.w
            *(rev:c (unit @t))  ::  meta
        ==
      ==
  ^=  w
  %=  v
    ::  global
    posts  v-posts
    ::  local
    log      log
    future   (future-8 log)
    pending  (pending-7-to-8)
  ==
++  pending-7-to-8
  |=  pending=pending-messages:v7:old:c
  ^-  pending-messages:c
  %=  pending
    posts    (~(run by posts.pending) essay-7-to-8)
    replies  (~(run by replies.pending) memo-7-to-8)
  ==
++  memo-7-to-8
  |=  =memo:v7:old:c
  ^-  memo:c
  memo
++  essay-7-to-8
  |=  =essay:v7:old:c
  ^-  essay:c
  :-  (memo-7-to-8 -.essay)  ::  memo
  ?-    -.kind-data.essay
      %diary
    :-  /diary
    :_  ~  ::  blob
    %-  some
    %*  .  *data:m
      title  title.kind-data.essay
      image  image.kind-data.essay
    ==
    ::
      %heap
    :-  /heap
    :_  ~
    (some %*(. *data:m title (fall title.kind-data.essay '')))
    ::
      %chat
    ?~  kind.kind-data.essay
      [/chat ~ ~]
    ?>  ?=([%notice ~] kind.kind-data.essay)
    [/chat/notice ~ ~]
  ==
++  v-posts-7-to-8
  |=  [vp=v-posts:v7:old:c mod=(map id-post:c time)]
  ^-  [@ud v-posts:c]
  =|  posts=v-posts:c
  %+  roll  (tap:on-v-posts:v7:old:c vp)
  |=  [[=id-post:c post=(unit v-post:v7:old:c)] count=@ud =_posts]
  ^+  [count posts]
  ::  for each post traversed, even if it was deleted,
  ::  .count increases to generate a correct post sequence number
  ::
  =.  count  +(count)
  :-  count
  ?~  post
    ::NOTE  this used to just produce .posts as-is,
    ::      which meant deleted msg tombstones got dropped!
    ::      you will find logic to recover those in both channels agents.
    (put:on-v-posts:c posts id-post ~)
  ::  insert seq and mod-at into seal
  ::
  =;  new-post=v-post:c
    (put:on-v-posts:c posts id-post `new-post)
  =*  seal  -.u.post
  =*  essay  +.u.post
  =/  new-seal=v-seal:c
    =/  mod-at=@da
      %+  fall
        (~(get by mod) id-post)
      id.u.post
    =+  seal(|1 [count mod-at |1.seal])
    %=  -
      replies  (v-replies-7-to-8 replies.seal)
      reacts   (v-reacts-7-to-8 reacts.seal)
    ==
  ^-  v-post:c
  [new-seal [rev.essay (essay-7-to-8 +.essay)]]
::
++  v-replies-7-to-8
  |=  =v-replies:v7:old:c
  ^-  v-replies:c
  %+  run:on-v-replies:v7:old:c  v-replies
  |=  v-reply=(unit v-reply:v7:old:c)
  ^-  (unit v-reply:c)
  ?~  v-reply  ~
  %=  v-reply
    reacts.u  (v-reacts-7-to-8 reacts.u.v-reply)
  ==
::
++  v-reacts-7-to-8
  |=  =v-reacts:v7:old:c
  ^-  v-reacts:c
  %-  ~(run by v-reacts)
  |=  v-react=(rev:c (unit react:v7:old:c))
  ^-  (rev:c (unit react:c))
  ?~  +.v-react  [-.v-react ~]
  =+  rat=(kill:em u.v-react)
  v-react(u (fall rat any+u.v-react))
++  react-7-to-8
  |=  =react:v7:old:c
  ^-  react:c
  =+  rat=(kill:em react)
  (fall rat any+react)
::
::
++  u-post-set-7-to-8
  |=  [u=u-post:v7:old:c seq=@ud mod-at=@da]
  ^-  $>(%set u-post:c)
  ?>  ?=(%set -.u)
  ::  %post %set
  ::
  ?~  post.u  u
  =*  post  u.post.u
  :-  %set
  =/  new-seal=v-seal:c
    :*  id.post
        seq
        mod-at
        (v-replies-7-to-8 replies.post)
        (v-reacts-7-to-8 reacts.post)
    ==
  (some [new-seal [rev.+.post (essay-7-to-8 +>.post)]])
::
++  u-post-not-set-7-to-8
  |=  u=$<(%set u-post:v7:old:c)
  ^-  $<(%set u-post:c)
  ?:  ?=(%essay -.u)
    u(essay (essay-7-to-8 essay.u))
  ::
  ?:  ?=([%reply =id-reply:c %set *] u)
    ?~  reply.u-reply.u  u
    %=    u
        reacts.u.reply.u-reply
      %-  v-reacts-7-to-8
      reacts.u.reply.u-reply.u
    ==
  ?:  ?=([%reply =id-reply:c %reacts *] u)
    %=    u
        reacts.u-reply
      %-  v-reacts-7-to-8
      reacts.u-reply.u
    ==
  ::  %reacts
  ::
  u(reacts (v-reacts-7-to-8 reacts.u))
::
++  log-7-to-8
  |=  l=log:v-channel:v7:old:c
  ^-  [log:v-channel:c (map id-post:c @da)]
  =|  seq-log=(map id-post:c @ud)
  =|  =log:c
  =|  mod=(map id-post:c @da)
  =<  [log mod]
  %+  roll  (tap:log-on:v7:old:c l)
  |=  [[=time =u-channel:v7:old:c] [count=@ud =_seq-log] =_log =_mod]
  ^+  [[count seq-log] log mod]
  ?:  ?=(%create -.u-channel)
    :-  [count seq-log]
    :_  mod
    (put:log-on:c log time %create perm.u-channel ~)
  ?.  ?=(%post -.u-channel)
    :-  [count seq-log]
    :_  mod
    (put:log-on:c log time u-channel)
  ?.  ?=(%set -.u-post.u-channel)
    :-  [count seq-log]
    :_  (~(put by mod) id.u-channel time)
    (put:log-on:c log time %post id.u-channel (u-post-not-set-7-to-8 u-post.u-channel))
  ::  %set
  ::
  ?~  post.u-post.u-channel
    :-  [count seq-log]
    :_  (~(put by mod) id.u-channel time)
    (put:log-on:c log time %post id.u-channel %set ~)
  ::  %set post: increment .seq only for a new post
  ::
  =^  seq=@ud  count
    ?~  seq=(~(get by seq-log) id.u-channel)
      [. .]:+(count)
    [u.seq count]
  :-  :-  count
      (~(put by seq-log) id.u-channel count)
  :_  (~(put by mod) id.u-channel time)
  %^  put:log-on:c  log  time
  :+  %post  id.u-channel
  (u-post-set-7-to-8 u-post.u-channel seq id.u-channel)
::
++  future-8
  |=  log=log:c
  ^-  future:v-channel:c
  %*  .  *future:v-channel:c
      diffs
    %+  roll  (tap:log-on:c log)
    |=  [[time u=u-channel:c] diffs=(jug id-post:c u-post:c)]
    ?.  ?=(%post -.u)  diffs
    (~(put ju diffs) id.u u-post.u)
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
