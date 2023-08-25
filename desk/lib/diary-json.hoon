/-  d=diary
/-  meta
/+  cite=cite-json, gj=groups-json
|%
++  enjs
  =,  enjs:format
  |%
  +|  %responses
  ::
  ++  r-shelf
    |=  [=flag:d =r-diary:d]
    %-  pairs
    :~  flag+(^flag flag)
        r-diary+(^r-diary r-diary)
    ==
  ::
  ++  r-diary
    |=  =r-diary:d
    %+  frond  -.r-diary
    ?-  -.r-diary
      %notes    (pairs id+(id id.r-diary) r-note+(r-note r-note.r-diary) ~)
      %order    (order order.r-diary)
      %view     s+view.r-diary
      %sort     s+sort.r-diary
      %perm     (perm perm.r-diary)
    ::
      %read     ~
      %read-at  s+(scot %ud time.r-diary)
      %watch    ~
      %unwatch  ~
    ==
  ::
  ++  r-note
    |=  =r-note:d
    %+  frond  -.r-note
    ?-  -.r-note
      %set    ?~(note.r-note ~ (rr-note u.note.r-note))
      %quip   (pairs id+(id id.r-note) r-quip+(r-quip r-quip.r-note) ~)
      %feels  (feels feels.r-note)
      %essay  (essay essay.r-note)
    ==
  ::
  ++  r-quip
    |=  =r-quip:d
    %+  frond  -.r-quip
    ?-  -.r-quip
      %set    ?~(quip.r-quip ~ (rr-quip u.quip.r-quip))
      %feels  (feels feels.r-quip)
    ==
  ::
  +|  %rr
  ::
  ++  rr-shelf
    |=  =rr-shelf:d
    %-  pairs
    %+  turn  ~(tap by rr-shelf)
    |=  [f=flag:d di=rr-diary:d]
    [(rap 3 (scot %p p.f) '/' q.f ~) (rr-diary di)]
  ::
  ++  rr-diary
    |=  =rr-diary:d
    %-  pairs
    :~  notes+(rr-notes notes.rr-diary)
        order+(order order.rr-diary)
        view+s+view.rr-diary
        sort+s+sort.rr-diary
        perm+(perm perm.rr-diary)
    ==
  ::
  ++  rr-notes
    |=  notes=(map id-note:d rr-note:d)
    %-  pairs
    %+  turn  (tap:rr-on-notes:d notes)
    |=  [id=id-note:d =rr-note:d]
    [(scot %ud id) (^rr-note rr-note)]
  ::
  ++  rr-note
    |=  [=rr-seal:d =essay:d]
    %-  pairs
    :~  seal+(^rr-seal rr-seal)
        essay+(^essay essay)
        type+s+%note
    ==
  ::
  ++  rr-quip
    |=  [=rr-cork:d =memo:d]
    %-  pairs
    :~  cork+(^rr-cork rr-cork)
        memo+(^memo memo)
    ==
  ::
  ++  rr-seal
    |=  =rr-seal:d
    %-  pairs
    :~  time+(time time.rr-seal)
        feels+(feels feels.rr-seal)
      ::
        :-  %quips
        %-  pairs
        %+  turn  (tap:rr-on-quips:d rr-quips.rr-seal)
        |=  [t=@da =rr-quip:d]
        [(scot %ud t) (^rr-quip rr-quip)]
    ==
  ::
  ++  rr-cork
    |=  =rr-cork:d
    %-  pairs
    :~  time+(time time.rr-cork)
        feels+(feels feels.rr-cork)
    ==
  ::
  +|  %primitives
  ::
  ++  diary
    |=  di=diary:d
    %-  pairs
    :~  order+(order order.order.global.di)
        perms+(perm perm.perm.global.di)
        view+s+view.view.global.di
        sort+s+sort.sort.global.di
        saga+(saga net.local.di)
    ==
  ::
  ++  id
    |=  =@da
    s+(scot %ud da)
  ::
  ++  time
    |=  =@da
    s+(scot %ud da)
  ::
  ++  flag
    |=  f=flag:d
    ^-  json
    s/(rap 3 (scot %p p.f) '/' q.f ~)
  ::
  ++  ship
    |=  her=@p
    n+(rap 3 '"' (scot %p her) '"' ~)
  ::
  ++  order
    |=  a=arranged-notes:d
    :-  %a
    =/  times=(list time:..zuse)  ?~(a ~ u.a)
    (turn times id)
  ::
  ++  perm
    |=  p=perm:d
    %-  pairs
    :~  writers/a/(turn ~(tap in writers.p) (lead %s))
        group/(flag group.p)
    ==
  ::
  ++  saga
    |=  n=net:d
    ?-  -.n
      %pub  ~
      %sub  (saga:enjs:gj saga.n)
    ==
  ::
  ++  feels
    |=  feels=(map ship:..zuse feel:d)
    ^-  json
    %-  pairs
    %+  turn  ~(tap by feels)
    |=  [her=@p =feel:d]
    [(scot %p her) s+feel]
  ::
  ++  essay
    |=  =essay:d
    %-  pairs
    :~  title/s/title.essay
        image/s/image.essay
        content/a/(turn content.essay verse)
        author+(ship author.essay)
        sent+(time sent.essay)
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
    ==
  ::
  ++  story
    |=  s=story:d
    ^-  json
    %-  pairs
    :~  block/a/(turn p.s block)
        inline/a/(turn q.s inline)
    ==
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
    |=  [f=flag:d b=brief:briefs:d]
    [(rap 3 (scot %p p.f) '/' q.f ~) (brief b)]
  ::
  ++  brief-update
    |=  u=update:briefs:d
    %-  pairs
    :~  flag/(flag p.u)
        brief/(brief q.u)
    ==
  ::
  ++  brief
    |=  b=brief:briefs:d
    %-  pairs
    :~  last/(time last.b)
        count/(numb count.b)
        read-id/?~(read-id.b ~ (time u.read-id.b))
    ==
  ::
  +|  %said
  ::
  ++  said
    |=  s=said:d
    ^-  json
    %-  pairs
    :~  flag/(flag p.s)
        outline/(outline q.s)
    ==
  ++  outline
    |=  o=outline:d
    %-  pairs
    :~  title/s/title.o
        image/s/image.o
        content/a/(turn content.o verse)
        author+(ship author.o)
        sent+(time sent.o)
        'quipCount'^(numb quips.o)
        quippers/a/(turn ~(tap in quippers.o) ship)
        type/s/%outline
    ==
  ::
  ++  outlines
    |=  os=outlines:d
    %-  pairs
    %+  turn  (tap:on:outlines:d os)
    |=  [t=@da o=outline:d]
    ^-  [cord json]
    [(scot %ud t) (outline o)]
  --
::
++  dejs
  =,  dejs:format
  |%
  +|  %actions
  ::
  ++  a-shelf  (ot flag+flag a-diary+a-diary ~)
  ++  a-diary
    ^-  $-(json a-diary:d)
    %-  of
    :~  create+create-diary
        join+flag
        leave+ul
        read+ul
        read-at+(se %ud)
        watch+ul
        unwatch+ul
      ::
        notes+a-note
        view+(su (perk %grid %list ~))
        sort+(su (perk %time %alpha %arranged ~))
        order+(mu (ar id))
        add-writers+add-sects
        del-writers+del-sects
    ==
  ::
  ++  a-note
    ^-  $-(json a-note:d)
    %-  of
    :~  add+essay
        edit+(ot id+id essay+essay ~)
        del+id
        quips+(ot id+id a-quip+a-quip ~)
        add-feel+(ot id+id ship+ship feel+so ~)
        del-feel+(ot id+id ship+ship ~)
    ==
  ::
  ++  a-quip
    ^-  $-(json a-quip:d)
    %-  of
    :~  add+memo
        del+id
        add-feel+(ot id+id ship+ship feel+so ~)
        del-feel+(ot id+id ship+ship ~)
    ==
  ::
  +|  %primitives
  ++  id    (se %ud)
  ++  ship  (su ;~(pfix sig fed:ag))
  ++  flag  `$-(json flag:d)`(su flag-rule)
  ++  flag-rule  ;~((glue fas) ;~(pfix sig fed:ag) sym)
  ++  create-diary
    ^-  $-(json create-diary:d)
    %-  ot
    :~  group+flag
        title+so
        description+so
        readers+(as (se %tas))
        writers+(as (se %tas))
    ==
  ::
  ++  add-sects  (as (se %tas))
  ++  del-sects  (as so)
  ::
  ++  story
    %-  ot
    :~  block/(ar block)
        inline/(ar inline)
    ==
  ::
  ++  essay
    ^-  $-(json essay:d)
    %-  ot
    :~  title/so
        image/so
        content/(ar verse)
        author/ship
        sent/di
    ==
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
      :~  type/(su (perk %ordered %unordered ~))
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
        author/(se %p)
        sent/di
    ==
  --
--
