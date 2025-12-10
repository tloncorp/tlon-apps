::  channel conversion functions
/-  cv=channels-ver, m=meta
/+  em=emojimart
|%
++  v9
  |%
  ++  v-channels
    |%
    ++  v8
      |=  vc=v-channels:v9:cv
      ^-  v-channels:v8:cv
      %-  ~(run by vc)
      |=  v=v-channel:v9:cv
      ^-  v-channel:v8:cv
      =/  nu-posts=v-posts:v8:cv
        (v8:v-posts:v9 posts.v)
      =/  nu-log=log:v8:cv
        (v8:log:v9 log.v)
      ::NOTE  .future unused at the time of migration
      v(posts nu-posts, log nu-log, future *future:v-channel:v8:cv)
    --
  ++  v-posts
    |%
    ++  v8
      |=  vp=v-posts:v9:cv
      ^-  v-posts:v8:cv
      %-  ~(run by vp)
      |=  v=(may:v9:cv v-post:v9:cv)
      ^-  (unit v-post:v8:cv)
      ?:  ?=(%| -.v)  ~
      `(v8:v-post:v9 +.v)
    --
  ++  v-post
    |%
    ++  v8
      |=  vp=v-post:v9:cv
      ^-  v-post:v8:cv
      vp(replies (v8:v-replies replies.vp))
    --
  ++  v-replies
    |%
    ++  v8
      |=  vr=v-replies:v9:cv
      ^-  v-replies:v8:cv
      %-  ~(run by vr)
      |=  v=(may:v9:cv v-reply:v9:cv)
      ^-  (unit v-reply:v8:cv)
      ?:(?=(%| -.v) ~ `+.v)
    --
  ++  v-reply
    |%
    ++  v8
      |=  vr=v-reply:v9:cv
      ^-  v-reply:v8:cv
      vr
    --
  ++  posts
    |%
    ++  v8
      |=  =posts:v9:cv
      ^-  posts:v8:cv
      %-  ~(run by posts)
      |=  post=(may:v9:cv post:v9:cv)
      ^-  (unit post:v8:cv)
      ?:  ?=(%| -.post)  ~
      `(v8:^post +.post)
    --
  ++  post
    |%
    ++  v8
      |=  =post:v9:cv
      ^-  post:v8:cv
      post(replies (v8:replies replies.post))
    ++  v7
      |=  =post:v9:cv
      ^-  post:v7:cv
      (v7:post:^v8 (v8 post))
    --
  ++  replies
    |%
    ++  v8
      |=  =replies:v9:cv
      ^-  replies:v8:cv
      %-  ~(run by replies)
      |=  reply=(may:v9:cv reply:v9:cv)
      ^-  (unit reply:v8:cv)
      ?:(?=(%| -.reply) ~ `+.reply)
    --
  ++  reply
    |%
    ++  v8
      |=  =reply:v9:cv
      ^-  reply:v8:cv
      reply
    ++  v7  v7:reply:^v8
    --
  ++  seal
    |%
    ++  v8
      |=  =seal:v9:cv
      ^-  seal:v8:cv
      seal(replies (v8:replies replies.seal))
    ++  v7
      |=  =seal:v9:cv
      (v7:seal:^v8 (v8 seal))
    --
  ++  author
    |%
    ++  v8
      |=  =author:v9:cv
      ^-  author:v8:cv
      author
    ++  v7  v7:author:^v8
    --
  ++  essay
    |%
    ++  v8
      |=  =essay:v9:cv
      ^-  essay:v8:cv
      essay
    ++  v7  v7:essay:^v8
    --
  ++  memo
    |%
    ++  v8
      |=  =memo:v9:cv
      ^-  memo:v8:cv
      memo
    ++  v7  v7:memo:^v8
    --
  ++  reacts
    |%
    ++  v8
      |=  =reacts:v9:cv
      ^-  reacts:v8:cv
      reacts
    ++  v7  v7:reacts:^v8
    --
  ++  react
    |%
    ++  v8
      |=  =react:v9:cv
      ^-  react:v8:cv
      react
    ++  v7  v7:react:^v8
    --
  ++  reply-meta
    |%
    ++  v8
      |=  =reply-meta:v9:cv
      ^-  reply-meta:v8:cv
      reply-meta
    ++  v7  v7:reply-meta:^v8
    --
  ++  reply-seal
    |%
    ++  v8
      |=  =reply-seal:v9:cv
      ^-  reply-seal:v8:cv
      reply-seal
    ++  v7  v7:reply-seal:^v8
    --
  ++  log
    |%
    ++  v8
      |=  vl=log:v9:cv
      ^-  log:v8:cv
      %-  ~(run by vl)
      |=  update=u-channel:v9:cv
      ^-  u-channel:v8:cv
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
    ++  v7
      |=  =r-channels:v9:cv
      ^-  r-channels:v7:cv
      (v7:r-channels:^v8 (v8 r-channels))
    ++  v8
      |=  [=nest:cv =r-channel:v9:cv]
      ^-  r-channels:v8:cv
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
          ^-  r-post:v8:cv
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
      |=  =said:v9:cv
      ^-  said:v8:cv
      said(q (v8:reference q.said))
    ++  v7
      |=  =said:v9:cv
      ^-  said:v7:cv
      (v7:said:^v8 (v8 said))
    --
  ++  reference
    |%
    ++  v8
      |=  =reference:v9:cv
      ^-  reference:v8:cv
      ?:  ?=(%reply -.reference)
        :-  %reply
        :-  id-post.reference
        ?:  ?=(%| -.reply.reference)
          ^-  simple-reply:v8:cv
          :-  [*@da *@da ~]
          [~[[%inline ['[deleted reply]']~]] [author del-at]:reply.reference]
        +.reply.reference
      :-  %post
      ?:  ?=(%| -.post.reference)
        ^-  simple-post:v8:cv
        :-  [*@da ~ ~ 0 ~ ~]
        :_  [/ ~ ~]
        [~[[%inline ['[deleted post]']~]] [author del-at]:post.reference]
      =/  =simple-seal:v8:cv
        :*  id.post.reference
            reacts.post.reference
            replies.post.reference
            reply-meta.post.reference
        ==
      ^-  simple-post:v8:cv
      [simple-seal +>.post.reference]
    --
  ++  scan
    |%
    ++  v8
      |=  =scan:v9:cv
      ^-  scan:v8:cv
      (turn scan v8:reference)
    ++  v7
      |=  =scan:v9:cv
      ^-  scan:v7:cv
      (v7:scan:^v8 (v8 scan))
    --
  ++  scam
    |%
    ++  v8
      |=  =scam:v9:cv
      ^-  scam:v8:cv
      scam(scan (v8:scan scan.scam))
    ++  v7
      |=  =scam:v9:cv
      ^-  scam:v7:cv
      (v7:scam:^v8 (v8 scam))
    --
  --
++  v8
  |%
  ++  v-channels
    |%
    ++  v9
      |=  vc=v-channels:v8:cv
      ^-  v-channels:v9:cv
      %-  ~(run by vc)
      |=  v=v-channel:v8:cv
      ^-  v-channel:v9:cv
      =/  nu-posts=v-posts:v9:cv
        (v9:v-posts:v8 posts.v)
      =^  nu-log=log:v9:cv  nu-posts
        (v9:log:v8 log.v nu-posts)
      ::NOTE  .future unused at the time of migration
      v(posts nu-posts, log nu-log, future *future:v-channel:v9:cv)
    --
  ++  v-posts
    |%
    ++  v9
      ::NOTE  bunts tombstones! must call +v9:log:v8 afterwards!
      |=  vp=v-posts:v8:cv
      ^-  v-posts:v9:cv
      %+  urn:mo-v-posts:v8:cv  vp
      |=  [=id-post:v8:cv post=(unit v-post:v8:cv)]
      ^-  (may:v9:cv v-post:v9:cv)
      ?~  post
        [%| %*(. *tombstone:v9:cv id id-post)]
      :-  %&
      u.post(replies (v9:v-replies:v8 replies.u.post))
    --
  ++  v-replies
    |%
    ++  v9
      |=  vr=v-replies:v8:cv
      ^-  v-replies:v9:cv
      %+  urn:mo-v-replies:v8:cv  vr
      |=  [=id-reply:v8:cv reply=(unit v-reply:v8:cv)]
      ^-  (may:v9:cv v-reply:v9:cv)
      ?^  reply  [%& u.reply]
      [%| %*(. *tombstone:v9:cv id id-reply)]
    --
  ++  log
    |%
    ++  v9  ::  puts tombstone info into .vp too
      |=  [l=log:v8:cv vp=v-posts:v9:cv]
      ^-  [log:v9:cv _vp]
      |^  =+  do=(deep find-deleted-plans)
          =<  [log=+ vp]
          %-  (dyp:mo-log:v8:cv u-channel:v9:cv ,[=_vp =deets])
          [l [vp *deets] do]
      ::
      +$  deets
        (map plan:v9:cv [=author:v9:cv seq=@ud])
      ::
      ++  deep
        |=  deletions=(set plan:v9:cv)
        |=  [[=_vp =deets] =time update=u-channel:v8:cv]
        ^-  [(unit u-channel:v9:cv) _vp _deets]
        ?+  update  [`update vp deets]
            [%post * %set ^]
          ::  creation: upgrade the update and store deets if we will care
          ::
          :+  %-  some
              =;  p=v-post:v9:cv
                update(post.u-post &+p)
              %=  u.post.u-post.update
                replies  (v9:v-replies:v8 replies.u.post.u-post.update)
              ==
            vp
          =/  =plan:v9:cv  [id.update ~]
          ?.  (~(has in deletions) plan)  deets
          (~(put by deets) plan [author seq]:u.post.u-post.update)
        ::
            [%post * %set ~]
          ::  deletion: create a proper tombstone and store it (in logs and vp)
          ::
          =/  =tombstone:v9:cv
            =/  [=author:v9:cv seq=@ud]
              =/  =plan:v9:cv  [id.update ~]
              ~?  !(~(has by deets) plan)  %log-8-to-9-seq-bunt
              (~(gut by deets) plan *author:v9:cv 0)
            [id.update author seq time]
          :+  `update(post.u-post |+tombstone)
            (put:on-v-posts:v9:cv vp id.update |+tombstone)
          deets
        ::
            [%post * %reply * %set ^]
          ::  creation: upgrade the update and store deets if we will care
          ::
          :+  `update(reply.u-reply.u-post &+u.reply.u-reply.u-post.update)
            vp
          =/  =plan:v9:cv  [id.update `id.u-post.update]
          ?.  (~(has in deletions) plan)  deets
          ~!  u.reply.u-reply.u-post.update
          ::NOTE  always seq=0 for replies
          (~(put by deets) plan author.u.reply.u-reply.u-post.update 0)
        ::
            [%post * %reply * %set ~]
          ::  deletion: create a proper tombstone and store it (in logs and vp)
          ::
          =/  =tombstone:v9:cv
            =/  [=author:v9:cv seq=@ud]
              =/  =plan:v9:cv  [id `id.u-post]:update
              ~?  !(~(has by deets) plan)  %log-8-to-9-seq-bunt-r
              (~(gut by deets) plan *author:v9:cv 0)
            [id.u-post.update author seq time]
          :+  `update(reply.u-reply.u-post |+tombstone)
            %^  jib:mo-v-posts:v9:cv  vp
              id.update
            |=  post=(may:v9:cv v-post:v9:cv)
            ^+  post
            ?:  ?=(%| -.post)  post
            =-  post(replies -)
            %^  put:on-v-replies:v9:cv  replies.post
              id.u-post.update
            |+tombstone
          deets
        ==
      ::
      ++  find-deleted-plans
        ::NOTE  no +rep:on...
        =<  dels
        %^  (dip:on-v-posts:v9:cv ,dels=(set plan:v9:cv))  vp
          ~
        |=  [dels=(set plan:v9:cv) =id-post:v9:cv post=(may:v9:cv v-post:v9:cv)]
        ^-  [(unit (may:v9:cv v-post:v9:cv)) stop=? _dels]
        =-  [~ | -]  ::  accumulate over everything
        ?:  ?=(%| -.post)
          (~(put in dels) id-post ~)
        =<  dels
        %^  (dip:on-v-replies:v9:cv ,=_dels)  replies.post
          dels
        |=  [=_dels =id-reply:v9:cv reply=(may:v9:cv v-reply:v9:cv)]
        ^-  [(unit (may:v9:cv v-reply:v9:cv)) stop=? _dels]
        =-  [~ | -]  ::  accumulate over everything
        ?:  ?=(%& -.reply)  dels
        (~(put in dels) id-post `id-reply)
      --
    --
  ++  posts
    |%
    ++  v7
      |=  =posts:v8:cv
      ^-  posts:v7:cv
      %-  ~(run by posts)
      |=  post=(unit post:v8:cv)
      (bind post v7:^post)
    --
  ++  post
    |%
    ++  v7
      |=  =post:v8:cv
      ^-  post:v7:cv
      :-  (v7:seal -.post)
      [+<.post (v7:essay +>.post)]
    --
  ++  seal
    |%
    ++  v7
      |=  =seal:v8:cv
      ^-  seal:v7:cv
      :*  id.seal
          (v7:reacts reacts.seal)
          (v7:replies replies.seal)
          (v7:reply-meta reply-meta.seal)
      ==
    --
  ++  essay
    |%
    ++  v7
      |=  =essay:v8:cv
      ^-  essay:v7:cv
      :-  (v7:memo -.essay)
      ^-  kind-data:v7:cv
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
      |=  =replies:v8:cv
      ^-  replies:v7:cv
      %+  run:on-replies:v7:cv  replies
      |=  r=(unit reply:v8:cv)
      (bind r v7:reply)
    --
  ++  reply
    |%
    ++  v7
      |=  =reply:v8:cv
      ^-  reply:v7:cv
      :_  [-.+.reply (v7:memo +.+.reply)]
      :*  id.reply
          parent-id.reply
          (v7:reacts reacts.reply)
      ==
    --
  ++  reply-seal
    |%
    ++  v7
      |=  =reply-seal:v8:cv
      ^-  reply-seal:v7:cv
      :*  id.reply-seal
          parent-id.reply-seal
          (v7:reacts reacts.reply-seal)
      ==
    --
  ++  simple-replies
    |%
    ++  v7
      |=  =simple-replies:v8:cv
      ^-  simple-replies:v7:cv
      %+  run:on-simple-replies:v8:cv
        simple-replies
      v7:simple-reply
    --
  ++  simple-reply
    |%
    ++  v7
      |=  reply=simple-reply:v8:cv
      ^-  simple-reply:v7:cv
      :_  (v7:memo +.reply)
      :*  id.reply
          parent-id.reply
          (v7:reacts reacts.reply)
      ==
    --
  ++  story
    |%
    ++  v7
      |=  =story:v8:cv
      ^-  story:v7:cv
      %+  turn  story
      |=  =verse:v8:cv
      ^-  verse:v7:cv
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
      |=  =listing:v8:cv
      ^-  listing:v7:cv
      ?:  ?=(%item -.listing)  listing(p (v7:inlines p.listing))
      :*  %list  p.listing
        (turn q.listing v7)
        (v7:inlines r.listing)
      ==
    --
  ++  inlines
    |%
    ++  v7
      |=  inlines=(list inline:v8:cv)
      ^-  (list inline:v7:cv)
      %+  murn  inlines
      |=  =inline:v8:cv
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
      |=  =memo:v8:cv
      ^-  memo:v7:cv
      memo(content (v7:story content.memo), author (v7:author author.memo))
    --
  ++  reacts
    |%
    ++  v7
      |=  =reacts:v8:cv
      ^-  reacts:v7:cv
      %-  ~(gas by *reacts:v7:cv)
      %+  turn  ~(tap by reacts)
      |=  [=author:v8:cv =react:v8:cv]
      ^-  [ship react:v7:cv]
      [(v7:^author author) (v7:^react react)]
    --
  ++  author
    |%
    ++  v7
      |=  =author:v8:cv
      ^-  ship
      ?@  author  author
      ship.author
    --
  ++  react
    |%
    ++  v7
      |=  =react:v8:cv
      ^-  react:v7:cv
      ?^  react  p.react
      (fall (rave:em react) '')
    --
  ++  reply-meta
    |%
    ++  v7
      |=  rm=reply-meta:v8:cv
      ^-  reply-meta:v7:cv
      rm(last-repliers (~(run in last-repliers.rm) v7:author))
    --
  ++  said
    |%
    ++  v7
      |=  =said:v8:cv
      ^-  said:v7:cv
      said(q (v7:reference q.said))
    ++  v9
      |=  =said:v8:cv
      ^-  said:v9:cv
      %=  said  q
        ?-    -.q.said
            %post
          ^-  [%post (may:v9:cv simple-post:v9:cv)]
          =/  =simple-seal:v9:cv
            :*  id.post.q.said
                0
                *@da
                reacts.post.q.said
                replies.post.q.said
                reply-meta.post.q.said
            ==
          [%post %& simple-seal +.post.q.said]
            %reply
          ^-  $>(%reply reference:v9:cv)
          [%reply id-post.q.said %& reply.q.said]
        ==
      ==
    --
  ++  reference
    |%
    ++  v7
      |=  =reference:v8:cv
      ^-  reference:v7:cv
      ?-    -.reference
          %post
        ^-  [%post simple-post:v7:cv]
        :-  %post
        :_  (v7:essay +.post.reference)
        :*  id.post.reference
            (v7:reacts reacts.post.reference)
            (v7:simple-replies replies.post.reference)
            (v7:reply-meta reply-meta.post.reference)
        ==
      ::
          %reply
        ^-  $>(%reply reference:v7:cv)
        reference(reply (v7:simple-reply:v8 reply.reference))
      ==
    --
  ++  r-channels
    |%
    ++  v7
      |=  [=nest:cv =r-channel:v8:cv]
      ^-  r-channels:v7:cv
      ?<  ?=(%meta -.r-channel)
      :-  nest
      ?+  r-channel  r-channel
        [%posts *]  [%posts (v7:posts posts.r-channel)]
      ::
          [%post * %set *]
        r-channel(post.r-post (bind post.r-post.r-channel v7:post))
      ::
          [%post * %reply * ^ %reacts *]
        %=    r-channel
            reply-meta.r-post
          (v7:reply-meta reply-meta.r-post.r-channel)
        ::
            reacts.r-reply.r-post
          (v7:reacts reacts.r-reply.r-post.r-channel)
        ==
      ::
          [%post * %reply * ^ %set *]
        %=    r-channel
            reply-meta.r-post
          (v7:reply-meta reply-meta.r-post.r-channel)
        ::
            reply.r-reply.r-post
          ?~  reply.r-reply.r-post.r-channel  ~
          (bind reply.r-reply.r-post.r-channel v7:reply)
        ==
      ::
          [%post * %reacts *]
        r-channel(reacts.r-post (v7:reacts reacts.r-post.r-channel))
      ::
          [%post * %essay *]
        r-channel(essay.r-post (v7:essay essay.r-post.r-channel))
      ::
          [%pending * %post *]
        %=    r-channel
            essay.r-pending
          (v7:essay essay.r-pending.r-channel)
        ==
      ::
          [%pending * %reply *]
        %=    r-channel
            reply-meta.r-pending
          (v7:reply-meta reply-meta.r-pending.r-channel)
        ::
            memo.r-pending
          (v7:memo memo.r-pending.r-channel)
        ==
      ==
    --
  ++  scan
    |%
    ++  v7
      |=  =scan:v8:cv
      ^-  scan:v7:cv
      (turn scan v7:reference)
    --
  ++  scam
    |%
    ++  v7
      |=  =scam:v8:cv
      ^-  scam:v7:cv
      scam(scan (v7:scan scan.scam))
    --
  --
++  v7
  |%
  ++  v-channels
    |%
    ++  v8
      |=  vc=v-channels:v7:cv
      ^-  v-channels:v8:cv
      %-  ~(run by vc)
      |=  v=v-channel:v7:cv
      ^-  v-channel:v8:cv
      =/  [log=log:v-channel:v8:cv mod=(map id-post:cv time)]
        (v8:log:v7 log.v)
      =/  [count=@ud =v-posts:v8:cv]
        (v8:v-posts:v7 posts.v mod)
      =-  %=  w  -  :: change global in w
            :*  posts.w
                count
                order.w
                view.w
                sort.w
                perm.w
                *(rev:cv (unit @t))  ::  meta
            ==
          ==
      ^=  w
      %=  v
        ::  global
        posts  v-posts
        ::  local
        log      log
        future   *future:v-channel:v8:cv
        pending  (v8:pending:v7 pending.v)
      ==
    --
  ++  log
    |%
    ++  v8
      |=  l=log:v-channel:v7:cv
      ^-  [log:v-channel:v8:cv (map id-post:v8:cv @da)]
      =|  seq-log=(map id-post:v8:cv @ud)
      =|  =log:v8:cv
      =|  mod=(map id-post:v8:cv @da)
      =<  [log mod]
      %+  roll  (tap:log-on:v7:cv l)
      |=  [[=time =u-channel:v7:cv] [count=@ud =_seq-log] =_log =_mod]
      ^+  [[count seq-log] log mod]
      ?:  ?=(%create -.u-channel)
        :-  [count seq-log]
        :_  mod
        (put:log-on:v8:cv log time %create perm.u-channel ~)
      ?.  ?=(%post -.u-channel)
        :-  [count seq-log]
        :_  mod
        (put:log-on:v8:cv log time u-channel)
      ?.  ?=(%set -.u-post.u-channel)
        :-  [count seq-log]
        :_  (~(put by mod) id.u-channel time)
        (put:log-on:v8:cv log time %post id.u-channel (v8:u-post-not-set:v7 u-post.u-channel))
      ::  %set
      ::
      ?~  post.u-post.u-channel
        :-  [count seq-log]
        :_  (~(put by mod) id.u-channel time)
        (put:log-on:v8:cv log time %post id.u-channel %set ~)
      ::  %set post: increment .seq only for a new post
      ::
      =^  seq=@ud  count
        ?~  seq=(~(get by seq-log) id.u-channel)
          [. .]:+(count)
        [u.seq count]
      :-  :-  count
          (~(put by seq-log) id.u-channel count)
      :_  (~(put by mod) id.u-channel time)
      %^  put:log-on:v8:cv  log  time
      :+  %post  id.u-channel
      (v8:u-post-set:v7 u-post.u-channel seq id.u-channel)
    --
  ++  v-posts
    |%
    ++  v8
      |=  [vp=v-posts:v7:cv mod=(map id-post:cv time)]
      ^-  [@ud v-posts:v8:cv]
      =|  posts=v-posts:v8:cv
      %+  roll  (tap:on-v-posts:v7:cv vp)
      |=  [[=id-post:cv post=(unit v-post:v7:cv)] count=@ud =_posts]
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
        (put:on-v-posts:v8:cv posts id-post ~)
      ::  insert seq and mod-at into seal
      ::
      =;  new-post=v-post:v8:cv
        (put:on-v-posts:v8:cv posts id-post `new-post)
      =*  seal  -.u.post
      =*  essay  +.u.post
      =/  new-seal=v-seal:v8:cv
        =/  mod-at=@da
          %+  fall
            (~(get by mod) id-post)
          id.u.post
        =+  seal(|1 [count mod-at |1.seal])
        %=  -
          replies  (v8:v-replies:v7 replies.seal)
          reacts   (v8:v-reacts:v7 reacts.seal)
        ==
      ^-  v-post:v8:cv
      [new-seal [rev.essay (v8:essay:v7 +.essay)]]
    --
  ++  v-replies
    |%
    ++  v8
      |=  =v-replies:v7:cv
      ^-  v-replies:v8:cv
      %+  run:on-v-replies:v7:cv  v-replies
      |=  v-reply=(unit v-reply:v7:cv)
      ^-  (unit v-reply:v8:cv)
      ?~  v-reply  ~
      %=  v-reply
        reacts.u  (v8:v-reacts:v7 reacts.u.v-reply)
      ==
    --
  ++  v-reacts
    |%
    ++  v8
      |=  =v-reacts:v7:cv
      ^-  v-reacts:v8:cv
      %-  ~(run by v-reacts)
      |=  v-react=(rev:cv (unit react:v7:cv))
      ^-  (rev:cv (unit react:v8:cv))
      ?~  +.v-react  [-.v-react ~]
      =+  rat=(kill:em u.v-react)
      v-react(u (fall rat any+u.v-react))
    --
  ++  pending
    |%
    ++  v8
      |=  pending=pending-messages:v7:cv
      ^-  pending-messages:v8:cv
      %=  pending
        posts    (~(run by posts.pending) v8:essay:v7)
        replies  (~(run by replies.pending) v8:memo:v7)
      ==
    --
  ++  essay
    |%
    ++  v8
      |=  =essay:v7:cv
      ^-  essay:v8:cv
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
  ++  author
    |%
    ++  v8
      |=  =ship
      ^-  author:v8:cv
      ship
    --
  ++  memo
    |%
    ++  v8
      |=  =memo:v7:cv
      ^-  memo:v8:cv
      memo
    --
  ++  reacts
    |%
    ++  v8
      |=  =reacts:v7:cv
      ^-  reacts:v8:cv
      (~(run by reacts) v8:react)
    --
  ++  react
    |%
    ++  v8
      |=  =react:v7:cv
      ^-  react:v8:cv
      =+  rat=(kill:em react)
      (fall rat any+react)
    --
  ++  simple-reply
    |%
    ++  v8
      |=  reply=simple-reply:v7:cv
      ^-  simple-reply:v8:cv
      reply(+ (v8:memo:v7 +.reply))
    --
  ++  reply-meta
    |%
    ++  v8
      |=  rm=reply-meta:v7:cv
      ^-  reply-meta:v8:cv
      rm(last-repliers (~(run in last-repliers.rm) v8:author))
    --
  ++  said
    |%
    ++  v8
      |=  =said:v7:cv
      ^-  said:v8:cv
      %=  said  q
        ?-    -.q.said
            %post
          ^-  [%post simple-post:v8:cv]
          =/  replies=simple-replies:v8:cv
            %+  run:on-simple-replies:v7:cv
              replies.post.q.said
            v8:simple-reply:v7
          =/  =simple-seal:v8:cv
            -.post.q.said(replies replies)
          =/  =essay:v8:cv
            (v8:essay:v7 +.post.q.said)
          %=  q.said
            ::  seal
            -.post   simple-seal
            ::  essay
            +.post  essay
          ==
            %reply
          ^-  $>(%reply reference:v8:cv)
          q.said(reply (v8:simple-reply:v7 reply.q.said))
        ==
      ==
    ++  v9
      |=  =said:v7:cv
      ^-  said:v9:cv
      (v9:said:^v8 (v8 said))
    --
  ++  u-post-set
    |%
    ++  v8
      |=  [u=u-post:v7:cv seq=@ud mod-at=@da]
      ^-  $>(%set u-post:v8:cv)
      ?>  ?=(%set -.u)
      ::  %post %set
      ::
      ?~  post.u  u
      =*  post  u.post.u
      :-  %set
      =/  new-seal=v-seal:v8:cv
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
      |=  u=$<(%set u-post:v7:cv)
      ^-  $<(%set u-post:v8:cv)
      ?:  ?=(%essay -.u)
        u(essay (v8:essay:v7 essay.u))
      ::
      ?:  ?=([%reply =id-reply:cv %set *] u)
        ?~  reply.u-reply.u  u
        %=    u
            reacts.u.reply.u-reply
          %-  v8:v-reacts:v7
          reacts.u.reply.u-reply.u
        ==
      ?:  ?=([%reply =id-reply:cv %reacts *] u)
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
