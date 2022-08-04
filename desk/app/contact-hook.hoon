/-  c=contact-store
/-  g=groups
/+  dbug
/+  default-agent
|%
+$  card  card:agent:gall
+$  state-0
  [%0 ships=(set ship) groups=(set flag:g)]
--
=|  state-0
=*  state  -
=<
  ^-  agent:gall
  %-  agent:dbug
  |_  =bowl:gall
  +*  this  .
      def   ~(. (default-agent this %|) bowl)
      core  ~(. +> [bowl ~])
  ++  on-init  
    =^  cards  state
      abet:init:core
    [cards this]
  ::
  ++  on-save  !>(state)
  ++  on-load
    |=  =vase
    =+  !<(old=state-0 vase)
    `this(state old)
  ++  on-poke
    |=  =cage
    ^-  (quip card _this)
    =^  cards  state
      abet:(poke:core cage)
    [cards this]
  ::
  ++  on-watch
    |=  =path
    ^-  (quip card _this)
    =^  cards  state
      abet:(watch:core path)
    [cards this]
  ++  on-peek  peek:core
  ++  on-agent  
    |=  [=wire =sign:agent:gall]
    ^-  (quip card _this)
    =^  cards  state
      abet:(agent:core wire sign)
    [cards this]
  ++  on-arvo   on-arvo:def
  ++  on-leave  on-leave:def
  ++  on-fail   on-fail:def
  --
|_  [=bowl:gall cards=(list card)]
++  core  .
++  abet  [cards state]
++  emit  |=(=card core(cards [card cards]))
++  give  |=(=gift:agent:gall (emit %give gift))
++  con   
  |%
  ++  scry
    |=  [=dude:gall =path]
    ^+  path
    :*  %gx
        (scot %p our.bowl)
        dude
        (scot %da now.bowl)
        (snoc path %noun)
    ==
  ++  contact
    |=  =ship
    .^(update:c (scry %contact-store /contact/(scot %p ship)))
  ::
  ++  members
    |=  =flag:g
    .^  ships=(set ship) 
        (scry %groups /groups/(scot %p p.flag)/[q.flag]/fleet/ships)
    ==
  ::
  ++  is-member
    |=  [=flag:g =ship]
    =/  ships=(set ^ship)  (members flag)
    (~(has in ships) ship)
  ::
  ++  group
    |=  =flag:g
    ^-  update:c
    =+  .^(=rolodex:c (scry %contact-store /all))
    =/  ships=(set ship)  (members flag)
    =-  [%initial - %.n]
    %-  ~(gas by *rolodex:c)
    %+  murn  ~(tap in ships)
    |=  =ship
    ^-  (unit [^ship contact:c])
    ?~  co=(~(get by rolodex) ship)
      ~
    ?.  (is-allowed-group ship flag)
      ~
    `[ship u.co]
  ++  watch-store
    (emit %pass /contacts %agent [our.bowl %contact-store] %watch /updates)
  --
++  net
  |%
  ++  pass-ship
    |=  [=ship =task:agent:gall]
    ^+  core
    =/  =wire  /net/ship/(scot %p ship)
    =/  =dock  [ship dap.bowl]
    (emit %pass wire %agent dock task)
  ++  watch-ship  |=(=ship (pass-ship ship %watch /our))
  ++  leave-ship  |=(=ship (pass-ship ship %leave ~))
  ++  pass-group
    |=  [=flag:g =task:agent:gall]
    =/  =wire  /net/groups/(scot %p p.flag)/[q.flag]
    =/  =dock  [p.flag dap.bowl]
    (emit %pass wire %agent dock task)
  ++  watch-group  |=(=flag:g (pass-group flag %watch /groups/(scot %p p.flag)/[q.flag]))
  ++  leave-group  |=(=flag:g (pass-group flag %leave ~))
  --
++  init
  watch-store:con
++  poke
  |=  [=mark =vase]
  ^+  core
  ?+    mark  ~|(evil-mark/mark !!)
      %contact-share  core
    ::
      %contact-ship-add 
    =+  !<(=ship vase)
    ?<  (~(has in ships) ship)
    =.  ships  (~(put in ships) ship)
    (watch-ship:net ship)
  ::
      %contact-ship-del 
    =+  !<(=ship vase)
    ?>  (~(has in ships) ship)
    =.  ships  (~(del in ships) ship)
    (leave-ship:net ship)
  ::
      %contact-groups-add 
    =+  !<(=flag:g vase)
    ?<  (~(has in groups) flag)
    =.  groups  (~(put in groups) flag)
    (watch-group:net flag)
  ::
      %contact-ship-del 
    =+  !<(=flag:g vase)
    ?>  (~(has in groups) flag)
    =.  groups  (~(del in groups) flag)
    (leave-group:net flag)
  ==
::
++  peek
  |=  =path
  ^-  (unit (unit cage))
  [~ ~]
::
++  watch
  |=  =(pole knot)
  ^+  core
  ?+    pole  ~|(evil-path-watch/pole !!)
      [%our ~]
    =/  =update:c  (contact:con our.bowl)
    =/  =cage      contact-update-0+!>(update)
    (give %fact ~ cage)
  ::
      [%contact ship=@ rest=*]
    =/  =ship      (slav %p ship.pole)
    =/  =update:c  (contact:con ship)
    =/  =cage      contact-update-0+!>(update)
    (give %fact ~ cage)
  ::
       [%group ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    ?>  =(our.bowl ship)
    =/  =flag:g    [ship name.pole]
    =/  =update:c  (group:con flag)
    =/  =cage      contact-update-0+!>(update)
    (give %fact ~ cage)
  ::
  ==
::
++  agent
  |=  [=wire =sign:agent:gall]
  ^+  core
  ?+  wire  ~|(evil-agent/wire !!)
    [%contacts ~]  (take-store sign)
    [%net *]       (take-net t.wire sign)
  ==
::
++  take-net
  |=  [=(pole knot) =sign:agent:gall]
  ^+  core
  ?+    pole  ~|(evil-net/pole !!)
      [%ship ship=@ ~]
    =/  =ship  (slav %p ship.pole)
    ?+    -.sign  core
        %watch-ack
      ?~  p.sign  core
      %-  (slog leaf/"Failed to watch {<ship>}" u.p.sign)
      =.  ships  (~(del in ships) ship)
      core
    ::
        %fact
      ?.  =(%contact-update-0 p.cage.sign)
        ~&  mom-the-cage-is-being-weird/p.cage.sign
        core
      =+  !<(=update:c q.cage.sign)
      ::  TODO validate confused deputy issue
      (forward-store update)
    ::
        %kick  (watch-ship:net ship)
    ==
  ::
      [%groups ship=@ name=@ ~]
    =/  =ship  (slav %p ship.pole)
    =/  =flag:g  [ship name.pole]
    ?+    -.sign  core
        %watch-ack
      ?~  p.sign  core
      %-  (slog leaf/"Failed to watch {<flag>}" u.p.sign)
      =.  groups  (~(del in groups) flag)
      core
    ::
        %fact
      ?.  =(%contact-update-0 p.cage.sign)
        ~&  mom-the-cage-is-being-weird/p.cage.sign
        core
      =+  !<(=update:c q.cage.sign)
      ::  TODO validate confused deputy issue
      (forward-store update)
    ::
        %kick  (watch-group:net flag)
    ==
  ==
::
++  take-store
  |=  =sign:agent:gall
  |^  ^+  core
  ?-    -.sign
  ::
      ?(%poke-ack %watch-ack)
    %.  core
    ?~  p.sign  same
    =/  =tape  ?:(=(%poke-ack -.sign) "poke" "watch")
    (slog leaf/"Failed to {tape} store!" u.p.sign)
  ::
      %fact
    ?.  =(%contact-update-0 p.cage.sign)
      ~&  'bad contact ver'
      core  :: TODO: properly handle
    =+  !<(=update:c q.cage.sign)
    =;  paths=(list path) 
      ?:  =(~ paths)  core
      (give %fact paths cage.sign)
    ?+  -.update  ~
      ?(%add %edit)  (paths-for-ship ship.update)
      %remove        (paths-for-ship ship.update)
    ==
  ::
      %kick  watch-store:con
  ==
  ++  paths-for-ship
    |=  =ship
    ^-  (list path)
    %+  welp
      ?.  =(our.bowl ship)  *(list path)
      ~[/our]
    %+  murn  ~(tap in groups)
    |=  =flag:g
    ^-  (unit path)
    ?.  (is-member:con flag ship)  ~
    `/groups/(scot %p p.flag)/[q.flag]
  --
::
++  forward-store
  |=  =update:c
  =/  =dock  [our.bowl %contact-store]
  =/  =cage  contact-update-0+!>(update)
  (emit %pass /contacts %agent dock %poke cage)
::
++  is-allowed-group
 |=  [=ship =flag:g]
 ^-  ?
 &
++  is-allowed
  |=  =ship
  ^-  ?
  &  :: TODO: fix
--
