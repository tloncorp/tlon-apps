::  lens: per-run bot introspection relay and store
::
::    one agent, two roles:
::
::    - bot ship: the openclaw gateway pokes %context-lens-action-1 locally with
::      run records; we fan them out to configured owners as
::      %context-lens-signal-1 pokes (ames retries until ack).
::    - owner ship: stores runs from bot ships keyed [bot id-run] (the
::      poke source is the trust anchor), gives facts on /v1, and
::      answers scries for clients.
::
::    run payloads are opaque JSON with an inner schemaVersion; the
::    gateway enforces size caps and truncation before poking.
::
/-  l=context-lens
/+  default-agent, verb, dbug
|%
+$  card  card:agent:gall
::  $state-1: agent state (%0 -> %1 arms the prune timer on upgrade)
::
::    .owners: ships that receive run fan-out (bot role; ~ = inert)
::    .runs: stored run records keyed by bot ship and run id (owner role)
::
+$  state-0
  $:  %0
      owners=(set ship)
      runs=(map [bot=ship =id-run:l] run:l)
  ==
::
+$  state-1
  $:  %1
      owners=(set ship)
      runs=(map [bot=ship =id-run:l] run:l)
  ==
::
+$  versioned-state  $%(state-0 state-1)
+$  current-state  state-1
::
++  migrate-state
  |=  old=versioned-state
  ^-  current-state
  ?-  -.old
    %0  [%1 +.old]
    %1  old
  ==
--
=|  current-state
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
    [~[wait-prune:cor] this]
  ++  on-save  !>(state)
  ::  arm the prune timer exactly once when upgrading from a version
  ::  that didn't have it; arming on every load would stack timers
  ::
  ++  on-load
    |=  ole=vase
    ^-  (quip card _this)
    =/  old  !<(versioned-state ole)
    =/  cards=(list card)
      ?:(?=(%0 -.old) ~[wait-prune:cor] ~)
    [cards this(state (migrate-state old))]
  ++  on-poke
    |=  [=mark =vase]
    ^-  (quip card _this)
    =^  cards  state  abet:(poke:cor mark vase)
    [cards this]
  ++  on-watch
    |=  =path
    ^-  (quip card _this)
    ?>  =(src our):bowl
    ?+  path  (on-watch:def path)
      [%v1 ~]  `this
    ==
  ++  on-peek
    |=  =path
    ^-  (unit (unit cage))
    ?>  =(src our):bowl
    ?+  path  [~ ~]
        [%x %recent ~]
      ``context-lens-update-1+!>(`update:v1:l`[%runs recent:cor])
    ::
        [%x %run @ @ ~]
      =/  bot  (slav %p i.t.t.path)
      =/  =id-run:l  i.t.t.t.path
      ?~  r=(~(get by runs) [bot id-run])  [~ ~]
      ?:  (expired:cor u.r)  [~ ~]
      ``context-lens-update-1+!>(`update:v1:l`[%run bot id-run u.r])
    ==
  ++  on-agent
    |=  [=wire =sign:agent:gall]
    ^-  (quip card _this)
    =^  cards  state  abet:(agent:cor wire sign)
    [cards this]
  ++  on-arvo
    |=  [=wire =sign-arvo]
    ^-  (quip card _this)
    =^  cards  state  abet:(arvo:cor wire sign-arvo)
    [cards this]
  ++  on-leave  |=(path `this)
  ++  on-fail
    |=  [=term =tang]
    ^-  (quip card _this)
    %-  (slog 'context-lens: on-fail' >term< tang)
    [~ this]
  --
|_  [=bowl:gall cards=(list card)]
++  cor   .
++  abet  [(flop cards) state]
++  emit  |=(=card cor(cards [card cards]))
++  give  |=(=gift:agent:gall (emit %give gift))
::  retention bounds for stored runs (owner role): enforced on store
::  and on a daily timer; reads also filter expired runs so the age
::  bound holds even if a bot goes quiet between timer fires
::
++  max-runs-per-bot  1.000
++  max-run-age  ~d90
++  prune-interval  ~d1
::
++  wait-prune
  ^-  card
  [%pass /prune %arvo %b %wait (add now.bowl prune-interval)]
::
++  expired
  |=  =run:l
  ^-  ?
  (lth received.run (sub now.bowl max-run-age))
::
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?+  mark  ~|(bad-poke-mark+mark !!)
      %context-lens-action-1
    ?>  =(src our):bowl
    =+  !<(=action:v1:l vase)
    ?-  -.action
      %configure  cor(owners owners.action)
      %run-event  (fan-out %run-event +.action)
      %run-final  (fan-out %run-final +.action)
    ==
  ::
      %context-lens-signal-1
    =+  !<(=signal:v1:l vase)
    ?-  -.signal
      %run-event  (store src.bowl id-run.signal payload.signal |)
      %run-final  (store src.bowl id-run.signal payload.signal &)
    ==
  ==
::
++  fan-out
  |=  =signal:v1:l
  ^+  cor
  =/  targets  ~(tap in owners)
  |-  ^+  cor
  ?~  targets  cor
  =.  cor
    ?:  =(i.targets our.bowl)
      ::  self-owned bot: store directly, no network hop
      %:  store
        our.bowl
        id-run.signal
        payload.signal
        ?=(%run-final -.signal)
      ==
    %-  emit
    :^    %pass
        /signal/(scot %p i.targets)/(scot %t id-run.signal)
      %agent
    [[i.targets %context-lens] %poke %context-lens-signal-1 !>(signal)]
  $(targets t.targets)
::
++  store
  |=  [bot=ship =id-run:l payload=@t complete=?]
  ^+  cor
  ::  drop late partials once a run is finalized: overwriting would
  ::  pair complete=& with a stale partial payload (and fact it out)
  ::
  =/  prev  (~(get by runs) [bot id-run])
  ?:  &(?=(^ prev) complete.u.prev !complete)
    cor
  =/  =run:l  [complete now.bowl payload]
  =.  runs  (~(put by runs) [bot id-run] run)
  =.  cor  (prune bot)
  (give %fact ~[/v1] %context-lens-update-1 !>(`update:v1:l`[%run bot id-run run]))
::
::  +prune: enforce per-bot retention (age, then count cap)
::
++  prune
  |=  for=ship
  ^+  cor
  =/  mine
    %+  skim  ~(tap by runs)
    |=  [[bot=ship *] *]
    =(bot for)
  =/  dead
    %+  skim  mine
    |=  [* =run:l]
    (expired run)
  =/  live
    %+  skip  mine
    |=  [* =run:l]
    (expired run)
  =?  dead  (gth (lent live) max-runs-per-bot)
    =/  sorted
      %+  sort  live
      |=  [a=[* =run:l] b=[* =run:l]]
      (lth received.run.a received.run.b)
    (weld dead (scag (sub (lent live) max-runs-per-bot) sorted))
  =/  keys  (turn dead |=([k=[bot=ship =id-run:l] *] k))
  |-  ^+  cor
  ?~  keys  cor
  $(runs (~(del by runs) i.keys), keys t.keys)
::
::  +recent: newest stored runs across all bots, for scry backfill
::
++  recent
  ^-  (list entry:v1:l)
  =/  fresh
    %+  skip  ~(tap by runs)
    |=  [* =run:l]
    (expired run)
  =/  sorted
    %+  sort  fresh
    |=  [a=[* =run:l] b=[* =run:l]]
    (gth received.run.a received.run.b)
  %+  turn  (scag 50 sorted)
  |=  [[bot=ship =id-run:l] =run:l]
  [bot id-run run]
::
++  agent
  |=  [=wire =sign:agent:gall]
  ^+  cor
  ?+  wire  cor
      [%signal *]
    ?+  -.sign  cor
        %poke-ack
      ?~  p.sign  cor
      ((slog 'context-lens: run fan-out nacked' u.p.sign) cor)
    ==
  ==
::
++  arvo
  |=  [=wire sign=sign-arvo]
  ^+  cor
  ?+  wire  cor
      [%prune ~]
    ?.  ?=([%behn %wake *] sign)  cor
    =?  cor  ?=(^ error.sign)
      ((slog 'context-lens: prune wake failed' u.error.sign) cor)
    =.  cor  prune-all
    (emit wait-prune)
  ==
::
++  prune-all
  ^+  cor
  =/  bots=(list ship)
    %~  tap  in
    %-  ~(gas in *(set ship))
    (turn ~(tap by runs) |=([[bot=ship *] *] bot))
  |-  ^+  cor
  ?~  bots  cor
  =.  cor  (prune i.bots)
  $(bots t.bots)
--
