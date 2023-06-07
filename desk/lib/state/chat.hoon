/-  c=chat
/+  pac=writs
|_  bowl:gall
+$  versioned  $%(current state-2 state-1 state-0)
+$  current
  $:  %3
      chats=(map flag:c chat:c)
      dms=(map ship dm:c)
      clubs=(map id:club:c club:c)
      drafts=(map whom:c story:c)
      pins=(list whom:c)
      bad=(set ship)
      inv=(set ship)
      voc=(map [flag:c id:c] (unit said:c))
      fish=(map [flag:c @] id:c)
      ::  true represents imported, false pending import
      imp=(map flag:c ?)
  ==
::
+$  state-0
  $:  %0
      chats=(map flag:zero chat:zero)
      dms=(map ship dm:zero)
      clubs=(map id:club:zero club:zero)
      drafts=(map whom:zero story:zero)
      pins=(list whom:zero)
      bad=(set ship)
      inv=(set ship)
      voc=(map [flag:zero id:zero] (unit said:zero))
      fish=(map [flag:zero @] id:zero)
      ::  true represents imported, false pending import
      imp=(map flag:zero ?)
  ==
::
+$  state-1
  $:  %1
      chats=(map flag:one chat:one)
      dms=(map ship dm:one)
      clubs=(map id:club:one club:one)
      drafts=(map whom:one story:one)
      pins=(list whom:one)
      bad=(set ship)
      inv=(set ship)
      voc=(map [flag:one id:one] (unit said:one))
      fish=(map [flag:one @] id:one)
      ::  true represents imported, false pending import
      imp=(map flag:one ?)
  ==
::
+$  state-2
  $:  %2
      chats=(map flag:two chat:two)
      dms=(map ship dm:two)
      clubs=(map id:club:two club:two)
      drafts=(map whom:two story:two)
      pins=(list whom:two)
      bad=(set ship)
      inv=(set ship)
      voc=(map [flag:two id:two] (unit said:two))
      fish=(map [flag:two @] id:two)
      ::  true represents imported, false pending import
      imp=(map flag:two ?)
  ==
::
+$  state-3  current
++  zero     zero:old:c
++  one      one:old:c
++  two      two:old:c
++  three    c
++  state-1-to-2
  |=  s=state-1
  ^-  state-2
  %*  .  *state-2
    dms     dms.s
    clubs   (clubs-1-to-2 clubs.s)
    drafts  drafts.s
    pins    pins.s
    bad     bad.s
    inv     inv.s
    fish    fish.s
    voc     voc.s
    chats   chats.s
  ==
++  state-2-to-3
  |=  s=state-2
  ~&  %migrating-2-3
  ^-  state-3  
  =/  chats  (chats-2-to-3 chats.s)
  %*  .  *state-3
    dms     (dms-2-to-3 dms.s)
    clubs   (clubs-2-to-3 clubs.s)
    drafts  drafts.s
    pins    pins.s
    bad     bad.s
    inv     inv.s
    fish    fish.s
    voc     (voc-2-to-3 voc.s chats)
    chats   chats
  ==
::
++  chats-2-to-3
  |=  chats=(map flag:two chat:two)
  ~&  %migrating-chat
  ^-  (map flag:c chat:c)
  %-  ~(run by chats)
  |=  old-chat=chat:two
  =/  pact  (pact-2-to-3 pact.old-chat)
  ^-  chat:c
  :*  (index-threads pact)
      net.old-chat
      remark.old-chat
      (log-2-to-3 log.old-chat)
      perm.old-chat
      pact
  ==
::
++  clubs-2-to-3
  |=  clubs=(map id:club:two club:two)
  ~&  %migrating-club
  ^-  (map id:club:c club:c)
  %-  ~(run by clubs)
  |=  old-club=club:two
  ^-  club:c
  :*  heard.old-club
      remark.old-club
      (pact-2-to-3 pact.old-club)
      crew.old-club
  ==
::
++  dms-2-to-3
  |=  dms=(map ship dm:two)
  ~&  %migrating-dm
  ^-  (map ship dm:c)
  %-  ~(run by dms)
  |=  old-dm=dm:two
  ^-  dm:c
  :*  (pact-2-to-3 pact.old-dm)
      remark.old-dm
      net.old-dm
      pin.old-dm
  ==
::
++  voc-2-to-3
  |=  [voc=(map [flag:two id:two] (unit said:two)) chats=(map flag:c chat:c)]
  ^-  (map [flag:c id:c] (unit said:c))
  %-  ~(rut by voc)
  |=  [[=flag:two =id:two] old-said=(unit said:two)]
  ~&  [%voc flag id]
  ^-  (unit said:c)
  ?~  old-said  ~
  =/  =chat:c  (~(gut by chats) flag *chat:c) 
  =/  =time  (~(gut by dex.pact.chat) id *time)
  %-  some
  ^-  said:c
  :-  p.u.old-said
  +:(writ-2-to-3 time q.u.old-said)
::
++  log-2-to-3
  |=  old-log=log:two
  ~&  %migrating-log
  ^-  log:c
  %+  run:log-on:log:two  old-log
  |=  old-diff=diff:two
  ^-  diff:c
  ?-  -.old-diff
      %add-sects  old-diff
      %del-sects  old-diff
      %writs
    :*  %writs
        p.p.old-diff
        ?-  -.q.p.old-diff
          %add  [%add (memo-2-to-3 +.q.p.old-diff)]
          %del  q.p.old-diff
          %add-feel  q.p.old-diff
          %del-feel  q.p.old-diff
        ==
    ==
      %create
    :*  %create
        p.old-diff
        (pact-2-to-3 q.old-diff)
    ==
  ==
::
++  pact-2-to-3
  |=  old-pact=pact:two
  ^-  pact:c
  ~&  %migrating-pact
  :_  dex.old-pact
  %+  gas:on:writs:c  *writs:c        
  ^-  (list [time writ:c])
  (turn (tap:on:writs:two wit.old-pact) writ-2-to-3)
::
++  memo-2-to-3
  |=  old-memo=memo:two
  ^-  memo:c
  :*  thread=replying.old-memo
      replying=replying.old-memo
      author=author.old-memo
      sent=sent.old-memo
      content=content.old-memo
  ==
::
++  writ-2-to-3
  |=  [tim=time old-writ=writ:two]
  ^-  [time writ:c]
  :*  tim
      ^-  seal:c
      :*  id.old-writ
          tim
          feels.old-writ
          replied.old-writ
          ::  threaded
          ?^  replying.old-writ  [%strand (need replying.old-writ)]
          ?~  replied.old-writ  [%fray ~]
          [%knot ~]
      ==
      ^-  memo:c
      :*  ::  thread
          ?^  replying.old-writ  replying.old-writ
          ?~  replied.old-writ  `id.old-writ
          ~
          ::
          replying.old-writ
          author.old-writ
          tim
          content.old-writ
      ==
  ==
::
++  index-threads
  |=  =pact:c 
  ^-  threads:c
  =-  -.-
  %^  (dip:on:writs:c threads:c)  wit.pact  *threads:c
  |=  [st=threads:c =time =writ:c]
  :-  ~
  :-  %.n
  ?+  -.threaded.writ  st
      %knot  
    =/  =thread:c  (~(gut by st) id.writ *thread:c)
    (~(put by st) id.writ thread(knot writ, remark [now & ~]))
  ::
      %strand
    =*  id  id.threaded.writ
    =/  =thread:c  (~(gut by st) id *thread:c)
    %+  ~(put by st)  id
    =/  knot  (~(get pac pact) id)
    :*  ?~(knot *writ:c +.u.knot)
        [now & ~]
        :-  (put:on:writs:c wit.pact.thread time writ)
            (~(put by dex.pact.thread) id time)
    ==
  ==
::
++  clubs-1-to-2
  |=  clubs=(map id:club:one club:one)
  ^-  (map id:club:two club:two)
  %-  ~(run by clubs)
  |=  =club:one
  [*heard:club:two club]
::
++  state-0-to-1
  |=  s=state-0
  ^-  state-1
  %*  .  *state-1
    dms     dms.s
    clubs   (clubs-0-to-1 clubs.s)
    drafts  drafts.s
    pins    pins.s
    bad     bad.s
    inv     inv.s
    fish    fish.s
    voc     voc.s
    chats   chats.s
  ==
++  clubs-0-to-1
  |=  clubs=(map id:club:zero club:zero)
  ^-  (map id:club:one club:one)
  %-  ~(run by clubs)
  |=  =club:zero
  [*remark:one club]
--
