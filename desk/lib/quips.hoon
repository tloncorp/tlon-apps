/-  d=diary
/+  mp=mop-extensions
|_  qup=quips:d
++  mope  ((mp time (unit quip:d)) lte)
++  brief  !!
:: TODO: confirm with design about whether or qup unreads get tracked on comments
::
++  get
  |=  =time
  ^-  (unit [=^time quip=(unit quip:d)])
  ?~  qup=(get:on:quips:d qup time)
    ~
  `[time u.qup]
::
++  jab
  |=  [=time fun=$-((unit quip:d) (unit quip:d))]
  ^+  qup
  ?~  v=(get time)  qup
  =.  qup  (put:on:quips:d qup time.u.v (fun quip.u.v))
  qup
::
++  got
  |=  =time
  ^-  [=^time quip=(unit quip:d)]
  (need (get time))
::
++  reduce
  |=  [=time com=command:quips:d]
  ^+  qup
  ?-  -.com
      %add
    =/  =cork:d  [time ~]
    |-
    =/  quip  (get time)
    ?~  quip  (put:on:quips:d qup time `[cork p.com])
    ?:  =(+.+.u.quip p.com)  qup
    $(time `@da`(add time ^~((div ~s1 (bex 16)))))
  ::
      %del
    (put:on:quips:d qup time ~)
  ::
      ?(%add-feel %del-feel)
    %+  jab  time
    |=  uq=(unit quip:d)
    ?~  uq
      ~
    ::  this is necessary because p.del is at a different
    ::  axis in each case
    =/  =ship   ?:(?=(%add-feel -.com) p.com p.com)
    =/  result  ?:(?=(%add-feel -.com) `q.com ~)
    =/  r
      =/  fel  (~(get by feels.u.uq) ship)
      ?~  fel
        0
      +(rev.u.fel)
    `u.uq(feels (~(put by feels.u.uq) ship r result))
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
