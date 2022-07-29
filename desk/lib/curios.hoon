/-  h=heap
|_  cur=curios:h
++  brief
  |=  [our=ship last-read=time]
  ^-  brief:briefs:h
  =/  =time
    ?~  tim=(ram:on:curios:h cur)  *time
    key.u.tim
  =/  unreads
    (lot:on:curios:h cur `last-read ~)
  =/  read-id=(unit ^time)  
    (bind (pry:on:curios:h unreads) |=([key=@da val=curio:h] time.val))
  =/  count
    (lent (skim ~(tap by unreads) |=([tim=^time =curio:h] !=(author.curio our))))
  [time count read-id]
::
++  get
  |=  =time
  ^-  (unit [=^time =curio:h])
  ?~  cur=(get:on:curios:h cur time)
    ~
  `[time u.cur]
::
++  jab
  |=  [=time fun=$-(curio:h curio:h)]
  ^+  cur
  ?~  v=(get time)  cur
  =.  cur  (put:on:curios:h cur time.u.v (fun curio.u.v))
  cur
::
++  got
  |=  =time
  ^-  [=^time =curio:h]
  (need (get time))
::
++  reduce
  |=  [now=time =time del=delta:curios:h]
  ^+  cur
  ?-  -.del
      %add
    =/  =seal:h  [time ~ ~]
    ?:  (~(has by cur) time)
      cur
    =.  cur
      (put:on:curios:h cur now p.del)
    ?~  replying.p.del  cur
    =*  replying  u.replying.p.del
    (jab replying |=(curio:h +<(replied (~(put in replied) time))))
  ::
      %del
    =^  cu=(unit curio:h)  cur
      (del:on:curios:h cur time)
    ?~  cu  cur
    ?~  replying.u.cu  cur
    (jab u.replying.u.cu |=(curio:h +<(replied (~(del in replied) time))))
  ::
      %add-feel
    %+  jab  time
    |=  =curio:h
    curio(feels (~(put by feels.curio) [p q]:del))
  ::
      %del-feel
    %+  jab  time
    |=  =curio:h
    curio(feels (~(del by feels.curio) p.del))
  ==
::
++  peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  =*  on   on:curios:h
  ?+    pole  [~ ~]
  ::
  ::  TODO: less iterations?
      [%newest count=@ ~]
    =/  count  (slav %ud count.pole)
    =/  ls    (scag count (tap:on cur))
    ``heap-curios+!>((gas:on *curios:h ls))
  ::
      [%older start=@ count=@ ~]
    =/  count  (slav %ud count.pole)
    =/  start  (slav %ud start.pole)
    ``heap-curios+!>((tab:on cur `start count))
  ::
      [%newer start=@ count=@ ~]
    =/  count  (slav %ud count.pole)
    =/  start  (slav %ud start.pole)
    =-  ``heap-curios+!>(-)
    %+  gas:on  *curios:h
    (scag count (tap:on (lot:on cur `start ~)))

  ::
      [%curio %id time=@ ~]
    =/  time  (slav %ud time.pole)
    ``curio+!>((got `@da`time))
  ==
--
