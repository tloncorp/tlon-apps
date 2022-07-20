/-  c=chat, h=hark
/+  default-agent, verb, dbug
|%
+$  card  card:agent:gall
++  yarns-per-update  3
++  rug-trim-size  10  :: number of
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
      all=rug:h
  ==
--
%-  agent:dbug
%+  verb  &
=|  state-0
=*  state  -
=<
  |_  =bowl:gall
  +*  this  .
      cor    ~(. +> [bowl ~])
      def   ~(. (default-agent this %|) bowl)
  ++  on-init  `this
  ++  on-save  !>(state)
  ++  on-load
    |=  =vase
    =/  old=(unit state-0)
      (mole |.(!<(state-0 vase)))  
    ?~  old  `this
    `this(state u.old)
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
      %saw-rope  (saw-rope rope.act)
      %saw-seam  (saw-seam +.act)
      %add-yarn  (add-yarn +.act)
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
  %+  murn  ~(tap in thread)
  |=  =id:h
  ^-  (unit [id:h yarn:h])
  ?~  yar=(~(get by yarns) id)  ~
  `[id u.yar]
::  TODO: namespacing conflicts?
++  saw-thread
  |=  =rope:h
  |=  =rug:h
  ?~  ted=(~(get by new.rug) rope)  rug
  =.  new.rug    (~(del by new.rug) rope)
  =/  start  (quilt-idx qul.rug)
  =.  qul.rug  (put:on:quilt:h qul.rug start u.ted)
  rug
::
++  saw-rope
  |=  =rope:h
  =/  saw  (saw-thread rope)
  =.  all  (saw all)
  =.  desks
    (~(jab by desks) des.rope saw)
  =?  groups  ?=(^ gop.rope)
    (~(jab by groups) u.gop.rope saw)
  cor
::  +stale: garbage collection
::
++  stale
  |^ 
  =/  ids  ~(key by yarns)
  =.  ids  (~(dif in ids) (ids-for-rug all))
  =.  ids  (~(dif in ids) ids-for-groups)
  =.  ids  (~(dif in ids) ids-for-desks)
  =/  ids  ~(tap in ids)
  |-
  ?~  ids  cor
  $(yarns (~(del by yarns) i.ids), ids t.ids)
  ++  trim-rug
    |=  =rug:h
    =*  on  on:quilt:h
    ^+  rug
    ?~  hed=(pry:on qul.rug)
      rug
    ::  TODO: bad asymptotics
    =+  siz=(lent (tap:on qul.rug))
    ?:  (lte siz 50)  
      rug  :: bail if not much there
    =/  dip  (dip:on ,count=@ud)
    =.  qul.rug
      =<  +
      %^  dip  qul.rug  0
      |=  [count=@ud key=@ud =thread:h]
      ^-  [(unit thread:h) stop=? count=@ud]
      =-  [~ - +(count)]
      (gte count rug-trim-size) 
    rug
  ::
  ++  ids-for-rug
    |=  =rug:h
    %-  ~(gas in *(set id:h))
    ^-  (list id:h)
    %+  welp
      ^-  (list id:h)
      %-  zing
      %+  turn  ~(val by new.rug)
      |=  =thread:h
      ~(tap in thread)
    ^-  (list id:h)
    %-  zing
    %+  turn  (tap:on:quilt:h qul.rug)
    |=  [idx=@ud =thread:h]
    ~(tap in thread)
  ::
  ++  ids-for-desks
    =/  des   ~(tap in ~(key by desks))
    =|  ids=(set id:h)
    |-  ^+  ids
    ?~  des  ids
    =/  =rug:h  (~(got by desks) i.des)
    $(ids (~(uni in ids) (ids-for-rug rug)), des t.des)
  ::
  ++  ids-for-groups
    =/  gop  ~(tap in ~(key by groups))
    =|  ids=(set id:h)
    |-  ^+  ids
    ?~  gop  ids
    =/  =rug:h  (~(got by groups) i.gop)
    $(ids (~(uni in ids) (ids-for-rug rug)), gop t.gop)
  --
++  saw-seam
  |=  =seam:h
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
      %all     .(all (fun all))
    ==
  cor
::
++  add-yarn
  =|  [add-all=? add-desk=? =yarn:h]
  |%
  ++  $
    =.  cor  weave-all
    =.  cor  weave-group
    weave-desk
  ::
  ++  weave-all
    ?.  add-all  cor
    cor(all (weave-rug all all/~))
  ++  weave-rug
    |=  [=rug:h =seam:h]
    =/  =thread:h   (~(gut by new.rug) rop.yarn ~)
    =.  thread   (~(put in thread) id.yarn)
    =.  new.rug   (~(put by new.rug) rop.yarn thread)
    rug
  ::
  ++  weave-group
    ?~  gop.rop.yarn  cor
    =*  group  u.gop.rop.yarn
    =/  =rug:h  (~(gut by groups) group *rug:h) 
    =.  rug  (weave-rug rug group/group)
    =.  groups  (~(put by groups) group rug)
    cor
  ::
  ++  weave-desk
    ?.  add-desk  cor
    =/  =rug:h  (~(gut by desks) des.rop.yarn *rug:h) 
    =.  rug     (weave-rug rug desk/des.rop.yarn)
    =.  desks   (~(put by desks) des.rop.yarn rug)
    cor
  --
--
