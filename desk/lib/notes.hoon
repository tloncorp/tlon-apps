/-  d=diary
/-  ha=hark
/+  qip=quips, mp=mop-extensions
|_  not=notes:d
++  mope  ((mp time (unit note:d)) lte)
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
  ^-  (unit [=^time note=(unit note:d)])
  ?~  not=(get:on:notes:d not time)
    ~
  `[time u.not]
::
++  jab
  |=  [=time fun=$-((unit note:d) (unit note:d))]
  ^+  not
  ?~  v=(get time)  not
  =.  not  (put:on:notes:d not time.u.v (fun note.u.v))
  not
::
++  got
  |=  =time
  ^-  [=^time note=(unit note:d)]
  (need (get time))
::
++  reduce
  |=  [new=time existing=time com=command:notes:d]
  ^+  not
  ?-  -.com
      %add
    =/  =seal:d  [new ~ ~]
    |-
    =/  note  (get new)
    ?~  note  (put:on:notes:d not new ~ [seal 0 p.com])
    ?:  =(+.+.u.note p.com)  not
    $(new `@da`(add new ^~((div ~s1 (bex 16)))))
  ::
      %edit
    =/  note  (get existing)
    ?~  note         not
    ?~  note.u.note  not
    =*  noot    u.note.u.note
    (put:on:notes:d not existing ~ [-.noot +(rev.noot) p.com])
  ::
      %del
    (put:on:notes:d not existing ~)
  ::
      %quips
    %+  jab  existing
    |=  note=(unit note:d)
    ?~  note  ~
    `u.note(quips (~(reduce qip quips.u.note) [id command]:com))
  ::
      ?(%add-feel %del-feel)
    %+  jab  existing
    |=  un=(unit note:d)
    ?~  un
      ~
    ::  this is necessary because p.del is at a different
    ::  axis in each case
    =/  =ship   ?:(?=(%add-feel -.com) p.com p.com)
    =/  result  ?:(?=(%add-feel -.com) `q.com ~)
    =/  r
      =/  fel  (~(get by feels.u.un) ship)
      ?~  fel
        0
      +(rev.u.fel)
    `u.un(feels (~(put by feels.u.un) ship r result))
  ::      %add-feel
  ::    %+  jab  existing
  ::    |=  =note:d
  ::    `note(feels (~(put by feels.note) [p q]:com))
  ::  ::
  ::      %del-feel
  ::    %+  jab  existing
  ::    |=  =note:d
  ::    `note(feels (~(put by feels.note) p.com ~))
  ==
++  flatten
  |=  content=(list inline:d)
  ^-  cord
  %-  crip
  %-  zing
  %+  turn
    content
  |=  c=inline:d
  ^-  tape
  ?@  c  (trip c)
  ?-  -.c
      %break  ""
      %tag    (trip p.c)
      %link   (trip q.c)
      %block   (trip q.c)
      ?(%code %inline-code)  ""
      %ship    (scow %p p.c)
      ?(%italics %bold %strike %blockquote)  (trip (flatten p.c))
  ==
::
++  hark
  |=  [our=ship =time =delta:notes:d]
  ^-  (list (list content:ha))
  ?.  ?=(%quips -.delta)
    ~
  =/  [@ =note:d]  (got time)
  ?.  ?=(%add -.command.delta)
    ~
  =/  =memo:d  p.command.delta
  =/  in-replies
    %+  lien  (tap:on:quips:d quips.note)
    |=  [=^time =quip:d]
    =(author.quip our)
  ?:  |(=(author.memo our) &(!in-replies !=(author.note our)))  ~
  =-  ~[-]
  :~  [%ship author.memo]
      ' commented on '
      [%emph title.note]
      ': '
      [%ship author.memo]
      ': '
      (flatten q.content.memo)
  ==
::  +trace: turn note into outline
::
::    XX: should trim actual note contents, probably
::
++  trace
  |=  =note:d
  ^-  outline:d
  =;  quippers=(set ship)
    [~(wyt by quips.note) quippers +.note]
  =-  (~(gas in *(set ship)) (scag 3 ~(tap in -)))
  %-  ~(gas in *(set ship))
  %+  murn  (tap:on:quips:d quips.note)
  |=  [@ quip=(unit quip:d)]
  ?~  quip  ~
  author.u.quip
::
++  peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  =*  on   on:notes:d
  ?+    pole  [~ ~]
  ::
      [%newest count=@ mode=?(%outline %note) ~]
    =/  count  (slav %ud count.pole)
    =/  ls    (top:mope not count)
    ?:  =(mode.pole %note)
      ``diary-notes+!>((gas:on *notes:d ls))
    =-  ``diary-outlines+!>(-)
    %+  gas:on:outlines:d  *outlines:d
    %+  murn  ls
    |=  [=time note=(unit note:d)]
    ?~  note  ~
    (some [time (trace u.note)])
  ::
      [%older start=@ count=@ mode=?(%outline %note) ~]
    =/  count  (slav %ud count.pole)
    =/  start  (slav %ud start.pole)
    =/  ls    (bat:mope not `start count)
    ?:  =(mode.pole %note)
      ``diary-notes+!>((gas:on *notes:d ls))
    =-  ``diary-outlines+!>(-)
    %+  gas:on:outlines:d  *outlines:d
    (turn ls |=([=time =note:d] [time (trace note)]))
  ::
      [%newer start=@ count=@ ~]
    =/  count  (slav %ud count.pole)
    =/  start  (slav %ud start.pole)
    ``diary-notes+!>((gas:on *notes:d (tab:on not `start count)))
  ::
      [%note time=@ ~]
    =/  time  (slav %ud time.pole)
    ``diary-note+!>(+:(got `@da`time))
  ::
      [%note %id time=@ %quips rest=*]
    =/  time  (slav %ud time.pole)
    (~(peek qip quips:note:(got `@da`time)) rest.pole)
  ==
--
