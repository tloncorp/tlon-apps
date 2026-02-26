/-  s=signal
/+  default-agent, dbug, verb
/+  sj=signal-json
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  +$  state-0
    $:  %0
        =credential-id:s
        =auth-type:s
        =prekey-bundle:s
        encrypted-states=(map ship encrypted-state:s)
    ==
  --
=|  state-0
=*  state  -
=<
  %^  verb  &  %info
  %-  agent:dbug
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
  ++  on-save  !>(state)
  ++  on-load
    |=  =vase
    ^-  (quip card _this)
    =/  old=(unit state-0)
      (mole |.(!<(state-0 vase)))
    ?^  old  `this(state u.old)
    ~&  >>>  "signal: incompatible state, resetting"
    on-init
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
  ++  on-agent
    |=  [=wire =sign:agent:gall]
    ^-  (quip card _this)
    =^  cards  state
      abet:(agent:cor wire sign)
    [cards this]
  ++  on-arvo    on-arvo:def
  --
|_  [=bowl:gall cards=(list card)]
++  abet  [(flop cards) state]
++  cor   .
++  emit  |=(=card cor(cards [card cards]))
++  give  |=(=gift:agent:gall (emit %give gift))
++  from-self  =(our src):bowl
++  init
  ^+  cor
  cor
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?+    mark  ~|(bad-poke/mark !!)
  ::
      %signal-action
    ?>  from-self
    =+  !<(=action:s vase)
    ?>  =(ship.action our.bowl)
    ?-  -.action.action
    ::
        %save-state
      =.  encrypted-states
        (~(put by encrypted-states) peer.action.action data.action.action)
      cor
    ::
        %save-credential
      =.  credential-id  cred.action.action
      cor
    ::
        %save-auth-type
      =.  auth-type  auth-type.action.action
      cor
    ::
        %publish-prekeys
      =.  prekey-bundle  bundle.action.action
      cor
    ==
  ==
::
++  watch
  |=  =(pole knot)
  ^+  cor
  ?+  pole  ~|(bad-watch-path/pole !!)
      [%v0 %prekeys ~]
    =.  cor  (give %fact ~[/v0/prekeys] signal-prekeys+!>(prekey-bundle))
    (give %kick ~[/v0/prekeys] ~)
  ::
      [%v0 %prekeys ship=@ ~]
    ?>  from-self
    =/  =dock  [(slav %p ship.pole) %signal]
    =/  =path  /v0/prekeys
    (emit %pass /prekeys/[ship.pole] %agent dock %watch path)
  ==
::
++  agent
  |=  [=(pole knot) =sign:agent:gall]
  ^+  cor
  ?+  pole  cor
      [%prekeys ship=@ ~]
    ?+    -.sign  cor
        %kick  cor
        %watch-ack
      ?~  p.sign  cor
      =/  =tank
        leaf+"Failed prekeys subscription in {<dap.bowl>}, unexpected"
      ((slog tank u.p.sign) cor)
    ::
        %fact
      =.  cor  (give %fact ~[/v0/prekeys/[ship.pole]] cage.sign)
      (give %kick ~[/v0/prekeys/[ship.pole]] ~)
    ==
  ==
::
++  peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  ?+  pole  [~ ~]
  ::
      [%x %v0 %credential ~]
    ``signal-credential+!>(credential-id)
  ::
      [%x %v0 %auth-type ~]
    ``signal-auth-type+!>(auth-type)
  ::
      [%x %v0 %prekeys ~]
    ``signal-prekeys+!>(prekey-bundle)
  ::
      [%x %v0 %state-peers ~]
    ``signal-state-peers+!>(~(key by encrypted-states))
  ::
      [%x %v0 %state ship=@ ~]
    =/  her  (slav %p ship.pole)
    ``signal-state+!>((~(gut by encrypted-states) her ''))
  ==
--
