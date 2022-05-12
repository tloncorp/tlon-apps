/-  c=chat
|_  pac=pact:c
++  get
  |=  =id:c
  ^-  (unit [time writ:c])
  ?~  tim=(~(get by dex.pac) id)
    ~
  ?~  wit=(get:on:writs:c wit.pac u.tim)
    ~
  `[u.tim u.wit]
::
++  jab
  |=  [=id:c fun=$-(writ:c writ:c)]
  ^+  pac
  =/  [=time =writ:c]  (got id)
  =.  wit.pac  (put:on:writs:c wit.pac time (fun writ))
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
    =.  wit.pac
      (put:on:writs:c wit.pac now seal p.del)
    =.  dex.pac  (~(put by dex.pac) id now)
    ?~  replying.p.del  pac
    =*  replying  u.replying.p.del
    (jab replying |=(writ:c +<(replied (~(put in replied) id))))
  ::
      %del
    =/  =time     (~(got by dex.pac) id)
    =^  wit=(unit writ:c)  wit.pac
      (del:on:writs:c wit.pac time)
    =.  dex.pac  (~(del by dex.pac) id)
    ?~  wit  !!
    ?~  replying.u.wit  pac
    (jab u.replying.u.wit |=(writ:c +<(replied (~(del in replied) id))))
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
--
