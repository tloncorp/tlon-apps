::  kits: shareable behavior packages for agents
::
::    a kit is a package of markdown instructions, starting state
::    (scaffolds), schedule declarations, and place templates that
::    installs into a group + agent. %kits stores packages and install
::    ledgers; per-group install config is written into the group's
::    blob field for the executing harness to read.
::
/-  g=groups, meta
|%
::  $id: kit identifier, unique per publisher
::
+$  id  @tas
::  $vers: kit content version (semver triple)
::
+$  vers  [major=@ud minor=@ud patch=@ud]
::  $place: abstract place the kit needs; created at install
::
::    .name: the handle instructions refer to
::    .kind: what to create — %chat/%notebook/%gallery
::
+$  place
  $:  name=@tas
      kind=?(%chat %notebook %gallery)
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
::    .places: abstract place name -> concrete channel. %notebook
::    places are created via %notes, which slugifies and assigns the
::    flag itself and self-registers the channel with the group, so
::    they are NOT recorded here (or in the blob config) — executors
::    resolve them from the group's channel state at runtime.
::
+$  install
  $:  =id
      version=vers
      publisher=@p
      places=(map @tas nest:g)
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
::    %setup-done: an executing agent finished the setup conversation;
::            accepted from foreign ships when an install exists
::    %relay-setup-done: local-only; forward %setup-done to the group
::            host's %kits (the executor's ship reports completion)
::
+$  action
  $%  [%add =kit]
      [%del =id]
      [%fetch =ship =id]
      [%install =id name=term meta=data:meta]
      [%uninstall =flag:g]
      [%setup-done =flag:g]
      [%relay-setup-done =flag:g]
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
