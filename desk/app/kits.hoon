::  kits: shareable behavior packages for agents
::
::    stores kit packages (manifest + files) and install ledgers.
::    install instantiates a group + its places, then writes the
::    per-group kit config into the group's blob field, where the
::    executing harness reads it. packages travel ship-to-ship via
::    one-shot subscriptions (fact + kick) on /v1/preview and /v1/full.
::
/-  k=kits, g=groups, c=channels, n=notes, meta
/+  default-agent, verb, dbug, j=kits-json
::
=>
  |%
  +$  card  card:agent:gall
  ::  state-0 predates the `agents` field on an install: entries written then
  ::  implied the installer was the agent. +on-load fills that in so an
  ::  existing ledger keeps the behaviour it was written under.
  +$  install-0
    $:  id=id:k
        version=vers:k
        publisher=@p
        places=(map @tas nest:v1:k)
        setup=?(%pending %done)
        installed=@da
    ==
  +$  state-0
    $:  %0
        kits=(map id:k kit:k)
        installs=(map flag:g install-0)
    ==
  +$  state-1
    $:  %1
        kits=(map id:k kit:k)
        installs=(map flag:g install:k)
    ==
  +$  versioned-state  $%(state-0 state-1)
  --
=|  state-1
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
    =/  old  !<(versioned-state ole)
    =.  state
      ?:  ?=(%1 -.old)  old
      ::  an install written before `agents` existed implied the installer was
      ::  the agent, and the installer was always us.
      :+  %1  kits.old
      %-  ~(run by installs.old)
      |=  i=install-0
      ^-  install:k
      [id.i version.i publisher.i places.i (sy ~[our.bowl]) setup.i installed.i]
    `this
  ++  on-poke
    |=  [=mark =vase]
    ^-  (quip card _this)
    =^  cards  state  abet:(poke:cor mark vase)
    [cards this]
  ++  on-watch
    |=  =path
    ^-  (quip card _this)
    =^  cards  state  abet:(watch:cor path)
    [cards this]
  ++  on-peek   peek:cor
  ++  on-agent
    |=  [=wire =sign:agent:gall]
    ^-  (quip card _this)
    =^  cards  state  abet:(agent:cor wire sign)
    [cards this]
  ++  on-leave  on-leave:def
  ++  on-arvo   on-arvo:def
  ++  on-fail   on-fail:def
  --
|_  [=bowl:gall cards=(list card)]
++  cor  .
++  abet  [(flop cards) state]
++  emit  |=(=card cor(cards [card cards]))
++  give  |=(=gift:agent:gall (emit %give gift))
++  from-self  =(our src):bowl
::  +poke: handle %kits-action-1
::
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?>  ?=(%kits-action-1 mark)
  =/  =action:v1:k  !<(action:v1:k vase)
  ::  %setup-fired and %setup-done may arrive from another ship — the harness
  ::  runs on the agent's ship while the install ledger lives on the group
  ::  host, so the agent's %kits relays them here. The setup arms check the
  ::  sender against the install's recorded agents; everything else stays
  ::  local-only.
  ?>  |(from-self ?=(?(%setup-fired %setup-done) -.action))
  ?-  -.action
      %add
    =.  kits  (~(put by kits) id.manifest.kit.action kit.action)
    (give %fact ~[/v1/updates] kits-update-1+!>(`update:v1:k`[%kit kit.action]))
  ::
      %del
    =.  kits  (~(del by kits) id.action)
    cor
  ::
      %fetch
    %-  emit
    :*  %pass  /fetch/(scot %p ship.action)/[id.action]
        %agent  [ship.action %kits]
        %watch  /v1/full/[id.action]
    ==
  ::
      %install    (install id.action name.action meta.action agent.action)
      %uninstall  (uninstall flag.action)
      %setup-fired  (setup-fired flag.action)
      %setup-done   (setup-done flag.action)
  ==
::  +install: instantiate a group + places, write blob, record ledger
::
++  install
  |=  [=id:k name=term gmeta=data:meta agent=(unit @p)]
  ^+  cor
  ?>  ((sane %tas) name)
  =/  =kit:k  (~(got by kits) id)
  =*  man  manifest.kit
  ?>  ?=(%group scope.man)
  =/  =flag:g  [our.bowl name]
  ?<  (~(has by installs) flag)
  ::  create the group
  ::
  =/  =create-group:g  [name gmeta %private [~ ~] ~]
  =.  cor
    %-  emit
    :*  %pass  /install/group/[name]
        %agent  [our.bowl %groups]
        %poke  group-command+!>(`c-groups:g`[%create create-group])
    ==
  ::  create each place, in whichever agent hosts its kind
  ::
  =/  nests=(map @tas nest:v1:k)
    %-  malt
    %+  turn  places.man
    |=  p=place:k
    [name.p (place-nest name p)]
  =.  cor
    =/  ps=(list place:k)  places.man
    |-  ^+  cor
    ?~  ps  cor
    =.  cor
      %-  emit
      :*  %pass  /install/place/[name]/[name.i.ps]
          (place-card flag (place-nest name i.ps) i.ps)
      ==
    $(ps t.ps)
  ::  record the ledger and write the group blob config
  ::
  =/  =install:k
    ::  no agent named means the harness authenticates as the installing ship,
    ::  which is the only case where `our` is the right answer.
    =/  agents=(set @p)  (sy ~[?^(agent u.agent our.bowl)])
    :*  id
        version.man
        publisher.man
        nests
        agents
        %pending
        now.bowl
    ==
  =.  installs  (~(put by installs) flag install)
  =.  cor  (write-blob flag install)
  (give %fact ~[/v1/updates] kits-update-1+!>(`update:v1:k`[%installed flag install]))
::  +uninstall: clear the blob config and drop the ledger entry
::
++  uninstall
  |=  =flag:g
  ^+  cor
  ?.  (~(has by installs) flag)  cor
  =.  installs  (~(del by installs) flag)
  =.  cor
    %-  emit
    :*  %pass  /uninstall/[q.flag]
        %agent  [our.bowl %groups]
        %poke  group-action-5+!>(`a-groups:g`[%group flag %blob ~])
    ==
  (give %fact ~[/v1/updates] kits-update-1+!>(`update:v1:k`[%uninstalled flag]))
::  +setup-fired: the harness scheduled the setup conversation
::
::    The durable fire-once guard: a %fired install never re-fires setup
::    across harness restarts, while readers can still tell "the agent is
::    working" (%fired) from "the setup turn ran to completion" (%done).
::    Same relay-and-accept shape as +setup-done. Only %pending advances to
::    %fired — a late or duplicate fire never demotes %done.
::
++  setup-fired
  |=  =flag:g
  ^+  cor
  ?.  =(our.bowl p.flag)
    ?>  from-self
    %-  emit
    :*  %pass  /setup-fired/(scot %p p.flag)/[q.flag]
        %agent  [p.flag %kits]
        %poke  kits-action-1+!>(`action:v1:k`[%setup-fired flag])
    ==
  =/  ledger  (~(get by installs) flag)
  ?~  ledger  cor
  ?>  |(from-self (~(has in agents.u.ledger) src.bowl))
  ?.  ?=(%pending setup.u.ledger)  cor
  =/  =install:k  u.ledger
  =.  setup.install  %fired
  =.  installs  (~(put by installs) flag install)
  =.  cor  (write-blob flag install)
  (give %fact ~[/v1/updates] kits-update-1+!>(`update:v1:k`[%installed flag install]))
::  +setup-done: the harness's setup turn ran to completion
::
::    The ledger entry lives on the ship that ran the install — the group
::    host — while the harness that finishes setup runs on the agent's ship.
::    So a local poke for a foreign group relays to the host, and the host
::    accepts the relayed poke only from a ship the install seats as an
::    agent. Absent entries no-op rather than crash: a relay can race an
::    uninstall, and a nack would just re-fire setup forever.
::
++  setup-done
  |=  =flag:g
  ^+  cor
  ?.  =(our.bowl p.flag)
    ?>  from-self
    %-  emit
    :*  %pass  /setup-done/(scot %p p.flag)/[q.flag]
        %agent  [p.flag %kits]
        %poke  kits-action-1+!>(`action:v1:k`[%setup-done flag])
    ==
  =/  ledger  (~(get by installs) flag)
  ?~  ledger  cor
  ?>  |(from-self (~(has in agents.u.ledger) src.bowl))
  =/  =install:k  u.ledger
  =.  setup.install  %done
  =.  installs  (~(put by installs) flag install)
  =.  cor  (write-blob flag install)
  (give %fact ~[/v1/updates] kits-update-1+!>(`update:v1:k`[%installed flag install]))
::  +write-blob: render the install config and poke it into the group
::
++  write-blob
  |=  [=flag:g =install:k]
  ^+  cor
  =/  schedules=(list schedule:k)
    =/  kit=(unit kit:k)  (~(get by kits) id.install)
    ?~(kit ~ schedules.manifest.u.kit)
  =/  cfg=@t
    (en:json:html (config:enjs:j install schedules))
  %-  emit
  :*  %pass  /install/blob/[q.flag]
      %agent  [our.bowl %groups]
      %poke  group-action-5+!>(`a-groups:g`[%group flag %blob `cfg])
  ==
::  +watch: local update stream + public one-shot kit fetches
::
++  watch
  |=  =path
  ^+  cor
  ?+  path  !!
    [%v1 %updates ~]  ?>(from-self cor)
  ::
  ::  Unknown ids nack the watch instead of crashing the arm: these two
  ::  paths are reachable by any ship, so a bare +got would make a typo a
  ::  remote crash.
      [%v1 %preview @ ~]
    =/  kit=(unit kit:k)  (~(get by kits) i.t.t.path)
    ?~  kit  ~|(no-such-kit+i.t.t.path !!)
    =.  cor
      (give %fact ~ kits-update-1+!>(`update:v1:k`[%preview manifest.u.kit]))
    (give %kick ~ ~)
  ::
      [%v1 %full @ ~]
    =/  kit=(unit kit:k)  (~(get by kits) i.t.t.path)
    ?~  kit  ~|(no-such-kit+i.t.t.path !!)
    =.  cor
      (give %fact ~ kits-update-1+!>(`update:v1:k`[%kit u.kit]))
    (give %kick ~ ~)
  ==
::  +peek: local reads
::
++  peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  [~ ~]
      [%x %v1 %kits ~]
    =/  ms=(list manifest:k)
      (turn ~(val by kits) |=(=kit:k manifest.kit))
    ``kits-update-1+!>(`update:v1:k`[%kits ms])
  ::
      [%x %v1 %kits @ ~]
    ?~  kit=(~(get by kits) i.t.t.t.path)  [~ ~]
    ``kits-update-1+!>(`update:v1:k`[%kit u.kit])
  ::
      [%x %v1 %installs ~]
    ``kits-update-1+!>(`update:v1:k`[%installs installs])
  ==
::  +agent: fetch results and install poke-acks
::
++  agent
  |=  [=wire =sign:agent:gall]
  ^+  cor
  ?+  wire  cor
      [%fetch @ @ ~]
    ?+  -.sign  cor
        %watch-ack
      ?~  p.sign  cor
      %-  (slog leaf+"kits: fetch {<t.wire>} failed" u.p.sign)
      cor
    ::
        %kick  cor
        %fact
      ?.  ?=(%kits-update-1 p.cage.sign)  cor
      =/  =update:v1:k  !<(update:v1:k q.cage.sign)
      ?.  ?=(%kit -.update)  cor
      =.  kits  (~(put by kits) id.manifest.kit.update kit.update)
      (give %fact ~[/v1/updates] kits-update-1+!>(`update:v1:k`update))
    ==
  ::
      [%install *]
    ?.  ?=(%poke-ack -.sign)  cor
    ?~  p.sign  cor
    %-  (slog leaf+"kits: install step {<t.wire>} failed" u.p.sign)
    cor
  ::
      [%uninstall *]
    ?.  ?=(%poke-ack -.sign)  cor
    ?~  p.sign  cor
    %-  (slog leaf+"kits: uninstall blob clear failed" u.p.sign)
    cor
  ::
      [%setup-done @ @ ~]
    ?.  ?=(%poke-ack -.sign)  cor
    ?~  p.sign  cor
    %-  (slog leaf+"kits: setup-done relay {<t.wire>} failed" u.p.sign)
    cor
  ::
      [%setup-fired @ @ ~]
    ?.  ?=(%poke-ack -.sign)  cor
    ?~  p.sign  cor
    %-  (slog leaf+"kits: setup-fired relay {<t.wire>} failed" u.p.sign)
    cor
  ==
::  +place-slug: the channel name a place gets
::
::    Scoped by the group so installing the same kit twice on one ship does
::    not collide. Both %channels and every third-party host assert their
::    channel does not already exist, so a bare place name ("discussion")
::    meant the second install's place creation simply nacked — and +install
::    logs nacks rather than unwinding, leaving a group whose blob named
::    channels that were never made.
::
::    One install per group flag (asserted above), so the group name alone
::    is enough to disambiguate.
::
++  place-slug
  |=  [group=term p=place:k]
  ^-  term
  (rap 3 name.p '-' group ~)
::  +place-nest: the nest a place resolves to, known before it exists
::
::    Every host here takes the channel name from its caller, which is what
::    lets install write the blob in the same event it pokes them. %notes
::    would otherwise slugify its own flag off an internal counter, which no
::    caller can predict.
::
++  place-nest
  |=  [group=term p=place:k]
  ^-  nest:v1:k
  [(place-kind kind.p) our.bowl (place-slug group p)]
::  +place-kind: the nest kind for a place kind
::
::    %chat/%notebook/%gallery are %channels-backed and keep their historic
::    mapping. %notes is its own host, so its nest kind is its agent name —
::    the generic channel-host convention (docs/backend/channel-hosts.md).
::
++  place-kind
  |=  k=?(%chat %notebook %gallery %notes)
  ^-  @tas
  ?-  k
    %chat      %chat
    %notebook  %diary
    %gallery   %heap
    %notes     %notes
  ==
::  +place-card: the poke that creates a place, per host
::
::    The one arm that knows a host exists. Adding a further host-backed
::    kind means an arm here and a line in +place-kind; +install does not
::    change.
::
++  place-card
  |=  [group=flag:g =nest:v1:k p=place:k]
  ^-  [%agent [ship term] task:agent:gall]
  ?:  ?=(%notes kind.p)
    ::  notes-action-1 carries [request-id a-notes], not a bare action: the
    ::  request-id keys the typed response %notes emits on /v1/request/<uv>.
    ::  Nothing here tracks that response, so synthesize one from eny — the
    ::  same thing %notes' own legacy arm does for callers that ignore it.
    :^  %agent  [our.bowl %notes]  %poke
    :-  %notes-action-1
    !>  ^-  action:v1:n
    :-  `@uv`eny.bowl
    [%create-group-notebook title.p group ~ `name.nest]
  =/  =create-channel:c
    :*  ;;(kind:c (place-kind kind.p))
        name.nest
        group
        title.p
        description.p
        ~  ~  ~
    ==
  :^  %agent  [our.bowl %channels]  %poke
  channel-action-2+!>(`a-channels:c`[%create create-channel])
--
