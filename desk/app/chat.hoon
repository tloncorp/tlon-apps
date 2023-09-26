/-  c=chat, d=channel, g=groups
/-  meta
/-  ha=hark
/-  contacts
/+  default-agent, verb-lib=verb, dbug
/+  pac=dm
/+  utils=channel-utils
/+  volume
/+  wood-lib=wood
/+  epos-lib=saga
::  performance, keep warm
/+  chat-json
/*  desk-bill  %bill  /desk/bill
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  ++  wood-state
    ^-  state:wood-lib
    :*  ver=|
        odd=&
        veb=|
    ==
  ++  club-eq  2 :: reverb control: max number of forwards for clubs
  +$  current-state
    $:  %3
        dms=(map ship dm:c)
        clubs=(map id:club:c club:c)
        pins=(list whom:c)
        bad=(set ship)
        inv=(set ship)
        old-chats=(map flag:two:old:c chat:two:old:c)  :: for migration
        old-pins=(list whom:two:old:c)
    ==
  --
=|  current-state
=*  state  -
=<
  %+  verb-lib  |
  %-  agent:dbug
  |_  =bowl:gall
  +*  this  .
      def   ~(. (default-agent this %|) bowl)
      cor   ~(. +> [bowl ~])
  ++  on-init
    ^-  (quip card _this)
    =^  cards  state
      abet:init:cor
    [cards this]
  ::
  ++  on-save  !>([state okay:d])
  ++  on-load
    |=  =vase
    ^-  (quip card _this)
    =^  cards  state
      abet:(load:cor vase)
    [cards this]
  ::
  ++  on-poke
    |=  [=mark =vase]
    ^-  (quip card _this)
    =^  cards  state
      abet:(poke:cor mark vase)
    [cards this]
  ++  on-watch
    |=  =path
    ^-  (quip card _this)
    =^  cards  state
      abet:(watch:cor path)
    [cards this]
  ::
  ++  on-peek   peek:cor
  ::
  ++  on-leave   on-leave:def
  ++  on-fail    on-fail:def
  ::
  ++  on-agent
    |=  [=wire =sign:agent:gall]
    ^-  (quip card _this)
    =^  cards  state
      abet:(agent:cor wire sign)
    [cards this]
  ++  on-arvo
    |=  [=wire sign=sign-arvo]
    ^-  (quip card _this)
    =^  cards  state
      abet:(arvo:cor wire sign)
    [cards this]
  --
|_  [=bowl:gall cards=(list card)]
+*  wood  ~(. wood-lib [bowl wood-state])
    epos  ~(. epos-lib [bowl %chat-update okay:d])
++  abet  [(flop cards) state]
++  cor   .
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))
++  give  |=(=gift:agent:gall (emit %give gift))
++  now-id   `id:c`[our now]:bowl
++  init  cor
::  +load: load next state
++  load
  |=  =vase
  |^  ^+  cor
  =+  !<([old=versioned-state cool=@ud] vase)
  |-
  ?-  -.old
    %0  $(old (state-0-to-1 old))
    %1  $(old (state-1-to-2 old))
    %2  $(old (state-2-to-3 old))
    %3  (emil(state old) (drop load:epos))
  ==
  ::
  +$  versioned-state  $%(current-state state-2 state-1 state-0)
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
  +$  state-3  current-state
  ++  zero     zero:old:c
  ++  one      one:old:c
  ++  two      two:old:c
  ++  three    c
  ++  state-2-to-3
    |=  state-2
    ^-  state-3
    :-  %3
    :+  (dms-2-to-3 dms)
      (clubs-2-to-3 clubs)
    [(pins-2-to-3 pins) bad inv chats pins]
  ::
  ++  pins-2-to-3
    |=  pins=(list whom:two)
    ^-  (list whom:c)
    %+  murn  pins
    |=(w=whom:two ?:(?=(%flag -.w) ~ (some w)))
  ::
  ++  dms-2-to-3
    |=  dms=(map ship dm:two)
    ^-  (map ship dm:c)
    %-  ~(run by dms)
    |=  dm:two
    ^-  dm:c
    [(pact-2-to-3 pact) remark net pin]
  ::
  ++  clubs-2-to-3
    |=  clubs=(map id:club:two club:two)
    ^-  (map id:club:c club:c)
    %-  ~(run by clubs)
    |=  club:two
    [heard remark (pact-2-to-3 pact) crew]
  ::
  ++  pact-2-to-3
    |=  =pact:two
    ^-  pact:c
    :_  dex.pact
    =/  writs  (tap:on:writs:two wit.pact)
    =/  quip-index=(map @da quips:c)
      %+  roll  writs
      |=  [[=time =writ:two] quip-index=(map @da quips:c)]
      ?~  replying.writ  quip-index
      =/  old-quips=quips:c  (~(gut by quip-index) time *quips:c)
      =/  quip-time  (~(get by dex.pact) u.replying.writ)
      ?~  quip-time  quip-index
      %+  ~(put by quip-index)  u.quip-time
      (put:on:quips:c old-quips time (quip-2-to-3 time writ))
    %+  gas:on:writs:c  *writs:c
    %+  murn  writs
    |=  [=time =writ:two]
    ^-  (unit [^time writ:c])
    ?^  replying.writ  ~
    =/  =quips:c  (~(gut by quip-index) time *quips:c)
    (some time (writ-2-to-3 time writ quips))
  ::
  ++  writ-2-to-3
    |=  [=time old=writ:two =quips:c]
    ^-  writ:c
    =;  qm=quip-meta:d
      :-  [id.old time feels.old quips qm]
      (essay-2-to-3 +.old)
    ::
    =/  last-quippers=(set ship)
      =|  quippers=(set ship)
      =/  entries=(list [* quip:c])  (bap:on:quips:c quips)
      |-
      ?:  |(=(~ entries) =(3 ~(wyt in quippers)))
        quippers
      =/  [* =quip:c]  -.entries
      ?:  (~(has in quippers) author.quip)
        $(entries +.entries)
      (~(put in quippers) author.quip)
    :*  (wyt:on:quips:c quips)
        last-quippers
        (biff (ram:on:quips:c quips) |=([=^time *] `time))
    ==
  ::
  ++  quip-2-to-3
    |=  [=time old=writ:two]
    ^-  quip:c
    [[id.old time feels.old] (memo-2-to-3 +.old)]
  ::
  ++  memo-2-to-3
    |=  memo:two
    ^-  memo:d
    [(story-2-to-3 author content) author sent]
  ::
  ++  essay-2-to-3
    |=  memo:two
    ^-  essay:c
    [(memo-2-to-3 +<) %chat ?-(-.content %story ~, %notice [%notice ~])]
  ::
  ++  story-2-to-3
    |=  [=ship old=content:two]
    ^-  story:d
    ?-    -.old
        %notice  ~[%inline pfix.p.old ship+ship sfix.p.old]~
        %story
      %+  welp
        (turn p.p.old (lead %block))
      [%inline q.p.old]~
    ==
  ::
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
::
++  poke
  |=  [=mark =vase]
  |^  ^+  cor
  ?+    mark  ~|(bad-poke/mark !!)
  ::
      %dm-rsvp
    =+  !<(=rsvp:dm:c vase)
    di-abet:(di-rsvp:(di-abed:di-core ship.rsvp) ok.rsvp)
  ::
      %chat-pins
    =+  !<(ps=(list whom:c) vase)
    (pin ps)
  ::
      %chat-remark-action
    =+  !<(act=remark-action:c vase)
    ?-  -.p.act
      %ship  di-abet:(di-remark-diff:(di-abed:di-core p.p.act) q.act)
      %club  cu-abet:(cu-remark-diff:(cu-abed:cu-core p.p.act) q.act)
    ==
  ::
      %dm-action
    =+  !<(=action:dm:c vase)
    ::  don't allow anyone else to proxy through us
    ?.  =(src.bowl our.bowl)
      ~|("%dm-action poke failed: only allowed from self" !!)
    ::  don't proxy to self, creates an infinite loop
    ?:  =(p.action our.bowl)
      ~|("%dm-action poke failed: can't dm self" !!)
    di-abet:(di-proxy:(di-abed-soft:di-core p.action) q.action)
  ::
      %dm-diff
    =+  !<(=diff:dm:c vase)
    di-abet:(di-take-counter:(di-abed-soft:di-core src.bowl) diff)
  ::
      %club-create
    cu-abet:(cu-create:cu-core !<(=create:club:c vase))
  ::
      ?(%club-action %club-action-0)
    =+  !<(=action:club:c vase)
    =/  cu  (cu-abed p.action)
    cu-abet:(cu-diff:cu q.action)
  ::
      %dm-archive  di-abet:di-archive:(di-abed:di-core !<(ship vase))
      %chat-migrate-server  ?>(from-self server:migrate)
      %chat-migrate         ?>(from-self client:migrate)
  ==
  ++  pin
    |=  ps=(list whom:c)
    =.  pins  ps
    cor
  --
++  watch
  |=  =(pole knot)
  ^+  cor
  ?+    pole  ~|(bad-watch-path/path !!)
      [%clubs %ui ~]  ?>(from-self cor)
      [%briefs ~]  ?>(from-self cor)
      [%ui ~]  ?>(from-self cor)
      [%dm %invited ~]  ?>(from-self cor)
  ::
      [%dm ship=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    di-abet:(di-watch:(di-abed:di-core ship) rest.pole)
  ::
      [%club id=@ rest=*]
    =/  =id:club:c  (slav %uv id.pole)
    cu-abet:(cu-watch:(cu-abed id) rest.pole)
  ==
::
++  agent
  |=  [=(pole knot) =sign:agent:gall]
  ^+  cor
  ?+    pole  ~|(bad-agent-wire/pole !!)
      ~  cor
  ::
      [%contacts ship=@ ~]
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign  cor
    %-  (slog leaf/"Failed to heed contact {<ship>}" u.p.sign)
    cor
  ::
      [%dm ship=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    di-abet:(di-agent:(di-abed:di-core ship) rest.pole sign)
  ::
      [%club id=@ rest=*]
    =/  =id:club:c  (slav %uv id.pole)
    cu-abet:(cu-agent:(cu-abed id) rest.pole sign)
  ::
      [%hark ~]
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign  cor
    %-  (slog leaf/"Failed to hark" u.p.sign)
    cor
  ==
++  give-kick
  |=  [pas=(list path) =cage]
  =.  cor  (give %fact pas cage)
  (give %kick ~ ~)
::
++  arvo
  |=  [=wire sign=sign-arvo]
  ^+  cor
  ~&  arvo/wire
  cor
++  peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  [~ ~]
  ::
    [%x %clubs ~]  ``clubs+!>((~(run by clubs) |=(=club:c crew.club)))
  ::
    [%x %pins ~]  ``chat-pins+!>(pins)
  ::
    [%x %briefs ~]  ``chat-briefs+!>(briefs)
  ::
      [%x %init ~]
    =-  ``noun+!>(-)
    :*  (~(run by clubs) |=(=club:c crew.club))
        ~(key by accepted-dms)
        briefs
        ~(key by pending-dms)
        pins
    ==
  ::
      [%x %dm ~]
    ``ships+!>(~(key by accepted-dms))
  ::
      [%x %dm %invited ~]
    ``ships+!>(~(key by pending-dms))
  ::
      [%x %dm %archive ~]
    ``ships+!>(~(key by archived-dms))
  ::
      [%x %dm @ *]
    =/  =ship  (slav %p i.t.t.path)
    (di-peek:(di-abed:di-core ship) %x t.t.t.path)
  ::
      [%x %club @ *]
    (cu-peek:(cu-abed (slav %uv i.t.t.path)) %x t.t.t.path)
  ::
      [%u %dm @ *]
    =/  =ship  (slav %p i.t.t.path)
    =/  has  (~(has by dms) ship)
    ?.  has
      ``loob+!>(|)
    ?~  t.t.t.path  ``loob+!>(has)
    (di-peek:(di-abed:di-core ship) %u t.t.t.path)
  ::
      [%u %club @ *]
    =/  =id:club:c  (slav %uv i.t.t.path)
    =/  has  (~(has by clubs) id)
    ?.  has
      ``loob+!>(|)
    ?~  t.t.t.path  ``loob+!>(has)
    (cu-peek:(cu-abed:cu-core id) %u t.t.t.path)
  ::
  ==
::
++  briefs
  ^-  briefs:c
  %-  ~(gas by *briefs:c)
  %+  welp
    %+  turn  ~(tap in ~(key by clubs))
    |=  =id:club:c
    =/  cu  (cu-abed id)
    [club/id cu-brief:cu]
  %+  murn  ~(tap in ~(key by dms))
  |=  =ship
  =/  di  (di-abed:di-core ship)
  ?:  ?=(?(%invited %archive) net.dm.di)  ~
  ?:  =([~ ~] pact.dm.di)  ~
  `[ship/ship di-brief:di]
++  give-brief
  |=  [=whom:c =brief:briefs:c]
  (give %fact ~[/briefs] chat-brief-update+!>([whom brief]))
::
++  want-hark
  |=  kind=?(%msg %to-us)
  %+  (fit-level:volume [our now]:bowl)  ~
  ?-  kind
    %to-us  %soft
    %msg    %loud
  ==
::
++  pass-hark
  |=  =new-yarn:ha
  ^-  card
  =/  =wire  /hark
  =/  =dock  [our.bowl %hark]
  =/  =cage  hark-action-1+!>([%new-yarn new-yarn])
  [%pass wire %agent dock %poke cage]
::
++  make-notice
    |=  [=ship text=cord]
    ^-  delta:writs:c
    =/  =story:d  ~[[%inline ~[[%ship ship] text]]]
    =/  =memo:d  [story our.bowl now.bowl]
    [%add memo notice/~ `now.bowl]
::
++  check-writ-ownership
  |=  diff=diff:writs:c
  =*  her    p.p.diff
  =*  delta  q.diff
  =*  should  =(her src.bowl)
  ?-  -.delta
      %quip  (check-quip-ownership delta should)
      %add  ?.(should | =(src.bowl author.memo.delta))
      %del  should
      %add-feel  =(src.bowl ship.delta)
      %del-feel  =(src.bowl ship.delta)
  ==
::
++  check-quip-ownership
  |=  [d=delta:writs:c should=?]
  ?>  ?=(%quip -.d)
  =*  delta  delta.d
  ?-  -.delta
      %add  ?.(should | =(src.bowl author.memo.delta))
      %del  should
      %add-feel  =(src.bowl ship.delta)
      %del-feel  =(src.bowl ship.delta)
  ==
::
++  from-self  =(our src):bowl
++  migrate
  |%
  ++  t  two:old:c
  ++  server
    =/  server-shelf=shelf:d
      %+  convert-shelf  &
      %-  ~(gas by *(map flag:t chat:t))
      %+  skim  ~(tap by old-chats)
      |=  [=flag:t =chat:t]
      =(our.bowl p.flag)
    =/  =cage  [%channel-migration !>(server-shelf)]
    (emit %pass /migrate %agent [our.bowl %channels-server] %poke cage)
  ::
  ++  client
    =/  =shelf:d  (convert-shelf | old-chats)
    =/  =cage  [%channel-migration !>(shelf)]
    =.  cor  (emit %pass /migrate %agent [our.bowl %channels] %poke cage)
    =/  =^cage  [%channel-migration-pins !>((convert-pins old-pins))]
    (emit %pass /migrate %agent [our.bowl %channels] %poke cage)
  ::
  ++  convert-pins
    |=  pins=(list whom:t)
    ^-  (list nest:d)
    %+  murn  pins
    |=  =whom:t
    ?.  ?=(%flag -.whom)  ~
    (some %chat p.whom)
  ::
  ++  convert-shelf
    |=  [log=? =_old-chats]
    ^-  shelf:d
    %-  ~(gas by *shelf:d)
    %+  turn  ~(tap by old-chats)
    |=  [=flag:t =chat:t]
    ^-  [nest:d diary:d]
    :-  [%chat flag]
    =/  =notes:d  (convert-notes pact.chat)
    %*    .  *diary:d
        notes   notes
        log     ?.(log ~ (convert-log pact.chat notes perm.chat log.chat))
        perm    [0 perm.chat]
        remark  remark.chat
        net
      ?-  -.net.chat
        %pub  [*ship & chi+~]
        %sub  +.net.chat
      ==
    ==
  ::
  ++  convert-notes
    |=  old=pact:t
    ^-  notes:d
    =/  writs  (tap:on:writs:t wit.old)
    =/  quip-index=(map @da quips:d)
      %+  roll  writs
      |=  [[=time =writ:t] quip-index=(map @da quips:d)]
      ?~  replying.writ  quip-index
      =/  old-quips=quips:d  (~(gut by quip-index) time *quips:d)
      =/  quip-time  (~(get by dex.old) u.replying.writ)
      ?~  quip-time  quip-index
      %+  ~(put by quip-index)  u.quip-time
      (put:on-quips:d old-quips time `(convert-quip time writ))
    %+  gas:on-notes:d  *notes:d
    %+  murn  writs
    |=  [=time =writ:t]
    ^-  (unit [id-note:d (unit note:d)])
    ?^  replying.writ  ~
    =/  =quips:d  (~(gut by quip-index) time *quips:d)
    (some time `(convert-note time writ quips))
  ::
  ++  convert-note
    |=  [id=@da old=writ:t =quips:d]
    ^-  note:d
    [[id quips (convert-feels feels.old)] %0 (convert-essay +.old)]
  ::
  ++  convert-feels
    |=  old=(map ship feel:d)
    ^-  feels:d
    %-  ~(run by old)
    |=  =feel:d
    [%0 `feel]
  ::
  ++  convert-quip
    |=  [id=@da old=writ:t]
    ^-  quip:d
    [[id (convert-feels feels.old)] (convert-memo +.old)]
  ::
  ++  convert-memo
    |=  old=memo:t
    ^-  memo:d
    [(convert-story author.old content.old) author.old sent.old]
  ::
  ++  convert-essay
    |=  old=memo:t
    ^-  essay:d
    [(convert-memo old) %chat ?-(-.content.old %story ~, %notice [%notice ~])]
  ::
  ++  convert-story
    |=  [=ship old=content:t]
    ^-  story:d
    ?-    -.old
        %notice  ~[%inline pfix.p.old ship+ship sfix.p.old]~
        %story
      %+  welp
        (turn p.p.old |=(=block:t [%block block]))
      [%inline q.p.old]~
    ==
  ::
  ++  convert-log
    |=  [[=writs:t =index:t] =notes:d =perm:d =log:t]
    ^-  log:d
    %+  gas:log-on:d  *log:d
    %-  zing
    %+  turn  (tap:log-on:t log)
    |=  [=time =diff:t]
    ^-  (list [id-note:d u-diary:d])
    =;  new=(list u-diary:d)
      ?~  new  ~
      ?~  t.new  [time i.new]~
      =.  time  (sub time ~s1)
      =>  .(new `(list u-diary:d)`new)
      |-
      ?~  new  ~
      [[time i.new] $(time +(time), new t.new)]
    ?-    -.diff
        ?(%add-sects %del-sects)  [%perm 0 perm]~
        %create
      :-  [%create p.diff]
      %+  murn  (tap:on:writs:t wit.q.diff)
      |=  [=^time =writ:t]
      =/  new-note  (get:on-notes:d notes time)
      ?~  new-note  ~
      (some %note time %set u.new-note)
    ::
        %writs
      =*  id  p.p.diff
      =/  old-time  (~(get by index) id)
      ?~  old-time  ~
      =/  old-writ  (get:on:writs:t writs u.old-time)
      ?~  old-writ  [%note u.old-time %set ~]~
      ?~  replying.u.old-writ
        =/  new-note  (get:on-notes:d notes u.old-time)
        ?~  new-note  ~
        :_  ~
        :+  %note  u.old-time
        ?-  -.q.p.diff
          %del                    [%set ~]
          ?(%add %edit)           [%set u.new-note]
          ?(%add-feel %del-feel)  [%feels ?~(u.new-note ~ feels.u.u.new-note)]
       ==
      =/  new-note-id  (~(get by index) u.replying.u.old-writ)
      ?~  new-note-id  ~
      =/  new-note  (get:on-notes:d notes u.new-note-id)
      ?~  new-note  ~
      ?~  u.new-note  ~
      =/  new-quip  (get:on-quips:d quips.u.u.new-note u.old-time)
      ?~  new-quip  ~
      :_  ~
      :+  %note  u.new-note-id
      :+  %quip  u.old-time
      ^-  u-quip:d
      ?-  -.q.p.diff
        %del                    [%set ~]
        ?(%add %edit)           [%set u.new-quip]
        ?(%add-feel %del-feel)  [%feels ?~(u.new-quip ~ feels.u.u.new-quip)]
      ==
    ==
  --
::
++  cu-abed  cu-abed:cu-core
::
++  cu-core
  |_  [=id:club:c =club:c gone=_| counter=@ud]
  +*  cu-pact  ~(. pac pact.club)
  ++  cu-core  .
  ++  cu-abet
    ::  shouldn't need cleaning, but just in case
    =.  cu-core  cu-clean
    =.  clubs
      ?:  gone
        (~(del by clubs) id)
      (~(put by clubs) id club)
    cor
  ++  cu-abed
    |=  i=id:club:c
    ~|  no-club/i
    cu-core(id i, club (~(gut by clubs) i *club:c))
  ++  cu-clean
    =.  hive.crew.club
      %-  ~(rep in hive.crew.club)
      |=  [=ship hive=(set ship)]
      ?:  (~(has in team.crew.club) ship)  hive
      (~(put in hive) ship)
    cu-core
  ++  cu-out  (~(del in cu-circle) our.bowl)
  ++  cu-circle
    (~(uni in team.crew.club) hive.crew.club)
  ::
  ++  cu-area  `wire`/club/(scot %uv id)
  ::
  ++  cu-uid
    =/  uid  `@uv`(shax (jam ['clubs' (add counter eny.bowl)]))
    [uid cu-core(counter +(counter))]
  ::
  ++  cu-spin
    |=  [rest=path con=(list content:ha) but=(unit button:ha)]
    ^-  new-yarn:ha
    ::  hard coded desk because these shouldn't appear in groups
    =/  rope  [~ ~ %talk /club/(scot %uv id)]
    =/  link  (welp /dm/(scot %uv id) rest)
    [& & rope con link but]
  ::
  ++  cu-pass
    |%
    ++  act
      |=  [=ship =diff:club:c]
      ^-  card
      =/  =wire  (snoc cu-area %gossip)
      =/  =dock  [ship dap.bowl]
      =/  =cage  club-action+!>(`action:club:c`[id diff])
      [%pass wire %agent dock %poke cage]
    ::
    ++  gossip
      |=  =diff:club:c
      ^-  (list card)
      %+  turn  ~(tap in cu-out)
      |=  =ship
      (act ship diff)
    --
  ::
  ++  cu-init
    |=  [=net:club:c =create:club:c]
    =/  clab=club:c
      [*heard:club:c *remark:c *pact:c (silt our.bowl ~) hive.create *data:meta net |]
    cu-core(id id.create, club clab)
  ::
  ++  cu-brief  (brief:cu-pact our.bowl last-read.remark.club)
  ::
  ++  cu-create
    |=  =create:club:c
    =.  cu-core  (cu-init %done create)
    =.  cu-core  (cu-diff 0v0 [%init team hive met]:crew.club)
    =.  cor  (give-brief club/id cu-brief)
    =/  =delta:writs:c
      %+  make-notice  our.bowl
      %+  rap  3
      :~  ' started a group chat with '
          (scot %ud ~(wyt in hive.create))
          ' other members'
      ==
    =.  cu-core
      (cu-diff 0v0 [%writ now-id delta])
    cu-core
  ::
  ::  NB: need to be careful not to forward automatically generated
  ::  messages like this, each node should generate its own notice
  ::  messages, and never forward. XX: defend against?
  ++  cu-post-notice
    |=  [=ship text=cord]
    =/  =id:c             [ship now.bowl]
    =/  =delta:writs:c    (make-notice ship text)
    =/  w-d=diff:writs:c  [id delta]
    =.  pact.club  (reduce:cu-pact now.bowl w-d)
    (cu-give-writs-diff w-d)
  ::
  ++  cu-give-action
    |=  =action:club:c
    =/  =cage  club-action+!>(action)
    =.  cor
      (emit %give %fact ~[/clubs/ui] cage)
    cu-core
  ::
  ++  cu-give-writs-diff
    |=  =diff:writs:c
    =.  cor
      =/  =cage  writ-diff+!>(diff)
      (emit %give %fact ~[(welp cu-area /ui/writs)] cage)
    cu-core
  ::
  ++  cu-diff
    |=  [=uid:club:c =delta:club:c]
    ::  generate a uid if we're hearing from a pre-upgrade ship or if we're sending
    =^  uid  cu-core
      ?:  |(from-self (lte uid club-eq))  cu-uid
      [uid cu-core]
    =/  diff  [uid delta]
    ?:  (~(has in heard.club) uid)  cu-core
    =.  heard.club  (~(put in heard.club) uid)
    =.  cor  (emil (gossip:cu-pass diff))
    =?  cu-core  !?=(%writ -.delta)  (cu-give-action [id diff])
    ?-    -.delta
    ::
        %meta
      =.  met.crew.club  meta.delta
      cu-core
    ::
        %init
      ::  ignore if already initialized
      ?:  ?|  !=(~ hive.crew.club)
              !=(~ team.crew.club)
              !=(*data:meta met.crew.club)
          ==
        cu-core
      =:  hive.crew.club  hive.delta
          team.crew.club  team.delta
          met.crew.club   met.delta
      ==
      cu-core
    ::
        %writ
      =.  pact.club  (reduce:cu-pact now.bowl diff.delta)
      ?-  -.q.diff.delta
          ?(%del %add-feel %del-feel)  (cu-give-writs-diff diff.delta)
          %add
        =.  time.q.diff.delta  (~(get by dex.pact.club) p.diff.delta)
        =*  memo  memo.q.diff.delta
        =?  remark.club  =(author.memo our.bowl)
          remark.club(last-read `@da`(add now.bowl (div ~s1 100)))
        =.  cor  (give-brief club/id cu-brief)
        ?:  =(our.bowl author.memo)  (cu-give-writs-diff diff.delta)
        ?^  kind.q.diff.delta  (cu-give-writs-diff diff.delta)
        =/  new-yarn
          %^  cu-spin
            ~
            :~  [%ship author.memo]
                ': '
                (flatten:utils content.memo)
            ==
          ~
        =?  cor  (want-hark %to-us)
          (emit (pass-hark new-yarn))
        (cu-give-writs-diff diff.delta)
      ::
          %quip
        =*  quip-id  id.q.diff.delta
        =*  delt  delta.q.diff.delta
        =/  entry=(unit [=time =writ:c])  (get:cu-pact p.diff.delta)
        =?  meta.q.diff.delta  !=(~ entry)  `meta.writ:(need entry)
        ?-  -.delt
            ?(%del %add-feel %del-feel)  (cu-give-writs-diff diff.delta)
            %add
          =*  memo  memo.delt
          =?  remark.club  =(author.memo our.bowl)
            remark.club(last-read `@da`(add now.bowl (div ~s1 100)))
          =.  cor  (give-brief club/id cu-brief)
          ?:  =(our.bowl author.memo)  (cu-give-writs-diff diff.delta)
          ?~  entry  (cu-give-writs-diff diff.delta)
          =*  op  writ.u.entry
          =/  new-yarn
            %^  cu-spin
              /(rsh 4 (scot %ui time.u.entry))
              :~  [%ship author.memo]  ' replied to '
                  [%emph (flatten:utils content.op)]  ': '
                  [%ship author.memo]  ': '
                  (flatten:utils content.memo)
              ==
            ~
          =?  cor  (want-hark %to-us)
            (emit (pass-hark new-yarn))
          (cu-give-writs-diff diff.delta)
        ==
      ==
    ::
        %team
      =*  ship  ship.delta
      =/  loyal  (~(has in team.crew.club) ship)
      ?:  &(!ok.delta loyal)
        ?.  =(our src):bowl
          cu-core
        cu-core(gone &)
      ?:  &(ok.delta loyal)  cu-core
      ?.  (~(has in hive.crew.club) ship)
        cu-core
      =.  hive.crew.club  (~(del in hive.crew.club) ship)
      ?.  ok.delta
        (cu-post-notice ship ' declined the invite')
      =.  cor  (give-brief club/id cu-brief)
      =.  team.crew.club  (~(put in team.crew.club) ship)
      =?  last-read.remark.club  =(ship our.bowl)  now.bowl
      (cu-post-notice ship ' joined the chat')
    ::
        %hive
      ?:  add.delta
        ?:  ?|  (~(has in hive.crew.club) for.delta)
                (~(has in team.crew.club) for.delta)
            ==
          cu-core
        =.  hive.crew.club   (~(put in hive.crew.club) for.delta)
        =^  new-uid  cu-core
          cu-uid
        =.  cor  (emit (act:cu-pass for.delta new-uid %init [team hive met]:crew.club))
        (cu-post-notice for.delta ' was invited to the chat')
      ?.  (~(has in hive.crew.club) for.delta)
        cu-core
      =.  hive.crew.club  (~(del in hive.crew.club) for.delta)
      (cu-post-notice for.delta ' was uninvited from the chat')
    ==
  ::
  ++  cu-remark-diff
    |=  diff=remark-diff:c
    ^+  cu-core
    =.  remark.club
      ?-  -.diff
        %watch    remark.club(watching &)
        %unwatch  remark.club(watching |)
        %read-at  !! ::  cu-core(last-read.remark.chat p.diff)
      ::
          %read
        =/  =time
          (fall (bind (ram:on:writs:c wit.pact.club) head) now.bowl)
        remark.club(last-read `@da`(add time (div ~s1 100)))  ::  greater than last
      ==
    =.  cor
      (give-brief club/id cu-brief)
    cu-core
  ::
  ++  cu-peek
    |=  [care=@tas =(pole knot)]
    ^-  (unit (unit cage))
    ?+  pole  [~ ~]
      [%writs rest=*]  (peek:cu-pact care rest.pole)
      [%crew ~]   ``club-crew+!>(crew.club)
    ::
        [%search %text skip=@ count=@ nedl=@ ~]
      %-  some
      %-  some
      :-  %chat-scan
      !>
      %^    text:search:cu-pact
          (slav %ud skip.pole)
        (slav %ud count.pole)
      nedl.pole
    ::
        [%search %mention skip=@ count=@ nedl=@ ~]
      %-  some
      %-  some
      :-  %chat-scan
      !>
      %^    mention:search:cu-pact
          (slav %ud skip.pole)
        (slav %ud count.pole)
      (slav %p nedl.pole)
    ==
  ::
  ++  cu-watch
    |=  =path
    ^+  cu-core
    ?>  =(src our):bowl
    ?+  path  !!
      [%ui ~]  cu-core
      [%ui %writs ~]  cu-core
    ==
  ::
  ++  cu-agent
    |=  [=wire =sign:agent:gall]
    ^+  cu-core
    ?+    wire  ~|(bad-club-take/wire !!)
        [%gossip ~]
      ?>  ?=(%poke-ack -.sign)
      ?~  p.sign  cu-core
      ::  TODO: handle?
      %-  (slog leaf/"Failed to gossip {<src.bowl>} {<id>}" u.p.sign)
      cu-core
    ==
  ::
  --
::
++  pending-dms
  (dms-by-net %invited ~)
::
++  accepted-dms
  (dms-by-net %inviting %done ~)
::
++  archived-dms
  (dms-by-net %archive ~)
::
++  dms-by-net
  |=  nets=(list net:dm:c)
  =/  nets  (~(gas in *(set net:dm:c)) nets)
  %-  ~(gas by *(map ship dm:c))
  %+  skim  ~(tap by dms)
  |=  [=ship =dm:c]
  (~(has in nets) net.dm)
::
++  give-invites
  |=  =ship
  =/  invites
  ?:  (~(has by dms) ship)   ~(key by pending-dms)
  (~(put in ~(key by pending-dms)) ship)
  (give %fact ~[/dm/invited] ships+!>(invites))
::
++  di-core
  |_  [=ship =dm:c gone=_|]
  +*  di-pact  ~(. pac pact.dm)
      di-hark  ~(. hark-dm:ch [now.bowl ship])
  ++  di-core  .
  ++  di-abet
    =.  dms
      ?:  gone  (~(del by dms) ship)
      (~(put by dms) ship dm)
    cor
  ++  di-abed
    |=  s=@p
    di-core(ship s, dm (~(got by dms) s))
  ::
  ++  di-abed-soft
    |=  s=@p
    =/  d
      %+  ~(gut by dms)  s
      =|  =remark:c
      =.  watching.remark  &
      [*pact:c remark ?:(=(src our):bowl %inviting %invited) |]
    di-core(ship s, dm d)
  ::
  ++  di-area  `path`/dm/(scot %p ship)
  ++  di-spin
    |=  [rest=path con=(list content:ha) but=(unit button:ha)]
    ^-  new-yarn:ha
    ::  hard coded desk because these shouldn't appear in groups
    =/  rope  [~ ~ %talk /dm/(scot %p ship)]
    =/  link  (welp /dm/(scot %p ship) rest)
    [& & rope con link but]
  ::
  ++  di-proxy
    |=  =diff:dm:c
    =.  di-core  (di-ingest-diff diff)
    =.  cor  (emit (proxy:di-pass diff))
    di-core
  ::
  ++  di-archive
    =.  net.dm  %archive
    (di-post-notice ' archived the channel')
  ::
  ++  di-give-writs-diff
    |=  =diff:writs:c
    =.  cor
      =/  =cage  writ-diff+!>(diff)
      (emit %give %fact ~[(snoc di-area %ui)] cage)
    di-core
  ::
  ++  di-ingest-diff
    |=  =diff:dm:c
    =/  =wire  /contacts/(scot %p ship)
    =/  =cage  [act:mar:contacts !>(`action:contacts`[%heed ~[ship]])]
    =.  cor  (emit %pass wire %agent [our.bowl %contacts] %poke cage)
    =/  old-brief  di-brief
    =.  pact.dm  (reduce:di-pact now.bowl diff)
    =?  cor  &(=(net.dm %invited) !=(ship our.bowl))
      (give-invites ship)
    ?-  -.q.diff
        ?(%del %add-feel %del-feel)  (di-give-writs-diff diff)
    ::
        %add
      =.  time.q.diff  (~(get by dex.pact.dm) p.diff)
      =*  memo  memo.q.diff
      =?  remark.dm  =(author.memo our.bowl)
        remark.dm(last-read `@da`(add now.bowl (div ~s1 100)))
      =?  cor  &(!=(old-brief di-brief) !=(net.dm %invited))
        (give-brief ship/ship di-brief)
      ?:  from-self    (di-give-writs-diff diff)
      ?^  kind.q.diff  (di-give-writs-diff diff)
      =/  new-yarn
        %^  di-spin
          ~
          :~  [%ship author.memo]
              ?:  =(net.dm %invited)  ' has invited you to a direct message'
              ': '
              ?:(=(net.dm %invited) '' (flatten:utils content.memo))
          ==
        ~
      =?  cor  (want-hark %to-us)
        (emit (pass-hark new-yarn))
      (di-give-writs-diff diff)
    ::
        %quip
      =*  delt  delta.q.diff
      =/  entry=(unit [=time =writ:c])  (get:di-pact p.diff)
      =?  meta.q.diff  !=(~ entry)  `meta.writ:(need entry)
      ?-  -.delt
          ?(%del %add-feel %del-feel)  (di-give-writs-diff diff)
          %add
        =*  memo  memo.delt
        =?  remark.dm  =(author.memo our.bowl)
          remark.dm(last-read `@da`(add now.bowl (div ~s1 100)))
        =?  cor  &(!=(old-brief di-brief) !=(net.dm %invited))
          (give-brief ship/ship di-brief)
        ?:  =(our.bowl author.memo)  (di-give-writs-diff diff)
        ?~  entry  (di-give-writs-diff diff)
        =*  op  writ.u.entry
        =/  new-yarn
          %^  di-spin
            /(rsh 4 (scot %ui time.u.entry))
            :~  [%ship author.memo]  ' replied to '
                [%emph (flatten:utils content.op)]  ': '
                [%ship author.memo]  ': '
                (flatten:utils content.memo)
            ==
          ~
        =?  cor  (want-hark %to-us)
          (emit (pass-hark new-yarn))
        (di-give-writs-diff diff)
      ==
    ==
  ::
  ++  di-take-counter
    |=  =diff:dm:c
    ?<  =(%archive net.dm)
    (di-ingest-diff diff)
  ::
  ++  di-post-notice
    |=  text=cord
    =/  =delta:writs:c  (make-notice our.bowl text)
    (di-ingest-diff [our now]:bowl delta)
  ::
  ++  di-rsvp
    |=  ok=?
    =?  cor  =(our src):bowl
      (emit (proxy-rsvp:di-pass ok))
    ?>  |(=(src.bowl ship) =(our src):bowl)
    ::  TODO hook into archive
    ?.  ok
      %-  (note:wood %odd leaf/"gone {<ship>}" ~)
      ?:  =(src.bowl ship)
        di-core
      di-core(gone &)
    =.  net.dm  %done
    (di-post-notice ' joined the chat')
  ::
  ++  di-watch
    |=  =path
    ^+  di-core
    ?>  =(src.bowl our.bowl)
    ?+  path  !!
      [%ui ~]  di-core
      [%ui %writs ~]  di-core
    ==
  ::
  ++  di-agent
    |=  [=wire =sign:agent:gall]
    ^+  di-core
    ?+    wire  ~|(bad-dm-take/wire !!)
        [%hark ~]
      ?>  ?=(%poke-ack -.sign)
      ?~  p.sign  di-core
      ::  TODO: handle?
      %-  (slog leaf/"Failed to notify about dm {<ship>}" u.p.sign)
      di-core
    ::
        [%proxy ~]
      ?>  ?=(%poke-ack -.sign)
      ?~  p.sign  di-core
      ::  TODO: handle?
      %-  (slog leaf/"Failed to dm {<ship>}" u.p.sign)
      di-core
    ==
  ::
  ++  di-peek
    |=  [care=@tas =(pole knot)]
    ^-  (unit (unit cage))
    ?+    pole  [~ ~]
        [%writs rest=*]
      (peek:di-pact care rest.pole)
    ::
        [%search %text skip=@ count=@ nedl=@ ~]
      %-  some
      %-  some
      :-  %chat-scan
      !>
      %^    text:search:di-pact
          (slav %ud skip.pole)
        (slav %ud count.pole)
      nedl.pole
    ::
        [%search %mention skip=@ count=@ nedl=@ ~]
      %-  some
      %-  some
      :-  %chat-scan
      !>
      %^    mention:search:di-pact
          (slav %ud skip.pole)
        (slav %ud count.pole)
      (slav %p nedl.pole)
    ==
  ::
  ++  di-brief  (brief:di-pact our.bowl last-read.remark.dm)
  ++  di-remark-diff
    |=  diff=remark-diff:c
    ^+  di-core
    =.  remark.dm
      ?-  -.diff
        %watch    remark.dm(watching &)
        %unwatch  remark.dm(watching |)
        %read-at  !! ::  ca-core(last-read.remark.chat p.diff)
      ::
          %read   remark.dm(last-read now.bowl)
  ::    =/  [=time =writ:c]  (need (ram:on:writs:c writs.chat))
  ::    =.  last-read.remark.chat  time
  ::    ca-core
      ==
    =.  cor  (give-brief ship/ship di-brief)
    di-core
  ++  di-pass
    |%
    ++  pass
      |=  [=wire =dock =task:agent:gall]
      ^-  card
      [%pass (welp di-area wire) %agent dock task]
    ++  poke-them  |=([=wire =cage] (pass wire [ship dap.bowl] %poke cage))
    ++  proxy-rsvp  |=(ok=? (poke-them /proxy dm-rsvp+!>([our.bowl ok])))
    ++  proxy  |=(=diff:dm:c (poke-them /proxy dm-diff+!>(diff)))
    --
  --
--
