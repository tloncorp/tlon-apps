/-  h=heap
/+  mp=mop-extensions
|_  cur=curios:h
++  mope  ((mp time curio:h) lte)
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
  |=  [new=time existing=time del=delta:curios:h]
  ^+  cur
  ?-  -.del
      %add
    =/  =seal:h  [new ~ ~]
    ~|  curio-failed-validation/p.del
    ?>  ?|  ?=(^ replying.p.del)
            ?&  ?=(^ title.p.del)
                |(?=([~ ^] content.p.del) ?=([[* ~] ~] content.p.del))
            ==
        ==
    |-
    =/  curio  (get new)
    ?~  curio
      =.  cur  (put:on:curios:h cur new [seal p.del])
      ?~  replying.p.del  cur
      =*  replying  u.replying.p.del
      (jab replying |=(curio:h +<(replied (~(put in replied) new))))
    ?:  =(+.+.u.curio p.del)  cur
    $(new `@da`(add new ^~((div ~s1 (bex 16)))))
  ::
      %edit
    =/  curio  (get existing)
    ?~  curio  cur
    (put:on:curios:h cur existing [-.+.u.curio p.del])
  ::
      %del
    =^  cu=(unit curio:h)  cur
      (del:on:curios:h cur existing)
    ?~  cu  cur
    ?~  replying.u.cu  cur
    (jab u.replying.u.cu |=(curio:h +<(replied (~(del in replied) existing))))
  ::
      %add-feel
    %+  jab  existing
    |=  =curio:h
    curio(feels (~(put by feels.curio) [p q]:del))
  ::
      %del-feel
    %+  jab  existing
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
      [%newest count=@ ~]
    =/  count  (slav %ud count.pole)
    ``heap-curios+!>((gas:on *curios:h (top:mope cur count)))
  ::
      [%older start=@ count=@ ~]
    =/  count  (slav %ud count.pole)
    =/  start  (slav %ud start.pole)
    ``heap-curios+!>((gas:on *curios:h (bat:mope cur `start count)))
  ::
      [%newer start=@ count=@ ~]
    =/  count  (slav %ud count.pole)
    =/  start  (slav %ud start.pole)
    ``heap-curios+!>((gas:on *curios:h (tab:on cur `start count)))
  ::
      [%curio %id time=@ ~]
    =/  time  (slav %ud time.pole)
    ``curio+!>(+:(got `@da`time))
  ==
--
