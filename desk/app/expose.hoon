::  expose: one-release teardown for legacy clearweb pages
::
::  This replaces the retired renderer for one release.  Existing %expose
::  state records every page it installed in Eyre; on load, clear those pages
::  before this agent is deleted.
::
/-  c=cite
/+  hutils=http-utils, dbug, verb
::
|%
+$  card  card:agent:gall
+$  state-2
  $:  %2
      open=(set cite:c)
      eager=?
  ==
+$  state-1  [%1 open=(set cite:c)]
+$  state-0  [%0 open=(set cite:c)]
+$  versioned-state  $%(state-2 state-1 state-0)
::
++  e
  |%
  ++  clear-page
    |=  ref=cite:c
    ^-  card
    (store:hutils (cat 3 '/expose' (spat (print:c ref))) ~)
  ::
  ++  teardown-cards
    |=  [=bowl:gall open=(set cite:c)]
    ^-  (list card)
    (turn ~(tap in open) clear-page)
  --
--
::
=|  state-2
=*  state  -
%-  agent:dbug
%^  verb  |  %warn
^-  agent:gall
|_  =bowl:gall
+*  this  .
::
++  on-init
  ^-  (quip card _this)
  [~ this]
::
++  on-save  !>(state)
++  on-load
  |=  =vase
  ^-  (quip card _this)
  =+  !<(old=versioned-state vase)
  =?  old  ?=(%0 -.old)  [%1 open.old]
  =?  old  ?=(%1 -.old)  [%2 open.old &]
  ?>  ?=(%2 -.old)
  =.  state  old
  [(teardown-cards:e [bowl open.old]) this]
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  [~ this]
++  on-watch
  |=  =path
  ^-  (quip card _this)
  [~ this]
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  [~ ~]
++  on-leave  |=(* [~ this])
++  on-agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _this)
  [~ this]
++  on-arvo
  |=  [=wire =sign-arvo]
  ^-  (quip card _this)
  [~ this]
++  on-fail
  |=  [=term =tang]
  ^-  (quip card _this)
  [~ this]
--
