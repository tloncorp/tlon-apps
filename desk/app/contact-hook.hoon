/-  c=contact-store
/-  g=groups
/+  dbug
/+  default-agent
|%
+$  card  card:agent:gall
+$  state-0
  [%0 pull=[groups=(set flag:g) ships=(set ship)] push=(set flag:g)]
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
  ++  watch-groups
    (emit %pass /groups %agent [our.bowl %groups] %watch /groups)
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
  =.  core  watch-store:con
  watch-groups:con
++  poke
  |=  [=mark =vase]
  ^+  core
  ?+    mark  ~|(evil-mark/mark !!)
      %contact-share  core
      %contact-ship-add 
    (add-ship !<(=ship vase))
  ::
      %contact-ship-del 
    (del-ship !<(ship vase))
  ==
::
++  add-ships
  |=  ships=(set ship)
  ^+  core
  %+  roll  ~(tap in ships)
  |=  [=ship co=_core]
  ?:  (~(has in ships.pull) ship)
    co
  (add-ship:co ship)
::
++  add-ship
  |=  =ship
  ^+  core
  ?<  (~(has in ships.pull) ship)
  =.  ships.pull  (~(put in ships.pull) ship)
  (watch-ship:net ship)
::
++  del-ship
  |=  =ship
  ^+  core
  ?>  (~(has in ships.pull) ship)
  =.  ships.pull  (~(put in ships.pull) ship)
  (leave-ship:net ship)
::
++  del-ships
  |=  ships=(set ship)
  ^+  core
  %+  roll  ~(tap in ships)
  |=  [=ship co=_core]
  ?.  (~(has in ships.pull) ship)
    co
  (del-ship:co ship)
::
++  add-group
  |=  =flag:g
  ?<  (~(has in groups.pull) flag)
  =.  groups.pull  (~(put in groups.pull) flag)
  (watch-group:net flag)
  ::
++  del-group
  |=  =flag:g
  ?>  (~(has in groups.pull) flag)
  =.  groups.pull  (~(del in groups.pull) flag)
  (leave-group:net flag)
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
    [%groups ~]    (take-groups sign)
  ==
::
++  take-groups
  |=  =sign:agent:gall
  ^+  core
  ?+    -.sign  ~|(bad-groups-take/-.sign !!)
      %watch-ack
    %.  core
    ?~  p.sign  same
    (slog leaf/"Failed to watch groups" u.p.sign)
  ::
      %fact
    ?.  =(%group-action p.cage.sign)
      ~&  'groups ver mismatch'
      core
    =+  !<(=action:g q.cage.sign)
    =*  flag  p.action
    ?.  =(our.bowl p.flag)  core
    ?+    -.q.q.action  core
        %create
      =.  push  (~(put in push) flag)
      (add-ships ~(key by fleet.p.q.q.action))
    ::
        %fleet
      =*  diff  q.q.action
      ?+  -.q.diff  core
        %add  (add-ships p.diff)
        %del  (del-ships p.diff)
      ==
    ==
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
      =.  ships.pull  (~(del in ships.pull) ship)
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
      =.  groups.pull  (~(del in groups.pull) flag)
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
    %+  murn  ~(tap in groups.pull)
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
  & :: we don't support private profiles 
::
++  is-allowed
  |=  =ship
  ^-  ?
  & :: we don't support private profiles 
--
