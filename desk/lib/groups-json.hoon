/-  g=groups, s=story, u=ui, e=epic, zer=groups-0
::XX use v0:g instead of /sur/groups-0
/-  meta
/+  sj=story-json
=*  z  ..zuse
|%
++  enjs
  =,  enjs:format
  |%
  ++  ship
    |=  her=@p
    s+(scot %p her)
  ::
  ++  print-flag
    |=  f=flag:g
    ^-  @t
    (rap 3 (scot %p p.f) '/' q.f ~)
  ++  flag
    |=  f=flag:g
    s+(print-flag f)
  ::
  ++  print-nest
    |=  n=nest:g
    ^-  @t
    (rap 3 p.n '/' (print-flag q.n) ~)
  ::
  ++  nest
    |=  n=nest:g
    s+(print-nest n)
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
  ++  group
    |=  group:v7:g
    ^-  json
    %-  pairs
    ^-  (list [@t json])
    :~  meta+(^meta meta)
      ::
        admissions+(^admissions admissions)
        seats+(^seats seats)
      ::
        roles+(^roles roles)
        admins+a+(turn ~(tap in admins) (lead %s))
      ::
        channels+(^channels channels)
        active-channels+a+(turn ~(tap in active-channels) nest)
      ::
        sections+(^sections sections)
        section-order+a+(turn section-order (lead %s))
      ::
        flagged-content+(^flagged-content flagged-content)
    ==
  ::
  ++  admissions
    |=  ad=admissions:v7:g
    |^
    ::XX some compiler bug prevents exposing admissions either
    ::   in the sample above, or using tiscom below
    %-  pairs
    :~  privacy+s+privacy.ad
        banned+(banned banned.ad)
        requests+(requests requests.ad)
        tokens+(tokens tokens.ad)
        ::XX referrals
        ::XX invited
    ==
    ::
    ++  banned
      |=  banned:v7:g
      ^-  json
      %-  pairs
      :~  ships+a+(turn ~(tap in ships) ship)
          ranks+a+(turn ~(tap in ranks) (lead %s))
      ==
    ::
    ++  requests
      |=  reqs=(map ship:z (unit story:s))
      %-  pairs
      %+  turn  ~(tap in reqs)
      |=  [=ship:z story=(unit story:s)]
      :-  (scot %p ship)
      ?~(story ~ (story:enjs:sj u.story))
    ::
    ++  tokens
      |=  tokens=(map token:v7:g token-meta:v7:g)
      %-  pairs
      %+  turn  ~(tap in tokens)
      |=  [=token:v7:g meta=token-meta:v7:g]
      [(scot %uv token) (token-meta meta)]
    ::
    ++  token
      |=  =token:v7:g
      s+(scot %uv token)
    ++  token-meta
      |=  token-meta:v7:g
      %-  pairs
      :~  scheme+(claim-scheme scheme)
          ::XX return time-id?
          expiry+s+(scot %da expiry)
          label+?~(label ~ s+u.label)
      ==
    ++  claim-scheme
      |=  scheme=claim-scheme:v7:g
      ^-  json
      ?-  -.scheme
        %forever   (frond %forever ~)
        %limited   (frond %limited (numb count.scheme))
        %personal  (frond %personal (ship ship.scheme))
      ==
    --
  ::
  ++  seats
    |=  seats=(map ship:z seat:v7:g)
    %-  pairs
    %+  turn  ~(tap in seats)
    |=  [=ship:z =seat:v7:g]
    [(scot %p ship) (^seat seat)]
  ::
  ++  seat
    |=  seat:v7:g
    ^-  json
    %-  pairs
    :~  roles+a+(turn ~(tap in roles) (lead %s))
        joined+(time joined)
    ==
  ::
  ++  roles
    |=  roles=(map role-id:g role:v7:g)
    %-  pairs
    %+  turn  ~(tap by roles)
    |=  [=role-id:g =role:v7:g]
    ^-  [@t json]
    [role-id (meta meta.role)]
  ::
  ++  channels
    |=  chans=(map nest:g channel:v7:g)
    %-  pairs
    %+  turn  ~(tap by chans)
    |=  [n=nest:g c=channel:v7:g]
    ^-  [@t json]
    [(print-nest n) (channel c)]
  ::
  ++  channel
    |=  ch=channel:v7:g
    %-  pairs
    :~  meta+(meta meta.ch)
        added+(time added.ch)
        section+s+section.ch
        readers+a+(turn ~(tap in readers.ch) (lead %s))
        join+b+join.ch
    ==
  ++  sections
    |=  sections=(map section-id:g section:v7:g)
    %-  pairs
    %+  turn  ~(tap by sections)
    |=  [=section-id:g =section:v7:g]
    ^-  [@t json]
    :-  section-id
    %-  pairs
    :~  meta+(meta meta.section)
        order+a+(turn order.section nest)
    ==
  ::
  ::XX deprecated?
  ++  saga
    |=  s=saga:e
    %-  frond
    ?-  -.s
      %dex  ahead/s/(scot %ud ver.s)
      %chi  synced/~
      %lev  behind/~
    ==
  ::XX deprecated?
  ++  whom
    |=  w=whom:u
    :-  %s
    ?-  w
      [%group *]       (print-flag flag.w)
      [%channel *]     (print-nest nest.w)
      [%chat %ship *]  (scot %p p.whom.w)
      [%chat %club *]  (scot %uv p.whom.w)
    ==
  ++  flagged-content
    |=  fc=flagged-content:g
    =-
      %-  pairs
      %+  turn  ~(tap by -)
      |=  [n=nest:g posts=(map ^time flagged-data)]
      :-  (print-nest n)
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
  ::
  ++  flag-content
    |=  [n=nest:g =post-key:g src=@p]
    %-  pairs
    :~  nest+(nest n)
        src+(ship src)
        :-  %post-key
        %-  pairs
        :~  post/(time-id post.post-key)
            reply/?~(reply.post-key ~ (time-id u.reply.post-key))
        ==
    ==
  ++  groups
    |=  gs=groups:v7:g
    %-  pairs
    %+  turn  ~(tap by gs)
    |=  [f=flag:g gr=group:v7:g]
    [(print-flag f) (group gr)]
  ++  time-id
    |=  =@da
    s+`@t`(rsh 4 (scot %ui da))
  ++  r-groups
    |=  =r-groups:v7:g
    ^-  json
    !!
  ++  preview-update
    |=  =preview-update:v7:g
    ^-  json
    !!
  :: ++  invites
  ::   |=  =invites:v7:g
  ::   ^-  json
  ::   %-  pairs
  ::   %+  turn  ~(tap by invites)
  ::   |=  [=flag:g invites=(list invite:v7:g)]
  ::   [(print-flag flag) a+(turn invites invite)]
  ++  token
    |=  =token:v7:g
    ^-  json
    s+(scot %uv token)
  ++  invite
    |=  invite:v7:g
    ^-  json
    %-  pairs
    :~  flag+(^flag flag)
        token+(^token token)
        from+(ship from)
        note+?~(note ~ (story:enjs:sj u.note))
        preview+(^preview preview)
    ==
  ++  preview
    |=  preview:v7:g
    ^-  json
    %-  pairs
    :~  flag+(^flag flag)
        meta+(^meta meta)
        time+(^time time)
        member-count+(numb member-count)
        privacy+s+privacy
    ==
  ::
  ++  foreigns
    |=  =foreigns:v7:g
    ^-  json
    ~&  %foreigns
    %-  pairs
    %+  turn  ~(tap by foreigns)
    |=  [=flag:g =foreign:v7:g]
    ~&  json-foreigns+flag
    [(print-flag flag) (^foreign foreign)]
  ::
  ++  foreign
    |=  foreign:v7:g
    ^-  json
    ~&  %json-foreign
    %-  pairs
    :~  preview+?~(preview ~ (^preview u.preview))
      ::
        :-  %invites  
        ?~  invites  ~
        :-  %a
        %+  turn  invites
        |=  [id=token:g =invite:g]
        %-  pairs
        :~  id+(token id)
            invite+(^invite invite)
        ==
      ::
        :-  %join  
        ?~  join  ~
        %-  pairs
        :~  id+(token id.u.join)
            progress+s+progress.u.join
        ==
    ==
  ::
  ++  v7  .
  ++  v6
    =,  v5
    |%
    ::
    ++  gangs
      |=  gs=(map flag:g gang:v6:g)
      %-  pairs
      %+  turn  ~(tap by gs)
      |=  [f=flag:g gr=gang:v6:g]
      [(print-flag f) (gang gr)]
    ::
    ++  gang
      |=  ga=gang:v6:g
      %-  pairs
      :~  claim/?~(cam.ga ~ (claim u.cam.ga))
          preview/?~(pev.ga ~ (preview u.pev.ga))
          invite/?~(vit.ga ~ (invite u.vit.ga))
          error/?~(err.ga ~ (access-error u.err.ga))
      ==
    ::
    ++  access-error
      |=  =access-error:v6:g
      ^-  json
      s+access-error
    ::
    ++  claim
      |=  c=claim:v6:g
      %-  pairs
      :~  join-all/b/join-all.c
          progress/s/`@t`progress.c
      ==
    ::
    ++  preview-response
      |=  pr=preview-response:v6:g
      ?:  ?=(%| -.pr)
        (frond error+(access-error p.pr))
      (frond preview+(preview p.pr))
    ::
    --
  ::
  ++  v5
    =,  v2
    |%
    ::
    ++  group
      |=  gr=group:v5:g
      =/  active-channels
        (turn ~(tap in active-channels.gr) nest)
      %-  pairs
      :~  fleet/(fleet fleet.gr)
          cabals/(cabals cabals.gr)
          zones/(zones zones.gr)
          zone-ord/a/(turn zone-ord.gr (lead %s))
          channels/(channels channels.gr)
          active-channels/a/active-channels
          bloc/a/(turn ~(tap in bloc.gr) (lead %s))
          cordon/(cordon cordon.gr)
          meta/(meta meta.gr)
          secret/b/secret.gr
          flagged-content/(flagged-content flagged-content.gr)
      ==
    ::
    ++  group-ui
      |=  gr=group-ui:v5:g
      =/  active-channels
        (turn ~(tap in active-channels.gr) nest)
      %-  pairs
      :~  fleet/(fleet fleet.gr)
          cabals/(cabals cabals.gr)
          zones/(zones zones.gr)
          zone-ord/a/(turn zone-ord.gr (lead %s))
          channels/(channels channels.gr)
          active-channels/a/active-channels
          bloc/a/(turn ~(tap in bloc.gr) (lead %s))
          cordon/(cordon cordon.gr)
          meta/(meta meta.gr)
          secret/b/secret.gr
          flagged-content/(flagged-content flagged-content.gr)
          ::
          init+b/init.gr
          count+(numb count.gr)
      ==
    ::
    ++  groups
      |=  gs=groups:v5:g
      %-  pairs
      %+  turn  ~(tap by gs)
      |=  [f=flag:g gr=group:v5:g]
      [(print-flag f) (group gr)]
    ::
    ++  groups-ui
      |=  gs=groups-ui:v5:g
      %-  pairs
      %+  turn  ~(tap by gs)
      |=  [f=flag:g gr=group-ui:v5:g]
      [(print-flag f) (group-ui gr)]
    ::
    ++  action
      |=  a=action:v5:g
      %-  pairs
      :~  flag+(flag p.a)
          update+(update q.a)
      ==
    ::
    ++  update
      |=  =update:v5:g
      %-  pairs
      :~  time+s+(scot %ud p.update)
          diff+(diff q.update)
      ==
    ::
    ++  diff
      |=  d=diff:v5:g
      %+  frond  -.d
      ?-    -.d
        %fleet    (pairs ships/a/(turn ~(tap in p.d) ship) diff/(fleet-diff q.d) ~)
        %channel  (pairs nest+(nest p.d) diff/(channel-diff q.d) ~)
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
    ++  previews
      |=  ps=previews:v5:g
      %-  pairs
      %+  turn  ~(tap by ps)
      |=  [f=flag:g p=preview:v5:g]
      [(print-flag f) (preview p)]
    ::
    ++  channel-preview
      |=  p=preview:channel:v5:g
      %-  pairs
      :~  nest+(nest nest.p)
          meta+(meta meta.p)
          group+(preview group.p)
      ==
    ::
    ++  preview
      |=  p=preview:v5:g
      %-  pairs
      :~  flag+(flag flag.p)
          time+(time time.p)
          meta+(meta meta.p)
          cordon+(cordon cordon.p)
          secret+b+secret.p
          count+(numb count.p)
      ==
    ++  gangs
      |=  gs=(map flag:g gang:v5:g)
      %-  pairs
      %+  turn  ~(tap by gs)
      |=  [f=flag:g gr=gang:v5:g]
      [(print-flag f) (gang gr)]
    ::
    ++  gang
      |=  ga=gang:v5:g
      %-  pairs
      :~  claim/?~(cam.ga ~ (claim u.cam.ga))
          preview/?~(pev.ga ~ (preview u.pev.ga))
          invite/?~(vit.ga ~ (invite u.vit.ga))
      ==
    --
  ++  v2
    |%
    ::
    ++  zones
      |=  zons=(map zone:v2:g realm:zone:v2:g)
      %-  pairs
      %+  turn  ~(tap by zons)
      |=  [=zone:v2:g r=realm:zone:v2:g]
      ^-  [@t json]
      :-  zone
      %-  pairs
      :~  meta+(meta met.r)
          idx+a+(turn ord.r nest)
      ==
    ::
    ++  invite
      |=  i=invite:v2:g
      %-  pairs
      :~  flag+(flag p.i)
          ship+(ship q.i)
      ==
    ::
    ++  fleet
      |=  fl=fleet:v2:g
      %-  pairs
      %+  turn  ~(tap by fl)
      |=  [her=@p v=vessel:fleet:v2:g]
      ^-  [cord json]
      [(scot %p her) (vessel v)]
    ::
    ++  vessel
      |=  v=vessel:fleet:v2:g
      %-  pairs
      :~  sects/a/(turn ~(tap in sects.v) (lead %s))
          joined/(time joined.v)
      ==
    ++  cabals
      |=  cs=(map sect:v2:g cabal:v2:g)
      %-  pairs
      %+  turn  ~(tap by cs)
      |=  [=term c=cabal:v2:g]
      ^-  [cord json]
      [term (cabal c)]
    ::
    ++  cabal
      |=  c=cabal:v2:g
      %-  pairs
      :~  meta/(meta meta.c)
      ==
    ::
    ++  zone-diff
      |=  d=diff:zone:v2:g
      %-  pairs
      :~  zone/s/p.d
          delta/(zone-delta q.d)
      ==
    ::
    ++  zone-delta
      |=  d=delta:zone:v2:g
      %+  frond  -.d
      ?-  -.d
          %del           ~
          %mov           (numb idx.d)
          ?(%add %edit)  (meta meta.d)
          %mov-nest
        %-  pairs
        :~  nest+(nest nest.d)
            idx+(numb idx.d)
        ==
      ==
    ++  channels
      |=  chs=(map nest:g channel:v2:g)
      %-  pairs
      %+  turn  ~(tap by chs)
      |=  [n=nest:g c=channel:v2:g]
      ^-  [@t json]
      [(print-nest n) (channel c)]
    ::
    ++  channel
      |=  ch=channel:v2:g
      %-  pairs
      :~  meta/(meta meta.ch)
          added/(time added.ch)
          readers/a/(turn ~(tap in readers.ch) (lead %s))
          zone/s/zone.ch
          join/b/join.ch
      ==
    ::
    ++  cordon
      |=  c=cordon:v2:g
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
      :~  app+(flag app)
          path/s/(spat pax)
          desc/s/desc
      ==
    ::
    ++  ban-cordon
      |=  b=ban:open:cordon:v2:g
      %-  pairs
      :~  ships/a/(turn ~(tap in ships.b) ship)
          ranks/a/(turn ~(tap in ranks.b) (lead %s))
      ==
    ::
    ++  bloc-diff
      |=  d=diff:bloc:v2:g
      %+  frond  -.d
      a/(turn ~(tap in p.d) (lead %s))
    ::
    ++  cordon-diff
      |=  d=diff:cordon:v2:g
      %+  frond  -.d
      ?-  -.d
        %open  (open-cordon-diff p.d)
        %shut  (shut-cordon-diff p.d)
        %swap  (cordon p.d)
      ==
    ::
    ++  open-cordon-diff
      |=  d=diff:open:cordon:v2:g
      %+  frond  -.d
      ?-  -.d
        ?(%add-ships %del-ships)  a/(turn ~(tap in p.d) ship)
        ?(%add-ranks %del-ranks)  a/(turn ~(tap in p.d) (lead %s))
      ==
    ::
    ++  shut-cordon-diff
      |=  d=diff:shut:cordon:v2:g
      %+  frond  -.d
      %-  pairs
      :~  kind/s/p.d
          ships/a/(turn ~(tap in q.d) ship)
      ==
    ::
    ++  channel-diff
      |=  d=diff:channel:v2:g
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
      |=  d=diff:cabal:v2:g
      %+  frond  -.d
      ?-  -.d
        %add  (meta meta.d)
        %edit  (meta meta.d)
        %del  ~
      ==
    ::
    ++  fleet-diff
      |=  d=diff:fleet:v2:g
      %+  frond  -.d
      ?-  -.d
        %add  ~
        %del  ~
        %add-sects  a/(turn ~(tap in sects.d) (lead %s))
        %del-sects  a/(turn ~(tap in sects.d) (lead %s))
      ==
    ++  previews
      |=  ps=previews:v2:g
      %-  pairs
      %+  turn  ~(tap by ps)
      |=  [f=flag:g p=preview:v2:g]
      [(print-flag f) (preview p)]
    ::
    ++  channel-preview
      |=  p=preview:channel:v2:g
      %-  pairs
      :~  nest+(nest nest.p)
          meta+(meta meta.p)
          group+(preview group.p)
      ==
    ::
    ++  preview
      |=  p=preview:v2:g
      %-  pairs
      :~  flag+(flag flag.p)
          time+(time time.p)
          meta+(meta meta.p)
          cordon+(cordon cordon.p)
          secret+b+secret.p
      ==
    ::
    ++  action
      |=  a=action:v2:g
      %-  pairs
      :~  flag+(flag p.a)
          update+(update q.a)
      ==
    ::
    ++  update
      |=  =update:v2:g
      %-  pairs
      :~  time+s+(scot %ud p.update)
          diff+(diff q.update)
      ==
    ::
    ++  diff
      |=  d=diff:v2:g
      %+  frond  -.d
      ?-  -.d
        %fleet    (pairs ships/a/(turn ~(tap in p.d) ship) diff/(fleet-diff q.d) ~)
        %channel  (pairs nest/(nest p.d) diff/(channel-diff q.d) ~)
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
    ++  group
      |=  gr=group:v2:g
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
      |=  gr=group-ui:v2:g
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
    ++  groups
      |=  gs=groups:v2:g
      %-  pairs
      %+  turn  ~(tap by gs)
      |=  [f=flag:g gr=group:v2:g]
      [(print-flag f) (group gr)]
    ::
    ++  groups-ui
      |=  gs=groups-ui:v2:g
      %-  pairs
      %+  turn  ~(tap by gs)
      |=  [f=flag:g gr=group-ui:v2:g]
      [(print-flag f) (group-ui gr)]
    ::
    ++  groups-ui-v0
      |=  gs=groups-ui:zer
      %-  pairs
      %+  turn  ~(tap by gs)
      |=  [f=flag:g gr=group-ui:zer]
      [(print-flag f) (group-ui-v0 gr)]
    ::
    ++  gangs
      |=  gs=(map flag:g gang:v2:g)
      %-  pairs
      %+  turn  ~(tap by gs)
      |=  [f=flag:g gr=gang:v2:g]
      [(print-flag f) (gang gr)]
    ::
    ++  claim
      |=  c=claim:v2:g
      %-  pairs
      :~  join-all/b/join-all.c
          progress/s/`@t`progress.c
      ==
    ::
    ++  gang
      |=  ga=gang:v2:g
      %-  pairs
      :~  claim/?~(cam.ga ~ (claim u.cam.ga))
          preview/?~(pev.ga ~ (preview u.pev.ga))
          invite/?~(vit.ga ~ (invite u.vit.ga))
      ==
    ::
    --
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
  ++  a-groups
    ^-  $-(json a-groups:v7:g)
    !!
  ::
  ++  v6  v6:ver
  ++  v5  v5:ver
  ++  v2  v2:ver
  ::
  ++  ver
    |%
    ::XX do not use spurious aliases
    ++  v6  v5
    ++  v5  v2
    ++  v2
      |%
      ::
      ++  zone-delta
        ^-  $-(json delta:zone:v2:g)
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
        ^-  $-(json diff:channel:v2:g)
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
        ^-  $-(json channel:v2:g)
        %-  ot
        :~  meta/meta
            added/di
            zone/(se %tas)
            join/bo
            readers/(as so)
        ==
      ++  cordon
        ^-  $-(json cordon:v2:g)
        %-  of
        :~  open/open-cordon
            shut/shut-cordon
        ==
      ++  shut-cordon
        ^-  $-(json state:shut:cordon:v2:g)
        %-  ot
        :~  pending/(as ship)
            ask/(as ship)
        ==
      ::
      ++  open-cordon
        ^-  $-(json ban:open:cordon:v2:g)
        %-  ot
        :~  ships/(as ship)
            ranks/(as rank)
        ==
      ::
      ++  cordon-diff
        ^-  $-(json diff:cordon:v2:g)
        %-  of
        :~  open/open-cordon-diff
            shut/shut-cordon-diff
            swap/cordon
        ==
      ::
      ++  open-cordon-diff
        ^-  $-(json diff:open:cordon:v2:g)
        %-  of
        :~  add-ships/(as ship)
            del-ships/(as ship)
            add-ranks/(as rank)
            del-ranks/(as rank)
        ==
      ::
      ++  shut-cordon-diff
        ^-  $-(json diff:shut:cordon:v2:g)
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
        ^-  $-(json diff:fleet:v2:g)
        %-  of
        :~  [%add ul]
            [%del ul]
            [%add-sects (as sym)]
            [%del-sects (as sym)]
        ==
      ::
      ++  cabal-diff
        ^-  $-(json diff:cabal:v2:g)
        %-  of
        :~  add/meta
            edit/meta
            del/ul
        ==
      ::
      ++  zone-diff
        ^-  $-(json diff:zone:v2:g)
        %-  ot
        :~  zone/(se %tas)
            delta/zone-delta
        ==
      ::
      ++  create
        ^-  $-(json create:v2:g)
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
      ++  join
        ^-  $-(json join:v2:g)
        %-  ot
        :~  flag/flag
            join-all/bo
        ==
      ++  invite
        ^-  $-(json invite:v2:g)
        %-  ot
        :~  flag/flag
            ship/ship
        ==
      ::
      ++  diff
        ^-  $-(json diff:v2:g)
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
      ++  action
        ^-  $-(json action:v2:g)
        %-  ot
        :~  flag+flag
            update+update
        ==
      ++  update
        |=  j=json
        ^-  update:v2:g
        ?>  ?=(%o -.j)
        [*time (diff (~(got by p.j) %diff))]
      --
    --
  --
--
