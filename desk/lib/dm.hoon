/-  c=chat, d=channel
/+  mp=mop-extensions
|_  pac=pact:c
++  mope  ((mp time writ:c) lte)
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
  |=  [=id:c fun=$-(writ:c [pact:c writ:c])]
  ^+  pac
  ?~  v=(get id)  pac
  =/  [=pact:c =writ:c]  (fun writ.u.v)
  =.  wit.pact  (put:on:writs:c wit.pact time.u.v writ)
  pact
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
    =/  =seal:c  [id now ~ ~ [0 ~ ~]]
    ?:  (~(has by dex.pac) id)
      pac
    |-
    ?:  (has:on:writs:c wit.pac now)
      $(now `@da`(add now ^~((div ~s1 (bex 16)))))
    =.  wit.pac
      (put:on:writs:c wit.pac now seal [memo.del %chat kind.del])
    pac(dex (~(put by dex.pac) id now))
  ::
      %del
    =/  tim=(unit time)  (~(get by dex.pac) id)
    ?~  tim  pac
    =/  =time  (need tim)
    =^  wit=(unit writ:c)  wit.pac
      (del:on:writs:c wit.pac time)
    pac(dex (~(del by dex.pac) id))
  ::
      %quip
    %+  jab  id
    |=  =writ:c
    =/  [=pact:c =quips:c]  (reduce-quip quips.writ now id [id delta]:del)
    :-  pact
    %=  writ
      quips       quips
      quip-count.meta  (wyt:on:quips:c quips)
      last-quip.meta   (biff (ram:on:quips:c quips) |=([=time *] `time))
    ::
        last-quippers.meta
      ^-  (set ship)
      =|  quippers=(set ship)
      =/  entries=(list [time quip:c])  (bap:on:quips:c quips)
      |-
      ?:  |(=(~ entries) =(3 ~(wyt in quippers)))
        quippers
      =/  [* =quip:c]  -.entries
      ?:  (~(has in quippers) author.quip)
        $(entries +.entries)
      (~(put in quippers) author.quip)
    ==
  ::
      %add-feel
    %+  jab  id
    |=  =writ:c
    :-  pac
    writ(feels (~(put by feels.writ) [ship feel]:del))
  ::
      %del-feel
    %+  jab  id
    |=  =writ:c
    :-  pac
    writ(feels (~(del by feels.writ) ship.del))
  ==
::
++  reduce-quip
  |=  [=quips:c now=time parent-id=id:c =id:c delta=delta:quips:c]
  ^-  [pact:c quips:c]
  |^
  ?-  -.delta
      %add
    |-
    ?:  (has:on:quips:c quips now)
      $(now `@da`(add now ^~((div ~s1 (bex 16)))))
    =/  cork  [id parent-id now ~]
    ?:  (~(has by dex.pac) id)  [pac quips]
    =.  dex.pac  (~(put by dex.pac) id now)
    [pac (put:on:quips:c quips now cork memo.delta)]
  ::
      %del
    =/  tim=(unit time)  (~(get by dex.pac) id)
    ?~  tim  [pac quips]
    =/  =time  (need tim)
    =^  quip=(unit quip:c)  quips
      (del:on:quips:c quips time)
    =.  dex.pac  (~(del by dex.pac) id)
    [pac quips]
  ::
      %add-feel
    :-  pac
    %+  jab-quip  id
    |=  =quip:c
    quip(feels (~(put by feels.quip) [ship feel]:delta))
  ::
      %del-feel
    :-  pac
    %+  jab-quip  id
    |=  =quip:c
    quip(feels (~(del by feels.quip) ship.delta))
  ==
  ++  get-quip
    |=  =id:c
    ^-  (unit [=time =quip:c])
    ?~  tim=(~(get by dex.pac) id)        ~
    ?~  qup=(get:on:quips:c quips u.tim)  ~
    `[u.tim u.qup]
  ++  jab-quip
    |=  [=id:c fun=$-(quip:c quip:c)]
    ^+  quips
    ?~  v=(get-quip id)  quips
    (put:on:quips:c quips time.u.v (fun quip.u.v))
  --
::
++  give-writs
  |=  [mode=?(%light %heavy) writs=(list [time writ:c])]
  ^-  writs:c
  %+  gas:on:writs:c  *writs:c
  ?:  =(%heavy mode)  writs
  %+  turn  writs
  |=  [=time =writ:c]
  [time writ(quips *quips:c)]
++  peek
  |=  [care=@tas =(pole knot)]
  ^-  (unit (unit cage))
  =*  on   on:writs:c
  ?+    pole  [~ ~]
  ::
      [%newest count=@ mode=?(%light %heavy) ~]
    =/  count  (slav %ud count.pole)
    =/  writs  (top:mope wit.pac count)
    ``chat-writs+!>((give-writs mode.pole writs))
  ::
      [%older start=@ count=@ mode=?(%light %heavy) ~]
    =/  count  (slav %ud count.pole)
    =/  start  (slav %ud start.pole)
    =/  writs  (bat:mope wit.pac `start count)
    ``chat-writs+!>((give-writs mode.pole writs))
  ::
      [%newer start=@ count=@ mode=?(%light %heavy) ~]
    =/  count  (slav %ud count.pole)
    =/  start  (slav %ud start.pole)
    =/  writs  (tab:on wit.pac `start count)
    ``chat-writs+!>((give-writs mode.pole writs))
  ::
      [%around time=@ count=@ mode=?(%light %heavy) ~]
    =/  count  (slav %ud count.pole)
    =/  time   (slav %ud time.pole)
    =/  older  (bat:mope wit.pac `time count)
    =/  newer  (tab:on:writs:c wit.pac `time count)
    =/  writ   (get:on:writs:c wit.pac time)
    =/  writs
        ?~  writ  (welp older newer)
        (welp (snoc older [time u.writ]) newer)
    ``chat-writs+!>((give-writs mode.pole writs))
  ::
      [%writ %id ship=@ time=@ ~]
    =/  ship  (slav %p ship.pole)
    =/  time  (slav %ud time.pole)
    ?.  ?=(%u care)
      ``writ+!>(writ:(got ship `@da`time))
    ``loob+!>(?~((get ship `@da`time) | &))
  ==
::
++  search
  |^  |%
      ++  mention
        |=  [sip=@ud len=@ud nedl=^ship]
        ^-  scan:c
        (scour sip len %mention nedl)
      ::
      ++  text
        |=  [sip=@ud len=@ud nedl=@t]
        ^-  scan:c
        (scour sip len %text nedl)
      --
  ::
  +$  match-type
    $%  [%mention nedl=ship]
        [%text nedl=@t]
    ==
  ::
  ++  scour
    |=  [sip=@ud len=@ud =match-type]
    ?>  (gth len 0)
    ^-  scan:c
    =+  s=[sip=sip len=len *=scan:c]
    =-  (flop scan)
    |-  ^+  s
    ?~  wit.pac  s
    ?:  =(0 len.s)  s
    =.  s  $(wit.pac r.wit.pac)
    ?:  =(0 len.s)  s
    ::
    =.  s
      ?.  (match val.n.wit.pac match-type)  s
      ?:  (gth sip.s 0)
        s(sip (dec sip.s))
      s(len (dec len.s), scan [[%writ val.n.wit.pac] scan.s])
    ::
    =.  s  (scour-quips s id.val.n.wit.pac quips.val.n.wit.pac match-type)
    ::
    $(wit.pac l.wit.pac)
  ::
  ++  scour-quips
    |=  [s=[skip=@ud len=@ud =scan:c] =id:c =quips:c =match-type]
    |-  ^+  s
    ?~  quips  s
    ?:  =(0 len.s)  s
    =.  s  $(quips r.quips)
    ?:  =(0 len.s)  s
    ::
    =.  s
      ?.  (match-quip val.n.quips match-type)  s
      ?:  (gth skip.s 0)
        s(skip (dec skip.s))
      s(len (dec len.s), scan [[%quip id val.n.quips] scan.s])
    ::
    $(quips l.quips)
  ::
  ++  match
    |=  [=writ:c =match-type]
    ^-  ?
    ?-  -.match-type
      %mention  (match-writ-mention nedl.match-type writ)
      %text     (match-writ-text nedl.match-type writ)
    ==
  ::
  ++  match-quip
    |=  [=quip:c =match-type]
    ?-  -.match-type
      %mention  (match-story-mention nedl.match-type content.quip)
      %text     (match-story-text nedl.match-type content.quip)
    ==
  ::
  ++  match-writ-mention
    |=  [nedl=ship =writ:c]
    ^-  ?
    ?:  ?=([%notice ~] kind.writ)  |
    (match-story-mention nedl content.writ)
  ::
  ++  match-story-mention
    |=  [nedl=ship =story:d]
    %+  lien  story
    |=  =verse:d
    ?.  ?=(%inline -.verse)  |
    %+  lien  p.verse
    |=  =inline:d
    ?+  -.inline  |
      %ship                                  =(nedl p.inline)
      ?(%bold %italics %strike %blockquote)  ^$(p.verse p.inline)
    ==
  ::
  ++  match-writ-text
    |=  [nedl=@t =writ:c]
    ?:  ?=([%notice ~] kind.writ)  |
    (match-story-text nedl content.writ)
  ::
  ++  match-story-text
    |=  [nedl=@t =story:d]
    %+  lien  story
    |=  =verse:d
    ?.  ?=(%inline -.verse)  |
    %+  lien  p.verse
    |=  =inline:d
    ?@  inline
      (find nedl inline |)
    ?.  ?=(?(%bold %italics %strike %blockquote) -.inline)  |
    ^$(p.verse p.inline)
  ::
  ++  find
    |=  [nedl=@t hay=@t case=?]
    ^-  ?
    =/  nlen  (met 3 nedl)
    =/  hlen  (met 3 hay)
    ?:  (lth hlen nlen)
      |
    =?  nedl  !case
      (cass nedl)
    =/  pos  0
    =/  lim  (sub hlen nlen)
    |-
    ?:  (gth pos lim)
      |
    ?:  .=  nedl
        ?:  case
          (cut 3 [pos nlen] hay)
        (cass (cut 3 [pos nlen] hay))
      &
    $(pos +(pos))
  ::
  ++  cass
    |=  text=@t
    ^-  @t
    %^    run
        3
      text
    |=  dat=@
    ^-  @
    ?.  &((gth dat 64) (lth dat 91))
      dat
    (add dat 32)
  --
--
