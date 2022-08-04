/-  meta
|%
+$  flag  (pair ship term)
+$  nest  (pair dude:gall flag)
::  $sect: ID for cabal
::
+$  sect  term
::  $zone: channel group
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
    $%  [%add meta=data:meta]
        [%del ~]
        [%edit meta=data:meta]
        [%mov idx=@ud]
        [%mov-nest =nest idx=@ud]
    ==
  --
::
++  fleet
  =<  fleet
  |%
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
++  channel
  =<  channel
  |%
  +$  channels  (map nest channel)
  +$  channel
    $:  meta=data:meta
        added=time
        zone=(unit zone)
        join=?
        readers=(set sect)
    ==
  +$  diff
    $%  [%add =channel]
        [%del ~]
      ::
        [%add-sects sects=(set sect)]
        [%del-sects sects=(set sect)]
      ::
        [%add-zone =zone]
        [%del-zone ~]
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
      =cordon
      meta=data:meta
  ==
++  cabal
  =<  cabal
  |%
  ::
  +$  cabal
    [meta=data:meta ~]
  ::
  +$  diff
    $%  [%add meta=data:meta]
        [%del ~]
    ==
  --
++  cordon
  =<  cordon
  |%
  ++  open
    |%
    +$  ban  [ships=(set ship) ranks=(set rank:title)]
    +$  diff
      $%  [%add-ships p=(set ship)]
          [%del-ships p=(set ship)]
        ::
          [%add-ranks p=(set rank:title)]
          [%del-ranks p=(set rank:title)]
      ==
    --
  ++  shut
    |%
    ++  diff
      $%  [%add-ships p=(set ship)]
          [%del-ships p=(set ship)]
      ==
    --
  ::
  +$  cordon
    $%  [%shut pending=(set ship)]
        [%afar =flag =path desc=@t]
        [%open =ban:open]
    ==
  ::
  +$  diff
    $%  [%shut p=diff:shut]
        [%open p=diff:open]
        [%swap p=cordon]
    ==
  --
::  $bloc: superuser sects
++  bloc
  =<  bloc
  |%
  +$  bloc  (set sect)
  +$  diff
    $%  [%add p=(set sect)]
        [%del p=(set sect)]
    ==
  --
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
+$  action
  (pair flag update)
+$  update
  (pair time diff)
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
+$  log
  ((mop time diff) lte)
::
++  log-on
  ((on time diff) lte)
::
+$  net
  $~  [%pub ~]
  $%  [%pub p=log]
      [%sub p=time]
      [%load ~]
  ==
::
+$  join
  $:  =flag
      join-all=?
  ==
::
+$  progress
  ?(%adding %watching %done %error)
::
+$  claim
  $:  join-all=?
      =progress
  ==
::  TODO: finish
+$  preview  
  $:  meta=data:meta
      =cordon
      =time
  ==
::
+$  previews  (map flag preview)
+$  invite  (pair flag ship)
::  $gang: view of foreign group
+$  gang
  $:  cam=(unit claim)
      pev=(unit preview)
      vit=(unit invite)
  ==
::
+$  gangs  (map flag gang)
--
