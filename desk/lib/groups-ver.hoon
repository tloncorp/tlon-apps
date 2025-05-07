::  groups-ver: groups type conversions
::
/-  g=groups
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
          ?:  ?=(%public privacy.admissions)
            [%open [ships ranks]:banned.admissions]
          ::TICKETS to be implemented when we have settled
          ::        upon entry mechanics
          [%shut ~ ~]
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
        |=  [[=net:v7:g =group:v7:g] our=ship]
        ^-  group-ui:v2:g
        ::XX  saga is unused by the client?
        :_  ~
        (v2:group:v7 (drop-seats group our))
      --
    ::
    ++  group-ui
      |=  [[=net:v7:g =group:v7:g] our=ship]
      ^-  group-ui:v7:g
      =/  init=?
        ?:  ?=(%pub -.net)  &
        init.net
      :*  (drop-seats group our)
          init
          ~(wyt by seats.group)
      ==
    --
  ::
  ++  seat
    |%
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
    ++  action
      |%
      ++  v5
        |=  =r-group:v7:g
        ^-  action:v5:g
        !!
      ++  v2
        |=  =r-group:v7:g
        ^-  action:v2:g
        !!
      --
    --
  --
++  v6
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
  |%
  ++  diff
    |%
    ++  v5
      |=  =diff:v2:g
      ^-  diff:v5:g
      ?.  ?=(%create -.diff)  diff
      diff(p (v5:group p.diff))
    --
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
  --
--
