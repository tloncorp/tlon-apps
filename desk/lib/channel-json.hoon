/-  j=joint, d=channel, g=groups
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
    |=  [=nest:d =r-channel:d]
    %-  pairs
    :~  nest+(^nest nest)
        response+(^r-channel r-channel)
    ==
  ::
  ++  r-channel
    |=  =r-channel:d
    %+  frond  -.r-channel
    ?-  -.r-channel
      %posts   (posts posts.r-channel)
      %post    (pairs id+(id id.r-channel) r-post+(r-post r-post.r-channel) ~)
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
    |=  =r-post:d
    %+  frond  -.r-post
    ?-  -.r-post
      %set    ?~(post.r-post ~ (post u.post.r-post))
      %feels  (feels feels.r-post)
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
    |=  =r-reply:d
    %+  frond  -.r-reply
    ?-  -.r-reply
      %set    ?~(reply.r-reply ~ (reply u.reply.r-reply))
      %feels  (feels feels.r-reply)
    ==
  ::
  ++  paged-posts
    |=  pn=paged-posts:d
    %-  pairs
    :~  posts+(posts posts.pn)
        newer+?~(newer.pn ~ (id u.newer.pn))
        older+?~(older.pn ~ (id u.older.pn))
        total+(numb total.pn)
    ==
  +|  %rr
  ::
  ++  channels
    |=  =channels:d
    %-  pairs
    %+  turn  ~(tap by channels)
    |=  [n=nest:d ca=channel:d]
    [(nest-cord n) (channel ca)]
  ::
  ++  channel
    |=  =channel:d
    %-  pairs
    :~  posts+(posts posts.channel)
        order+(order order.channel)
        view+s+view.channel
        sort+s+sort.channel
        perms+(perm perm.channel)
    ==
  ::
  ++  posts
    |=  =posts:d
    %-  pairs
    %+  turn  (tap:on-posts:d posts)
    |=  [id=id-post:d post=(unit post:d)]
    [(scot %ud id) ?~(post ~ (^post u.post))]
  ::
  ++  post
    |=  [=rr-seal:d =essay:d]
    %-  pairs
    :~  seal+(^rr-seal rr-seal)
        essay+(^essay essay)
        type+s+%post
    ==
  ::
  ++  replies
    |=  =replies:d
    %-  pairs
    %+  turn  (tap:on-replies:d replies)
    |=  [t=@da =reply:d]
    [(scot %ud t) (^reply reply)]
  ::
  ++  reply
    |=  [=rr-cork:d =memo:d]
    %-  pairs
    :~  cork+(^rr-cork rr-cork)
        memo+(^memo memo)
    ==
  ::
  ++  rr-seal
    |=  =rr-seal:d
    %-  pairs
    :~  id+(id id.rr-seal)
        feels+(feels rr-feels.rr-seal)
        replies+(replies replies.rr-seal)
        meta+(reply-meta reply-meta.rr-seal)
    ==
  ::
  ++  rr-cork
    |=  =rr-cork:d
    %-  pairs
    :~  id+(id id.rr-cork)
        parent-id+(id parent-id.rr-cork)
        feels+(feels rr-feels.rr-cork)
    ==
  ::
  +|  %primitives
  ::
  ++  v-channel
    |=  ca=v-channel:d
    %-  pairs
    :~  order+(order order.order.ca)
        perms+(perm perm.perm.ca)
        view+s+view.view.ca
        sort+s+sort.sort.ca
    ==
  ::
  ++  id
    |=  =@da
    s+`@t`(rsh 4 (scot %ui da))
  ::
  ++  flag
    |=  f=flag:g
    ^-  json
    s/(rap 3 (scot %p p.f) '/' q.f ~)
  ::
  ++  nest
    |=  n=nest:d
    ^-  json
    s/(nest-cord n)
  ::
  ++  nest-cord
    |=  n=nest:d
    ^-  cord
    (rap 3 kind.n '/' (scot %p ship.n) '/' name.n ~)
  ::
  ++  ship
    |=  her=@p
    n+(rap 3 '"' (scot %p her) '"' ~)
  ::
  ++  order
    |=  a=arranged-posts:d
    :-  %a
    =/  times=(list time:z)  ?~(a ~ u.a)
    (turn times id)
  ::
  ++  perm
    |=  p=perm:d
    %-  pairs
    :~  writers/a/(turn ~(tap in writers.p) (lead %s))
        group/(flag group.p)
    ==
  ::
  ++  feels
    |=  feels=(map ship:z feel:j)
    ^-  json
    %-  pairs
    %+  turn  ~(tap by feels)
    |=  [her=@p =feel:j]
    [(scot %p her) s+feel]
  ::
  ++  essay
    |=  =essay:d
    %-  pairs
    :~  content+(story content.essay)
        author+(ship author.essay)
        sent+(time sent.essay)
        kind-data+(kind-data kind-data.essay)
    ==
  ::
  ++  kind-data
    |=  =kind-data:d
    %+  frond  -.kind-data
    ?-    -.kind-data
      %heap   ?~(title.kind-data ~ s+u.title.kind-data)
      %chat   ?~(kind.kind-data ~ (pairs notice+~ ~))
      %diary  (pairs title+s+title.kind-data image+s+image.kind-data ~)
    ==
  ::
  ++  reply-meta
    |=  r=reply-meta:d
    %-  pairs
    :~  'replyCount'^(numb reply-count.r)
        'lastReply'^?~(last-reply.r ~ (time u.last-reply.r))
        'lastRepliers'^a/(turn ~(tap in last-repliers.r) ship)
    ==
  ::
  ++  verse
    |=  =verse:d
    ^-  json
    %+  frond  -.verse
    ?-  -.verse
        %block  (block p.verse)
        %inline  a+(turn p.verse inline)
    ==
  ++  block
    |=  b=block:d
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
    |=  l=listing:d
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
    |=  i=inline:d
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
    |=  s=story:d
    ^-  json
    a+(turn s verse)
  ::
  ++  memo
    |=  m=memo:d
    ^-  json
    %-  pairs
    :~  content/(story content.m)
        author/(ship author.m)
        sent/(time sent.m)
    ==
  ::
  +|  %briefs
  ::
  ++  briefs
    |=  bs=briefs:d
    %-  pairs
    %+  turn  ~(tap by bs)
    |=  [n=nest:d b=brief:d]
    [(nest-cord n) (brief b)]
  ::
  ++  brief-update
    |=  u=(pair nest:d brief:d)
    %-  pairs
    :~  nest/(nest p.u)
        brief/(brief q.u)
    ==
  ::
  ++  brief
    |=  b=brief:d
    %-  pairs
    :~  last/(id last.b)
        count/(numb count.b)
        read-id/?~(read-id.b ~ (id u.read-id.b))
    ==
  ::
  ++  pins
    |=  ps=(list nest:d)
    %-  pairs
    :~  pins/a/(turn ps nest)
    ==
  ::
  +|  %said
  ::
  ++  reference
    |=  =reference:d
    %+  frond  -.reference
    ?-    -.reference
        %post  (post post.reference)
        %reply
      %-  pairs
      :~  id-post+(id id-post.reference)
          reply+(reply reply.reference)
      ==
    ==
  ::
  ++  said
    |=  s=said:d
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
    ^-  $-(json a-channels:d)
    %-  of
    :~  create+create-channel
        pin+(ar nest)
        channel+(ot nest+nest action+a-channel ~)
    ==
  ++  a-channel
    ^-  $-(json a-channel:d)
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
    ^-  $-(json a-post:d)
    %-  of
    :~  add+essay
        edit+(ot id+id essay+essay ~)
        del+id
        reply+(ot id+id action+a-reply ~)
        add-feel+(ot id+id ship+ship feel+so ~)
        del-feel+(ot id+id ship+ship ~)
    ==
  ::
  ++  a-reply
    ^-  $-(json a-reply:d)
    %-  of
    :~  add+memo
        del+id
        add-feel+(ot id+id ship+ship feel+so ~)
        del-feel+(ot id+id ship+ship ~)
    ==
  ::
  +|  %primitives
  ++  id    (se %ud)
  ++  ship  `$-(json ship:z)`(su ship-rule)
  ++  kind  `$-(json kind:d)`(su han-rule)
  ++  flag  `$-(json flag:g)`(su flag-rule)
  ++  nest  `$-(json nest:d)`(su nest-rule)
  ++  ship-rule  ;~(pfix sig fed:ag)
  ++  han-rule   (sear (soft kind:d) sym)
  ++  flag-rule  ;~((glue fas) ship-rule sym)
  ++  nest-rule  ;~((glue fas) han-rule ship-rule sym)
  ::
  ++  create-channel
    ^-  $-(json create-channel:d)
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
    ^-  $-(json essay:d)
    %+  cu
      |=  [=story:d =ship:z =time:z =kind-data:d]
      `essay:d`[[story ship time] kind-data]
    %-  ot
    :~  content/story
        author/ship
        sent/di
        kind-data/kind-data
    ==
  ::
  ++  kind-data
    ^-  $-(json kind-data:d)
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
    ^-  $-(json verse:d)
    %-  of
    :~  block/block
        inline/(ar inline)
    ==
  ::
  ++  block
    |=  j=json
    ^-  block:d
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
    ^-  listing:d
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
    ^-  inline:d
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
  --
--
