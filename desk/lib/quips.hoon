/-  d=diary
|_  qup=quips:d
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
  |=  [now=time =time del=delta:quips:d]
  ^+  qup
  ?-  -.del
      %add
    =/  =cork:d  [now ~]
    ?:  (~(has by qup) now)
      qup
    (put:on:quips:d qup now [cork p.del])
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
  =*  rev  ((^on time quip:d) gte)
  ?+    pole  [~ ~]
      [%all ~]
    ``diary-quips+!>(qup)
  ::
  ::  TODO: less iterations?
      [%newest count=@ ~]
    =/  count  (slav %ud count.pole)
    =/  ls    (scag count (bap:on qup))
    ``diary-quips+!>((gas:on *quips:d ls))
  ::
      [%older start=@ count=@ ~]
    =/  count  (slav %ud count.pole)
    =/  start  (slav %ud start.pole)
    =/  inverse  (gas:rev *quips:d (tap:on qup))
    =-  ``diary-quips+!>(-)
    %+  gas:on  *quips:d
    (tab:rev inverse `start count)
  ::
      [%newer start=@ count=@ ~]
    =/  count  (slav %ud count.pole)
    =/  start  (slav %ud start.pole)
    =-  ``diary-quips+!>(-)
    %+  gas:on  *quips:d
    (scag count (tap:on (lot:on qup `start ~)))

  ::
      [%quip %id time=@ ~]
    =/  time  (slav %ud time.pole)
    ``quip+!>((got `@da`time))
  ==
--
