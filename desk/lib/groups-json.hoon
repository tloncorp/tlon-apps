/-  g=groups
|%
++  enjs
  =,  enjs:format
  |%
  ++  groups
    |=  gs=(map flag:g group:g)
    %-  pairs
    %+  turn  ~(tap by gs)
    |=  [f=flag:g gr=group:g]
    [(flag f) (group gr)]
  ::
  ++  group
    |=  gr=group:g
    %-  pairs
    :~  fleet/(fleet fleet.gr)
        cabals/(cabals cabals.gr)
        channels/(channels channels.gr)
        cordon/(cordon cordon.gr)
        meta/(meta meta.gr)
    ==
  ++  fleet
    |=  fl=fleet:g
    %-  pairs
    %+  turn  ~(tap by fl)
    |=  [her=@p v=vessel:fleet:g]
    ^-  [cord json]
    [(scot %p her) (vessel v)]
  ::
  ++  vessel
    |=  v=vessel:fleet:g
    %-  pairs
    :~  sects/a/(turn ~(tap in sects.v) (lead %s))
        joined/(time joined.v)
    ==
  ++  cabals
    |=  cs=(map sect:g cabal:g)
    %-  pairs
    %+  turn  ~(tap by cs)
    |=  [=term c=cabal:g]
    ^-  [cord json]
    [term (cabal c)]
  ::
  ++  cabal
    |=  c=cabal:g
    %-  pairs
    :~  meta/(meta meta.c)
    ==
  ++  flag
    |=  f=flag:g
    (rap 3 (scot %p p.f) '/' q.f ~)
  ::
  ++  channels
    |=  chs=(map flag:g channel:g)
    %-  pairs
    %+  turn  ~(tap by chs)
    |=  [f=flag:g c=channel:g]
    ^-  [cord json]
    [(flag f) (channel c)]
  ::
  ++  channel
    |=  ch=channel:g
    %-  pairs
    :~  meta/(meta meta.ch)
        added/(time added.ch)
    ==
  ::
  ++  cordon
    |=  c=cordon:g
    %-  pairs
    :~  [-.c ~]
    ==
  ::
  ++  meta
    |=  m=meta:g
    %-  pairs
    :~  title/s/title.m
        description/s/description.m
        image/s/image.m
    ==
  --
::
++  dejs
  =,  dejs:format
  |%
  ++  sym  (se %tas)
  ++  flag  (su ;~((glue fas) ;~(pfix sig fed:ag) ^sym))
  ++  create
    ^-  $-(json create:g)
    %-  ot
    :~  name+sym
        title+so
        description+so
    ==
  ++  action
    ^-  $-(json action:g)
    %-  ot
    :~  flag+flag
        update+update
    ==
  ++  update
    |=  j=json
    ^-  update:g
    ?>  ?=(%o -.j)
    [*time (diff (~(got by p.j) %diff))]
  ::
  ++  diff
    %-  of
    :~  cabal/(ot sect/sym diff/cabal-diff ~)
    ==
  ::
  ++  cabal-diff
    %-  of
    :~  add/meta
        del/ul
    ==
  ::
  ++  meta
    %-  ot
    :~  title/so
        description/so
        image/so
    ==
  --
--
