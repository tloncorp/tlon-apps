::  groups-conv: groups types conversions
::
/-  gv=groups-ver, meta, epic
/+  neg=negotiate, mp=mop-extensions
::
=,  gv
|%
++  v9
  |%
  ++  group
    =>
      |%
      ++  drop-seats
        |=  [=group:v9:gv our=ship]
        ^-  group:v9:gv
        =.  seats.group
          =/  our-seat=seat:v9:gv
            (~(gut by seats.group) our *seat:v9:gv)
          =/  seats-number=@ud  ~(wyt by seats.group)
          ?:  (lte seats-number 15)
            seats.group  :: keep all members if 15 or fewer
          =/  other-ships=(list [ship seat:v9:gv])
            ~(tap by (~(del by seats.group) our))
          =/  keep-ships=(list [ship seat:v9:gv])
            :-  [our our-seat]
            (scag 14 other-ships)  :: take first 14 other ships
          (~(gas by *(map ship seat:v9:gv)) keep-ships)
        group
      --
    |%
    ++  group-ui
      |=  [=net:v9:gv =group:v9:gv]
      ^-  group-ui:v9:gv
      =/  init=?
        ?:  ?=(%pub -.net)  &
        !=(time.net *@da)
      :*  group
          init
          ~(wyt by seats.group)
      ==
    ++  v7
      =<  group
      |%
      ++  group
        |=  =group:v9:gv
        ^-  group:v7:gv
        %=  group  requests.admissions
          %-  ~(run by requests.admissions.group)
          |=  [at=@da note=(unit story:s)]
          note
        ==
      ::
      ++  group-ui
        |=  [=net:v9:gv =group:v9:gv]
        ^-  group-ui:v7:gv
        =/  init=?
          ?:  ?=(%pub -.net)  &
          !=(time.net *@da)
        :*  (^group group)
            init
            ~(wyt by seats.group)
        ==
      --
    ++  v5
      =<  group
      |%
      ++  group
        |=  =group:v9:gv
        ^-  group:v5:gv
        %-  v5:group:^v7
        (v7:^group group)
      ::
      ++  group-ui
        |=  [=net:v9:gv =group:v9:gv]
        ^-  group-ui:v5:gv
        =/  init=?
          ?:  ?=(%pub -.net)  &
          !=(time.net *@da)
        :*  (^group group)
            init
            ~(wyt by seats.group)
        ==
      --
    ++  v2
      =<  group
      |%
      ++  group
        |=  =group:v9:gv
        ^-  group:v2:gv
        %-  v2:group:^v7
        (v7:^group group)
      ::
      ++  group-ui
        |=  [=status:neg =net:v9:gv =group:v9:gv]
        ^-  group-ui:v2:gv
        ?.  ?=(%sub -.net)
          [(^group group) `[%chi ~]]
        =/  saga=(unit saga:e)
          ?+  status  ~
            %match  `[%chi ~]
            %clash  `[%lev ~]
          ==
        [(^group group) saga]
      --
    --
  ++  r-group
    |%
    ++  v2
      |%
      ++  diff
        |=  [=r-group:v9:gv seats=(map ship seat:v9:gv) =admissions:v9:gv]
        =/  rs-group-7=(list r-group:v7:gv)
          ?:  ?=(%create -.r-group)
            [%create (v7:group group.r-group)]~
          ?:  ?=([%section-order *] r-group)
            =*  order  order.r-group
            =|  idx=@ud
            =|  rs=(list r-group:v7:gv)
            |-
            ?~  order  (flop rs)
            %=  $
              order  t.order
              idx  +(idx)
              rs  :_(rs [%section i.order [%move idx]])
            ==
          ?:  ?=([%section @ %set *] r-group)
            :: order all channels
            =*  order  order.r-section.r-group
            =|  idx=@ud
            =|  rs=(list r-group:v7:gv)
            |-
            ?~  order  (flop rs)
            %=  $
              order  t.order
              idx  +(idx)
              rs  :_(rs [%section section-id.r-group [%move-nest i.order idx]])
            ==
          ?.  ?=([%entry %ask %add *] r-group)  [r-group]~
            =>  r-ask.r-entry.r-group
            [%entry %ask %add ship note]~
        =/  admissions-7=admissions:v7:gv
          %=  admissions  requests
            %-  ~(run by requests.admissions)
            |=  [at=@da note=(unit story:s)]
            note
          ==
        %-  zing
        %+  turn  rs-group-7
        |=  =r-group:v7:gv
        (diff:v2:r-group:v7 r-group seats admissions-7)
      --
    --
  --
++  v8
  |%
  ++  foreign
    |%
    ++  v7
      |=  foreign:v8:gv
      ^-  foreign:v7:gv
      :*  (turn invites v7:invite)
          lookup
          preview
          progress
          token
      ==
    --
  ++  invite
    |%
    ++  v7
      |=  invite:v8:gv
      ^-  invite:v7:gv
      [flag time from token note preview]
    --
  --
++  v7
  |%
  ++  group
    =>
      |%
      ++  drop-seats
        |=  [=group:v7:gv our=ship]
        ^-  group:v7:gv
        =.  seats.group
          =/  our-seat=seat:v7:gv
            (~(gut by seats.group) our *seat:v7:gv)
          =/  seats-number=@ud  ~(wyt by seats.group)
          ?:  (lte seats-number 15)
            seats.group  :: keep all members if 15 or fewer
          =/  other-ships=(list [ship seat:v7:gv])
            ~(tap by (~(del by seats.group) our))
          =/  keep-ships=(list [ship seat:v7:gv])
            :-  [our our-seat]
            (scag 14 other-ships)  :: take first 14 other ships
          (~(gas by *(map ship seat:v7:gv)) keep-ships)
        group
      --
    |%
    ++  v9
      |=  =group:v7:gv
      ^-  group:v9:gv
      %=  group  requests.admissions
        %-  ~(run by requests.admissions.group)
        |=  note=(unit story:s)
        [at=*@da note]
      ==
    ++  v2
      =<  group
      |%
      ++  group
        |=  =group:v7:gv
        ^-  group:v2:gv
        =/  =fleet:v2:gv
          (~(run by seats.group) vessel:v2:seat)
        =/  cabals=(map sect:v2:gv cabal:v2:gv)
          %-  malt
          %+  turn  ~(tap by roles.group)
          |=  [=role-id:v7:gv =role:v7:gv]
          :-  `sect:v2:gv`role-id
          `cabal:v2:gv`[meta.role ~]
        =/  zones=(map zone:v2:gv realm:zone:v2:gv)
          %-  malt
          %+  turn  ~(tap by sections.group)
          |=  [=section-id:v7:gv =section:v7:gv]
          :-  `zone:v2:gv`section-id
          ^-  realm:zone:v2:gv
          [meta.section order.section]
        =/  zone-ord=(list zone:v2:gv)
          %+  turn  section-order.group
          |=(section-id:v7:gv `zone:v2:gv`+<)
        =/  =bloc:v2:gv
          %-  ~(run in admins.group)
          |=(role-id:v7:gv `sect:v2:gv`+<)
        =/  =channels:channel:v2:gv
          (~(run by channels.group) v2:channel:v7)
        =*  admissions  admissions.group
        =/  secret=?
          ?=(%secret privacy.admissions)
        =/  =cordon:v2:gv
          (cordon:v2:admissions:v7 seats.group admissions)
        :*  fleet
            cabals
            zones
            zone-ord
            bloc
            channels
            ~  ::  imported
            cordon
            secret
            meta.group
            flagged-content.group
        ==
      ::
      ++  group-ui
        |=  [=status:neg =net:v7:gv =group:v7:gv]
        ^-  group-ui:v2:gv
        ?.  ?=(%sub -.net)
          [(v2:group:v7 group) `[%chi ~]]
        =/  saga=(unit saga:e)
          ?+  status  ~
            %match  `[%chi ~]
            %clash  `[%lev ~]
          ==
        [(v2:group:v7 group) saga]
      --
    ++  v5
      =<  group
      |%
      ++  group
        |=  =group:v7:gv
        ^-  group:v5:gv
        =/  =fleet:v5:gv
          (~(run by seats.group) vessel:v5:seat)
        =/  cabals=(map sect:v5:gv cabal:v5:gv)
          %-  malt
          %+  turn  ~(tap by roles.group)
          |=  [=role-id:v7:gv =role:v7:gv]
          :-  `sect:v5:gv`role-id
          `cabal:v5:gv`[meta.role ~]
        =/  zones=(map zone:v5:gv realm:zone:v5:gv)
          %-  malt
          %+  turn  ~(tap by sections.group)
          |=  [=section-id:v7:gv =section:v7:gv]
          :-  `zone:v5:gv`section-id
          ^-  realm:zone:v5:gv
          [meta.section order.section]
        =/  zone-ord=(list zone:v5:gv)
          %+  turn  section-order.group
          |=(section-id:v7:gv `zone:v5:gv`+<)
        =/  =bloc:v5:gv
          %-  ~(run in admins.group)
          |=(role-id:v7:gv `sect:v5:gv`+<)
        =/  =channels:channel:v5:gv
          (~(run by channels.group) v5:channel:v7)
        =*  admissions  admissions.group
        =/  secret=?
          ?=(%secret privacy.admissions)
        =/  =cordon:v5:gv
          (cordon:v5:admissions:v7 seats.group admissions)
        :*  fleet
            cabals
            zones
            zone-ord
            bloc
            channels
            ~  ::  active-channels
            ~  ::  imported
            cordon
            secret
            meta.group
            flagged-content.group
        ==
      ++  group-ui
        |=  [=net:v7:gv =group:v7:gv]
        ^-  group-ui:v5:gv
        =/  init=?
          ?:  ?=(%pub -.net)  &
          !=(time.net *@da)
        :*  (v5:group:v7 group)
            init
            ~(wyt by seats.group)
        ==
      --
    ::
    ++  group-ui
      |=  [=net:v7:gv =group:v7:gv]
      ^-  group-ui:v7:gv
      =/  init=?
        ?:  ?=(%pub -.net)  &
        !=(time.net *@da)
      :*  group
          init
          ~(wyt by seats.group)
      ==
    --
  ::
  ++  net
    |%
    ++  v9
      |=  =net:v7:gv
      ^-  net:v9:gv
      =*  log-mp  ((mp time u-group:v7:gv) lte)
      ?:  ?=(%sub -.net)  net
      :-  %pub
      ^-  log:v9:gv
      (urn:log-mp log.net v9:u-group)
    --
  ::
  ++  u-group
    |%
    ++  v9
      |=  [=time =u-group:v7:gv]
      ^-  u-group:v9:gv
      ?:  ?=([%create *] u-group)
        [%create (v9:group group.u-group)]
      ?.  ?=([%entry %ask %add *] u-group)
        u-group
      =*  u-ask  u-ask.u-entry.u-group
      [%entry %ask %add ship.u-ask time note.u-ask]
    --
  ::
  ++  net-group
    |%
    ++  v9
      |=  [=net:v7:gv =group:v7:gv]
      ^-  [net:v9:gv group:v9:gv]
      [(v9:^net net) (v9:^group group)]
    --
  ::
  ++  seat
    |%
    ++  v5  v2
    ++  v2  v0
    ++  v0
      |%
      ++  vessel
        |=  =seat:v7:gv
        ^-  vessel:fleet:v0:gv
        :_  joined.seat
        %-  ~(run in roles.seat)
        |=  =role-id:v7:gv
        `sect:v0:gv`role-id
      --
    --
  ::
  ++  channel
    |%
    ++  v5  v2
    ++  v2  v0
    ++  v0
      |=  channel:v7:gv
      ^-  channel:v0:gv
      :*  meta
          added
          `zone:v0:gv`section
          join
          (~(run in readers) |=(role-id:v7:gv `sect:v0:gv`+<))
      ==
    --
  ::
  ++  admissions
    |%
    ++  v5  v2
    ++  v2
      |%
      ++  cordon
        |=  [seats=(map ship seat:v7:gv) ad=admissions:v7:gv]
        ^-  cordon:v2:gv
        ?:  ?=(%public privacy.ad)
          [%open [ships ranks]:banned.ad]
        :*  %shut
          ~(key by pending.ad)
          ~(key by requests.ad)
        ==
      --
    --
  ::
  ++  r-group
    |%
    ++  v2
      |%
      ++  diff
        |^
        |=  [=r-group:v7:gv seats=(map ship seat:v7:gv) =admissions:v7:gv]
        ^-  (list diff:v2:gv)
        ?-  -.r-group
          %create   [%create (v2:group:v7 group.r-group)]~
          %meta     [%meta meta.r-group]~
          %seat     (diff-from-seat [ships r-seat]:r-group)
          %role     (diff-from-role [roles r-role]:r-group)
          %channel  (diff-from-channel [nest r-channel]:r-group)
          %section  (diff-from-section [section-id r-section]:r-group)
          %entry    (diff-from-entry r-entry.r-group seats admissions)
          %flag-content  [%flag-content [nest plan src]:r-group]~
          %delete  [%del ~]~
        ==
        ::
        ++  diff-from-seat
          |=  [ships=(set ship) =r-seat:v7:gv]
          ^-  (list diff:v2:gv)
          :_  ~
          :+  %fleet
            ships
          ?-  -.r-seat
            %add       [%add ~]
            %del       [%del ~]
            %add-roles  [%add-sects (sects:v2:roles:v7 roles.r-seat)]
            %del-roles  [%del-sects (sects:v2:roles:v7 roles.r-seat)]
          ==
        ::
        ++  diff-from-role
          |=  [roles=(set role-id:v7:gv) =r-role:v7:gv]
          ^-  (list diff:v2:gv)
          ?:  ?=(?(%add %edit %del) -.r-role)
            ?-    -.r-role
                %add
              %+  turn  ~(tap in roles)
              |=  =role-id:v7:gv
              [%cabal `sect:v2:gv`role-id [%add meta.r-role]]
            ::
                %edit
              %+  turn  ~(tap in roles)
              |=  =role-id:v7:gv
              [%cabal `sect:v2:gv`role-id [%edit meta.r-role]]
            ::
                %del
              %+  turn  ~(tap in roles)
              |=  =role-id:v7:gv
              [%cabal `sect:v2:gv`role-id [%del ~]]
            ==
          :_  ~
          :-  %bloc
          ?-  -.r-role
            %set-admin  [%add (sects:v2:roles:v7 roles)]
            %del-admin  [%del (sects:v2:roles:v7 roles)]
          ==
        ::
        ++  diff-from-channel
          |=  [=nest:v7:gv =r-channel:v7:gv]
          ^-  (list diff:v2:gv)
          :_  ~
          :+  %channel
            nest
          ?-    -.r-channel
            %add          [%add (v2:channel:v7 channel.r-channel)]
            %edit         [%edit (v2:channel:v7 channel.r-channel)]
            %del          [%del ~]
            %add-readers  [%add-sects (sects:v2:roles:v7 roles.r-channel)]
            %del-readers  [%del-sects (sects:v2:roles:v7 roles.r-channel)]
            %section      [%zone `zone:v2:gv`section.r-channel]
            %join         [%join join.r-channel]
          ==
        ::
        ++  diff-from-section
          |=  [=section-id:v7:gv =r-section:v7:gv]
          ^-  (list diff:v2:gv)
          :_  ~
          :+  %zone
            `zone:v2:gv`section-id
          ?-  -.r-section
            %add        [%add meta.r-section]
            %edit       [%edit meta.r-section]
            %del        [%del ~]
            %move       [%mov idx.r-section]
            %move-nest  [%mov-nest [nest idx]:r-section]
          ==
        ::
        ++  diff-from-entry
          |=  [=r-entry:v7:gv seats=(map ship seat:v7:gv) =admissions:v7:gv]
          ^-  (list diff:v2:gv)
          ?-  -.r-entry
              %privacy
            :_  ~
            ?-  privacy.r-entry
              %public   [%cordon %swap (cordon:v2:admissions:v7 seats admissions)]
              %private  [%cordon %swap (cordon:v2:admissions:v7 seats admissions)]
              %secret   [%secret &]
            ==
          ::
              %ban
            ?.  ?=(%public privacy.admissions)  ~
            ?:  ?=(%set -.r-ban.r-entry)
              [%cordon %swap [%open [ships ranks]:r-ban.r-entry]]~
            ::  public group
            ::
            :_  ~
            :+  %cordon
              %open
            ?-  -.r-ban.r-entry
              %add-ships  [%add-ships ships.r-ban.r-entry]
              %del-ships  [%del-ships ships.r-ban.r-entry]
              %add-ranks  [%add-ranks ranks.r-ban.r-entry]
              %del-ranks  [%del-ranks ranks.r-ban.r-entry]
            ==
          ::
            %token  ~
          ::
              %pending
            ?:  ?=(%public privacy.admissions)  ~
            ?:  ?=(%edit -.r-pending.r-entry)  ~
            :_  ~
            ?-  -.r-pending.r-entry
              %add  [%cordon %shut %add-ships %pending ships.r-pending.r-entry]
              %del  [%cordon %shut %add-ships %pending ships.r-pending.r-entry]
            ==
          ::
              %ask
            ?:  ?=(%public privacy.admissions)  ~
            :_  ~
            ?-  -.r-ask.r-entry
              %add  [%cordon %shut %add-ships %ask (sy ship.r-ask.r-entry ~)]
              %del  [%cordon %shut %del-ships %ask ships.r-ask.r-entry]
            ==
          ==
        --
      --
    --
  ++  roles
    |%
    ++  v2
      |%
      ++  sects
        |=  roles=(set role-id:v7:gv)
        ^-  (set sect:v2:gv)
        (~(run in roles) |=(role-id:v7:gv `sect:v2:gv`+<))
      --
    --
  ++  foreign
    |%
    ++  v8
      |=  foreign:v7:gv
      ^-  foreign:v8:gv
      :*  (turn invites v8:invite:v7)
          lookup
          preview
          progress
          token
      ==
    ++  v2
      |%
      ++  gang
        |=  foreign:v7:gv
        ^-  gang:v2:gv
        :*  ?~(progress ~ `(claim:v2:progress:v7 u.progress))
            (bind preview v2:preview:v7)
            ::
            ?~  invites  ~
            `(v2:invite:v7 i.invites)
        ==
      --
    --
  ++  progress
    |%
    ++  v2
      |%
      ++  claim
        |=  =progress:v7:gv
        ^-  claim:v2:gv
        :-  |
        ?-  progress
          %ask    %knocking
          %join   %adding
          %watch  %watching
          %done   %done
          %error  %error
        ==
      --
    --
  ++  preview
    |%
    ++  v2
      |=  preview:v7:gv
      ^-  preview:v2:gv
      =/  =cordon:v2:gv
        ::  NB: we can return default values in a cordon
        ::      because the client only cares about the cordon
        ::      to determine the group privacy.
        ::
        ?:  ?=(%public privacy)
          [%open ~ ~]
        [%shut ~ ~]
      :*  flag
          meta
          cordon
          time
          ?=(%secret privacy)
      ==
    --
  ++  channel-preview
    |%
    ++  v2
      |=  channel-preview:v7:gv
      ^-  preview:channel:v2:gv
      :*  nest
          meta
          (v2:^preview preview)
      ==
    --
  ++  invite
    |%
    ++  v8
      |=  invite:v7:gv
      ^-  invite:v8:gv
      :*  flag
          time
          from
          token
          note
          preview
          &  ::  valid
      ==
    ++  v2
      |=  invite:v7:gv
      ^-  invite:v2:gv
      [flag from]
    --
  --
++  v6
  =,  v5
  =>
    |%
    ++  drop-fleet
      |=  [=group:v6:gv =bowl:gall]
      ^-  group:v6:gv
      =.  fleet.group
        =/  our-vessel=vessel:fleet:v6:gv
          (~(gut by fleet.group) our.bowl *vessel:fleet:v6:gv)
        =/  fleet-size=@ud  ~(wyt by fleet.group)
        ?:  (lte fleet-size 15)
          fleet.group  :: keep all members if 15 or fewer
        =/  other-ships=(list [ship vessel:fleet:v6:gv])
          ~(tap by (~(del by fleet.group) our.bowl))
        =/  keep-ships=(list [ship vessel:fleet:v6:gv])
          :-  [our.bowl our-vessel]
          (scag 14 other-ships)  :: take first 14 other ships
        (~(gas by *fleet:v6:gv) keep-ships)
      group
    --
  |%
  ::
  ++  claim
    |%
    ++  v2
      |=  =claim:v6:gv
      ^-  claim:v2:gv
      claim
    ++  v7
      |=  =claim:v6:gv
      ^-  progress:v7:gv
      ?-  progress.claim
        %knocking  %ask
        %adding    %join
        %watching  %watch
        %error     %error
      ==
    --
  ::
  ++  preview
    |%
    ++  v2
      |=  preview:v6:gv
      ^-  preview:v2:gv
      [flag meta cordon time secret]
    ++  v7
      |=  preview:v6:gv
      ^-  preview:v7:gv
      =/  =privacy:v7:gv
        ?:  ?=(%open -.cordon)  %public
        ?:  secret  %secret
        %private
      :*  flag
          meta
          time
          count
          privacy
      ==
    --
  ++  gang
    |%
    ++  v2
      |=  gang:v6:gv
      ^-  gang:v2:gv
      :*  (bind cam v2:claim)
          (bind pev v2:preview)
          vit
      ==
    ++  v5
      |=  gang:v6:gv
      ^-  gang:v5:gv
      [cam pev vit]
    ++  v7
      |=  gang:v6:gv
      ^-  foreign:v7:gv
      =/  invite=(unit invite:v7:gv)
        ?~  vit  ~
        =*  flag  p.u.vit
        =/  =preview:v7:gv
          ?^  pev  (v7:preview u.pev)
          ::  generate a dummy preview, we are going to request
          ::  a fresh preview after the migration completes.
          ::
          :*  flag
              *data:meta
              *@da
              0
              %secret
          ==
        %-  some
        :*  flag
            *@da
            p.flag  ::  .from, assume the host
            ~       ::  .token
            ~       ::  .note
            preview
        ==
      :*  ?~(invite ~ ~[u.invite])
          ~                      ::  lookup
          (bind pev v7:preview)
          (bind cam v7:claim)    ::  progress
          ~                      ::  token
      ==
    --
  ++  group
    |%
    ++  v2
      |=  group:v6:gv
      ^-  group:v2:gv
      :*  fleet
          cabals
          zones
          zone-ord
          bloc
          channels
          imported
          cordon
          secret
          meta
          flagged-content
      ==
    --
  ++  groups-ui
    |%
    ++  v5
      |=  [=net:v6:gv =group:v6:gv =bowl:gall]
      ^-  group-ui:v5:gv
      :*  (drop-fleet group bowl)
          ::  init
          ?:(?=(%pub -.net) & load.net)
          ::  member count
          ~(wyt by fleet.group)
      ==
    --
  ++  group-ui
    |%
    ++  v5
      |=  [=net:v6:gv =group:v6:gv]
      ^-  group-ui:v5:gv
      ::XX why we drop the fleet in groups-ui
      ::   but group-ui does not?
      ::
      :*  group
          ::  init
          ?:(?=(%pub -.net) & load.net)
          ::  member count
          ~(wyt by fleet.group)
      ==
    ++  v2
      |=  [=flag:gv =net:v6:gv =group:v6:gv =status:neg]
      ^-  group-ui:v2:gv
      :-  (v2:^group group)
      ?.  ?=(%sub -.net)  ~
      ?+  status  ~
        %match  `[%chi ~]
        %clash  `[%lev ~]
      ==
    ++  v0
      |=  [=flag:gv =net:v6:gv =group:v6:gv =status:neg]
      ^-  group-ui:v0:gv
      :_  ?.  ?=(%sub -.net)  ~
          ?+  status  ~
            %match  `[%chi ~]
            %clash  `[%lev ~]
          ==
      :*  fleet.group
          cabals.group
          zones.group
          zone-ord.group
          bloc.group
          channels.group
          imported.group
          cordon.group
          secret.group
          meta.group
      ==
    --
  ::
  ++  log
    |%
    ++  v2
      |=  =log:v6:gv
      ^-  log:v2:gv
      (run:log-on:v6:gv log v2:diff)
    --
  ::
  ++  diff
    |%
    ++  v2
      |=  =diff:v6:gv
      ^-  diff:v2:gv
      ?.  ?=(%create -.diff)  diff
      diff(p (v2:group p.diff))
    --
  --
::
++  v5
  =,  v2
  |%
  ++  gang
    |%
    ++  v6
      |=  gang:v5:gv
      ^-  gang:v6:gv
      [cam pev vit ~]
    --
  ++  group
    |%
    ++  v7
      |=  group:v5:gv
      ^-  group:v7:gv
      =/  =privacy:v7:gv
        ?:  ?=(%open -.cordon)
          %public
        ?:  secret
          %secret
        %private
      =/  =banned:v7:gv
        ?.  ?=(%open -.cordon)  [~ ~]
        [ships ranks]:ban.cordon
      =|  pending=(jug ship role-id:v7:gv)
      =?  pending  ?=(%shut -.cordon)
        %-  ~(gas by pending)
        %+  turn  ~(tap in pend.cordon)
        |=(=ship [ship ~])
      ::NB  we don't migrate the asks because
      ::    they need to be re-requested by the subscribers
      ::    to work.
      ::
      =|  requests=(map ship (unit story:s))
      =/  =admissions:v7:gv
        :*  privacy
            banned
            pending
            requests
            ~  ::  tokens
            ~  ::  referrals
            ~  ::  invited
        ==
      =/  seats=(map ship seat:v7:gv)
        %-  ~(run by fleet)
        |=  vessel:fleet:v5:gv
        ^-  seat:v7:gv
        :_  joined
        (~(run in sects) |=(sect:v5:gv `role-id:v7:gv`+<))
      =/  roles=(map role-id:v7:gv role:v7:gv)
        %-  ~(gas by *(map role-id:v7:gv role:v7:gv))
        %+  turn  ~(tap by cabals)
        |=  [=sect:v5:gv =cabal:v5:gv]
        ^-  [role-id:v7:gv role:v7:gv]
        [sect cabal]
      ::XX straight cast
      =/  =admins:v7:gv
        %-  ~(run in bloc)
        |=  =sect:v5:gv
        `role-id:v7:gv`sect
      =/  channels=(map nest:v7:gv channel:v7:gv)
        %-  ~(run by channels)
        |=  channel:v5:gv
        :*  meta
            added
            `section-id:v7:gv`zone
            readers
            join
        ==
      =*  sections-map  (map section-id:v7:gv section:v7:gv)
      =/  sections=sections-map
        %-  ~(gas by *sections-map)
        %+  turn  ~(tap by zones)
        |=  [=zone:v5:gv =realm:zone:v5:gv]
        :-  `section-id:v7:gv`zone
        [met.realm ord.realm]
      :*  meta
        ::
          admissions
          seats
        ::
          roles
          admins
        ::
          channels
          active-channels
        ::
          sections
          ::XX straight cast
          (turn zone-ord |=(zone:v5:gv `section-id:v7:gv`+<))
        ::
          flagged-content
      ==
    --
  ++  net
    |%
    ++  v7
      |=  =net:v5:gv
      ^-  net:v7:gv
      ?:  ?=(%sub -.net)  net
      :-  %pub
      %+  gas:log-on:v7:gv
        *log:v7:gv
      %-  zing
      (turn (tap:log-on:v5:gv p.net) v7:update)
    --
  ++  net-group
    |%
    ++  v7
      |=  [=net:v5:gv =group:v5:gv]
      [(v7:^net net) (v7:^group group)]
    --
  ++  update
    |%
    ++  v7
      |^
      |=  [=time =diff:v5:gv]
      ^-  (list update:v7:gv)
      =*  sect-to-role-id
        |=(sect:v5:gv `role-id:v7:gv`+<)
      ?-    -.diff
          %fleet
        %+  u-single  time
        [%seat p.diff (u-seat-from-diff time q.diff)]
      ::
          %cabal
        %+  u-single  time
        [%role (sy (sect-to-role-id p.diff) ~) (u-role-from-diff q.diff)]
      ::
          %channel
        %+  u-single  time
        [%channel p.diff (u-channel-from-diff q.diff)]
      ::
          %bloc
        %+  u-single  time
        :+  %role
          (~(run in p.p.diff) sect-to-role-id)
        (u-role-from-bloc-diff p.diff)
      ::
          %cordon
        %+  u-many  time
        (turn (u-entry-from-diff p.diff) (lead %entry))
      ::
          %zone
        %+  u-single  time
        [%section `section-id:v7:gv`p.p.diff (u-section-from-diff q.p.diff)]
      ::
        %meta  (u-single time [%meta p.diff])
      ::
          %secret
        ?:  p.diff
          (u-single time [%entry %privacy %secret])
        (u-single time [%entry %privacy %private])
      ::
        %create  (u-single time [%create (v7:group p.diff)])
        %del     (u-single time [%delete ~])
      ::
        %flag-content  (u-single time [%flag-content [nest post-key src]:diff])
      ==
      ::
      ++  u-single
        |=  [=time =u-group:v7:gv]
        [time u-group]~
      ++  u-many
        |=  [=time updates=(list u-group:v7:gv)]
        (turn updates (lead time))
      ::  +u-seat-from-diff: upgrade $fleet diff into $seat update
      ::
      ::  we take care to correctly assign the joined time, which
      ::  previously was set to now.bowl and thus different for each
      ::  subscriber.
      ::
      ++  u-seat-from-diff
        |=  [=time =diff:fleet:v5:gv]
        ^-  u-seat:v7:gv
        ?-    -.diff
          %add  [%add `seat:v7:gv`[~ time]]
          %del  [%del ~]
          %add-sects  [%add-roles (~(run in sects.diff) sect-to-role-id)]
          %del-sects  [%del-roles (~(run in sects.diff) sect-to-role-id)]
        ==
      ++  sect-to-role-id
        |=(sect:v5:gv `role-id:v7:gv`+<)
      ++  u-role-from-diff
        |=  =diff:cabal:v5:gv
        ^-  u-role:v7:gv
        ?-  -.diff
          %add        [%add meta.diff]
          %edit       [%edit meta.diff]
          %del        [%del ~]
        ==
      ++  u-channel-from-diff
        |=  =diff:channel:v5:gv
        ^-  u-channel:v7:gv
        ?-  -.diff
          %add   [%add (v7:channel channel.diff)]
          %edit  [%edit (v7:channel channel.diff)]
          %del   [%del ~]
          %add-sects  [%add-readers (~(run in sects.diff) sect-to-role-id)]
          %del-sects  [%del-readers (~(run in sects.diff) sect-to-role-id)]
          %zone  [%section `section-id:v7:gv`zone.diff]
          %join  [%join join.diff]
        ==
      ++  u-role-from-bloc-diff
        |=  =diff:bloc:v5:gv
        ^-  u-role:v7:gv
        ?-  -.diff
          %add  [%set-admin ~]
          %del  [%del-admin ~]
        ==
      ++  u-entry-from-diff
        |=  =diff:cordon:v5:gv
        ^-  (list u-entry:v7:gv)
        ?-  -.diff
          %open  (u-entry-from-open-cordon-diff p.diff)
          %shut  (u-entry-from-shut-cordon-diff p.diff)
          %swap  (u-entry-from-swap-cordon-diff p.diff)
        ==
      ++  u-entry-from-open-cordon-diff
        |=  =diff:open:cordon:v5:gv
        ^-  (list u-entry:v7:gv)
        ?-  -.diff
          %add-ships  [%ban %add-ships p.diff]~
          %del-ships  [%ban %del-ships p.diff]~
          %add-ranks  [%ban %add-ranks p.diff]~
          %del-ranks  [%ban %del-ranks p.diff]~
        ==
      ++  u-entry-from-shut-cordon-diff
        |=  =diff:shut:cordon:v5:gv
        ^-  (list u-entry:v7:gv)
        ?-    -.diff
            %add-ships
          ?-    p.diff
              %ask
            %+  turn  ~(tap in q.diff)
            |=(=ship [%ask %add ship ~])
          ::
            %pending  [%pending %add q.diff ~]~
          ==
        ::
            %del-ships
          ?-    p.diff
            %ask      [%ask %del q.diff]~
            %pending  [%pending %del q.diff]~
          ==
        ==
      ++  u-entry-from-swap-cordon-diff
        |=  =cordon:v5:gv
        ^-  (list u-entry:v7:gv)
        ?+    -.cordon  ~|(%u-entry-from-swap-cordon-diff-bad-afar !!)
            %open
          :-  [%privacy %public]
          [%ban %set [ships ranks]:ban.cordon]~
        ::
            %shut
          :-  [%privacy %private]
          :-  [%pending %add pend.cordon ~]
          %+  turn  ~(tap in ask.cordon)
          |=(=ship [%ask %add ship ~])
        ==
      ++  u-section-from-diff
        |=  =delta:zone:v5:gv
        ^-  u-section:v7:gv
        ?-  -.delta
          %add       [%add meta.delta]
          %edit      [%edit meta.delta]
          %del       [%del ~]
          %mov       [%move idx.delta]
          %mov-nest  [%move-nest nest.delta idx.delta]
        ==
      --
    --
  --
::
++  v2
  =,  v0
  |%
  ++  group
    |%
    ++  v5
      |=  group:v2:gv
      ^-  group:v5:gv
      :*  fleet
          cabals
          zones
          zone-ord
          bloc
          channels
          ~  ::  active-channels
          imported
          cordon
          secret
          meta
          flagged-content
      ==
    --
  ++  net-group
    |%
    ++  v5
      |=  [net-2=net:v2:gv group-2=group:v2:gv]
      [(v5:net net-2) (v5:group group-2)]
    --
  ++  net
    |%
    ++  v5
      |=  net-2=net:v2:gv
      ^-  net:v5:gv
      ?:  ?=(%sub -.net-2)
        [%sub p.net-2 load.net-2]
      [%pub (run:log-on:v2:gv p.net-2 v5:diff)]
    --
  ++  gang
    |%
    ++  v5
      |=  gang:v2:gv
      ^-  gang:v5:gv
      [(bind cam v5:claim) (bind pev v5:preview) vit]
    --
  ::
  ++  preview
    |%
    ++  v5
      |=  preview:v2:gv
      ^-  preview:v5:gv
      [flag meta cordon time secret 0]
    --
  ::
  ++  claim
    |%
    ++  v5
      |=  claim:v2:gv
      ^-  claim:v5:gv
      ::  there is no trace of %done ever being used
      ::  since the earliest recorded version of %groups.
      ::  thus we are free to treat such claims as an %error.
      ::
      :-  join-all
      ?:(?=(%done progress) %error progress)
    --
  ::
  ++  diff
    |%
    ++  v7
      |%
      ++  a-group
        |^
        |=  =diff:v2:gv
        ^-  (list a-group:v7:gv)
        ?+  -.diff  ~|(a-group-bad-diff+-.diff !!)
          %fleet    (a-group-from-fleet [p q]:diff)
          %cabal    (a-group-from-cabal [p q]:diff)
          %channel  (a-group-from-channel [p q]:diff)
          %bloc     (a-group-from-bloc p.diff)
          %cordon   (a-group-from-cordon p.diff)
          %zone     (a-group-from-zone p.diff)
          %meta     [%meta p.diff]~
          %flag-content  [%flag-content [nest post-key src]:diff]~
        ==
        ::
        ++  a-group-from-fleet
          |=  [ships=(set ship) =diff:fleet:v2:gv]
          ^-  (list a-group:v7:gv)
          :_  ~
          :+  %seat
            ships
          ?-  -.diff
            %add  [%add ~]
            %del  [%del ~]
          ::
              %add-sects
            [%add-roles (roles-from-sects sects.diff)]
          ::
              %del-sects
            [%del-roles (roles-from-sects sects.diff)]
          ==
        ++  a-group-from-cabal
          |=  [=sect:v2:gv =diff:cabal:v2:gv]
          ^-  (list a-group:v7:gv)
          :_  ~
          ^-  a-group:v7:gv
          :+  %role
            (sy `role-id:v7:gv`sect ~)
          ?-  diff
            [%add meta=data:meta]   [%add meta.diff]
            [%edit meta=data:meta]  [%edit meta.diff]
            [%del ~]                [%del ~]
          ==
        ++  a-group-from-channel
          |=  [=nest:v2:gv =diff:channel:v2:gv]
          ^-  (list a-group:v7:gv)
          :_  ~
          :+  %channel  nest
          ?-    -.diff
            %add   [%add (v7:channel channel.diff)]
            %edit  [%edit (v7:channel channel.diff)]
            %del   [%del ~]
          ::
              %add-sects
            [%add-readers (roles-from-sects sects.diff)]
          ::
              %del-sects
            [%del-readers (roles-from-sects sects.diff)]
          ::
            %zone  [%section `section-id:v7:gv`zone.diff]
            %join  ~|(%a-group-from-channel-join !!)
          ==
        ++  roles-from-sects
          |=  sects=(set sect:v2:gv)
          ^-  (set role-id:v7:gv)
          (~(run in sects) |=(sect:v2:gv `role-id:v7:gv`+<))
        ++  a-group-from-bloc
          |=  =diff:bloc:v2:gv
          ^-  (list a-group:v7:gv)
          :_  ~
          ?-    -.diff
              %add
            [%role (roles-from-sects p.diff) %set-admin ~]
          ::
              %del
            [%role (roles-from-sects p.diff) %del-admin ~]
          ==
        ++  a-group-from-cordon
          |=  =diff:cordon:v2:gv
          ^-  (list a-group:v7:gv)
          ?-    -.diff
              %open
            ?-  -.p.diff
              %add-ships  [%entry %ban %add-ships p.p.diff]~
              %del-ships  [%entry %ban %del-ships p.p.diff]~
              %add-ranks  [%entry %ban %add-ranks p.p.diff]~
              %del-ranks  [%entry %ban %del-ranks p.p.diff]~
            ==
          ::
              %shut
            ::  conversion implemented in +poke in /app/groups
            ~|(%a-group-from-cordon-shut-unsupported !!)
          ::
              %swap
            =*  cordon  p.diff
            ?-    -.cordon
                %open
              :~  [%entry %ban %set [~ ~]]
                  [%entry %privacy %public]
              ==
            ::
                %shut
              ~|  a-group-from-cordon-swap-bad-shut+cordon
              ?>  &(=(~ ask.cordon) =(~ pend.cordon))
              :~  [%entry %privacy %private]
              ==
            ::
                %afar
              ~|(a-group-from-cordon-bad-cordon+cordon !!)
            ==
          ==
        ++  a-group-from-zone
          |=  [=zone:v2:gv =delta:zone:v2:gv]
          ^-  (list a-group:v7:gv)
          :_  ~
          :+  %section  `section-id:v7:gv`zone
          ?-  -.delta
            %add   [%add meta.delta]
            %edit  [%edit meta.delta]
            %del   [%del ~]
            %mov   [%move idx.delta]
            %mov-nest  [%move-nest [nest idx]:delta]
          ==
        --
      --
    ++  v5
      |=  =diff:v2:gv
      ^-  diff:v5:gv
      ?.  ?=(%create -.diff)  diff
      diff(p (v5:group p.diff))
    --
  --
++  v0
  |%
  ++  groups
    |%
    ++  v2
      |=  groups=net-groups:v0:gv
      =*  v2  v2:gv
      ^-  net-groups:v2
      %-  ~(run by groups)
      |=  [=net:v0:gv gr=group:v0:gv]
      ^-  [net:v2 group:v2]
      :_  (v2:group gr)
      ?-  -.net
          %sub  net
          %pub
        :-  %pub
        %+  gas:log-on:v2  *log:v2
        %+  turn
          (tap:log-on:v0:gv p.net)
        |=  [t=time =diff:v0:gv]
        ^-  [time diff:v2]
        :-  t
        ?+  -.diff  diff
          %create  [%create (v2:group p.diff)]
        ==
      ==
    --
  ++  group
    |%
    ++  v2
      |=  group:v0:gv
      ^-  group:v2:gv
      %*  .  *group:v2:gv
        fleet       fleet
        cabals      cabals
        zones       zones
        zone-ord    zone-ord
        bloc        bloc
        channels    channels
        imported    imported
        cordon      cordon
        secret      secret
        meta        meta
        flagged-content  ~
      ==
    --
  ++  create
    |%
    ++  v7
      |%
      ++  create-group
        |=  create:v2:gv
        ^-  create-group:v7:gv
        =/  meta=data:meta
          [title description image cover]
        ~|  %afar-cordon-not-supported
        ?>  ?=(?(%open %shut) -.cordon)
        =/  =privacy:v7:gv
          ?:  ?=(%open -.cordon)  %public
          ?.  secret  %private
          %secret
        =/  =banned:v7:gv
          ?:  ?=(%shut -.cordon)  [~ ~]
          [ships ranks]:ban.cordon
        :*  name
            meta
            privacy
            banned
            members
        ==
      --
    --
  ++  channel
    |%
    ++  v7
      |=  channel:v0:gv
      ^-  channel:v7:gv
      :*  meta
          added
          `section-id:v7:gv`zone
          (~(run in readers) |=(sect:v0:gv `role-id:v7:gv`+<))
          join
      ==
    --
  --
--
