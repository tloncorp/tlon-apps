::  gateway-status: thin proxy to %steward for backwards compat
::
::    this agent is the external-facing entry point for openclaw-tlon and
::    any other callers that poke %gateway-status-action-1. it forwards
::    all actions to %steward as local pokes. no real logic lives here.
::
::    production ships are on state-1, so on-load must accept the existing
::    persisted state without crashing. we read the versioned-state and
::    discard it into a trivial unit state.
::
/-  gs=gateway-status, s=steward, a=activity
/+  default-agent, verb, dbug
|%
+$  card  card:agent:gall
::  prior versioned state shapes — accepted on-load, then discarded
::
+$  state-0
  $:  %0
      owner=(unit ship)
      last-owner-msg=@da
      last-owner-msg-id=(unit message-key:a)
      =status:gs
      boot-id=(unit @t)
      lease-until=(unit @da)
      last-heartbeat=(unit @da)
      last-stop=(unit @da)
      last-start=(unit @da)
      pending-restart=?
      last-auto-reply=(unit @da)
      last-auto-reply-to=(unit message-key:a)
      reply-cooldown=@dr
      active-window=@dr
  ==
+$  state-1
  $:  %1
      owner=(unit ship)
      last-owner-msg=@da
      last-owner-msg-id=(unit message-key:a)
      =status:gs
      boot-id=(unit @t)
      lease-until=(unit @da)
      last-heartbeat=(unit @da)
      last-stop=(unit @da)
      last-start=(unit @da)
      pending-restart=?
      last-auto-reply=(unit @da)
      last-auto-reply-to=(unit message-key:a)
      reply-cooldown=@dr
      active-window=@dr
  ==
+$  versioned-state  $%(state-0 state-1)
::  current trivial proxy state
::
+$  state-2  [%2 ~]
::
--
=|  state-2
=*  state  -
%-  agent:dbug
%^  verb  |  %warn
^-  agent:gall
=<
  |_  =bowl:gall
  +*  this  .
      def   ~(. (default-agent this %.n) bowl)
      cor   ~(. +> [bowl ~])
  ++  on-init
    ^-  (quip card _this)
    `this
  ++  on-save  !>(state)
  ++  on-load
    |=  ole=vase
    ^-  (quip card _this)
    ::  accept old versioned state but discard all fields — proxy has no state
    ::
    =/  attempt  (mule |.(!<(versioned-state ole)))
    ?.  ?=(%& -.attempt)
      ::  unrecognized vase — might already be state-2
      =/  attempt2  (mule |.(!<(state-2 ole)))
      ?:  ?=(%& -.attempt2)
        [~ this(state p.attempt2)]
      %-  (slog 'gateway-status: on-load unrecognized state, resetting' ~)
      `this
    ::  upgrade from the pre-proxy agent (state-0/state-1): carry liveness
    ::  config over to %steward so the migration is seamless. owner + timing
    ::  always; and if a gateway instance was live (boot-id + lease set),
    ::  replay its %gateway-start so %steward comes up %up with the matching
    ::  boot-id. otherwise the running gateway's heartbeats (old boot-id) would
    ::  never match steward's empty boot-id, so it would stay %down and owner
    ::  DMs would get false offline auto-replies until the gateway restarts.
    ::
    =/  old  p.attempt
    ?~  owner.old  `this
    =/  spk
      |=  =action:v1:s
      ^-  card
      [%pass /steward/proxy %agent [our.bowl %steward] %poke %steward-action-1 !>(action)]
    =/  cards=(list card)
      :~  (spk [%configure u.owner.old])
          (spk [%gateway %configure active-window.old reply-cooldown.old])
      ==
    =?  cards  ?&(?=(^ boot-id.old) ?=(^ lease-until.old))
      (snoc cards (spk [%gateway %gateway-start u.boot-id.old u.lease-until.old]))
    [cards this]
  ++  on-poke
    |=  [=mark =vase]
    ^-  (quip card _this)
    =^  cards  state  abet:(poke:cor mark vase)
    [cards this]
  ++  on-watch
    |=  =path
    ^-  (quip card _this)
    (on-watch:def path)
  ++  on-leave  |=(path `this)
  ++  on-peek
    |=  =path
    ^-  (unit (unit cage))
    [~ ~]
  ++  on-agent
    |=  [=wire =sign:agent:gall]
    ^-  (quip card _this)
    =^  cards  state  abet:(agent:cor wire sign)
    [cards this]
  ++  on-arvo
    |=  [=wire sign=sign-arvo]
    ^-  (quip card _this)
    `this
  ++  on-fail
    |=  [=term =tang]
    ^-  (quip card _this)
    %-  (slog 'gateway-status: on-fail' >term< tang)
    [~ this]
  --
|_  [=bowl:gall cards=(list card)]
++  cor   .
++  abet  [(flop cards) state]
++  emit  |=(=card cor(cards [card cards]))
::
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?>  =(src our):bowl
  ?>  =(%gateway-status-action-1 mark)
  =+  !<(=action:v1:gs vase)
  ?-  -.action
    %configure          (forward-configure +.action)
    %gateway-start      (forward-start +.action)
    %gateway-heartbeat  (forward-heartbeat +.action)
    %gateway-stop       (forward-stop +.action)
  ==
::
++  steward-poke
  |=  =action:v1:s
  ^+  cor
  (emit %pass /steward/proxy %agent [our.bowl %steward] %poke %steward-action-1 !>(action))
::
++  forward-configure
  |=  [who=ship win=@dr orc=@dr]
  ^+  cor
  ::  two steward pokes: top-level owner + gateway timing configure
  =.  cor  (steward-poke [%configure who])
  (steward-poke [%gateway %configure win orc])
::
++  forward-start
  |=  [bid=@t lut=@da]
  ^+  cor
  (steward-poke [%gateway %gateway-start bid lut])
::
++  forward-heartbeat
  |=  [bid=@t lut=@da]
  ^+  cor
  (steward-poke [%gateway %gateway-heartbeat bid lut])
::
++  forward-stop
  |=  [bid=@t reason=@t]
  ^+  cor
  (steward-poke [%gateway %gateway-stop bid reason])
::
++  agent
  |=  [=wire =sign:agent:gall]
  ^+  cor
  ?+  wire  cor
      [%steward %proxy ~]
    ?+  -.sign  cor
        %poke-ack
      ?~  p.sign  cor
      ((slog 'gateway-status: steward proxy poke failed' u.p.sign) cor)
    ==
  ==
--
