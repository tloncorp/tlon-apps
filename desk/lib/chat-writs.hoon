/-  c=chat
|%
++  reduce
  |=  [=flag:c =writs:c src=ship =time d=diff:writs:c]
  ^+  writs
  ?-    -.d
      %add-feel
    =/  =writ:c  (got:writs-on:c writs p.d)
    ?>  |(=(p.flag src) =(src q.d))
    =.  feels.writ  (~(put by feels.writ) [q r]:d)
    (put:writs-on:c writs p.d writ)
  ::
      %del-feel
    =/  =writ:c  (got:writs-on:c writs p.d)
    ?>  |(=(p.flag src) =(src q.d))
    =.  feels.writ  (~(del by feels.writ) q.d)
    (put:writs-on:c writs p.d writ)
 ::
      %add
    ?>  |(=(src p.flag) =(src author.p.d))
    =.  writs
      (put:writs-on:c writs time [time ~ ~] p.d)
    ?~  replying.p.d  writs
    =*  replying  u.replying.p.d
    =/  reply=writ:c  (got:writs-on:c writs replying)
    =.  replied.reply  (~(put in replied.reply) time)
    (put:writs-on:c writs replying reply)
  ::
      %del
    =/  =writ:c
      (got:writs-on:c writs p.d)
    =?  writs  ?=(^ replying.writ)  
      =*  replying  u.replying.writ
      =/  reply=writ:c  (got:writs-on:c writs replying)
      =.  replied.reply  (~(del in replied.reply) p.d)
      (put:writs-on:c writs replying reply)
    ?>  |(=(src p.flag) =(src author.writ))
    +:(del:writs-on:c writs p.d)
  ==
--

