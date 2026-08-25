::  vouch: a store of moon classifications (real / bot / unknown)
::
::    v1 is deliberately dumb: a map from a moon to what we know about it,
::    written by pokes and read by scry. it does no routing or relaying --
::    agents that talk to a moon scry here first and do their own routing.
::
::    writers:
::    - %vouch-learn: a local agent records a moon it has classified. only
::      accepted from our own ship (a moon seen as .src is recorded %real; a
::      moon steward spawned is recorded %bot).
::    - %vouch-real: a foreign sponsor declares one of its moons real, so we
::      stop proxying through the host and talk to it directly. accepted only
::      when .src sponsors the moon (+vouches-for).
::
/-  v=vouch
/+  default-agent, verb, dbug
|%
+$  card  card:agent:gall
+$  versioned-state
  $%  state-0
  ==
+$  state-0
  $:  %0
      moons=(map ship known:v)
  ==
::  +vouches-for: may .src speak for .who? true when identical, or when .who
::  is a moon whose fixed sponsor (pure +^sein:title, no jael scry) is .src.
::  mirrors +vouches-for in /lib/channel-utils; kept local so the store has
::  no heavy dependency. candidate to dedupe into a shared lib later.
::
++  vouches-for
  |=  [src=ship who=ship]
  ^-  ?
  ?:  =(src who)  &
  ?&  ?=(%earl (clan:title who))
      =(src (^sein:title who))
  ==
--
::
=|  state-0
=*  state  -
%-  agent:dbug
%^  verb  |  %warn
^-  agent:gall
|_  =bowl:gall
+*  this  .
    def   ~(. (default-agent this %.n) bowl)
::
++  on-init  `this
++  on-save  !>(state)
++  on-load
  |=  old-state=vase
  ^-  (quip card _this)
  =/  old  !<(versioned-state old-state)
  `this(state old)
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?+  mark  (on-poke:def mark vase)
  ::  local classification: record %real or %bot for a moon
  ::
      %vouch-learn
    ?>  =(src.bowl our.bowl)
    =+  !<([=ship known=known:v] vase)
    `this(moons (~(put by moons) ship known))
  ::  foreign push: a sponsor declares one of its moons real
  ::
      %vouch-real
    =+  !<(moon=ship vase)
    ?>  (vouches-for src.bowl moon)
    `this(moons (~(put by moons) moon %real))
  ==
::
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  [~ ~]
  ::  /x/status/<moon> -> the moon's status (%unknown if no record). the
  ::  trailing element (a mark like %noun on a gall %gx scry) is ignored.
  ::
      [%x %status @ *]
    =/  moon  (slav %p i.t.t.path)
    =/  =status:v  (~(gut by moons) moon %unknown)
    ``noun+!>(status)
  ==
::
++  on-agent  on-agent:def
++  on-watch  on-watch:def
++  on-leave  on-leave:def
++  on-arvo   on-arvo:def
++  on-fail   on-fail:def
--
