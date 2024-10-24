/-  u=ui, g=groups, c=chat, d=channels, a=activity
/+  default-agent, dbug, verb, vita-client
::  performance, keep warm
/+  mark-warmer
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  +$  current-state
    $:  %1
        pins=(list whom:u)
        first-load=?
    ==
  --
=|  current-state
=*  state  -
=<
  %+  verb  |
  %-  agent:dbug
  %-  (agent:vita-client [| ~sogryp-dister-dozzod-dozzod])
  |_  =bowl:gall
  +*  this  .
      def   ~(. (default-agent this %.n) bowl)
      cor   ~(. +> [bowl ~])
  ++  on-init
    ^-  (quip card _this)
    =^  cards  state
      abet:init:cor
    [cards this]
  ::
  ++  on-save   !>(state)
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
  ++  on-watch  on-watch:def
  ++  on-leave  on-leave:def
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
  ++  on-fail   on-fail:def
  ++  on-peek   peek:cor
  --
|_  [=bowl:gall cards=(list card)]
++  abet  [(flop cards) state]
++  cor   .
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))
++  give  |=(=gift:agent:gall (emit %give gift))
++  scry
  |=  [care=@tas =dude:gall =path]
  ^+  path
  :*  care
      (scot %p our.bowl)
      dude
      (scot %da now.bowl)
      path
  ==
::
++  init
  ^+  cor
  =/  =cage  settings-event+!>([%put-entry %groups %groups %'showActivityMessage' [%b &]])
  =?  cor  first-load  (emit %pass /set-activity %agent [our.bowl %settings] %poke cage)
  =.  first-load  |
  cor
::
++  load
  |=  =vase
  |^  ^+  cor
      =+  !<(old=versioned-state vase)
      =?  old  ?=(~ old)     *current-state
      =?  old  ?=(%0 -.old)  (state-0-to-1 old)
      ?>  ?=(%1 -.old)
      =.  state  old
      init
  ::
  +$  versioned-state  $@(~ $%(state-1 state-0))
  +$  state-1  current-state
  ::
  +$  state-0  [%0 first-load=?]
  ++  state-0-to-1
    |=(state-0 [%1 ~ first-load])
  --
::
++  peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  ?+    pole  [~ ~]
      [%x %pins ~]  ``ui-pins+!>(pins)
  ::
      [%x %init ~]
    =+  .^([=groups-ui:g =gangs:g] (scry %gx %groups /init/v1/noun))
    =+  .^([=unreads:d channels=channels:v0:old:d] (scry %gx %channels /v1/init/noun))
    =+  .^(chat=chat-0:u (scry %gx %chat /init/noun))
    =+  .^(profile=? (scry %gx %profile /bound/loob))
    =/  init=init-0:u
      :*  groups-ui
          gangs
          channels
          unreads
          pins
          chat
          profile
      ==
    ``ui-init+!>(`init-0:u`init)
      [%x %v1 %init ~]
    =+  .^([=groups-ui:g =gangs:g] (scry %gx %groups /init/v1/noun))
    =+  .^([=unreads:d =channels:v7:old:d] (scry %gx %channels /v2/init/noun))
    =+  .^(chat=chat-0:u (scry %gx %chat /init/noun))
    =+  .^(profile=? (scry %gx %profile /bound/loob))
    =/  init=init-1:u
      :*  groups-ui
          gangs
          channels
          unreads
          pins
          chat
          profile
      ==
    ``ui-init-1+!>(`init-1:u`init)
  ::
      [%x %v1 %heads since=?(~ [u=@ ~])]
    =+  .^(chan=channel-heads:v7:old:d (scry %gx %channels %v2 %heads (snoc since.pole %channel-heads)))
    =+  .^(chat=chat-heads:c (scry %gx %chat %heads (snoc since.pole %chat-heads)))
    ``ui-heads+!>(`mixed-heads:u`[chan chat])
  ::
      [%x %v2 %init ~]
    =+  .^([=groups-ui:g =gangs:g] (scry %gx %groups /init/v1/noun))
    =+  .^([* =channels:v7:old:d] (scry %gx %channels /v2/init/noun))
    =+  .^(chat=chat-0:u (scry %gx %chat /init/noun))
    =+  .^(=activity:v2:old:a (scry %gx %activity /activity/noun))
    =+  .^(profile=? (scry %gx %profile /bound/loob))
    =/  init=init-2:u
      :*  groups-ui
          gangs
          channels
          activity
          pins
          [clubs dms invited]:chat
          profile
      ==
    ``ui-init-2+!>(`init-2:u`init)
  ::
      [%x %v3 %init ~]
    =+  .^([=groups-ui:g =gangs:g] (scry %gx %groups /init/v1/noun))
    =+  .^([* =channels:v7:old:d] (scry %gx %channels /v2/init/noun))
    =+  .^(chat=chat-0:u (scry %gx %chat /init/noun))
    =+  .^(=activity:v3:old:a (scry %gx %activity /v1/activity/noun))
    =+  .^(profile=? (scry %gx %profile /bound/loob))
    =/  init=init-3:u
      :*  groups-ui
          gangs
          channels
          activity
          pins
          [clubs dms invited]:chat
          profile
      ==
    ``ui-init-3+!>(`init-3:u`init)
  ::
      [%x %v4 %init ~]
    =+  .^([=groups-ui:g =gangs:g] (scry %gx %groups /init/v1/noun))
    =+  .^(=channel-0:u (scry %gx %channels /v3/init/noun))
    =+  .^(chat=chat-2:u (scry %gx %chat /v1/init/noun))
    =+  .^(=activity:a (scry %gx %activity /v4/activity/noun))
    =+  .^(profile=? (scry %gx %profile /bound/loob))
    =/  init=init-4:u
      :*  groups-ui
          gangs
          channel-0
          activity
          pins
          chat
          profile
      ==
    ``ui-init-4+!>(init)
      [%x %v5 %init ~]
    =+  .^([=groups-ui:g =gangs:g] (scry %gx %groups /init/v1/noun))
    =+  .^(=channel-8:u (scry %gx %channels /v4/init/noun))
    =+  .^(chat=chat-2:u (scry %gx %chat /v1/init/noun))
    =+  .^(=activity:a (scry %gx %activity /v4/activity/noun))
    =+  .^(profile=? (scry %gx %profile /bound/loob))
    =/  init=init-5:u
      :*  groups-ui
          gangs
          channel-8
          activity
          pins
          chat
          profile
      ==
    ``ui-init-5+!>(init)
  ==
::
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?+    mark  ~|(bad-mark/mark !!)
    %ui-vita  (emit (active:vita-client bowl))
  ::
      %ui-vita-toggle
    =+  !<(=vita-enabled:u vase)
    (emit %pass /vita-toggle %agent [our.bowl dap.bowl] %poke vita-client+!>([%set-enabled vita-enabled]))
  ::
      %ui-action
    =+  !<(=action:u vase)
    ?>  ?=(%pins -.action)
    =.  pins
      ?-  -.a-pins.action
        %del  (skip pins (cury test whom.a-pins.action))
      ::
          %add
        ::  be careful not to insert duplicates
        ::
        |-
        ?~  pins  [whom.a-pins.action]~
        ?:  =(i.pins whom.a-pins.action)  pins
        [i.pins $(pins t.pins)]
      ==
    ::TODO  eventually, give %fact if that changed anything
    cor
  ==
::
++  agent
  |=  [=(pole knot) =sign:agent:gall]
  ^+  cor
  ?+    pole  ~|(bad-agent-take/pole !!)
    ~  cor
    [%set-activity ~]  cor
    [%vita-toggle ~]  cor
  ==
::
++  arvo
  |=  [=wire sign=sign-arvo]
  ^+  cor
  ?+  wire  !!
    [%build ~]  cor
  ==
--
