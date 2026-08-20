::  kits: shareable behavior packages for agents
::
::    a kit is a package of markdown instructions, starting state
::    (scaffolds), schedule declarations, and place templates that
::    installs into a group + agent. %kits stores packages and install
::    ledgers; per-group install config is written into the group's
::    blob field for the executing harness to read.
::
/-  c=channels, g=groups, meta
|%
::  $id: kit identifier, unique per publisher
::
+$  id  @tas
::  $vers: kit content version (semver triple)
::
+$  vers  [major=@ud minor=@ud patch=@ud]
::  $nest: channel id with an unrestricted kind
::
::    nest:c pins its kind to ?(%diary %heap %chat), so a channel served by
::    a third-party host — %notes, %apps — cannot be expressed with it. Every
::    channel host in the desk hits this and defines its own; see
::    docs/backend/channel-hosts.md.
::
+$  nest  [kind=@tas host=@p name=@tas]
::  $place: abstract place the kit needs; created at install
::
::    .name: the handle instructions refer to
::    .kind: what to create. %chat/%notebook/%gallery are %channels-backed;
::           %notes is served by its own agent. A closed union on purpose:
::           an unrecognized kind means the installer cannot create the
::           place, and a half-instantiated workspace is worse than an
::           install this build refuses outright.
::
+$  place
  $:  name=@tas
      kind=?(%chat %notebook %gallery %notes)
      title=@t
      description=@t
  ==
::  $binding: attaches an instruction file to the world
::
::    .load: %ambient loads whenever the agent acts in scope;
::           %on-trigger only when .trigger fires; %pulled when the
::           model reaches for it.
::
+$  binding
  $:  file=@t
      scope=?(%group %dm %agent)
      trigger=(unit @t)
      load=?(%ambient %on-trigger %pulled)
  ==
::  $schedule: recurring trigger, realized by the harness at install
::
+$  schedule  [id=@tas cron=@t description=@t]
::  $scaffold: starting state file, copied to the bot workspace
::
+$  scaffold  [file=@t workspace=@t]
::  $manifest: everything about a kit except its file contents
::
::    .policy: opaque JSON policy patch, harness-interpreted
::
+$  manifest
  $:  =id
      name=@t
      version=vers
      publisher=@p
      description=@t
      image=(unit @t)
      scope=?(%group %dm %agent)
      places=(list place)
      bindings=(list binding)
      schedules=(list schedule)
      scaffolds=(list scaffold)
      policy=(unit @t)
  ==
::  $kit: a full package: manifest + file contents by path
::
+$  kit
  $:  =manifest
      files=(map @t @t)
  ==
::  $install: ledger entry for one installed kit
::
::    .places: abstract place name -> concrete channel
::
+$  install
  $:  =id
      version=vers
      publisher=@p
      places=(map @tas nest)
      ::  which ships may execute this kit here. The agent is usually a
      ::  different ship from the installer — a moon in production — so it
      ::  cannot be derived from `our` at write time.
      agents=(set @p)
      setup=?(%pending %done)
      installed=@da
  ==
::  $action: inbound pokes
::
::    %add: put a kit in the local library (author or sideload)
::    %del: remove a kit from the library
::    %fetch: two-step fetch of a kit from a publisher ship
::    %install: instantiate — create a group + places, write the
::            group blob config, record the ledger
::    %uninstall: clear the blob config and drop the ledger entry
::    %setup-done: the harness finished the setup conversation
::
+$  action
  $%  [%add =kit]
      [%del =id]
      [%fetch =ship =id]
      ::  agent: the ship whose harness executes this kit. Defaults to the
      ::  installer when absent, which is right only when the harness
      ::  authenticates as the installing ship.
      [%install =id name=term meta=data:meta agent=(unit @p)]
      [%uninstall =flag:g]
      [%setup-done =flag:g]
  ==
::  $update: facts + scry results
::
+$  update
  $%  [%kit =kit]
      [%preview =manifest]
      [%kits kits=(list manifest)]
      [%installed =flag:g =install]
      [%uninstalled =flag:g]
      [%installs installs=(map flag:g install)]
  ==
++  v1  .
--
