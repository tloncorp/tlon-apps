/-  c=chat, d=channels, g=groups, u=ui, e=epic, old=chat-2, activity
/-  meta
/-  ha=hark
/-  contacts
/+  default-agent, verb-lib=verb, dbug, neg=negotiate
/+  pac=dm
/+  utils=channel-utils
/+  volume
/+  wood-lib=wood
/+  epos-lib=saga
::  performance, keep warm
/+  chat-json
/*  desk-bill  %bill  /desk/bill
::
%-  %-  agent:neg
    :+  |
      [~.chat-dms^%0 ~ ~]
    [%chat^[~.chat-dms^%0 ~ ~] ~ ~]
%-  agent:dbug
%+  verb-lib  |
::
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  ++  okay  `epic:e`1
  ++  wood-state
    ^-  state:wood-lib
    :*  ver=|
        odd=&
        veb=|
    ==
  ++  club-eq  2 :: reverb control: max number of forwards for clubs
  +$  current-state
    $:  %6
        dms=(map ship dm:c)
        clubs=(map id:club:c club:c)
        pins=(list whom:c)
        bad=(set ship)
        inv=(set ship)
        blocked=(set ship)
        blocked-by=(set ship)
        hidden-messages=(set id:c)
        old-chats=(map flag:old chat:old)  :: for migration
        old-pins=(list whom:old)
    ==
  --
=|  current-state
=*  state  -
=<
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
  ++  on-save  !>([state okay])
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
    epos  ~(. epos-lib [bowl %chat-update okay])
++  abet  [(flop cards) state]
++  cor   .
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))
++  give  |=(=gift:agent:gall (emit %give gift))
++  now-id   `id:c`[our now]:bowl
++  scry-path
  |=  [agent=term =path]
  ^-  ^path
  (welp /(scot %p our.bowl)/[agent]/(scot %da now.bowl) path)
++  init  cor
::  +load: load next state
++  load
  |=  =vase
  |^  ^+  cor
  =+  !<([old=versioned-state cool=@ud] vase)
  |-
  ?-  -.old
    %2  $(old (state-2-to-3 old))
    %3  $(old (state-3-to-4 old))
    %4  $(old (state-4-to-5 old))
    %5  $(old (state-5-to-6 old))
    %6  (emil(state old) (drop load:epos))
  ==
  ::
  +$  versioned-state  $%(current-state state-5 state-4 state-3 state-2)
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
  +$  state-3
    $:  %3
        chats=(map flag:two chat:two)
        dms=(map ship dm:two)
        clubs=(map id:club:two club:two)
        drafts=(map whom:two story:two)
        pins=(list whom:two)
        blocked=(set ship)
        blocked-by=(set ship)
        bad=(set ship)
        inv=(set ship)
        voc=(map [flag:two id:two] (unit said:two))
        fish=(map [flag:two @] id:two)
        ::  true represents imported, false pending import
        imp=(map flag:two ?)
    ==
  +$  state-4
    $:  %4
        chats=(map flag:two chat:two)
        dms=(map ship dm:two)
        clubs=(map id:club:two club:two)
        drafts=(map whom:two story:two)
        pins=(list whom:two)
        blocked=(set ship)
        blocked-by=(set ship)
        hidden-messages=(set id:two)
        bad=(set ship)
        inv=(set ship)
        voc=(map [flag:two id:two] (unit said:two))
        fish=(map [flag:two @] id:two)
        ::  true represents imported, false pending import
        imp=(map flag:two ?)
    ==
  +$  state-5
    $:  %5
        dms=(map ship dm-5)
        clubs=(map id:club:c club-5)
        pins=(list whom:c)
        bad=(set ship)
        inv=(set ship)
        blocked=(set ship)
        blocked-by=(set ship)
        hidden-messages=(set id:c)
        old-chats=(map flag:old chat:old)  :: for migration
        old-pins=(list whom:old)
    ==
  +$  club-5    [heard:club:c remark=remark-5 =pact:c crew:club:c]
  +$  dm-5      [=pact:c remark=remark-5 net:dm:c pin=_|]
  +$  remark-5  [last-read=time watching=_| unread-threads=(set id:c)]
  +$  state-6  current-state
  ++  two      old
  ++  three    c
  ++  state-5-to-6
    |=  s=state-5
    ^-  state-6
    s(- %6, dms (dms-5-to-6 dms.s), clubs (clubs-5-to-6 clubs.s))
  ::
  ++  dms-5-to-6
    |=  dms=(map ship dm-5)
    ^-  (map ship dm:c)
    %-  ~(run by dms)
    |=  dm=dm-5
    ^-  dm:c
    dm(remark (remark-5-to-6 wit.pact.dm remark.dm))
  ::
  ++  clubs-5-to-6
    |=  clubs=(map id:club:c club-5)
    ^-  (map id:club:c club:c)
    %-  ~(run by clubs)
    |=  club=club-5
    ^-  club:c
    club(remark (remark-5-to-6 wit.pact.club remark.club))
  ::
  ++  remark-5-to-6
    |=  [=writs:c remark=remark-5]
    ^-  remark:c
    :_  remark
    ?~(tim=(ram:on:writs:c writs) *time key.u.tim)
  ::
  ++  state-4-to-5
    |=  state-4
    ^-  state-5
    :-  %5
    :+  (dms-4-to-5 dms)
      (clubs-4-to-5 clubs)
    [(pins-4-to-5 pins) bad inv blocked blocked-by hidden-messages chats pins]
  ::
  ++  pins-4-to-5
    |=  pins=(list whom:two)
    ^-  (list whom:c)
    %+  murn  pins
    |=(w=whom:two ?:(?=(%flag -.w) ~ (some w)))
  ::
  ++  dms-4-to-5
    |=  dms=(map ship dm:two)
    ^-  (map ship dm-5)
    %-  ~(run by dms)
    |=  dm:two
    ^-  dm-5
    [(pact-4-to-5 pact) remark net pin]
  ::
  ++  clubs-4-to-5
    |=  clubs=(map id:club:two club:two)
    ^-  (map id:club:c club-5)
    %-  ~(run by clubs)
    |=  club:two
    [heard remark (pact-4-to-5 pact) crew]
  ::
  ++  pact-4-to-5
    |=  =pact:two
    ^-  pact:c
    :_  dex.pact
    =/  writs  (tap:on:writs:two wit.pact)
    =/  reply-index=(map @da replies:c)
      %+  roll  writs
      |=  [[=time =writ:two] reply-index=(map @da replies:c)]
      ?~  replying.writ  reply-index
      =/  old-replies=replies:c  (~(gut by reply-index) time *replies:c)
      =/  reply-time  (~(get by dex.pact) u.replying.writ)
      ?~  reply-time  reply-index
      %+  ~(put by reply-index)  u.reply-time
      (put:on:replies:c old-replies time (reply-4-to-5 u.replying.writ time writ))
    %+  gas:on:writs:c  *writs:c
    %+  murn  writs
    |=  [=time =writ:two]
    ^-  (unit [^time writ:c])
    ?^  replying.writ  ~
    =/  =replies:c  (~(gut by reply-index) time *replies:c)
    (some time (writ-4-to-5 time writ replies))
  ::
  ++  writ-4-to-5
    |=  [=time old=writ:two =replies:c]
    ^-  writ:c
    =;  qm=reply-meta:d
      :-  [id.old time feels.old replies qm]
      (essay-4-to-5 +.old)
    ::
    =/  last-repliers=(set ship)
      =|  repliers=(set ship)
      =/  entries=(list [* reply:c])  (bap:on:replies:c replies)
      |-
      ?:  |(=(~ entries) =(3 ~(wyt in repliers)))
        repliers
      =/  [* =reply:c]  -.entries
      ?:  (~(has in repliers) author.reply)
        $(entries +.entries)
      (~(put in repliers) author.reply)
    :*  (wyt:on:replies:c replies)
        last-repliers
        (biff (ram:on:replies:c replies) |=([=^time *] `time))
    ==
  ::
  ++  reply-4-to-5
    |=  [parent-id=id:c =time old=writ:two]
    ^-  reply:c
    [[id.old parent-id time feels.old] (memo-4-to-5 +.old)]
  ::
  ++  memo-4-to-5
    |=  memo:two
    ^-  memo:d
    [(story-4-to-5 author content) author sent]
  ::
  ++  essay-4-to-5
    |=  memo:two
    ^-  essay:c
    [(memo-4-to-5 +<) %chat ?-(-.content %story ~, %notice [%notice ~])]
  ::
  ++  story-4-to-5
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
  ++  state-3-to-4
    |=  s=state-3
    ^-  state-4
    %*  .  *state-4
      dms     dms.s
      clubs   clubs.s
      drafts  drafts.s
      pins    pins.s
      blocked  blocked.s
      blocked-by  blocked-by.s
      hidden-messages  ~
      bad     bad.s
      inv     inv.s
      fish    fish.s
      voc     voc.s
      chats   chats.s
    ==
  ++  state-2-to-3
    |=  s=state-2
    ^-  state-3
    %*  .  *state-3
      dms     dms.s
      clubs   clubs.s
      drafts  drafts.s
      pins    pins.s
      blocked  ~
      blocked-by  ~
      bad     bad.s
      inv     inv.s
      fish    fish.s
      voc     voc.s
      chats   chats.s
    ==
  --
::
++  poke
  |=  [=mark =vase]
  |^  ^+  cor
  ?+    mark  ~|(bad-poke/mark !!)
      %chat-negotiate
    ::TODO  arguably should just be a /mar/negotiate
    (emit (initiate:neg !<(@p vase) dap.bowl))
  ::
      %chat-dm-rsvp
    =+  !<(=rsvp:dm:c vase)
    di-abet:(di-rsvp:(di-abed:di-core ship.rsvp) ok.rsvp)
  ::
      %chat-pins
    =+  !<(ps=(list whom:c) vase)
    (pin ps)
  ::
      %chat-blocked
    ?<  from-self
    (has-blocked src.bowl)
  ::
      %chat-unblocked
    ?<  from-self
    (has-unblocked src.bowl)
  ::
      %chat-block-ship
    =+  !<(=ship vase)
    ?>  from-self
    (block ship)
  ::
      %chat-unblock-ship
    =+  !<(=ship vase)
    ?>  from-self
    (unblock ship)
  ::
      %chat-toggle-message
    =+  !<(toggle=message-toggle:c vase)
    ?>  from-self
    (toggle-message toggle)
  ::
      %chat-unblocked
    ?<  from-self
    (has-unblocked src.bowl)
  ::
      %chat-block-ship
    =+  !<(=ship vase)
    ?>  from-self
    (block ship)
  ::
      %chat-unblock-ship
    =+  !<(=ship vase)
    ?>  from-self
    (unblock ship)
  ::
      %chat-toggle-message
    =+  !<(toggle=message-toggle:c vase)
    ?>  from-self
    (toggle-message toggle)
  ::
      %chat-remark-action
    =+  !<(act=remark-action:c vase)
    ?-  -.p.act
      %ship  di-abet:(di-remark-diff:(di-abed:di-core p.p.act) q.act)
      %club  cu-abet:(cu-remark-diff:(cu-abed:cu-core p.p.act) q.act)
    ==
  ::
      %chat-dm-action
    =+  !<(=action:dm:c vase)
    ::  don't allow anyone else to proxy through us
    ?.  =(src.bowl our.bowl)
      ~|("%dm-action poke failed: only allowed from self" !!)
    ::  don't proxy to self, creates an infinite loop
    ?:  =(p.action our.bowl)
      ~|("%dm-action poke failed: can't dm self" !!)
    di-abet:(di-proxy:(di-abed-soft:di-core p.action) q.action)
  ::
      %chat-dm-diff
    =+  !<(=diff:dm:c vase)
    di-abet:(di-take-counter:(di-abed-soft:di-core src.bowl) diff)
  ::
      %chat-club-create
    cu-abet:(cu-create:cu-core !<(=create:club:c vase))
  ::
      ?(%chat-club-action %chat-club-action-0)
    =+  !<(=action:club:c vase)
    =/  cu  (cu-abed p.action)
    cu-abet:(cu-diff:cu q.action)
  ::
      %chat-dm-archive  di-abet:di-archive:(di-abed:di-core !<(ship vase))
      %chat-migrate-server  ?>(from-self server:migrate)
      %chat-migrate         ?>(from-self client:migrate)
  ::
      %chat-migrate-refs
    ?>  from-self
    =+  !<(flag=[ship term] vase)
    (refs:migrate flag)
      %chat-trim
    ?>  from-self
    trim:migrate
  ::  backwards compatibility
  ::
      %dm-rsvp
    =+  `rsvp:dm:c`!<(rsvp:dm:old vase)  ::NOTE  safety check
    $(mark %chat-dm-rsvp)
  ::
      %dm-diff
    =;  new=diff:dm:c
      $(mark %chat-dm-diff, vase !>(new))
    (new-diff !<(=diff:dm:old vase))
  ::
      %club-action
    =;  new=action:club:c
      $(mark %chat-club-action, vase !>(new))
    =+  !<(=action:club:old vase)
    ?.  ?=(%writ -.q.q.action)  action
    action(diff.q.q (new-diff diff.q.q.action))
  ==
  ++  pin
    |=  ps=(list whom:c)
    =.  pins  ps
    cor
  ::  backwards compatibility
  ::
  ++  new-diff
    |=  diff=diff:writs:old
    ^-  diff:writs:c
    :-  p.diff
    ?-  -.q.diff
      %add       [%add (new-memo p.q.diff) ~ ~]
      %del       [%del ~]
      %add-feel  [%add-react +.q.diff]
      %del-feel  [%del-react +.q.diff]
    ==
  ++  new-memo
    |=  memo:old
    ^-  memo:d
    [(new-story author content) author sent]
  ::
  ++  new-story
    |=  [=ship old=content:old]
    ^-  story:d
    ?-    -.old
        %notice  ~[%inline pfix.p.old ship+ship sfix.p.old]~
        %story
      %+  welp
        (turn p.p.old (lead %block))
      [%inline q.p.old]~
    ==
  --
  ::
  ++  has-blocked
    |=  =ship
    ^+  cor
    ?<  (~(has in blocked-by) ship)
    ?<  =(our.bowl ship)
    =.  blocked-by  (~(put in blocked-by) ship)
    (give %fact ~[/] chat-blocked-by+!>(ship))
  ::
  ++  has-unblocked
    |=  =ship
    ^+  cor
    ?>  (~(has in blocked-by) ship)
    ?<  =(our.bowl ship)
    =.  blocked-by  (~(del in blocked-by) ship)
    (give %fact ~[/] chat-unblocked-by+!>(ship))
  ::
  ++  block
    |=  =ship
    ^+  cor
    ?<  (~(has in blocked) ship)
    ?<  =(our.bowl ship)
    =.  blocked  (~(put in blocked) ship)
    (emit %pass di-area:di-core:cor %agent [ship dap.bowl] %poke %chat-blocked !>(0))
  ::
  ++  unblock
    |=  =ship
    ^+  cor
    ?>  (~(has in blocked) ship)
    =.  blocked  (~(del in blocked) ship)
    (emit %pass di-area:di-core:cor %agent [ship dap.bowl] %poke %chat-unblocked !>(0))
  ::
  ++  toggle-message
    |=  toggle=message-toggle:c
    ^+  cor
    =.  hidden-messages
      ?-  -.toggle
        %hide  (~(put in hidden-messages) id.toggle)
        %show  (~(del in hidden-messages) id.toggle)
      ==
    (give %fact ~[/] chat-toggle-message+!>(toggle))
  ::
++  watch
  |=  =(pole knot)
  ^+  cor
  ?+    pole  ~|(bad-watch-path+`path`pole !!)
      [%clubs ~]  ?>(from-self cor)
      [%unreads ~]  ?>(from-self cor)
      ~  ?>(from-self cor)
      [%dm %invited ~]  ?>(from-self cor)
  ::
      [%dm ship=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    di-abet:(di-watch:(di-abed:di-core ship) rest.pole)
  ::
      [%club id=@ rest=*]
    =/  =id:club:c  (slav %uv id.pole)
    cu-abet:(cu-watch:(cu-abed id) rest.pole)
      [%epic ~]
    (give %fact ~ epic+!>(okay))
  ==
::
++  agent
  |=  [=(pole knot) =sign:agent:gall]
  ^+  cor
  ?+    pole  ~|(bad-agent-wire/pole !!)
      ~  cor
  ::
      [%epic ~]  cor
      [%hook *]  cor
  ::
      [%migrate ~]
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign  cor
    %-  (slog 'Failed to do chat data migration' u.p.sign)
    cor
  ::
      [%activity %submit ~]
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign  cor
    %-  (slog 'Failed to send activity' u.p.sign)
    cor
  ::
      [%said *]
    ::  old chat used to fetch previews, we don't do those here anymore
    ::
    cor
  ::
      [%groups ~]
    ::  old chat used to watch groups. we no longer want/need to.
    ::
    (emit %pass /groups %agent [our.bowl %groups] %leave ~)
  ::
      [%chat ship=@ *]
    ::  old chat used to have chat subscriptions. we no longer care about these
    ::
    ?~  who=(slaw %p ship.pole)  cor
    (emit %pass pole %agent [u.who dap.bowl] %leave ~)
  ::
      [%contacts ship=@ ~]
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign  cor
    %-  (slog leaf/"Failed to heed contact {(trip ship.pole)}" u.p.sign)
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
    [%x %full ~]  ``noun+!>([dms clubs])
    [%x %old ~]  ``noun+!>(old-chats)  ::  legacy data, for migration use
  ::
    [%x %clubs ~]  ``clubs+!>((~(run by clubs) |=(=club:c crew.club)))
  ::
    [%x %pins ~]  ``chat-pins+!>(pins)
  ::
    [%x %blocked ~]  ``ships+!>(blocked)
  ::
    [%x %blocked-by ~]  ``ships+!>(blocked-by)
  ::
    [%x %hidden-messages ~]  ``hidden-messages+!>(hidden-messages)
  ::
    [%x %unreads ~]  ``chat-unreads+!>(unreads)
  ::
      [%x %init ~]
    =-  ``noun+!>(-)
    :*  (~(run by clubs) |=(=club:c crew.club))
        ~(key by accepted-dms)
        unreads
        ~(key by pending-dms)
        pins
    ==
  ::
      [%x %heads ?(~ [@ ~])]
    =/  since=(unit time)
      ?~  t.t.path  ~
      ?^  tim=(slaw %da i.t.t.path)  `u.tim
      `(slav %ud i.t.t.path)
    :^  ~  ~  %chat-heads
    !>  ^-  chat-heads:c
    %+  murn
      %+  welp
        (turn ~(tap by dms) |=([=@p dm:c] [ship+p pact remark]))
      (turn ~(tap by clubs) |=([=id:club:c club:c] [club+id pact remark]))
    |=  [=whom:c =pact:c =remark:c]
    ^-  (unit [_whom time (unit writ:c)])
    ::  if there is no latest post, give nothing
    ::
    ?~  vp=(ram:on:writs:c wit.pact)  ~
    =*  result
      `[whom recency.remark `val.u.vp]
    ::  if the request is bounded, check that latest message is "in bounds"
    ::  (and not presumably already known by the requester)
    ::
    ?:  ?|  ?=(~ since)
            |((gth key.u.vp u.since) (gth recency.remark u.since))
        ==
      ::  latest is in range (or recency was changed), give it directly
      ::
      result
    ::  unlike in channels, there is no edit or deletion, so we don't need
    ::  to account for related edge-cases
    ::
    ~
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
++  unreads
  ^-  unreads:c
  %-  ~(gas by *unreads:c)
  %+  welp
    %+  turn  ~(tap by clubs)
    |=  [=id:club:c =club:c]
    =/  loyal  (~(has in team.crew.club) our.bowl)
    =/  invited  (~(has in hive.crew.club) our.bowl)
    ?:  &(!loyal !invited)
      [club/id *time 0 ~ ~]
    =/  cu  (cu-abed id)
    [club/id cu-unread:cu]
  %+  murn  ~(tap in ~(key by dms))
  |=  =ship
  =/  di  (di-abed:di-core ship)
  ?:  ?=(?(%invited %archive) net.dm.di)  ~
  ?:  =([~ ~] pact.dm.di)  ~
  `[ship/ship di-unread:di]
++  give-unread
  |=  [=whom:c =unread:unreads:c]
  (give %fact ~[/unreads] chat-unread-update+!>([whom unread]))
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
  |=  =cage
  ^-  card
  =/  =wire  /hark
  =/  =dock  [our.bowl %hark]
  [%pass wire %agent dock %poke cage]
++  pass-yarn
  |=  =new-yarn:ha
  =/  =cage  hark-action-1+!>([%new-yarn new-yarn])
  (pass-hark cage)
::
++  pass-activity
  =,  activity
  |=  $:  =whom
          $=  concern
          $%  [%post key=message-key]
              [%reply key=message-key top=message-key]
              [%invite ~]
          ==
          content=story:d
          mention=?
      ==
  ^+  cor
  =;  actions=(list action)
    ?.  .^(? %gu (scry-path %activity /$))
      cor
    %-  emil
    %+  turn  actions
    |=  =action
    =/  =cage  activity-action+!>(action)
    [%pass /activity/submit %agent [our.bowl %activity] %poke cage]
  ?:  ?&  ?=(?(%post %reply) -.concern)
          .=  our.bowl
          p.id:?-(-.concern %post key.concern, %reply key.concern)
      ==
    =/  =source
      ?:  ?=(%post -.concern)  [%dm whom]
      [%dm-thread top.concern whom]
    :~  [%read source [%all `now.bowl |]]
        [%bump source]
    ==
  :_  ~
  :-  %add
  ?-  -.concern
    %post    [%dm-post key.concern whom content mention]
    %reply   [%dm-reply key.concern top.concern whom content mention]
    %invite  [%dm-invite whom]
  ==
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
      %reply  (check-reply-ownership delta should)
      %add  ?.(should | =(src.bowl author.memo.delta))
      %del  should
      %add-react  =(src.bowl ship.delta)
      %del-react  =(src.bowl ship.delta)
  ==
::
++  check-reply-ownership
  |=  [d=delta:writs:c should=?]
  ?>  ?=(%reply -.d)
  =*  delta  delta.d
  ?-  -.delta
      %add  ?.(should | =(src.bowl author.memo.delta))
      %del  should
      %add-react  =(src.bowl ship.delta)
      %del-react  =(src.bowl ship.delta)
  ==
::
++  diff-to-response
  |=  [=diff:writs:c =pact:c]
  ^-  (unit response:writs:c)
  =;  delta=?(~ response-delta:writs:c)
    ?~  delta  ~
    `[p.diff delta]
  ?+  -.q.diff  q.diff
      %add
    =/  time=(unit time)  (~(get by dex.pact) p.diff)
    ?~  time  ~
    [%add memo.q.diff u.time]
  ::
      %reply
    =;  delta=?(~ response-delta:replies:c)
      ?~  delta  ~
      [%reply id.q.diff meta.q.diff delta]
    ?+  -.delta.q.diff  delta.q.diff
        %add
      =/  time=(unit time)  (~(get by dex.pact) id.q.diff)
      ?~  time  ~
      [%add memo.delta.q.diff u.time]
    ==
  ==
++  from-self  =(our src):bowl
++  migrate
  |%
  ++  t  old
  ++  server
    =/  server-channels=v-channels:d
      %+  convert-channels  &
      %-  ~(gas by *(map flag:t chat:t))
      %+  skim  ~(tap by old-chats)
      |=  [=flag:t =chat:t]
      =(our.bowl p.flag)
    =/  =cage  [%channel-migration !>(server-channels)]
    (emit %pass /migrate %agent [our.bowl %channels-server] %poke cage)
  ::
  ++  client
    =/  =v-channels:d  (convert-channels | old-chats)
    =/  =cage  [%channel-migration !>(v-channels)]
    =.  cor  (emit %pass /migrate %agent [our.bowl %channels] %poke cage)
    =+  pins=old-pins
    |-
    ?~  pins  cor
    =/  =^cage  [%ui-action !>(`action:u`[%pins %add (convert-pin i.pins)])]
    =.  cor  (emit %pass /migrate %agent [our.bowl %groups-ui] %poke cage)
    $(pins t.pins)
  ::
  ++  refs
    |=  =flag:old
    ?~  old-chat=(~(get by old-chats) flag)  cor
    %-  emil
    ::  iterate over all chats and, for every message/reply authored by us,
    ::  containing a chat reference that we have (almost certainly) converted,
    ::  send the new version of the message/reply as an edit to the host.
    ::
    %+  murn  (tap:on:writs:old wit.pact.u.old-chat)
    |=  [=time =writ:old]
    ^-  (unit card)
    ?.  =(our.bowl author.writ)  ~
    =/  edit=(unit essay:d)
      =;  contains-chat-ref=?
        ?.  contains-chat-ref  ~
        `(convert-essay +.writ)
      ?.  ?=(%story -.content.writ)  |
      %+  lien  p.p.content.writ
      |=  =block:old
      ?=([%cite %chan [%chat *] *] block)
    =/  command=(unit c-post:d)
      ?~  edit  ~
      ?~  replying.writ
        `[%edit time u.edit]
      =/  parent-time  (~(get by dex.pact.u.old-chat) u.replying.writ)
      ?~  parent-time  ~
      `[%reply u.parent-time %edit time -.u.edit]
    ?~  command  ~
    =/  =cage
      :-  %channel-action
      !>(`a-channels:d`[%channel [%chat flag] %post u.command])
    `[%pass /migrate %agent [our.bowl %channels] %poke cage]
  ::
  ++  trim
    =-  =.  old-chats  -  cor
    ^-  (map flag:old chat:old)
    %-  ~(run by old-chats)
    |=  old-chat=chat:old
    =/  citations=(set [ship time])
      %-  sy
      ^-  (list [ship time])
      %-  zing
      ^-  (list (list [ship time]))
      %+  murn  (tap:on:writs:old wit.pact.old-chat)
      |=  [=time =writ:old]
      ^-  (unit (list [ship ^time]))
      ::  return citer message and cited message
      ?.  =(our.bowl author.writ)  ~
      =/  cite-targets=(list [ship ^time])
        ?.  ?=(%story -.content.writ)  ~
        %+  murn  p.p.content.writ
        |=  =block:old
        ^-  (unit [ship ^time])
        ?.  ?=([%cite %chan [%chat *] *] block)  ~
        ?.  ?=([%msg @ @ ~] wer.cite.block)  ~
        =/  who  (slaw %p i.t.wer.cite.block)
        ?~  who  ~
        =/  tim  (slaw %ud i.t.t.wer.cite.block)
        ?~  tim  ~
        `[u.who u.tim]
      ?~  cite-targets
        ~
      `[id.writ cite-targets]
    %=  old-chat
      log  ~
      dex.pact
        %-  malt
        %+  murn  ~(tap by dex.pact.old-chat)
        |=  [=id:old =time]
        ?.  (~(has in citations) id)  ~
        `[id time]
      wit.pact
        %-  malt
        %+  murn  (tap:on:writs:old wit.pact.old-chat)
        |=  [=time =writ:old]
        ?.  (~(has in citations) id.writ)  ~
        `[time writ]
    ==
  ++  convert-pin
    |=  =whom:t
    ^-  whom:u
    ?.  ?=(%flag -.whom)
      [%chat whom]
    ?.  (~(has by old-chats) p.whom)
      [%group p.whom]
    [%channel %chat p.whom]
  ::
  ++  convert-channels
    |=  [log=? =_old-chats]
    ^-  v-channels:d
    %-  ~(gas by *v-channels:d)
    %+  turn  ~(tap by old-chats)
    |=  [=flag:t =chat:t]
    ^-  [nest:d v-channel:d]
    :-  [%chat flag]
    =/  posts=v-posts:d  (convert-posts pact.chat)
    %*    .  *v-channel:d
        posts   posts
        log     ?.(log ~ (convert-log pact.chat posts perm.chat log.chat))
        perm    [1 perm.chat]
        remark  :_  remark.chat
                ?~(tim=(ram:on-v-posts:d posts) *time key.u.tim)
        net
      ?-  -.net.chat
        %pub  [*ship &]
        %sub  [host load]:net.chat
      ==
    ==
  ::
  ++  convert-posts
    |=  old=pact:t
    ^-  v-posts:d
    =/  writs  (tap:on:writs:t wit.old)
    =/  reply-index=(map @da v-replies:d)
      %+  roll  writs
      |=  [[=time =writ:t] reply-index=(map @da v-replies:d)]
      ?~  replying.writ  reply-index
      ::  this writ is replying to something, so temporarily put it into the
      ::  reply index. below, we will incorporate it into the parent writ.
      ::
      =/  parent-time  (~(get by dex.old) u.replying.writ)
      ?~  parent-time  reply-index
      =/  old-replies=v-replies:d  (~(gut by reply-index) u.parent-time *v-replies:d)
      %+  ~(put by reply-index)  u.parent-time
      (put:on-v-replies:d old-replies time `(convert-quip time writ))
    %+  gas:on-v-posts:d  *v-posts:d
    %+  murn  writs
    |=  [=time =writ:t]
    ^-  (unit [id-post:d (unit v-post:d)])
    ?^  replying.writ  ~
    ::  this writ is a top-level message. incorporate the replies to it found
    ::  by the above code.
    ::
    =/  replies=v-replies:d  (~(gut by reply-index) time *v-replies:d)
    (some time `(convert-post time writ replies))
  ::
  ++  convert-post
    |=  [id=@da old=writ:t replies=v-replies:d]
    ^-  v-post:d
    [[id replies (convert-feels feels.old)] %0 (convert-essay +.old)]
  ::
  ++  convert-feels
    |=  old=(map ship feel:t)
    ^-  v-reacts:d
    %-  ~(run by old)
    |=  react=feel:t
    [%0 `react]
  ::
  ++  convert-quip
    |=  [id=@da old=writ:t]
    ^-  v-reply:d
    [[id (convert-feels feels.old)] %0 (convert-memo +.old)]
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
      =-  (snoc - [%inline q.p.old])
      %+  turn  p.p.old
      |=  =block:t
      ^-  verse:d
      :-  %block
      ?.  ?=([%cite %chan *] block)  block
      =;  new=(unit path)
        ?~  new  block
        block(wer.cite u.new)
      =,  cite.block
      ?.  ?=(%chat p.nest)                     ~
      ?~  old=(~(get by old-chats) q.nest)     ~
      =*  dex  dex.pact.u.old
      =*  wit  wit.pact.u.old
      ?.  ?=([%msg @ @ ~] wer.cite.block)      ~
      ?~  who=(slaw %p i.t.wer)                ~
      ?~  tim=(slaw %ud i.t.t.wer)             ~
      ?~  id=(~(get by dex) [u.who u.tim])     ~
      =*  single  `/msg/(crip (a-co:co u.id))
      ?~  ret=(get:on:writs:t wit u.id)        single
      ?~  replying.u.ret                       single
      ?~  td=(~(get by dex) u.replying.u.ret)  single
      `/msg/(crip (a-co:co u.td))/(crip (a-co:co u.id))
    ==
  ::
  ++  convert-log
    |=  [[=writs:t =index:t] posts=v-posts:d =perm:d =log:t]
    ^-  log:d
    %+  gas:log-on:d  *log:d
    %-  zing
    %+  turn  (tap:log-on:t log)
    |=  [=time =diff:t]
    ^-  (list [id-post:d u-channel:d])
    =;  new=(list u-channel:d)
      ?~  new  ~
      ?~  t.new  [time i.new]~
      =.  time  (sub time ~s1)
      =>  .(new `(list u-channel:d)`new)
      |-
      ?~  new  ~
      [[time i.new] $(time +(time), new t.new)]
    ?-    -.diff
        ?(%add-sects %del-sects)  [%perm 0 perm]~
        %create
      :-  [%create p.diff]
      %+  murn  (tap:on:writs:t wit.q.diff)
      |=  [=^time =writ:t]
      =/  new-post  (get:on-v-posts:d posts time)
      ?~  new-post  ~
      (some %post time %set u.new-post)
    ::
        %writs
      =*  id  p.p.diff
      =/  old-time  (~(get by index) id)
      ?~  old-time  ~
      =/  old-writ  (get:on:writs:t writs u.old-time)
      ?~  old-writ  [%post u.old-time %set ~]~
      ?~  replying.u.old-writ
        =/  new-post  (get:on-v-posts:d posts u.old-time)
        ?~  new-post  ~
        :_  ~
        :+  %post  u.old-time
        ?-  -.q.p.diff
          %del                    [%set ~]
          ?(%add %edit)           [%set u.new-post]
          ?(%add-feel %del-feel)  [%reacts ?~(u.new-post ~ reacts.u.u.new-post)]
       ==
      =/  new-post-id  (~(get by index) u.replying.u.old-writ)
      ?~  new-post-id  ~
      =/  new-post  (get:on-v-posts:d posts u.new-post-id)
      ?~  new-post  ~
      ?~  u.new-post  ~
      =/  new-quip  (get:on-v-replies:d replies.u.u.new-post u.old-time)
      ?~  new-quip  ~
      :_  ~
      :+  %post   u.new-post-id
      :+  %reply  u.old-time
      ^-  u-reply:d
      ?-  -.q.p.diff
        %del                    [%set ~]
        ?(%add %edit)           [%set u.new-quip]
        ?(%add-feel %del-feel)  [%reacts ?~(u.new-quip ~ reacts.u.u.new-quip)]
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
  ++  cu-area-writs  `wire`/club/(scot %uv id)/writs
  ::
  ++  cu-uid
    =/  uid  `@uv`(shax (jam ['clubs' (add counter eny.bowl)]))
    [uid cu-core(counter +(counter))]
  ::
  ++  cu-spin
    |=  [rest=path con=(list content:ha) but=(unit button:ha)]
    ^-  new-yarn:ha
    =/  rope  [~ ~ %groups /club/(scot %uv id)]
    =/  link  (welp /dm/(scot %uv id) rest)
    [& & rope con link but]
  ::
  ++  cu-activity  !.
    |*  a=*
    =.  cor  (pass-activity [%club id] a)
    cu-core
  ::
  ++  cu-pass
    |%
    ++  act
      |=  [=ship =diff:club:c]
      ^-  card
      =/  =wire
        %+  weld  cu-area
        ^-  wire
        :-  %gossip
        ?.  ?=(%writ -.q.diff)  ~
        =,  p.diff.q.diff
        /(scot %uv p.diff)/(scot %p p)/(scot %ud q)
      =/  =dock  [ship dap.bowl]
      =/  =cage  chat-club-action+!>(`action:club:c`[id diff])
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
  ++  cu-unread
    %+  unread:cu-pact  our.bowl
    [recency last-read unread-threads]:remark.club
  ::
  ++  cu-create
    |=  =create:club:c
    =.  cu-core  (cu-init %done create)
    =.  cu-core  (cu-diff 0v0 [%init team hive met]:crew.club)
    =.  cor  (give-unread club/id cu-unread)
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
    =/  =cage  chat-club-action+!>(action)
    =.  cor
      (emit %give %fact ~[/ /clubs] cage)
    cu-core
  ::
  ++  cu-give-writs-diff
    |=  =diff:writs:c
    =/  response=(unit response:writs:c)  (diff-to-response diff pact.club)
    ?~  response  cu-core
    =.  cor
      =/  =cage  writ-response+!>([[%club id] u.response])
      (emit %give %fact ~[/ cu-area] cage)
    =.  cor
      =/  =cage  writ-response+!>([[%club id] u.response])
      (emit %give %fact ~[/ cu-area-writs] cage)
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
      =.  cor  (pass-activity [%club id] [%invite ~] *story:d |)
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
      =/  loyal  (~(has in team.crew.club) our.bowl)
      =/  invited  (~(has in hive.crew.club) our.bowl)
      ?:  &(!loyal !invited)
         cu-core
      =.  pact.club  (reduce:cu-pact now.bowl diff.delta)
      ?-  -.q.diff.delta
          ?(%del %add-react %del-react)  (cu-give-writs-diff diff.delta)
          %add
        =.  time.q.diff.delta  (~(get by dex.pact.club) p.diff.delta)
        =*  memo  memo.q.diff.delta
        =?  last-read.remark.club  =(author.memo our.bowl)
          (add now.bowl (div ~s1 100))
        =.  recency.remark.club  now.bowl
        =.  cor  (give-unread club/id cu-unread)
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
          (emit (pass-yarn new-yarn))
        =/  concern  [%post p.diff.delta now.bowl]
        =/  mention  (was-mentioned:utils content.memo our.bowl)
        =.  cu-core  (cu-activity concern content.memo mention)
        (cu-give-writs-diff diff.delta)
      ::
          %reply
        =*  reply-id  id.q.diff.delta
        =*  delt  delta.q.diff.delta
        =/  entry=(unit [=time =writ:c])  (get:cu-pact p.diff.delta)
        =?  meta.q.diff.delta  !=(~ entry)  `meta.writ:(need entry)
        ?-  -.delt
            ?(%del %add-react %del-react)  (cu-give-writs-diff diff.delta)
            %add
          =*  memo  memo.delt
          =?  last-read.remark.club  =(author.memo our.bowl)
            (add now.bowl (div ~s1 100))
          =?  unread-threads.remark.club  !=(our.bowl author.memo)
            (~(put in unread-threads.remark.club) p.diff.delta)
          =.  recency.remark.club  now.bowl
          =.  cor  (give-unread club/id cu-unread)
          ?:  =(our.bowl author.memo)  (cu-give-writs-diff diff.delta)
          ?~  entry  (cu-give-writs-diff diff.delta)
          =*  op  writ.u.entry
          =/  new-yarn
            %^  cu-spin
              /message/(scot %p p.id.op)/(scot %ud q.id.op)
              :~  [%ship author.memo]  ' replied to '
                  [%emph (flatten:utils content.op)]  ': '
                  [%ship author.memo]  ': '
                  (flatten:utils content.memo)
              ==
            ~
          =?  cor  (want-hark %to-us)
            (emit (pass-yarn new-yarn))
          =/  top-con  [id time]:op
          =/  concern  [%reply [id.q.diff.delta now.bowl] top-con]
          =/  mention  (was-mentioned:utils content.memo our.bowl)
          =.  cu-core  (cu-activity concern content.memo mention)
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
      =.  cor  (give-unread club/id cu-unread)
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
    =?  cor  =(%read -.diff)
      %-  emil
      =+  .^(=carpet:ha %gx /(scot %p our.bowl)/hark/(scot %da now.bowl)/desk/groups/latest/noun)
      %+  murn
        ~(tap by cable.carpet)
      |=  [=rope:ha =thread:ha]
      ?.  =(/club/(scot %uv id) ted.rope)  ~
      =/  =cage  hark-action-1+!>([%saw-rope rope])
      `(pass-hark cage)
    =.  remark.club
      ?-  -.diff
        %watch    remark.club(watching &)
        %unwatch  remark.club(watching |)
        %read-at  !!
      ::
          %read
        ::  now.bowl should always be greater than the last message id
        ::  because ids are generated by us
        %=  remark.club
          last-read  now.bowl
          unread-threads  *(set id:c)
        ==
      ==
    =.  cor
      (give-unread club/id cu-unread)
    cu-core
  ::
  ++  cu-peek
    |=  [care=@tas =(pole knot)]
    ^-  (unit (unit cage))
    ?+  pole  [~ ~]
      [%writs rest=*]  (peek:cu-pact care rest.pole)
      [%crew ~]   ``chat-club-crew+!>(crew.club)
    ::
        [%search %bounded kind=?(%text %mention) from=@ tries=@ nedl=@ ~]
      :^  ~  ~  %chat-scam
      !>  ^-  scam:c
      %^    ?-  kind.pole
              %text     text:tries-bound:search:cu-pact
              %mention  mention:tries-bound:search:cu-pact
            ==
          ?:  =(%$ from.pole)  ~
          `(slav %ud from.pole)
        (slav %ud tries.pole)
      ?-  kind.pole
        %text     (fall (slaw %t nedl.pole) nedl.pole)
        %mention  (slav %p nedl.pole)
      ==
    ::
        [%search %text skip=@ count=@ nedl=@ ~]
      %-  some
      %-  some
      :-  %chat-scan
      !>  ^-  scan:c
      %^    text:hits-bound:search:cu-pact
          (slav %ud skip.pole)
        (slav %ud count.pole)
      (fall (slaw %t nedl.pole) nedl.pole)
    ::
        [%search %mention skip=@ count=@ nedl=@ ~]
      %-  some
      %-  some
      :-  %chat-scan
      !>  ^-  scan:c
      %^    mention:hits-bound:search:cu-pact
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
      ~  cu-core
      [%writs ~]  cu-core
    ==
  ::
  ++  cu-agent
    |=  [=wire =sign:agent:gall]
    ^+  cu-core
    ?+    wire  ~|(bad-club-take/wire !!)
        [%gossip *]
      ?>  ?=(%poke-ack -.sign)
      ?~  p.sign  cu-core
      ::  if we already tried hard, this is the end of the road
      ::
      ?:  ?=([%archaic ~] t.wire)
        %-  (slog leaf/"Failed to gossip {<src.bowl>} {<id>}" u.p.sign)
        cu-core
      ::  if they're know version mismatching, we should do nothing
      ::TODO  might want to mark the local msg as (partially?) undelivered...
      ::
      ?.  ?=(%await (read-status:neg bowl src.bowl dap.bowl))
        %-  (slog leaf/"Failed to gossip {<src.bowl>} {<id>}" u.p.sign)
        cu-core
      ::  if a poke failed, but we also don't have a negotiated version for
      ::  them, they might still be on the old (pre-2024) chat backend. try
      ::  sending them an old-style poke if we can, for backcompat.
      ::  we do our best to recover the message from the wire.
      ::
      =.  cor
        =;  c=(unit cage)
          ?~  c  cor
          %+  emit  %pass
          [(weld cu-area /gossip/archaic) %agent [src.bowl %chat] %poke u.c]
        ?+  t.wire  ~
            [@ @ @ ~]
          %-  some
          :-  %club-action
          !>  ^-  action:club:old
          =/  =uid:club:c
            (slav %uv i.t.wire)
          =/  mid=id:c
            [(slav %p i.t.t.wire) (slav %ud i.t.t.t.wire)]
          =/  msg=(unit [=time =writ:c])
            (get:cu-pact mid)
          :^  id  uid  %writ
          ^-  diff:writs:old
          :-  mid
          ?~  msg  [%del ~]
          :-  %add
          ^-  memo:old
          =,  writ.u.msg
          [~ author sent [%story ~ (verses-to-inlines content)]]
        ==
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
  (give %fact ~[/ /dm/invited] ships+!>(invites))
::
++  verses-to-inlines  ::  for backcompat
  |=  l=(list verse:d)
  ^-  (list inline:old)
  %-  zing
  %+  turn  l
  |=  v=verse:d
  ^-  (list inline:old)
  ?-  -.v
      %block   ~
      %inline
    %+  murn  p.v
    |=  i=inline:d
    ^-  (unit inline:old)
    ?@  i    `i
    ?+  -.i  `i
      %task        ~
      %italics     `[-.i ^$(p.v p.i)]
      %bold        `[-.i ^$(p.v p.i)]
      %strike      `[-.i ^$(p.v p.i)]
      %blockquote  `[-.i ^$(p.v p.i)]
    ==
  ==
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
    =/  dm  (~(get by dms) s)
    ?^  dm  di-core(ship s, dm u.dm)
    =|  =remark:c
    =/  new=dm:c
      :*  *pact:c
          remark(watching &)
          ?:(=(src our):bowl %inviting %invited)
          |
      ==
    =.  di-core  di-core(ship s, dm new)
    (di-activity [%invite ~] *story:d &)
  ::
  ++  di-area  `path`/dm/(scot %p ship)
  ++  di-area-writs  `path`/dm/(scot %p ship)/writs
  ::
  ++  di-activity  !.
    |*  a=*
    =.  cor  (pass-activity [%ship ship] a)
    di-core
  ::
  ++  di-spin
    |=  [rest=path con=(list content:ha) but=(unit button:ha)]
    ^-  new-yarn:ha
    =/  rope  [~ ~ %groups /dm/(scot %p ship)]
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
    =/  response=(unit response:writs:c)  (diff-to-response diff pact.dm)
    ?~  response  di-core
    =.  cor
      =/  =cage  writ-response+!>([[%ship ship] u.response])
      (emit %give %fact ~[/ di-area] cage)
    =.  cor
      =/  =cage  writ-response+!>([[%ship ship] u.response])
      (emit %give %fact ~[/ di-area-writs] cage)
    di-core
  ::
  ++  di-ingest-diff
    |=  =diff:dm:c
    =/  =wire  /contacts/(scot %p ship)
    =/  =cage  [act:mar:contacts !>(`action:contacts`[%heed ~[ship]])]
    =.  cor  (emit %pass wire %agent [our.bowl %contacts] %poke cage)
    =/  old-unread  di-unread
    =.  pact.dm  (reduce:di-pact now.bowl diff)
    =?  cor  &(=(net.dm %invited) !=(ship our.bowl))
      (give-invites ship)
    ?-  -.q.diff
        ?(%del %add-react %del-react)  (di-give-writs-diff diff)
    ::
        %add
      =.  time.q.diff  (~(get by dex.pact.dm) p.diff)
      =*  memo  memo.q.diff
      =?  last-read.remark.dm  =(author.memo our.bowl)
        (add now.bowl (div ~s1 100))
      =.  recency.remark.dm  now.bowl
      =?  cor  &(!=(old-unread di-unread) !=(net.dm %invited))
        (give-unread ship/ship di-unread)
      ?:  from-self    (di-give-writs-diff diff)
      ?^  kind.q.diff  (di-give-writs-diff diff)
      =/  new-yarn
        %^  di-spin  ~
          :~  [%ship author.memo]
              ?:  =(net.dm %invited)  ' has invited you to a direct message'
              ': '
              ?:(=(net.dm %invited) '' (flatten:utils content.memo))
          ==
        ~
      =?  cor  (want-hark %to-us)
        (emit (pass-yarn new-yarn))
      =/  concern
        ?:  =(net.dm %invited)  [%invite ~]
        [%post p.diff now.bowl]
      =/  mention  (was-mentioned:utils content.memo our.bowl)
      =.  di-core  (di-activity concern content.memo mention)
      (di-give-writs-diff diff)
    ::
        %reply
      =*  delt  delta.q.diff
      =/  entry=(unit [=time =writ:c])  (get:di-pact p.diff)
      =?  meta.q.diff  !=(~ entry)  `meta.writ:(need entry)
      ?-  -.delt
          ?(%del %add-react %del-react)  (di-give-writs-diff diff)
          %add
        =*  memo  memo.delt
        =?  unread-threads.remark.dm  !=(our.bowl author.memo)
            (~(put in unread-threads.remark.dm) p.diff)
        =?  last-read.remark.dm  =(author.memo our.bowl)
          (add now.bowl (div ~s1 100))
        =.  recency.remark.dm  now.bowl
        =?  cor  &(!=(old-unread di-unread) !=(net.dm %invited))
          (give-unread ship/ship di-unread)
        ?:  =(our.bowl author.memo)  (di-give-writs-diff diff)
        ?~  entry  (di-give-writs-diff diff)
        =*  op  writ.u.entry
        =/  new-yarn
          %^  di-spin  /message/(scot %p p.id.op)/(scot %ud q.id.op)
            :~  [%ship author.memo]  ' replied to '
                [%emph (flatten:utils content.op)]  ': '
                [%ship author.memo]  ': '
                (flatten:utils content.memo)
            ==
          ~
        =?  cor  (want-hark %to-us)
          (emit (pass-yarn new-yarn))
        =/  top-con  [id.writ.u.entry time.writ.u.entry]
        =/  concern  [%reply [id.q.diff now.bowl] top-con]
        =/  mention  (was-mentioned:utils content.memo our.bowl)
        =.  di-core  (di-activity concern content.memo mention)
        (di-give-writs-diff diff)
      ==
    ==
  ::
  ++  di-take-counter
    |=  =diff:dm:c
    ?<  =(%archive net.dm)
    ?<  (~(has in blocked) ship)
    (di-ingest-diff diff)
  ::
  ++  di-post-notice
    |=  text=cord
    =/  =delta:writs:c  (make-notice ?:(from-self our.bowl ship) text)
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
    =.  cor
      (emit [%pass /contacts/heed %agent [our.bowl %contacts] %poke contact-action-0+!>([%heed ~[ship]])])
    =.  net.dm  %done
    (di-post-notice ' joined the chat')
  ::
  ++  di-watch
    |=  =path
    ^+  di-core
    ?>  =(src.bowl our.bowl)
    ?+  path  !!
      ~  di-core
      [%writs ~]  di-core
    ==
  ::
  ++  di-agent
    |=  [=wire =sign:agent:gall]
    ^+  di-core
    ?+    wire  ~|(bad-dm-take/wire !!)
        [%contacts %heed ~]
      ?>  ?=(%poke-ack -.sign)
      ?~  p.sign  di-core
      ::  TODO: handle?
      %-  (slog leaf/"Failed to add contact" u.p.sign)
      di-core
    ::
        [%hark ~]
      ?>  ?=(%poke-ack -.sign)
      ?~  p.sign  di-core
      ::  TODO: handle?
      %-  (slog leaf/"Failed to notify about dm {<ship>}" u.p.sign)
      di-core
    ::
        [%proxy *]
      ?>  ?=(%poke-ack -.sign)
      ?~  p.sign  di-core
      ::  if we already tried hard, this is the end of the road.
      ::
      ?:  ?=([%archaic ~] t.wire)
        %-  (slog leaf/"Failed to dm {<ship>} again" u.p.sign)
        di-core
      ::  if they're just known version mismatching, we should do nothing
      ::TODO  might want to mark the local msg as undelivered though...
      ::
      ?.  ?=(%await (read-status:neg bowl ship dap.bowl))
        %-  (slog leaf/"Failed to dm {<ship>}" u.p.sign)
        di-core
      ::  if a poke failed, but we also don't have a negotiated version for
      ::  them, they might still be on the old (pre-2024) chat backend. try
      ::  sending them an old-style poke if we can, for backcompat.
      ::  we do our best to recover the message from the wire.
      ::
      =.  cor
        =;  c=(unit cage)
          ?~  c  cor
          %+  emit  %pass
          [(weld di-area /proxy/archaic) %agent [ship %chat] %poke u.c]
        ?+  t.wire  ~
            [%rsvp @ ~]
          =/  ok=?  ;;(? (slav %f i.t.t.wire))
          `[%dm-rsvp !>(`rsvp:dm:old`[our.bowl ok])]
        ::
            [@ ?(~ [@ @ ~])]
          %-  some
          :-  %dm-diff
          !>  ^-  diff:dm:old
          ?~  t.t.wire
            =/  id=time  (slav %ud i.t.wire)
            :-  [our.bowl id]
            =/  msg=(unit [=time =writ:c])
              (get:di-pact our.bowl id)
            ?~  msg  [%del ~]
            :-  %add
            ^-  memo:old
            =,  writ.u.msg
            [~ author sent [%story ~ (verses-to-inlines content)]]
          =/  =id:c     [(slav %p i.t.wire) (slav %ud i.t.t.wire)]
          =/  rid=time  (slav %ud i.t.t.t.wire)
          =/  msg=(unit memo:d)
            %+  biff  (get:di-pact id)
            |=  [time =writ:c]
            ^-  (unit memo:d)
            ?~  id=(~(get by dex.pact.dm) our.bowl rid)  ~
            (bind (get:on:replies:c replies.writ u.id) tail)
          :-  [our.bowl rid]
          ?~  msg  [%del ~]
          :-  %add
          ^-  memo:old
          =,  u.msg
          [~ author sent [%story ~ (verses-to-inlines content)]]
        ==
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
        [%search %bounded kind=?(%text %mention) from=@ tries=@ nedl=@ ~]
      :^  ~  ~  %chat-scam
      !>  ^-  scam:c
      %^    ?-  kind.pole
              %text     text:tries-bound:search:di-pact
              %mention  mention:tries-bound:search:di-pact
            ==
          ?:  =(%$ from.pole)  ~
          `(slav %ud from.pole)
        (slav %ud tries.pole)
      ?-  kind.pole
        %text     (fall (slaw %t nedl.pole) nedl.pole)
        %mention  (slav %p nedl.pole)
      ==
    ::
        [%search %text skip=@ count=@ nedl=@ ~]
      %-  some
      %-  some
      :-  %chat-scan
      !>  ^-  scan:c
      %^    text:hits-bound:search:di-pact
          (slav %ud skip.pole)
        (slav %ud count.pole)
      (fall (slaw %t nedl.pole) nedl.pole)
    ::
        [%search %mention skip=@ count=@ nedl=@ ~]
      %-  some
      %-  some
      :-  %chat-scan
      !>  ^-  scan:c
      %^    mention:hits-bound:search:di-pact
          (slav %ud skip.pole)
        (slav %ud count.pole)
      (slav %p nedl.pole)
    ==
  ::
  ++  di-unread
    %+  unread:di-pact  our.bowl
    [recency last-read unread-threads]:remark.dm
  ++  di-remark-diff
    |=  diff=remark-diff:c
    ^+  di-core
    =?  cor  =(%read -.diff)
      %-  emil
      =+  .^(=carpet:ha %gx /(scot %p our.bowl)/hark/(scot %da now.bowl)/desk/groups/latest/noun)
      %+  murn
        ~(tap by cable.carpet)
      |=  [=rope:ha =thread:ha]
      ?.  =(/dm/(scot %p ship) ted.rope)  ~
      =/  =cage  hark-action-1+!>([%saw-rope rope])
      `(pass-hark cage)
    =.  remark.dm
      ?-  -.diff
        %watch    remark.dm(watching &)
        %unwatch  remark.dm(watching |)
        %read-at  !! ::  ca-core(last-read.remark.chat p.diff)
      ::
          %read
        ::  now.bowl should always be greater than the last message id
        ::  because ids are generated by us
        %=  remark.dm
          last-read  now.bowl
          unread-threads  *(set id:c)
        ==
      ==
    =.  cor  (give-unread ship/ship di-unread)
    di-core
  ++  di-pass
    |%
    ++  pass
      |=  [=wire =dock =task:agent:gall]
      ^-  card
      [%pass (welp di-area wire) %agent dock task]
    ++  poke-them  |=([=wire =cage] (pass wire [ship dap.bowl] %poke cage))
    ++  proxy-rsvp  |=(ok=? (poke-them /proxy/rsvp/(scot %f ok) chat-dm-rsvp+!>([our.bowl ok])))
    ++  proxy
      |=  =diff:dm:c
      =;  =wire
        (poke-them wire chat-dm-diff+!>(diff))
      ::  we put some details about the message into the wire, so that we may
      ::  re-try a send for backwards compatibility in some cases
      ::
      ?.  ?=(%reply -.q.diff)
        /proxy/(scot %ud q.p.diff)
      /proxy/(scot %p p.p.diff)/(scot %ud q.p.diff)/(scot %ud q.id.q.diff)
    --
  --
--
