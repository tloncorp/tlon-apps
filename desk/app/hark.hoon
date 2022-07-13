/-  c=chat, h=hark
/+  default-agent, verb, dbug
|%
+$  card  card:agent:gall
::
+$  state-0
  $:  %0
      yarns=(map id:h yarn:h)
      groups=(map flag:h quilt:h)
      desks=(map desk quilt:h)
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
++  se-abed  se-abed:se-core
++  se-core
  |_  =seam:h
  ++  se-core  .
  ++  se-abet  cor
  ++  se-abed  |=(s=seam:h se-core(seam s))
  ++  se-saw
    =/  fun  
      |=(=quilt:h (run:on:quilt:h quilt |=(thread:h +<(sen &))))
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
    =/  =thread:h  [(silt id.note ~) |]
    =/  qul=quilt:h   (~(gut by groups) group ~)
    =.  qul  (put:on:quilt:h qul now.bowl thread)
    =.  groups  (~(put by groups) group qul)
    no-core
  ++  no-thread-desk-quilt
    =*  desk  des.rop.note
    =/  =thread:h  [(silt id.note ~) |]
    =/  qul=quilt:h   (~(gut by desks) desk ~)
    =.  qul  (put:on:quilt:h qul now.bowl thread)
    =.  desks  (~(put by desks) desk qul)
    no-core
  ++  no-init
    |=  inbox=?
    =.  no-core  no-thread-groups-quilt
    =?  no-core  inbox  no-thread-desk-quilt
    no-core
  --
--
