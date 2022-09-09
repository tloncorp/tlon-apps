/-  g=groups
/-  meta
|%
++  enjs
  =,  enjs:format
  |%
  ++  nest
    |=  n=nest:g
    (rap 3 p.n '/' (flag q.n) ~)
  ++  ship
    |=  her=@p
    s/(scot %p her)
  ::
  ++  action
    |=  a=action:g
    %-  pairs
    :~  flag/s/(flag p.a)
        update/(update q.a)
    ==
  ::
  ++  previews
    |=  ps=previews:g
    %-  pairs
    %+  turn  ~(tap by ps)
    |=  [f=flag:g p=preview:g]
    [(flag f) (preview p)]
  ::
  ++  channel-preview
    |=  p=preview:channel:g
    %-  pairs
    :~  nest+s+(nest nest.p)
        meta+(meta meta.p)
        group+(preview group.p)
    ==
  ::
  ++  preview
    |=  p=preview:g
    %-  pairs
    :~  flag+s+(flag flag.p)
        time+(time time.p)
        meta+(meta meta.p)
        cordon+(cordon cordon.p)
    ==
  ::
  ++  update
    |=  =update:g
    %-  pairs
    :~  time+s+(scot %ud p.update)
        diff+(diff q.update)
    ==
  ::
  ++  diff
    |=  d=diff:g
    %+  frond  -.d
    ?-    -.d
      %fleet    (pairs ships/a/(turn ~(tap in p.d) ship) diff/(fleet-diff q.d) ~)
      %channel  (pairs nest/s/(nest p.d) diff/(channel-diff q.d) ~)
      %cabal    (pairs sect/s/p.d diff/(cabal-diff q.d) ~)
      %bloc     (bloc-diff p.d)
      %cordon   (cordon-diff p.d)
      %create   (group p.d)
      %zone     (zone-diff p.d)
      %meta     (meta p.d)
      %del      ~
    ==
  ::
  ++  zone-diff
    |=  d=diff:zone:g
    %-  pairs
    :~  zone/s/p.d
        delta/(zone-delta q.d)
    ==
  ::
  ++  zone-delta
    |=  d=delta:zone:g
    %+  frond  -.d
    ?-  -.d
        %del           ~
        %mov           (numb idx.d)
        ?(%add %edit)  (meta meta.d)
        %mov-nest
      %-  pairs 
      :~  nest/s/(nest nest.d)
          idx/(numb idx.d)
      ==
    ==
  ::
  ++  bloc-diff
    |=  d=diff:bloc:g
    %+  frond  -.d
    a/(turn ~(tap in p.d) (lead %s))
  ::
  ++  cordon-diff
    |=  d=diff:cordon:g
    %+  frond  -.d
    ?-  -.d
      %open  (open-cordon-diff p.d)
      %shut  (shut-cordon-diff p.d)
      %swap  (cordon p.d)
    ==
  ::
  ++  open-cordon-diff
    |=  d=diff:open:cordon:g
    %+  frond  -.d
    ?-  -.d
      ?(%add-ships %del-ships)  a/(turn ~(tap in p.d) ship)
      ?(%add-ranks %del-ranks)  a/(turn ~(tap in p.d) (lead %s))
    ==
  ::
  ++  shut-cordon-diff
    |=  d=diff:shut:cordon:g
    %+  frond  -.d
    %-  pairs
    :~  kind/s/p.d
        ships/a/(turn ~(tap in q.d) ship)
    ==
  ::
  ++  channel-diff
    |=  d=diff:channel:g
    %+  frond  -.d
    ?-  -.d
      %add                      (channel channel.d)
      %del                      ~
      ?(%add-sects %del-sects)  a/(turn ~(tap in sects.d) (lead %s))
      %zone                 s/zone.d
      %join                     b/join.d
    ==
  ::
  ++  cabal-diff
    |=  d=diff:cabal:g
    %+  frond  -.d
    ?-  -.d
      %add  (meta meta.d)
      %del  ~
    ==
  ::
  ++  fleet-diff
    |=  d=diff:fleet:g
    %+  frond  -.d
    ?-  -.d
      %add  ~
      %del  ~
      %add-sects  a/(turn ~(tap in sects.d) (lead %s))
      %del-sects  a/(turn ~(tap in sects.d) (lead %s))
    ==
  ::
  ++  groups
    |=  gs=(map flag:g group:g)
    %-  pairs
    %+  turn  ~(tap by gs)
    |=  [f=flag:g gr=group:g]
    [(flag f) (group gr)]
  ::
  ++  gangs
    |=  gs=(map flag:g gang:g)
    %-  pairs
    %+  turn  ~(tap by gs)
    |=  [f=flag:g gr=gang:g]
    [(flag f) (gang gr)]
  ::
  ++  gang
    |=  ga=gang:g
    %-  pairs
    :~  claim/?~(cam.ga ~ (claim u.cam.ga))
        preview/?~(pev.ga ~ (preview u.pev.ga))
        invite/?~(vit.ga ~ (invite u.vit.ga))
    ==
  ::
  ++  claim
    |=  c=claim:g
    %-  pairs
    :~  join-all/b/join-all.c
        progress/s/`@t`progress.c
    ==
  ::
  ++  invite
    |=  i=invite:g
    %-  pairs
    :~  flag/s/(flag p.i)
        ship/(ship q.i)
    ==
  ::
  ++  zones
    |=  zons=(map zone:g realm:zone:g)
    %-  pairs
    %+  turn  ~(tap by zons)
    |=  [=zone:g r=realm:zone:g]
    ^-  [@t json]
    :-  zone
    %-  pairs
    :~  meta/(meta met.r)
        idx/a/(turn ord.r (cork nest (lead %s)))
    ==
  ::
  ++  group
    |=  gr=group:g
    %-  pairs
    :~  fleet/(fleet fleet.gr)
        cabals/(cabals cabals.gr)
        zones/(zones zones.gr)
        zone-ord/a/(turn zone-ord.gr (lead %s))
        channels/(channels channels.gr)
        bloc/a/(turn ~(tap in bloc.gr) (lead %s))
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
    |=  chs=(map nest:g channel:g)
    %-  pairs
    %+  turn  ~(tap by chs)
    |=  [n=nest:g c=channel:g]
    ^-  [cord json]
    [(nest n) (channel c)]
  ::
  ++  channel
    |=  ch=channel:g
    %-  pairs
    :~  meta/(meta meta.ch)
        added/(time added.ch)
        readers/a/(turn ~(tap in readers.ch) (lead %s))
        zone/s/zone.ch
        join/b/join.ch
    ==
  ::
  ++  cordon
    |=  c=cordon:g
    %+  frond  -.c
    ?-  -.c
      %open  (ban-cordon ban.c)
      %shut  (shut-cordon +.c)
      %afar  (afar-cordon +.c)
    ==
  ::
  ++  shut-cordon
    |=  [pend=(set @p) ask=(set @p)]
    %-  pairs
    :~  pending/a/(turn ~(tap in pend) ship)
        ask/a/(turn ~(tap in ask) ship)
    ==

  ::
  ++  afar-cordon
    |=  [app=flag:g pax=^path desc=@t]
    %-  pairs
    :~  app/s/(flag app)
        path/s/(spat pax)
        desc/s/desc
    ==
  ::
  ++  ban-cordon
    |=  b=ban:open:cordon:g
    %-  pairs
    :~  ships/a/(turn ~(tap in ships.b) ship)
        ranks/a/(turn ~(tap in ranks.b) (lead %s))
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
  --
::
++  dejs
  =,  dejs:format
  |%
  ++  sym  (se %tas)
  ++  ship  (se %p)
  ++  rank  (su (perk %czar %king %duke %earl %pawn ~))
  ++  flag  (su ;~((glue fas) ;~(pfix sig fed:ag) ^sym))
  ++  nest  (su ;~((glue fas) ^sym ;~(pfix sig fed:ag) ^sym))
  ++  create
    ^-  $-(json create:g)
    %-  ot
    :~  name+sym
        title+so
        description+so
        image+so
        cover+so
        cordon+cordon
        members+(op ;~(pfix sig fed:ag) (as sym))
    ==
  ::
  ++  join
    ^-  $-(json join:g)
    %-  ot
    :~  flag/flag
        join-all/bo
    ==
  ++  invite
    ^-  $-(json invite:g)
    %-  ot
    :~  flag/flag
        ship/ship
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
        fleet/(ot ships/(as ship) diff/fleet-diff ~)
        zone/zone-diff
        cordon/cordon-diff
        channel/(ot nest/nest diff/channel-diff ~)
        zone/zone-diff
        meta/meta
        del/ul
    ==
  ::
  ++  zone-delta
    %-  of
    :~  add/meta
        edit/meta
        del/ul
        mov/ni
        :-  %mov-nest
        %-  ot
        :~  nest/nest
            index/ni
        ==
    ==

  ::
  ++  channel-diff
    %-  of
    :~  add/channel
        del/ul
        add-sects/(as sym)
        del-sects/(as sym)
        zone/sym
        join/bo
    ==
  ::
  ++  channel
    %-  ot
    :~  meta/meta
        added/di
        zone/(se %tas)
        join/bo
        readers/(as sym)
    ==
  ++  cordon
    %-  of
    :~  open/open-cordon
        shut/shut-cordon
    ==
  ++  shut-cordon
    %-  ot
    :~  pending/(as ship)
        ask/(as ship)
    ==
  ::
  ++  open-cordon
    %-  ot
    :~  ships/(as ship)
        ranks/(as rank)
    ==
  ::
  ++  cordon-diff
    %-  of
    :~  open/open-cordon-diff
        shut/shut-cordon-diff
        swap/cordon
    ==
  ::
  ++  open-cordon-diff
    %-  of
    :~  add-ships/(as ship)
        del-ships/(as ship)
        add-ranks/(as rank)
        del-ranks/(as rank)
    ==
  ::
  ++  shut-cordon-diff
    |^
    %-  of
    :~  add-ships/body
        del-ships/body
    ==
    ++  body
      %-  ot
      :~  kind/(su (perk %ask %pending ~))
          ships/(as ship)
      ==
    --
  ::
  ++  fleet-diff
    %-  of
    :~  [%add ul]
        [%del ul]
        [%add-sects (as sym)]
        [%del-sects (as sym)]
    ==
  ::
  ++  cabal-diff
    %-  of
    :~  add/meta
        del/ul
    ==
  ::
  ++  zone-diff
    %-  ot
    :~  zone/(se %tas)
        delta/zone-delta
    ==
  ::
  ++  meta
    %-  ot
    :~  title/so
        description/so
        image/so
        cover/so
    ==
  --
--
