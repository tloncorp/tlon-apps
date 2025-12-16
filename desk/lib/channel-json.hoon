/-  cv=channels-ver, gv=groups-ver, s=story
/-  meta
/+  gj=groups-json, sj=story-json, dj=cite-json
=*  z  ..zuse
|%
++  enjs
  =,  enjs:format
  |%
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
    |=  cid=client-id:v9:cv
    %+  rap  3
    :~  (scot %p author.cid)
        '/'
        (scot %ud (unm:chrono:userlib sent.cid))
    ==
  ::
  ++  client-id
    |=  =client-id:v9:cv
    %-  pairs
    :~  author+(ship author.client-id)
        sent+(time sent.client-id)
    ==
  ::
  ++  flag
    |=  f=flag:gv
    ^-  json
    s/(rap 3 (scot %p p.f) '/' q.f ~)
  ::
  ++  nest
    |=  n=nest:cv
    ^-  json
    s/(nest-cord n)
  ::
  ++  nest-cord
    |=  n=nest:cv
    ^-  cord
    (rap 3 kind.n '/' (scot %p ship.n) '/' name.n ~)
  ::
  ++  ship
    |=  her=@p
    n+(rap 3 '"' (scot %p her) '"' ~)
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
  ::
  ++  unread-threads
    |=  u=(map id-post:cv [id-reply:cv @ud])
    %-  pairs
    %+  turn  ~(tap by u)
    |=  [p=id-post:cv u=[id-reply:cv @ud]]
    [+:(id p) (unread-point u)]
  ::
  ++  unread-point
    |=  [t=@da count=@ud]
    %-  pairs
    :~  id/(id t)
        count/(numb count)
    ==
  ::
  ++  unreads
    |=  bs=unreads:cv
    %-  pairs
    %+  turn  ~(tap by bs)
    |=  [n=nest:cv b=unread:v9:cv]
    [(nest-cord n) (unread b)]
  ::
  ++  unread-update
    |=  u=(pair nest:cv unread:cv)
    %-  pairs
    :~  nest/(nest p.u)
        unread/(unread q.u)
    ==
  ::
  ++  unread
    |=  b=unread:cv
    %-  pairs
    :~  recency/(time recency.b)
        count/(numb count.b)
        unread/?~(unread.b ~ (unread-point u.unread.b))
        threads/(unread-threads threads.b)
    ==
  ::
  ++  pins
    |=  ps=(list nest:cv)
    %-  pairs
    :~  pins/a/(turn ps nest)
    ==
  ::
  ++  order
    |=  a=arranged-posts:cv
    :-  %a
    =/  times=(list time:z)  ?~(a ~ u.a)
    (turn times id)
  ::
  ++  post-toggle
    |=  p=post-toggle:cv
    %+  frond  -.p
    ?-  -.p
      %hide  (id id-post.p)
      %show  (id id-post.p)
    ==
  ::
  ++  hidden-posts
    |=  hp=hidden-posts:cv
    a+(turn ~(tap in hp) id)
  ++  v10
    =,  v9
    |%
    ++  r-channels
      |=  [=nest:cv =r-channel:v10:cv]
      %-  pairs
      :~  nest+(^nest nest)
          response+(^r-channel r-channel)
      ==
    ::
    ++  r-channel
      |=  =r-channel:v10:cv
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
      ::
        %connection  (connection [wire conn]:r-channel)
      ==
    ++  connection
      |=  [=wire =conn:v10:gv]
      %-  pairs
      :~  'wire'^(path wire)
          'status'^(^conn conn)
      ==
    ++  conn
      |=  =conn:v10:gv
      ?:  ?=(%& -.conn)
        (frond ok+s+p.conn)
      (frond error+s+p.conn)
    ::TODO migrate writers to role-ids
    ++  perm
      |=  p=perm:v10:cv
      %-  pairs
      :~  writers/a/(turn ~(tap in writers.p) (lead %s))
          group/(flag group.p)
      ==
    ++  channels
      |=  channels=channels:v10:cv
      %-  pairs
      %+  turn  ~(tap by channels)
      |=  [n=nest:cv ca=channel:v10:cv]
      [(nest-cord n) (channel ca)]
    ::
    ++  channel
      |=  channel=channel:v10:cv
      %-  pairs
      :~  posts+(posts posts.channel)
          count+(numb count.channel)
          order+(order order.channel)
          view+s+view.channel
          sort+s+sort.channel
          perms+(perm perm.channel)
          meta+?~(meta.channel ~ s+u.meta.channel)
          conn+(conn conn.net.channel)
      ==
    --
  ++  v9
    |%
    ++  r-channels
      |=  [=nest:cv =r-channel:v9:cv]
      %-  pairs
      :~  nest+(^nest nest)
          response+(^r-channel r-channel)
      ==
    ::
    ++  r-channel
      |=  =r-channel:v9:cv
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
      |=  [=nest:cv =r-channel-simple-post:v9:cv]
      %-  pairs
      :~  nest+(^nest nest)
          response+(^r-channel-simple-post r-channel-simple-post)
      ==
    ::
    ++  r-channel-simple-post
      |=  r-channel=r-channel-simple-post:v9:cv
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
      |=  =r-channel:v9:cv
      ?>  ?=([%pending *] r-channel)
      %-  pairs
      :~  id+(client-id id.r-channel)
          pending+(r-pending r-pending.r-channel)
      ==
    ::
    ++  r-pending
      |=  =r-pending:v9:cv
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
      |=  =r-post:v9:cv
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
      |=  r-post=r-simple-post:v9:cv
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
      |=  =r-reply:v9:cv
      %+  frond  -.r-reply
      ?-  -.r-reply
        %set    ?:(?=(%| -.reply.r-reply) (tombstone +.reply.r-reply) (reply +.reply.r-reply))
        %reacts  (reacts reacts.r-reply)
      ==
    ::
    ++  r-simple-reply
      |=  r-reply=r-simple-reply:v9:cv
      %+  frond  -.r-reply
      ?-  -.r-reply
        %set    ?:(?=(%| -.reply.r-reply) (tombstone +.reply.r-reply) (simple-reply +.reply.r-reply))
        %reacts  (reacts reacts.r-reply)
      ==
    ::
    ++  channel-heads
      |=  heads=channel-heads:v9:cv
      :-  %a
      %+  turn  heads
      |=  [=nest:cv recency=^time latest=(may:v9:cv post:v9:cv)]
      %-  pairs
      :~  nest+(^nest nest)
          recency+(time recency)
          latest+?-(-.latest %& (post +.latest), %| (tombstone +.latest))
      ==
    ::
    ++  paged-posts
      |=  pn=paged-posts:v9:cv
      %-  pairs
      :~  posts+(posts posts.pn)
          newer+?~(newer.pn ~ (id u.newer.pn))
          older+?~(older.pn ~ (id u.older.pn))
          newest+(numb newest.pn)
          total+(numb total.pn)
      ==
    ::
    ++  paged-simple-posts
      |=  pn=paged-simple-posts:v9:cv
      %-  pairs
      :~  posts+(simple-posts posts.pn)
          newer+?~(newer.pn ~ (id u.newer.pn))
          older+?~(older.pn ~ (id u.older.pn))
          newest+(numb newest.pn)
          total+(numb total.pn)
      ==
    ::
    ++  channels
      |=  channels=channels:v9:cv
      %-  pairs
      %+  turn  ~(tap by channels)
      |=  [n=nest:cv ca=channel:v9:cv]
      [(nest-cord n) (channel ca)]
    ::
    ++  channel
      |=  channel=channel:v9:cv
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
      |=  =posts:v9:cv
      %-  pairs
      %+  turn  (tap:on-posts:v9:cv posts)
      |=  [id=id-post:cv post=(may:v9:cv post:v9:cv)]
      [(scot %ud id) (may ^post post)]
    ::
    ++  post
      |=  [=seal:v9:cv [rev=@ud =essay:v9:cv]]
      %-  pairs
      :~  seal+(^seal seal)
          revision+s+(scot %ud rev)
          essay+(^essay essay)
          type+s+%post
      ==
    ++  tombstone
      |=  t=tombstone:v9:cv
      %-  pairs
      :~  id+(id id.t)
          author+(author author.t)
          seq+(numb seq.t)
          deleted-at+(time del-at.t)
          type+s+%tombstone
      ==
    ++  simple-posts
      |=  posts=simple-posts:v9:cv
      %-  pairs
      %+  turn  (tap:on-simple-posts:v9:cv posts)
      |=  [id=id-post:cv post=(may:v9:cv simple-post:v9:cv)]
      [(scot %ud id) (may simple-post post)]
    ::
    ++  simple-post
      |=  [seal=simple-seal:v9:cv =essay:v9:cv]
      %-  pairs
      :~  seal+(simple-seal seal)
          essay+(^essay essay)
          type+s+%post
      ==
    ::
    ++  replies
      |=  =replies:v9:cv
      %-  pairs
      %+  turn  (tap:on-replies:v9:cv replies)
      |=  [t=@da reply=(may:v9:cv reply:v9:cv)]
      [(scot %ud t) ?:(?=(%| -.reply) (tombstone +.reply) (^reply +.reply))]
    ::
    ++  simple-replies
      |=  replies=simple-replies:v9:cv
      %-  pairs
      %+  turn  (tap:on-simple-replies:v9:cv replies)
      |=  [t=@da reply=simple-reply:v9:cv]
      [(scot %ud t) (simple-reply reply)]
    ::
    ++  reply
      |=  [=reply-seal:v9:cv [rev=@ud =memo:v9:cv]]
      %-  pairs
      :~  seal+(^reply-seal reply-seal)
          revision+s+(scot %ud rev)
          memo+(^memo memo)
      ==
    ::
    ++  simple-reply
      |=  [=reply-seal:v9:cv =memo:v9:cv]
      %-  pairs
      :~  seal+(^reply-seal reply-seal)
          memo+(^memo memo)
      ==
    ::
    ++  seal
      |=  =seal:v9:cv
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
      |=  seal=simple-seal:v9:cv
      %-  pairs
      :~  id+(id id.seal)
          reacts+(reacts reacts.seal)
          replies+(simple-replies replies.seal)
          meta+(reply-meta reply-meta.seal)
      ==
    ::
    ++  reply-seal
      |=  =reply-seal:v9:cv
      %-  pairs
      :~  id+(id id.reply-seal)
          parent-id+(id parent-id.reply-seal)
          reacts+(reacts reacts.reply-seal)
      ==
    ::
    ++  pending-msgs
      |=  pm=pending-messages:v9:cv
      %-  pairs
      :~  posts+(pending-posts posts.pm)
          replies+(pending-replies replies.pm)
      ==
    ::
    ++  pending-posts
      |=  pp=pending-posts:v9:cv
      %-  pairs
      %+  turn  ~(tap by pp)
      |=  [cid=client-id:v9:cv es=essay:v9:cv]
      [(client-id-string cid) (essay es)]
    ::
    ++  pending-replies
      |=  pr=pending-replies:v9:cv
      =/  replies
        %+  roll  ~(tap by pr)
        |=  [[[top=id-post:cv cid=client-id:v9:cv] mem=memo:v9:cv] rs=(map id-post:cv (map client-id:v9:cv memo:v9:cv))]
        ?.  (~(has by rs) top)  (~(put by rs) top (malt ~[[cid mem]]))
        %+  ~(jab by rs)  top
        |=  mems=(map client-id:v9:cv memo:v9:cv)
        (~(put by mems) cid mem)
      %-  pairs
      %+  turn  ~(tap by replies)
      |=  [top=id-post:cv rs=(map client-id:v9:cv memo:v9:cv)]
      :-  (rsh 4 (scot %ui top))
      %-  pairs
      %+  turn  ~(tap by rs)
      |=  [cid=client-id:v9:cv mem=memo:v9:cv]
      [(client-id-string cid) (memo mem)]
    ::
    ++  may
      |*  [f=$-(* json) m=(may:v9:cv *)]
      ?-  -.m
        %&  (f +.m)
        %|  (tombstone +.m)
      ==
    ::
    ++  v-channel
      |=  ca=v-channel:v9:cv
      %-  pairs
      :~  order+(order +.order.ca)
          perms+(perm +.perm.ca)
          view+s++.view.ca
          sort+s++.sort.ca
          pending+(pending-msgs pending.ca)
      ==
    ++  order
      |=  a=arranged-posts:v9:cv
      :-  %a
      =/  times=(list time:z)  ?~(a ~ u.a)
      (turn times id)
    ::
    ++  perm
      |=  p=perm:v9:cv
      %-  pairs
      :~  writers/a/(turn ~(tap in writers.p) (lead %s))
          group/(flag group.p)
      ==
    ::
    ++  react
      |=  =react:v9:cv
      ^-  json
      ?@  react
        s+react
      ?-  -.react
        %any  (frond %any s+p.react)
      ==
    ::
    ++  reacts
      |=  =reacts:v9:cv
      ^-  json
      %-  pairs
      %+  turn  ~(tap by reacts)
      |=  [=author:v9:cv =react:v9:cv]
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
      |=  =author:v9:cv
      ^-  @t
      ?@  author  (scot %p author)
      (rap 3 ~[(scot %p ship.author) '/' (fall nickname.author '')])
    ++  author
      |=  =author:v9:cv
      ^-  json
      ?@  author  (ship author)
      %-  pairs
      :~  ship+(ship ship.author)
          nickname+?~(nickname.author ~ s/u.nickname.author)
          avatar+?~(avatar.author ~ s/u.avatar.author)
      ==
    ++  essay
      |=  =essay:v9:cv
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
      |=  r=reply-meta:v9:cv
      %-  pairs
      :~  'replyCount'^(numb reply-count.r)
          'lastReply'^?~(last-reply.r ~ (time u.last-reply.r))
          'lastRepliers'^a/(turn ~(tap in last-repliers.r) author)
      ==
    ::
    ++  memo
      |=  m=memo:v9:cv
      ^-  json
      %-  pairs
      :~  content/(story:enjs:sj content.m)
          author/(author author.m)
          sent/(time sent.m)
      ==
    ::
    ++  unreads
      |=  bs=unreads:v9:cv
      %-  pairs
      %+  turn  ~(tap by bs)
      |=  [n=nest:cv b=unread:v9:cv]
      [(nest-cord n) (unread b)]
    ::
    ++  unread-update
      |=  u=(pair nest:cv unread:v9:cv)
      %-  pairs
      :~  nest/(nest p.u)
          unread/(unread q.u)
      ==
    ::
    ++  unread
      |=  b=unread:v9:cv
      %-  pairs
      :~  recency/(time recency.b)
          count/(numb count.b)
          unread/?~(unread.b ~ (unread-point u.unread.b))
          threads/(unread-threads threads.b)
      ==
    ::
    ++  reference
      |=  =reference:v9:cv
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
      |=  s=said:v9:cv
      ^-  json
      %-  pairs
      :~  nest/(nest p.s)
          reference/(reference q.s)
      ==
    --
  ++  v8
    |%
    ++  channels
      |=  channels=channels:v8:cv
      %-  pairs
      %+  turn  ~(tap by channels)
      |=  [n=nest:cv ca=channel:v8:cv]
      [(nest-cord n) (channel ca)]
    ::
    ++  channel
      |=  channel=channel:v8:cv
      %-  pairs
      :~  posts+(posts posts.channel)
          count+(numb count.channel)
          order+(order order.channel)
          view+s+view.channel
          sort+s+sort.channel
          perms+(perm perm.channel)
          meta+?~(meta.channel ~ s+u.meta.channel)
      ==
    ++  perm
      |=  p=perm:v8:cv
      %-  pairs
      :~  writers/a/(turn ~(tap in writers.p) (lead %s))
          group/(flag group.p)
      ==
    ++  said
      |=  s=said:v8:cv
      %-  pairs
      :~  nest+(nest p.s)
          reference+(reference q.s)
      ==
    ++  reference
      |=  =reference:v8:cv
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
      |=  =posts:v8:cv
      %-  pairs
      %+  turn  (tap:on-posts:v8:cv posts)
      |=  [id=id-post:cv post=(unit post:v8:cv)]
      [(scot %ud id) ?~(post ~ (^post u.post))]
    ++  post
      |=  [=seal:v8:cv [rev=@ud =essay:v8:cv]]
      %-  pairs
      :~  seal+(^seal seal)
          revision+s+(scot %ud rev)
          essay+(^essay essay)
          type+s+%post
      ==
    ++  essay
      |=  =essay:v8:cv
      %-  pairs
      :~  content+(story:enjs:sj content.essay)
          author+(author author.essay)
          sent+(time sent.essay)
          ::
          kind+(path kind.essay)
          meta+(meta meta.essay)
          blob+?~(blob.essay ~ s/u.blob.essay)
      ==
    ++  seal
      |=  =seal:v8:cv
      %-  pairs
      :~  id+(id id.seal)
          seq+(numb seq.seal)
          mod-at+(mod-at mod-at.seal)
          reacts+(reacts reacts.seal)
          replies+(replies replies.seal)
          meta+(reply-meta reply-meta.seal)
      ==
    ++  replies
      |=  =replies:v8:cv
      %-  pairs
      %+  turn  (tap:on-replies:v8:cv replies)
      |=  [t=@da reply=(unit reply:v8:cv)]
      [(scot %ud t) ?~(reply ~ (^reply +.reply))]
    ::
    ++  simple-posts
      |=  posts=simple-posts:v8:cv
      %-  pairs
      %+  turn  (tap:on-simple-posts:v8:cv posts)
      |=  [id=id-post:cv post=(unit simple-post:v8:cv)]
      [(scot %ud id) ?~(post ~ (simple-post u.post))]
    ++  simple-post
      |=  sp=simple-post:v8:cv
      %-  pairs
      :~  seal+(simple-seal -.sp)
          essay+(essay +.sp)
          type+s+%post
      ==
    ++  simple-seal
      |=  seal=simple-seal:v8:cv
      %-  pairs
      :~  id+(id id.seal)
          reacts+(reacts reacts.seal)
          replies+(simple-replies replies.seal)
          meta+(reply-meta reply-meta.seal)
      ==
    ++  simple-replies
      |=  replies=simple-replies:v8:cv
      %-  pairs
      %+  turn  (tap:on-simple-replies:v8:cv replies)
      |=  [t=@da reply=simple-reply:v8:cv]
      [(scot %ud t) (simple-reply reply)]
    ++  simple-reply
      |=  reply=simple-reply:v8:cv
      %-  pairs
      :~  seal+(reply-seal -.reply)
          memo+(memo +.reply)
      ==
    ++  reply-seal
      |=  =reply-seal:v8:cv
      %-  pairs
      :~  id+(id id.reply-seal)
          parent-id+(id parent-id.reply-seal)
          reacts+(reacts reacts.reply-seal)
      ==
    ++  memo
      |=  m=memo:v8:cv
      ^-  json
      %-  pairs
      :~  content/(story:enjs:sj content.m)
          author/(author author.m)
          sent/(time sent.m)
      ==
    ++  author
      |=  =author:v8:cv
      ^-  json
      ?@  author  (ship author)
      %-  pairs
      :~  ship+(ship ship.author)
          nickname+?~(nickname.author ~ s/u.nickname.author)
          avatar+?~(avatar.author ~ s/u.avatar.author)
      ==
    ++  paged-posts
      |=  pn=paged-posts:v8:cv
      %-  pairs
      :~  posts+(posts posts.pn)
          newer+?~(newer.pn ~ (id u.newer.pn))
          older+?~(older.pn ~ (id u.older.pn))
          total+(numb total.pn)
      ==
    ++  channel-heads
      |=  heads=channel-heads:v8:cv
      :-  %a
      %+  turn  heads
      |=  [=nest:cv recency=^time latest=(unit post:v8:cv)]
      %-  pairs
      :~  nest+(^nest nest)
          recency+(time recency)
          latest+?~(latest ~ (post u.latest))
      ==
    ++  r-channels
      |=  [=nest:cv =r-channel:v8:cv]
      %-  pairs
      :~  nest+(^nest nest)
          response+(^r-channel r-channel)
      ==
    ::
    ++  r-channel
      |=  =r-channel:v8:cv
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
    ++  pending
      |=  =r-channel:v8:cv
      ?>  ?=([%pending *] r-channel)
      %-  pairs
      :~  id+(client-id id.r-channel)
          pending+(r-pending r-pending.r-channel)
      ==
    ::
    ++  r-pending
      |=  =r-pending:v8:cv
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
    ++  r-post
      |=  =r-post:v8:cv
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
    ++  reply-meta
      |=  r=reply-meta:v8:cv
      %-  pairs
      :~  'replyCount'^(numb reply-count.r)
          'lastReply'^?~(last-reply.r ~ (time u.last-reply.r))
          'lastRepliers'^a/(turn ~(tap in last-repliers.r) author)
      ==
    ++  react
      |=  =react:v8:cv
      ^-  json
      ?@  react
        s+react
      ?-  -.react
        %any  (frond %any s+p.react)
      ==
    ++  reacts
      |=  =reacts:v8:cv
      ^-  json
      %-  pairs
      %+  turn  ~(tap by reacts)
      |=  [=author:v8:cv =react:v8:cv]
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
      |=  =author:v9:cv
      ^-  @t
      ?@  author  (scot %p author)
      (rap 3 ~[(scot %p ship.author) '/' (fall nickname.author '')])
    ++  r-reply
      |=  =r-reply:v8:cv
      %+  frond  -.r-reply
      ?-  -.r-reply
        %set    ?~(reply.r-reply ~ (reply u.reply.r-reply))
        %reacts  (reacts reacts.r-reply)
      ==
    ++  r-channel-simple-post
      |=  r-channel=r-channel-simple-post:v8:cv
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
      |=  r-post=r-simple-post:v8:cv
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
      |=  r-reply=r-simple-reply:v8:cv
      %+  frond  -.r-reply
      ?-  -.r-reply
        %set    ?~(reply.r-reply ~ (simple-reply u.reply.r-reply))
        %reacts  (reacts reacts.r-reply)
      ==
    ++  reply
      |=  [=reply-seal:v8:cv [rev=@ud =memo:v8:cv]]
      %-  pairs
      :~  seal+(^reply-seal reply-seal)
          revision+s+(scot %ud rev)
          memo+(^memo memo)
      ==
    --
  ++  v7
    |%
    ::
    ++  r-channels
      |=  [=nest:cv =r-channel:v7:cv]
      %-  pairs
      :~  nest+(^nest nest)
          response+(^r-channel r-channel)
      ==
    ::
    ++  r-channel
      |=  =r-channel:v7:cv
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
      |=  =r-post:v7:cv
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
      |=  =r-reply:v7:cv
      %+  frond  -.r-reply
      ?-  -.r-reply
        %set    ?~(reply.r-reply ~ (reply u.reply.r-reply))
        %reacts  (reacts reacts.r-reply)
      ==
    ::
    ++  pending-msgs
      |=  pm=pending-messages:v7:cv
      %-  pairs
      :~  posts+(pending-posts posts.pm)
          replies+(pending-replies replies.pm)
      ==
    ::
    ++  pending-posts
      |=  pp=pending-posts:v7:cv
      %-  pairs
      %+  turn  ~(tap by pp)
      |=  [cid=client-id:v7:cv es=essay:v7:cv]
      [(client-id-string cid) (essay es)]
    ::
    ++  pending-replies
      |=  pr=pending-replies:v7:cv
      =/  replies
        %+  roll  ~(tap by pr)
        |=  $:  [[top=id-post:cv cid=client-id:v7:cv] mem=memo:v7:cv]
                rs=(map id-post:cv (map client-id:v7:cv memo:v7:cv))
            ==
        ?.  (~(has by rs) top)  (~(put by rs) top (malt ~[[cid mem]]))
        %+  ~(jab by rs)  top
        |=  mems=(map client-id:v7:cv memo:v7:cv)
        (~(put by mems) cid mem)
      %-  pairs
      %+  turn  ~(tap by replies)
      |=  [top=id-post:cv rs=(map client-id:v7:cv memo:v7:cv)]
      :-  (rsh 4 (scot %ui top))
      %-  pairs
      %+  turn  ~(tap by rs)
      |=  [cid=client-id:v7:cv mem=memo:v7:cv]
      [(client-id-string cid) (memo mem)]
    ::
    ++  pending
      |=  =r-channel:v7:cv
      ?>  ?=([%pending *] r-channel)
      %-  pairs
      :~  id+(client-id id.r-channel)
          pending+(r-pending r-pending.r-channel)
      ==
    ++  r-pending
      |=  =r-pending:v7:cv
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
      |=  =channels:v7:cv
      %-  pairs
      %+  turn  ~(tap by channels)
      |=  [n=nest:cv ca=channel:v7:cv]
      [(nest-cord n) (channel ca)]
    ::
    ++  channel
      |=  =channel:v7:cv
      %-  pairs
      :~  posts+(posts posts.channel)
          order+(order order.channel)
          view+s+view.channel
          sort+s+sort.channel
          perms+(perm perm.channel)
          pending+(pending-msgs pending.channel)
      ==
    ++  perm
      |=  p=perm:v7:cv
      %-  pairs
      :~  writers/a/(turn ~(tap in writers.p) (lead %s))
          group/(flag group.p)
      ==
    ::
    ++  paged-posts
      |=  pn=paged-posts:v7:cv
      %-  pairs
      :~  posts+(posts posts.pn)
          newer+?~(newer.pn ~ (id u.newer.pn))
          older+?~(older.pn ~ (id u.older.pn))
          total+(numb total.pn)
      ==
    ++  posts
      |=  =posts:v7:cv
      %-  pairs
      %+  turn  (tap:on-posts:v7:cv posts)
      |=  [id=id-post:cv post=(unit post:v7:cv)]
      [(scot %ud id) ?~(post ~ (^post u.post))]
    ::
    ++  post
      |=  [=seal:v7:cv [rev=@ud =essay:v7:cv]]
      %-  pairs
      :~  seal+(^seal seal)
          revision+s+(scot %ud rev)
          essay+(^essay essay)
          type+s+%post
      ==
    ::
    ++  seal
      |=  =seal:v7:cv
      %-  pairs
      :~  id+(id id.seal)
          reacts+(reacts reacts.seal)
          replies+(replies replies.seal)
          meta+(reply-meta reply-meta.seal)
      ==
    ::
    ++  essay
      |=  =essay:v7:cv
      %-  pairs
      :~  content+(story:enjs:sj content.essay)
          author+(ship author.essay)
          sent+(time sent.essay)
          kind-data+(kind-data kind-data.essay)
      ==
    ::
    ++  kind-data
      |=  =kind-data:v7:cv
      %+  frond  -.kind-data
      ?-    -.kind-data
        %heap   ?~(title.kind-data ~ s+u.title.kind-data)
        %chat   ?~(kind.kind-data ~ (pairs notice+~ ~))
        %diary  (pairs title+s+title.kind-data image+s+image.kind-data ~)
      ==
    ::
    ++  channel-heads
      |=  heads=channel-heads:v7:cv
      :-  %a
      %+  turn  heads
      |=  [=nest:cv recency=^time latest=(unit post:v7:cv)]
      %-  pairs
      :~  nest+(^nest nest)
          recency+(time recency)
          latest+?~(latest ~ (post u.latest))
      ==
    ::
    ++  reacts
      |=  =reacts:v7:cv
      ^-  json
      %-  pairs
      %+  turn  ~(tap by reacts)
      |=  [her=@p =react:v7:cv]
      [(scot %p her) s+react]
    ::
    ++  replies
      |=  =replies:v7:cv
      %-  pairs
      %+  turn  (tap:on-replies:v7:cv replies)
      |=  [t=@da reply=(unit reply:v7:cv)]
      [(scot %ud t) ?~(reply ~ (^reply u.reply))]
    ::
    ++  reply
      |=  [=reply-seal:v7:cv [rev=@ud =memo:v7:cv]]
      %-  pairs
      :~  seal+(^reply-seal reply-seal)
          revision+s+(scot %ud rev)
          memo+(^memo memo)
      ==
    ::
    ++  reply-seal
      |=  =reply-seal:v7:cv
      %-  pairs
      :~  id+(id id.reply-seal)
          parent-id+(id parent-id.reply-seal)
          reacts+(reacts reacts.reply-seal)
      ==
    ::
    ++  r-channels-simple-post
      |=  [=nest:cv =r-channel-simple-post:v7:cv]
      %-  pairs
      :~  nest+(^nest nest)
          response+(^r-channel-simple-post r-channel-simple-post)
      ==
    ::
    ++  r-simple-post
      |=  r-post=r-simple-post:v7:cv
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
      |=  r-reply=r-simple-reply:v7:cv
      %+  frond  -.r-reply
      ?-  -.r-reply
        %set    ?~(reply.r-reply ~ (simple-reply u.reply.r-reply))
        %reacts  (reacts reacts.r-reply)
      ==
    ::
    ++  simple-posts
      |=  posts=simple-posts:v7:cv
      %-  pairs
      %+  turn  (tap:on-simple-posts:v7:cv posts)
      |=  [id=id-post:cv post=(unit simple-post:v7:cv)]
      [(scot %ud id) ?~(post ~ (simple-post u.post))]
    ::
    ++  simple-post
      |=  [seal=simple-seal:v7:cv =essay:v7:cv]
      %-  pairs
      :~  seal+(simple-seal seal)
          essay+(^essay essay)
          type+s+%post
      ==
    ++  simple-seal
      |=  seal=simple-seal:v7:cv
      %-  pairs
      :~  id+(id id.seal)
          reacts+(reacts reacts.seal)
          replies+(simple-replies replies.seal)
          meta+(reply-meta reply-meta.seal)
      ==
    ++  paged-simple-posts
      |=  pn=paged-simple-posts:v7:cv
      %-  pairs
      :~  posts+(simple-posts posts.pn)
          newer+?~(newer.pn ~ (id u.newer.pn))
          older+?~(older.pn ~ (id u.older.pn))
          total+(numb total.pn)
      ==
    ++  simple-replies
      |=  replies=simple-replies:v7:cv
      %-  pairs
      %+  turn  (tap:on-simple-replies:v7:cv replies)
      |=  [t=@da reply=simple-reply:v7:cv]
      [(scot %ud t) (simple-reply reply)]
    ++  r-channel-simple-post
      |=  r-channel=r-channel-simple-post:v7:cv
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
      |=  =reference:v7:cv
      %+  frond  -.reference
      ?-    -.reference
          %post  (simple-post post.reference)
          %reply
        %-  pairs
        :~  id-post+(id id-post.reference)
            reply+(simple-reply reply.reference)
        ==
      ==
    ++  simple-reply
      |=  reply=simple-reply:v7:cv
      %-  pairs
      :~  seal+(reply-seal -.reply)
          memo+(memo +.reply)
      ==
    ::
    ++  said
      |=  s=said:v7:cv
      ^-  json
      %-  pairs
      :~  nest/(nest p.s)
          reference/(reference q.s)
      ==
    ::
    ++  reply-meta
      |=  r=reply-meta:v7:cv
      %-  pairs
      :~  'replyCount'^(numb reply-count.r)
          'lastReply'^?~(last-reply.r ~ (time u.last-reply.r))
          'lastRepliers'^a/(turn ~(tap in last-repliers.r) ship)
      ==
    ::
    ++  memo
      |=  m=memo:v7:cv
      ^-  json
      %-  pairs
      :~  content/(story:enjs:sj content.m)
          author/(ship author.m)
          sent/(time sent.m)
      ==
    --
  ++  v1
    |%
    ++  channels
      |=  =channels:v1:cv
      %-  pairs
      %+  turn  ~(tap by channels)
      |=  [n=nest:cv ca=channel:v1:cv]
      [(nest-cord n) (channel ca)]
    ::
    ++  channel
      |=  =channel:v1:cv
      %-  pairs
      :~  posts+(posts posts.channel)
          order+(order order.channel)
          view+s+view.channel
          sort+s+sort.channel
          perms+(perm perm.channel)
          pending+(pending-msgs pending.channel)
      ==
    ++  perm
      |=  p=perm:v1:cv
      %-  pairs
      :~  writers/a/(turn ~(tap in writers.p) (lead %s))
          group/(flag group.p)
      ==
    ::
    ++  pending-msgs
      |=  pm=pending-messages:v1:cv
      %-  pairs
      :~  posts+(pending-posts posts.pm)
          replies+(pending-replies replies.pm)
      ==
    ::
    ++  pending-posts
      |=  pp=pending-posts:v1:cv
      %-  pairs
      %+  turn  ~(tap by pp)
      |=  [cid=client-id:v1:cv es=essay:v1:cv]
      [(client-id-string cid) (essay es)]
    ::
    ++  essay
      |=  =essay:v1:cv
      %-  pairs
      :~  content+(story:enjs:sj content.essay)
          author+(ship author.essay)
          sent+(time sent.essay)
          kind-data+(kind-data kind-data.essay)
      ==
    ++  memo
      |=  m=memo:v1:cv
      ^-  json
      %-  pairs
      :~  content/(story:enjs:sj content.m)
          author/(ship author.m)
          sent/(time sent.m)
      ==
    ::
    ++  kind-data
      |=  =kind-data:v1:cv
      %+  frond  -.kind-data
      ?-    -.kind-data
        %heap   ?~(title.kind-data ~ s+u.title.kind-data)
        %chat   ?~(kind.kind-data ~ (pairs notice+~ ~))
        %diary  (pairs title+s+title.kind-data image+s+image.kind-data ~)
      ==
    ::
    ++  pending-replies
      |=  pr=pending-replies:v1:cv
      =/  replies
        %+  roll  ~(tap by pr)
        |=  $:  [[top=id-post:cv cid=client-id:v1:cv] mem=memo:v1:cv]
                rs=(map id-post:cv (map client-id:v1:cv memo:v1:cv))
            ==
        ?.  (~(has by rs) top)  (~(put by rs) top (malt ~[[cid mem]]))
        %+  ~(jab by rs)  top
        |=  mems=(map client-id:v1:cv memo:v1:cv)
        (~(put by mems) cid mem)
      %-  pairs
      %+  turn  ~(tap by replies)
      |=  [top=id-post:cv rs=(map client-id:v1:cv memo:v1:cv)]
      :-  (rsh 4 (scot %ui top))
      %-  pairs
      %+  turn  ~(tap by rs)
      |=  [cid=client-id:v1:cv mem=memo:v1:cv]
      [(client-id-string cid) (memo mem)]
    ::
    ++  paged-posts
      |=  pn=paged-posts:v1:cv
      %-  pairs
      :~  posts+(posts posts.pn)
          newer+?~(newer.pn ~ (id u.newer.pn))
          older+?~(older.pn ~ (id u.older.pn))
          total+(numb total.pn)
      ==
    ::
    ++  posts
      |=  =posts:v1:cv
      %-  pairs
      %+  turn  (tap:on-posts:v1:cv posts)
      |=  [id=id-post:cv post=(unit post:v1:cv)]
      [(scot %ud id) ?~(post ~ (^post u.post))]
    ::
    ++  seal
      |=  =seal:v1:cv
      %-  pairs
      :~  id+(id id.seal)
          reacts+(reacts reacts.seal)
          replies+(replies replies.seal)
          meta+(reply-meta reply-meta.seal)
      ==
    ++  reply-meta
      |=  r=reply-meta:v7:cv
      %-  pairs
      :~  'replyCount'^(numb reply-count.r)
          'lastReply'^?~(last-reply.r ~ (time u.last-reply.r))
          'lastRepliers'^a/(turn ~(tap in last-repliers.r) ship)
      ==
    ++  reacts
      |=  =reacts:v7:cv
      ^-  json
      %-  pairs
      %+  turn  ~(tap by reacts)
      |=  [her=@p =react:v7:cv]
      [(scot %p her) s+react]
    ++  post
      |=  [=seal:v1:cv [rev=@ud =essay:v7:cv]]
      %-  pairs
      :~  seal+(^seal seal)
          revision+s+(scot %ud rev)
          essay+(essay:v7 essay)
          type+s+%post
      ==
    ++  simple-post  simple-post:v7
    ++  replies
      |=  =replies:v1:cv
      %-  pairs
      %+  turn  (tap:on-replies:v1:cv replies)
      |=  [t=@da =reply:v7:cv]
      [(scot %ud t) (reply:v7 reply)]
    --
  ::
  ++  v0
    =,  v7
    |%
    ::
    ++  channels
      |=  channels=channels-0:v7:cv
      %-  pairs
      %+  turn  ~(tap by channels)
      |=  [n=nest:cv ca=channel-0:v7:cv]
      [(nest-cord n) (channel ca)]
    ::
    ++  channel
      |=  channel=channel-0:v7:cv
      %-  pairs
      :~  posts+(posts posts.channel)
          order+(order order.channel)
          view+s+view.channel
          sort+s+sort.channel
          perms+(perm perm.channel)
      ==
    ::
    ++  posts
      |=  =posts:v7:cv
      %-  pairs
      %+  turn  (tap:on-posts:v7:cv posts)
      |=  [id=id-post:cv post=(unit post:v7:cv)]
      [(scot %ud id) ?~(post ~ (^post u.post))]
    ::
    ++  post
      |=  [=seal:v7:cv [rev=@ud =essay:v7:cv]]
      %-  pairs
      :~  seal+(^seal seal)
          revision+s+(scot %ud rev)
          essay+(essay:v7 essay)
          type+s+%post
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
    ^-  $-(json a-channels:v9:cv)
    %-  of
    :~  create+create-channel
        pin+(ar nest)
        channel+(ot nest+nest action+a-channel ~)
        toggle-post+post-toggle
    ==
  ++  a-channel
    ^-  $-(json a-channel:v9:cv)
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
    ^-  $-(json react:v9:cv)
    |=  =json
    ?:  ?=(%s -.json)  p.json
    ((of any+so ~) json)
  ::
  ++  a-post
    ^-  $-(json a-post:v9:cv)
    %-  of
    :~  add+essay
        edit+(ot id+id essay+essay ~)
        del+id
        reply+(ot id+id action+a-reply ~)
        add-react+(ot id+id ship+ship react+react ~)
        del-react+(ot id+id ship+ship ~)
    ==

  ++  a-reply
    ^-  $-(json a-reply:v9:cv)
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
    ^-  author:v9:cv
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
    ^-  $-(json essay:v9:cv)
    %+  cu
      |=  $:  =story:s  =author:v9:cv  =time:z
              kind=path  meta=(unit data:^^meta)  blob=(unit @t)
          ==
      `essay:v9:cv`[[story author time] kind meta blob]
    %-  ot
    :~  content/story:dejs:sj
        author/author
        sent/di
        ::
        kind/pa
        meta/(mu meta)
        blob/(mu so)
    ==
  ++  create-channel
    ^-  $-(json create-channel:v9:cv)
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
  :: +|  %old
  ::
  ++  v7
    |%
    ++  a-channels
      ^-  $-(json a-channels:v7:cv)
      %-  of
      :~  create+create-channel
          pin+(ar nest)
          channel+(ot nest+nest action+a-channel ~)
          toggle-post+post-toggle
      ==
    ++  create-channel
      ^-  $-(json create-channel:v7:cv)
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
      ^-  $-(json a-channel:v7:cv)
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
      ^-  $-(json essay:v7:cv)
      %+  cu
        |=  [=story:v7:cv =ship:z =time:z =kind-data:v7:cv]
        `essay:v7:cv`[[story ship time] kind-data]
      %-  ot
      :~  content/story:v0:dejs:sj
          author/ship
          sent/di
          kind-data/kind-data
      ==
    ++  kind-data
      ^-  $-(json kind-data:v7:cv)
      %-  of
      :~  diary+(ot title+so image+so ~)
          heap+(mu so)
          chat+chat-kind
      ==
    ::
    ++  a-post
      ^-  $-(json a-post:v7:cv)
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
      ^-  $-(json a-reply:v7:cv)
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
  ++  kind  `$-(json kind:cv)`(su han-rule)
  ++  flag  `$-(json flag:gv)`(su flag-rule)
  ++  nest  `$-(json nest:cv)`(su nest-rule)
  ++  ship-rule  ;~(pfix sig fed:ag)
  ++  han-rule   (sear (soft kind:cv) sym)
  ++  flag-rule  ;~((glue fas) ship-rule sym)
  ++  nest-rule  ;~((glue fas) han-rule ship-rule sym)
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
    ^-  $-(json post-toggle:cv)
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
