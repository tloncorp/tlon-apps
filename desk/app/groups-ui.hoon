/-  u=ui, g=groups, c=chat, d=diary, h=heap
/+  default-agent, dbug, verb, vita-client
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  +$  state-0  [%0 first-load=?]
  +$  current-state  state-0
  +$  versioned-state  $%(~ current-state)
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
  =/  =cage  settings-event+!>([%put-entry %groups %groups %'showVitaMessage' [%b &]])
  =?  cor  first-load  (emit %pass /set-vita %agent [our.bowl %settings-store] %poke cage)
  =.  first-load  |
  %-  emil 
  :~  [%pass /build %arvo [%c %warp our.bowl q.byk.bowl ~ %sing %c da+now.bowl /ui-init/json]]
      [%pass /build %arvo [%c %warp our.bowl q.byk.bowl ~ %sing %c da+now.bowl /ui-migration/json]]
  ==
::
++  load
  |=  =vase
  ^+  cor
  =+  !<(old=versioned-state vase)
  =.  state  ?~(old *current-state old)
  init
::
++  peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  ?+    pole  [~ ~]
      [%x %init ~]
    =+  .^([=groups:g =gangs:g] (scry %gx %groups /init/noun))
    =/  =init:u
      :*  groups
          gangs
          .^(chat:u (scry %gx %chat /init/noun))
          .^(heap:u (scry %gx %heap /init/noun))
          .^(diary:u (scry %gx %diary /init/noun))
      ==
    ``ui-init+!>(init)
  ::
      [%x %migration ~]
    =/  =migration:u
      :*  .^(imported:u (scry %gx %chat /imp/noun))
          .^(imported:u (scry %gx %heap /imp/noun))
          .^(imported:u (scry %gx %diary /imp/noun))
          .^((list ship) (scry %gx %group-store /wait/noun))
      ==
    ``ui-migration+!>(migration)
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
  ==
::
++  agent
  |=  [=(pole knot) =sign:agent:gall]
  ^+  cor
  ?+    pole  ~|(bad-agent-take/pole !!)
    ~  cor
    [%set-vita ~]  cor
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
