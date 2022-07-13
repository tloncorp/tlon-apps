/-  c=chat
/+  default-agent, verb, dbug
|%
+$  card  card:agent:gall
::
+$  rope
  $:  gop=(unit flag)                 :: originating group
      can=(unit flag)                 :: originating channel
      des=desk                        :: originating desk
  ==
::
+$  cable  ?(%group %all)                       :: index 
+$  weave
  $:  sen=?                           :: seen?
      cab=(set cable)                 :: relevant indices
  ==
::
+$  thread
  [yarns=(set id) sen=?]
::
+$  yarn  note
::
+$  id   @uwH
::
+$  note
  $:  =id
      rop=rope
      ted=path                        :: threading identifier
      tim=time
      con=(list content)             :: content of notification
      rig=origin                     :: originating path (should be list?)
      but=(unit button)              :: action, if any
  ==
::
+$  button
  $:  title=cord
      handler=path
  ==
::  $origin: originating path
+$  origin  path 
+$  flag  (pair ship term)
::
+$  content
  $%  [%ship p=ship]
      [%text p=cord]
      [%emph p=cord]
  ==
::
+$  action
  $%  ::
      [%add-note inbox=? =note]
      [%saw-note =id]
      ::
      [%saw-rope =rope]
  ==
::
++  quilt
  =<  quilt
  |%
  +$  thread
    [yarns=(set id) sen=?]
  +$  quilt  ((mop time thread) lte)
  ++  on  ((^on time thread) lte)
  --
::
+$  state-0
  $:  %0
      yarns=(map id yarn)
      groups=(map flag quilt)
      desks=(map desk quilt)
  ==
::
+$  bin  path
+$  lid  path
--
=|  state-0
=*  state  -
%-  agent:dbug
%+  verb  &
=<
  |_  =bowl:gall
  +*  this  .
      cor    ~(. +> [bowl ~])
      def   ~(. (default-agent this %|) bowl)
  ++  on-init  `this
  ++  on-save  !>(state)
  ++  on-load
    |=  =vase
    =+  !<(old=state-0 vase)
    `this(state old)
  ++  on-poke
    |=  [=mark =vase]
    =^  cards  state
      abet:(poke:cor mark vase)
    [cards this]
  ++  on-watch
    |=  =path
    =^  cards  state
      abet:(watch:cor path)
    [cards this]
  ++  on-peek
    |=  =path
    ^-  (unit (unit cage))
    [~ ~]
  ++  on-arvo
    |=  [=wire sign=sign-arvo]
    =^  cards  state
      abet:(arvo:cor wire sign)
    [cards this]
  ++  on-agent
    |=  [=wire =sign:agent:gall]
    =^  cards  state
      abet:(agent:cor wire sign)
    [cards this]
  ++  on-leave  on-leave:def
  ++  on-fail   on-fail:def
  --
|_  [=bowl:gall cards=(list card)]
++  abet  [(flop cards) state]
++  cor   .
++  emit  |=(=card cor(cards [card cards]))
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?+    mark  ~|(bad-mark/mark !!)
      %hark-action
    =+  !<(act=action vase)
    ?+    -.act   !!
        %add-note
      =/  yar=yarn  note.act
      =.  yarns     (~(put by yarns) id.yar yar)
      no-abet:(no-init:(no-abed yar) inbox.act)
    ==
  ==
++  watch
  |=  =path
  ^+  cor
  cor
++  arvo
  |=  [=wire sign=sign-arvo]
  ^+  cor
  cor
++  agent
  |=  [=wire =sign:agent:gall]
  ^+  cor
  cor
++  no-abed   no-abed:no-core
++  no-core
  |_  =note
  ++  no-core  .
  ++  no-abed  
    |=  n=^note
    no-core(note n)
  ++  no-abet  cor
  ++  no-thread-groups-quilt
    ?~  gop.rop.note  no-core
    =*  group  u.gop.rop.note
    =/  =thread  [(silt id.note ~) |]
    =/  qul=quilt   (~(gut by groups) group ~)
    =.  qul  (put:on:quilt qul now.bowl thread)
    =.  groups  (~(put by groups) group qul)
    no-core
  ++  no-thread-desk-quilt
    =*  desk  des.rop.note
    =/  =thread  [(silt id.note ~) |]
    =/  qul=quilt   (~(gut by desks) desk ~)
    =.  qul  (put:on:quilt qul now.bowl thread)
    =.  desks  (~(put by desks) desk qul)
    no-core
  ++  no-init
    |=  inbox=?
    =.  no-core  no-thread-groups-quilt
    =?  no-core  inbox  no-thread-desk-quilt
    no-core
  --
--
