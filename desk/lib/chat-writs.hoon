/-  c=chat
|%
::  reduce
::|=  [host=ship =writs:c src=ship =time d=diff:writs:c]
::^+  writs
::?-    -.d
::    %add-feel
::  =/  =writ:c  (got:on:writs:c writs p.d)
::  ?>  |(=(host src) =(src q.d))
::  =.  feels.writ  (~(put by feels.writ) [q r]:d)
::  (put:on:writs:c writs p.d writ)
::::
::    %del-feel
::  =/  =writ:c  (got:on:writs:c writs p.d)
::  ?>  |(=(host src) =(src q.d))
::  =.  feels.writ  (~(del by feels.writ) q.d)
::  (put:on:writs:c writs p.d writ)
:::
::    %add
::  ?>  |(=(src host) =(src author.p.d))
::  =.  writs
::    (put:on:writs:c writs time [time ~ ~] p.d)
::  ?~  replying.p.d  writs
::  =*  replying  u.replying.p.d
::  =/  reply=writ:c  (got:on:writs:c writs replying)
::  =.  replied.reply  (~(put in replied.reply) time)
::  (put:on:writs:c writs replying reply)
::::
::    %del
::  =/  =writ:c
::    (got:on:writs:c writs p.d)
::  =?  writs  ?=(^ replying.writ)  
::    =*  replying  u.replying.writ
::    =/  reply=writ:c  (got:on:writs:c writs replying)
::    =.  replied.reply  (~(del in replied.reply) p.d)
::    (put:on:writs:c writs replying reply)
::  ?>  |(=(src host) =(src author.writ))
::  +:(del:on:writs:c writs p.d)
::==
::
::  scry
::|=  [=writs:c =(pole knot)]
::^-  (unit (unit cage))
::?+    pole  [~ ~]
::::
::    [%newest count=@ ~]
::  =/  count  (slav %ud count.pole)
::  ``chat-writs-list+!>((turn (scag count (tap:on:writs:c writs)) tail))
::::
::    [%older start=@ count=@ ~]
::  =/  count  (slav %ud count.pole)
::  =/  start  (slav %da start.pole)
::  ``chat-writs+!>((turn (tab:on:writs:c writs `start count) tail))
::::
::    [%writ writ=@ ~]
::  =/  writ  (slav %da writ.pole)
::  ``writ+!>((got:on:writs:c writs writ))
::==
++  reduce  
  |=  [host=ship =writs:c src=ship =time d=diff:writs:c]
   !!
++  scry 
  |=  [=writs:c =(pole knot)]
  !!
--

