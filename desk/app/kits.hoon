::  kits: shareable behavior packages for agents
::
::    stores kit packages (manifest + files) and install ledgers.
::    install instantiates a group + its places, then writes the
::    per-group kit config into the group's blob field, where the
::    executing harness reads it. packages travel ship-to-ship via
::    one-shot subscriptions (fact + kick) on /v1/preview and /v1/full.
::
/-  k=kits, g=groups, c=channels, meta
/+  default-agent, verb, dbug, j=kits-json
::
=>
  |%
  +$  card  card:agent:gall
  +$  state-0
    $:  %0
        kits=(map id:k kit:k)
        installs=(map flag:g install:k)
    ==
  --
=|  state-0
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
    =.  state  !<(state-0 ole)
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
  ?>  from-self
  =/  =action:v1:k  !<(action:v1:k vase)
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
      %install    (install id.action name.action meta.action)
      %uninstall  (uninstall flag.action)
      %setup-done  (setup-done flag.action)
  ==
::  +install: instantiate a group + places, write blob, record ledger
::
++  install
  |=  [=id:k name=term gmeta=data:meta]
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
  ::  create each place as a channel in the group
  ::
  =/  nests=(map @tas nest:c)
    %-  malt
    %+  turn  places.man
    |=  p=place:k
    [name.p `nest:c`[(place-kind kind.p) our.bowl name.p]]
  =.  cor
    =/  ps=(list place:k)  places.man
    |-  ^+  cor
    ?~  ps  cor
    =/  =create-channel:c
      [(place-kind kind.i.ps) name.i.ps flag title.i.ps description.i.ps ~ ~ ~]
    =.  cor
      %-  emit
      :*  %pass  /install/place/[name]/[name.i.ps]
          %agent  [our.bowl %channels]
          %poke  channel-action-2+!>(`a-channels:c`[%create create-channel])
      ==
    $(ps t.ps)
  ::  record the ledger and write the group blob config
  ::
  =/  =install:k
    [id version.man publisher.man nests %pending now.bowl]
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
::  +setup-done: the harness finished the setup conversation
::
++  setup-done
  |=  =flag:g
  ^+  cor
  =/  =install:k  (~(got by installs) flag)
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
    (en:json:html (config:enjs:j our.bowl install schedules))
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
      [%v1 %preview @ ~]
    =/  =kit:k  (~(got by kits) i.t.t.path)
    =.  cor
      (give %fact ~ kits-update-1+!>(`update:v1:k`[%preview manifest.kit]))
    (give %kick ~ ~)
  ::
      [%v1 %full @ ~]
    =/  =kit:k  (~(got by kits) i.t.t.path)
    =.  cor
      (give %fact ~ kits-update-1+!>(`update:v1:k`[%kit kit]))
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
  ==
::  +place-kind: map place kinds onto channel kinds
::
++  place-kind
  |=  k=?(%chat %notebook %gallery)
  ^-  kind:c
  ?-  k
    %chat      %chat
    %notebook  %diary
    %gallery   %heap
  ==
--
