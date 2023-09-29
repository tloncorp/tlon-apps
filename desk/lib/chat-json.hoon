/-  c=chat, d=channel
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
  ++  whom
    |=  w=whom:c
    ?-  -.w
      %ship  (scot %p p.w)
      %club  (scot %uv p.w)
    ==
  ::
  ++  briefs
    |=  bs=briefs:c
    %-  pairs
    %+  turn  ~(tap by bs)
    |=  [w=whom:c b=brief:briefs:c]
    [(whom w) (brief b)]
  ::
  ++  brief-update
    |=  u=update:briefs:c
    %-  pairs
    :~  whom/s/(whom p.u)
        brief/(brief q.u)
    ==
  ::
  ++  brief
    |=  b=brief:briefs:c
    %-  pairs
    :~  last/(time last.b)
        count/(numb count.b)
        read-id/?~(read-id.b ~ (id u.read-id.b))
    ==
  ::
  ++  pins
    |=  ps=(list whom:c)
    %-  pairs
    :~  pins/a/(turn ps (^cork whom (lead %s)))
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
      %add-feel  (add-feel +.delta)
      %del-feel  (ship ship.delta)
      %quip      (quip-delta +.delta)
    ::
        %add
      %-  pairs
      :~  memo+(memo:enjs:dj memo.delta)
          kind+?~(kind.delta ~ (pairs notice/~ ~))
          time+?~(time.delta ~ (time u.time.delta))
      ==
    ==
  ::
  ++  quip-delta
    |=  [i=id:c meta=(unit quip-meta:c) =delta:quips:c]
    ^-  json
    %-  pairs
    :~  id+(id i)
        meta+?~(meta ~ (reply-meta:enjs:dj u.meta))
        :-  %delta
        %+  frond  -.delta
        ?-  -.delta
          %del       ~
          %add-feel  (add-feel +.delta)
          %del-feel  (ship ship.delta)
        ::
            %add
          %-  pairs
          :~  memo+(memo:enjs:dj memo.delta)
              time+?~(time.delta ~ (time u.time.delta))
          ==
        ==
    ==
  ++  add-feel
    |=  [her=@p =feel:c]
    %-  pairs
    :~  feel+s+feel
        ship+(ship her)
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
  ++  time-id
    |=  =@da
    s+`@t`(rsh 4 (scot %ui da))
  ::
  ++  seal
    |=  =seal:c
    %-  pairs
    :~  id+(id id.seal)
        time+(time-id time.seal)
        feels+(feels feels.seal)
        quips+(quips quips.seal)
        meta+(reply-meta:enjs:dj meta.seal)
    ==
  ::
  ++  feels
    |=  =feels:c
    %-  pairs
    %+  turn  ~(tap by feels)
    |=  [her=@p =feel:c]
    [(scot %p her) s+feel]
  ::
  ++  quips
    |=  =quips:c
    %-  pairs
    %+  turn  (tap:on:quips:c quips)
    |=  [key=@da q=quip:c]
    [(scot %ud key) (quip q)]
  ::
  ++  quip
    |=  =quip:c
    %-  pairs
    :~  cork+(cork -.quip)
        memo+(memo:enjs:dj +.quip)
    ==
  ::
  ++  cork
    |=  =cork:c
    %-  pairs
    :~  id+(id id.cork)
        parent-id+(id parent-id.cork)
        time+(time-id time.cork)
        feels+(feels feels.cork)
    ==
  ::
  ++  reference
    |=  =reference:c
    %+  frond  -.reference
    ?-    -.reference
        %writ  (writ writ.reference)
        %quip
      %-  pairs
      :~  id-note+(id id.reference)
          quip+(quip quip.reference)
      ==
    ==
  ::
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
  ++  writs-delta
    ^-  $-(json delta:writs:c)
    %-  of
    :~  del/ul
        add-feel/add-feel
        del-feel/ship
        quip/quip-delta
    ::
      :-  %add
      ^-  $-(json [=memo:d =kind:c time=(unit time)])
      %-  ot
      :~  memo/memo:dejs:dj
          kind/chat-kind:dejs:dj
          time/(mu di)
      ==
    ==
  ::
  ++  quip-delta
    ^-  $-(json [id:c (unit quip-meta:c) delta:quips:c])
    %-  ot
    :~  id/id
        meta/ul
        :-  %delta
        %-  of
        :~  del/ul
            add-feel/add-feel
            del-feel/ship
        ::
          :-  %add
          ^-  $-(json [=memo:d time=(unit time)])
          %-  ot
          :~  memo/memo:dejs:dj
              time/(mu di)
          ==
        ==
    ==
  ++  add-sects  (as (se %tas))
  ::
  ++  del-sects  (as so)
  ::
  ++  add-feel
    %-  ot
    :~  ship/ship
        feel/so
    ==
  --
--
