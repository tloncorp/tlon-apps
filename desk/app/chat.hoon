/-  c=chat, g=groups
/-  meta
/-  ha=hark
/-  e=epic
/+  default-agent, verb-lib=verb, dbug
/+  chat-json
/+  pac=dm
/+  ch=chat-hark
/+  gra=graph-store
/+  epos-lib=saga
/+  wood-lib=wood
/+  mig=chat-graph
/*  desk-bill  %bill  /desk/bill
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  ++  def-flag  `flag:c`[~zod %test]
  ++  wood-state
    ^-  state:wood-lib
    :*  ver=|
        odd=&
        veb=|
    ==
  ++  club-eq  2 :: reverb control: max number of forwards for clubs
  ++  okay  `epic:e`0
  +$  current-state
    $:  %1
        chats=(map flag:c chat:c)
        dms=(map ship dm:c)
        clubs=(map id:club:c club:c)
        drafts=(map whom:c story:c)
        pins=(list whom:c)
        bad=(set ship)
        inv=(set ship)
        voc=(map [flag:c id:c] (unit said:c))
    ==
  --
=|  current-state
=*  state  -
=< 
  %+  verb-lib  &
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
+*  epos  ~(. epos-lib [bowl %chat-update okay])
    wood   ~(. wood-lib [bowl wood-state])
++  abet  [(flop cards) state]
++  cor   .
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))
++  give  |=(=gift:agent:gall (emit %give gift))
++  now-id   `id:c`[our now]:bowl
++  init
  ^+  cor
  watch-groups
::  +mar:  mark name
++  mar
  |%
  ++  act  `mark`(rap 3 %chat-action '-' (scot %ud okay) ~)
  ++  upd  `mark`(rap 3 %chat-update '-' (scot %ud okay) ~)
  --
::  +load: load next state
++  load
  |=  =vase
  |^  ^+  cor
  =/  maybe-old=(each [p=versioned-state q=epic:e] tang)
    (mule |.(!<([versioned-state epic:e] vase)))
  =/  [old=versioned-state cool=epic:e bad=?]
    ::  XX only save when epic changes
    ?.  ?=(%| -.maybe-old)  [p q &]:p.maybe-old
    =;  [sta=versioned-state ba=?]  [sta okay ba]
    =-  %+  fall  -  ~&  >  %bad-load  [state &]
    (mole |.([!<(versioned-state vase) |]))
  |-
  ?-  -.old
      %0
    %=  $
      old  (state-0-to-1 old)
    ==
      %1
    =.  state  old
    ?:  =(okay cool)  cor
    :: =?  cor  bad  (emit (keep !>(old)))
    %-  (note:wood %ver leaf/"New Epic" ~)
    =.  cor  (emil (drop load:epos))
    =/  chats  ~(tap in ~(key by chats))
    |-
    ?~  chats
      cor
    =.  cor
      ca-abet:ca-upgrade:(ca-abed:ca-core i.chats)
    $(chats t.chats)
  ==
  ::
  ++  keep
    |=  bad=^vase
    ^-  card
    ~&  >  %keep
    [%pass /keep/chat %arvo %k %fard q.byk.bowl %keep %noun bad]
 ::
 +$  versioned-state
    $%  state-0
        state-1
    ==
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
    ==
  ++  zero     zero:old:c
  +$  state-1  current-state
  ++  one      c
  ++  state-0-to-1
    |=  s=state-0
    ^-  state-1
    %*  .  *state-1
      dms     dms.s
      clubs   clubs.s
      drafts  drafts.s
      pins    pins.s
      bad     bad.s
      inv     inv.s
      voc     voc.s
      chats   (chats-0-to-1 chats.s)
    ==
  ++  chats-0-to-1
    |=  chats=(map flag:zero chat:zero)
    ^-  (map flag:one chat:one)
    %-  ~(run by chats)
    |=  =chat:zero
    %*  .  *chat:one
      remark  remark.chat
      log     log.chat
      perm    perm.chat
      pact    pact.chat
      ::
        net
      ?:  ?=(%load -.net.chat)
      ::  XX maybe should p.net be a (unit @p)?
        [%pub ~]
      ?.  ?=(%sub -.net.chat)  net.chat
      [%sub p.net.chat & [%chi ~]]
    ==
  --
::
++  watch-groups
  ^+  cor
  (emit %pass /groups %agent [our.bowl %groups] %watch /groups)
::
++  watch-epic
  |=  her=ship
  ^+  cor
  =/  =wire  /epic
  =/  =dock  [her dap.bowl]
  ?:  (~(has by wex.bowl) [wire dock])
    cor
  (emit %pass wire %agent [her dap.bowl] %watch /epic)
::
++  poke
  |=  [=mark =vase]
  |^  ^+  cor 
  ?+    mark  ~|(bad-poke/mark !!)
      %holt  (holt |)
      %graph-import
    (import-graph !<([flag:g flag:g graph:gra] vase))
  ::
      %dm-rsvp
    =+  !<(=rsvp:dm:c vase)
    di-abet:(di-rsvp:(di-abed:di-core ship.rsvp) ok.rsvp)
      %chat-pins
    =+  !<(ps=(list whom:c) vase)
    (pin ps)
  ::
      ?(%flag %channel-join)
    =+  !<(=flag:c vase)
    ?<  =(our.bowl p.flag)
    (join flag)
  ::
      %chat-leave
    =+  !<(=leave:c vase)
    ?<  =(our.bowl p.leave)  :: cannot leave chat we host
    ca-abet:ca-leave:(ca-abed:ca-core leave)
  ::
      %chat-draft
    =+  !<(=draft:c vase)
    ?>  =(src.bowl our.bowl)
    %_  cor
        drafts
       (~(put by drafts) p.draft q.draft)
    ==
  ::
      %chat-create
    =+  !<(req=create:c vase)
    (create req)
  ::
      ?(%chat-action-0 %chat-action)
    =+  !<(=action:c vase)
    =.  p.q.action  now.bowl
    =/  chat-core  (ca-abed:ca-core p.action)
    ?:  =(p.p.action our.bowl)
      ca-abet:(ca-update:chat-core q.action)
    ca-abet:(ca-proxy:chat-core q.action)
  ::
      %chat-remark-action
    =+  !<(act=remark-action:c vase)
    ?-  -.p.act
      %ship  di-abet:(di-remark-diff:(di-abed:di-core p.p.act) q.act)
      %flag  ca-abet:(ca-remark-diff:(ca-abed:ca-core p.p.act) q.act)
      %club  cor  :: TODO
    ==
  ::
      %dm-action
    =+  !<(=action:dm:c vase)
    di-abet:(di-proxy:(di-abed-soft:di-core p.action) q.action)
  ::
      %dm-diff
    =+  !<(=diff:dm:c vase)
    di-abet:(di-take-counter:(di-abed-soft:di-core src.bowl) diff)
  ::
      %club-create
    cu-abet:(cu-create:cu-core !<(=create:club:c vase))
  ::
      %club-action
    =+  !<(=action:club:c vase)
    =/  cu  (cu-abed p.action)
    cu-abet:(cu-diff:cu q.action)
  ::
      %dm-archive  di-abet:di-archive:(di-abed:di-core !<(ship vase))
  ==
  ++  join
    |=  =flag:c
    ^+  cor
    =.  chats  (~(put by chats) flag *chat:c)
    ca-abet:(ca-join:ca-core flag)
  ::
  ++  create
    |=  req=create:c
    ^+  cor
    =/  =flag:c  [our.bowl name.req]
    =|  =chat:c
    =/  =perm:c  [writers.req group.req]
    =.  perm.chat  perm
    =.  net.chat  [%pub ~]
    =.  chats  (~(put by chats) flag chat)
    ca-abet:(ca-init:(ca-abed:ca-core flag) req)
  ++  pin
    |=  ps=(list whom:c)
    =.  pins  ps
    cor
  ::
  ++  import-graph
    |=  [grp=flag:g =flag:g =graph:gra]
    ^+  cor
    =/  =pact:c  (convert:mig graph)
    =/  =net:c   pub/~
    =|  =remark:c
    =/  =perm:c  `grp
    =/  =diff:c  create/[perm `pact]
    =|  =log:c
    =.  log  (put:log-on:c log now.bowl diff)
    =/  =chat:c
      [net remark log perm pact]
    =.  chats  (~(put by chats) flag chat)
    cor  :: TODO: initialise? 
  --
++  watch
  |=  =(pole knot)
  ^+  cor
  ?+    pole  ~|(bad-watch-path/path !!)
      [%club %new ~]  ?>(from-self cor)
      [%briefs ~]  ?>(from-self cor)
      [%ui ~]  ?>(from-self cor)
      [%dm %invited ~]  ?>(from-self cor)
    ::
      [%epic ~]
    (give %fact ~ epic+!>(okay))
    ::
      [%said host=@ name=@ %msg sender=@ time=@ ~]
    =/  host=ship  (slav %p host.pole)
    =/  =flag:c     [host name.pole]
    =/  sender=ship  (slav %p sender.pole)
    =/  =id:c       [sender (slav %ud time.pole)]
    (watch-said flag id)
    ::
      [%chat ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    ca-abet:(ca-watch:(ca-abed:ca-core ship name.pole) rest.pole)
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
      [%epic ~]
    (take-epic sign)
  ::
      [%said host=@ name=@ %msg sender=@ time=@ ~]
    =/  host=ship    (slav %p host.pole)
    =/  =flag:c      [host name.pole]
    =/  sender=ship  (slav %p sender.pole)
    =/  =id:c        [sender (slav %ud time.pole)]
    (take-said flag id sign)
  ::
      [%dm ship=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    di-abet:(di-agent:(di-abed:di-core ship) rest.pole sign)
  ::
      [%club id=@ rest=*]
    =/  =id:club:c  (slav %uv id.pole)
    cu-abet:(cu-agent:(cu-abed id) rest.pole sign)

      [%chat ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    ca-abet:(ca-agent:(ca-abed:ca-core ship name.pole) rest.pole sign)
  ::
      [%hark ~]
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign  cor
    %-  (slog leaf/"Failed to hark" u.p.sign)
    cor
  ::
      [%groups ~]
    ?+    -.sign  !!
      %kick  watch-groups
    ::
        %watch-ack
      %.  cor
      ?~  p.sign  same
      =/  =tank
        leaf/"Failed groups subscription in {<dap.bowl>}, unexpected"
      (slog tank u.p.sign)
    ::
        %fact
      ?.  =(%group-action p.cage.sign)  cor
      (take-groups !<(=action:g q.cage.sign))
    ==
  ==
++  watch-said
  |=  [=flag:c =id:c]
  ?.  (~(has by chats) flag)
    (proxy-said flag id)
  ca-abet:(ca-said:(ca-abed:ca-core flag) id)
++  said-wire
  |=  [=flag:c =id:c]
  ^-  wire
  /said/(scot %p p.flag)/[q.flag]/msg/(scot %p p.id)/(scot %ud q.id)
::
++  take-said
  |=  [=flag:c =id:c =sign:agent:gall]
  ^+  cor
  ?+    -.sign  !!
      %watch-ack
    %.  cor
    ?~  p.sign  same
    (slog leaf/"Preview failed" u.p.sign)
  ::
      %kick
    ?:  (~(has by voc) [flag id])
      cor  :: subscription ended politely
    (proxy-said flag id)
  ::
      %fact
    =.  cor
      (give %fact ~[(said-wire flag id)] cage.sign)
    ?+    p.cage.sign  ~|(funny-mark/p.cage.sign !!)
        %chat-said
      =+  !<(=said:c q.cage.sign)
      =.  voc  (~(put by voc) [flag id] `said)
      cor
    ::
        %chat-denied
      =.  voc  (~(put by voc) [flag id] ~)
      cor
    ==
  ==
::
++  proxy-said
  |=  [=flag:c =id:c]
  =/  =dock  [p.flag dap.bowl]
  =/  wire  (said-wire flag id)
  =/  =card  [%pass wire %agent dock %watch wire]
  (emit card)
::
++  take-epic
  |=  =sign:agent:gall
  ^+  cor
  ?+    -.sign  cor
      %kick
    (watch-epic src.bowl)
  ::
      %fact
    ?.  =(%epic p.cage.sign)
      %-  (note:wood %odd leaf/"!!! weird fact on /epic" ~)
      cor
    =+  !<(=epic:e q.cage.sign)
    ?.  =(epic okay)  :: is now our guy
      cor
    %+  roll  ~(tap by chats)
    |=  [[=flag:g =chat:c] out=_cor]
    ?.  =(src.bowl p.flag)
      out
    ca-abet:(ca-take-epic:(ca-abed:ca-core:out flag) epic)
  ::
      %watch-ack
    %.  cor
    ?~  p.sign  same
    (note:wood %odd leaf/"weird watch nack" u.p.sign)
  ==
::  TODO: more efficient?
::    perhaps a cached index of (jug group=flag chat=flag)
++  take-groups
  |=  =action:g
  =/  affected=(list flag:c)
    %+  murn  ~(tap by chats)
    |=  [=flag:c =chat:c]
    ?.  =(p.action group.perm.chat)  ~
    `flag
  ?+    q.q.action  cor
      [%fleet * %del ~]
    %-  (note:wood %veb leaf/"revoke perms for {<affected>}" ~)
    %+  roll  affected
    |=  [=flag:c co=_cor]
    ^+  cor
    %+  roll  ~(tap in p.q.q.action)
    |=  [=ship ci=_cor]
    ^+  cor
    =/  ca  (ca-abed:ca-core:ci flag)
    ca-abet:(ca-revoke:ca ship)
  ::
      [%fleet * %del-sects *]
    %-  (note:wood %veb leaf/"recheck permissions for {<affected>}" ~)
    %+  roll  affected
    |=  [=flag:c co=_cor]
    =/  ca  (ca-abed:ca-core:co flag)
    ca-abet:ca-recheck:ca
  ::
      [%channel * %del-sects *]
    %-  (note:wood %veb leaf/"recheck permissions for {<affected>}" ~)
    %+  roll  affected
    |=  [=flag:c co=_cor]
    =/  ca  (ca-abed:ca-core:co flag)
    ca-abet:ca-recheck:ca
  ==
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
    [%x %chat ~]  ``flags+!>(~(key by chats))
  ::
    [%x %chats ~]  ``chats+!>(chats)
  ::
    [%x %pins ~]  ``chat-pins+!>(pins)
  ::
      [%x %chat @ @ *]
    =/  =ship  (slav %p i.t.t.path)
    =*  name   i.t.t.t.path
    (ca-peek:(ca-abed:ca-core ship name) t.t.t.t.path)
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
    (di-peek:(di-abed:di-core ship) t.t.t.path)
  ::
      [%x %club @ *]
    (cu-peek:(cu-abed (slav %uv i.t.t.path)) t.t.t.path)
  ::
      [%x %draft @ $@(~ [@ ~])]
    =/  =whom:c
      ?^  t.t.t.path
        flag+[(slav %p i.t.t.path) i.t.t.t.path]
      %+  rash
      i.t.t.path
    ;~  pose
      (stag %ship ;~(pfix sig fed:ag))
      (stag %club club-id-rule:dejs:chat-json)
    ==
    =-  ``chat-draft+!>(-)
    `draft:c`[whom (~(gut by drafts) whom *story:c)]
  ::
      [%x %briefs ~]
    =-  ``chat-briefs+!>(-)
    ^-  briefs:c
    %-  ~(gas by *briefs:c)
    %+  welp
      %+  turn  ~(tap in ~(key by clubs))
      |=  =id:club:c
      =/  cu  (cu-abed id)
      [club/id cu-brief:cu]
    %+  welp  
      %+  murn  ~(tap in ~(key by dms))
      |=  =ship
      =/  di  (di-abed:di-core ship)
      ?:  ?=(?(%invited %archive) net.dm.di)  ~
      ?:  =([~ ~] pact.dm.di)  ~
      `[ship/ship di-brief:di]
    %+  turn  ~(tap in ~(key by chats))
    |=  =flag:c
    :-  flag/flag
    ca-brief:(ca-abed:ca-core flag)
  ==
::
++  holt
  |=  tell=?
  ^+  cor
  =.  state  *current-state
  =.  cor
    %-  emil
    %+  turn  ~(tap in ~(key by wex.bowl))
    |=  [=wire =ship =term] 
    ^-  card
    [%pass wire %agent [ship term] %leave ~]
  =.  cor  init
  ?.  tell  cor
  %-  emil
  %+  murn  `(list dude:gall)`desk-bill
  |=  =dude:gall
  ^-  (unit card)
  ?:  =(dude dap.bowl)  ~
  `[%pass / %agent [our.bowl dude] %poke holt+!>(~)]
::
++  give-brief
  |=  [=whom:c =brief:briefs:c]
  (give %fact ~[/briefs] chat-brief-update+!>([whom brief]))
::
++  pass-hark
  |=  [all=? desk=? =yarn:ha]
  ^-  card
  =/  =wire  /hark
  =/  =dock  [our.bowl %hark]
  =/  =cage  hark-action+!>([%add-yarn all desk yarn])
  [%pass wire %agent dock %poke cage]
++  spin
  |=  [=rope:ha con=(list content:ha) wer=path but=(unit button:ha)]
  ^-  yarn:ha
  =/  id  (end [7 1] (shax eny.bowl))
  [id rope now.bowl con wer but]
++  flatten
  |=  content=(list inline:c)
  ^-  cord
  %-  crip
  %-  zing
  %+  turn
    content
  |=  c=inline:c
  ^-  tape
  ?@  c  (trip c)
  ?-  -.c
      %break  ""
      %tag    (trip p.c)
      %block  (trip q.c)
      %link   (trip q.c)
      %ship   (scow %p p.c)
      ?(%code %inline-code)  ""
      ?(%italics %bold %strike %blockquote)  (trip (flatten p.c))
  ==
++  from-self  =(our src):bowl
++  cu-abed  cu-abed:cu-core
::
++  cu-core
  |_  [=id:club:c =club:c gone=_|]
  +*  cu-pact  ~(. pac pact.club)
  ++  cu-core  .
  ++  cu-abet  
  =.  clubs
    ?:  gone
      (~(del by clubs) id)
    (~(put by clubs) id club)
  cor
  ++  cu-abed
    |=  i=id:club:c
    ~|  no-club/i
    cu-core(id i, club (~(gut by clubs) i *club:c))
  ++  cu-out  (~(del in cu-circle) our.bowl)
  ++  cu-circle
    (~(uni in team.club) hive.club)
  ::
  ++  cu-area  `wire`/club/(scot %uv id)
  ::
  ++  cu-spin  
    |=  [con=(list content:ha) but=(unit button:ha)]
    ::  hard coded desk because these shouldn't appear in groups
    =/  rope  [~ ~ %talk /club/(scot %uv id)]
    =/  link  /dm/(scot %uv id)
    (spin rope con link but)
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
      [*pact:c (silt our.bowl ~) hive.create *data:meta net |]
    cu-core(id id.create, club clab)
  ::
  ++  cu-brief  (brief:cu-pact [our now]:bowl)
  ::
  ++  cu-create  
    |=  =create:club:c 
    =.  cu-core  (cu-init %done create)
    =.  cu-core  (cu-diff 0 [%init team hive met]:club)
    =/  =notice:c
      :-  ''
      (rap 3 ' started a group chat with ' (scot %ud ~(wyt in hive.create)) ' other members' ~)
    =.  cor  (give-brief club/id cu-brief)
    =.  cu-core
      (cu-diff 0 [%writ now-id %add ~ our.bowl now.bowl notice/notice])
    cu-core
  ::
  ::  NB: need to be careful not to forward automatically generated
  ::  messages like this, each node should generate its own notice
  ::  messages, and never forward. XX: defend against?
  ++  cu-post-notice
    |=  [=ship =notice:c]
    =/  =id:c
      [ship now.bowl]
    =/  w-d=diff:writs:c  [id %add ~ ship now.bowl notice/notice]
    =.  pact.club  (reduce:cu-pact now.bowl w-d)
    (cu-give-writs-diff w-d)
  ::
  ++  cu-give-delta
    |=  =delta:club:c
    =.  cor
      =/  =cage  club-delta+!>(delta)
      (emit %give %fact ~[(snoc cu-area %ui)] cage)
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
    |=  [=echo:club:c =delta:club:c]
    ::  ?>  (~(has in cu-circle) src.bowl)  :: TODO: signatures?? probably overkill
    =?  cor  (lth echo club-eq)
      (emil (gossip:cu-pass +(echo) delta))
    ?-    -.delta
    ::
        %init
      =:  hive.club  hive.delta
          team.club  team.delta
          met.club   met.delta
      ==
      =/  cage  club-invite+!>([id (tail delta)])
      =.  cor  (emit %give %fact ~[`wire`/club/new] cage)
      cu-core
    ::
        %meta
      =.  met.club  meta.delta
      =.  cu-core  (cu-give-delta delta)
      cu-core
    ::
        %writ
      =.  pact.club  (reduce:cu-pact now.bowl diff.delta)
      =.  cu-core  (cu-give-writs-diff diff.delta)
      ?-  -.q.diff.delta  
          ?(%del %add-feel %del-feel)  cu-core
          %add
        =/  memo=memo:c  p.q.diff.delta
        ?:  =(our.bowl author.memo)  cu-core
        ?-  -.content.memo
            %notice  cu-core
            %story
          =/  yarn
            %+  cu-spin 
              :~  [%ship author.memo]
                  ': '
                  (flatten q.p.content.memo)
              ==
            ~
          =.  cor  (emit (pass-hark & & yarn))
          cu-core
        ==
      ==
    ::
        %team
      =*  ship  ship.delta
      =.  cu-core  (cu-give-delta delta)
      ?:  &(!ok.delta (~(has in team.club) ship))
        ?.  =(our src):bowl
          cu-core
        cu-core(gone &)
      ?.  (~(has in hive.club) ship)
        cu-core
      =.  hive.club  (~(del in hive.club) ship)
      ?.  ok.delta
        (cu-post-notice ship '' ' declined the invite')
      =.  cor  (give-brief club/id cu-brief)
      =.  team.club  (~(put in team.club) ship)
      (cu-post-notice ship '' ' joined the chat')
    ::
        %hive
      =.  cu-core  (cu-give-delta delta)
      ?:  add.delta
        ?:  (~(has in hive.club) for.delta)
          cu-core
        =.  hive.club   (~(put in hive.club) for.delta)
        =.  cor
          (emit (act:cu-pass for.delta club-eq %init [team hive met]:club))
        :: TODO include inviter's name in message? requires rework of
        :: notice messages though :(
        (cu-post-notice for.delta '' ' was invited to the chat') 
      ?.  (~(has in hive.club) for.delta)
        cu-core
      =.  hive.club  (~(del in hive.club) for.delta)
      (cu-post-notice for.delta '' ' was uninvited from the chat') 
    ==
  ::
  ++  cu-peek
    |=  =path
    ^-  (unit (unit cage))
    ?+  path  [~ ~]
      [%writs *]  (peek:cu-pact t.path)
      [%crew ~]   ``club-crew+!>(+.club)
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
++  ca-core
  |_  [=flag:c =chat:c gone=_|]
  +*  ca-pact  ~(. pac pact.chat)
  ++  ca-core  .
  ::  TODO: archive??
  ++  ca-abet  
    %_  cor
        chats  
      ?:(gone (~(del by chats) flag) (~(put by chats) flag chat))
    ==
  ++  ca-abed
    |=  f=flag:c
    ca-core(flag f, chat (~(got by chats) f))
  ++  ca-area  `path`/chat/(scot %p p.flag)/[q.flag]
  ++  ca-spin  
    |=  [rest=path con=(list content:ha) but=(unit button:ha)]
    =*  group  group.perm.chat
    =/  =nest:g  [dap.bowl flag]
    =/  rope  [`group `nest q.byk.bowl (welp /(scot %p p.flag)/[q.flag] rest)]
    =/  link  
      (welp /groups/(scot %p p.group)/[q.group]/channels/chat/(scot %p p.flag)/[q.flag] rest)
    (spin rope con link but)
  ::
  ++  ca-watch
    |=  =(pole knot)
    ^+  ca-core
    ?+    pole  !!
        [%updates rest=*]  (ca-pub rest.pole)
        [%ui ~]            ?>(from-self ca-core)
        [%ui %writs ~]     ?>(from-self ca-core)
    ::
        [%said ship=@ time=@ *]
      =/  =ship  (slav %p ship.pole)
      =/  =time  (slav %ud time.pole)
      (ca-said ship time)
    ::
    ==
  ::
  ++  ca-said
    |=  =id:c
    |^  ^+  ca-core
    ?.  (ca-can-read src.bowl)
      (give-kick chat-denied+!>(~))
    =/  [=time =writ:c]  (got:ca-pact id)
    %+  give-kick  %chat-said
    !>  ^-  said:c
    [flag writ]
    ++  give-kick
      |=  =cage
      =.  cor  (give %fact ~ cage)
      =.  cor  (give %kick ~ ~)
      ca-core
    --
  ::
  ++  ca-upgrade
    ^+  ca-core
    ?.  ?=(%sub -.net.chat)  ca-core
    ?.  ?=(%dex -.saga.net.chat)  ca-core
    ?.  =(okay ver.saga.net.chat)  
      %-  (note:wood %ver leaf/"%future-shock {<[ver.saga.net.chat flag]>}" ~)
      ca-core
    ca-make-chi
  ::
  ++  ca-pass
    |%
    ++  add-channel
      |=  req=create:c
      =/  =dock      [p.group.req %groups]
      =/  =nest:g    [dap.bowl flag]
      =/  =channel:g  
        =,(req [[title description '' ''] now.bowl %default | readers])
      =/  =action:g  [group.req now.bowl %channel nest %add channel]
      =/  =cage      group-action+!>(action)
      =/  =wire      (snoc ca-area %create)
      =/  =card
        [%pass ca-area %agent dock %poke cage]
      =.  cor
        (emit card)
      ca-core
    ::
    --
  ++  ca-init
    |=  req=create:c
    =/  =perm:c  [writers.req group.req]
    =.  cor
      (give-brief flag/flag ca-brief)
    =.  ca-core  (ca-update now.bowl %create perm ~)
    (add-channel:ca-pass req)
  ::
  ++  ca-agent
    |=  [=(pole knot) =sign:agent:gall]
    ^+  ca-core
    ?+    pole  !!
        ~  :: noop wire, should only send pokes
      ca-core
    ::
        [%updates ~]
      (ca-take-update sign)
    ::
        [%create ~]
      ?>  ?=(%poke-ack -.sign)
      %.  ca-core  :: TODO rollback creation if poke fails?
      ?~  p.sign  same
      (slog leaf/"poke failed" u.p.sign)
    ::
    ==
  ::
  ++  ca-brief  (brief:ca-pact our.bowl last-read.remark.chat)
  ::
  ++  ca-peek
    |=  =(pole knot)
    ^-  (unit (unit cage))
    ?+  pole  [~ ~]
      [%writs rest=*]  (peek:ca-pact rest.pole)
      [%perm ~]        ``chat-perm+!>(perm.chat)
    ==
  ::
  ++  ca-revoke
    |=  her=ship
    %+  roll  ~(tap in ca-subscriptions)
    |=  [[=ship =path] ca=_ca-core]
    ?.  =(ship her)  ca
    ca(cor (emit %give %kick ~[path] `ship))
  ::
  ++  ca-recheck
    %+  roll  ~(tap in ca-subscriptions)
    |=  [[=ship =path] ca=_ca-core]
    ?:  (ca-can-read:ca ship)  ca
    ca(cor (emit %give %kick ~[path] `ship))
  ::
  ++  ca-take-update
    |=  =sign:agent:gall
    ^+  ca-core
    ?+    -.sign  ca-core
        %kick
      ?>  ?=(%sub -.net.chat)
      ?:  =(%chi -.saga.net.chat)
        %-  (note:wood %ver leaf/"chi-kick: {<flag>}" ~)
        ca-sub
      %-  (note:wood %ver leaf/"wait-kick: {<flag>}" ~)
      ca-core
    ::
        %watch-ack
      =.  net.chat  [%sub src.bowl & %chi ~]
      ?~  p.sign  ca-core
      %-  (slog leaf/"Failed subscription" u.p.sign)
      =.  gone  &
      ca-core
    ::
        %fact
      =*  cage  cage.sign 
      ?+  p.cage  (ca-odd-update p.cage)
        %epic                           (ca-take-epic !<(epic:e q.cage))
        ?(%chat-logs %chat-logs-0)      (ca-apply-logs !<(logs:c q.cage))
        ?(%chat-update %chat-update-0)  (ca-update !<(update:c q.cage))
      ==
    ==
  ::
  ++  ca-odd-update
    |=  =mark
    ?.  (is-old:epos mark)
      ca-core
    ?.  ?=(%sub -.net.chat)
      ca-core
    ca-make-lev
  ::
  ++  ca-make-lev
    ?.  ?=(%sub -.net.chat)
       ca-core
    %-  (note:wood %ver leaf/"took lev epic: {<flag>}" ~)
    =.  saga.net.chat  lev/~
    =.  cor  (watch-epic p.flag)
    ca-core
  ::
  ++  ca-make-chi
    ?.  ?=(%sub -.net.chat)  ca-core
    %-  (note:wood %ver leaf/"took okay epic: {<flag>}" ~)
    =.  saga.net.chat  chi/~
    ?:  ca-has-sub  ca-core
    ca-sub
  ::
  ++  ca-take-epic
    |=  her=epic:e
    ^+  ca-core
    ?>  ?=(%sub -.net.chat)
    ?:  =(her okay)
      ca-make-chi
    ?:  (gth her okay)
      =.  saga.net.chat  dex/her
      %-  (note:wood %ver leaf/"took dex epic: {<[flag her]>}" ~)
      ca-core
    ca-make-lev
  ::
  ++  ca-proxy
    |=  =update:c
    ^+  ca-core
    ?>  ca-can-write
    =/  =dock  [p.flag dap.bowl]
    =/  =cage  [act:mar !>([flag update])]
    =.  cor
      (emit %pass ca-area %agent dock %poke cage)
    ca-core
  ::
  ++  ca-groups-scry
    =*  group  group.perm.chat
    /(scot %p our.bowl)/groups/(scot %da now.bowl)/groups/(scot %p p.group)/[q.group]
  ::
  ++  ca-can-write
    ?:  =(p.flag src.bowl)  &
    =/  =path
      %+  welp  ca-groups-scry
      /fleet/(scot %p src.bowl)/vessel/noun
    =+  .^(=vessel:fleet:g %gx path)
    ?:  =(~ writers.perm.chat)  &
    !=(~ (~(int in writers.perm.chat) sects.vessel))
  ::
  ++  ca-can-read
    |=  her=ship
    =/  =path
      %+  welp  ca-groups-scry
      /channel/[dap.bowl]/(scot %p p.flag)/[q.flag]/can-read/(scot %p her)/loob
    .^(? %gx path)
  ::
  ++  ca-pub
    |=  =path
    ^+  ca-core
    ?>  (ca-can-read src.bowl)
    =/  =logs:c
      ?~  path  log.chat
      =/  =time  (slav %da i.path)
      (lot:log-on:c log.chat `time ~)
    =/  =cage  chat-logs+!>(logs)
    =.  cor  (give %fact ~ cage)
    ca-core
  ::
  ++  ca-has-sub
    ^-  ?
    (~(has by wex.bowl) [(snoc ca-area %updates) p.flag dap.bowl])
  ::
  ++  ca-sub
    ^+  ca-core
    =/  tim=(unit time)
      (bind (ram:log-on:c log.chat) head)
    =/  base=wire  (snoc ca-area %updates)
    =/  =path 
      %+  weld  base
      ?~  tim  ~
      /(scot %da u.tim)
    =/  =card
      [%pass base %agent [p.flag dap.bowl] %watch path]
    =.  cor  (emit card)
    ca-core
  ++  ca-join
    |=  f=flag:c
    ^+  ca-core
    =.  chats  (~(put by chats) f *chat:c)
    =.  ca-core  (ca-abed f)
    =.  cor  (give-brief flag/flag ca-brief)
    ca-sub
  ::
  ++  ca-leave
    =/  =dock  [p.flag dap.bowl]
    =/  =wire  (snoc ca-area %updates)
    =.  cor  (emit %pass wire %agent dock %leave ~)
    =.  cor  (emit %give %fact ~[/briefs] chat-leave+!>(flag))
    =.  gone  &
    ca-core
  ::
  ++  ca-apply-logs
    |=  =logs:c
    ^+  ca-core
    =/  updates=(list update:c)
      (tap:log-on:c logs)
    %+  roll  updates
    |=  [=update:c ca=_ca-core]
    (ca-update:ca update)
  ::
  ++  ca-subscriptions
    %+  roll  ~(val by sup.bowl)
    |=  [[=ship =path] out=(set [ship path])]
    ?.  =((scag 4 path) (snoc ca-area %updates))
      out
    (~(put in out) [ship path])
  ::
  ++  ca-give-updates
    |=  [=time d=diff:c]
    ^+  ca-core
    =/  paths=(set path)
      %-  ~(gas in *(set path))
      (turn ~(tap in ca-subscriptions) tail)
    =.  paths  (~(put in paths) (snoc ca-area %ui))
    =/  cag=cage  [upd:mar !>([time d])]
    =.  cor
      (give %fact ~(tap in paths) cag)
    =.  cor  (give %fact ~[/ui] act:mar !>([flag [time d]]))
    =?  cor  ?=(%writs -.d)
      =/  =cage  writ-diff+!>(p.d)
      (give %fact ~[(welp ca-area /ui/writs)] writ-diff+!>(p.d))
    ca-core
  ::
  ++  ca-remark-diff
    |=  diff=remark-diff:c
    ^+  ca-core
    =.  cor
      (give %fact ~[(snoc ca-area %ui)] chat-remark-action+!>([flag diff]))
    =.  remark.chat
      ?-  -.diff
        %watch    remark.chat(watching &)
        %unwatch  remark.chat(watching |)
        %read-at  !! ::  ca-core(last-read.remark.chat p.diff)
      ::
          %read   remark.chat(last-read now.bowl)
  ::    =/  [=time =writ:c]  (need (ram:on:writs:c writs.chat))
  ::    =.  last-read.remark.chat  time
  ::    ca-core
      ==
    =.  cor
      (give-brief flag/flag ca-brief)
    ca-core
  ::
  ++  ca-update
    |=  [=time d=diff:c]
    ?>  ca-can-write
    ^+  ca-core
    =.  log.chat
      (put:log-on:c log.chat time d)
    =.  ca-core
      (ca-give-updates time d)
    =.  cor
      (give-brief flag/flag ca-brief)
    ?-    -.d
        %add-sects
      =*  p  perm.chat
      =.  writers.p  (~(uni in writers.p) p.d)
      ca-core
    ::
        %del-sects
      =*  p  perm.chat
      =.  writers.p  (~(dif in writers.p) p.d)
      ca-core
    ::
        %create
      =.  perm.chat  p.d
      ca-core
    ::
        %writs
      =.  pact.chat  (reduce:ca-pact time p.d)
      ?-  -.q.p.d  
          ?(%del %add-feel %del-feel)  ca-core
          %add
        =/  memo=memo:c  p.q.p.d
        ?-  -.content.memo
            %notice  ca-core
            %story
          ?~  replying.memo  ca-core
          =/  op  (~(get pac pact.chat) u.replying.memo)
          ?~  op  ca-core
          =/  opwrit  writ.u.op
          =/  in-replies
            %+  lien
              ~(tap in replied.opwrit)
            |=  =id:c
            =/  writ  (~(get pac pact.chat) id)
            ?~  writ  %.n
            =(author.writ.u.writ our.bowl)
          ?:  |(=(author.memo our.bowl) !in-replies)  ca-core  
          ?-  -.content.opwrit
              %notice  ca-core
              %story          
            =/  yarn
              %^  ca-spin
                /message/(scot %p p.u.replying.memo)/(scot %ud q.u.replying.memo)
                :~  [%ship author.memo]
                    ' replied to your message “'
                    (flatten q.p.content.opwrit)
                    '”: '
                    [%ship author.memo]
                    ': '
                    (flatten q.p.content.memo)
                ==
              ~
            =.  cor  (emit (pass-hark & & yarn))
            ca-core
          ==
        ==
      ==
    ==
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
    =/  new=?  (~(has by dms) s)
    =/  d
      %+  ~(gut by dms)  s
      =|  =remark:c
      =.  watching.remark  &
      [*pact:c remark ?:(=(src our):bowl %inviting %invited) |]
    =?  di-core  &(new !=(src our):bowl)
      di-invited
    di-core(ship s, dm d)

  ++  di-area  `path`/dm/(scot %p ship)
  ++  di-spin  
    |=  [con=(list content:ha) but=(unit button:ha)]
    ::  hard coded desk because these shouldn't appear in groups
    =/  rope  [~ ~ %talk /dm/(scot %p ship)]
    =/  link  /dm/(scot %p ship)
    (spin rope con link but)
  ::
  ++  di-proxy
    |=  =diff:dm:c
    =.  di-core  (di-ingest-diff diff)
    =.  cor  (emit (proxy:di-pass diff))
    di-core
  ::
  ++  di-invited
    ^+  di-core
    =.  cor
      (emit (hark:di-pass invited:di-hark))
    di-core
  ::
  ++  di-notify
    |=  [=id:c =delta:writs:c]
    ^+  di-core
    ?.  watching.remark.dm  di-core
    ?:  =(our.bowl p.id)  di-core
    ?:  =(%invited net.dm)  di-core
    ?+  -.delta  di-core
        %add
      ?.  ?=(%story -.content.p.delta)  di-core
      =.  cor  
        (emit (hark:di-pass (story:di-hark id p.content.p.delta)))
      di-core
    ==
  ++  di-archive
    =.  net.dm  %archive
    (di-post-notice '' ' archived the channel')
  ::
  ++  di-ingest-diff
    |=  =diff:dm:c
    =/  =path  (snoc di-area %ui)
    =.  cor  (emit %give %fact ~[path] writ-diff+!>(diff))
    =/  old-brief  di-brief
    =.  pact.dm  (reduce:di-pact now.bowl diff)
    =?  cor  &(!=(old-brief di-brief) !=(net.dm %invited))
      (give-brief ship/ship di-brief)
    =?  cor  &(=(net.dm %invited) !=(ship our.bowl))
      (give-invites ship)
    =.  di-core  
      (di-notify diff)
    ?:  from-self  di-core
    ?-  -.q.diff  
        ?(%del %add-feel %del-feel)  di-core
        %add
      =/  memo=memo:c  p.q.diff
      ?-  -.content.memo
          %notice  di-core
          %story
        =/  yarn
          %+  di-spin 
            :~  [%ship author.memo]
                ?:  =(net.dm %invited)  ' has invited you to a direct message: “'
                ': '
                (flatten q.p.content.memo)
                ?:(=(net.dm %invited) '”' '')
            ==
          ~
        =.  cor  (emit (pass-hark & & yarn))
        di-core
      ==
    ==
  ::
  ++  di-take-counter
    |=  =diff:dm:c
    ?<  =(%archive net.dm)
    (di-ingest-diff diff)
  ::
  ++  di-post-notice
    |=  n=notice:c
    (di-ingest-diff [our now]:bowl %add ~ src.bowl now.bowl %notice n)
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
    (di-post-notice '' ' joined the chat')
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
        [%proxy ~]
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
    |=  =path
    ^-  (unit (unit cage))
    ?+  path  [~ ~]
      [%writs *]  (peek:di-pact t.path)
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
    ++  hark
      |=  =cage
      (pass /hark [our.bowl %hark-store] %poke cage)
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
