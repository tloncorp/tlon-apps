/-  d=diary
|_  not=notes:d
++  brief
  |=  [our=ship last-read=time]
  ^-  brief:briefs:d
  =/  =time
    ?~  tim=(ram:on:notes:d not)  *time
    key.u.tim
  =/  unreads
    (lot:on:notes:d not `last-read ~)
  =/  read-id=(unit ^time)  
    (bind (pry:on:notes:d unreads) |=([key=@da val=note:d] time.val))
  =/  count
    (lent (skim ~(tap by unreads) |=([tim=^time =note:d] !=(author.note our))))
  [time count read-id]
::
++  get
  |=  =time
  ^-  (unit [=^time =note:d])
  ?~  not=(get:on:notes:d not time)
    ~
  `[time u.not]
::
++  jab
  |=  [=time fun=$-(note:d note:d)]
  ^+  not
  ?~  v=(get time)  not
  =.  not  (put:on:notes:d not time.u.v (fun note.u.v))
  not
::
++  got
  |=  =time
  ^-  [=^time =note:d]
  (need (get time))
::
++  reduce
  |=  [now=time =time del=delta:notes:d]
  ^+  not
  ?-  -.del
      %add
    =/  =seal:d  [time ~]
    ?:  (~(has by not) time)
      not
    (put:on:notes:d not now [seal p.del])
  ::
      %del
    ?.  (has:on:notes:d time)  not
    (del:on:notes:d not time)
  ::
      %add-feel
    %+  jab  time
    |=  =note:d
    note(feels (~(put by feels.note) [p q]:del))
  ::
      %del-feel
    %+  jab  time
    |=  =note:d
    note(feels (~(del by feels.note) p.del))
  ==
::
++  peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  =*  on   on:notes:d
  ?+    pole  [~ ~]
  ::
  ::  TODO: less iterations?
      [%newest count=@ ~]
    =/  count  (slav %ud count.pole)
    =/  ls    (scag count (tap:on not))
    ``diary-notes+!>((gas:on *notes:d ls))
  ::
      [%older start=@ count=@ ~]
    =/  count  (slav %ud count.pole)
    =/  start  (slav %ud start.pole)
    ``diary-notes+!>((tab:on not `start count))
  ::
      [%newer start=@ count=@ ~]
    =/  count  (slav %ud count.pole)
    =/  start  (slav %ud start.pole)
    =-  ``diary-notes+!>(-)
    %+  gas:on  *notes:d
    (scag count (tap:on (lot:on not `start ~)))

  ::
      [%note %id time=@ ~]
    =/  time  (slav %ud time.pole)
    ``note+!>((got `@da`time))
  ==
--
