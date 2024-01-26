/-  g=groups, u=ui, e=epic, zer=groups-0
/-  meta
|%
++  enjs
  =,  enjs:format
  |%
  ++  nest
    |=  n=nest:g
    (rap 3 p.n '/' (flag q.n) ~)
  ::
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
        secret+b+secret.p
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
      %secret   b/p.d
      %del      ~
      %flag-content  (flag-content +:d)
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
      ?(%add %edit)             (channel channel.d)
      %del                      ~
      ?(%add-sects %del-sects)  a/(turn ~(tap in sects.d) (lead %s))
      %zone                     s/zone.d
      %join                     b/join.d
    ==
  ::
  ++  cabal-diff
    |=  d=diff:cabal:g
    %+  frond  -.d
    ?-  -.d
      %add  (meta meta.d)
      %edit  (meta meta.d)
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
  ++  flag-content
    |=  [n=nest:g =post-key:g src=@p]
    %-  pairs
    :~  nest/s/(nest n)
        src/(ship src)
        :-  %post
        %-  pairs
        :~  post/(time-id post.post-key)
            reply/?~(reply.post-key ~ (time-id u.reply.post-key))
        ==
    ==
  ::
  ++  groups
    |=  gs=groups:g
    %-  pairs
    %+  turn  ~(tap by gs)
    |=  [f=flag:g gr=group:g]
    [(flag f) (group gr)]
  ::
  ++  groups-ui
    |=  gs=groups-ui:g
    %-  pairs
    %+  turn  ~(tap by gs)
    |=  [f=flag:g gr=group-ui:g]
    [(flag f) (group-ui gr)]
  ::
  ++  groups-ui-v0
    |=  gs=groups-ui:zer
    %-  pairs
    %+  turn  ~(tap by gs)
    |=  [f=flag:g gr=group-ui:zer]
    [(flag f) (group-ui-v0 gr)]
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
        secret/b/secret.gr
        flagged-content/(flagged-content flagged-content.gr)
    ==
  ::
  ++  group-ui
    |=  gr=group-ui:g
    %-  pairs
    :~  fleet/(fleet fleet.gr)
        cabals/(cabals cabals.gr)
        zones/(zones zones.gr)
        zone-ord/a/(turn zone-ord.gr (lead %s))
        channels/(channels channels.gr)
        bloc/a/(turn ~(tap in bloc.gr) (lead %s))
        cordon/(cordon cordon.gr)
        meta/(meta meta.gr)
        secret/b/secret.gr
        saga/?~(saga.gr ~ (saga u.saga.gr))
        flagged-content/(flagged-content flagged-content.gr)
    ==
  ::
  ++  group-ui-v0
    |=  gr=group-ui:zer
    %-  pairs
    :~  fleet/(fleet fleet.gr)
        cabals/(cabals cabals.gr)
        zones/(zones zones.gr)
        zone-ord/a/(turn zone-ord.gr (lead %s))
        channels/(channels channels.gr)
        bloc/a/(turn ~(tap in bloc.gr) (lead %s))
        cordon/(cordon cordon.gr)
        meta/(meta meta.gr)
        secret/b/secret.gr
        saga/?~(saga.gr ~ (saga u.saga.gr))
    ==
  ::
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
  ::
  ++  saga
    |=  s=saga:e
    %-  frond
    ?-  -.s
      %dex  ahead/s/(scot %ud ver.s)
      %chi  synced/~
      %lev  behind/~
    ==
  ::
  ++  whom
    |=  w=whom:u
    :-  %s
    ?-  w
      [%group *]       (flag flag.w)
      [%channel *]     (nest nest.w)
      [%chat %ship *]  (scot %p p.whom.w)
      [%chat %club *]  (scot %uv p.whom.w)
    ==
  ++  flagged-content
    |=  fc=flagged-content:g
    =-
      %-  pairs
      %+  turn  ~(tap by -)
      |=  [n=nest:g posts=(map ^time flagged-data)]
      :-  (nest n)
      ::  object so we can easily check if it's in the set
      %-  pairs
      %+  turn  ~(tap by posts)
      |=  [post=^time data=flagged-data]
      :-  `@t`(rsh 4 (scot %ui post))
      %-  pairs
      :~  flagged/b/flagged.data
          flaggers/a/(turn ~(tap in flaggers.data) ship)
          :-  %replies
          %-  pairs
          %+  turn  ~(tap by replies.data)
          |=  [reply=^time =flaggers:g]
          :-  `@t`(rsh 4 (scot %ui reply))
          a/(turn ~(tap in flaggers) ship)
      ==
    %-  ~(run by fc)
    |=  flags=(map post-key:g flaggers:g)
    %+  roll  ~(tap by flags)
    |=  [[pk=post-key:g flaggers=(set @p)] new-posts=(map ^time flagged-data)]
    ^-  (map ^time flagged-data)
    %+  ~(put by new-posts)  post.pk
    =/  =flagged-data  (~(gut by new-posts) post.pk *flagged-data)
    ?~  reply.pk  flagged-data(flagged &, flaggers flaggers)
    flagged-data(replies (~(put by replies.flagged-data) u.reply.pk flaggers))
  ::
  +$  flagged-data  [flagged=_| =flaggers:g replies=(map ^time flaggers:g)]
  ++  time-id
    |=  =@da
    s+`@t`(rsh 4 (scot %ui da))
  --
::
++  dejs
  =,  dejs:format
  |%
  ++  p
    |%
    ++  rank  (perk %czar %king %duke %earl %pawn ~)
    ++  ship  ;~(pfix sig fed:ag)
    ++  flag  ;~((glue fas) ship ^sym)
    ++  nest  ;~((glue fas) ^sym flag)
    --
  ++  sym  (se %tas)
  ++  ship  (se %p)
  ++  rank  (su rank:p)
  ++  flag  (su flag:p)
  ++  nest  (su nest:p)
  ++  whom
    ^-  $-(json whom:u)
    %-  su
    ;~  pose
      (stag %group flag:p)
      (stag %channel nest:p)
      (stag %chat (stag %ship ship:p))
      (stag %chat (stag %club (cook |=(@ `@uv`+<) ;~(pfix (jest '0v') viz:ag))))
    ==
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
        secret+bo
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
        secret/bo
        del/ul
        flag-content/flag-content
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
            idx/ni
        ==
    ==

  ::
  ++  channel-diff
    %-  of
    :~  add/channel
        edit/channel
        del/ul
        add-sects/(as sym)
        del-sects/(as so)
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
        readers/(as so)
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
        edit/meta
        del/ul
    ==
  ::
  ++  zone-diff
    %-  ot
    :~  zone/(se %tas)
        delta/zone-delta
    ==
  ::
  ++  flag-content
    %-  ot
    :~  nest/nest
        post-key/(ot post/(se %ud) reply/(mu (se %ud)) ~)
        src/ship
    ==
  ++  meta
    %-  ot
    :~  title/so
        description/so
        image/so
        cover/so
    ==
  ::
  ++  ui-action
    ^-  $-(json action:u)
    %-  of
    :~  pins+ui-pins-action
    ==
  ++  ui-pins-action
    ^-  $-(json a-pins:u)
    %-  of
    :~  add+whom
        del+whom
    ==
  --
--
