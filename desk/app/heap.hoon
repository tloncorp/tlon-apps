/+  default-agent, dbug
::  performance, keep warm
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  +$  current-state  [@ *]
  ::NOTE  if @ is %1, noun contains the following, h is /sur/heap from 828f5ed:
  ::  $:  =stash:h
  ::      voc=(map [flag:h time] (unit said:h))
  ::      ::  true represents imported, false pending import
  ::      imp=(map flag:h ?)
  ::      hidden-curios=(set time)
  ::  ==
  --
=|  current-state
=*  state  -
%-  agent:dbug
|_  =bowl:gall
+*  this  .
    def   ~(. (default-agent this %|) bowl)
    cor   ~(. +> [bowl ~])
++  on-init
  ^-  (quip card _this)
  `this
::
++  on-save  !>([state 1])
++  on-load
  |=  =vase
  ^-  (quip card _this)
  `this(state -:!<([current-state *] vase))
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ~|(%deprecated !!)
::
++  on-watch
  |=  =path
  ^-  (quip card _this)
  ~|(%deprecated !!)
::
++  on-peek   |=(* ~)
::
++  on-leave   on-leave:def
++  on-fail    on-fail:def
::
++  on-agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _this)
  ?<  ?=(%fact -.sign)  ::  get live subscriptions killed
  `this
::
++  on-arvo
  |=  [=wire sign=sign-arvo]
  ^-  (quip card _this)
  `this
--
