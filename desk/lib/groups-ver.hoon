::  groups-vegg: groups type conversions
::
/-  g=groups, meta
/+  neg=negotiate
::
|%
++  v7
  |%
  ::
  ++  group
    =>
      |%
      ++  drop-seats
        |=  [=group:v7:g our=ship]
        ^-  group:v7:g
        =.  seats.group
          =/  our-seat=seat:v7:g
            (~(gut by seats.group) our *seat:v7:g)
          =/  seats-number=@ud  ~(wyt by seats.group)
          ?:  (lte seats-number 15)
            seats.group  :: keep all members if 15 or fewer
          =/  other-ships=(list [ship seat:v7:g])
            ~(tap by (~(del by seats.group) our))
          =/  keep-ships=(list [ship seat:v7:g])
            :-  [our our-seat]
            (scag 14 other-ships)  :: take first 14 other ships
          (~(gas by *(map ship seat:v7:g)) keep-ships)
        group
      --
    |%
    ++  v2
      =<  group
      |%
      ++  group
        |=  =group:v7:g
        ^-  group:v2:g
        =/  =fleet:v2:g
          (~(run by seats.group) vessel:v2:seat)
        =/  cabals=(map sect:v2:g cabal:v2:g)
          %-  malt
          %+  turn  ~(tap by roles.group)
          |=  [=role-id:v7:g =role:v7:g]
          :-  `sect:v2:g`role-id
          `cabal:v2:g`[meta.role ~]
        =/  zones=(map zone:v2:g realm:zone:v2:g)
          %-  malt
          %+  turn  ~(tap by sections.group)
          |=  [=section-id:v7:g =section:v7:g]
          :-  `zone:v2:g`section-id
          ^-  realm:zone:v2:g
          [meta.section order.section]
        =/  zone-ord=(list zone:v2:g)
          %+  turn  section-order.group
          |=(section-id:v7:g `zone:v2:g`+<)
        =/  =bloc:v2:g
          %-  ~(run in admins.group)
          |=(role-id:v7:g `sect:v2:g`+<)
        =/  =channels:channel:v2:g
          (~(run by channels.group) v2:channel:v7)
        =*  admissions  admissions.group
        =/  secret=?
          ?=(%secret privacy.admissions)
        =/  =cordon:v2:g
          (cordon:v2:admissions:v7 admissions)
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
        |=  [=net:v7:g =group:v7:g]
        ^-  group-ui:v2:g
        ::XX  saga is unused by the client?
        :_  ~
        (v2:group:v7 group)
      --
    ++  v5
      =<  group
      |%
      ++  group
        |=  =group:v7:g
        ^-  group:v5:g
        =/  =fleet:v5:g
          (~(run by seats.group) vessel:v5:seat)
        =/  cabals=(map sect:v5:g cabal:v5:g)
          %-  malt
          %+  turn  ~(tap by roles.group)
          |=  [=role-id:v7:g =role:v7:g]
          :-  `sect:v5:g`role-id
          `cabal:v5:g`[meta.role ~]
        =/  zones=(map zone:v5:g realm:zone:v5:g)
          %-  malt
          %+  turn  ~(tap by sections.group)
          |=  [=section-id:v7:g =section:v7:g]
          :-  `zone:v5:g`section-id
          ^-  realm:zone:v5:g
          [meta.section order.section]
        =/  zone-ord=(list zone:v5:g)
          %+  turn  section-order.group
          |=(section-id:v7:g `zone:v5:g`+<)
        =/  =bloc:v5:g
          %-  ~(run in admins.group)
          |=(role-id:v7:g `sect:v5:g`+<)
        =/  =channels:channel:v5:g
          (~(run by channels.group) v5:channel:v7)
        =*  admissions  admissions.group
        =/  secret=?
          ?=(%secret privacy.admissions)
        =/  =cordon:v5:g
          (cordon:v5:admissions:v7 admissions)
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
        |=  [=net:v7:g =group:v7:g]
        ^-  group-ui:v5:g
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
      |=  [=net:v7:g =group:v7:g]
      ^-  group-ui:v7:g
      =/  init=?
        ?:  ?=(%pub -.net)  &
        !=(time.net *@da)
      :*  group
          init
          ~(wyt by seats.group)
      ==
    --
  ::
  ++  seat
    |%
    ++  v5  v2
    ++  v2  v0
    ++  v0
      |%
      ++  vessel
        |=  =seat:v7:g
        ^-  vessel:fleet:v0:g
        :_  joined.seat
        %-  ~(run in roles.seat)
        |=  =role-id:v7:g
        `sect:v0:g`role-id
      --
    --
  ::
  ++  channel
    |%
    ++  v5  v2
    ++  v2  v0
    ++  v0
      |=  channel:v7:g
      ^-  channel:v0:g
      :*  meta
          added
          `zone:v0:g`section
          join
          (~(run in readers) |=(role-id:v7:g `sect:v0:g`+<))
      ==
    --
  ::
  ++  admissions
    |%
    ++  v5  v2
    ++  v2
      |%
      ++  cordon
        |=  ad=admissions:v7:g
        ^-  cordon:v2:g
        ?:  ?=(%public privacy.ad)
          [%open [ships ranks]:banned.ad]
        ::TODO figure out compatible logic for
        ::     the pending set
        :*  %shut
          ~                      :: pending
          ~(key by requests.ad)  :: ask
        ==
      --
    --
  ::
  ++  log
    |%
    ++  v2
      |=  =log:v7:g
      ~|(%not-implemented !!)
    ++  v5
      |=  =log:v7:g
      ~|(%not-implemented !!)
    --
  ::
  ++  r-group
    |%
    ++  v2
      |%
      ++  diff
        |^
        |=  =r-group:v7:g
        ^-  (list diff:v2:g)
        ?-  -.r-group
          %create   [%create (v2:group:v7 group.r-group)]~
          %meta     [%meta meta.r-group]~
          %seat     (diff-from-seat [ships r-seat]:r-group)
          %role     (diff-from-role [roles r-role]:r-group)
          %channel  (diff-from-channel [nest r-channel]:r-group)
          %section  (diff-from-section [section-id r-section]:r-group)
          %entry    (diff-from-entry r-entry.r-group)
          %flag-content  [%flag-content [nest post-key src]:r-group]~
          %delete  [%del ~]~
        ==
        ::
        ++  diff-from-seat
          |=  [ships=(set ship) =r-seat:v7:g]
          ^-  (list diff:v2:g)
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
          |=  [roles=(set role-id:v7:g) =r-role:v7:g]
          ^-  (list diff:v2:g)
          ?:  ?=(?(%add %edit %del) -.r-role)
            ?-    -.r-role
                %add       
              %+  turn  ~(tap in roles)
              |=  =role-id:v7:g
              [%cabal `sect:v2:g`role-id [%add meta.r-role]]
            ::
                %edit
              %+  turn  ~(tap in roles)
              |=  =role-id:v7:g
              [%cabal `sect:v2:g`role-id [%edit meta.r-role]]
            ::
                %del
              %+  turn  ~(tap in roles)
              |=  =role-id:v7:g
              [%cabal `sect:v2:g`role-id [%del ~]]
            ==
          :_  ~
          :-  %bloc
          ?-  -.r-role
            %set-admin  [%add (sects:v2:roles:v7 roles)]
            %del-admin  [%del (sects:v2:roles:v7 roles)]
          ==
        ::
        ++  diff-from-channel
          |=  [=nest:v7:g =r-channel:v7:g]
          ^-  (list diff:v2:g)
          :_  ~
          :+  %channel
            nest
          ?-    -.r-channel
            %add          [%add (v2:channel:v7 channel.r-channel)]
            %edit         [%edit (v2:channel:v7 channel.r-channel)]
            %del          [%del ~]
            %add-readers  [%add-sects (sects:v2:roles:v7 roles.r-channel)]
            %del-readers  [%del-sects (sects:v2:roles:v7 roles.r-channel)]
            %section      [%zone `zone:v2:g`section.r-channel]
          ==
        ::
        ++  diff-from-section
          |=  [=section-id:v7:g =r-section:v7:g]
          ^-  (list diff:v2:g)
          :_  ~
          :+  %zone
            `zone:v2:g`section-id
          ?-  -.r-section
            %add        [%add meta.r-section]
            %edit       [%edit meta.r-section]
            %del        [%del ~]
            %move       [%mov idx.r-section]
            %move-nest  [%mov-nest [nest idx]:r-section]
          ==
        ::
        ++  diff-from-entry
          |=  =r-entry:v7:g
          ^-  (list diff:v2:g)
          ?-  -.r-entry
              %privacy  
            :_  ~
            ?-  privacy.r-entry
              ::XX this should be improved when privacy change
              ::   logic is worked out. the conversion function
              ::   should probably be passed admissions structure
              ::   to populate the full cordon.
              ::
              %public   [%cordon %swap [%open *ban:open:cordon:v2:g]]
              %private  [%cordon %swap [%shut ~ ~]]
              %secret   [%secret &]
            ==
          ::
              %ban
            ?:  ?=(%set -.r-ban.r-entry)
              [%cordon %swap [%open [ships ranks]:r-ban.r-entry]]~
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
          ==
        --
      --
    --
  ++  roles
    |%
    ++  v2
      |%
      ++  sects
        |=  roles=(set role-id:v7:g)
        ^-  (set sect:v2:g)
        (~(run in roles) |=(role-id:v7:g `sect:v2:g`+<))
      --
    --
  ++  foreign
    |%
    ++  v2
      |%
      ++  gang
        |=  foreign:v7:g
        ^-  gang:v2:g
        :*  ?~(join ~ `(claim:v2:progress:v7 progress.u.join))
            (bind preview v2:preview:v7)
            ::
            ?~  invites  ~
            `(v2:invite:v7 +.i.invites)
        ==
      --
    --
  ++  progress
    |%
    ++  v2
      |%
      ++  claim
        |=  =progress:v7:g
        ^-  claim:v2:g
        :-  |
        ?-  progress
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
      |=  preview:v7:g
      ^-  preview:v2:g
      =/  =cordon:v2:g
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
  ++  invite
    |%
    ++  v2
      |=  invite:v7:g
      ^-  invite:v2:g
      [flag from]
    --
  --
++  v6
  =,  v5
  =>
    |%
    ++  drop-fleet
      |=  [=group:v6:g =bowl:gall]
      ^-  group:v6:g
      =.  fleet.group
        =/  our-vessel=vessel:fleet:v6:g  
          (~(gut by fleet.group) our.bowl *vessel:fleet:v6:g)
        =/  fleet-size=@ud  ~(wyt by fleet.group)
        ?:  (lte fleet-size 15)
          fleet.group  :: keep all members if 15 or fewer
        =/  other-ships=(list [ship vessel:fleet:v6:g])
          ~(tap by (~(del by fleet.group) our.bowl))
        =/  keep-ships=(list [ship vessel:fleet:v6:g])
          :-  [our.bowl our-vessel]
          (scag 14 other-ships)  :: take first 14 other ships
        (~(gas by *fleet:v6:g) keep-ships)
      group
    --
  |%
  ::
  ++  claim
    |%
    ++  v2
      |=  =claim:v6:g
      ^-  claim:v2:g
      claim
    --
  ::
  ++  preview
    |%
    ++  v2
      |=  preview:v6:g
      ^-  preview:v2:g
      [flag meta cordon time secret]
    --
  ++  gang
    |%
    ++  v2
      |=  gang:v6:g
      ^-  gang:v2:g
      :*  (bind cam v2:claim)
          (bind pev v2:preview)
          vit
      ==
    ++  v5
      |=  gang:v6:g
      ^-  gang:v5:g
      [cam pev vit]
    --
  ++  group
    |%
    ++  v2
      |=  group:v6:g
      ^-  group:v2:g
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
      |=  [=net:v6:g =group:v6:g =bowl:gall]
      ^-  group-ui:v5:g
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
      |=  [=net:v6:g =group:v6:g]
      ^-  group-ui:v5:g
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
      |=  [=flag:g =net:v6:g =group:v6:g =status:neg]
      ^-  group-ui:v2:g
      :-  (v2:^group group)
      ?.  ?=(%sub -.net)  ~
      ?+  status  ~
        %match  `[%chi ~]
        %clash  `[%lev ~]
      ==
    ++  v0
      |=  [=flag:g =net:v6:g =group:v6:g =status:neg]
      ^-  group-ui:v0:g
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
      |=  =log:v6:g
      ^-  log:v2:g
      (run:log-on:v6:g log v2:diff)
    --
  ::
  ++  diff
    |%
    ++  v2
      |=  =diff:v6:g
      ^-  diff:v2:g
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
      |=  gang:v5:g
      ^-  gang:v6:g
      [cam pev vit ~]
    --
  --
::
++  v2
  =,  v0
  |%
  ++  group
    |%
    ++  v5
      |=  group:v2:g
      ^-  group:v5:g
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
      |=  [net-2=net:v2:g group-2=group:v2:g]
      [(v5:net net-2) (v5:group group-2)]
    --
  ++  net
    |%
    ++  v5
      |=  net-2=net:v2:g
      ^-  net:v5:g
      ?:  ?=(%sub -.net-2)
        [%sub p.net-2 load.net-2]
      [%pub (run:log-on:v2:g p.net-2 v5:diff)]
    --
  ++  gang
    |%
    ++  v5
      |=  gang:v2:g
      ^-  gang:v5:g
      [(bind cam v5:claim) (bind pev v5:preview) vit]
    --
  ::
  ++  preview
    |%
    ++  v5
      |=  preview:v2:g
      ^-  preview:v5:g
      [flag meta cordon time secret 0]
    --
  ::
  ++  claim
    |%
    ++  v5
      |=  claim:v2:g
      ^-  claim:v5:g
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
        |=  =diff:v2:g
        ^-  (list a-group:v7:g)
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
          |=  [ships=(set ship) =diff:fleet:v2:g]
          ^-  (list a-group:v7:g)
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
          |=  [=sect:v2:g =diff:cabal:v2:g]
          ^-  (list a-group:v7:g)
          :_  ~
          ^-  a-group:v7:g
          :+  %role  
            (sy `role-id:v7:g`sect ~)
          ?-  diff
            [%add meta=data:meta]   [%add meta.diff]
            [%edit meta=data:meta]  [%edit meta.diff]
            [%del ~]                [%del ~]
          ==
        ++  a-group-from-channel
          |=  [=nest:v2:g =diff:channel:v2:g]
          ^-  (list a-group:v7:g)
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
            %zone  [%section `section-id:v7:g`zone.diff]
            %join  ~|(%a-group-from-channel-join !!)
          ==
        ++  roles-from-sects
          |=  sects=(set sect:v2:g)
          ^-  (set role-id:v7:g)
          (~(run in sects) |=(sect:v2:g `role-id:v7:g`+<))
        ++  a-group-from-bloc
          |=  =diff:bloc:v2:g
          ^-  (list a-group:v7:g)
          :_  ~
          ?-    -.diff
              %add
            [%role (roles-from-sects p.diff) %set-admin ~]
          ::
              %del
            [%role (roles-from-sects p.diff) %del-admin ~]
          ==
        ++  a-group-from-cordon
          |=  =diff:cordon:v2:g
          ^-  (list a-group:v7:g)
          ?-    -.diff
              %open
            ?-  -.p.diff
              %add-ships  [%entry %ban %add-ships p.p.diff]~
              %del-ships  [%entry %ban %add-ships p.p.diff]~
              %add-ranks  [%entry %ban %add-ranks p.p.diff]~
              %del-ranks  [%entry %ban %del-ranks p.p.diff]~
            ==
          ::
              %shut
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
              ::TODO find out whether we need to support
              ::     swapping for non-empty shut cordon
              ::
              :~  [%entry %privacy %private]
              ==
            ::
                %afar
              ~|(a-group-from-cordon-bad-cordon+cordon !!)
            ==
          ==
        ++  a-group-from-zone
          |=  [=zone:v2:g =delta:zone:v2:g]
          ^-  (list a-group:v7:g)
          :_  ~
          :+  %section  `section-id:v7:g`zone
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
      |=  =diff:v2:g
      ^-  diff:v5:g
      ?.  ?=(%create -.diff)  diff
      diff(p (v5:group p.diff))
    --
  --
++  v0
  |%
  ++  groups
    |%
    ++  v2
      |=  groups=net-groups:v0:g
      =*  v2  v2:g
      ^-  net-groups:v2
      %-  ~(run by groups)
      |=  [=net:v0:g gr=group:v0:g]
      ^-  [net:v2 group:v2]
      :_  (v2:group gr)
      ?-  -.net
          %sub  net
          %pub
        :-  %pub
        %+  gas:log-on:v2  *log:v2
        %+  turn
          (tap:log-on:v0:g p.net)
        |=  [t=time =diff:v0:g]
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
      |=  group:v0:g
      ^-  group:v2:g
      %*  .  *group:v2:g
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
        |=  create:v2:g
        ^-  create-group:v7:g
        =/  meta=data:meta
          [title description image cover]
        ?>  ?=(?(%open %shut) -.cordon)
        =/  =privacy:v7:g
          ?:  ?=(%open -.cordon)  %public
          ?.  secret  %private
          %secret
        =/  =banned:v7:g
          ?:  ?=(%shut -.cordon)  [~ ~]
          [ships ranks]:ban.cordon
        :*  name
            meta
            privacy
            banned
            ~(key by members)  ::  guests
        ==
      --
    --
  ++  channel
    |%
    ++  v7
      |=  channel:v0:g
      ^-  channel:v7:g
      :*  meta
          added
          `section-id:v7:g`zone
          (~(run in readers) |=(sect:v0:g `role-id:v7:g`+<))
          join
      ==
    --
  --
--
