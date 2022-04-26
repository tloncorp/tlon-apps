/-  g=groups
/+  default-agent, verb, dbug
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  +$  state-0
    $:  %0
        groups=(map flag:g [net:g group:g])
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
      %flag
    =+  !<(=flag:g vase)
    ?<  =(our.bowl p.flag)
    =/  =net:g  [%sub *time]
    =|  =group:g
    =.  groups  (~(put by groups) flag net group)
    go-abet:go-sub:(go-abed:group-core flag)
  ::
      %group-action  
    =+  !<(=action:g vase)
    =.  p.q.action  now.bowl
    =/  group-core  (go-abed:group-core p.action)
    go-abet:(go-update:group-core q.action)
  ==
++  watch
  |=  =(pole knot)
  ^+  cor
  ?+  pole  ~|(bad-watch/path !!)
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
    ?>  ?=(%sub -.net)
    =/  base=wire  (snoc go-area %updates)
    =/  =path      (snoc base (scot %da p.net))
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
    =?  net  ?=(%sub -.net)  [%sub time]
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
        +<(sects (~(int in sects) sects.diff))
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
--
