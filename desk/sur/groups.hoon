/-  meta, e=epic
|%
::  +okay: protocol version, defunct
::
++  okay  `epic:e`4
::  $flag: ID for a group
::
+$  flag  (pair ship term)
::
::  $nest: ID for a channel, {app}/{ship}/{name}
::
+$  nest  (pair term flag)
::
::  $sect: ID for cabal, similar to a role
::TODO rename sect -> role. It seems role is not in
::     use anywhere?
::
+$  sect  term
::
::  $zone: channel grouping
::
::    includes its own metadata for display and keeps the order of
::    channels within.
::
::    zone: the term that represents the ID of a zone
::    realm: the metadata representing the zone and the order of channels
::    delta: the set of actions that can be taken on a zone
::      %add: create a zone
::      %del: delete the zone
::      %edit: modify the zone metadata
::      %mov: reorders the zone in the group
::      %mov-nest: reorders a channel within the zone
::
++  zone
  |^  zone
  ::
  +$  zone  @tas
  +$  realm
    $:  met=data:meta
        ord=(list nest)
    ==
  +$  diff  (pair zone delta)
  +$  delta
    $%  [%add meta=data:meta]
        [%del ~]
        [%edit meta=data:meta]
        [%mov idx=@ud]
        [%mov-nest =nest idx=@ud]
    ==
  --
::
::  $fleet: group members and their associated metadata
::
::    vessel: a user's set of sects or roles and the time that they joined
::    @da default represents an admin added member that has yet to join
::
++  fleet
  |^  fleet  
  ::
  +$  fleet  (map ship vessel)
  +$  vessel
    $:  sects=(set sect)
        joined=time
    ==
  +$  diff
    $%  [%add ~]
        [%del ~]
        [%add-sects sects=(set sect)]
        [%del-sects sects=(set sect)]
    ==
  --
::
::  $channel: a medium for interaction
::
++  channel
  |^  channel
  ::
  +$  preview
    $:  =nest
        meta=data:meta
        group=^preview
    ==
  ::
  +$  channels  (map nest channel)
  ::
  ::  $channel: a collection of metadata about a channel
  ::
  ::    meta: title, description, image, cover
  ::    added: when the channel was created
  ::    zone: what zone or section to bucket in
  ::    join: should the channel be joined by new members
  ::    active: channel subscription status
  ::    readers: what sects can see the channel, empty means anyone
  ::
  +$  channel
    $:  meta=data:meta
        added=time
        =zone
        join=?
        readers=(set sect)
    ==
  ::
  ::  $diff: represents the set of actions you can take on a channel
  ::
  ::    add: create a channel
  ::    edit: edit a channel
  ::    del: delete a channel
  ::    add-sects: add sects to readers
  ::    del-sects: delete sects from readers
  ::    zone: change the zone of the channel
  ::    join: toggle default join
  ::
  +$  diff
    $%  [%add =channel]
        [%edit =channel]
        [%del ~]
      ::
        [%add-sects sects=(set sect)]
        [%del-sects sects=(set sect)]
      ::
        [%zone =zone]
      ::
        [%join join=_|]
    ==
  --
::
::  $group: collection of people and the pathways in which they interact
::
::    group holds all data around members, permissions, channel
::    organization, and its own metadata to represent the group
::
+$  group
  $:  =fleet
      cabals=(map sect cabal)
      zones=(map zone realm:zone)
      zone-ord=(list zone)
      =bloc
      =channels:channel
      active-channels=(set nest)
      imported=(set nest)
      =cordon
      secret=?
      meta=data:meta
      =flagged-content
  ==
+$  group-ui  [group init=? count=@ud]
::  $cabal: metadata representing a $sect or role
::
::TODO rename cabal -> role-meta?
::
::  ++  role
::    |^
::    +$  role  @tas
::    +$  diff
::      $%  [%add meta=data:meta]
::          [%edit meta=data:meta]
::          [%del ~]
::      ==
::
++  cabal
  |^  cabal
  ::
  +$  cabal
    [meta=data:meta ~]
  ::
  +$  diff
    $%  [%add meta=data:meta]
        [%edit meta=data:meta]
        [%del ~]
    ==
  --
::
::  $cordon: group entry and visibility permissions
::TODO rename cordon -> entry
::
++  cordon
  |^  cordon
  ::
  ::  $open: a group with open entry, only bans are barred entry
  ::
  ++  open
    |%
    ::  $ban: set of ships and ranks/classes that are not allowed entry
    ::
    ::    bans can either be done at the individual ship level or by the
    ::    rank level (comet/moon/etc.)
    ::
    +$  ban  [ships=(set ship) ranks=(set rank:title)]
    +$  diff
      $%  [%add-ships p=(set ship)]
          [%del-ships p=(set ship)]
        ::
          [%add-ranks p=(set rank:title)]
          [%del-ranks p=(set rank:title)]
      ==
    --
  ::
  ::  $shut: a group with closed entry, everyone barred entry
  ::
  ::    a shut cordon means that the group is closed, but still visible.
  ::    people may request entry and either be accepted or denied or
  ::    they may be invited directly
  ::
  ::    ask: represents those requesting entry
  ::    pending: represents those who've been invited
  ::
  ++  shut
    |%
    +$  state  [pend=(set ship) ask=(set ship)]
    +$  kind  ?(%ask %pending)
    +$  diff
      $%  [%add-ships p=kind q=(set ship)]
          [%del-ships p=kind q=(set ship)]
      ==
    --
  ::
  ::  $cordon: a set of metadata to represent the entry policy for a group
  ::
  ::    open: a group with open entry, only bans barred entry
  ::    shut: a group with closed entry, everyone barred entry
  ::    afar: a custom entry policy defined by another agent
  ::TODO  rename %afar -> %toll
  ::
  +$  cordon
    $%  [%shut state:shut]
        [%afar =flag =path desc=@t]
        [%open =ban:open]
    ==
  ::
  ::  $diff: the actions you can take on a cordon
  ::
  ::    %shut: closed policy
  ::    %open: open policy
  ::    %swap: replace with policy
  ::
  +$  diff
    $%  [%shut p=diff:shut]
        [%open p=diff:open]
        [%swap p=cordon]
    ==
  --
::
::  $bloc: superuser sects
::
::    sects in the bloc set are allowed to make modifications to the group
::    and its various metadata and permissions
::
++  bloc
  |^  bloc
  ::
  +$  bloc  (set sect)
  +$  diff
    $%  [%add p=(set sect)]
        [%del p=(set sect)]
    ==
  --
::
::  $diff: the general set of changes that can be made to a group
::
+$  diff
  $%  [%fleet p=(set ship) q=diff:fleet]
      [%cabal p=sect q=diff:cabal]
      [%channel p=nest q=diff:channel]
      [%bloc p=diff:bloc]
      [%cordon p=diff:cordon]
      [%zone p=diff:zone]
      [%meta p=data:meta]
      [%secret p=?]
      [%create p=group]
      [%del ~]
      [%flag-content =nest =post-key src=ship]
  ==
::
::  $action: the complete set of data required to edit a group
::
+$  action
  (pair flag update)
::
::  $update: a representation in time of a modification of a group
::
+$  update
  (pair time diff)
::
::  $create: a request to make a group
::
+$  create
  $:  name=term
      title=cord
      description=cord
      image=cord
      cover=cord
      =cordon
      members=(jug ship sect)
      secret=?
  ==
::
+$  init  [=time =group]
::
::  $groups-ui: map for frontend to display groups
+$  groups-ui
  (map flag group-ui)
+$  groups
  (map flag group)
+$  net-groups
  (map flag [net group])
::
::  $log: a time ordered map of all modifications to groups
::
+$  log
  ((mop time diff) lte)
::
++  log-on
  ((on time diff) lte)
::
::  $net: an indicator of whether I'm a host or subscriber
::
+$  net
  $~  [%pub ~]
  $%  [%pub p=log]
      [%sub p=time load=_|]
  ==
::
+$  post-key  [post=time reply=(unit time)]
::
+$  flaggers  (set ship)
::  $flagged-content: flagged posts and replies that need admin review
::
+$  flagged-content  (map nest (map post-key flaggers))
::
::  $join: a join request, can elect to join all channels
::
+$  join
  $:  =flag
      join-all=?
  ==
::
::  $knock: a request to enter a closed group
::
+$  knock  flag
::
::  $progress: the state of a group join
::
+$  progress
  ?(%knocking %adding %watching %error)
::
::  $claim: a mark for gangs to represent a join in progress
::
+$  claim
  $:  join-all=?
      =progress
  ==
::
::  $preview: the metadata and entry policy for a group
::
+$  preview
  $:  =flag
      meta=data:meta
      =cordon
      =time
      secret=?
      count=@ud
  ==
::
+$  previews  (map flag preview)
::
::  $invite: a marker to show you've been invited to a group
::
+$  invite  (pair flag ship)
::
::  $gang: view of foreign group
+$  gang
  $:  cam=(unit claim)
      pev=(unit preview)
      vit=(unit invite)
  ==
::
+$  gangs  (map flag gang)
::
++  v5  v5:ver
++  v2  v2:ver
::
++  ver
  |%
  ::
  ++  v5  .
  ::
  ++  v2
    |%
    +$  preview
      $:  =flag
          meta=data:meta
          =cordon
          =time
          secret=?
      ==
    ::
    +$  previews  (map flag preview)
    ::
    ++  channel
      |^  channel
      ::
      +$  preview
        $:  =nest
            meta=data:meta
            group=^preview
        ==
      ::
      +$  channels  (map nest channel)
      ::
      +$  channel
        $:  meta=data:meta
            added=time
            =zone
            join=?
            readers=(set sect)
        ==
      ::
      +$  diff
        $%  [%add =channel]
            [%edit =channel]
            [%del ~]
          ::
            [%add-sects sects=(set sect)]
            [%del-sects sects=(set sect)]
          ::
            [%zone =zone]
          ::
            [%join join=_|]
        ==
      --
    ::
    +$  group
      $:  =fleet
          cabals=(map sect cabal)
          zones=(map zone realm:zone)
          zone-ord=(list zone)
          =bloc
          =channels:channel
          imported=(set nest)
          =cordon
          secret=?
          meta=data:meta
          =flagged-content
      ==
    ::
    +$  group-ui  [group saga=(unit saga:e)]
    ::
    +$  diff
      $%  [%fleet p=(set ship) q=diff:fleet]
          [%cabal p=sect q=diff:cabal]
          [%channel p=nest q=diff:channel]
          [%bloc p=diff:bloc]
          [%cordon p=diff:cordon]
          [%zone p=diff:zone]
          [%meta p=data:meta]
          [%secret p=?]
          [%create p=group]
          [%del ~]
          [%flag-content =nest =post-key src=ship]
      ==
    ::
    +$  net
      $~  [%pub ~]
      $%  [%pub p=log]
          [%sub p=time load=_| =saga:e]
      ==
    ::
    +$  action
      (pair flag update)
    ::
    +$  update
      (pair time diff)
    ::
    +$  init  [=time =group]
    ::
    +$  groups-ui
      (map flag group-ui)
    ::
    +$  groups
      (map flag group)
    ::
    +$  net-groups
      (map flag [net group])
    ::
    +$  log
      ((mop time diff) lte)
    ::
    ++  log-on
      ((on time diff) lte)
    ::
    +$  progress
      ?(%knocking %adding %watching %done %error)
    ::
    +$  claim
      $:  join-all=?
          =progress
      ==
    ::
    +$  gang
      $:  cam=(unit claim)
          pev=(unit preview)
          vit=(unit invite)
      ==
    ::
    +$  gangs  (map flag gang)
    --
  --
--
