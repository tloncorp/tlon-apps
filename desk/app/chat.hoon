/-  c=chat
/+  default-agent, verb, dbug
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  +$  resource  (pair ship term)
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
  ++  on-init  `this
  ++  on-save  !>(state)
  ++  on-load
    |=  =vase
    =+  !<(old=state-0 vase)
    `this(state old)
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
    ?.  =(our.bowl p.flag)
      (join flag)
    (create flag)
  ::
      %chat-action
    =+  !<(=action:c vase)
    =/  chat-core  (ca-abed:ca-core p.action)
    ?:  =(p.p.action our.bowl)
      ca-abet:(ca-update:chat-core q.action)
    ca-abet:(ca-proxy:chat-core q.action)
  ==
  ::
  ++  join
    |=  =flag:c
    ^+  cor
    =.  chats  (~(put by chats) flag *chat:c)
    ca-abet:(ca-join:ca-core flag)
  ::
  ++  create
    |=  =flag:c
    ^+  cor
    =|  =chat:c
    =.  p.chat  [%pub ~]
    =.  chats  (~(put by chats) flag chat)
    cor  :: TODO: emit facts
  --
++  watch
  |=  =path
  ^+  cor
  ?+    path  ~|(bad-watch-path/path !!)
    [%chats ~]  cor
  ::
      [%chats @ @ *]
    =/  =ship  (slav %p i.t.path)
    =*  name   i.t.t.path
    ca-abet:(ca-watch:(ca-abed:ca-core ship name) t.t.t.path)
  ==
::
++  agent
  |=  [=wire =sign:agent:gall]
  ^+  cor
  ?+    wire  ~|(bad-agent-wire/wire !!)
      [%chats @ @ *]
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
++  ca-core
  |_  [=flag:c =chat:c]
  ++  ca-core  .
  ++  ca-abet  
    cor(chats (~(put by chats) flag chat))
  ++  ca-abed
    |=  r=resource
    ca-core(flag r, chat (~(got by chats) r))
  ++  ca-area  `path`/chats/(scot %p p.flag)/[q.flag]
  ++  ca-watch
    |=  =path
    ?+    path  !!
        [%updates *]
      (ca-pub t.path)
    ==
  ++  ca-agent
    |=  [=wire =sign:agent:gall]
    ^+  ca-core
    ?+  wire  !!
        ~  :: noop wire, should only send pokes
      ca-core
    ::
        [%updates ~]
      (ca-take-update sign)
    ==
  ::
  ++  ca-peek
    |=  =(pole knot)
    ^-  (unit (unit cage))
    ?+    pole  [~ ~]
    ::
        [%fleet %newest count=@ ~]
      =/  count  (slav %ud count.pole)
      ``writs+!>((scag count (tap:fleet-on:c r.chat)))
    ::
        [%fleet %older start=@ count=@ ~]
      =/  count  (slav %ud count.pole)
      =/  start  (slav %da start.pole)
      ``writs+!>((tab:fleet-on:c r.chat `start count))
    ::
        [%fleet %writ writ=@ ~]
      =/  writ  (slav %da writ.pole)
      ``writ+!>((got:fleet-on:c r.chat writ))
    ==
  ::
  ++  ca-take-update
    |=  =sign:agent:gall
    ^+  ca-core
    ?+    -.sign  ca-core
      %kick  ca-sub
    ::
        %watch-ack
      =.  p.chat  [%sub src.bowl]
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
    =/  =dock  [p.flag dap.bowl]
    =/  =cage  chat-action+!>([flag update])
    =.  cor
      (emit %pass ca-area %agent dock %poke cage)
    ca-core
  ::
  ++  ca-pub
    |=  =path
    ^+  ca-core
    =/  =logs:c
      ?~  path  q.chat
      =/  =time  (slav %da i.path)
      (lot:log-on:c q.chat `time ~)
    =/  =cage  chat-logs+!>(logs)
    =.  cor  (give %fact ~ cage)
    ca-core
  ::
  ++  ca-sub
    ^+  ca-core
    =/  tim=(unit time)
      (bind (ram:log-on:c q.chat) head)
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
    ?:  =(~ paths)
      ca-core
    =.  cor
      (give %fact ~(tap in paths) cage)
    ca-core
  ::
  ++  ca-update
    |=  [=time d=diff:c]
    ^+  ca-core
    =.  q.chat
      (put:log-on:c q.chat time d)
    =.  ca-core
      (ca-give-updates chat-update+!>([time d]))
    ?-    -.d
        %add-feel
      =/  =writ:c  (got:fleet-on:c r.chat p.d)
      =.  feel.writ  (~(put ju feel.writ) q.d src.bowl)
      =.  r.chat   (put:fleet-on:c r.chat p.d writ)
      ca-core
    ::
        %del-feel
      =/  =writ:c  (got:fleet-on:c r.chat p.d)
      =.  feel.writ  (~(del ju feel.writ) q.d src.bowl)
      =.  r.chat   (put:fleet-on:c r.chat p.d writ)
      ca-core
   ::
        %add
      =.  r.chat  
        (put:fleet-on:c r.chat time [time ~] p.d)
      ca-core
    ::
        %del
      =.  r.chat
        +:(del:fleet-on:c r.chat p.d)
      ca-core
    ==
  --
--
