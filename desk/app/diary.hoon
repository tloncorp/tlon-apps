/+  default-agent, dbug
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  +$  current-state  [@ *]
  ::NOTE  if @ is %2, noun contains the following, d is /sur/diary from 828f5ed:
  ::  $:  %2
  ::      =shelf:d
  ::      hidden-posts=(set time)
  ::      voc=(map [flag:d plan:d] (unit said:d))
  ::      ::  true represents imported, false pending import
  ::      imp=(map flag:d ?)
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
++  on-save  !>([state 3])
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
