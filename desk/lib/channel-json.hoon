/-  j=joint, c=channels, g=groups
/-  meta
/+  cite=cite-json, gj=groups-json
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
  ++  r-simple-post
    |=  r-post=r-simple-post:c
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
  ++  r-reply
    |=  =r-reply:c
    %+  frond  -.r-reply
    ?-  -.r-reply
      %set    ?~(reply.r-reply ~ (reply u.reply.r-reply))
      %reacts  (reacts reacts.r-reply)
    ==
  ::
  ++  r-simple-reply
    |=  r-reply=r-simple-reply:c
    %+  frond  -.r-reply
    ?-  -.r-reply
      %set    ?~(reply.r-reply ~ (simple-reply u.reply.r-reply))
      %reacts  (reacts reacts.r-reply)
    ==
  ::
  ++  channel-heads
    |=  heads=channel-heads:c
    :-  %a
    %+  turn  heads
    |=  [=nest:c recency=^time latest=(unit post:c)]
    %-  pairs
    :~  nest+(^nest nest)
        recency+(time recency)
        latest+?~(latest ~ (post u.latest))
    ==
  ::
  ++  paged-posts
    |=  pn=paged-posts:c
    %-  pairs
    :~  posts+(posts posts.pn)
        newer+?~(newer.pn ~ (id u.newer.pn))
        older+?~(older.pn ~ (id u.older.pn))
        total+(numb total.pn)
    ==
  ++  paged-simple-posts
    |=  pn=paged-simple-posts:c
    %-  pairs
    :~  posts+(simple-posts posts.pn)
        newer+?~(newer.pn ~ (id u.newer.pn))
        older+?~(older.pn ~ (id u.older.pn))
        total+(numb total.pn)
    ==
  +|  %rr
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
  ++  channels-2
    |=  =channels:c
    %-  pairs
    %+  turn  ~(tap by channels)
    |=  [n=nest:c ca=channel:c]
    [(nest-cord n) (channel-2 ca)]
  ::
  ++  channel-2
    |=  =channel:c
    %-  pairs
    :~  posts+(posts posts.channel)
        order+(order order.channel)
        view+s+view.channel
        sort+s+sort.channel
        perms+(perm perm.channel)
        pending+(pending-msgs pending.channel)
    ==
  ::
  ++  posts
    |=  =posts:c
    %-  pairs
    %+  turn  (tap:on-posts:c posts)
    |=  [id=id-post:c post=(unit post:c)]
    [(scot %ud id) ?~(post ~ (^post u.post))]
  ::
  ++  post
    |=  [=seal:c [rev=@ud =essay:c]]
    %-  pairs
    :~  seal+(^seal seal)
        revision+s+(scot %ud rev)
        essay+(^essay essay)
        type+s+%post
    ==
  ::
  ++  simple-posts
    |=  posts=simple-posts:c
    %-  pairs
    %+  turn  (tap:on-simple-posts:c posts)
    |=  [id=id-post:c post=(unit simple-post:c)]
    [(scot %ud id) ?~(post ~ (simple-post u.post))]
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
    |=  [t=@da =reply:c]
    [(scot %ud t) (^reply reply)]
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
  ++  v-channel
    |=  ca=v-channel:c
    %-  pairs
    :~  order+(order order.order.ca)
        perms+(perm perm.perm.ca)
        view+s+view.view.ca
        sort+s+sort.sort.ca
        pending+(pending-msgs pending.ca)
    ==
  ::
  ++  id
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
  ++  reacts
    |=  reacts=(map ship:z react:j)
    ^-  json
    %-  pairs
    %+  turn  ~(tap by reacts)
    |=  [her=@p =react:j]
    [(scot %p her) s+react]
  ::
  ++  essay
    |=  =essay:c
    %-  pairs
    :~  content+(story content.essay)
        author+(ship author.essay)
        sent+(time sent.essay)
        kind-data+(kind-data kind-data.essay)
    ==
  ::
  ++  kind-data
    |=  =kind-data:c
    %+  frond  -.kind-data
    ?-    -.kind-data
      %heap   ?~(title.kind-data ~ s+u.title.kind-data)
      %chat   ?~(kind.kind-data ~ (pairs notice+~ ~))
      %diary  (pairs title+s+title.kind-data image+s+image.kind-data ~)
    ==
  ::
  ++  reply-meta
    |=  r=reply-meta:c
    %-  pairs
    :~  'replyCount'^(numb reply-count.r)
        'lastReply'^?~(last-reply.r ~ (time u.last-reply.r))
        'lastRepliers'^a/(turn ~(tap in last-repliers.r) ship)
    ==
  ::
  ++  verse
    |=  =verse:c
    ^-  json
    %+  frond  -.verse
    ?-  -.verse
        %block  (block p.verse)
        %inline  a+(turn p.verse inline)
    ==
  ++  block
    |=  b=block:c
    ^-  json
    %+  frond  -.b
    ?-  -.b
        %rule  ~
        %cite  (enjs:cite cite.b)
        %listing  (listing p.b)
        %header
      %-  pairs
      :~  tag+s+p.b
          content+a+(turn q.b inline)
      ==
        %image
      %-  pairs
      :~  src+s+src.b
          height+(numb height.b)
          width+(numb width.b)
          alt+s+alt.b
      ==
        %code
      %-  pairs
      :~  code+s+code.b
          lang+s+lang.b
      ==
    ==
  ::
  ++  listing
    |=  l=listing:c
    ^-  json
    %+  frond  -.l
    ?-  -.l
        %item  a+(turn p.l inline)
        %list
      %-  pairs
      :~  type+s+p.l
          items+a+(turn q.l listing)
          contents+a+(turn r.l inline)
      ==
    ==
  ::
  ++  inline
    |=  i=inline:c
    ^-  json
    ?@  i  s+i
    %+  frond  -.i
    ?-  -.i
        %break
      ~
    ::
        %ship  s/(scot %p p.i)
    ::
        ?(%code %tag %inline-code)
      s+p.i
    ::
        ?(%italics %bold %strike %blockquote)
      :-  %a
      (turn p.i inline)
    ::
        %block
      %-  pairs
      :~  index+(numb p.i)
          text+s+q.i
      ==
    ::
        %link
      %-  pairs
      :~  href+s+p.i
          content+s+q.i
      ==
        %task
      %-  pairs
      :~  checked+b+p.i
          content+a+(turn q.i inline)
      ==
    ==
  ::
  ++  story
    |=  s=story:c
    ^-  json
    a+(turn s verse)
  ::
  ++  memo
    |=  m=memo:c
    ^-  json
    %-  pairs
    :~  content/(story content.m)
        author/(ship author.m)
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
        %post  (simple-post post.reference)
        %reply
      %-  pairs
      :~  id-post+(id id-post.reference)
          reply+(simple-reply reply.reference)
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
        post+a-post
        view+(su (perk %grid %list ~))
        sort+(su (perk %time %alpha %arranged ~))
        order+(mu (ar id))
        add-writers+add-sects
        del-writers+del-sects
    ==
  ::
  ++  a-post
    ^-  $-(json a-post:c)
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
    ^-  $-(json a-reply:c)
    %-  of
    :~  add+memo
        del+id
        edit+(ot id+id memo+memo ~)
        add-react+(ot id+id ship+ship react+so ~)
        del-react+(ot id+id ship+ship ~)
    ==
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
        readers+(as (se %tas))
        writers+(as (se %tas))
    ==
  ::
  ++  add-sects  (as (se %tas))
  ++  del-sects  (as so)
  ::
  ++  story  (ar verse)
  ++  essay
    ^-  $-(json essay:c)
    %+  cu
      |=  [=story:c =ship:z =time:z =kind-data:c]
      `essay:c`[[story ship time] kind-data]
    %-  ot
    :~  content/story
        author/ship
        sent/di
        kind-data/kind-data
    ==
  ::
  ++  kind-data
    ^-  $-(json kind-data:c)
    %-  of
    :~  diary+(ot title+so image+so ~)
        heap+(mu so)
        chat+chat-kind
    ==
  ::
  ++  chat-kind
    ^-  $-(json $@(~ [%notice ~]))
    |=  jon=json
    ?~  jon  ~
    ((of notice+ul ~) jon)
  ::
  ++  verse
    ^-  $-(json verse:c)
    %-  of
    :~  block/block
        inline/(ar inline)
    ==
  ::
  ++  block
    |=  j=json
    ^-  block:c
    %.  j
    %-  of
    :~  rule/ul
        cite/dejs:cite
        listing/listing
    ::
      :-  %code
      %-  ot
      :~  code/so
          lang/(se %tas)
      ==
    ::
      :-  %header
      %-  ot
      :~  tag/(su (perk %h1 %h2 %h3 %h4 %h5 %h6 ~))
          content/(ar inline)
      ==
    ::
      :-  %image
      %-  ot
      :~  src/so
          height/ni
          width/ni
          alt/so
      ==
    ==
  ::
  ++  listing
    |=  j=json
    ^-  listing:c
    %.  j
    %-  of
    :~
      item/(ar inline)
      :-  %list
      %-  ot
      :~  type/(su (perk %ordered %unordered %tasklist ~))
          items/(ar listing)
          contents/(ar inline)
      ==
    ==
  ::
  ++  inline
    |=  j=json
    ^-  inline:c
    ?:  ?=([%s *] j)  p.j
    =>  .(j `json`j)
    %.  j
    %-  of
    :~  italics/(ar inline)
        bold/(ar inline)
        strike/(ar inline)
        blockquote/(ar inline)
        ship/ship
        inline-code/so
        code/so
        tag/so
        break/ul
    ::
      :-  %block
      %-  ot
      :~  index/ni
          text/so
      ==
    ::
      :-  %link
      %-  ot
      :~  href/so
          content/so
      ==
    ==
  ::
  ++  memo
    %-  ot
    :~  content/story
        author/ship
        sent/di
    ==
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
  --
--
