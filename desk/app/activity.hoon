::
/-  *activity
/+  default-agent, verb, dbug
::
|%
+$  card  card:agent:gall
::
+$  versioned-state
  $%  state-0
  ==
::
+$  state-0
  [%0 =stream =indices]
::
=|  state-0
=*  state  -
::
%-  agent:dbug
%+  verb  |
^-  agent:gall
::
=<
  |_  =bowl:gall
  +*  this  .
      def   ~(. (default-agent this %|) bowl)
  ::
  ++  on-init  `this
  ::
  ++  on-save  !>(state)
  ::
  ++  on-load
    |=  =vase
    ^-  (quip card _this)
    =/  old  !<(versioned-state old-state)
    `this(state old)
  ::
  ++  on-poke
    |=  [=mark =vase]
    ^-  (quip card _this)
    `this
  ::
  ++  on-arvo
    |=  [=wire =sign-arvo]
    ^-  (quip card _this)
    `this
  ::
  ++  on-fail   on-fail:def
  ::
  ++  on-leave
    |=  =path
    `this
  ::
  ++  on-peek
    |=  =path
    ^-  (unit (unit cage))
    ~
  --
