/-  c=chat, h=hark
/+  default-agent, verb, dbug
|%
+$  card  card:agent:gall
++  yarns-per-update  3
::  TODO: move to stdlib
++  zip
  |*  [a=(list) b=(list)]
  ^-  (list _?>(?=(^ a) ?>(?=(^ b) [i.a i.b])))
  ?~  a  ~
  ?~  b  ~
  :-  [i.a i.b] 
  $(a t.a, b t.b)
::
++  quilt-idx
  |=  =quilt:h
  ?~  tal=(ram:on:quilt:h quilt)
    0
  +(key.u.tal)
::
+$  state-0
  $:  %0
      yarns=(map id:h yarn:h)
      groups=(map flag:h rug:h)
      desks=(map desk rug:h)
  ==
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
  ++  on-peek  peek:cor
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
    =+  !<(act=action:h vase)
    ?-    -.act
        %saw-seam  se-abet:se-saw:(se-abed seam.act)
    ::
        %add-note
      =/  yar=yarn:h  note.act
      =.  yarns     (~(put by yarns) id.yar yar)
      no-abet:(no-init:(no-abed yar) inbox.act)
    ==
  ==
++  peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  ?+  pole  [~ ~]
  ::
      [%x %group ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    =/  =flag:h  [ship name.pole]
    =/  =rug:h  (~(got by groups) flag)
    ?+  rest.pole  [~ ~]
    ::
        [%latest ~]
      =-  ``hark-update+!>(-)
      %+  threads-to-update  [%group flag]
      %-  ~(gas by *(map @ud thread:h))
      %+  scag  20
      (bap:on:quilt:h qul.rug)
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
++  threads-to-update
  |=  [=seam:h teds=(map @ thread:h)]
  ^-  update:h
  =-  [- seam teds]
  ^-  (map id:h yarn:h)
  %-  ~(gas by *(map id:h yarn:h))
  %-  zing
  %+  turn  ~(tap by teds)
  |=  [=time =thread:h]
  %+  scag  yarns-per-update
  %+  murn  ~(tap in yarns.thread)
  |=  =id:h
  ^-  (unit [id:h yarn:h])
  ?~  yar=(~(get by yarns) id)  ~
  `[id u.yar]
++  se-abed  se-abed:se-core
++  se-core
  |_  =seam:h
  ++  se-core  .
  ++  se-abet  cor
  ++  se-abed  |=(s=seam:h se-core(seam s))
  ++  se-saw
    =/  fun  
      |=  =rug:h
      =/  start  (quilt-idx qul.rug)
      =/  new  ~(val by new.rug)
      %_  rug
          new  ~
      ::
          qul  
        %+  gas:on:quilt:h  qul.rug
        (zip (gulf start (add start (lent new))) new)
      ==
    =.  .
      ?-  -.seam
        %group  .(groups (~(jab by groups) flag.seam fun))
        %desk    .(desks (~(jab by desks) desk.seam fun))
      ==
    se-core
  --
++  qu-core
  |_  =quilt:h
  ++  qu-core  .
  ++  qu-abed
    |=  q=quilt:h
    qu-core(quilt q)
  ++  qu-abet  cor
  --
++  no-abed   no-abed:no-core
++  no-core
  |_  =note:h
  ++  no-core  .
  ++  no-abed  
    |=  n=note:h
    no-core(note n)
  ++  no-abet  cor
  ++  no-thread-groups-quilt
    ?~  gop.rop.note  no-core
    =*  group  u.gop.rop.note
    =/  =rug:h   (~(gut by groups) group [~ ~])
    =/  =thread:h   (~(gut by new.rug) ted.note [~ |])
    =.  yarns.thread   (~(put in yarns.thread) id.note)
    =.  new.rug  (~(put by new.rug) ted.note thread)
    =.  groups   (~(put by groups) group rug)
    no-core
  ++  no-thread-desk-quilt
    =*  desk  des.rop.note
    =/  =thread:h  [(silt id.note ~) |]
    =/  =rug:h   (~(gut by desks) desk [~ ~])
    =/  =thread:h   (~(gut by new.rug) ted.note [~ |])
    =.  yarns.thread   (~(put in yarns.thread) id.note)
    =.  new.rug  (~(put by new.rug) ted.note thread)
    =.  desks    (~(put by desks) desk rug)
    no-core
  ++  no-init
    |=  inbox=?
    =.  no-core  no-thread-groups-quilt
    =?  no-core  inbox  no-thread-desk-quilt
    no-core
  --
--
