/-  c=channels, g=groups, s=story
/-  meta
/+  gj=groups-json, sj=story-json, dj=cite-json
=*  z  ..zuse
|%
++  enjs
  =,  enjs:format
  |%
  +|  %responses
  ::
  ++  r-channels
    |=  [=nest:c =r-channel:c]
    %-  pairs
    :~  nest+(^nest nest)
        response+(^r-channel r-channel)
    ==
  ::
  ++  r-channel
    |=  =r-channel:c
    %+  frond  -.r-channel
    ?-  -.r-channel
      %posts    (posts posts.r-channel)
      %post     (pairs id+(id id.r-channel) r-post+(r-post r-post.r-channel) ~)
      %pending  (pending r-channel)
      %order    (order order.r-channel)
      %view     s+view.r-channel
      %sort     s+sort.r-channel
      %perm     (perm perm.r-channel)
      %meta     ?~(meta.r-channel ~ s+u.meta.r-channel)
    ::
      %create   (perm perm.r-channel)
      %join     (flag group.r-channel)
      %leave    ~
      %read     ~
      %read-at  s+(scot %ud time.r-channel)
      %watch    ~
      %unwatch  ~
    ==
  ::
  ++  r-channels-simple-post
    |=  [=nest:c =r-channel-simple-post:c]
    %-  pairs
    :~  nest+(^nest nest)
        response+(^r-channel-simple-post r-channel-simple-post)
    ==
  ::
  ++  r-channel-simple-post
    |=  r-channel=r-channel-simple-post:c
    %+  frond  -.r-channel
    ?-  -.r-channel
      %posts    (simple-posts posts.r-channel)
      %post     (pairs id+(id id.r-channel) r-post+(r-simple-post r-post.r-channel) ~)
      %pending  (pending r-channel)
      %order    (order order.r-channel)
      %view     s+view.r-channel
      %sort     s+sort.r-channel
      %perm     (perm perm.r-channel)
      %meta     ?~(meta.r-channel ~ s+u.meta.r-channel)
    ::
      %create   (perm perm.r-channel)
      %join     (flag group.r-channel)
      %leave    ~
      %read     ~
      %read-at  s+(scot %ud time.r-channel)
      %watch    ~
      %unwatch  ~
    ==
  ::
  ++  pending
    |=  =r-channel:c
    ?>  ?=([%pending *] r-channel)
    %-  pairs
    :~  id+(client-id id.r-channel)
        pending+(r-pending r-pending.r-channel)
    ==
  ::
  ++  r-pending
    |=  =r-pending:c
    %+  frond  -.r-pending
    ?-  -.r-pending
      %post  (essay essay.r-pending)
    ::
        %reply
      %-  pairs
      :~  top+(id top.r-pending)
          meta+(reply-meta reply-meta.r-pending)
          memo+(memo memo.r-pending)
      ==
    ==
  ::
  ++  r-post
    |=  =r-post:c
    %+  frond  -.r-post
    ?-  -.r-post
      %set    ?:(?=(%| -.post.r-post) (tombstone +.post.r-post) (post +.post.r-post))
      %reacts  (reacts reacts.r-post)
      %essay  (essay essay.r-post)
    ::
        %reply
      %-  pairs
      :~  id+(id id.r-post)
          r-reply+(r-reply r-reply.r-post)
          meta+(reply-meta reply-meta.r-post)
      ==
    ==
  ::
  ++  r-simple-post
    |=  r-post=r-simple-post:c
    %+  frond  -.r-post
    ?-  -.r-post
      %set    ?:(?=(%| -.post.r-post) (tombstone +.post.r-post) (simple-post +.post.r-post))
      %reacts  (reacts reacts.r-post)
      %essay  (essay essay.r-post)
    ::
        %reply
      %-  pairs
      :~  id+(id id.r-post)
          r-reply+(r-simple-reply r-reply.r-post)
          meta+(reply-meta reply-meta.r-post)
      ==
    ==
  ::
  ++  r-reply
    |=  =r-reply:c
    %+  frond  -.r-reply
    ?-  -.r-reply
      %set    ?:(?=(%| -.reply.r-reply) (tombstone +.reply.r-reply) (reply +.reply.r-reply))
      %reacts  (reacts reacts.r-reply)
    ==
  ::
  ++  r-simple-reply
    |=  r-reply=r-simple-reply:c
    %+  frond  -.r-reply
    ?-  -.r-reply
      %set    ?:(?=(%| -.reply.r-reply) (tombstone +.reply.r-reply) (simple-reply +.reply.r-reply))
      %reacts  (reacts reacts.r-reply)
    ==
  ::
  ++  channel-heads
    |=  heads=channel-heads:c
    :-  %a
    %+  turn  heads
    |=  [=nest:c recency=^time latest=(may:c post:c)]
    %-  pairs
    :~  nest+(^nest nest)
        recency+(time recency)
        latest+?-(-.latest %& (post +.latest), %| (tombstone +.latest))
    ==
  ::
  ++  paged-posts
    |=  pn=paged-posts:c
    %-  pairs
    :~  posts+(posts posts.pn)
        newer+?~(newer.pn ~ (id u.newer.pn))
        older+?~(older.pn ~ (id u.older.pn))
        newest+(numb newest.pn)
        total+(numb total.pn)
    ==
  ++  paged-simple-posts
    |=  pn=paged-simple-posts:c
    %-  pairs
    :~  posts+(simple-posts posts.pn)
        newer+?~(newer.pn ~ (id u.newer.pn))
        older+?~(older.pn ~ (id u.older.pn))
        newest+(numb newest.pn)
        total+(numb total.pn)
    ==
  +|  %rr
  ::
  ++  channels
    |=  channels=channels:c
    %-  pairs
    %+  turn  ~(tap by channels)
    |=  [n=nest:c ca=channel:c]
    [(nest-cord n) (channel ca)]
  ::
  ++  channel
    |=  channel=channel:c
    %-  pairs
    :~  posts+(posts posts.channel)
        count+(numb count.channel)
        order+(order order.channel)
        view+s+view.channel
        sort+s+sort.channel
        perms+(perm perm.channel)
        meta+?~(meta.channel ~ s+u.meta.channel)
    ==
  ::
  ++  posts
    |=  =posts:c
    %-  pairs
    %+  turn  (tap:on-posts:c posts)
    |=  [id=id-post:c post=(may:c post:c)]
    [(scot %ud id) (may ^post post)]
  ::
  ++  post
    |=  [=seal:c [rev=@ud =essay:c]]
    %-  pairs
    :~  seal+(^seal seal)
        revision+s+(scot %ud rev)
        essay+(^essay essay)
        type+s+%post
    ==
  ++  tombstone
    |=  t=tombstone:c
    %-  pairs
    :~  id+(id id.t)
        author+(author author.t)
        seq+(numb seq.t)
        deleted-at+(time del-at.t)
        type+s+%tombstone
    ==
  ++  simple-posts
    |=  posts=simple-posts:c
    %-  pairs
    %+  turn  (tap:on-simple-posts:c posts)
    |=  [id=id-post:c post=(may:c simple-post:c)]
    [(scot %ud id) (may simple-post post)]
  ::
  ++  simple-post
    |=  [seal=simple-seal:c =essay:c]
    %-  pairs
    :~  seal+(simple-seal seal)
        essay+(^essay essay)
        type+s+%post
    ==
  ::
  ++  replies
    |=  =replies:c
    %-  pairs
    %+  turn  (tap:on-replies:c replies)
    |=  [t=@da reply=(may:c reply:c)]
    [(scot %ud t) ?:(?=(%| -.reply) (tombstone +.reply) (^reply +.reply))]
  ::
  ++  simple-replies
    |=  replies=simple-replies:c
    %-  pairs
    %+  turn  (tap:on-simple-replies:c replies)
    |=  [t=@da reply=simple-reply:c]
    [(scot %ud t) (simple-reply reply)]
  ::
  ++  reply
    |=  [=reply-seal:c [rev=@ud =memo:c]]
    %-  pairs
    :~  seal+(^reply-seal reply-seal)
        revision+s+(scot %ud rev)
        memo+(^memo memo)
    ==
  ::
  ++  simple-reply
    |=  [=reply-seal:c =memo:c]
    %-  pairs
    :~  seal+(^reply-seal reply-seal)
        memo+(^memo memo)
    ==
  ::
  ++  seal
    |=  =seal:c
    %-  pairs
    :~  id+(id id.seal)
        seq+(numb seq.seal)
        mod-at+(mod-at mod-at.seal)
        reacts+(reacts reacts.seal)
        replies+(replies replies.seal)
        meta+(reply-meta reply-meta.seal)
    ==
  ::
  ++  simple-seal
    |=  seal=simple-seal:c
    %-  pairs
    :~  id+(id id.seal)
        reacts+(reacts reacts.seal)
        replies+(simple-replies replies.seal)
        meta+(reply-meta reply-meta.seal)
    ==
  ::
  ++  reply-seal
    |=  =reply-seal:c
    %-  pairs
    :~  id+(id id.reply-seal)
        parent-id+(id parent-id.reply-seal)
        reacts+(reacts reacts.reply-seal)
    ==
  ::
  ++  post-toggle
    |=  p=post-toggle:c
    %+  frond  -.p
    ?-  -.p
      %hide  (id id-post.p)
      %show  (id id-post.p)
    ==
  ::
  ++  hidden-posts
    |=  hp=hidden-posts:c
    a+(turn ~(tap in hp) id)
  ::
  ++  pending-msgs
    |=  pm=pending-messages:c
    %-  pairs
    :~  posts+(pending-posts posts.pm)
        replies+(pending-replies replies.pm)
    ==
  ::
  ++  pending-posts
    |=  pp=pending-posts:c
    %-  pairs
    %+  turn  ~(tap by pp)
    |=  [cid=client-id:c es=essay:c]
    [(client-id-string cid) (essay es)]
  ::
  ++  pending-replies
    |=  pr=pending-replies:c
    =/  replies
      %+  roll  ~(tap by pr)
      |=  [[[top=id-post:c cid=client-id:c] mem=memo:c] rs=(map id-post:c (map client-id:c memo:c))]
      ?.  (~(has by rs) top)  (~(put by rs) top (malt ~[[cid mem]]))
      %+  ~(jab by rs)  top
      |=  mems=(map client-id:c memo:c)
      (~(put by mems) cid mem)
    %-  pairs
    %+  turn  ~(tap by replies)
    |=  [top=id-post:c rs=(map client-id:c memo:c)]
    :-  (rsh 4 (scot %ui top))
    %-  pairs
    %+  turn  ~(tap by rs)
    |=  [cid=client-id:c mem=memo:c]
    [(client-id-string cid) (memo mem)]
  ::
  +|  %primitives
  ::
  ++  may
    |*  [f=$-(* json) m=(may:c *)]
    ?-  -.m
      %&  (f +.m)
      %|  (tombstone +.m)
    ==
  ::
  ++  v-channel
    |=  ca=v-channel:c
    %-  pairs
    :~  order+(order +.order.ca)
        perms+(perm +.perm.ca)
        view+s++.view.ca
        sort+s++.sort.ca
        pending+(pending-msgs pending.ca)
    ==
  ::
  ++  id
    |=  =@da
    s+`@t`(rsh 4 (scot %ui da))
  ::
  ++  mod-at
    |=  =@da
    s+`@t`(rsh 4 (scot %ui da))
  ::
  ++  client-id-string
    |=  cid=client-id:c
    %+  rap  3
    :~  (scot %p author.cid)
        '/'
        (scot %ud (unm:chrono:userlib sent.cid))
    ==
  ++  client-id
    |=  =client-id:c
    %-  pairs
    :~  author+(ship author.client-id)
        sent+(time sent.client-id)
    ==
  ::
  ++  flag
    |=  f=flag:g
    ^-  json
    s/(rap 3 (scot %p p.f) '/' q.f ~)
  ::
  ++  nest
    |=  n=nest:c
    ^-  json
    s/(nest-cord n)
  ::
  ++  nest-cord
    |=  n=nest:c
    ^-  cord
    (rap 3 kind.n '/' (scot %p ship.n) '/' name.n ~)
  ::
  ++  ship
    |=  her=@p
    n+(rap 3 '"' (scot %p her) '"' ~)
  ::
  ++  order
    |=  a=arranged-posts:c
    :-  %a
    =/  times=(list time:z)  ?~(a ~ u.a)
    (turn times id)
  ::
  ++  perm
    |=  p=perm:c
    %-  pairs
    :~  writers/a/(turn ~(tap in writers.p) (lead %s))
        group/(flag group.p)
    ==
  ::
  ++  react
    |=  =react:c
    ^-  json
    ?@  react
      s+react
    ?-  -.react
      %any  (frond %any s+p.react)
    ==
  ::
  ++  reacts
    |=  =reacts:c
    ^-  json
    %-  pairs
    %+  turn  ~(tap by reacts)
    |=  [=author:c =react:c]
    ?@  author
      [(scot %p author) (^react react)]
    ::  a bot is identified by the
    ::  'ship/nickname' string
    ::
    :-  (id-author author)
    %-  pairs
    :~  ship+(ship ship.author)
        nickname+?~(nickname.author ~ s/u.nickname.author)
        avatar+?~(avatar.author ~ s/u.avatar.author)
        react+(^react react)
    ==
  ++  id-author
    |=  =author:c
    ^-  @t
    ?@  author  (scot %p author)
    (rap 3 ~[(scot %p ship.author) '/' (fall nickname.author '')])
  ++  author
    |=  =author:c
    ^-  json
    ?@  author  (ship author)
    %-  pairs
    :~  ship+(ship ship.author)
        nickname+?~(nickname.author ~ s/u.nickname.author)
        avatar+?~(avatar.author ~ s/u.avatar.author)
    ==
  ::
  ++  meta
    |=  meta=(unit data:^meta)
    ^-  json
    ?~  meta  ~
    %-  pairs
    =,  u.meta
    :~  title+s/title
        description+s/description
        image+s/image
        cover+s/cover
    ==
  ++  essay
    |=  =essay:c
    %-  pairs
    :~  content+(story:enjs:sj content.essay)
        author+(author author.essay)
        sent+(time sent.essay)
        ::
        kind+(path kind.essay)
        meta+(meta meta.essay)
        blob+?~(blob.essay ~ s/u.blob.essay)
    ==
  ::
  ++  reply-meta
    |=  r=reply-meta:c
    %-  pairs
    :~  'replyCount'^(numb reply-count.r)
        'lastReply'^?~(last-reply.r ~ (time u.last-reply.r))
        'lastRepliers'^a/(turn ~(tap in last-repliers.r) author)
    ==
  ::
  ++  memo
    |=  m=memo:c
    ^-  json
    %-  pairs
    :~  content/(story:enjs:sj content.m)
        author/(author author.m)
        sent/(time sent.m)
    ==
  ::
  +|  %unreads
  ::
  ++  unreads
    |=  bs=unreads:c
    %-  pairs
    %+  turn  ~(tap by bs)
    |=  [n=nest:c b=unread:c]
    [(nest-cord n) (unread b)]
  ::
  ++  unread-update
    |=  u=(pair nest:c unread:c)
    %-  pairs
    :~  nest/(nest p.u)
        unread/(unread q.u)
    ==
  ::
  ++  unread
    |=  b=unread:c
    %-  pairs
    :~  recency/(time recency.b)
        count/(numb count.b)
        unread/?~(unread.b ~ (unread-point u.unread.b))
        threads/(unread-threads threads.b)
    ==
  ::
  ++  unread-threads
    |=  u=(map id-post:c [id-reply:c @ud])
    %-  pairs
    %+  turn  ~(tap by u)
    |=  [p=id-post:c u=[id-reply:c @ud]]
    [+:(id p) (unread-point u)]
  ::
  ++  unread-point
    |=  [t=@da count=@ud]
    %-  pairs
    :~  id/(id t)
        count/(numb count)
    ==
  ::
  ++  pins
    |=  ps=(list nest:c)
    %-  pairs
    :~  pins/a/(turn ps nest)
    ==
  ::
  +|  %said
  ::
  ++  reference
    |=  =reference:c
    %+  frond  -.reference
    ?-    -.reference
        %post  (may simple-post post.reference)
        %reply
      %-  pairs
      :~  id-post+(id id-post.reference)
          reply+(may simple-reply reply.reference)
      ==
    ==
  ::
  ++  said
    |=  s=said:c
    ^-  json
    %-  pairs
    :~  nest/(nest p.s)
        reference/(reference q.s)
    ==
  ::
  +|  %old
  ::
  ++  v9  .
  ++  v8
    |%
    ++  channels
      |=  channels=channels:v8:c
      %-  pairs
      %+  turn  ~(tap by channels)
      |=  [n=nest:c ca=channel:v8:c]
      [(nest-cord n) (channel ca)]
    ::
    ++  channel
      |=  channel=channel:v8:c
      %-  pairs
      :~  posts+(posts posts.channel)
          count+(numb count.channel)
          order+(order order.channel)
          view+s+view.channel
          sort+s+sort.channel
          perms+(perm perm.channel)
          meta+?~(meta.channel ~ s+u.meta.channel)
      ==
    ++  said
      |=  s=said:v8:c
      %-  pairs
      :~  nest+(nest p.s)
          reference+(reference q.s)
      ==
    ++  reference
      |=  =reference:v8:c
      %+  frond  -.reference
      ?-    -.reference
          %post  (simple-post post.reference)
      ::
          %reply
        %-  pairs
        :~  id-post+(id id-post.reference)
            reply+(simple-reply reply.reference)
        ==
      ==
    ++  posts
      |=  =posts:v8:c
      %-  pairs
      %+  turn  (tap:on-posts:v8:c posts)
      |=  [id=id-post:c post=(unit post:v8:c)]
      [(scot %ud id) ?~(post ~ (^post u.post))]
    ++  post
      |=  [=seal:v8:c [rev=@ud =essay:v8:c]]
      %-  pairs
      :~  seal+(^seal seal)
          revision+s+(scot %ud rev)
          essay+(^essay essay)
          type+s+%post
      ==
    ++  seal
      |=  =seal:v8:c
      %-  pairs
      :~  id+(id id.seal)
          seq+(numb seq.seal)
          mod-at+(mod-at mod-at.seal)
          reacts+(reacts reacts.seal)
          replies+(replies replies.seal)
          meta+(reply-meta reply-meta.seal)
      ==
    ++  replies
      |=  =replies:v8:c
      %-  pairs
      %+  turn  (tap:on-replies:v8:c replies)
      |=  [t=@da reply=(unit reply:c)]
      [(scot %ud t) ?~(reply ~ (^reply +.reply))]
    ::
    ++  simple-posts
      |=  posts=simple-posts:v8:c
      %-  pairs
      %+  turn  (tap:on-simple-posts:v8:c posts)
      |=  [id=id-post:c post=(unit simple-post:v8:c)]
      [(scot %ud id) ?~(post ~ (simple-post u.post))]
    ++  simple-post
      |=  sp=simple-post:v8:c
      %-  pairs
      :~  seal+(simple-seal -.sp)
          essay+(essay +.sp)
          type+s+%post
      ==
    ++  simple-seal
      |=  seal=simple-seal:v8:c
      %-  pairs
      :~  id+(id id.seal)
          reacts+(reacts reacts.seal)
          replies+(simple-replies replies.seal)
          meta+(reply-meta reply-meta.seal)
      ==
    ++  simple-replies
      |=  replies=simple-replies:v8:c
      %-  pairs
      %+  turn  (tap:on-simple-replies:v8:c replies)
      |=  [t=@da reply=simple-reply:c]
      [(scot %ud t) (simple-reply reply)]
    ++  simple-reply
      |=  reply=simple-reply:v8:c
      %-  pairs
      :~  seal+(reply-seal -.reply)
          memo+(memo +.reply)
      ==
    ++  paged-posts
      |=  pn=paged-posts:v8:c
      %-  pairs
      :~  posts+(posts posts.pn)
          newer+?~(newer.pn ~ (id u.newer.pn))
          older+?~(older.pn ~ (id u.older.pn))
          total+(numb total.pn)
      ==
    ++  channel-heads
      |=  heads=channel-heads:v8:c
      :-  %a
      %+  turn  heads
      |=  [=nest:c recency=^time latest=(unit post:v8:c)]
      %-  pairs
      :~  nest+(^nest nest)
          recency+(time recency)
          latest+?~(latest ~ (post u.latest))
      ==
    ++  r-channels
      |=  [=nest:c =r-channel:v8:c]
      %-  pairs
      :~  nest+(^nest nest)
          response+(^r-channel r-channel)
      ==
    ::
    ++  r-channel
      |=  =r-channel:v8:c
      %+  frond  -.r-channel
      ?-  -.r-channel
        %posts    (posts posts.r-channel)
        %post     (pairs id+(id id.r-channel) r-post+(r-post r-post.r-channel) ~)
        %pending  (pending r-channel)
        %order    (order order.r-channel)
        %view     s+view.r-channel
        %sort     s+sort.r-channel
        %perm     (perm perm.r-channel)
        %meta     ?~(meta.r-channel ~ s+u.meta.r-channel)
      ::
        %create   (perm perm.r-channel)
        %join     (flag group.r-channel)
        %leave    ~
        %read     ~
        %read-at  s+(scot %ud time.r-channel)
        %watch    ~
        %unwatch  ~
      ==
    ++  r-post
      |=  =r-post:v8:c
      %+  frond  -.r-post
      ?-  -.r-post
        %set    ?~(post.r-post ~ (post u.post.r-post))
        %reacts  (reacts reacts.r-post)
        %essay  (essay essay.r-post)
      ::
          %reply
        %-  pairs
        :~  id+(id id.r-post)
            r-reply+(r-reply r-reply.r-post)
            meta+(reply-meta reply-meta.r-post)
        ==
      ==
    ++  r-reply
      |=  =r-reply:v8:c
      %+  frond  -.r-reply
      ?-  -.r-reply
        %set    ?~(reply.r-reply ~ (reply u.reply.r-reply))
        %reacts  (reacts reacts.r-reply)
      ==
    ++  r-channel-simple-post
      |=  r-channel=r-channel-simple-post:v8:c
      %+  frond  -.r-channel
      ?-  -.r-channel
        %posts    (simple-posts posts.r-channel)
        %post     (pairs id+(id id.r-channel) r-post+(r-simple-post r-post.r-channel) ~)
        %pending  (pending r-channel)
        %order    (order order.r-channel)
        %view     s+view.r-channel
        %sort     s+sort.r-channel
        %perm     (perm perm.r-channel)
        %meta     ?~(meta.r-channel ~ s+u.meta.r-channel)
      ::
        %create   (perm perm.r-channel)
        %join     (flag group.r-channel)
        %leave    ~
        %read     ~
        %read-at  s+(scot %ud time.r-channel)
        %watch    ~
        %unwatch  ~
      ==
    ++  r-simple-post
      |=  r-post=r-simple-post:v8:c
      %+  frond  -.r-post
      ?-  -.r-post
        %set    ?~(post.r-post ~ (simple-post u.post.r-post))
        %reacts  (reacts reacts.r-post)
        %essay  (essay essay.r-post)
      ::
          %reply
        %-  pairs
        :~  id+(id id.r-post)
            r-reply+(r-simple-reply r-reply.r-post)
            meta+(reply-meta reply-meta.r-post)
        ==
      ==
    ++  r-simple-reply
      |=  r-reply=r-simple-reply:v8:c
      %+  frond  -.r-reply
      ?-  -.r-reply
        %set    ?~(reply.r-reply ~ (simple-reply u.reply.r-reply))
        %reacts  (reacts reacts.r-reply)
      ==
    --
  ++  v7
    |%
    ::
    ++  r-channels
      |=  [=nest:c =r-channel:v7:c]
      %-  pairs
      :~  nest+(^nest nest)
          response+(^r-channel r-channel)
      ==
    ::
    ++  r-channel
      |=  =r-channel:v7:c
      %+  frond  -.r-channel
      ?-  -.r-channel
        %posts    (posts posts.r-channel)
        %post     (pairs id+(id id.r-channel) r-post+(r-post r-post.r-channel) ~)
        %pending  (pending r-channel)
        %order    (order order.r-channel)
        %view     s+view.r-channel
        %sort     s+sort.r-channel
        %perm     (perm perm.r-channel)
      ::
        %create   (perm perm.r-channel)
        %join     (flag group.r-channel)
        %leave    ~
        %read     ~
        %read-at  s+(scot %ud time.r-channel)
        %watch    ~
        %unwatch  ~
      ==
    ::
    ++  r-post
      |=  =r-post:v7:c
      %+  frond  -.r-post
      ?-  -.r-post
        %set    ?~(post.r-post ~ (post u.post.r-post))
        %reacts  (reacts reacts.r-post)
        %essay  (essay essay.r-post)
      ::
          %reply
        %-  pairs
        :~  id+(id id.r-post)
            r-reply+(r-reply r-reply.r-post)
            meta+(reply-meta reply-meta.r-post)
        ==
      ==
    ::
    ++  r-reply
      |=  =r-reply:v7:c
      %+  frond  -.r-reply
      ?-  -.r-reply
        %set    ?~(reply.r-reply ~ (reply u.reply.r-reply))
        %reacts  (reacts reacts.r-reply)
      ==
    ::
    ++  pending-msgs
      |=  pm=pending-messages:v7:c
      %-  pairs
      :~  posts+(pending-posts posts.pm)
          replies+(pending-replies replies.pm)
      ==
    ::
    ++  pending-posts
      |=  pp=pending-posts:v7:c
      %-  pairs
      %+  turn  ~(tap by pp)
      |=  [cid=client-id:c es=essay:v7:c]
      [(client-id-string cid) (essay es)]
    ::
    ++  pending-replies
      |=  pr=pending-replies:v7:c
      =/  replies
        %+  roll  ~(tap by pr)
        |=  $:  [[top=id-post:c cid=client-id:c] mem=memo:v7:c]
                rs=(map id-post:c (map client-id:c memo:c))
            ==
        ?.  (~(has by rs) top)  (~(put by rs) top (malt ~[[cid mem]]))
        %+  ~(jab by rs)  top
        |=  mems=(map client-id:c memo:c)
        (~(put by mems) cid mem)
      %-  pairs
      %+  turn  ~(tap by replies)
      |=  [top=id-post:c rs=(map client-id:c memo:c)]
      :-  (rsh 4 (scot %ui top))
      %-  pairs
      %+  turn  ~(tap by rs)
      |=  [cid=client-id:c mem=memo:c]
      [(client-id-string cid) (memo mem)]
    ::
    ++  pending
      |=  =r-channel:v7:c
      ?>  ?=([%pending *] r-channel)
      %-  pairs
      :~  id+(client-id id.r-channel)
          pending+(r-pending r-pending.r-channel)
      ==
    ++  r-pending
      |=  =r-pending:v7:c
      %+  frond  -.r-pending
      ?-  -.r-pending
        %post  (essay essay.r-pending)
      ::
          %reply
        %-  pairs
        :~  top+(id top.r-pending)
            meta+(reply-meta reply-meta.r-pending)
            memo+(memo memo.r-pending)
        ==
      ==
    ++  channels
      |=  =channels:v7:c
      %-  pairs
      %+  turn  ~(tap by channels)
      |=  [n=nest:c ca=channel:v7:c]
      [(nest-cord n) (channel ca)]
    ::
    ++  channel
      |=  =channel:v7:c
      %-  pairs
      :~  posts+(posts posts.channel)
          order+(order order.channel)
          view+s+view.channel
          sort+s+sort.channel
          perms+(perm perm.channel)
          pending+(pending-msgs pending.channel)
      ==
    ::
    ++  paged-posts
      |=  pn=paged-posts:v7:c
      %-  pairs
      :~  posts+(posts posts.pn)
          newer+?~(newer.pn ~ (id u.newer.pn))
          older+?~(older.pn ~ (id u.older.pn))
          total+(numb total.pn)
      ==
    ++  posts
      |=  =posts:v7:c
      %-  pairs
      %+  turn  (tap:on-posts:v7:c posts)
      |=  [id=id-post:c post=(unit post:v7:c)]
      [(scot %ud id) ?~(post ~ (^post u.post))]
    ::
    ++  post
      |=  [=seal:v7:c [rev=@ud =essay:v7:c]]
      %-  pairs
      :~  seal+(^seal seal)
          revision+s+(scot %ud rev)
          essay+(^essay essay)
          type+s+%post
      ==
    ::
    ++  seal
      |=  =seal:v7:c
      %-  pairs
      :~  id+(id id.seal)
          reacts+(reacts reacts.seal)
          replies+(replies replies.seal)
          meta+(reply-meta reply-meta.seal)
      ==
    ::
    ++  essay
      |=  =essay:v7:c
      %-  pairs
      :~  content+(story:enjs:sj content.essay)
          author+(ship author.essay)
          sent+(time sent.essay)
          kind-data+(kind-data kind-data.essay)
      ==
    ::
    ++  kind-data
      |=  =kind-data:v7:old:c
      %+  frond  -.kind-data
      ?-    -.kind-data
        %heap   ?~(title.kind-data ~ s+u.title.kind-data)
        %chat   ?~(kind.kind-data ~ (pairs notice+~ ~))
        %diary  (pairs title+s+title.kind-data image+s+image.kind-data ~)
      ==
    ::
    ++  channel-heads
      |=  heads=channel-heads:v7:c
      :-  %a
      %+  turn  heads
      |=  [=nest:c recency=^time latest=(unit post:v7:c)]
      %-  pairs
      :~  nest+(^nest nest)
          recency+(time recency)
          latest+?~(latest ~ (post u.latest))
      ==
    ::
    ++  reacts
      |=  =reacts:v7:c
      ^-  json
      %-  pairs
      %+  turn  ~(tap by reacts)
      |=  [her=@p =react:v7:c]
      [(scot %p her) s+react]
    ::
    ++  replies
      |=  =replies:v7:c
      %-  pairs
      %+  turn  (tap:on-replies:v7:c replies)
      |=  [t=@da reply=(unit reply:v7:c)]
      [(scot %ud t) ?~(reply ~ (^reply u.reply))]
    ::
    ++  reply
      |=  [=reply-seal:v7:c [rev=@ud =memo:c]]
      %-  pairs
      :~  seal+(^reply-seal reply-seal)
          revision+s+(scot %ud rev)
          memo+(^memo memo)
      ==
    ::
    ++  reply-seal
      |=  =reply-seal:v7:c
      %-  pairs
      :~  id+(id id.reply-seal)
          parent-id+(id parent-id.reply-seal)
          reacts+(reacts reacts.reply-seal)
      ==
    ::
    ++  r-channels-simple-post
      |=  [=nest:c =r-channel-simple-post:v7:c]
      %-  pairs
      :~  nest+(^nest nest)
          response+(^r-channel-simple-post r-channel-simple-post)
      ==
    ::
    ++  r-simple-post
      |=  r-post=r-simple-post:v7:c
      %+  frond  -.r-post
      ?-  -.r-post
        %set    ?~(post.r-post ~ (simple-post u.post.r-post))
        %reacts  (reacts reacts.r-post)
        %essay  (essay essay.r-post)
      ::
          %reply
        %-  pairs
        :~  id+(id id.r-post)
            r-reply+(r-simple-reply r-reply.r-post)
            meta+(reply-meta reply-meta.r-post)
        ==
      ==
    ::
    ++  r-simple-reply
      |=  r-reply=r-simple-reply:v7:c
      %+  frond  -.r-reply
      ?-  -.r-reply
        %set    ?~(reply.r-reply ~ (simple-reply u.reply.r-reply))
        %reacts  (reacts reacts.r-reply)
      ==
    ::
    ++  simple-posts
      |=  posts=simple-posts:v7:c
      %-  pairs
      %+  turn  (tap:on-simple-posts:v7:c posts)
      |=  [id=id-post:c post=(unit simple-post:v7:c)]
      [(scot %ud id) ?~(post ~ (simple-post u.post))]
    ::
    ++  simple-post
      |=  [seal=simple-seal:v7:c =essay:v7:c]
      %-  pairs
      :~  seal+(simple-seal seal)
          essay+(^essay essay)
          type+s+%post
      ==
    ++  simple-seal
      |=  seal=simple-seal:v7:c
      %-  pairs
      :~  id+(id id.seal)
          reacts+(reacts reacts.seal)
          replies+(simple-replies replies.seal)
          meta+(reply-meta reply-meta.seal)
      ==
    ++  paged-simple-posts
      |=  pn=paged-simple-posts:v7:c
      %-  pairs
      :~  posts+(simple-posts posts.pn)
          newer+?~(newer.pn ~ (id u.newer.pn))
          older+?~(older.pn ~ (id u.older.pn))
          total+(numb total.pn)
      ==
    ++  simple-replies
      |=  replies=simple-replies:v7:c
      %-  pairs
      %+  turn  (tap:on-simple-replies:v7:c replies)
      |=  [t=@da reply=simple-reply:v7:c]
      [(scot %ud t) (simple-reply reply)]
    ++  r-channel-simple-post
      |=  r-channel=r-channel-simple-post:v7:c
      %+  frond  -.r-channel
      ?-  -.r-channel
        %posts    (simple-posts posts.r-channel)
        %post     (pairs id+(id id.r-channel) r-post+(r-simple-post r-post.r-channel) ~)
        %pending  (pending r-channel)
        %order    (order order.r-channel)
        %view     s+view.r-channel
        %sort     s+sort.r-channel
        %perm     (perm perm.r-channel)
      ::
        %create   (perm perm.r-channel)
        %join     (flag group.r-channel)
        %leave    ~
        %read     ~
        %read-at  s+(scot %ud time.r-channel)
        %watch    ~
        %unwatch  ~
      ==
    ::
    ++  reference
      |=  =reference:v7:c
      %+  frond  -.reference
      ?-    -.reference
          %post  (simple-post post.reference)
          %reply
        %-  pairs
        :~  id-post+(id id-post.reference)
            reply+(simple-reply reply.reference)
        ==
      ==
    ::
    ++  said
      |=  s=said:v7:c
      ^-  json
      %-  pairs
      :~  nest/(nest p.s)
          reference/(reference q.s)
      ==
    ::
    ++  reply-meta
      |=  r=reply-meta:v7:c
      %-  pairs
      :~  'replyCount'^(numb reply-count.r)
          'lastReply'^?~(last-reply.r ~ (time u.last-reply.r))
          'lastRepliers'^a/(turn ~(tap in last-repliers.r) author)
      ==
    ::
    --
  ++  v1
    |%
    ++  channels
      |=  =channels:v1:c
      %-  pairs
      %+  turn  ~(tap by channels)
      |=  [n=nest:c ca=channel:v1:c]
      [(nest-cord n) (channel ca)]
    ::
    ++  channel
      |=  =channel:v1:c
      %-  pairs
      :~  posts+(posts posts.channel)
          order+(order order.channel)
          view+s+view.channel
          sort+s+sort.channel
          perms+(perm perm.channel)
          pending+(pending-msgs pending.channel)
      ==
    ::
    ++  paged-posts
      |=  pn=paged-posts:v1:c
      %-  pairs
      :~  posts+(posts posts.pn)
          newer+?~(newer.pn ~ (id u.newer.pn))
          older+?~(older.pn ~ (id u.older.pn))
          total+(numb total.pn)
      ==
    ::
    ++  posts
      |=  =posts:v1:c
      %-  pairs
      %+  turn  (tap:on-posts:v1:c posts)
      |=  [id=id-post:c post=(unit post:v1:c)]
      [(scot %ud id) ?~(post ~ (^post u.post))]
    ::
    ++  seal
      |=  =seal:v1:c
      %-  pairs
      :~  id+(id id.seal)
          reacts+(reacts reacts.seal)
          replies+(replies replies.seal)
          meta+(reply-meta reply-meta.seal)
      ==
    ++  post
      |=  [=seal:v1:c [rev=@ud =essay:v7:c]]
      %-  pairs
      :~  seal+(^seal seal)
          revision+s+(scot %ud rev)
          essay+(essay:v7 essay)
          type+s+%post
      ==
    ++  simple-post  simple-post:v7
    ++  replies
      |=  =replies:v1:c
      %-  pairs
      %+  turn  (tap:on-replies:v1:c replies)
      |=  [t=@da =reply:v7:c]
      [(scot %ud t) (reply:v7 reply)]
    --
  ::
  ++  v0
    |%
    ::
    ++  channels
      |=  channels=channels-0:c
      %-  pairs
      %+  turn  ~(tap by channels)
      |=  [n=nest:c ca=channel-0:c]
      [(nest-cord n) (channel ca)]
    ::
    ++  channel
      |=  channel=channel-0:c
      %-  pairs
      :~  posts+(posts posts.channel)
          order+(order order.channel)
          view+s+view.channel
          sort+s+sort.channel
          perms+(perm perm.channel)
      ==
    ::
    ++  posts
      |=  =posts:v7:c
      %-  pairs
      %+  turn  (tap:on-posts:v7:c posts)
      |=  [id=id-post:c post=(unit post:v7:c)]
      [(scot %ud id) ?~(post ~ (^post u.post))]
    ::
    ++  post
      |=  [=seal:v7:c [rev=@ud =essay:v7:c]]
      %-  pairs
      :~  seal+(^seal seal)
          revision+s+(scot %ud rev)
          essay+(essay:v7 essay)
          type+s+%post
      ==
    ::
    ++  seal
      |=  =seal:v7:c
      %-  pairs
      :~  id+(id id.seal)
          reacts+(reacts reacts.seal)
          replies+(replies:v7 replies.seal)
          meta+(reply-meta reply-meta.seal)
      ==
    --
  --
::
++  dejs
  =,  dejs:format
  |%
  +|  %actions
  ::
  ++  a-channels
    ^-  $-(json a-channels:c)
    %-  of
    :~  create+create-channel
        pin+(ar nest)
        channel+(ot nest+nest action+a-channel ~)
        toggle-post+post-toggle
    ==
  ++  a-channel
    ^-  $-(json a-channel:c)
    %-  of
    :~  join+flag
        leave+ul
        read+ul
        read-at+(se %ud)
        watch+ul
        unwatch+ul
      ::
        meta+(mu so)
        post+a-post
        view+(su (perk %grid %list ~))
        sort+(su (perk %time %alpha %arranged ~))
        order+(mu (ar id))
        add-writers+add-sects
        del-writers+del-sects
    ==
  ++  react
    ^-  $-(json react:c)
    |=  =json
    ?:  ?=(%s -.json)  p.json
    ((of any+so ~) json)
  ::
  ++  a-post
    ^-  $-(json a-post:c)
    %-  of
    :~  add+essay
        edit+(ot id+id essay+essay ~)
        del+id
        reply+(ot id+id action+a-reply ~)
        add-react+(ot id+id ship+ship react+react ~)
        del-react+(ot id+id ship+ship ~)
    ==

  ++  a-reply
    ^-  $-(json a-reply:c)
    %-  of
    :~  add+memo
        del+id
        edit+(ot id+id memo+memo ~)
        add-react+(ot id+id ship+ship react+react ~)
        del-react+(ot id+id ship+ship ~)
    ==
  ++  meta
    ^-  $-(json data:^^meta)
    %-  ot
    :~  title/so
        description/so
        image/so
        cover/so
    ==
  ++  author
    |=  =json
    ^-  author:c
    ?:  ?=(%s -.json)
      (ship json)
    %.  json
    %-  ot
    :~  ship/ship
        nickname/(mu so)
        avatar/(mu so)
    ==
  ++  memo
    %-  ot
    :~  content/story:dejs:sj
        author/author
        sent/di
    ==
  ++  essay
    ^-  $-(json essay:c)
    %+  cu
      |=  $:  =story:s  =author:c  =time:z
              kind=path  meta=(unit data:^^meta)  blob=(unit @t)
          ==
      `essay:c`[[story author time] kind meta blob]
    %-  ot
    :~  content/story:dejs:sj
        author/author
        sent/di
        ::
        kind/pa
        meta/(mu meta)
        blob/(mu so)
    ==
  ::
  :: +|  %old
  ::
  ++  v7
    |%
    ++  a-channels
      ^-  $-(json a-channels:v7:c)
      %-  of
      :~  create+create-channel
          pin+(ar nest)
          channel+(ot nest+nest action+a-channel ~)
          toggle-post+post-toggle
      ==
    ++  create-channel
      ^-  $-(json create-channel:v7:c)
      %-  ot
      :~  kind+kind
          name+(se %tas)
          group+flag
          title+so
          description+so
          readers+(as (se %tas))
          writers+(as (se %tas))
      ==
    ++  a-channel
      ^-  $-(json a-channel:v7:c)
      %-  of
      :~  join+flag
          leave+ul
          read+ul
          read-at+(se %ud)
          watch+ul
          unwatch+ul
        ::
          post+a-post
          view+(su (perk %grid %list ~))
          sort+(su (perk %time %alpha %arranged ~))
          order+(mu (ar id))
          add-writers+add-sects
          del-writers+del-sects
      ==
    ::
    ++  memo
      %-  ot
      :~  content/story:v0:ver:dejs:sj
          author/ship
          sent/di
      ==
    ::
    ++  essay
      ^-  $-(json essay:v7:c)
      %+  cu
        |=  [=story:v7:c =ship:z =time:z =kind-data:v7:c]
        `essay:v7:c`[[story ship time] kind-data]
      %-  ot
      :~  content/story:v0:dejs:sj
          author/ship
          sent/di
          kind-data/kind-data
      ==
    ++  kind-data
      ^-  $-(json kind-data:v7:c)
      %-  of
      :~  diary+(ot title+so image+so ~)
          heap+(mu so)
          chat+chat-kind
      ==
    ::
    ++  a-post
      ^-  $-(json a-post:v7:c)
      %-  of
      :~  add+essay
          edit+(ot id+id essay+essay ~)
          del+id
          reply+(ot id+id action+a-reply ~)
          add-react+(ot id+id ship+ship react+so ~)
          del-react+(ot id+id ship+ship ~)
      ==
    ::
    ++  a-reply
      ^-  $-(json a-reply:v7:c)
      %-  of
      :~  add+memo
          del+id
          edit+(ot id+id memo+memo ~)
          add-react+(ot id+id ship+ship react+so ~)
          del-react+(ot id+id ship+ship ~)
      ==
    --
  ::
  +|  %primitives
  ++  id    (se %ud)
  ++  ship  `$-(json ship:z)`(su ship-rule)
  ++  kind  `$-(json kind:c)`(su han-rule)
  ++  flag  `$-(json flag:g)`(su flag-rule)
  ++  nest  `$-(json nest:c)`(su nest-rule)
  ++  ship-rule  ;~(pfix sig fed:ag)
  ++  han-rule   (sear (soft kind:c) sym)
  ++  flag-rule  ;~((glue fas) ship-rule sym)
  ++  nest-rule  ;~((glue fas) han-rule ship-rule sym)
  ::
  ++  create-channel
    ^-  $-(json create-channel:c)
    %-  ot
    :~  kind+kind
        name+(se %tas)
        group+flag
        title+so
        description+so
        meta+(mu so)
        readers+(as (se %tas))
        writers+(as (se %tas))
    ==
  ::
  ++  add-sects  (as (se %tas))
  ++  del-sects  (as so)
  ::
  ++  chat-kind
    ^-  $-(json $@(~ [%notice ~]))
    |=  jon=json
    ?~  jon  ~
    ((of notice+ul ~) jon)
  ::
  ++  pins
    %-  ot
    :~  pins/(ar nest)
    ==
  ::
  ++  post-toggle
    ^-  $-(json post-toggle:c)
    %-  of
    :~  hide/(se %ud)
        show/(se %ud)
    ==
  ++  maybe
    |*  wit=fist
    |=  jon=json
    ?~(jon ~ (wit jon))
  --
--
