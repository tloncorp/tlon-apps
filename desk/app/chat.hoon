/-  c=chat, g=groups
/+  default-agent, verb, dbug
/+  chat-json
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  ++  def-flag  `flag:c`[~zod %test]
  +$  state-0
    $:  %0
        chats=(map flag:c chat:c)
    ==
  --
=|  state-0
=*  state  -
=< 
  %+  verb  &
  %-  agent:dbug
  |_  =bowl:gall
  +*  this  .
      def   ~(. (default-agent this %|) bowl)
      cor   ~(. +> [bowl ~])
  ++  on-init  
    ^-  (quip card _this)
    `this
  ::
  ++  on-save  !>(state)
  ++  on-load
    |=  =vase
    ^-  (quip card _this)
    =/  old=(unit state-0)
      (mole |.(!<(state-0 vase)))  
    ?^  old  `this(state u.old)
    ~&  >>>  "Incompatible load, nuking"
    =^  cards  this  on-init
    :_  this
    =-  (welp - cards)
    %+  turn  ~(tap in ~(key by wex.bowl))
    |=  [=wire =ship =term] 
    ^-  card
    [%pass wire %agent [ship term] %leave ~]
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
++  abet  [(flop cards) state]
++  cor   .
++  emit  |=(=card cor(cards [card cards]))
++  give  |=(=gift:agent:gall (emit %give gift))
++  poke
  |=  [=mark =vase]
  |^  ^+  cor 
  ?+    mark  ~|(bad-poke/mark !!)
      %flag
    =+  !<(=flag:c vase)
    ?<  =(our.bowl p.flag)
    (join flag)
  ::
      %chat-create
    =+  !<(req=create:c vase)
    (create req)
  ::
      %chat-action
    =+  !<(=action:c vase)
    =.  p.q.action  now.bowl
    =/  chat-core  (ca-abed:ca-core p.action)
    ?:  =(p.p.action our.bowl)
      ca-abet:(ca-update:chat-core q.action)
    ca-abet:(ca-proxy:chat-core q.action)
  ::
      %chat-remark-action
    =+  !<(act=remark-action:c vase)
    ca-abet:(ca-remark-diff:(ca-abed:ca-core p.act) q.act)
  ==
  ::
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
    =/  =perm:c  [~ group.req]
    =.  perm.chat  perm
    =.  net.chat  [%pub ~]
    =.  chats  (~(put by chats) flag chat)
    ca-abet:(ca-init:(ca-abed:ca-core flag) req)
  --
++  watch
  |=  =path
  ^+  cor
  ?+    path  ~|(bad-watch-path/path !!)
    [%chat ~]  cor
  ::
      [%chat @ @ *]
    =/  =ship  (slav %p i.t.path)
    =*  name   i.t.t.path
    ca-abet:(ca-watch:(ca-abed:ca-core ship name) t.t.t.path)
  ==
::
++  agent
  |=  [=wire =sign:agent:gall]
  ^+  cor
  ?+    wire  ~|(bad-agent-wire/wire !!)
      [%chat @ @ *]
    =/  =ship  (slav %p i.t.wire)
    =*  name   i.t.t.wire
    ca-abet:(ca-agent:(ca-abed:ca-core ship name) t.t.t.wire sign)
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
      [%x %chat @ @ *]
    =/  =ship  (slav %p i.t.t.path)
    =*  name   i.t.t.t.path
    (ca-peek:(ca-abed:ca-core ship name) t.t.t.t.path)
  ==
::
++  from-self  =(our src):bowl
::
++  ca-core
  |_  [=flag:c =chat:c]
  ++  ca-core  .
  ++  ca-abet  
    cor(chats (~(put by chats) flag chat))
  ++  ca-abed
    |=  f=flag:c
    ca-core(flag f, chat (~(got by chats) f))
  ++  ca-area  `path`/chat/(scot %p p.flag)/[q.flag]
  ++  ca-watch
    |=  =path
    ^+  ca-core
    ?+    path  !!
      [%updates *]  (ca-pub t.path)
      [%ui ~]       ?>(from-self ca-core)
    ::
    ==
  ++  ca-pass
    |%
    ++  add-channel
      |=  req=create:c
      =/  =dock      [p.group.req %groups]
      =/  =channel:g  
        =,(req [[title description ''] now.bowl readers])
      =/  =action:g  [group.req now.bowl %channel flag %add channel]
      =/  =cage      group-action+!>(action)
      =/  =wire      (snoc ca-area %create)
      =/  =card
        [%pass ca-area %agent dock %poke cage]
      =.  cor
        (emit card)
      ca-core
    --
  ++  ca-init
    |=  req=create:c
    (add-channel:ca-pass req)
  ::
  ++  ca-agent
    |=  [=wire =sign:agent:gall]
    ^+  ca-core
    ?+  wire  !!
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
    ==
  ::
  ++  ca-peek
    |=  =(pole knot)
    ^-  (unit (unit cage))
    ?+    pole  [~ ~]
    ::
        [%writs %newest count=@ ~]
      =/  count  (slav %ud count.pole)
      ``chat-writs-list+!>((turn (scag count (tap:writs-on:c writs.chat)) tail))
    ::
        [%writs %older start=@ count=@ ~]
      =/  count  (slav %ud count.pole)
      =/  start  (slav %da start.pole)
      ``chat-writs+!>((turn (tab:writs-on:c writs.chat `start count) tail))
    ::
        [%writs %writ writ=@ ~]
      =/  writ  (slav %da writ.pole)
      ``writ+!>((got:writs-on:c writs.chat writ))
    ::
        [%perm ~]
      ``chat-perm+!>(perm.chat)
    ==
  ::
  ++  ca-take-update
    |=  =sign:agent:gall
    ^+  ca-core
    ?+    -.sign  ca-core
      %kick  ca-sub
    ::
        %watch-ack
      =.  net.chat  [%sub src.bowl]
      %.  ca-core
      ?~  p.sign  same
      (slog leaf/"Failed subscription" u.p.sign)
    ::
        %fact
      =*  cage  cage.sign 
      ?+  p.cage  ca-core
        %chat-logs    (ca-apply-logs !<(logs:c q.cage))
        %chat-update  (ca-update !<(update:c q.cage))
      ==
    ==
  ++  ca-proxy
    |=  =update:c
    ^+  ca-core
    ?>  ca-can-write
    =/  =dock  [p.flag dap.bowl]
    =/  =cage  chat-action+!>([flag update])
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
      /fleet/(scot %p src.bowl)/vessel
    =+  .^(=vessel:fleet:g %gx path)
    ?:  =(~ writers.perm.chat)  &
    !=(~ (~(int in writers.perm.chat) sects.vessel))
  ::
  ++  ca-can-read
    =/  =path
      %+  welp  ca-groups-scry
      /channel/(scot %p p.flag)/[q.flag]/can-read/(scot %p src.bowl)/loob
    .^  ?
      %gx
      (scot %p our.bowl)
      %groups
      (scot %da now.bowl)
      path
    ==
  ::
  ++  ca-pub
    |=  =path
    ^+  ca-core
    ?>  ca-can-read
    =/  =logs:c
      ?~  path  log.chat
      =/  =time  (slav %da i.path)
      (lot:log-on:c log.chat `time ~)
    =/  =cage  chat-logs+!>(logs)
    =.  cor  (give %fact ~ cage)
    ca-core
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
    ca-sub
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
  ++  ca-give-updates
    |=  =cage
    ^+  ca-core
    =/  paths=(set path)
      %+  roll  ~(val by sup.bowl)
      |=  [[=ship =path] out=(set path)]
      ?.  =((scag 4 path) (snoc ca-area %updates))
        out
      (~(put in out) path)
    =.  paths  (~(put in paths) (snoc ca-area %ui))
    =.  cor
      (give %fact ~(tap in paths) cage)
    ca-core
  ::
  ++  ca-remark-diff
    |=  diff=remark-diff:c
    ^+  ca-core
    =.  cor
      (give %fact ~[(snoc ca-area %ui)] chat-remark-action+!>([flag diff]))
    ?-  -.diff
      %watch    ca-core(watching.remark.chat &)
      %unwatch  ca-core(watching.remark.chat |)
      %read-at  ca-core(last-read.remark.chat p.diff)
    ::
        %read 
      =/  [=time =writ:c]  (need (ram:writs-on:c writs.chat))
      =.  last-read.remark.chat  time
      ca-core
    ==
  ::
  ++  ca-update
    |=  [=time d=diff:c]
    ?>  ca-can-write
    ^+  ca-core
    =.  log.chat
      (put:log-on:c log.chat time d)
    =.  ca-core
      (ca-give-updates chat-update+!>([time d]))
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
        %add-feel
      =/  =writ:c  (got:writs-on:c writs.chat p.d)
      ?>  |(=(p.flag src.bowl) =(src.bowl q.d))
      =.  feels.writ  (~(put by feels.writ) [q r]:d)
      =.  writs.chat   (put:writs-on:c writs.chat p.d writ)
      ca-core
    ::
        %del-feel
      =/  =writ:c  (got:writs-on:c writs.chat p.d)
      ?>  |(=(p.flag src.bowl) =(src.bowl q.d))
      =.  feels.writ  (~(del by feels.writ) q.d)
      =.  writs.chat   (put:writs-on:c writs.chat p.d writ)
      ca-core
   ::
        %add
      ?>  |(=(src.bowl p.flag) =(src.bowl author.p.d))
      =.  writs.chat  
        (put:writs-on:c writs.chat time [time ~ ~] p.d)
      ?~  replying.p.d  ca-core
      =*  replying  u.replying.p.d
      =/  reply=writ:c  (got:writs-on:c writs.chat replying)
      =.  replied.reply  (~(put in replied.reply) time)
      =.  writs.chat  (put:writs-on:c writs.chat replying reply)
      ca-core
    ::
        %del
      =/  =writ:c
        (got:writs-on:c writs.chat p.d)
      =?  ca-core  ?=(^ replying.writ)  
        =*  replying  u.replying.writ
        =/  reply=writ:c  (got:writs-on:c writs.chat replying)
        =.  replied.reply  (~(del in replied.reply) p.d)
        =.  writs.chat  (put:writs-on:c writs.chat replying reply)
        ca-core
      ?>  |(=(src.bowl p.flag) =(src.bowl author.writ))
      =.  writs.chat
        +:(del:writs-on:c writs.chat p.d)
      ca-core
    ==
  --
--
