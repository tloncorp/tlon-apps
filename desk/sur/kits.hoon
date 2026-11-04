::  kits: installable workspace templates
::
::    a kit is a package of places, instructions, schedules, and starting
::    notes. installing one creates a group with the kit's places and
::    expands everything else into ordinary workspace primitives: the
::    group's workspace config document (its blob), steward routines for
::    the kit's bot, and notes in the kit's notebooks. after install
::    nothing depends on the kit; %kits keeps a ledger of what it created
::    so uninstall can remove the routines.
::
/-  g=groups, meta
|%
::  $id: kit identifier, unique per publisher
::
+$  id  @tas
::  $vers: kit content version (semver triple)
::
+$  vers  [major=@ud minor=@ud patch=@ud]
::  $place: a channel the kit creates at install
::
::    .name: the handle the kit's schedules and scaffolds refer to
::
+$  place
  $:  name=@tas
      kind=?(%chat %notebook %gallery)
      title=@t
      description=@t
  ==
::  $schedule: a recurring routine. .file holds the prompt it runs, and
::  .place the chat place it runs in and posts to
::
+$  schedule
  $:  id=@tas
      cron=@t
      description=@t
      file=@t
      place=@tas
  ==
::  $setup: a one-off routine that runs right after install
::
+$  setup  [file=@t place=@tas]
::  $scaffold: a starting note, written into a notebook place
::
+$  scaffold  [file=@t title=@t place=@tas]
::  $manifest: everything about a kit except its file contents
::
::    .instructions: files appended to the workspace instructions
::
+$  manifest
  $:  =id
      name=@t
      version=vers
      publisher=@p
      description=@t
      image=(unit @t)
      places=(list place)
      instructions=(list @t)
      schedules=(list schedule)
      setup=(unit setup)
      scaffolds=(list scaffold)
  ==
::  $kit: a full package: manifest + file contents by path
::
+$  kit
  $:  =manifest
      files=(map @t @t)
  ==
::  $install: ledger entry for one installed kit
::
::    .places: place name -> channel. notebook places are added once
::    %notes reports the flag it assigned.
::    .routines: the steward task ids created for the kit, as steward
::    reported them
::
+$  install
  $:  =id
      version=vers
      publisher=@p
      bot=ship
      places=(map @tas nest:g)
      routines=(set @t)
      installed=@da
  ==
::  $action: inbound pokes, all local-only
::
::    %add: put a kit in the local library (author or sideload)
::    %del: remove a kit from the library
::    %fetch: fetch a kit from its publisher's ship into the library
::    %install: create a group from a kit, for .bot to run; .tz is the
::      installer's time zone, which the kit's schedules run in
::    %uninstall: delete the kit's routines and its provenance entry;
::      the group, its channels, and its notes stay
::
+$  action
  $%  [%add =kit]
      [%del =id]
      [%fetch =ship =id]
      [%install =id name=term meta=data:meta bot=ship tz=(unit @t)]
      [%uninstall =flag:g]
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
