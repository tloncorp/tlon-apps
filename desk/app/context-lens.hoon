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
::  $state-0: agent state
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
+$  versioned-state  $%(state-0)
+$  current-state  state-0
::
++  migrate-state
  |=  old=versioned-state
  ^-  current-state
  ?-  -.old
    %0  old
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
  ++  on-init  `this
  ++  on-save  !>(state)
  ++  on-load
    |=  ole=vase
    ^-  (quip card _this)
    [~ this(state (migrate-state !<(versioned-state ole)))]
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
    ?+  path  [~ ~]
        [%x %recent ~]
      ``context-lens-update-1+!>(`update:v1:l`[%runs recent:cor])
    ::
        [%x %run @ @ ~]
      =/  bot  (slav %p i.t.t.path)
      =/  =id-run:l  i.t.t.t.path
      ?~  r=(~(get by runs) [bot id-run])  [~ ~]
      ``context-lens-update-1+!>(`update:v1:l`[%run bot id-run u.r])
    ==
  ++  on-agent
    |=  [=wire =sign:agent:gall]
    ^-  (quip card _this)
    =^  cards  state  abet:(agent:cor wire sign)
    [cards this]
  ++  on-arvo  on-arvo:def
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
::  retention bounds for stored runs (owner role)
::
++  max-runs-per-bot  500
++  max-run-age  ~d30
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
  ::  never demote a finalized run back to partial
  ::
  =/  prev  (~(get by runs) [bot id-run])
  =/  comp  |(complete ?&(?=(^ prev) complete.u.prev))
  =/  =run:l  [comp now.bowl payload]
  =.  runs  (~(put by runs) [bot id-run] run)
  =.  cor  (prune bot)
  (give %fact ~[/v1] %context-lens-update-1 !>(`update:v1:l`[%run bot id-run run]))
::
::  +prune: enforce per-bot retention (age, then count cap)
::
++  prune
  |=  for=ship
  ^+  cor
  =/  cutoff=@da  (sub now.bowl max-run-age)
  =/  mine
    %+  skim  ~(tap by runs)
    |=  [[bot=ship *] *]
    =(bot for)
  =/  dead
    %+  skim  mine
    |=  [* =run:l]
    (lth received.run cutoff)
  =/  live
    %+  skip  mine
    |=  [* =run:l]
    (lth received.run cutoff)
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
  =/  sorted
    %+  sort  ~(tap by runs)
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
--
