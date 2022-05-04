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
  +$  type
    ?(%open %secret %private)
  +$  cordon
    $%  [%open ~]
        [%secret ~]
        [%private ~]
    ==
  +$  diff
    [%change p=type]
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
      =time
  ==
::  $gang: view of foreign group
+$  gang
  $:  cam=(unit claim)
      pev=(unit preview)
  ==
--
