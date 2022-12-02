/-  d=diary
/-  ha=hark
/+  qip=quips
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
    :: we use now on the add to enforce host ordering
    :: any other actions should use time so that it's
    :: the note that we're looking for.
      %add
    =/  =seal:d  [now ~ ~]
    ?:  (~(has by not) now)
      not
    (put:on:notes:d not now [seal p.del])
  ::
      %edit
    =/  note  (get time)
    ?~  note  not
    (put:on:notes:d not time [-.+.u.note p.del])
  ::
      %del
    =^  no=(unit note:d)  not
      (del:on:notes:d not time)
    not
  ::
      %quips
    %+  jab  time
    |=  =note:d
    note(quips (~(reduce qip quips.note) now p.p.del q.p.del))
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
  ~!  q.p.delta
  ?.  ?=(%add -.q.p.delta)
    ~
  =/  =memo:d  p.q.p.delta
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
  %+  turn  (tap:on:quips:d quips.note)
  |=  [@ =quip:d]
  author.quip
::
++  peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  =*  on   on:notes:d
  =*  rev  ((^on time note:d) gte)
  ?+    pole  [~ ~]
  ::
  ::  TODO: less iterations?
      [%newest count=@ mode=?(%outline %note) ~]
    =/  count  (slav %ud count.pole)
    =/  ls    (scag count (bap:on not))
    ?:  =(mode.pole %note)
      ``diary-notes+!>((gas:on *notes:d ls))
    =-  ``diary-outlines+!>(-)
    %+  gas:on:outlines:d  *outlines:d
    (turn ls |=([=time =note:d] [time (trace note)]))
  ::
      [%older start=@ count=@ ~]
    =/  count  (slav %ud count.pole)
    =/  start  (slav %ud start.pole)
    =/  inverse  (gas:rev *notes:d (tap:on not))
    =-  ``diary-notes+!>(-)
    %+  gas:on  *notes:d
    (tab:rev inverse `start count)
  ::
      [%newer start=@ count=@ ~]
    =/  count  (slav %ud count.pole)
    =/  start  (slav %ud start.pole)
    =-  ``diary-notes+!>(-)
    %+  gas:on  *notes:d
    (scag count (tap:on (lot:on not `start ~)))

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
