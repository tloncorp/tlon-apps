/-  g=groups
/-  meta
/+  default-agent, verb, dbug
/+  groups-json  :: unused, nice for perf
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  +$  state-0
    $:  %0
        groups=(map flag:g [net:g group:g])
        xeno=(map flag:g gang:g)
    ==
  --
=|  state-0
=*  state  -
=< 
  %+  verb  &
  %-  agent:dbug
  |_  =bowl:gall
  +*  this  .
      def   ~(. (default-agent this %|) bowl)
      cor   ~(. +> [bowl ~])
  ++  on-init  
    ^-  (quip card _this)
    `this
  ::
  ++  on-save  !>(state)
  ++  on-load
    |=  =vase
    ^-  (quip card _this)
    =/  old=(unit state-0)
      (mole |.(!<(state-0 vase)))  
    ?^  old  `this(state u.old)
    ~&  >>>  "Incompatible load, nuking"
    =^  cards  this  on-init
    :_  this
    =-  (welp - cards)
    %+  turn  ~(tap in ~(key by wex.bowl))
    |=  [=wire =ship =term] 
    ^-  card
    [%pass wire %agent [ship term] %leave ~]
  ::
  ++  on-poke
    |=  [=mark =vase]
    ^-  (quip card _this)
    =^  cards  state
      abet:(poke:cor mark vase)
    [cards this]
  ++  on-watch
    |=  =path
    ^-  (quip card _this)
    =^  cards  state
      abet:(watch:cor path)
    [cards this]
  ::
  ++  on-peek   peek:cor
  ::
  ++  on-leave   on-leave:def
  ++  on-fail    on-fail:def
  ::
  ++  on-agent
    |=  [=wire =sign:agent:gall]
    ^-  (quip card _this)
    =^  cards  state
      abet:(agent:cor wire sign)
    [cards this]
  ++  on-arvo
    |=  [=wire sign=sign-arvo]
    ^-  (quip card _this)
    =^  cards  state
      abet:(arvo:cor wire sign)
    [cards this]
  --
|_  [=bowl:gall cards=(list card)]
++  abet  [(flop cards) state]
++  cor   .
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))
++  give  |=(=gift:agent:gall (emit %give gift))
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?+    mark  ~|(bad-mark/mark !!)
      %group-leave
    =+  !<(=flag:g vase)
    ?<  =(our.bowl p.flag)
    go-abet:go-leave:(go-abed:group-core flag)
  ::
      %group-create
    =+  !<(=create:g vase)
    =/  =flag:g  [our.bowl name.create]
    ~!  members.create
    =/  =fleet:g
      %-  ~(run by members.create)
      |=  sects=(set sect:g)
      ^-  vessel:fleet:g
      [sects *time]
    =/  =group:g
      [fleet ~ ~ ~ ~ cordon.create title.create description.create image.create color.create] 
    =.  groups  (~(put by groups) flag *net:g group)
    =.  cor  (give-invites flag ~(key by members.create))
    go-abet:(go-init:(go-abed:group-core flag) create)
  ::
      %group-action  
    =+  !<(=action:g vase)
    =.  p.q.action  now.bowl
    =/  group-core  (go-abed:group-core p.action)
    go-abet:(go-update:group-core q.action)
  ::
      %group-invite
    =+  !<(=invite:g vase)
    ?:  =(q.invite our.bowl)
      :: invitee
      ga-abet:(ga-invite:(ga-abed:gang-core p.invite) invite)
    :: inviter
    =/  cage  group-invite+!>(invite)
    (emit [%pass /gangs/invite %agent [q.invite dap.bowl] %poke cage])
  ::
      %group-join
    =+  !<(=join:g vase)
    =/  =gang:g  (~(gut by xeno) flag.join [~ ~ ~])
    =/  =claim:g  [join-all.join %adding]
    =.  cam.gang  `claim
    =.  xeno  (~(put by xeno) flag.join gang)
    ga-abet:ga-start-join:(ga-abed:gang-core flag.join)
  ==
++  watch
  |=  =(pole knot)
  ^+  cor
  ?+  pole  ~|(bad-watch/path !!)
  ::
    [%groups %ui ~]       cor
    [%groups ~]           cor
    [%gangs %updates ~]   cor
  ::
      [%groups ship=@ name=@ rest=*]
    =/  ship=@p  (slav %p ship.pole)
    go-abet:(go-watch:(go-abed:group-core ship name.pole) rest.pole)
  ::
      [%gangs %index ship=@ ~]
    =/  =ship  (slav %p ship.pole)
    ?:  =(our.bowl ship)  res-gang-index
    (req-gang-index ship)
  ::
     [%gangs ship=@ name=@ rest=*]
    =/  ship=@p  (slav %p ship.pole)
    ga-abet:(ga-watch:(ga-abed:gang-core ship name.pole) rest.pole)
  ::
  ==
++  peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  ?+    pole  [~ ~]
      [%x %groups ~]
    ``groups+!>(`groups:g`(~(run by groups) tail))
  ::
      [%x %gangs ~]
    ``gangs+!>(`gangs:g`xeno)
  ::
      [%x %groups ship=@ name=@ rest=*]
    =/  ship  (slav %p ship.pole)
    (go-peek:(go-abed:group-core ship name.pole) rest.pole)
  ==
    
++  agent
  |=  [=(pole knot) =sign:agent:gall]
  ^+  cor
  ?+    pole  ~|(bad-agent-take/pole !!)
      [%groups ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    go-abet:(go-agent:(go-abed:group-core ship name.pole) rest.pole sign)
  ::
      [%gangs %index ship=@ ~]
    (take-gang-index (slav %p ship.pole) sign)
  ::
      [%gangs ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    ga-abet:(ga-agent:(ga-abed:gang-core ship name.pole) rest.pole sign)
  ==
::
++  arvo
  |=  [=wire sign=sign-arvo]
  ^+  cor
  !!
++  give-invites
  |=  [=flag:g ships=(set ship)]
  %-  emil
    %+  turn
      ~(tap in ships)
    |=  =ship
    ^-  card
    =/  cage  group-invite+!>(`invite:g`[flag ship])
    =/  line  `wire`/gangs/(scot %p p.flag)/[q.flag]/invite
    [%pass line %agent [ship dap.bowl] %poke cage]
++  group-core
  |_  [=flag:g =net:g =group:g gone=_|]
  ++  go-core  .
  ++  go-abet
    =.  groups 
      ?:  gone  (~(del by groups) flag)
      (~(put by groups) flag net group)
    ?.  gone  cor
    =/  =action:g  [flag now.bowl %del ~]
    (give %fact ~[/groups/ui] group-action+!>(action))
  ++  go-abed
    |=  f=flag:g
    ^+  go-core
    =/  [n=net:g gr=group:g]  (~(got by groups) f)
    go-core(flag f, group gr, net n)
  ::
  ++  go-area  `path`/groups/(scot %p p.flag)/[q.flag]
  ++  go-is-bloc
    |(=(src.bowl p.flag) (~(has in go-bloc-who) src.bowl))
  ++  go-bloc-who
    %+  roll  ~(tap by fleet.group)
    |=  [[who=ship =vessel:fleet:g] out=(set ship)]
    ?:  =(~ (~(int in sects.vessel) bloc.group))
      out
    (~(put in out) who)
  ::
  ++  go-pass
    |%
    ++  leave
      ^-  card
      =/  =wire  (snoc go-area %updates)
      =/  =dock  [p.flag dap.bowl]
      [%pass wire %agent dock %leave ~]
    ::
    ++  remove-self
      ^-  card
      =/  =wire  (snoc go-area %proxy)
      =/  =dock  [p.flag dap.bowl]
      =/  =cage
        :-  %group-action
        !>  ^-  action:g
        [flag now.bowl %fleet (silt our.bowl ~) %del ~]
      [%pass wire %agent dock %poke cage]
    ::
    ++  join-pinned
      ^-  (list card)
      %+  turn  ~(tap by channels.group)
      |=  [ch=flag:g =channel:g]
      ^-  card
      =/  =dock  [our.bowl %chat] :: TODO: generally remove chat hard-coding j
      =/  =cage  channel-join+!>(ch)
      =/  =wire  (snoc go-area %join-pinned)
      [%pass wire %agent dock %poke cage]
    --
  ::
  ++  go-leave
    =.  cor  (emit leave:go-pass)
    =.  cor  (emit remove-self:go-pass)
    =.  cor  (emit %give %fact ~[/groups/ui] group-leave+!>(flag))
    go-core(gone &)
  ::
  ++  go-init  
    |=  =create:g
    =|  our=vessel:fleet:g
    =.  sects.our  (~(put in sects.our) %admin)
    =.  fleet.group  (~(put by fleet.group) our.bowl our)
    =.  bloc.group  (silt %admin ~)
    =.  cabals.group
      %+  ~(put by cabals.group)  %admin
      :_  ~
      ['Admin' 'Admins can add and remove channels and edit metadata' '' '']
    =/  =diff:g  [%create group]
    (go-tell-update now.bowl diff)
  ++  go-start-sub
    ^+  go-core
    =/  base=wire  (snoc go-area %updates)
    =/  =path      (snoc base %init)
    =/  =card
      [%pass base %agent [p.flag dap.bowl] %watch path]
    =.  cor  (emit card)
    go-core
  ::
  ++  go-sub
    |=  init=_|
    ^+  go-core
    =/  =time
      ?.(?=(%sub -.net) *time p.net)
    =/  base=wire  (snoc go-area %updates)
    =/  =path      (snoc base ?:(init %init (scot %da time)))
    =/  =card
      [%pass base %agent [p.flag dap.bowl] %watch path]
    =.  cor  (emit card)
    go-core
  ::
  ++  go-watch
    |=  =(pole knot)
    ^+  go-core
    ?+  pole  !!
      [%updates rest=*]  (go-pub rest.pole)
      [%ui ~]            go-core
      [%preview ~]       go-preview
    ==
  ::
  ++  go-preview
    =/  =preview:g
      =,  group
      [meta cordon now.bowl]
    =.  cor
      (emit %give %fact ~ group-preview+!>(preview))
    =.  cor
      (emit %give %kick ~ ~)
    go-core
  ::
  ++  go-peek
    |=  =(pole knot)
    ^-  (unit (unit cage))
    :-  ~
    ?+    pole  ~
        [%fleet ship=@ %vessel ~]
      =/  src  (slav %p ship.pole)
      `noun+!>((~(got by fleet.group) src))
      ::
        [%channel ship=@ name=@ rest=*]
      =/  fog=flag:g  [(slav %p ship.pole) name.pole]
      =/  =channel:g  (~(got by channels.group) fog)
      ?+    rest.pole  ~
          [%can-read src=@ ~]
        =/  src  (slav %p src.rest.pole)
        ?~  ves=(~(get by fleet.group) src)  `loob+!>(|)
        ?:  =(~ readers.channel)  `loob+!>(&)
        `loob+!>(!=(~ (~(int in readers.channel) sects.u.ves)))
      ==
    ==
  ::
  ++  go-agent
    |=  [=wire =sign:agent:gall]
    ^+  go-core
    ?+  wire  !!
        [%updates ~]  (go-take-update sign)
    ::
        [%join-pinned ~]
      ?>  ?=(%poke-ack -.sign)
      ?~  p.sign
        go-core
      %-  (slog leaf/"Failed to autojoin channel" u.p.sign)
      go-core
    ::
        [%proxy ~]
      ?>  ?=(%poke-ack -.sign)
      ?~  p.sign  go-core
      %-  (slog leaf/"Error forwarding poke" u.p.sign)
      go-core
    ==
  ::
  ++  go-take-update
    |=  =sign:agent:gall
    ^+  go-core
    ?+    -.sign  (go-sub |)
      %kick  (go-sub |)
    ::
        %watch-ack
      =?  cor  (~(has by xeno) flag)
        ga-abet:(ga-watched:(ga-abed:gang-core flag) p.sign)
      %.  go-core
      ?~  p.sign  same
      (slog leaf/"Failed subscription" u.p.sign)
    ::
        %fact
      =*  cage  cage.sign 
      ?+  p.cage  go-core
        %group-log     (go-apply-log !<(log:g q.cage))
        %group-update  (go-update !<(update:g q.cage))
        %group-init    (go-fact-init !<(init:g q.cage))
      ==
    ==
  ::
  ++  go-pub
    |=  =path
    ^+  go-core
    ?>  ?=(%pub -.net)
    =;  =cage
      =.  cor  (give %fact ~ cage)
      go-core
    ?:  ?=([%init ~] path)  
      =/  [=time *]  (need (ram:log-on:g p.net))
      group-init+!>([time group])
    ?>  ?=([@ ~] path)
    =/  =time  (slav %da i.path)
    =/  =log:g
      (lot:log-on:g p.net `time ~)
    group-log+!>(log)
  ::
  ++  go-apply-log
    |=  =log:g
    =/  updates=(list update:g)
      (tap:log-on:g log)
    %+  roll  updates
    |=  [=update:g go=_go-core]
    (go-update:go update)
  ::
  ++  go-fact-init
    |=  [=time gr=group:g]
    =.  group  gr
    =.  net  [%sub time] 
    =/  create=diff:g  [%create group]
    =.  cor  
      (give %fact ~[/groups/ui] group-action+!>(`action:g`[flag now.bowl create]))
    =.  cor
      (give %fact ~[/groups/ui] gang-gone+!>(flag))
    =.  cor
      (emil join-pinned:go-pass)
    go-core
  ::
  ++  go-give-update
    |=  [=time =diff:g]
    ^+  go-core
    =/  paths=(set path)
      %+  roll  ~(val by sup.bowl)
      |=  [[=ship =path] out=(set path)]
      ?.  =((scag 4 path) (snoc go-area %updates))
        out
      (~(put in out) path)
    =.  paths  (~(put in paths) (snoc go-area %ui))
    =.  cor
      (give %fact ~(tap in paths) group-update+!>(`update:g`[time diff]))
    =.  cor
      (give %fact ~[/groups/ui] group-action+!>(`action:g`[flag time diff]))
    go-core
  ::
  ++  go-tell-update
    |=  [=time =diff:g]
    ^+  go-core
    =.  go-core  (go-give-update time diff)
    ?.  ?=(%pub -.net)
      go-core
    =.  p.net
      (put:log-on:g p.net time diff)
    go-core
  ::
  ++  go-update
    |=  [=time =diff:g]
    ^+  go-core
    =.  go-core
      (go-tell-update time diff)
    =?  net  ?=(?(%sub %load) -.net)  [%sub time]
    ?-  -.diff
      %channel  (go-channel-update [p q]:diff)
      %fleet    (go-fleet-update [p q]:diff)
      %cabal    (go-cabal-update [p q]:diff)
      %bloc     (go-bloc-update p.diff)
      %cordon   (go-cordon-update p.diff)
      %create   go-core(group p.diff)
      %zone     (go-zone-update +.diff)
      %meta     (go-meta-update p.diff)
      %del      go-core(gone &)
    ==
  ::
  ++  go-meta-update
    |=  meta=data:meta
    =.  meta.group  meta
    go-core
  ++  go-zone-update
    |=  [=zone:g =delta:zone:g]
    ^+  go-core
    ?-    -.delta
        %add
      =.  zones.group  
        (~(put by zones.group) zone meta.delta)
      go-core
    ::
        %del
      =.  zones.group  
        (~(del by zones.group) zone)
      go-core
    ==
  ++  go-bloc-update
    |=  =diff:bloc:g
    ?>  go-is-bloc
    ^+  go-core
    =.  bloc.group
      ?-  -.diff
        %add  (~(uni in bloc.group) p.diff)
        %del  (~(dif in bloc.group) p.diff)
      ==
    go-core
  ++  go-cordon-update
    |=  =diff:cordon:g
    |^  ^+  go-core
    ?>  go-is-bloc
    ?-  -.diff 
      %open     (open p.diff)
      %shut     (shut p.diff)
      %swap     =.(cordon.group p.diff go-core)
    ==
    ::
    ++  open
      |=  =diff:open:cordon:g
      ^+  go-core
      =*  cordon  cordon.group
      ?>  ?=(%open -.cordon) 
      ?-  -.diff
      ::
          %add-ships
        ?<  &((~(has in p.diff) our.bowl) =(p.flag our.bowl))
        =.  fleet.group
        %-  malt
          %+  skip 
            ~(tap by fleet.group)
          |=  [=ship =vessel:fleet:g]
          (~(has in p.diff) ship)          
        =.  ships.ban.cordon  (~(uni in ships.ban.cordon) p.diff)
        %+  go-give-update
          now.bowl
        [%fleet p.diff [%del ~]]
      ::
          %del-ships 
        =.  ships.ban.cordon  (~(dif in ships.ban.cordon) p.diff)
        go-core
      ::
          %add-ranks
        =/  foes
          %-  malt
          %+  skim 
            ~(tap by fleet.group)
          |=  [=ship =vessel:fleet:g]
          (~(has in p.diff) (clan:title ship))
        =.  fleet.group  (~(dif by fleet.group) foes)
        =.  ranks.ban.cordon  (~(uni in ranks.ban.cordon) p.diff)
        %+  go-give-update
          now.bowl
        [%fleet ~(key by foes) [%del ~]]
      ::
          %del-ranks
        =.  ranks.ban.cordon  (~(dif in ranks.ban.cordon) p.diff)
        go-core
      ==
    ::
    ++  shut
      |=  =diff:shut:cordon:g
      ^+  go-core
      =*  cordon  cordon.group
      ?>  ?=(%shut -.cordon)
      =.  cordon.group
        ?-  -.diff
          %add-ships  cordon(pending (~(uni in pending.cordon) p.diff))
          %del-ships  cordon(pending (~(dif in pending.cordon) p.diff))
        ==
      go-core
    --
  ::
  ++  go-cabal-update
    |=  [=sect:g =diff:cabal:g]
    ?>  go-is-bloc
    ^+  go-core
    ?-    -.diff
        %add
      =/  =cabal:g
        [meta.diff ~]
      =.  cabals.group  (~(put by cabals.group) sect cabal)
      go-core
    ::
        %del
      =.  cabals.group  (~(del by cabals.group) sect)
      go-core
    ==
  ::
  ++  go-fleet-update
    |=  [ships=(set ship) =diff:fleet:g]
    ^+  go-core
    ?-    -.diff
        %add
      ?>  ?|  =(p.flag our.bowl) :: self
              =(p.flag src.bowl) :: subscription
              &((~(has in ships) src.bowl) =(1 ~(wyt in ships)))  :: user join
          ==
      =.  cor  (give-invites flag ships)
      =.  fleet.group
        %-  ~(uni by fleet.group)
          %-  malt
          ^-  (list [ship vessel:fleet:g])
          %+  turn
            ~(tap in ships)
          |=  =ship
          ::  only give time when joining
          =/  joined  ?:((~(has in ships) src.bowl) now.bowl *time)
          ::  if ship previously added, retain sects
          =/  vessel  (~(gut by fleet.group) ship *vessel:fleet:g)
          [ship [sects=sects.vessel joined=joined]]
      go-core
    ::
        %del
      ?<  &((~(has in ships) our.bowl) =(p.flag our.bowl))
      ?>  ?|(=(p.flag src.bowl) (~(has in ships) src.bowl))
      =.  fleet.group
      %-  malt
        %+  skip 
          ~(tap by fleet.group)
        |=  [=ship =vessel:fleet:g]
        (~(has in ships) ship)
      ~&  ships
      ?:  (~(has in ships) our.bowl)
        go-core(gone &)
      go-core
    ::
        %add-sects
      ~|  strange-sect/sect
      ?>  go-is-bloc
      ?>  =(~ (~(dif in sects.diff) ~(key by cabals.group)))
      =.  fleet.group  
        %-  ~(rut by fleet.group)
        |=  [=ship =vessel:fleet:g]
        ?.  (~(has in ships) ship)  vessel
        vessel(sects (~(uni in sects.vessel) sects.diff))
      go-core
    ::
        %del-sects
      ?>  go-is-bloc
      =.  fleet.group
        %-  ~(rut by fleet.group)
        |=  [=ship =vessel:fleet:g]
        ?.  (~(has in ships) ship)  vessel
        vessel(sects (~(dif in sects.vessel) sects.diff))
      go-core
    ==
  ++  go-channel-update
    |=  [ch=flag:g =diff:channel:g]
    ^+  go-core
    ?>  go-is-bloc
    =*  by-ch  ~(. by channels.group)
    ?-    -.diff
        %add
      =.  channels.group  (put:by-ch ch channel.diff)
      go-core
    ::
        %del
      =.  channels.group  (del:by-ch ch)
      go-core
    ::
        %add-sects
      =/  =channel:g  (got:by-ch ch)
      =.  readers.channel  (~(uni in readers.channel) sects.diff)
      =.  channels.group  (put:by-ch ch channel)
      go-core
    ::
        %del-sects
      =/  =channel:g  (got:by-ch ch)
      =.  readers.channel  (~(dif in readers.channel) sects.diff)
      =.  channels.group  (put:by-ch ch channel)
      ::  TODO: revoke?
      go-core
    ::
        %add-zone
      =/  =channel:g  (got:by-ch ch)
      =.  zone.channel   `zone.diff
      =.  channels.group  (put:by-ch ch channel)
      go-core
    ::
        %del-zone
      =/  =channel:g  (got:by-ch ch)
      =.  zone.channel   ~
      =.  channels.group  (put:by-ch ch channel)
      go-core
    ::
        %join
      =/  =channel:g  (got:by-ch ch)
      =.  join.channel  join.diff
      =.  channels.group  (put:by-ch ch channel)
      go-core
    ::
    ==
  --
::
++  res-gang-index
  ^+  cor
  =;  =cage
    =.  cor  (emit %give %fact ~ cage)
    (emit %give %kick ~ ~)
  :-  %group-previews
  !>  ^-  previews:g
  %-  ~(gas by *previews:g)
  %+  murn  ~(tap by groups)
  |=  [=flag:g =net:g =group:g]
  ^-  (unit [flag:g preview:g])
  ?.  =(our.bowl p.flag)
    ~
  `[flag =,(group [meta cordon now.bowl])]
::
++  req-gang-index
  |=  =ship
  ^+  cor
  =/  =wire  /gangs/index/(scot %p ship)
  =/  =dock  [ship dap.bowl]
  (emit %pass wire %agent dock %watch `path`wire)
::
++  take-gang-index
  |=  [=ship =sign:agent:gall]
  ^+  cor
  =/  =path  /gangs/index/(scot %p ship)
  ?+  -.sign  !!
      %kick  (emit %give %kick ~[path] ~)
  ::
      %watch-ack
    ?~  p.sign  cor
    %-  (slog leaf/"failed to watch gang index" u.p.sign)
    (emit %give %kick ~[path] ~)
  ::
      %fact
    ?.  =(%group-previews p.cage.sign)  cor
    =+  !<(=previews:g q.cage.sign)
    =.  cor  (emit %give %fact ~[path] cage.sign)
    (emit %give %kick ~[path] ~)
  ==
::
++  gang-core
  |_  [=flag:g =gang:g]
  ++  ga-core  .
  ++  ga-abet  
    =.  xeno  (~(put by xeno) flag gang)
    ?.  (~(has by groups) flag)  cor
    =/  [=net:g =group:g]  (~(got by groups) flag)
    ?.  ?=(%load -.net)  cor
    =.  xeno  (~(del by xeno) flag)
    ga-give-update
  ::
  ++  ga-abed
    |=  f=flag:g
    =/  ga=gang:g  (~(gut by xeno) f [~ ~ ~])
    ga-core(flag f, gang ga)
  ::
  ++  ga-area  `wire`/gangs/(scot %p p.flag)/[q.flag]
  ++  ga-pass
    |%
    ++  poke-host  |=([=wire =cage] (pass-host wire %poke cage))
    ++  pass-host
      |=  [=wire =task:agent:gall]
      ^-  card
      [%pass (welp ga-area wire) %agent [p.flag dap.bowl] task]
    ++  add-self
      =/  =vessel:fleet:g  [~ now.bowl]
      =/  =action:g  [flag now.bowl %fleet (silt ~[our.bowl]) %add ~]
      (poke-host /join/add group-action+!>(action))
    ::
    ++  get-preview
      =/  =task:agent:gall  [%watch /groups/(scot %p p.flag)/[q.flag]/preview]
      (pass-host /preview task)
    --
  ++  ga-start-join
    ^+  ga-core
    =.  cor  (emit add-self:ga-pass)
    ga-core
  ::
  ++  ga-watch
    |=  =(pole knot)
    ^+  ga-core
    =.  cor  (emit get-preview:ga-pass)
    ga-core
  ::
  ++  ga-give-update
    (give %fact ~[/gangs/updates] gangs+!>((~(put by xeno) flag gang)))
  ++  ga-agent
    |=  [=wire =sign:agent:gall]
    ^+  ga-core
    ?+    wire  ~|(bad-agent-take/wire !!)
          [%invite ~]
        ?>  ?=(%poke-ack -.sign)
        :: ?~  p.sign  ga-core
        :: %-  (slog leaf/"Failed to invite {<ship>}" u.p.sign)
        ga-core
      ::
          [%preview ~]
        ?+  -.sign  ~|(weird-take/[wire -.sign] !!)
          %watch-ack
          ?~  p.sign  ga-core :: TODO: report retreival failure
          %-  (slog u.p.sign)
          ga-core
          ::
            %fact
          ?.  =(%group-preview p.cage.sign)  ga-core
          =+  !<(=preview:g q.cage.sign)
          =.  pev.gang  `preview
          =.  cor  ga-give-update
          =/  =path  (snoc ga-area %preview)
          =.  cor
            (emit %give %fact ~[path] cage.sign)
          =.  cor
            (emit %give %kick ~[path] ~)
          ga-core
          ::
            %kick
          ?^  pev.gang  ga-core
          ga-core(cor (emit get-preview:ga-pass))
        ==
      ::
          [%join %add ~]
        ?>  ?=(%poke-ack -.sign)
        ?>  ?=(^ cam.gang)
        ?^  p.sign
          =.  progress.u.cam.gang  %error
          %-  (slog leaf/"Joining failed" u.p.sign)
          ga-core
        =.  progress.u.cam.gang  %watching
        =/  =net:g  [%load ~]
        =|  =group:g
        =.  groups  (~(put by groups) flag net group)
        ::
        =.  cor
          go-abet:(go-sub:(go-abed:group-core flag) &)
        ga-core
    ==
  ::
  ++  ga-watched
    |=  p=(unit tang)
    ?>  ?=(^ cam.gang)
    ?^  p
      %-  (slog leaf/"Failed to join" u.p)
      =.  progress.u.cam.gang  %error
      ga-core
    ga-core
  ::
  ++  ga-invite
    |=  =invite:g
    =.  vit.gang  `invite
    =.  cor  (emit get-preview:ga-pass)
    =.  cor  ga-give-update
    ga-core
  ::
  --
--
