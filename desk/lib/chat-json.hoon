/-  c=chat, d=channels, old-3=chat-3
/-  meta
/+  cite=cite-json, gj=groups-json, dj=channel-json
|%
++  enjs
  =,  enjs:format
  |%
  ++  club-action
    |=  a=action:club:c
    ^-  json
    %-  pairs
    :~  id/s/(scot %uv p.a)
        diff/(club-diff q.a)
    ==
  ::
  ++  club-diff
    |=  d=diff:club:c
    ^-  json
    %-  pairs
    :~  uid/s/(scot %uv p.d)
        delta/(club-delta q.d)
    ==
  ++  club-delta
    |=  d=delta:club:c
    %+  frond  -.d
    ?-  -.d
        %writ  (writs-diff diff.d)
    ::
        %meta  (meta meta.d)
    ::
        %team
      %-  pairs
      :~  ship/(ship ship.d)
          ok/b/ok.d
      ==
    ::
        %hive
      %-  pairs
      :~  by/(ship by.d)
          for/(ship for.d)
          add/b/add.d
      ==
    ::
        %init
      %-  pairs
      :~  team/a/(turn ~(tap in team.d) ship)
          hive/a/(turn ~(tap in hive.d) ship)
          meta/(meta met.d)
      ==
    ==
  ::
  ++  club-invite
    |=  i=invite:club:c
    %-  pairs
    :~  id/s/(scot %uv id.i)
        team/a/(turn ~(tap in team.i) ship)
        hive/a/(turn ~(tap in hive.i) ship)
        meta/(meta met.i)
    ==
  ::
  ++  meta
    |=  m=data:^meta
    %-  pairs
    :~  title/s/title.m
        description/s/description.m
        image/s/image.m
        cover/s/cover.m
    ==
  ::
  ++  club-rsvp
    |=  r=rsvp:club:c
    %-  pairs
    :~  id/s/(scot %uv id.r)
        ship/s/(scot %p ship.r)
        ok/b/ok.r
    ==
  ::
  ++  rsvp
    |=  r=rsvp:dm:c
    %-  pairs
    :~  ship/(ship ship.r)
        ok/b/ok.r
    ==
  ::
  ++  blocked-by-ship
    |=  s=ship:c
    %-  pairs
    :~  blocked-by/s/(scot %p s)
    ==
  ::
  ++  unblocked-by-ship
    |=  s=ship:c
    %-  pairs
    :~  unblocked-by/s/(scot %p s)
    ==
  ::
  ++  block-ship
    |=  s=ship:c
    %-  pairs
    :~  ship/s/(scot %p s)
    ==
  ::
  ++  unblock-ship
    |=  s=ship:c
    %-  pairs
    :~  ship/s/(scot %p s)
    ==
  ::
  ++  toggle-message
    |=  m=message-toggle:c
    %+  frond  -.m
    ?-  -.m
      %hide  (id id.m)
      %show  (id id.m)
    ==
  ::
  ++  hidden-messages
    |=  hm=hidden-messages:c
    a+(turn ~(tap in hm) id)
  ::
  ++  whom
    |=  w=whom:c
    ?-  -.w
      %ship  (scot %p p.w)
      %club  (scot %uv p.w)
    ==
  ::
  ++  unreads
    |=  bs=unreads:c
    %-  pairs
    %+  turn  ~(tap by bs)
    |=  [w=whom:c b=unread:unreads:c]
    [(whom w) (unread b)]
  ::
  ++  unread-update
    |=  u=update:unreads:c
    %-  pairs
    :~  whom/s/(whom p.u)
        unread/(unread q.u)
    ==
  ::
  ++  unread
    |=  b=unread:unreads:c
    %-  pairs
    :~  recency/(time recency.b)
        count/(numb count.b)
        threads/(unread-threads threads.b)
    ::
      :-  %unread
      ?~  unread.b  ~
      %-  pairs
      :~  id/(id id.u.unread.b)
          time/(time-id time.u.unread.b)
          count/(numb count.u.unread.b)
      ==
    ==
  ::
  ++  unread-threads
    |=  u=(map message-key:c [message-key:c @ud])
    %-  pairs
    %+  turn  ~(tap by u)
    |=  [top=message-key:c unread=message-key:c count=@ud]
    :-  (rap 3 (scot %p p.id.top) '/' (scot %ud q.id.top) ~)
    %-  pairs
    :~  parent-time/(time-id time.top)
        id/(id id.unread)
        time/(time-id time.unread)
        count/(numb count)
    ==
  ::
  ++  pins
    |=  ps=(list whom:c)
    %-  pairs
    :~  pins/a/(turn ps (cork whom (lead %s)))
    ==
  ::
  ++  blocked
    |=  bs=(set @p)
    %-  pairs
    :~  blocked/a/(turn ~(tap in bs) ship)
    ==
  ::
  ++  ship
    |=  her=@p
    n+(rap 3 '"' (scot %p her) '"' ~)
  ++  id
    |=  =id:c
    n+(rap 3 '"' (scot %p p.id) '/' (scot %ud q.id) '"' ~)
  ::
  ++  writs-diff
    |=  =diff:writs:c
    %-  pairs
    :~  id/(id p.diff)
        delta/(writs-delta q.diff)
    ==
  ::
  ++  writs-delta
    |=  =delta:writs:c
    %+  frond  -.delta
    ?-  -.delta
      %del       ~
      %add-react  (add-react +.delta)
      %del-react  (author:enjs:dj author.delta)
      %reply      (reply-delta +.delta)
    ::
        %add
      %-  pairs
      :~  essay+(essay:enjs:dj essay.delta)
          time+?~(time.delta ~ (time-id u.time.delta))
      ==
    ==
  ++  writs-response
    |=  [=whom:c =response:writs:c]
    %-  pairs
    :~  whom/s/(^whom whom)
        id/(id id.response)
        response/(response-delta response.response)
    ==
  ::
  ++  response-delta
    |=  delta=response-delta:writs:c
    %+  frond  -.delta
    ?-  -.delta
        %del       ~
        %add-react  (add-react [author react]:delta)
        %del-react  (author:enjs:dj author.delta)
        %reply     (reply-response-delta +.delta)
        %add
      %-  pairs
      :~  essay+(essay:enjs:dj essay.delta)
          time+(time-id time.delta)
      ==
    ==
  ::
  ++  reply-delta
    |=  [i=id:c meta=(unit reply-meta:c) =delta:replies:c]
    ^-  json
    %-  pairs
    :~  id+(id i)
        meta+?~(meta ~ (reply-meta:enjs:dj u.meta))
        :-  %delta
        %+  frond  -.delta
        ?-  -.delta
          %del       ~
          %add-react  (add-react +.delta)
          %del-react  (author:enjs:dj author.delta)
        ::
            %add
          %-  pairs
          :~  memo+(memo:enjs:dj memo.delta)
              time+?~(time.delta ~ (time-id u.time.delta))
          ==
        ==
    ==
  ++  reply-response-delta
    |=  [i=id:c meta=(unit reply-meta:c) delta=response-delta:replies:c]
    ^-  json
    %-  pairs
    :~  id+(id i)
        meta+?~(meta ~ (reply-meta:enjs:dj u.meta))
        :-  %delta
        %+  frond  -.delta
        ?-  -.delta
          %del       ~
          %add-react  (add-react +.delta)
          %del-react  (author:enjs:dj author.delta)
        ::
            %add
          %-  pairs
          :~  memo+(memo:enjs:dj memo.delta)
              time+(time-id time.delta)
          ==
        ==
    ==
  ++  add-react
    |=  [=author:c =react:c]
    %-  pairs
    :~  react+(react:enjs:dj react)
        author+(author:enjs:dj author)
    ==
  ::
  ++  dm-action
    |=  =action:dm:c
    %-  pairs
    :~  ship+(ship p.action)
        diff+(writs-diff q.action)
    ==
  ::
  ++  clubs
    |=  cs=(map id:club:c crew:club:c)
    %-  pairs
    %+  turn  ~(tap by cs)
    |=  [=id:club:c cr=crew:club:c]
    [(scot %uv id) (crew cr)]
  ::
  ++  crew
    |=  cr=crew:club:c
    %-  pairs
    :~  team/a/(turn ~(tap in team.cr) ship)
        hive/a/(turn ~(tap in hive.cr) ship)
        meta/(meta met.cr)
        net/s/net.cr
    ==
  ::
  ++  writ-list
    |=  w=(list writ:c)
    ^-  json
    a+(turn w writ)
  ::
  ++  writs
    |=  =writs:c
    ^-  json
    %-  pairs
    %+  turn  (tap:on:writs:c writs)
    |=  [key=@da w=writ:c]
    [(scot %ud key) (writ w)]
  ::
  ++  writ
    |=  =writ:c
    %-  pairs
    :~  seal+(seal -.writ)
        essay+(essay:enjs:dj +.writ)
    ==
  ::
  ++  chat-heads
    |=  heads=chat-heads:c
    :-  %a
    %+  turn  heads
    |=  [=whom:c recency=^time latest=(unit writ:c)]
    %-  pairs
    :~  whom+s+(^whom whom)
        recency+(time recency)
        latest+?~(latest ~ (writ u.latest))
    ==
  ::
  ++  paged-writs
    |=  pw=paged-writs:c
    %-  pairs
    :~  writs+(writs writs.pw)
        newer+?~(newer.pw ~ (time-id u.newer.pw))
        older+?~(older.pw ~ (time-id u.older.pw))
        total+(numb total.pw)
    ==
  ::
  ++  time-id
    |=  =@da
    s+`@t`(rsh 4 (scot %ui da))
  ::
  ++  seal
    |=  =seal:c
    %-  pairs
    :~  id+(id id.seal)
        time+(time-id time.seal)
        reacts+(reacts:enjs:dj reacts.seal)
        replies+(replies replies.seal)
        meta+(reply-meta:enjs:dj reply-meta.seal)
    ==
  ::
  ++  replies
    |=  =replies:c
    %-  pairs
    %+  turn  (tap:on:replies:c replies)
    |=  [key=@da q=reply:c]
    [(scot %ud key) (reply q)]
  ::
  ++  reply
    |=  =reply:c
    %-  pairs
    :~  seal+(reply-seal -.reply)
        memo+(memo:enjs:dj +.reply)
    ==
  ::
  ++  reply-seal
    |=  =reply-seal:c
    %-  pairs
    :~  id+(id id.reply-seal)
        parent-id+(id parent-id.reply-seal)
        time+(time-id time.reply-seal)
        reacts+(reacts:enjs:dj reacts.reply-seal)
    ==
  ::
  ++  reference
    |=  =reference:c
    %+  frond  -.reference
    ?-    -.reference
        %writ  (writ writ.reference)
        %reply
      %-  pairs
      :~  id-note+(id id.reference)
          reply+(reply reply.reference)
      ==
    ==
  ::
  ++  v7
    |%
    ++  club-action
      |=  a=action:club:old-3
      ^-  json
      %-  pairs
      :~  id/s/(scot %uv p.a)
          diff/(club-diff q.a)
      ==
    ::
    ++  club-diff
      |=  d=diff:club:old-3
      ^-  json
      %-  pairs
      :~  uid/s/(scot %uv p.d)
          delta/(club-delta q.d)
      ==
    ++  club-delta
      |=  d=delta:club:old-3
      %+  frond  -.d
      ?-  -.d
          %writ  (writs-diff diff.d)
      ::
          %meta  (meta meta.d)
      ::
          %team
        %-  pairs
        :~  ship/(ship ship.d)
            ok/b/ok.d
        ==
      ::
          %hive
        %-  pairs
        :~  by/(ship by.d)
            for/(ship for.d)
            add/b/add.d
        ==
      ::
          %init
        %-  pairs
        :~  team/a/(turn ~(tap in team.d) ship)
            hive/a/(turn ~(tap in hive.d) ship)
            meta/(meta met.d)
        ==
      ==
    ::
    ++  writs-diff
      |=  =diff:writs:old-3
      %-  pairs
      :~  id/(id p.diff)
          delta/(writs-delta q.diff)
      ==
    ::
    ++  writs-delta
      |=  =delta:writs:old-3
      %+  frond  -.delta
      ?-  -.delta
        %del       ~
        %add-react  (add-react +.delta)
        %del-react  (ship ship.delta)
        %reply      (reply-delta +.delta)
      ::
          %add
        %-  pairs
        :~  memo+(memo:v7:enjs:dj memo.delta)
            kind+?~(kind.delta ~ (pairs [%notice ~] ~))
            time+?~(time.delta ~ (time-id u.time.delta))
        ==
      ==
    ++  writs-response
      |=  [=whom:c =response:writs:old-3]
      %-  pairs
      :~  whom/s/(^whom whom)
          id/(id id.response)
          response/(response-delta response.response)
      ==
    ::
    ++  response-delta
      |=  delta=response-delta:writs:old-3
      %+  frond  -.delta
      ?-  -.delta
          %del       ~
          %add-react  (add-react [ship react]:delta)
          %del-react  (ship ship.delta)
          %reply     (reply-response-delta +.delta)
          %add
        %-  pairs
        :~  memo+(memo:v7:enjs:dj memo.delta)
            time+(time-id time.delta)
        ==
      ==
    ::
    ++  reply-delta
      |=  [i=id:c meta=(unit reply-meta:old-3) =delta:replies:old-3]
      ^-  json
      %-  pairs
      :~  id+(id i)
          meta+?~(meta ~ (reply-meta:v7:enjs:dj u.meta))
          :-  %delta
          %+  frond  -.delta
          ?-  -.delta
            %del       ~
            %add-react  (add-react +.delta)
            %del-react  (ship ship.delta)
          ::
              %add
            %-  pairs
            :~  memo+(memo:v7:enjs:dj memo.delta)
                time+?~(time.delta ~ (time-id u.time.delta))
            ==
          ==
      ==
    ++  reply-response-delta
      |=  [i=id:c meta=(unit reply-meta:old-3) delta=response-delta:replies:old-3]
      ^-  json
      %-  pairs
      :~  id+(id i)
          meta+?~(meta ~ (reply-meta:v7:enjs:dj u.meta))
          :-  %delta
          %+  frond  -.delta
          ?-  -.delta
            %del       ~
            %add-react  (add-react +.delta)
            %del-react  (ship ship.delta)
          ::
              %add
            %-  pairs
            :~  memo+(memo:v7:enjs:dj memo.delta)
                time+(time-id time.delta)
            ==
          ==
      ==
    ::
    ++  add-react
      |=  [her=@p =react:old-3]
      %-  pairs
      :~  react+s+react
          ship+(ship her)
      ==
    ::
    ++  dm-action
      |=  =action:dm:old-3
      %-  pairs
      :~  ship+(ship p.action)
          diff+(writs-diff q.action)
      ==
    ::
    ++  writ-list
      |=  w=(list writ:old-3)
      ^-  json
      a+(turn w writ)
    ::
    ++  writs
      |=  =writs:old-3
      ^-  json
      %-  pairs
      %+  turn  (tap:on:writs:old-3 writs)
      |=  [key=@da w=writ:old-3]
      [(scot %ud key) (writ w)]
    ::
    ++  writ
      |=  =writ:old-3
      %-  pairs
      :~  seal+(seal -.writ)
          essay+(essay:v7:enjs:dj +.writ)
      ==
    ::
    ++  chat-heads
      |=  heads=chat-heads:old-3
      :-  %a
      %+  turn  heads
      |=  [=whom:c recency=^time latest=(unit writ:old-3)]
      %-  pairs
      :~  whom+s+(^whom whom)
          recency+(time recency)
          latest+?~(latest ~ (writ u.latest))
      ==
    ::
    ++  paged-writs
      |=  pw=paged-writs:old-3
      %-  pairs
      :~  writs+(writs writs.pw)
          newer+?~(newer.pw ~ (time-id u.newer.pw))
          older+?~(older.pw ~ (time-id u.older.pw))
          total+(numb total.pw)
      ==
    ::
    ++  time-id
      |=  =@da
      s+`@t`(rsh 4 (scot %ui da))
    ::
    ++  seal
      |=  =seal:old-3
      %-  pairs
      :~  id+(id id.seal)
          time+(time-id time.seal)
          reacts+(reacts:v7:enjs:dj reacts.seal)
          replies+(replies replies.seal)
          meta+(reply-meta:v7:enjs:dj meta.seal)
      ==
    ::
    ++  replies
      |=  =replies:old-3
      %-  pairs
      %+  turn  (tap:on:replies:old-3 replies)
      |=  [key=@da q=reply:old-3]
      [(scot %ud key) (reply q)]
    ::
    ++  reply
      |=  =reply:old-3
      %-  pairs
      :~  seal+(reply-seal -.reply)
          memo+(memo:v7:enjs:dj +.reply)
      ==
    ::
    ++  reply-seal
      |=  =reply-seal:old-3
      %-  pairs
      :~  id+(id id.reply-seal)
          parent-id+(id parent-id.reply-seal)
          time+(time-id time.reply-seal)
          reacts+(reacts:v7:enjs:dj reacts.reply-seal)
      ==
    ::
    ++  reference
      |=  =reference:old-3
      %+  frond  -.reference
      ?-    -.reference
          %writ  (writ writ.reference)
          %reply
        %-  pairs
        :~  id-note+(id id.reference)
            reply+(reply reply.reference)
        ==
      ==
    --
  --
++  dejs
  =,  dejs:format
  |%
  ++  rsvp
    %-  ot
    :~  ship/(se %p)
        ok/bo
    ==
  ::
  ++  block-ship
    %-  ot
    :~  ship/(se %p)
    ==
  ::
  ++  unblock-ship
    %-  ot
    :~  ship/(se %p)
    ==
  ::
  ++  club-rsvp
    %-  ot
    :~  id/(se %uv)
        ship/(se %p)
        ok/bo
    ==
  ::
  ++  pins
    %-  ot
    :~  pins/(ar whom)
    ==
  ::
  ++  blocked
    %-  ot
    :~  blocked/(as ship)
    ==
  ++  whom
    ^-  $-(json whom:c)
    %-  su
    ;~  pose
      (stag %ship ;~(pfix sig fed:ag))
      (stag %club club-id-rule)
    ==
  ++  remark-action
    %-  ot
    :~  whom/whom
        diff/remark-diff
    ==
  ::
  ++  remark-diff
    %-  of
    :~  read/ul
        watch/ul
        unwatch/ul
    ==
  ++  ship  (su ;~(pfix sig fed:ag))
  ++  club-id-rule
    (cook |=(@ `@uv`+<) ;~(pfix (jest '0v') viz:ag))
  ++  club-id  (su club-id-rule)
  ++  club-create
    ^-  $-(json create:club:c)
    %-  ot
    :~  id/(se %uv)
        hive/(as (se %p))
    ==
  ::
  ++  club-action
    ^-  $-(json action:club:c)
    %-  ot
    :~  id/(se %uv)
        diff/club-diff
    ==
  ::
  ++  club-action-0
    ^-  $-(json action:club:c)
    %-  ot
    :~  id/(se %uv)
        diff/club-diff-0
    ==
  ::
  ++  club-diff
    ^-  $-(json diff:club:c)
    %-  ot
    :~  echo/ni
        delta/club-delta
    ==
  ::
  ++  club-diff-0
    ^-  $-(json diff:club:c)
    %-  ot
    :~  uid/(se %uv)
        delta/club-delta
    ==
  ::
  ++  meta
    %-  ot
    :~  title/so
        description/so
        image/so
        cover/so
    ==
  ::
  ++  club-delta
    %-  of
    :~
      writ/writs-diff
      meta/meta
    ::
      :-  %team
      %-  ot
      :~  ship/(se %p)
          ok/bo
      ==
    ::
      :-  %hive
      %-  ot
      :~  by/(se %p)
          for/(se %p)
          add/bo
      ==
    ==
  ::
  ++  dm-action
    ^-  $-(json action:dm:c)
    %-  ot
    :~  ship/ship
        diff/writs-diff
    ==
  ::
  ++  id
    ^-  $-(json id:c)
    %-  su
    %+  cook  |=([p=@p q=@] `id:c`[p `@da`q])
    ;~((glue fas) ;~(pfix sig fed:ag) dem:ag)
  ::
  ++  writs-diff
    ^-  $-(json diff:writs:c)
    %-  ot
    :~  id/id
        delta/writs-delta
    ==
  ++  essay
    ^-  $-(json essay:c)
    %+  cu
      |=  $:  =story:d  =author:c  =time
              kind=[%chat path]  meta=(unit data:^^meta)
              blob=(unit @t)
          ==
      `essay:c`[[story author time] kind meta blob]
    %-  ot
    :~  content/story:dejs:dj
        author/author:dejs:dj
        sent/di
        :-  %kind
        (cu |=(=path ?>(?=([%chat *] path) path)) pa)
        ::
        meta/(mu meta)
        blob/(mu so)
    ==
  ++  writs-delta
    ^-  $-(json delta:writs:c)
    %-  of
    :~  del/ul
        add-react/add-react
        del-react/author:dejs:dj
        reply/reply-delta
    ::
      :-  %add
      ^-  $-(json [=essay:c time=(unit time)])
      %-  ot
      :~  essay/essay
          time/(mu (se %ud))
      ==
    ==
  ::
  ++  reply-delta
    ^-  $-(json [id:c (unit reply-meta:c) delta:replies:c])
    %-  ot
    :~  id/id
        meta/ul
        :-  %delta
        %-  of
        :~  del/ul
            add-react/add-react
            del-react/author:dejs:dj
        ::
          :-  %add
          ^-  $-(json [=memo:d time=(unit time)])
          %-  ot
          :~  memo/memo:dejs:dj
              time/(mu (se %ud))
          ==
        ==
    ==
  ++  add-sects  (as (se %tas))
  ::
  ++  del-sects  (as so)
  ::
  ++  add-react
    %-  ot
    :~  author/author:dejs:dj
        react/react:dejs:dj
    ==
  ::
  ++  toggle-message
    ^-  $-(json message-toggle:c)
    %-  of
    :~  hide/id
        show/id
    ==
  ::
  ++  v7
    |%
    ::
    ++  club-action-1  club-action
    ++  club-action
      ^-  $-(json action:club:old-3)
      %-  ot
      :~  id/(se %uv)
          diff/club-diff
      ==
    ::
    ++  club-action-0
      ^-  $-(json action:club:old-3)
      %-  ot
      :~  id/(se %uv)
          diff/club-diff-0
      ==
    ::
    ++  club-diff-1  club-diff
    ++  club-diff
      ^-  $-(json diff:club:old-3)
      %-  ot
      :~  echo/ni
          delta/club-delta
      ==
    ::
    ++  club-diff-0
      ^-  $-(json diff:club:old-3)
      %-  ot
      :~  uid/(se %uv)
          delta/club-delta
      ==
    ::
    ++  club-delta
      %-  of
      :~
        writ/writs-diff
        meta/meta
      ::
        :-  %team
        %-  ot
        :~  ship/(se %p)
            ok/bo
        ==
      ::
        :-  %hive
        %-  ot
        :~  by/(se %p)
            for/(se %p)
            add/bo
        ==
      ==
    ::
    ++  dm-action
      ^-  $-(json action:dm:old-3)
      %-  ot
      :~  ship/ship
          diff/writs-diff
      ==
    ::
    ++  writs-diff
      ^-  $-(json diff:writs:old-3)
      %-  ot
      :~  id/id
          delta/writs-delta
      ==
    ++  writs-delta
      ^-  $-(json delta:writs:old-3)
      %-  of
      :~  del/ul
          add-react/add-react
          del-react/ship
          reply/reply-delta
      ::
        :-  %add
        ^-  $-(json [=memo:v7:old:d =kind:old-3 time=(unit time)])
        %-  ot
        :~  memo/memo:v7:dejs:dj
            kind/chat-kind:dejs:dj
            time/(mu (se %ud))
        ==
      ==
    ::
    ++  reply-delta
      ^-  $-(json [id:c (unit reply-meta:old-3) delta:replies:old-3])
      %-  ot
      :~  id/id
          meta/ul
          :-  %delta
          %-  of
          :~  del/ul
              add-react/add-react
              del-react/ship
          ::
            :-  %add
            ^-  $-(json [=memo:v7:old:d time=(unit time)])
            %-  ot
            :~  memo/memo:v7:dejs:dj
                time/(mu (se %ud))
            ==
          ==
      ==
    ::
    ++  add-react
      %-  ot
      :~  ship/ship
          react/so
      ==
    --
  --
--
