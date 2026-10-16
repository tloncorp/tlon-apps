::  kits: installable workspace templates
::
::    stores kit packages (manifest + files) and install ledgers. install
::    creates a group with the kit's places, then expands the rest of the
::    kit into ordinary workspace primitives: the group's workspace config
::    document (bot, instructions, provenance), steward routines for the
::    kit's bot, and notes in the kit's notebooks. packages travel
::    ship-to-ship via one-shot subscriptions (fact + kick) on
::    /v1/preview and /v1/full.
::
/-  k=kits, g=groups, gv=groups-ver, c=channels, n=notes, sa=steward-automation, meta
/+  default-agent, verb, dbug, j=kits-json, wc=workspace-config
::
=>
  |%
  +$  card  card:agent:gall
  +$  state-0
    $:  %0
        kits=(map id:k kit:k)
        installs=(map flag:g install:k)
    ==
  ::  how long the setup routine waits after install, so the bot can
  ::  accept its invite to the new group before the routine runs there
  ::
  ++  setup-delay  ~m1
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
++  scry-path  |=(=dude:gall /(scot %p our.bowl)/[dude]/(scot %da now.bowl))
::  +poke: handle %kits-action-1
::
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?>  ?=(%kits-action-1 mark)
  ?>  =(our src):bowl
  =/  =action:v1:k  !<(action:v1:k vase)
  ?-  -.action
      %add
    (add-kit kit.action)
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
      %install    (install +.action)
      %uninstall  (uninstall flag.action)
  ==
::  +add-kit: put a kit in the library, refusing one that can't install
::
++  add-kit
  |=  =kit:k
  ^+  cor
  ?>  (valid kit)
  =.  kits  (~(put by kits) id.manifest.kit kit)
  (give %fact ~[/v1/updates] kits-update-1+!>(`update:v1:k`[%kit kit]))
::  +valid: every name and file the manifest refers to exists, places
::  are uniquely named, routines run in chat places, and scaffolds go
::  into notebook places
::
++  valid
  |=  =kit:k
  ^-  ?
  =*  man  manifest.kit
  =/  kinds=(map @tas ?(%chat %notebook %gallery))
    (malt (turn places.man |=(p=place:k [name.p kind.p])))
  =/  file  |=(f=@t (~(has by files.kit) f))
  =/  chat  |=(p=@tas =(`%chat (~(get by kinds) p)))
  ?&  =(~(wyt by kinds) (lent places.man))
      (levy instructions.man file)
      (levy schedules.man |=(s=schedule:k &((file file.s) (chat place.s))))
      ?~(setup.man & &((file file.u.setup.man) (chat place.u.setup.man)))
    ::
      %+  levy  scaffolds.man
      |=  s=scaffold:k
      &((file file.s) =(`%notebook (~(get by kinds) place.s)))
  ==
::  +install: create the group and expand the kit into it
::
::    cards go out in order: the group, its blob, its channels, then the
::    notebooks and routines. the blob goes before the notebooks because
::    each notebook's place is filled into it once %notes reports the
::    flag, and that fill must land on the written document.
::
++  install
  |=  [=id:k name=term gmeta=data:meta bot=ship tz=(unit @t)]
  ^+  cor
  ?>  ((sane %tas) name)
  =/  =kit:k  (~(got by kits) id)
  ?>  (valid kit)
  =*  man  manifest.kit
  =/  =flag:g  [our.bowl name]
  ?<  (~(has by installs) flag)
  ?>  (~(has in trusted-bots) bot)
  ::  the bot joins as a member; channel places get predictable nests,
  ::  notebook places are filled in as %notes reports them
  ::
  =/  =create-group:g  [name gmeta %private [~ ~] (my ~[[bot ~]])]
  =.  cor  (pass-groups /install/group/[name] group-command+!>(`c-groups:g`[%create create-group]))
  =/  channels=(list place:k)
    (skip places.man |=(p=place:k ?=(%notebook kind.p)))
  =/  =install:k
    :*  id  version.man  publisher.man  bot
        (malt (turn channels |=(p=place:k [name.p (place-nest flag p)])))
        ~  now.bowl
    ==
  =.  installs  (~(put by installs) flag install)
  =/  text=@t
    %+  rap  3
    %+  join  '\0a\0a'
    (turn instructions.man |=(f=@t (~(got by files.kit) f)))
  =.  cor
    %+  write-blob  flag
    %+  edit:wc  ~
    %:  add-kit:wc
      bot  text  (ref install)
      (~(run by places.install) nest:enjs:j)
    ==
  =.  cor
    %+  roll  channels
    |=  [p=place:k =_cor]
    =/  =create-channel:c
      [(channel-kind kind.p) q.q:(place-nest flag p) flag title.p description.p ~ ~ ~]
    %+  pass-channels:cor  /install/place/[name]/[name.p]
    channel-action-2+!>(`a-channels:c`[%create create-channel])
  =.  cor
    %+  roll  places.man
    |=  [p=place:k =_cor]
    ?.  ?=(%notebook kind.p)  cor
    (create-notebook:cor flag p)
  =.  cor
    %+  roll  schedules.man
    |=  [s=schedule:k =_cor]
    %^  create-routine:cor  flag  id.s
    %:  routine
      kit  install  place.s  file.s
      (rap 3 name.man ': ' description.s ~)
      description.s
      [%cron `cron.s tz ~]
    ==
  =?  cor  ?=(^ setup.man)
    %^  create-routine  flag  %setup
    %:  routine
      kit  install  place.u.setup.man  file.u.setup.man
      (rap 3 name.man ': setup' ~)
      'Runs once, right after install'
      [%at `(add now.bowl setup-delay)]
    ==
  (give-installed flag)
::  +create-notebook: ask %notes for a group notebook, and watch for the
::  flag it assigns
::
++  create-notebook
  |=  [=flag:g p=place:k]
  ^+  cor
  =/  rid=@uv  (sham eny.bowl %notebook name.p)
  =/  =wire  /notebook/[q.flag]/[name.p]
  =.  cor
    (emit %pass wire %agent [our.bowl %notes] %watch /v1/request/(scot %uv rid))
  %-  emit
  :*  %pass  wire  %agent  [our.bowl %notes]
      %poke  notes-action-1+!>(`action:v1:n`[rid %create-group-notebook title.p flag ~])
  ==
::  +notebook-created: record the notebook's place and write its scaffolds
::
++  notebook-created
  |=  [=flag:g place=@tas =nest:g]
  ^+  cor
  ?~  ins=(~(get by installs) flag)  cor
  =/  =install:k  u.ins
  =.  places.install  (~(put by places.install) place nest)
  =.  installs  (~(put by installs) flag install)
  =.  cor
    %+  write-blob  flag
    %+  edit:wc  (group-blob flag)
    (set-place:wc (ref install) place (nest:enjs:j nest))
  =.  cor  (write-scaffolds flag install place q.nest)
  (give-installed flag)
::  +write-scaffolds: the kit's starting notes for one notebook place,
::  into the notebook's root folder
::
++  write-scaffolds
  |=  [=flag:g =install:k place=@tas book=flag:n]
  ^+  cor
  ?~  kit=(~(get by kits) id.install)  cor
  =/  notes=(list scaffold:k)
    (skim scaffolds.manifest.u.kit |=(s=scaffold:k =(place place.s)))
  ?~  notes  cor
  =/  folders
    .^  (list folder:n)  %gx
        (weld (scry-path %notes) /v0/folders/(scot %p ship.book)/[name.book]/notes-folders)
    ==
  =/  root  (skim folders |=(f=folder:n ?=(~ parent-folder-id.f)))
  ?~  root  cor
  %+  roll  `(list scaffold:k)`notes
  |=  [s=scaffold:k =_cor]
  =/  rid=@uv  (sham eny.bowl %scaffold file.s)
  =/  =a-notes:n
    [%notebook book [%create-note id.i.root title.s (~(got by files.u.kit) file.s)]]
  %-  emit:cor
  :*  %pass  /install/scaffold/[q.flag]/[place]
      %agent  [our.bowl %notes]
      %poke  notes-action-1+!>(`action:v1:n`[rid a-notes])
  ==
::  +routine: the steward task for one of the kit's prompts, run in its
::  place's channel session and posting there
::
::    only the run's final reply is posted, so the prompt is framed to say
::    that: without it a model treats the prompt as a job and posts a
::    report on having done it
::
++  routine
  |=  $:  =kit:k  =install:k  place=@tas  file=@t
          name=@t  description=@t  when=cron-schedule:v1:sa
      ==
  ^-  task:v1:sa
  =/  to=@t  (nest:enjs:j (~(got by places.install) place))
  =/  title=@t
    =/  p  (skim places.manifest.kit |=(p=place:k =(place name.p)))
    ?~(p place title.i.p)
  =/  message=@t
    %+  rap  3
    :~  'Your reply to this prompt is posted as-is in the '  title
        ' channel. Write that message itself, not a note about having '
        'written it.\0a\0a'
        (~(got by files.kit) file)
    ==
  :*  agent-id=~
      name=`name
      description=`description
      enabled=`&
      schedule=`when
      session-target=`(rap 3 'session:agent:main:tlon:group:' (crip (cass (trip to))) ~)
      wake-mode=`'now'
      payload=`[`'agentTurn' `message ~]
      delivery=`[`%announce `'tlon' `to ~ ~]
      created-at=~
      updated-at=~
  ==
::  +create-routine: ask steward to create a task for the bot, and watch
::  for the id the bot's harness assigns
::
++  create-routine
  |=  [=flag:g key=@tas =task:v1:sa]
  ^+  cor
  =/  rid=@uv  (sham eny.bowl %routine key)
  =/  bot=ship  bot:(~(got by installs) flag)
  =/  =wire  /routine/[q.flag]/(scot %p bot)/(scot %uv rid)
  =.  cor
    %-  emit
    [%pass wire %agent [our.bowl %steward] %watch /v1/automation/request/(scot %uv rid)]
  %-  emit
  :*  %pass  wire  %agent  [our.bowl %steward]
      %poke  steward-automation-action-1+!>(`action:v1:sa`[%edit rid bot %create task])
  ==
::  +routine-created: record a routine's id, or delete it when the kit
::  was uninstalled before steward answered
::
++  routine-created
  |=  [=flag:g id=@t]
  ^+  cor
  ?~  ins=(~(get by installs) flag)  cor
  =/  =install:k  u.ins
  =.  routines.install  (~(put in routines.install) id)
  =.  installs  (~(put by installs) flag install)
  (give-installed flag)
::  +uninstall: delete the kit's routines and its provenance entry. the
::  group, its channels, and its notes stay with the owner
::
++  uninstall
  |=  =flag:g
  ^+  cor
  ?~  ins=(~(get by installs) flag)  cor
  =/  =install:k  u.ins
  =.  installs  (~(del by installs) flag)
  =.  cor
    %+  roll  ~(tap in routines.install)
    |=  [id=@t =_cor]
    (delete-routine:cor bot.install id)
  =.  cor
    %+  write-blob  flag
    (edit:wc (group-blob flag) (del-kit:wc (ref install)))
  (give %fact ~[/v1/updates] kits-update-1+!>(`update:v1:k`[%uninstalled flag]))
::
++  delete-routine
  |=  [bot=ship id=@t]
  ^+  cor
  =/  rid=@uv  (sham eny.bowl %delete id)
  %-  emit
  :*  %pass  /uninstall/routine/(scot %uv rid)
      %agent  [our.bowl %steward]
      %poke  steward-automation-action-1+!>(`action:v1:sa`[%edit rid bot %delete id])
  ==
::  +write-blob: write an edited workspace config; a blob the edit
::  refused (one this agent can't read) is left alone
::
++  write-blob
  |=  [=flag:g blob=(unit (unit @t))]
  ^+  cor
  ?~  blob
    %-  (slog leaf+"kits: {<flag>} blob is not a workspace config; left as is" ~)
    cor
  %+  pass-groups  /install/blob/[q.flag]
  group-action-5+!>(`a-groups:g`[%group flag %blob u.blob])
::
++  trusted-bots
  .^((set ship) %gx (weld (scry-path %steward) /v1/bots/steward-bots-1))
::
++  group-blob
  |=  =flag:g
  ^-  (unit @t)
  =<  blob
  .^  group:v11:gv  %gx
      (weld (scry-path %groups) /v3/groups/(scot %p p.flag)/[q.flag]/group-3)
  ==
::
++  ref
  |=  =install:k
  ^-  @t
  (ref:enjs:j publisher.install id.install version.install)
::
++  give-installed
  |=  =flag:g
  ^+  cor
  %+  give  %fact
  :-  ~[/v1/updates]
  kits-update-1+!>(`update:v1:k`[%installed flag (~(got by installs) flag)])
::
++  pass-groups
  |=  [=wire =cage]
  (emit %pass wire %agent [our.bowl %groups] %poke cage)
::
++  pass-channels
  |=  [=wire =cage]
  (emit %pass wire %agent [our.bowl %channels] %poke cage)
::  +watch: local update stream + public one-shot kit fetches
::
++  watch
  |=  =path
  ^+  cor
  ?+  path  !!
    [%v1 %updates ~]  ?>(=(our src):bowl cor)
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
::  +agent: kit fetches, the notebook and routine answers that complete
::  an install, and poke-acks
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
        %fact
      ?.  ?=(%kits-update-1 p.cage.sign)  cor
      =/  =update:v1:k  !<(update:v1:k q.cage.sign)
      ?.  ?=(%kit -.update)  cor
      (add-kit kit.update)
    ==
  ::
      [%notebook @ @ ~]
    =/  =flag:g  [our.bowl i.t.wire]
    =*  place  i.t.t.wire
    ?+  -.sign  (ack wire sign)
        %fact
      =/  res  !<(response:v1:n q.cage.sign)
      =.  cor  (emit %pass wire %agent [our.bowl %notes] %leave ~)
      ?.  ?=(%notebook -.body.res)
        %-  (slog leaf+"kits: {<flag>} notebook {<place>} failed" ~)
        cor
      (notebook-created flag place [%notes flag.summary.body.res])
    ==
  ::
      [%routine @ @ @ ~]
    =/  =flag:g  [our.bowl i.t.wire]
    =/  bot=ship  (slav %p i.t.t.wire)
    ?+  -.sign  (ack wire sign)
        %fact
      =/  res  !<(response:v1:sa q.cage.sign)
      ?+  -.body.res
          =.  cor  (emit %pass wire %agent [our.bowl %steward] %leave ~)
          %-  (slog leaf+"kits: {<flag>} routine failed: {<body.res>}" ~)
          cor
        %pending  cor
      ::
          %created
        =.  cor  (emit %pass wire %agent [our.bowl %steward] %leave ~)
        ?.  (~(has by installs) flag)
          (delete-routine bot id.body.res)
        (routine-created flag id.body.res)
      ==
    ==
  ::
      [%install *]    (ack wire sign)
      [%uninstall *]  (ack wire sign)
  ==
::  +ack: log a refused poke or watch
::
++  ack
  |=  [=wire =sign:agent:gall]
  ^+  cor
  =/  err=(unit tang)
    ?+  -.sign  ~
      %poke-ack   p.sign
      %watch-ack  p.sign
    ==
  ?~  err  cor
  %-  (slog leaf+"kits: {<wire>} failed" u.err)
  cor
::
::  +place-nest: a channel place's nest. channel names are unique per
::  host, not per group, so the name carries the group's
::
++  place-nest
  |=  [=flag:g p=place:k]
  ^-  nest:g
  [(channel-kind kind.p) flag(q (rap 3 q.flag '-' name.p ~))]
::  +channel-kind: the channel kind of a channel-backed place
::
++  channel-kind
  |=  kind=?(%chat %notebook %gallery)
  ^-  kind:c
  ?+  kind  !!
    %chat     %chat
    %gallery  %heap
  ==
--
