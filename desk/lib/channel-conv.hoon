::  channel conversion functions
/-  c=channels, m=meta
/+  em=emojimart
|%
++  v9
  |%
  ++  v-channels
    |%
    ++  v8
      |=  vc=v-channels:v9:c
      ^-  v-channels:v8:c
      %-  ~(run by vc)
      |=  v=v-channel:v9:c
      ^-  v-channel:v8:c
      =/  nu-posts=v-posts:v8:c
        (v8:v-posts:v9 posts.v)
      =/  nu-log=log:v8:c
        (v8:log:v9 log.v)
      ::NOTE  .future unused at the time of migration
      v(posts nu-posts, log nu-log, future *future:v-channel:v8:c)
    --
  ++  v-posts
    |%
    ++  v8
      |=  vp=v-posts:v9:c
      ^-  v-posts:v8:c
      %-  ~(run by vp)
      |=  v=(may:v9:c v-post:v9:c)
      ^-  (unit v-post:v8:c)
      ?:  ?=(%| -.v)  ~
      `(v8:v-post:v9 +.v)
    --
  ++  v-post
    |%
    ++  v8
      |=  vp=v-post:v9:c
      ^-  v-post:v8:c
      vp(replies (v8:v-replies replies.vp))
    --
  ++  v-replies
    |%
    ++  v8
      |=  vr=v-replies:v9:c
      ^-  v-replies:v8:c
      %-  ~(run by vr)
      |=  v=(may:v9:c v-reply:v9:c)
      ^-  (unit v-reply:v8:c)
      ?:(?=(%| -.v) ~ `+.v)
    --
  ++  v-reply
    |%
    ++  v8
      |=  vr=v-reply:v9:c
      ^-  v-reply:v8:c
      vr
    --
  ++  posts
    |%
    ++  v8
      |=  =posts:v9:c
      ^-  posts:v8:c
      %-  ~(run by posts)
      |=  post=(may:v9:c post:v9:c)
      ^-  (unit post:v8:c)
      ?:  ?=(%| -.post)  ~
      `(v8:^post +.post)
    --
  ++  post
    |%
    ++  v8
      |=  =post:v9:c
      ^-  post:v8:c
      post(replies (v8:replies replies.post))
    ++  v7
      |=  =post:v9:c
      ^-  post:v7:c
      (v7:post:^v8 (v8 post))
    --
  ++  replies
    |%
    ++  v8
      |=  =replies:v9:c
      ^-  replies:v8:c
      %-  ~(run by replies)
      |=  reply=(may:v9:c reply:v9:c)
      ^-  (unit reply:v8:c)
      ?:(?=(%| -.reply) ~ `+.reply)
    --
  ++  log
    |%
    ++  v8
      |=  vl=log:v9:c
      ^-  log:v8:c
      %-  ~(run by vl)
      |=  update=u-channel:v9:c
      ^-  u-channel:v8:c
      ?+  -.update  update
          %post
        :-  %post
        :-  id.update
        ?+  -.u-post.update  u-post.update
            %set
          :-  %set
          ?:  ?=(%| -.post.u-post.update)  ~
          `(v8:v-post:v9 +.post.u-post.update)
        ::
            %reply
          :-  %reply
          :-  id.u-post.update
          ?:  ?=(%reacts -.u-reply.u-post.update)   u-reply.u-post.update
          :-  %set
          ?:  ?=(%| -.reply.u-reply.u-post.update)  ~
          `(v8:v-reply:v9 +.reply.u-reply.u-post.update)
        ==
      ==
    --
  ++  r-channels
    |%
    ++  v8
      |=  [=nest:c =r-channel:v9:c]
      ^-  r-channels:v8:c
      :-  nest
      ?+  -.r-channel  r-channel
        %posts  r-channel(posts (v8:posts posts.r-channel))
      ::
          %post
        :-  %post
        :-  id.r-channel
        =*  rp  r-post.r-channel
        ?+  -.rp  rp
            %set
          :-  %set
          ?:  ?=(%| -.post.rp)  ~
          `(v8:post +.post.rp)
        ::
            %reply
          ^-  r-post:v8:c
          %=  rp
              r-reply
            ?:  ?=(%reacts -.r-reply.rp)  r-reply.rp
            [%set ?:(?=(%| -.reply.r-reply.rp) ~ `+.reply.r-reply.rp)]
          ==
        ==
      ==
    --
  ++  said
    |%
    ++  v8
      |=  =said:v9:c
      ^-  said:v8:c
      said(q (v8:reference q.said))
    --
  ++  reference
    |%
    ++  v8
      |=  =reference:v9:c
      ^-  reference:v8:c
      ?:  ?=(%reply -.reference)
        :-  %reply
        :-  id-post.reference
        ?:  ?=(%| -.reply.reference)
          ^-  simple-reply:v8:c
          :-  [*@da *@da ~]
          [~[[%inline ['[deleted reply]']~]] [author del-at]:reply.reference]
        +.reply.reference
      :-  %post
      ?:  ?=(%| -.post.reference)
        ^-  simple-post:v8:c
        :-  [*@da ~ ~ 0 ~ ~]
        :_  [/ ~ ~]
        [~[[%inline ['[deleted post]']~]] [author del-at]:post.reference]
      =/  =simple-seal:v8:c
        :*  id.post.reference
            reacts.post.reference
            replies.post.reference
            reply-meta.post.reference
        ==
      ^-  simple-post:v8:c
      [simple-seal +>.post.reference]
    --
  ++  scan
    |%
    ++  v8
      |=  =scan:v9:c
      ^-  scan:v8:c
      (turn scan v8:reference)
    ++  v7
      |=  =scan:v9:c
      ^-  scan:v7:c
      (v7:scan:^v8 (v8 scan))
    --
  ++  scam
    |%
    ++  v8
      |=  =scam:v9:c
      ^-  scam:v8:c
      scam(scan (v8:scan scan.scam))
    ++  v7
      |=  =scam:v9:c
      ^-  scam:v7:c
      (v7:scam:^v8 (v8 scam))
    --
  --
++  v8
  |%
  ++  v-channels
    |%
    ++  v9
      |=  vc=v-channels:v8:c
      ^-  v-channels:v9:c
      %-  ~(run by vc)
      |=  v=v-channel:v8:c
      ^-  v-channel:v9:c
      =/  nu-posts=v-posts:v9:c
        (v9:v-posts:v8 posts.v)
      =^  nu-log=log:v9:c  nu-posts
        (v9:log:v8 log.v nu-posts)
      ::NOTE  .future unused at the time of migration
      v(posts nu-posts, log nu-log, future *future:v-channel:v9:c)
    --
  ++  v-posts
    |%
    ++  v9
      ::NOTE  bunts tombstones! must call +v9:log:v8 afterwards!
      |=  vp=v-posts:v8:c
      ^-  v-posts:v9:c
      %+  urn:mo-v-posts:v8:c  vp
      |=  [=id-post:v8:c post=(unit v-post:v8:c)]
      ^-  (may:v9:c v-post:v9:c)
      ?~  post
        [%| %*(. *tombstone:v9:c id id-post)]
      :-  %&
      u.post(replies (v9:v-replies:v8 replies.u.post))
    --
  ++  v-replies
    |%
    ++  v9
      |=  vr=v-replies:v8:c
      ^-  v-replies:v9:c
      %+  urn:mo-v-replies:v8:c  vr
      |=  [=id-reply:v8:c reply=(unit v-reply:v8:c)]
      ^-  (may:v9:c v-reply:v9:c)
      ?^  reply  [%& u.reply]
      [%| %*(. *tombstone:v9:c id id-reply)]
    --
  ++  log
    |%
    ++  v9  ::  puts tombstone info into .vp too
      |=  [l=log:v8:c vp=v-posts:v9:c]
      ^-  [log:v9:c _vp]
      |^  =+  do=(deep find-deleted-plans)
          =<  [log=+ vp]
          %-  (dyp:mo-log:v8:c u-channel:v9:c ,[=_vp =deets])
          [l [vp *deets] do]
      ::
      +$  deets
        (map plan:v9:c [=author:v9:c seq=@ud])
      ::
      ++  deep
        |=  deletions=(set plan:v9:c)
        |=  [[=_vp =deets] =time update=u-channel:v8:c]
        ^-  [(unit u-channel:v9:c) _vp _deets]
        ?+  update  [`update vp deets]
            [%post * %set ^]
          ::  creation: upgrade the update and store deets if we will care
          ::
          :+  %-  some
              =;  p=v-post:v9:c
                update(post.u-post &+p)
              %=  u.post.u-post.update
                replies  (v9:v-replies:v8 replies.u.post.u-post.update)
              ==
            vp
          =/  =plan:v9:c  [id.update ~]
          ?.  (~(has in deletions) plan)  deets
          (~(put by deets) plan [author seq]:u.post.u-post.update)
        ::
            [%post * %set ~]
          ::  deletion: create a proper tombstone and store it (in logs and vp)
          ::
          =/  =tombstone:v9:c
            =/  [=author:v9:c seq=@ud]
              =/  =plan:v9:c  [id.update ~]
              ~?  !(~(has by deets) plan)  %log-8-to-9-seq-bunt
              (~(gut by deets) plan *author:v9:c 0)
            [id.update author seq time]
          :+  `update(post.u-post |+tombstone)
            (put:on-v-posts:v9:c vp id.update |+tombstone)
          deets
        ::
            [%post * %reply * %set ^]
          ::  creation: upgrade the update and store deets if we will care
          ::
          :+  `update(reply.u-reply.u-post &+u.reply.u-reply.u-post.update)
            vp
          =/  =plan:v9:c  [id.update `id.u-post.update]
          ?.  (~(has in deletions) plan)  deets
          ~!  u.reply.u-reply.u-post.update
          ::NOTE  always seq=0 for replies
          (~(put by deets) plan author.u.reply.u-reply.u-post.update 0)
        ::
            [%post * %reply * %set ~]
          ::  deletion: create a proper tombstone and store it (in logs and vp)
          ::
          =/  =tombstone:v9:c
            =/  [=author:v9:c seq=@ud]
              =/  =plan:v9:c  [id `id.u-post]:update
              ~?  !(~(has by deets) plan)  %log-8-to-9-seq-bunt-r
              (~(gut by deets) plan *author:v9:c 0)
            [id.u-post.update author seq time]
          :+  `update(reply.u-reply.u-post |+tombstone)
            %^  jib:mo-v-posts:v9:c  vp
              id.update
            |=  post=(may:v9:c v-post:v9:c)
            ^+  post
            ?:  ?=(%| -.post)  post
            =-  post(replies -)
            %^  put:on-v-replies:v9:c  replies.post
              id.u-post.update
            |+tombstone
          deets
        ==
      ::
      ++  find-deleted-plans
        ::NOTE  no +rep:on...
        =<  dels
        %^  (dip:on-v-posts:v9:c ,dels=(set plan:v9:c))  vp
          ~
        |=  [dels=(set plan:v9:c) =id-post:v9:c post=(may:v9:c v-post:v9:c)]
        ^-  [(unit (may:v9:c v-post:v9:c)) stop=? _dels]
        =-  [~ | -]  ::  accumulate over everything
        ?:  ?=(%| -.post)
          (~(put in dels) id-post ~)
        =<  dels
        %^  (dip:on-v-replies:v9:c ,=_dels)  replies.post
          dels
        |=  [=_dels =id-reply:v9:c reply=(may:v9:c v-reply:v9:c)]
        ^-  [(unit (may:v9:c v-reply:v9:c)) stop=? _dels]
        =-  [~ | -]  ::  accumulate over everything
        ?:  ?=(%& -.reply)  dels
        (~(put in dels) id-post `id-reply)
      --
    --
  ++  post
    |%
    ++  v7
      |=  =post:v8:c
      ^-  post:v7:c
      :_  [-.+.post (v7:essay +.+.post)]
      :*  id.post
          (v7:reacts reacts.post)
          (v7:replies replies.post)
          (v7:reply-meta reply-meta.post)
      ==
    --
  ++  essay
    |%
    ++  v7
      |=  =essay:v8:c
      ^-  essay:v7:c
      :-  (v7:memo -.essay)
      ^-  kind-data:v7:c
      ?+  kind.essay  [%chat ~]  :: default to chat if unknown
        [%chat ~]  kind.essay    :: /chat -> [%chat ~]
        [%chat %notice ~]  kind.essay    :: /chat/notice -> [%chat %notice ~]
      ::
          [%diary ~]
        :-  %diary
        ?~  meta.essay  ['' '']
        [title image]:u.meta.essay
      ::
          [%heap ~]
        :-  %heap
        ?~  meta.essay  ~
        `title.u.meta.essay
      ==
    --
  ++  replies
    |%
    ++  v7
      |=  =replies:v8:c
      ^-  replies:v7:c
      %+  run:on-replies:v7:c  replies
      |=  r=(unit reply:v8:c)
      (bind r v7:reply)
    --
  ++  reply
    |%
    ++  v7
      |=  =reply:v8:c
      ^-  reply:v7:c
      :_  [-.+.reply (v7:memo +.+.reply)]
      :*  id.reply
          parent-id.reply
          (v7:reacts reacts.reply)
      ==
    --
  ++  simple-replies
    |%
    ++  v7
      |=  =simple-replies:v8:c
      ^-  simple-replies:v7:c
      %+  run:on-simple-replies:v8:c
        simple-replies
      v7:simple-reply
    --
  ++  simple-reply
    |%
    ++  v7
      |=  reply=simple-reply:v8:c
      ^-  simple-reply:v7:c
      :_  (v7:memo +.reply)
      :*  id.reply
          parent-id.reply
          (v7:reacts reacts.reply)
      ==
    --
  ++  story
    |%
    ++  v7
      |=  =story:v8:c
      ^-  story:v7:c
      %+  turn  story
      |=  =verse:v8:c
      ^-  verse:v7:c
      ?:  ?=(%block -.verse)
        ?+  -.p.verse  verse
            %header
          verse(q.p (v7:inlines q.p.verse))
        ::
            %listing
          verse(p.p (v7:listing p.p.verse))
        ::
            %link
          [%inline ~[[%link url.p.verse '']]]
        ==
      verse(p (v7:inlines p.verse))
    --
  ++  listing
    |%
    ++  v7
      |=  =listing:v8:c
      ^-  listing:v7:c
      ?:  ?=(%item -.listing)  listing(p (v7:inlines p.listing))
      :*  %list  p.listing
        (turn q.listing v7)
        (v7:inlines r.listing)
      ==
    --
  ++  inlines
    |%
    ++  v7
      |=  inlines=(list inline:v8:c)
      ^-  (list inline:v7:c)
      %+  murn  inlines
      |=  =inline:v8:c
      ?@  inline  `inline
      ?:  ?=(%sect -.inline)  ~
      ?+  -.inline  `inline
          ?(%italics %bold %strike %blockquote)
        `inline(p (v7 p.inline))
      ::
          %task
        `inline(q (v7 q.inline))
      ==
    --
  ++  memo
    |%
    ++  v7
      |=  =memo:v8:c
      ^-  memo:v7:c
      memo(content (v7:story content.memo), author (v7:author author.memo))
    --
  ++  reacts
    |%
    ++  v7
      |=  =reacts:v8:c
      ^-  reacts:v7:c
      %-  ~(gas by *reacts:v7:c)
      %+  turn  ~(tap by reacts)
      |=  [=author:v8:c =react:v8:c]
      ^-  [ship react:v7:c]
      [(v7:^author author) (v7:^react react)]
    --
  ++  author
    |%
    ++  v7
      |=  =author:v8:c
      ^-  ship
      ?@  author  author
      ship.author
    --
  ++  react
    |%
    ++  v7
      |=  =react:v8:c
      ^-  react:v7:c
      ?^  react  p.react
      (fall (rave:em react) '')
    --
  ++  reply-meta
    |%
    ++  v7
      |=  rm=reply-meta:v8:c
      ^-  reply-meta:v7:c
      rm(last-repliers (~(run in last-repliers.rm) v7:author))
    --
  ++  said
    |%
    ++  v7
      |=  =said:v8:c
      ^-  said:v7:c
      said(q (v7:reference q.said))
    ++  v9
      |=  =said:v8:c
      ^-  said:v9:c
      %=  said  q
        ?-    -.q.said
            %post
          ^-  [%post (may:v9:c simple-post:v9:c)]
          =/  =simple-seal:v9:c
            :*  id.post.q.said
                0
                *@da
                reacts.post.q.said
                replies.post.q.said
                reply-meta.post.q.said
            ==
          [%post %& simple-seal +.post.q.said]
            %reply
          ^-  $>(%reply reference:v9:c)
          [%reply id-post.q.said %& reply.q.said]
        ==
      ==
    --
  ++  reference
    |%
    ++  v7
      |=  =reference:v8:c
      ^-  reference:v7:c
      ?-    -.reference
          %post
        ^-  [%post simple-post:v7:c]
        :-  %post
        :_  (v7:essay +.post.reference)
        :*  id.post.reference
            (v7:reacts reacts.post.reference)
            (v7:simple-replies replies.post.reference)
            (v7:reply-meta reply-meta.post.reference)
        ==
      ::
          %reply
        ^-  $>(%reply reference:v7:c)
        reference(reply (v7:simple-reply:v8 reply.reference))
      ==
    --
  ++  scan
    |%
    ++  v7
      |=  =scan:v8:c
      ^-  scan:v7:c
      (turn scan v7:reference)
    --
  ++  scam
    |%
    ++  v7
      |=  =scam:v8:c
      ^-  scam:v7:c
      scam(scan (v7:scan scan.scam))
    --
  --
++  v7
  |%
  ++  v-channels
    |%
    ++  v8
      |=  vc=v-channels:v7:c
      ^-  v-channels:v8:c
      %-  ~(run by vc)
      |=  v=v-channel:v7:c
      ^-  v-channel:v8:c
      =/  [log=log:v-channel:v8:c mod=(map id-post:c time)]
        (v8:log:v7 log.v)
      =/  [count=@ud =v-posts:v8:c]
        (v8:v-posts:v7 posts.v mod)
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
        future   *future:v-channel:v8:c
        pending  (v8:pending:v7 pending.v)
      ==
    --
  ++  log
    |%
    ++  v8
      |=  l=log:v-channel:v7:c
      ^-  [log:v-channel:v8:c (map id-post:v8:c @da)]
      =|  seq-log=(map id-post:v8:c @ud)
      =|  =log:v8:c
      =|  mod=(map id-post:v8:c @da)
      =<  [log mod]
      %+  roll  (tap:log-on:v7:c l)
      |=  [[=time =u-channel:v7:c] [count=@ud =_seq-log] =_log =_mod]
      ^+  [[count seq-log] log mod]
      ?:  ?=(%create -.u-channel)
        :-  [count seq-log]
        :_  mod
        (put:log-on:v8:c log time %create perm.u-channel ~)
      ?.  ?=(%post -.u-channel)
        :-  [count seq-log]
        :_  mod
        (put:log-on:v8:c log time u-channel)
      ?.  ?=(%set -.u-post.u-channel)
        :-  [count seq-log]
        :_  (~(put by mod) id.u-channel time)
        (put:log-on:v8:c log time %post id.u-channel (v8:u-post-not-set:v7 u-post.u-channel))
      ::  %set
      ::
      ?~  post.u-post.u-channel
        :-  [count seq-log]
        :_  (~(put by mod) id.u-channel time)
        (put:log-on:v8:c log time %post id.u-channel %set ~)
      ::  %set post: increment .seq only for a new post
      ::
      =^  seq=@ud  count
        ?~  seq=(~(get by seq-log) id.u-channel)
          [. .]:+(count)
        [u.seq count]
      :-  :-  count
          (~(put by seq-log) id.u-channel count)
      :_  (~(put by mod) id.u-channel time)
      %^  put:log-on:v8:c  log  time
      :+  %post  id.u-channel
      (v8:u-post-set:v7 u-post.u-channel seq id.u-channel)
    --
  ++  v-posts
    |%
    ++  v8
      |=  [vp=v-posts:v7:c mod=(map id-post:c time)]
      ^-  [@ud v-posts:v8:c]
      =|  posts=v-posts:v8:c
      %+  roll  (tap:on-v-posts:v7:c vp)
      |=  [[=id-post:c post=(unit v-post:v7:c)] count=@ud =_posts]
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
        (put:on-v-posts:v8:c posts id-post ~)
      ::  insert seq and mod-at into seal
      ::
      =;  new-post=v-post:v8:c
        (put:on-v-posts:v8:c posts id-post `new-post)
      =*  seal  -.u.post
      =*  essay  +.u.post
      =/  new-seal=v-seal:v8:c
        =/  mod-at=@da
          %+  fall
            (~(get by mod) id-post)
          id.u.post
        =+  seal(|1 [count mod-at |1.seal])
        %=  -
          replies  (v8:v-replies:v7 replies.seal)
          reacts   (v8:v-reacts:v7 reacts.seal)
        ==
      ^-  v-post:v8:c
      [new-seal [rev.essay (v8:essay:v7 +.essay)]]
    --
  ++  v-replies
    |%
    ++  v8
      |=  =v-replies:v7:c
      ^-  v-replies:v8:c
      %+  run:on-v-replies:v7:c  v-replies
      |=  v-reply=(unit v-reply:v7:c)
      ^-  (unit v-reply:v8:c)
      ?~  v-reply  ~
      %=  v-reply
        reacts.u  (v8:v-reacts:v7 reacts.u.v-reply)
      ==
    --
  ++  v-reacts
    |%
    ++  v8
      |=  =v-reacts:v7:c
      ^-  v-reacts:v8:c
      %-  ~(run by v-reacts)
      |=  v-react=(rev:c (unit react:v7:c))
      ^-  (rev:c (unit react:v8:c))
      ?~  +.v-react  [-.v-react ~]
      =+  rat=(kill:em u.v-react)
      v-react(u (fall rat any+u.v-react))
    --
  ++  pending
    |%
    ++  v8
      |=  pending=pending-messages:v7:c
      ^-  pending-messages:v8:c
      %=  pending
        posts    (~(run by posts.pending) v8:essay:v7)
        replies  (~(run by replies.pending) v8:memo:v7)
      ==
    --
  ++  essay
    |%
    ++  v8
      |=  =essay:v7:c
      ^-  essay:v8:c
      :-  (v8:memo:v7 -.essay)  ::  memo
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
    --
  ++  memo
    |%
    ++  v8
      |=  =memo:v7:c
      ^-  memo:v8:c
      memo
    --
  ++  react
    |%
    ++  v8
      |=  =react:v7:c
      ^-  react:v8:c
      =+  rat=(kill:em react)
      (fall rat any+react)
    --
  ++  simple-reply
    |%
    ++  v8
      |=  reply=simple-reply:v7:c
      ^-  simple-reply:v8:c
      reply(+ (v8:memo:v7 +.reply))
    --
  ++  said
    |%
    ++  v8
      |=  =said:v7:c
      ^-  said:v8:c
      %=  said  q
        ?-    -.q.said
            %post
          ^-  [%post simple-post:v8:c]
          =/  replies=simple-replies:v8:c
            %+  run:on-simple-replies:v7:c
              replies.post.q.said
            v8:simple-reply:v7
          =/  =simple-seal:v8:c
            -.post.q.said(replies replies)
          =/  =essay:v8:c
            (v8:essay:v7 +.post.q.said)
          %=  q.said
            ::  seal
            -.post   simple-seal
            ::  essay
            +.post  essay
          ==
            %reply
          ^-  $>(%reply reference:v8:c)
          q.said(reply (v8:simple-reply:v7 reply.q.said))
        ==
      ==
    ++  v9
      |=  =said:v7:c
      ^-  said:v9:c
      (v9:said:^v8 (v8 said))
    --
  ++  u-post-set
    |%
    ++  v8
      |=  [u=u-post:v7:c seq=@ud mod-at=@da]
      ^-  $>(%set u-post:v8:c)
      ?>  ?=(%set -.u)
      ::  %post %set
      ::
      ?~  post.u  u
      =*  post  u.post.u
      :-  %set
      =/  new-seal=v-seal:v8:c
        :*  id.post
            seq
            mod-at
            (v8:v-replies:v7 replies.post)
            (v8:v-reacts:v7 reacts.post)
        ==
      (some [new-seal [rev.+.post (v8:essay:v7 +>.post)]])
    --
  ++  u-post-not-set
    |%
    ++  v8
      |=  u=$<(%set u-post:v7:c)
      ^-  $<(%set u-post:v8:c)
      ?:  ?=(%essay -.u)
        u(essay (v8:essay:v7 essay.u))
      ::
      ?:  ?=([%reply =id-reply:c %set *] u)
        ?~  reply.u-reply.u  u
        %=    u
            reacts.u.reply.u-reply
          %-  v8:v-reacts:v7
          reacts.u.reply.u-reply.u
        ==
      ?:  ?=([%reply =id-reply:c %reacts *] u)
        %=    u
            reacts.u-reply
          %-  v8:v-reacts:v7
          reacts.u-reply.u
        ==
      ::  %reacts
      ::
      u(reacts (v8:v-reacts:v7 reacts.u))
    --
  --
--