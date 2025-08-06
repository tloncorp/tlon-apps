/-  g=groups, meta, e=epic, s=story
|%
::
::  common
::
+$  flag  flag:v0
+$  nest  nest:v0
+$  sect  sect:v0
::
::  versions
::
++  v7  g
++  v6
  =,  v5
  |%
  ::
  +$  preview-response
    (each preview access-error)
  ::
  +$  access-error  ?(%missing %forbidden)
  ::
  +$  gang
    $:  cam=(unit claim)
        pev=(unit preview)
        vit=(unit invite)
        err=(unit access-error)
    ==
  ::
  +$  gangs  (map flag gang)
  --
::
++  v5
  =,  v2
  |%
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
  +$  action
    (pair flag update)
  ::
  +$  update
  (pair time diff)
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
  ::
  +$  init  [=time =group]
  +$  group-ui  [group init=? count=@ud]
  +$  groups-ui  (map flag group-ui)
  +$  groups  (map flag group)
  +$  net-groups  (map flag [net group])
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
        [%sub p=time load=_|]
    ==
  ::
  +$  progress
    $?  %knocking
        %adding
        %watching
        %error
    ==
  ::
  +$  claim
    $:  join-all=?
        =progress
    ==
  ::
  +$  preview
    $:  =flag
        meta=data:meta
        =cordon
        =time
        secret=?
        count=@ud
    ==
  +$  previews  (map flag preview)
  ::
  +$  gang
    $:  cam=(unit claim)
        pev=(unit preview)
        vit=(unit invite)
    ==
  ::
  +$  gangs  (map flag gang)
  --
  ::
  ++  v2
    =,  v0
    |%
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
  +$  post-key  [post=time reply=(unit time)]
  +$  flaggers  (set ship)
  +$  flagged-content  (map nest (map post-key flaggers))
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
  --
::
++  v0
  |%
  ::
  +$  flag  (pair ship term)
  ::
  +$  nest  (pair term flag)
  ::
  +$  sect  term
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
    ::
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
  ++  cordon
    |^  cordon
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
    +$  cordon
      $%  [%open =ban:open]
          [%shut state:shut]
          [%afar =flag =path desc=@t]
      ==
    ::
    +$  diff
      $%  [%open p=diff:open]
          [%shut p=diff:shut]
          [%swap p=cordon]
      ==
    --
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
    ==
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
  +$  group-ui  [group saga=(unit saga:e)]
  +$  init  [=time =group]
  ::
  +$  groups-ui
    (map flag group-ui)
  +$  groups
    (map flag group)
  +$  net-groups
    (map flag [net group])
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
        [%sub p=time load=_| =saga:e]
    ==
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
    ==
  ::
  +$  action
    (pair flag update)
  ::
  +$  update
    (pair time diff)
  ::
  +$  join
    $:  =flag
        join-all=?
    ==
  +$  knock  flag
  ::
  +$  invite  (pair flag ship)
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
