/-  gv=groups-ver, s=story, u=ui, e=epic
/-  meta
/+  sj=story-json
=*  z  ..zuse
|%
++  enjs
  =,  enjs:format
  |%
  ::
  ::  common
  ::
  ++  ship
    |=  her=@p
    s+(scot %p her)
  ::
  ++  print-flag
    |=  f=flag:gv
    ^-  @t
    (rap 3 (scot %p p.f) '/' q.f ~)
  ++  flag
    |=  f=flag:gv
    s+(print-flag f)
  ::
  ++  print-nest
    |=  n=nest:gv
    ^-  @t
    (rap 3 p.n '/' (print-flag q.n) ~)
  ::
  ++  nest
    |=  n=nest:gv
    s+(print-nest n)
  ::
  ++  time-id
    |=  =@da
    s+`@t`(rsh 4 (scot %ui da))
  ::
  ++  meta
    |=  m=data:^meta
    %-  pairs
    :~  'title'^s+title.m
        'description'^s+description.m
        'image'^s+image.m
        'cover'^s+cover.m
    ==
  ++  saga
    |=  s=saga:e
    %-  frond
    ?-  -.s
      %dex  'ahead'^s+(scot %ud ver.s)
      %chi  'synced'^~
      %lev  'behind'^~
    ==
  ++  whom
    |=  w=whom:u
    :-  %s
    ?-  w
      [%group *]       (print-flag flag.w)
      [%channel *]     (print-nest nest.w)
      [%chat %ship *]  (scot %p p.whom.w)
      [%chat %club *]  (scot %uv p.whom.w)
    ==
  ::
  ++  v9
    =,  v8
    |%
    ++  group
      |=  group:v9:gv
      ^-  json
      %-  pairs
      ^-  (list [@t json])
      :~  meta+(^meta meta)
        ::
          admissions+(^admissions admissions)
          seats+(^seats seats)
        ::
          roles+(roles-map roles)
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
    ++  admissions
      |=  ad=admissions:v9:gv
      |^
      %-  pairs
      :~  privacy+s+privacy.ad
          banned+(banned banned.ad)
          pending+(pending pending.ad)
          requests+(requests requests.ad)
          tokens+(tokens tokens.ad)
          invited+(invited invited.ad)
      ==
      ++  banned
        |=  banned:v9:gv
        ^-  json
        %-  pairs
        :~  ships+(^ships ships)
            ranks+a+(turn ~(tap in ranks) (lead %s))
        ==
      ++  pending
        |=  pend=(jug ship:z role-id:v9:gv)
        %-  pairs
        %+  turn  ~(tap by pend)
        |=  [=ship:z roles=(set role-id:v9:gv)]
        :-  (scot %p ship)
        (^roles roles)
      ++  requests
        |=  reqs=(map ship:z [at=@da (unit story:s)])
        %-  pairs
        %+  turn  ~(tap in reqs)
        |=  [=ship:z at=@da note=(unit story:s)]
        :-  (scot %p ship)
        %-  pairs
        :~  'requestedAt'^(time at)
            'note'^?~(note ~ (story:enjs:sj u.note))
        ==
      ++  tokens
        |=  tokens=(map token:v9:gv token-meta:v9:gv)
        %-  pairs
        %+  turn  ~(tap in tokens)
        |=  [=token:v9:gv meta=token-meta:v9:gv]
        [(scot %uv token) (token-meta meta)]
      ++  invited
        |=  invited=(map ship:z [at=@da token=(unit token:v9:gv)])
        %-  pairs
        %+  turn  ~(tap in invited)
        |=  [=ship:z at=@da token=(unit token:v9:gv)]
        :-  (scot %p ship)
        (pairs at+s+(scot %da at) token+?~(token ~ (^token u.token)) ~)
      --
    ++  groups
      |=  gs=groups:v9:gv
      %-  pairs
      %+  turn  ~(tap by gs)
      |=  [f=flag:gv gr=group:v9:gv]
      [(print-flag f) (group gr)]
    ++  groups-ui
      |=  gs=groups-ui:v9:gv
      %-  pairs
      %+  turn  ~(tap by gs)
      |=  [f=flag:gv gr=group-ui:v9:gv]
      [(print-flag f) (group-ui gr)]
    ++  group-ui
      |=  =group-ui:v9:gv
      =,  group.group-ui
      %-  pairs
      ^-  (list [@t json])
      :~  meta+(^meta meta)
        ::
          admissions+(^admissions admissions)
          seats+(^seats seats)
        ::
          roles+(roles-map roles)
          admins+a+(turn ~(tap in admins) (lead %s))
        ::
          channels+(^channels channels)
          active-channels+a+(turn ~(tap in active-channels) nest)
        ::
          sections+(^sections sections)
          section-order+a+(turn section-order (lead %s))
        ::
          flagged-content+(^flagged-content flagged-content)
        ::
          init+b+init.group-ui
          member-count+(numb member-count.group-ui)
      ==
    ++  r-groups
      |=  =r-groups:v9:gv
      ^-  json
      %-  pairs
      :~  'flag'^(flag flag.r-groups)
          'r-group'^(r-group r-group.r-groups)
      ==
    ++  r-group
      |=  =r-group:v9:gv
      ^-  json
      %+  frond  -.r-group
      ?-    -.r-group
        %create  (group group.r-group)
        %meta    (meta meta.r-group)
        %entry   (r-entry r-entry.r-group)
      ::
          %seat
        %-  pairs
        :~  'ships'^(ships ships.r-group)
            'r-seat'^(r-seat r-seat.r-group)
        ==
      ::
          %role
        %-  pairs
        :~  'roles'^(roles roles.r-group)
            'r-role'^(r-role r-role.r-group)
        ==
      ::
          %channel
        %-  pairs
        :~  'nest'^(nest nest.r-group)
            'r-channel'^(r-channel r-channel.r-group)
        ==
      ::
          %section
        %-  pairs
        :~  'section-id'^s+section-id.r-group
            'r-section'^(r-section r-section.r-group)
        ==
      ::
          %section-order  
        (frond 'section-order' a+(turn order.r-group (lead %s)))
      ::
        %flag-content  (flag-content +.r-group)
        %delete  ~
      ==
    ++  r-entry
      |=  =r-entry:v9:gv
      ^-  json
      %+  frond  -.r-entry
      ?-  -.r-entry
        %privacy  s+privacy.r-entry
        %ban      (r-ban r-ban.r-entry)
        %token    (r-token r-token.r-entry)
        %pending  (r-pending r-pending.r-entry)
        %ask      (r-ask r-ask.r-entry)
      ==
    ++  r-ask
      |=  =r-ask:v9:gv
      ^-  json
      %+  frond  -.r-ask
      ?-    -.r-ask
          %add
        %-  pairs
        :~  'ship'^(ship ship.r-ask)
            'requestedAt'^(time at.r-ask)
            'note'^?~(n=note.r-ask ~ (story:enjs:sj u.n))
        ==
      ::
        %del  (pairs 'ships'^(ships ships.r-ask) ~)
      ==
    ++  r-section
      |=  =r-section:v9:gv
      ^-  json
      %+  frond  -.r-section
      ^-  json
      ?-    -.r-section
        %add   (meta meta.r-section)
        %edit  (meta meta.r-section)
        %del   ~
        %move  (frond 'idx' (numb idx.r-section))
      ::
          %move-nest
        (pairs 'idx'^(numb idx.r-section) 'nest'^(nest nest.r-section) ~)
      ::
          %set
        (frond 'set' a+(turn order.r-section nest))
      ==
    --
  ::
  ++  v8
    =,  v7
    |%
    ++  invite
      |=  invite:v8:gv
      ^-  json
      %-  pairs
      :~  flag+(^flag flag)
          token+?~(token ~ (^token u.token))
          from+(ship from)
          note+?~(note ~ (story:enjs:sj u.note))
          preview+(^preview preview)
          valid+b+valid
      ==
    ::
    ++  foreigns
      |=  =foreigns:v8:gv
      ^-  json
      %-  pairs
      %+  turn  ~(tap by foreigns)
      |=  [=flag:gv =foreign:v8:gv]
      [(print-flag flag) (^foreign foreign)]
    ::
    ++  foreign
      |=  foreign:v8:gv
      ^-  json
      %-  pairs
      :~  :-  %invites
          ?~  invites  ~
          a+(turn invites invite)
        ::
          lookup+?~(lookup ~ s+u.lookup)
          preview+?~(preview ~ (^preview u.preview))
          progress+?~(progress ~ s+u.progress)
          token+?~(token ~ (^token u.token))
      ==
    --
  ::
  ++  v7
    =,  v6
    |%
    ++  group
      |=  group:v7:gv
      ^-  json
      %-  pairs
      ^-  (list [@t json])
      :~  meta+(^meta meta)
        ::
          admissions+(^admissions admissions)
          seats+(^seats seats)
        ::
          roles+(roles-map roles)
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
    ++  group-ui
      |=  =group-ui:v7:gv
      =,  group.group-ui
      %-  pairs
      ^-  (list [@t json])
      :~  meta+(^meta meta)
        ::
          admissions+(^admissions admissions)
          seats+(^seats seats)
        ::
          roles+(roles-map roles)
          admins+a+(turn ~(tap in admins) (lead %s))
        ::
          channels+(^channels channels)
          active-channels+a+(turn ~(tap in active-channels) nest)
        ::
          sections+(^sections sections)
          section-order+a+(turn section-order (lead %s))
        ::
          flagged-content+(^flagged-content flagged-content)
        ::
          init+b+init.group-ui
          member-count+(numb member-count.group-ui)
      ==
    ::
    ++  admissions
      |=  ad=admissions:v7:gv
      |^
      %-  pairs
      :~  privacy+s+privacy.ad
          banned+(banned banned.ad)
          pending+(pending pending.ad)
          requests+(requests requests.ad)
          tokens+(tokens tokens.ad)
          invited+(invited invited.ad)
      ==
      ++  banned
        |=  banned:v7:gv
        ^-  json
        %-  pairs
        :~  ships+(^ships ships)
            ranks+a+(turn ~(tap in ranks) (lead %s))
        ==
      ++  pending
        |=  pend=(jug ship:z role-id:v7:gv)
        %-  pairs
        %+  turn  ~(tap by pend)
        |=  [=ship:z roles=(set role-id:v7:gv)]
        :-  (scot %p ship)
        (^roles roles)
      ++  requests
        |=  reqs=(map ship:z (unit story:s))
        %-  pairs
        %+  turn  ~(tap in reqs)
        |=  [=ship:z story=(unit story:s)]
        :-  (scot %p ship)
        ?~(story ~ (story:enjs:sj u.story))
      ++  tokens
        |=  tokens=(map token:v7:gv token-meta:v7:gv)
        %-  pairs
        %+  turn  ~(tap in tokens)
        |=  [=token:v7:gv meta=token-meta:v7:gv]
        [(scot %uv token) (token-meta meta)]
      ++  invited
        |=  invited=(map ship:z [at=@da token=(unit token:v7:gv)])
        %-  pairs
        %+  turn  ~(tap in invited)
        |=  [=ship:z at=@da token=(unit token:v7:gv)]
        :-  (scot %p ship)
        (pairs at+s+(scot %da at) token+?~(token ~ (^token u.token)) ~)
      --
    ++  token
      |=  =token:v7:gv
      s+(scot %uv token)
    ++  token-meta
      |=  token-meta:v7:gv
      %-  pairs
      :~  scheme+(claim-scheme scheme)
          expiry+s+(scot %da expiry)
          label+?~(label ~ s+u.label)
      ==
    ++  claim-scheme
      |=  scheme=claim-scheme:v7:gv
      ^-  json
      ?-  -.scheme
        %forever   (frond %forever ~)
        %limited   (frond %limited (numb count.scheme))
        %personal  (frond %personal (ship ship.scheme))
      ==
    ++  ships
      |=  ships=(set ship.z)
      a+(turn ~(tap in ships) ship)
    ::
    ++  seats
      |=  seats=(map ship:z seat:v7:gv)
      %-  pairs
      %+  turn  ~(tap in seats)
      |=  [=ship:z =seat:v7:gv]
      [(scot %p ship) (^seat seat)]
    ::
    ++  seat
      |=  seat:v7:gv
      ^-  json
      %-  pairs
      :~  roles+(^roles roles)
          joined+(time joined)
      ==
    ::
    ++  roles-map
      |=  roles=(map role-id:v7:gv role:v7:gv)
      %-  pairs
      %+  turn  ~(tap by roles)
      |=  [=role-id:v7:gv =role:v7:gv]
      ^-  [@t json]
      [role-id (meta meta.role)]
    ::
    ++  channels
      |=  chans=(map nest:gv channel:v7:gv)
      %-  pairs
      %+  turn  ~(tap by chans)
      |=  [n=nest:gv c=channel:v7:gv]
      ^-  [@t json]
      [(print-nest n) (channel c)]
    ::
    ++  channel
      |=  ch=channel:v7:gv
      %-  pairs
      :~  meta+(meta meta.ch)
          added+(time added.ch)
          section+s+section.ch
          readers+a+(turn ~(tap in readers.ch) (lead %s))
          join+b+join.ch
      ==
    ++  sections
      |=  sections=(map section-id:v7:gv section:v7:gv)
      %-  pairs
      %+  turn  ~(tap by sections)
      |=  [=section-id:v7:gv =section:v7:gv]
      ^-  [@t json]
      :-  section-id
      %-  pairs
      :~  meta+(meta meta.section)
          order+a+(turn order.section nest)
      ==
    ++  groups
      |=  gs=groups:v7:gv
      %-  pairs
      %+  turn  ~(tap by gs)
      |=  [f=flag:gv gr=group:v7:gv]
      [(print-flag f) (group gr)]
    ::
    ++  groups-ui
      |=  gs=groups-ui:v7:gv
      %-  pairs
      %+  turn  ~(tap by gs)
      |=  [f=flag:gv gr=group-ui:v7:gv]
      [(print-flag f) (group-ui gr)]
    ::
    ++  r-groups
      |=  =r-groups:v7:gv
      ^-  json
      %-  pairs
      :~  'flag'^(flag flag.r-groups)
          'r-group'^(r-group r-group.r-groups)
      ==
    ++  r-group
      |=  =r-group:v7:gv
      ^-  json
      %+  frond  -.r-group
      ?-    -.r-group
        %create  (group group.r-group)
        %meta    (meta meta.r-group)
        %entry   (r-entry r-entry.r-group)
      ::
          %seat
        %-  pairs
        :~  'ships'^(ships ships.r-group)
            'r-seat'^(r-seat r-seat.r-group)
        ==
      ::
          %role
        %-  pairs
        :~  'roles'^(roles roles.r-group)
            'r-role'^(r-role r-role.r-group)
        ==
      ::
          %channel
        %-  pairs
        :~  'nest'^(nest nest.r-group)
            'r-channel'^(r-channel r-channel.r-group)
        ==
      ::
          %section
        %-  pairs
        :~  'section-id'^s+section-id.r-group
            'r-section'^(r-section r-section.r-group)
        ==
      ::
        %flag-content  (flag-content +.r-group)
        %delete  ~
      ==
    ++  roles
      |=  roles=(set role-id:v7:gv)
      a+(turn ~(tap in roles) (lead %s))
    ++  r-entry
      |=  =r-entry:v7:gv
      ^-  json
      %+  frond  -.r-entry
      ?-  -.r-entry
        %privacy  s+privacy.r-entry
        %ban      (r-ban r-ban.r-entry)
        %token    (r-token r-token.r-entry)
        %pending  (r-pending r-pending.r-entry)
        %ask      (r-ask r-ask.r-entry)
      ==
    ++  r-ban
      |=  =r-ban:v7:gv
      ^-  json
      %+  frond  -.r-ban
      ?-    -.r-ban
          %set
        %-  pairs
        :~  'ships'^(ships ships.r-ban)
            'ranks'^(ranks ranks.r-ban)
        ==
      ::
        %add-ships  (pairs 'add-ships'^(ships ships.r-ban) ~)
        %del-ships  (pairs 'del-ships'^(ships ships.r-ban) ~)
      ::
        %add-ranks  (pairs 'add-ranks'^(ranks ranks.r-ban) ~)
        %del-ranks  (pairs 'del-ranks'^(ranks ranks.r-ban) ~)
      ==
    ++  ranks
      |=  ranks=(set rank:title)
      a+(turn ~(tap in ranks) (lead %s))
    ++  r-token
      |=  =r-token:v7:gv
      ^-  json
      %+  frond  -.r-token
      ?-    -.r-token
          %add
        %-  pairs
        :~  'token'^(token token.r-token)
            'meta'^(token-meta meta.r-token)
        ==
      ::
        %del  (frond 'token' (token token.r-token))
      ==
    ++  r-pending
      |=  =r-pending:v7:gv
      ^-  json
      %+  frond  -.r-pending
      ?-    -.r-pending
          %add
        %-  pairs
        :~  'ships'^(ships ships.r-pending)
            'roles'^(roles roles.r-pending)
        ==
      ::
          %edit
        %-  pairs
        :~  'ships'^(ships ships.r-pending)
            'roles'^(roles roles.r-pending)
        ==
      ::
        %del  (pairs 'ships'^(ships ships.r-pending) ~)
      ==
    ++  r-ask
      |=  =r-ask:v7:gv
      ^-  json
      %+  frond  -.r-ask
      ?-    -.r-ask
          %add
        %-  pairs
        :~  'ship'^(ship ship.r-ask)
            'note'^?~(n=note.r-ask ~ (story:enjs:sj u.n))
        ==
      ::
        %del  (pairs 'ships'^(ships ships.r-ask) ~)
      ==
    ++  r-seat
      |=  =r-seat:v7:gv
      ^-  json
      %+  frond  -.r-seat
      ?-  -.r-seat
        %add  (frond 'seat' (seat seat.r-seat))
        %del  ~
        %add-roles  (frond 'roles' (roles roles.r-seat))
        %del-roles  (frond 'roles' (roles roles.r-seat))
      ==
    ++  r-role
      |=  =r-role:v7:gv
      ^-  json
      %+  frond  -.r-role
      ?-  -.r-role
        %add        (meta meta.r-role)
        %edit       (meta meta.r-role)
        %del        ~
        %set-admin  ~
        %del-admin  ~
      ==
    ++  r-channel
      |=  =r-channel:v7:gv
      ^-  json
      %+  frond  -.r-channel
      ?-  -.r-channel
        %add          (channel channel.r-channel)
        %edit         (channel channel.r-channel)
        %del          ~
        %add-readers  (roles roles.r-channel)
        %del-readers  (roles roles.r-channel)
        %section      s+section.r-channel
        %join         b+join.r-channel
      ==
    ++  r-section
      |=  =r-section:v7:gv
      ^-  json
      %+  frond  -.r-section
      ^-  json
      ?-    -.r-section
        %add   (meta meta.r-section)
        %edit  (meta meta.r-section)
        %del   ~
        %move  (frond 'idx' (numb idx.r-section))
      ::
          %move-nest
        (pairs 'idx'^(numb idx.r-section) 'nest'^(nest nest.r-section) ~)
      ==
    ++  preview-update
      |=  =preview-update:v7:gv
      ^-  json
      %+  frond  'preview'
      ?~  pev=preview-update
        ~
      (preview u.pev)
    ++  previews
      |=  ps=previews:v7:gv
      %-  pairs
      %+  turn  ~(tap by ps)
      |=  [f=flag:gv p=preview:v7:gv]
      [(print-flag f) (preview p)]
    ++  invite
      |=  invite:v7:gv
      ^-  json
      %-  pairs
      :~  flag+(^flag flag)
          token+?~(token ~ (^token u.token))
          from+(ship from)
          note+?~(note ~ (story:enjs:sj u.note))
          preview+(^preview preview)
      ==
    ++  preview
      |=  preview:v7:gv
      ^-  json
      %-  pairs
      :~  flag+(^flag flag)
          meta+(^meta meta)
          time+(^time time)
          member-count+(numb member-count)
          privacy+s+privacy
      ==
    ++  channel-preview
      |=  p=channel-preview:v7:gv
      %-  pairs
      :~  nest+(nest nest.p)
          meta+(meta meta.p)
          group+(preview preview.p)
      ==
    ::
    ++  foreigns
      |=  =foreigns:v7:gv
      ^-  json
      %-  pairs
      %+  turn  ~(tap by foreigns)
      |=  [=flag:gv =foreign:v7:gv]
      [(print-flag flag) (^foreign foreign)]
    ::
    ++  foreign
      |=  foreign:v7:gv
      ^-  json
      %-  pairs
      :~  :-  %invites
          ?~  invites  ~
          a+(turn invites invite)
        ::
          lookup+?~(lookup ~ s+u.lookup)
          preview+?~(preview ~ (^preview u.preview))
          progress+?~(progress ~ s+u.progress)
          token+?~(token ~ (^token u.token))
      ==
    --
  ++  v6
    =,  v5
    |%
    ::
    ++  gangs
      |=  gs=(map flag:gv gang:v6:gv)
      %-  pairs
      %+  turn  ~(tap by gs)
      |=  [f=flag:gv gr=gang:v6:gv]
      [(print-flag f) (gang gr)]
    ::
    ++  gang
      |=  ga=gang:v6:gv
      %-  pairs
      :~  'claim'^?~(cam.ga ~ (claim u.cam.ga))
          'preview'^?~(pev.ga ~ (preview u.pev.ga))
          'invite'^?~(vit.ga ~ (invite u.vit.ga))
          'error'^?~(err.ga ~ (access-error u.err.ga))
      ==
    ::
    ++  access-error
      |=  =access-error:v6:gv
      ^-  json
      s+access-error
    ::
    ++  claim
      |=  c=claim:v6:gv
      %-  pairs
      :~  %join-all^b+join-all.c
          'progress'^s+`@t`progress.c
      ==
    ::
    ++  preview-response
      |=  pr=preview-response:v6:gv
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
      |=  gr=group:v5:gv
      =/  active-channels
        (turn ~(tap in active-channels.gr) nest)
      %-  pairs
      :~  'fleet'^(fleet fleet.gr)
          'cabals'^(cabals cabals.gr)
          'zones'^(zones zones.gr)
          %zone-ord^a+(turn zone-ord.gr (lead %s))
          'channels'^(channels channels.gr)
          %active-channels^a+active-channels
          'bloc'^a+(turn ~(tap in bloc.gr) (lead %s))
          'cordon'^(cordon cordon.gr)
          'meta'^(meta meta.gr)
          'secret'^b+secret.gr
          %flagged-content^(flagged-content flagged-content.gr)
      ==
    ::
    ++  group-ui
      |=  gr=group-ui:v5:gv
      =/  active-channels
        (turn ~(tap in active-channels.gr) nest)
      %-  pairs
      :~  'fleet'^(fleet fleet.gr)
          'cabals'^(cabals cabals.gr)
          'zones'^(zones zones.gr)
          %zone-ord^a+(turn zone-ord.gr (lead %s))
          'channels'^(channels channels.gr)
          %active-channels^a+active-channels
          'bloc'^a+(turn ~(tap in bloc.gr) (lead %s))
          'cordon'^(cordon cordon.gr)
          'meta'^(meta meta.gr)
          'secret'^b+secret.gr
          %flagged-content^(flagged-content flagged-content.gr)
          ::
          'init'^b+init.gr
          'count'^(numb count.gr)
      ==
    ::
    ++  groups
      |=  gs=groups:v5:gv
      %-  pairs
      %+  turn  ~(tap by gs)
      |=  [f=flag:gv gr=group:v5:gv]
      [(print-flag f) (group gr)]
    ::
    ++  groups-ui
      |=  gs=groups-ui:v5:gv
      %-  pairs
      %+  turn  ~(tap by gs)
      |=  [f=flag:gv gr=group-ui:v5:gv]
      [(print-flag f) (group-ui gr)]
    ::
    ++  action
      |=  a=action:v5:gv
      %-  pairs
      :~  flag+(flag p.a)
          update+(update q.a)
      ==
    ::
    ++  update
      |=  =update:v5:gv
      %-  pairs
      :~  time+s+(scot %ud p.update)
          diff+(diff q.update)
      ==
    ::
    ++  diff
      |=  d=diff:v5:gv
      %+  frond  -.d
      ?-    -.d
        %fleet    (pairs 'ships'^a+(turn ~(tap in p.d) ship) 'diff'^(fleet-diff q.d) ~)
        %channel  (pairs nest+(nest p.d) 'diff'^(channel-diff q.d) ~)
        %cabal    (pairs 'sect'^s+p.d 'diff'^(cabal-diff q.d) ~)
        %bloc     (bloc-diff p.d)
        %cordon   (cordon-diff p.d)
        %create   (group p.d)
        %zone     (zone-diff p.d)
        %meta     (meta p.d)
        %secret   b+p.d
        %del      ~
        %flag-content  (flag-content +:d)
      ==
    ::
    ++  previews
      |=  ps=previews:v5:gv
      %-  pairs
      %+  turn  ~(tap by ps)
      |=  [f=flag:gv p=preview:v5:gv]
      [(print-flag f) (preview p)]
    ::
    ++  channel-preview
      |=  p=preview:channel:v5:gv
      %-  pairs
      :~  nest+(nest nest.p)
          meta+(meta meta.p)
          group+(preview group.p)
      ==
    ::
    ++  preview
      |=  p=preview:v5:gv
      %-  pairs
      :~  flag+(flag flag.p)
          time+(time time.p)
          meta+(meta meta.p)
          cordon+(cordon cordon.p)
          secret+b+secret.p
          count+(numb count.p)
      ==
    ++  gangs
      |=  gs=(map flag:gv gang:v5:gv)
      %-  pairs
      %+  turn  ~(tap by gs)
      |=  [f=flag:gv gr=gang:v5:gv]
      [(print-flag f) (gang gr)]
    ::
    ++  gang
      |=  ga=gang:v5:gv
      %-  pairs
      :~  'claim'^?~(cam.ga ~ (claim u.cam.ga))
          'preview'^?~(pev.ga ~ (preview u.pev.ga))
          'invite'^?~(vit.ga ~ (invite u.vit.ga))
      ==
    --
  ++  v2
    |%
    ::
    ++  zones
      |=  zons=(map zone:v2:gv realm:zone:v2:gv)
      %-  pairs
      %+  turn  ~(tap by zons)
      |=  [=zone:v2:gv r=realm:zone:v2:gv]
      ^-  [@t json]
      :-  zone
      %-  pairs
      :~  meta+(meta met.r)
          idx+a+(turn ord.r nest)
      ==
    ::
    ++  invite
      |=  i=invite:v2:gv
      %-  pairs
      :~  flag+(flag p.i)
          ship+(ship q.i)
      ==
    ::
    ++  fleet
      |=  fl=fleet:v2:gv
      %-  pairs
      %+  turn  ~(tap by fl)
      |=  [her=@p v=vessel:fleet:v2:gv]
      ^-  [cord json]
      [(scot %p her) (vessel v)]
    ::
    ++  vessel
      |=  v=vessel:fleet:v2:gv
      %-  pairs
      :~  'sects'^a+(turn ~(tap in sects.v) (lead %s))
          'joined'^(time joined.v)
      ==
    ++  cabals
      |=  cs=(map sect:v2:gv cabal:v2:gv)
      %-  pairs
      %+  turn  ~(tap by cs)
      |=  [=term c=cabal:v2:gv]
      ^-  [cord json]
      [term (cabal c)]
    ::
    ++  cabal
      |=  c=cabal:v2:gv
      %-  pairs
      :~  'meta'^(meta meta.c)
      ==
    ::
    ++  zone-diff
      |=  d=diff:zone:v2:gv
      %-  pairs
      :~  'zone'^s+p.d
          'delta'^(zone-delta q.d)
      ==
    ::
    ++  zone-delta
      |=  d=delta:zone:v2:gv
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
      |=  chs=(map nest:gv channel:v2:gv)
      %-  pairs
      %+  turn  ~(tap by chs)
      |=  [n=nest:gv c=channel:v2:gv]
      ^-  [@t json]
      [(print-nest n) (channel c)]
    ::
    ++  channel
      |=  ch=channel:v2:gv
      %-  pairs
      :~  'meta'^(meta meta.ch)
          'added'^(time added.ch)
          'readers'^a+(turn ~(tap in readers.ch) (lead %s))
          'zone'^s+zone.ch
          'join'^b+join.ch
      ==
    ::
    ++  cordon
      |=  c=cordon:v2:gv
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
      :~  'pending'^a+(turn ~(tap in pend) ship)
          'ask'^a+(turn ~(tap in ask) ship)
      ==
    ::
    ++  afar-cordon
      |=  [app=flag:gv pax=^path desc=@t]
      %-  pairs
      :~  app+(flag app)
          'path'^s+(spat pax)
          'desc'^s+desc
      ==
    ::
    ++  ban-cordon
      |=  b=ban:open:cordon:v2:gv
      %-  pairs
      :~  'ships'^a+(turn ~(tap in ships.b) ship)
          'ranks'^a+(turn ~(tap in ranks.b) (lead %s))
      ==
    ::
    ++  bloc-diff
      |=  d=diff:bloc:v2:gv
      %+  frond  -.d
      a+(turn ~(tap in p.d) (lead %s))
    ::
    ++  cordon-diff
      |=  d=diff:cordon:v2:gv
      %+  frond  -.d
      ?-  -.d
        %open  (open-cordon-diff p.d)
        %shut  (shut-cordon-diff p.d)
        %swap  (cordon p.d)
      ==
    ::
    ++  open-cordon-diff
      |=  d=diff:open:cordon:v2:gv
      %+  frond  -.d
      ?-  -.d
        ?(%add-ships %del-ships)  a+(turn ~(tap in p.d) ship)
        ?(%add-ranks %del-ranks)  a+(turn ~(tap in p.d) (lead %s))
      ==
    ::
    ++  shut-cordon-diff
      |=  d=diff:shut:cordon:v2:gv
      %+  frond  -.d
      %-  pairs
      :~  'kind'^s+p.d
          'ships'^a+(turn ~(tap in q.d) ship)
      ==
    ::
    ++  channel-diff
      |=  d=diff:channel:v2:gv
      %+  frond  -.d
      ?-  -.d
        ?(%add %edit)             (channel channel.d)
        %del                      ~
        ?(%add-sects %del-sects)  a+(turn ~(tap in sects.d) (lead %s))
        %zone                     s+zone.d
        %join                     b+join.d
      ==
    ::
    ++  cabal-diff
      |=  d=diff:cabal:v2:gv
      %+  frond  -.d
      ?-  -.d
        %add  (meta meta.d)
        %edit  (meta meta.d)
        %del  ~
      ==
    ::
    ++  fleet-diff
      |=  d=diff:fleet:v2:gv
      %+  frond  -.d
      ?-  -.d
        %add  ~
        %del  ~
        %add-sects  a+(turn ~(tap in sects.d) (lead %s))
        %del-sects  a+(turn ~(tap in sects.d) (lead %s))
      ==
    ++  previews
      |=  ps=previews:v2:gv
      %-  pairs
      %+  turn  ~(tap by ps)
      |=  [f=flag:gv p=preview:v2:gv]
      [(print-flag f) (preview p)]
    ::
    ++  channel-preview
      |=  p=preview:channel:v2:gv
      %-  pairs
      :~  nest+(nest nest.p)
          meta+(meta meta.p)
          group+(preview group.p)
      ==
    ::
    ++  preview
      |=  p=preview:v2:gv
      %-  pairs
      :~  flag+(flag flag.p)
          time+(time time.p)
          meta+(meta meta.p)
          cordon+(cordon cordon.p)
          secret+b+secret.p
      ==
    ::
    ++  action
      |=  a=action:v2:gv
      %-  pairs
      :~  flag+(flag p.a)
          update+(update q.a)
      ==
    ::
    ++  update
      |=  =update:v2:gv
      %-  pairs
      :~  time+s+(scot %ud p.update)
          diff+(diff q.update)
      ==
    ::
    ++  diff
      |=  d=diff:v2:gv
      %+  frond  -.d
      ?-  -.d
        %fleet    (pairs 'ships'^a+(turn ~(tap in p.d) ship) 'diff'^(fleet-diff q.d) ~)
        %channel  (pairs 'nest'^(nest p.d) 'diff'^(channel-diff q.d) ~)
        %cabal    (pairs 'sect'^s+p.d 'diff'^(cabal-diff q.d) ~)
        %bloc     (bloc-diff p.d)
        %cordon   (cordon-diff p.d)
        %create   (group p.d)
        %zone     (zone-diff p.d)
        %meta     (meta p.d)
        %secret   b+p.d
        %del      ~
        %flag-content  (flag-content +:d)
      ==
    ++  group
      |=  gr=group:v2:gv
      %-  pairs
      :~  'fleet'^(fleet fleet.gr)
          'cabals'^(cabals cabals.gr)
          'zones'^(zones zones.gr)
          'zone-ord'^a+(turn zone-ord.gr (lead %s))
          'channels'^(channels channels.gr)
          'bloc'^a+(turn ~(tap in bloc.gr) (lead %s))
          'cordon'^(cordon cordon.gr)
          'meta'^(meta meta.gr)
          'secret'^b+secret.gr
          'flagged-content'^(flagged-content flagged-content.gr)
      ==
    ::
    ++  group-ui
      |=  gr=group-ui:v2:gv
      %-  pairs
      :~  'fleet'^(fleet fleet.gr)
          'cabals'^(cabals cabals.gr)
          'zones'^(zones zones.gr)
          'zone-ord'^a+(turn zone-ord.gr (lead %s))
          'channels'^(channels channels.gr)
          'bloc'^a+(turn ~(tap in bloc.gr) (lead %s))
          'cordon'^(cordon cordon.gr)
          'meta'^(meta meta.gr)
          'secret'^b+secret.gr
          'saga'^?~(saga.gr ~ (saga u.saga.gr))
          'flagged-content'^(flagged-content flagged-content.gr)
      ==
    ::
    ++  groups
      |=  gs=groups:v2:gv
      %-  pairs
      %+  turn  ~(tap by gs)
      |=  [f=flag:gv gr=group:v2:gv]
      [(print-flag f) (group gr)]
    ::
    ++  groups-ui
      |=  gs=groups-ui:v2:gv
      %-  pairs
      %+  turn  ~(tap by gs)
      |=  [f=flag:gv gr=group-ui:v2:gv]
      [(print-flag f) (group-ui gr)]
    ::
    ++  gangs
      |=  gs=(map flag:gv gang:v2:gv)
      %-  pairs
      %+  turn  ~(tap by gs)
      |=  [f=flag:gv gr=gang:v2:gv]
      [(print-flag f) (gang gr)]
    ::
    ++  claim
      |=  c=claim:v2:gv
      %-  pairs
      :~  %join-all^b+join-all.c
          'progress'^s+`@t`progress.c
      ==
    ::
    ++  gang
      |=  ga=gang:v2:gv
      %-  pairs
      :~  'claim'^?~(cam.ga ~ (claim u.cam.ga))
          'preview'^?~(pev.ga ~ (preview u.pev.ga))
          'invite'^?~(vit.ga ~ (invite u.vit.ga))
      ==
    ::
    ++  flagged-content
      |=  fc=flagged-content:v2:gv
      =-
        %-  pairs
        %+  turn  ~(tap by -)
        |=  [n=nest:gv posts=(map ^time flagged-data)]
        :-  (print-nest n)
        ::  object so we can easily check if it's in the set
        %-  pairs
        %+  turn  ~(tap by posts)
        |=  [post=^time data=flagged-data]
        :-  `@t`(rsh 4 (scot %ui post))
        %-  pairs
        :~  'flagged'^b+flagged.data
            'flaggers'^a+(turn ~(tap in flaggers.data) ship)
            :-  %replies
            %-  pairs
            %+  turn  ~(tap by replies.data)
            |=  [reply=^time =flaggers:v2:gv]
            :-  `@t`(rsh 4 (scot %ui reply))
            a+(turn ~(tap in flaggers) ship)
        ==
      %-  ~(run by fc)
      |=  flags=(map post-key:v2:gv flaggers:v2:gv)
      %+  roll  ~(tap by flags)
      |=  [[pk=post-key:v2:gv flaggers=(set @p)] new-posts=(map ^time flagged-data)]
      ^-  (map ^time flagged-data)
      %+  ~(put by new-posts)  post.pk
      =/  =flagged-data  (~(gut by new-posts) post.pk *flagged-data)
      ?~  reply.pk  flagged-data(flagged &, flaggers flaggers)
      flagged-data(replies (~(put by replies.flagged-data) u.reply.pk flaggers))
    ::
    +$  flagged-data  [flagged=_| =flaggers:v2:gv replies=(map ^time flaggers:v2:gv)]
    ::
    ++  flag-content
      |=  [n=nest:gv =post-key:v2:gv src=@p]
      %-  pairs
      :~  nest+(nest n)
          src+(ship src)
          :-  %post-key
          %-  pairs
          :~  'post'^(time-id post.post-key)
              'reply'^?~(reply.post-key ~ (time-id u.reply.post-key))
          ==
      ==
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
    :~  nest+nest
        post-key+(ot post+(se %ud) reply+(mu (se %ud)) ~)
        src+ship
    ==
  ++  meta
    ^-  $-(json data:meta:gv)
    %-  ot
    :~  title+so
        description+so
        image+so
        cover+so
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
  ::
  ++  v8
    |%
    ++  a-groups
      ^-  $-(json a-groups:v8:gv)
      %-  of
      :~  group+(ot flag+flag a-group+a-group ~)
          invite+(ot flag+flag ships+(as ship) a-invite+a-invite ~)
          leave+flag
      ==
    ++  a-group
      ^-  $-(json a-group:v8:gv)
      %-  of
      :~  meta+meta
          entry+a-entry:v7
          seat+(ot ships+ships:v7 a-seat+a-seat:v7 ~)
          role+(ot roles+roles:v7 a-role+a-role:v7 ~)
          channel+(ot nest+nest a-channel+a-channel:v7 ~)
          section+(ot section-id+so a-section+a-section:v7 ~)
          navigation+a-navigation
          flag-content+flag-content
      ==
    ++  a-navigation
      ^-  $-(json a-navigation:v8:gv)
      %-  ot
      :~  sections+(om section)
          order+(ar sym)
      ==
    ++  section
      ^-  $-(json section:v8:gv)
      %-  ot
      :~  meta+meta
          order+(ar nest)
      ==
    ++  a-invite
      ^-  $-(json a-invite:v8:gv)
      %-  ot
      :~  token+(mu (se %uv))
          note+(mu story:dejs:sj)
      ==
    --
  ++  v7
    |%
    ++  a-groups
      ^-  $-(json a-groups:v7:gv)
      %-  of
      :~  group+(ot flag+flag a-group+a-group ~)
          invite+(ot flag+flag a-invite+a-invite ~)
          leave+flag
      ==
    ++  a-group
      ^-  $-(json a-group:v7:gv)
      %-  of
      :~  meta+meta
          entry+a-entry
          seat+(ot ships+ships a-seat+a-seat ~)
          role+(ot roles+roles a-role+a-role ~)
          channel+(ot nest+nest a-channel+a-channel ~)
          section+(ot section-id+so a-section+a-section ~)
          flag-content+flag-content
      ==
    ++  ships
      |=  =json
      ^-  (set ship:z)
      (sy ((ar ship) json))
    ++  roles
      |=  =json
      ^-  (set role-id:v7:gv)
      (sy ((ar role-id:v7:gv) json))
    ++  a-invite
      ^-  $-(json a-invite:v7:gv)
      %-  ot
      :~  ship+ship
          token+(mu (se %uv))
          note+(mu story:dejs:sj)
      ==
    ++  a-entry
      ^-  $-(json c-entry:v7:gv)
      %-  of
      :~  privacy+(su (perk %public %private %secret ~))
          ban+a-ban
          token+a-token
          pending+(ot ships+ships a-pending+a-pending ~)
          ask+(ot ships+ships a-ask+(su (perk %approve %deny ~)) ~)
      ==
    ++  a-ban
      ^-  $-(json c-ban:v7:gv)
      %-  of
      :~  set+(ot ships+ships ranks+ranks ~)
        ::
          add-ships+ships
          del-ships+ships
        ::
          add-ranks+ranks
          del-ranks+ranks
      ==
    ++  ranks
      |=  =json
      ^-  (set rank:title)
      (sy ((ar rank) json))
    ++  a-token
      ^-  $-(json c-token:v7:gv)
      %-  of
      :~  add+a-token-add
          del+token
      ==
    ++  token  (se %uv)
    ++  a-token-add
      ^-  $-(json c-token-add:v7:gv)
      %-  ot
      :~  scheme+claim-scheme
          expiry+(mu (se %dr))
          label+(mu so)
          referral+bo
      ==
    ++  claim-scheme
      ^-  $-(json claim-scheme:v7:gv)
      %-  of
      :~  forever+ul
          limited+(se %ud)
          personal+ship
      ==
    ++  a-pending
      ^-  $-(json c-pending:v7:gv)
      %-  of
      :~  add+(ot roles+roles ~)
          edit+(ot roles+roles ~)
          del+ul
      ==
    ++  a-seat
      ^-  $-(json c-seat:v7:gv)
      %-  of
      :~  add+ul
          del+ul
          add-roles+roles
          del-roles+roles
      ==
    ++  a-role
      ^-  $-(json c-role:v7:gv)
      %-  of
      :~  add+meta
          edit+meta
          del+ul
          set-admin+ul
          del-admin+ul
      ==
    ++  a-channel
      ^-  $-(json c-channel:v7:gv)
      %-  of
      :~  add+channel
          edit+channel
          del+ul
        ::
          add-readers+roles
          del-readers+roles
        ::
          section+so
      ==
    ++  channel
      ^-  $-(json channel:v7:gv)
      %-  ot
      :~  meta+meta
          added+time
          section+so
          readers+roles
          join+bo
      ==
    ++  a-section
      ^-  $-(json c-section:v7:gv)
      %-  of
      :~  add+meta
          edit+meta
          del+ul
          move+(se %ud)
          move-nest+(ot nest+nest idx+(se %ud) ~)
      ==
    --
  ++  v6  v5
  ++  v5  v2
  ::
  ++  v2
    |%
    ::
    ++  zone-delta
      ^-  $-(json delta:zone:v2:gv)
      %-  of
      :~  add+meta
          edit+meta
          del+ul
          mov+ni
          :-  %mov-nest
          %-  ot
          :~  nest+nest
              idx+ni
          ==
      ==
    ::
    ++  channel-diff
      ^-  $-(json diff:channel:v2:gv)
      %-  of
      :~  add+channel
          edit+channel
          del+ul
          add-sects+(as sym)
          del-sects+(as so)
          zone+sym
          join+bo
      ==
    ::
    ++  channel
      ^-  $-(json channel:v2:gv)
      %-  ot
      :~  meta+meta
          added+di
          zone+(se %tas)
          join+bo
          readers+(as so)
      ==
    ++  cordon
      ^-  $-(json cordon:v2:gv)
      %-  of
      :~  open+open-cordon
          shut+shut-cordon
      ==
    ++  shut-cordon
      ^-  $-(json state:shut:cordon:v2:gv)
      %-  ot
      :~  pending+(as ship)
          ask+(as ship)
      ==
    ::
    ++  open-cordon
      ^-  $-(json ban:open:cordon:v2:gv)
      %-  ot
      :~  ships+(as ship)
          ranks+(as rank)
      ==
    ::
    ++  cordon-diff
      ^-  $-(json diff:cordon:v2:gv)
      %-  of
      :~  open+open-cordon-diff
          shut+shut-cordon-diff
          swap+cordon
      ==
    ::
    ++  open-cordon-diff
      ^-  $-(json diff:open:cordon:v2:gv)
      %-  of
      :~  add-ships+(as ship)
          del-ships+(as ship)
          add-ranks+(as rank)
          del-ranks+(as rank)
      ==
    ::
    ++  shut-cordon-diff
      ^-  $-(json diff:shut:cordon:v2:gv)
      |^
      %-  of
      :~  add-ships+body
          del-ships+body
      ==
      ++  body
        %-  ot
        :~  kind+(su (perk %ask %pending ~))
            ships+(as ship)
        ==
      --
    ::
    ++  fleet-diff
      ^-  $-(json diff:fleet:v2:gv)
      %-  of
      :~  [%add ul]
          [%del ul]
          [%add-sects (as sym)]
          [%del-sects (as sym)]
      ==
    ::
    ++  cabal-diff
      ^-  $-(json diff:cabal:v2:gv)
      %-  of
      :~  add+meta
          edit+meta
          del+ul
      ==
    ::
    ++  zone-diff
      ^-  $-(json diff:zone:v2:gv)
      %-  ot
      :~  zone+(se %tas)
          delta+zone-delta
      ==
    ::
    ++  create
      ^-  $-(json create:v2:gv)
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
      ^-  $-(json join:v2:gv)
      %-  ot
      :~  flag+flag
          join-all+bo
      ==
    ++  invite
      ^-  $-(json invite:v2:gv)
      %-  ot
      :~  flag+flag
          ship+ship
      ==
    ::
    ++  diff
      ^-  $-(json diff:v2:gv)
      %-  of
      :~  cabal+(ot sect+sym diff+cabal-diff ~)
          fleet+(ot ships+(as ship) diff+fleet-diff ~)
          zone+zone-diff
          cordon+cordon-diff
          channel+(ot nest+nest diff+channel-diff ~)
          zone+zone-diff
          meta+meta
          secret+bo
          del+ul
          flag-content+flag-content
      ==
    ::
    ++  action
      ^-  $-(json action:v2:gv)
      %-  ot
      :~  flag+flag
          update+update
      ==
    ++  update
      |=  j=json
      ^-  update:v2:gv
      ?>  ?=(%o -.j)
      [*time (diff (~(got by p.j) %diff))]
    --
  --
--
