/-  g=groups
/+  default-agent, verb, dbug
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
++  give  |=(=gift:agent:gall (emit %give gift))
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?+    mark  ~|(bad-mark/mark !!)
      %group-create
    =+  !<(=create:g vase)
    =/  =flag:g  [our.bowl name.create]
    =/  =group:g
      [~ ~ ~ open/~ title.create description.create ''] 
    =.  groups  (~(put by groups) flag *net:g group)
    go-abet:(go-init:(go-abed:group-core flag) create)
  ::
      %group-action  
    =+  !<(=action:g vase)
    =.  p.q.action  now.bowl
    =/  group-core  (go-abed:group-core p.action)
    go-abet:(go-update:group-core q.action)
  ::
      %group-join
    =+  !<(=join:g vase)
    =/  =gang:g  (~(gut by xeno) flag.join [~ ~])
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
    [%groups %ui ~]  cor
  ::
      [%groups ship=@ name=@ rest=*]
    =/  ship=@p  (slav %p ship.pole)
    go-abet:(go-watch:(go-abed:group-core ship name.pole) rest.pole)
  ==
++  peek
  |=  =path
  ^-  (unit (unit cage))
  ?+    path  [~ ~]
      [%x %groups ~]
    ``groups+!>(`groups:g`(~(run by groups) tail))
  ==
    
++  agent
  |=  [=(pole knot) =sign:agent:gall]
  ^+  cor
  ?+    pole  ~|(bad-agent-take/pole !!)
      [%groups ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    go-abet:(go-agent:(go-abed:group-core ship name.pole) rest.pole sign)
  ::
      [%gang ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    ga-abet:(ga-agent:(ga-abed:gang-core ship name.pole) rest.pole sign)
  ==
::
++  arvo
  |=  [=wire sign=sign-arvo]
  ^+  cor
  !!
++  group-core
  |_  [=flag:g =net:g =group:g]
  ++  go-core  .
  ++  go-abet  cor(groups (~(put by groups) flag net group))
  ++  go-abed
    |=  f=flag:g
    ^+  go-core
    =/  [n=net:g gr=group:g]  (~(got by groups) f)
    go-core(flag f, group gr, net n)
  ::
  ++  go-area  `path`/groups/(scot %p p.flag)/[q.flag]
  ::
  ++  go-init  
    |=  =create:g
    ~&  init/[net group]
    =/  =diff:g  [%create group]
    (go-tell-update now.bowl diff)
  ::
  ++  go-sub
    ^+  go-core
    =/  =time
      ?.(?=(%sub -.net) *time p.net)
    =/  base=wire  (snoc go-area %updates)
    =/  =path      (snoc base (scot %da time))
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
      [%ui ~]       go-core
    ==
  ::
  ++  go-agent
    |=  [=wire =sign:agent:gall]
    ^+  go-core
    ?+  wire  !!
      [%updates ~]  (go-take-update sign)
    ==
  ::
  ++  go-take-update
    |=  =sign:agent:gall
    ^+  go-core
    ?+    -.sign  go-sub
      %kick  go-sub
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
      ==
    ==
  ::
  ++  go-pub
    |=  =path
    ^+  go-core
    ?>  ?=(%pub -.net)
    =/  =log:g
      ?~  path  p.net
      =/  =time  (slav %da i.path)
      (lot:log-on:g p.net `time ~)
    =/  =cage  group-log+!>(log)
    =.  cor  (give %fact ~ cage)
    go-core
  ::
  ++  go-apply-log
    |=  =log:g
    =/  updates=(list update:g)
      (tap:log-on:g log)
    %+  roll  updates
    |=  [=update:g go=_go-core]
    (go-update:go update)
  ::
  ++  go-give-update
    |=  =cage
    ^+  go-core
    =/  paths=(set path)
      %+  roll  ~(val by sup.bowl)
      |=  [[=ship =path] out=(set path)]
      ?.  =((scag 4 path) (snoc go-area %updates))
        out
      (~(put in out) path)
    =.  paths  (~(put in paths) (snoc go-area %ui))
    =.  paths  (~(put in paths) /groups/ui)
    ~&  paths
    =.  cor
      (give %fact ~(tap in paths) cage)
    go-core
  ::
  ++  go-tell-update
    |=  [=time =diff:g]
    ^+  go-core
    =.  go-core  (go-give-update group-update+!>([time diff]))
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
      %cordon   (go-cordon-update p.diff)
      %create   go-core(group p.diff)
    ==
  ++  go-cordon-update
    |=  =diff:cordon:g
    ^+  go-core
    =.  cordon.group  
      ?-  p.diff 
        %open     [%open ~]
        %secret   [%secret ~]
        %private  [%private ~]
      ==
    go-core
  ::
  ++  go-cabal-update
    |=  [=sect:g =diff:cabal:g]
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
    |=  [=ship =diff:fleet:g]
    ^+  go-core
    ?-    -.diff
        %add
      =.  fleet.group  (~(put by fleet.group) ship vessel.diff)
      go-core
    ::
        %del
      =.  fleet.group  (~(del by fleet.group) ship)
      go-core
    ::
        %add-sects
      ~|  strange-sect/sect
      ?>  =(~ (~(dif in sects.diff) ~(key by cabals.group)))
      =.  fleet.group  
        %+  ~(jab by fleet.group)  ship
        |=  vessel:fleet:g
        +<(sects (~(uni in sects) sects.diff))
      go-core
    ::
        %del-sects
      =.  fleet.group
        %+  ~(jab by fleet.group)  ship
        |=  vessel:fleet:g
        +<(sects (~(dif in sects) sects.diff))
      go-core
    ==
  ++  go-channel-update
    |=  [ch=flag:g =diff:channel:g]
    ^+  go-core
    ?-    -.diff
        %add
      =.  channels.group  (~(put by channels.group) ch channel.diff)
      go-core
    ::
        %del
      =.  channels.group  (~(del by channels.group) ch)
      go-core
    ==
  --
++  gang-core
  |_  [=flag:g =gang:g]
  ++  ga-core  .
  ++  ga-abet  
    =.  xeno  (~(put by xeno) flag gang)
    ?.  (~(has by groups) flag)  cor
    =/  [=net:g =group:g]  (~(got by groups) flag)
    ?.  ?=(%load -.net)  cor
    =.  xeno  (~(del by xeno) flag)
    cor
  ++  ga-abed
    |=  f=flag:g
    =/  ga=gang:g  (~(gut by xeno) f [~ ~])
    ga-core(flag f, gang ga)
  ::
  ++  ga-area  /gang/(scot %p p.flag)/[q.flag]
  ++  ga-pass
    |%
    ++  poke-host
      |=  [=wire =cage]
      ^-  card
      [%pass (welp ga-area wire) %agent [p.flag dap.bowl] %poke cage]
    ++  add-self
      =/  =vessel:fleet:g  [~ now.bowl]
      =/  =action:g  [flag now.bowl %fleet our.bowl %add vessel]
      (poke-host /join/add group-action+!>(action))
    --
  ++  ga-start-join
    ^+  ga-core
    =.  cor  (emit add-self:ga-pass)
    ga-core
  ::
  ++  ga-agent
    |=  [=wire =sign:agent:gall]
    ^+  ga-core
    ?+    wire  ~|(bad-agent-take/wire !!)
        [%join %add ~]
      ?>  ?=(%poke-ack -.sign)
      (ga-watch p.sign)
    ==
  ::
  ++  ga-watch
    |=  p=(unit tang)
    ^+  ga-core
    ?>  ?=(^ cam.gang)
    ?^  p
      =.  progress.u.cam.gang  %error
      %-  (slog leaf/"Joining failed" u.p)
      ga-core
    =.  progress.u.cam.gang  %watching
    =/  =net:g  [%load ~]
    =|  =group:g
    =.  groups  (~(put by groups) flag net group)
    =.  cor
      go-abet:go-sub:(go-abed:group-core flag)
    ga-core
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
  --
--
