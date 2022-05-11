|%
+$  flag  (pair ship term)
::  $sect: ID for cabal
::
+$  sect  term
::  $bloc: app-specific $sect
::
+$  bloc  (pair dude:gall sect) 
++  fleet
  =<  fleet
  |%
  +$  fleet  (map ship vessel)
  +$  vessel
    $:  sects=(set sect)
        joined=time
    ==
  +$  diff
    $%  [%add =vessel]
        [%del ~]
        [%add-sects sects=(set sect)]
        [%del-sects sects=(set sect)]
    ==
  --
::
++  meta
  =<  meta
  |%
  +$  meta
    $:  title=cord
        description=cord
        image=cord
    ==
  --
::
++  channel
  =<  channel
  |%
  +$  channels  (map flag channel)
  +$  channel
    $:  =meta
        added=time
        readers=(set sect)
    ==
  +$  diff
    $%  [%add =channel]
        [%del ~]
      ::
        [%add-sects sects=(set sect)]
        [%del-sects sects=(set sect)]
    ==
  --
::
+$  group
  $:  =fleet
      cabals=(map sect cabal)
      =channels:channel
      =cordon
      =meta
  ==
++  cabal
  =<  cabal
  |%
  ::
  +$  cabal
    [=meta ~]
  ::
  +$  diff
    $%  [%add =meta]
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
+$  diff
  $%  [%fleet p=ship q=diff:fleet]
      [%cabal p=sect q=diff:cabal]
      [%channel p=flag q=diff:channel]
      [%cordon p=diff:cordon]
      [%create p=group]
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
  ==
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
  $:  =meta
      =cordon
      =time
  ==
::
+$  invite  ~
::  $gang: view of foreign group
+$  gang
  $:  cam=(unit claim)
      pev=(unit preview)
      vit=(unit invite)
  ==
::
+$  gangs  (map flag gang)
--
