/-  c=chat
|_  pac=pact:c
++  gas
  |=  ls=(list [=time =writ:c])
  ^+  pac
  %_    pac
      wit  (gas:on:writs:c wit.pac ls)
  ::
      dex  
    %-  ~(gas by dex.pac)
    %+  turn  ls
    |=  [=time =writ:c]
    ^-  [id:c _time]
    [id.writ time]
  ==
::
++  brief
  |=  [our=ship last-read=time]
  ^-  brief:briefs:c
  =/  =time
    ?~  tim=(ram:on:writs:c wit.pac)  *time
    key.u.tim
  =/  unreads
    (lot:on:writs:c wit.pac `last-read ~)
  =/  read-id=(unit id:c)  
    (bind (pry:on:writs:c unreads) |=([key=@da val=writ:c] id.val))
  =/  count
    (lent (skim ~(tap by unreads) |=([tim=^time =writ:c] !=(author.writ our))))
  [time count read-id]
::
++  get
  |=  =id:c
  ^-  (unit [=time =writ:c])
  ?~  tim=(~(get by dex.pac) id)
    ~
  ?~  wit=(get:on:writs:c wit.pac u.tim)
    ~
  `[u.tim u.wit]
::
++  jab
  |=  [=id:c fun=$-(writ:c writ:c)]
  ^+  pac
  ?~  v=(get id)  pac
  =.  wit.pac  (put:on:writs:c wit.pac time.u.v (fun writ.u.v))
  pac
::
++  got
  |=  =id:c
  ^-  [=time =writ:c]
  (need (get id))
::
++  reduce
  |=  [now=time =id:c del=delta:writs:c]
  ^+  pac
  ?-  -.del
      %add
    =/  =seal:c  [id ~ ~]
    ?:  (~(has by dex.pac) id)
      pac
    =.  wit.pac
      (put:on:writs:c wit.pac now seal p.del)
    =.  dex.pac  (~(put by dex.pac) id now)
    ?~  replying.p.del  pac
    =*  replying  u.replying.p.del
    (jab replying |=(writ:c +<(replied (~(put in replied) ^id))))
  ::
      %del
    =/  =time     (~(got by dex.pac) id)
    =^  wit=(unit writ:c)  wit.pac
      (del:on:writs:c wit.pac time)
    =.  dex.pac  (~(del by dex.pac) id)
    ?~  wit  pac
    ?~  replying.u.wit  pac
    (jab u.replying.u.wit |=(writ:c +<(replied (~(del in replied) ^id))))
  ::
      %add-feel
    %+  jab  id
    |=  =writ:c
    writ(feels (~(put by feels.writ) [p q]:del))
  ::
      %del-feel
    %+  jab  id
    |=  =writ:c
    writ(feels (~(del by feels.writ) p.del))
  ==
::
++  peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  =*  on   on:writs:c
  =*  rev  ((^on time writ:c) gte)
  ?+    pole  [~ ~]
  ::
  ::  TODO: less iterations?
      [%newest count=@ ~]
    =/  count  (slav %ud count.pole)
    =/  ls    (scag count (bap:on wit.pac))
    ``chat-writs+!>((gas:on *writs:c ls))
  ::
      [%older start=@ count=@ ~]
    =/  count  (slav %ud count.pole)
    =/  start  (slav %ud start.pole)
    =/  inverse  (gas:rev *writs:c (tap:on wit.pac))
    =-  ``chat-writs+!>(-)
    %+  gas:on  *writs:c
    (tab:rev inverse `start count)
  ::
      [%newer start=@ count=@ ~]
    =/  count  (slav %ud count.pole)
    =/  start  (slav %ud start.pole)
    =-  ``chat-writs+!>(-)
    %+  gas:on  *writs:c
    (scag count (tap:on (lot:on wit.pac `start ~)))

  ::
      [%writ %id ship=@ time=@ ~]
    =/  ship  (slav %p ship.pole)
    =/  time  (slav %ud time.pole)
    ``writ+!>((got ship `@da`time))
  ==
--
