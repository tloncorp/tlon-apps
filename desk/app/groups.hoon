/-  g=groups
/+  default-agent, verb, dbug
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  +$  state-0
    $:  %0
        groups=(map flag:g group:g)
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
    =.  groups  (~(put by groups) flag group)
    go-abet:go-init:(go-abed:group-core flag)
  ::
      %group-action  
    =+  !<(=action:g vase)
    =/  group-core  (go-abed:group-core p.action)
    go-abet:(go-update:group-core q.action)
  ==
++  watch
  |=  =path
  ^+  cor
  !!
++  peek
  |=  =path
  ^-  (unit (unit cage))
  ?+    path  [~ ~]
      [%x %groups ~]
    ``groups+!>(groups)
  ==
    
++  agent
  |=  [=wire =sign:agent:gall]
  ^+  cor
  !!
++  arvo
  |=  [=wire sign=sign-arvo]
  ^+  cor
  !!
++  group-core
  |_  [=flag:g =group:g]
  ++  go-core  .
  ++  go-abet  cor(groups (~(put by groups) flag group))
  ++  go-abed
    |=  f=flag:g
    ^+  go-core
    go-core(flag f, group (~(got by groups) f))
  ::
  ++  go-init  go-core
  ++  go-update
    |=  [=time =diff:g]
    ^+  go-core
    ?-  -.diff
      %channel  (go-channel-update [p q]:diff)
      %fleet    (go-fleet-update [p q]:diff)
      %cabal    (go-cabal-update [p q]:diff)
      %cordon   (go-cordon-update p.diff)
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
    ~&  [ch diff]
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
