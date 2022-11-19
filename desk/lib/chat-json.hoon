/-  c=chat
/-  meta
/+  cite=cite-json
|%
++  enjs
  =,  enjs:format
  |%
  ++  flag
    |=  f=flag:c
    ^-  json
    s/(rap 3 (scot %p p.f) '/' q.f ~)
  ::
  ++  said
    |=  s=said:c
    ^-  json
    %-  pairs
    :~  flag/(flag p.s)
        writ/(writ q.s)
    ==
  ::
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

  ++  draft
    |=  d=draft:c
    %-  pairs
    :~  whom/s/(whom p.d)
        story/(story q.d)
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
      %flag  (crip "{(scow %p p.p.w)}/{(trip q.p.w)}")
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
    :~  pins/a/(turn ps (cork whom (lead %s)))
    ==
  ::
  ++  chats
    |=  cs=(map flag:c chat:c)
    %-  pairs
    %+  turn  ~(tap by cs)
    |=  [f=flag:c ch=chat:c]
    [(rap 3 (scot %p p.f) '/' q.f ~) (chat ch)]
  ++  chat
    |=  ch=chat:c
    %-  pairs
    :~  perms/(perm perm.ch)
    ==
  ++  perm
    |=  p=perm:c
    %-  pairs
    :~  writers/a/(turn ~(tap in writers.p) (lead %s))
        group/(flag group.p)
    ==
  ++  ship
    |=  her=@p
    n+(rap 3 '"' (scot %p her) '"' ~)
  ++  id 
    |=  =id:c
    n+(rap 3 '"' (scot %p p.id) '/' (scot %ud q.id) '"' ~)
  ::
  ++  action
    |=  =action:c
    %-  pairs
    :~  flag/(flag p.action)
        update/(update q.action)
    ==
  ::
  ++  update
    |=  =update:c
    %-  pairs
    :~  time+s+(scot %ud p.update)
        diff+(diff q.update)
    ==
  ::
  ++  diff
    |=  =diff:c
    %+  frond  -.diff
    ?+  -.diff  ~
      %writs     (writs-diff p.diff)
      %add-sects  a/(turn ~(tap in p.diff) (lead %s))
      %del-sects  a/(turn ~(tap in p.diff) (lead %s))
    ==
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
      %add       (memo p.delta)
      %del       ~
      %add-feel  (add-feel +.delta)
      %del-feel  (ship p.delta)
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
  ++  memo 
    |=  =memo:c
    %-  pairs
    :~  replying+?~(replying.memo ~ (id u.replying.memo))
        author+(ship author.memo)
        sent+(time sent.memo)
        content+(content content.memo)
    ==
  ::
  ++  block
    |=  b=block:c
    ^-  json
    %+  frond  -.b
    ?-  -.b
        %cite  (enjs:cite cite.b)
        %image
      %-  pairs
      :~  src+s+src.b
          height+(numb height.b)
          width+(numb width.b)
          alt+s+alt.b
      ==
      
    ==
  ++  crew
    |=  cr=crew:club:c
    %-  pairs
    :~  team/a/(turn ~(tap in team.cr) ship)
        hive/a/(turn ~(tap in hive.cr) ship)
        meta/(meta met.cr)
        net/s/net.cr
    ==
  ::
  ++  notice
    |=  n=notice:c
    %-  pairs
    :~  pfix/s/pfix.n
        sfix/s/sfix.n
    ==
  ::
  ++  content
    |=  c=content:c
    %+  frond  -.c
    ?-  -.c
      %story   (story p.c)
      %notice  (notice p.c)
    ==
  ::
  ++  story
    |=  s=story:c
    %-  pairs
    :~  block/a/(turn p.s block)
        inline/a/(turn q.s inline)
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
    ==
  ::
  ++  seal
    |=  =seal:c
    %-  pairs
    :~  id+(id id.seal)
    ::
        :-  %feels
        %-  pairs
        %+  turn  ~(tap by feels.seal)
        |=  [her=@p =feel:c]
        [(scot %p her) s+feel]
    ::
        :-  %replied
        :-  %a
        (turn ~(tap in replied.seal) |=(i=id:c (id i)))
    ==
  ++  writ
    |=  =writ:c
    %-  pairs
    :~  seal+(seal -.writ)
        memo+(memo +.writ)
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

  --
++  dejs
  =,  dejs:format
  |%
  ++  draft
    %-  ot
    :~  whom/whom
        story/story
    ==
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
      (stag %flag flag-rule)
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
  ++  create
    ^-  $-(json create:c)
    %-  ot
    :~  group+flag
        name+(se %tas)
        title+so
        description+so
        readers+(as (se %tas))
        writers+(as (se %tas))
    ==
  ++  ship  (su ;~(pfix sig fed:ag))
  ++  flag  `$-(json flag:c)`(su flag-rule)
  ++  flag-rule  ;~((glue fas) ;~(pfix sig fed:ag) sym)
  ++  club-id-rule
    (cook |=(@ `@uv`+<) ;~(pfix (jest '0v') viz:ag))
  ++  club-id  (su club-id-rule)
  ++  action
    ^-  $-(json action:c)
    %-  ot
    :~  flag+flag
        update+update
    ==
  ::
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
  ++  club-diff
    ^-  $-(json diff:club:c)
    %-  ot
    :~  echo/ni
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
  ++  update
    |=  j=json
    ^-  update:c
    ?>  ?=(%o -.j)
    [*time (diff (~(got by p.j) %diff))]
  ::
  ++  diff
    ^-  $-(json diff:c)
    %-  of
    :~  writs/writs-diff
        add-sects/add-sects
        del-sects/del-sects
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
    :~  add/memo
        del/ul
        add-feel/add-feel
        del-feel/ship
    ==
  ::
  ++  add-sects  (as (se %tas))
  ::
  ++  del-sects  (as (se %tas))
  ::
  ++  add-feel
    %-  ot
    :~  ship/ship
        feel/so
    ==
  ::
  ++  memo
    ^-  $-(json memo:c)
    %-  ot
    :~  replying/(mu id)
        author/ship
        sent/di
        content/content
    ==
  ::
  ++  content
    %-  of
    :~  story/story
        notice/notice
    ==
  ::
  ++  notice
    %-  ot
    :~  pfix/so
        sfix/so
    ==
  ::
  ++  story
    ^-  $-(json story:c)
    %-  ot
    :~  block/(ar block)
        inline/(ar inline)
    ==
  ::
  ++  block
    |=  j=json
    ^-  block:c
    %.  j
    %-  of
    :~  cite/dejs:cite
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
        ship/(se %p)
        blockquote/(ar inline)
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
  --
--
