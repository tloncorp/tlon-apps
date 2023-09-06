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
  ++  r-shelf
    |=  [=nest:d =r-diary:d]
    %-  pairs
    :~  nest+(^nest nest)
        response+(^r-diary r-diary)
    ==
  ::
  ++  r-diary
    |=  =r-diary:d
    %+  frond  -.r-diary
    ?-  -.r-diary
      %notes   (rr-notes rr-notes.r-diary)
      %note    (pairs id+(id id.r-diary) r-note+(r-note r-note.r-diary) ~)
      %order    (order order.r-diary)
      %view     s+view.r-diary
      %sort     s+sort.r-diary
      %perm     (perm perm.r-diary)
    ::
      %create   (perm perm.r-diary)
      %join     (flag group.r-diary)
      %leave    ~
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
    |=  [n=nest:d di=rr-diary:d]
    [(nest-cord n) (rr-diary di)]
  ::
  ++  rr-diary
    |=  =rr-diary:d
    %-  pairs
    :~  notes+(rr-notes notes.rr-diary)
        order+(order order.rr-diary)
        view+s+view.rr-diary
        sort+s+sort.rr-diary
        perms+(perm perm.rr-diary)
    ==
  ::
  ++  rr-notes
    |=  notes=rr-notes:d
    %-  pairs
    %+  turn  (tap:rr-on-notes:d notes)
    |=  [id=id-note:d note=(unit rr-note:d)]
    [(scot %ud id) ?~(note ~ (rr-note u.note))]
  ::
  ++  rr-note
    |=  [=rr-seal:d =essay:d]
    %-  pairs
    :~  seal+(^rr-seal rr-seal)
        essay+(^essay essay)
        type+s+%note
    ==
  ::
  ++  rr-quips
    |=  quips=rr-quips:d
    %-  pairs
    %+  turn  (tap:rr-on-quips:d quips)
    |=  [t=@da =rr-quip:d]
    [(scot %ud t) (^rr-quip rr-quip)]
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
    :~  id+(id id.rr-seal)
        feels+(feels rr-feels.rr-seal)
        quips+(rr-quips rr-quips.rr-seal)
    ==
  ::
  ++  rr-cork
    |=  =rr-cork:d
    %-  pairs
    :~  id+(id id.rr-cork)
        feels+(feels rr-feels.rr-cork)
    ==
  ::
  +|  %primitives
  ::
  ++  diary
    |=  di=diary:d
    %-  pairs
    :~  order+(order order.order.di)
        perms+(perm perm.perm.di)
        view+s+view.view.di
        sort+s+sort.sort.di
        saga+(saga net.di)
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
    (rap 3 han.n '/' (scot %p ship.n) '/' name.n ~)
  ::
  ++  ship
    |=  her=@p
    n+(rap 3 '"' (scot %p her) '"' ~)
  ::
  ++  order
    |=  a=arranged-notes:d
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
  ++  saga
    |=  n=net:d
    (saga:enjs:gj saga.n)
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
        han-data+(han-data han-data.essay)
    ==
  ::
  ++  han-data
    |=  =han-data:d
    %+  frond  -.han-data
    ?-    -.han-data
      %heap   ?~(title.han-data ~ s+u.title.han-data)
      %chat   ?~(kind.han-data ~ (pairs notice+~ ~))
      %diary  (pairs title+s+title.han-data image+s+image.han-data ~)
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
  +|  %said
  ::
  ++  said
    |=  s=said:d
    ^-  json
    %-  pairs
    :~  nest/(nest p.s)
        outline/(outline q.s)
    ==
  ++  outline
    |=  o=outline:d
    %-  pairs
    :~  content+(story content.o)
        author+(ship author.o)
        sent+(time sent.o)
        han-data+(han-data han-data.o)
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
  ++  a-shelf
    ^-  $-(json a-shelf:d)
    %-  of
    :~  create+create-diary
        diary+(ot nest+nest action+a-diary ~)
    ==
  ++  a-diary
    ^-  $-(json a-diary:d)
    %-  of
    :~  join+flag
        leave+ul
        read+ul
        read-at+(se %ud)
        watch+ul
        unwatch+ul
      ::
        note+a-note
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
        quip+(ot id+id action+a-quip ~)
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
  ++  ship  `$-(json ship:z)`(su ship-rule)
  ++  han   `$-(json han:d)`(su han-rule)
  ++  flag  `$-(json flag:g)`(su flag-rule)
  ++  nest  `$-(json nest:d)`(su nest-rule)
  ++  ship-rule  ;~(pfix sig fed:ag)
  ++  han-rule   (sear (soft han:d) sym)
  ++  flag-rule  ;~((glue fas) ship-rule sym)
  ++  nest-rule  ;~((glue fas) han-rule ship-rule sym)
  ::
  ++  create-diary
    ^-  $-(json create-diary:d)
    %-  ot
    :~  han+han
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
      |=  [=story:d =ship:z =time:z =han-data:d]
      `essay:d`[[story ship time] han-data]
    %-  ot
    :~  content/story
        author/ship
        sent/di
        han-data/han-data
    ==
  ::
  ++  han-data
    ^-  $-(json han-data:d)
    %-  of
    :~  diary+(ot title+so image+so ~)
        heap+(mu so)
        chat+kind
    ==
  ::
  ++  kind
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
        author/ship
        sent/di
    ==
  --
--
