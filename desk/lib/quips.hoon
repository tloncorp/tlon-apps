/-  d=diary
/+  mp=mop-extensions
|_  qup=quips:d
++  mope  ((mp time quip:d) lte)
++  brief  !!
:: TODO: confirm with design about whether or qup unreads get tracked on comments
::
++  get
  |=  =time
  ^-  (unit [=^time =quip:d])
  ?~  qup=(get:on:quips:d qup time)
    ~
  `[time u.qup]
::
++  jab
  |=  [=time fun=$-(quip:d quip:d)]
  ^+  qup
  ?~  v=(get time)  qup
  =.  qup  (put:on:quips:d qup time.u.v (fun quip.u.v))
  qup
::
++  got
  |=  =time
  ^-  [=^time =quip:d]
  (need (get time))
::
++  reduce
  |=  [=time del=delta:quips:d]
  ^+  qup
  ?-  -.del
      %add
    =/  =cork:d  [time ~]
    |-
    =/  quip  (get time)
    ?~  quip  (put:on:quips:d qup time [cork p.del])
    ?:  =(+.+.u.quip p.del)  qup
    $(time `@da`(add time ^~((div ~s1 (bex 16)))))
  ::
      %del
    =^  no=(unit quip:d)  qup
      (del:on:quips:d qup time)
    qup
  ::
      %add-feel
    %+  jab  time
    |=  =quip:d
    quip(feels (~(put by feels.quip) [p q]:del))
  ::
      %del-feel
    %+  jab  time
    |=  =quip:d
    quip(feels (~(del by feels.quip) p.del))
  ==
::
++  peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  =*  on   on:quips:d
  ?+    pole  [~ ~]
      [%all ~]
    ``diary-quips+!>(qup)
  ::
      [%newest count=@ ~]
    =/  count  (slav %ud count.pole)
    ``diary-quips+!>((gas:on *quips:d (top:mope qup count)))
  ::
      [%older start=@ count=@ ~]
    =/  count  (slav %ud count.pole)
    =/  start  (slav %ud start.pole)
    ``diary-quips+!>((gas:on *quips:d (bat:mope qup `start count)))
  ::
      [%newer start=@ count=@ ~]
    =/  count  (slav %ud count.pole)
    =/  start  (slav %ud start.pole)
    ``diary-quips+!>((gas:on *quips:d (tab:on qup `start count)))
  ::
      [%quip %id time=@ ~]
    =/  time  (slav %ud time.pole)
    ``quip+!>((got `@da`time))
  ==
--
