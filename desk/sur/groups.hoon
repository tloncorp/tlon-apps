/-  meta
|%
::
::  $flag: ID for a group
::
+$  flag  (pair ship term)
::
::  $nest: ID for a channel, {app}/{ship}/{name}
::
+$  nest  (pair dude:gall flag)
::
::  $sect: ID for cabal, similar to a role
::
+$  sect  term
::
::  $zone: channel grouping, includes its own metadata for display and
::  keeps the order of channels within.
::  
++  zone
  =<  zone
  |%
  +$  zone  @tas
  +$  realm
    $:  met=data:meta
        ord=(list nest)
    ==
  +$  diff  (pair zone delta)
  +$  delta
    $%  [%add meta=data:meta]     :: %add is used for creating a zone
        [%del ~]                  :: %del deletes the zone
        [%edit meta=data:meta]    :: %edit allows modifying a zone
        [%mov idx=@ud]            :: %mov reorders the zone in the group
        [%mov-nest =nest idx=@ud] :: %mov-nest reorders a channel within
                                  :: the zone
    ==
  --
::
::  $fleet: map of group members, holds join and sect metadata 
::
++  fleet
  =<  fleet
  |%
  +$  fleet  (map ship vessel)
  +$  vessel
    $:  sects=(set sect)  :: the member's sects
        joined=time
    ==
  +$  diff
    $%  [%add ~]                        :: add the ship to the fleet
        [%del ~]                        :: delete the ship from the fleet
        [%add-sects sects=(set sect)]   :: add sects to the ship
        [%del-sects sects=(set sect)]   :: delete sects from the ship
    ==
  --
::
::  $channel: a collection of metadata about a specific agent integration
::
++  channel
  =<  channel
  |%
  +$  channels  (map nest channel)
  +$  channel
    $:  meta=data:meta      :: title, description, image, color
        added=time          :: when the channel was created
        zone=(unit zone)    :: what zone or section to bucket in
        join=?              :: should the channel be joined by new members
        readers=(set sect)  :: what sects can see the channel, empty
                            :: means anyone
    ==
  +$  diff
    $%  [%add =channel]                 :: create a channel, should be 
                                        :: called from agent
        [%del ~]                        :: delete a channel
      ::
        [%add-sects sects=(set sect)]   :: add sects to readers
        [%del-sects sects=(set sect)]   :: delete sects from readers
      ::
        [%add-zone =zone]               :: change the zone of the channel
        [%del-zone ~]                   :: remove the channel from a zone
      ::
        [%join join=_|]                 :: toggle default join
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
      =cordon
      meta=data:meta
  ==
::
::  $cabal: metadata representing a $sect or role
::
++  cabal
  =<  cabal
  |%
  ::
  +$  cabal
    [meta=data:meta ~]
  ::
  +$  diff
    $%  [%add meta=data:meta]   :: change sect's metadata
        [%del ~]                :: delete sect's metadata
    ==
  --
::
::  $cordon: group entry and visibility permissions
::
++  cordon
  =<  cordon
  |%
  ::
  ::  $open: an open cordon represents a public group, only bans are 
  ::  barred entry
  ::
  ++  open
    |%
    ::  $ban: set of ships and ranks/classes that are not allowed entry
    ::
    +$  ban  [ships=(set ship) ranks=(set rank:title)]
    +$  diff
      $%  [%add-ships p=(set ship)]         :: add ships to bans
          [%del-ships p=(set ship)]         :: remove ships from bans
        ::
          [%add-ranks p=(set rank:title)]   :: add rank to bans
          [%del-ranks p=(set rank:title)]   :: remove rank from bans
      ==
    --
  ::
  ::  $shut: a shut cordon means that the group is closed, but still
  ::  visible. people may request entry and either be accepted or denied
  ::
  ++  shut
    |%
    ++  diff
      $%  [%add-ships p=(set ship)]   :: add ships to pending entry set
          [%del-ships p=(set ship)]   :: remove ships from pending entry
      ==
    --
  ::
  +$  cordon
    $%  [%shut pending=(set ship)]    :: see $shut above
        [%afar =flag =path desc=@t]   :: $afar is a secret group which
                                      :: only allows entry through invite
        [%open =ban:open]             :: see $open above
    ==
  ::
  +$  diff
    $%  [%shut p=diff:shut]           :: modify $shut
        [%open p=diff:open]           :: modify $open
        [%swap p=cordon]              :: change cordon completely
    ==
  --
::
::  $bloc: superuser sects
::
::    sects in bloc are allowed to make modifications to the group and
::    its various metadata and permissions
::
++  bloc
  =<  bloc
  |%
  +$  bloc  (set sect)
  +$  diff
    $%  [%add p=(set sect)]   :: add sects to the bloc
        [%del p=(set sect)]   :: remove sects from the bloc
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
      [%create p=group]
      [%del ~]
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
      color=cord
      =cordon
      members=(jug ship sect)
  ==
::
+$  init  [=time =group]
::
+$  groups
  (map flag group)
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
  $~  [%pub ~]        :: am publisher/host with fresh log
  $%  [%pub p=log]    :: start publishing with an existing log 
      [%sub p=time]   :: subscribed at time, sync log from that point
      [%load ~]       :: iniating group join
  ==
::
::  $join: a join request, can elect to join all channels
::
+$  join
  $:  =flag
      join-all=?
  ==
::
::  $progress: the state of a group join 
::
+$  progress
  ?(%adding %watching %done %error)
::
::  $claim: a mark for gangs to represent a join in progress
::
+$  claim
  $:  join-all=?
      =progress
  ==
::
::  $preview: the metadata and entry permissions for a group
::
+$  preview  
  $:  meta=data:meta
      =cordon
      =time
  ==
::
+$  previews  (map flag preview)
::
::  $invite: a marker to show you've been invited to a group
::
+$  invite  (pair flag ship)
::
::  $gang: view of foreign group
::
+$  gang
  $:  cam=(unit claim)
      pev=(unit preview)
      vit=(unit invite)
  ==
::
+$  gangs  (map flag gang)
--
