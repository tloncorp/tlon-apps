::  grouper: retired, hands its state to %reel
::
::    %reel now redeems lure bites and owns the enabled-groups set. this
::    agent's only job is to run once more on upgrade and hand its old
::    state to %reel; it refuses everything else. delete it, and drop it
::    from desk.bill, in the release after %reel's state-8 ships.
::
/+  default-agent, verb, dbug
|%
+$  card  card:agent:gall
+$  versioned-state
  $%  state-0
      state-1
      state-2
      state-3
  ==
+$  state-0  [%0 enabled-groups=(set cord)]
+$  state-1  [%1 enabled-groups=(set cord) outstanding-pokes=(set (pair ship cord))]
+$  state-2  [%2 enabled-groups=(set cord) outstanding-pokes=(set (pair ship cord))]
::  pending: old state not yet acknowledged by %reel
::
+$  state-3  [%3 pending=(unit (set cord))]
--
::
=|  state-3
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
  |=  =vase
  ^-  (quip card _this)
  =+  !<(old=versioned-state vase)
  =/  pend=(unit (set cord))
    ?-  -.old
      %0  `enabled-groups.old
      %1  `enabled-groups.old
      %2  `enabled-groups.old
      %3  pending.old
    ==
  =.  state  [%3 pend]
  :_  this
  %+  weld
    ^-  (list card)
    ?~  pend  ~
    =/  =cage  noun+!>([%import-grouper u.pend])
    ~[[%pass /import %agent [our.bowl %reel] %poke cage]]
  ::  the old %grouper watched %reel for bites; %reel redeems them now
  ::
  ^-  (list card)
  ?.  (~(has by wex.bowl) [/bite-wire our.bowl %reel])  ~
  ~[[%pass /bite-wire %agent [our.bowl %reel] %leave ~]]
::
++  on-poke   on-poke:def
++  on-watch  on-watch:def
++  on-leave  on-leave:def
++  on-peek   on-peek:def
++  on-agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _this)
  ?.  ?=([%import ~] wire)  `this
  ?>  ?=(%poke-ack -.sign)
  ?~  p.sign  `this(pending ~)
  ::  keep it and try again on the next load
  ::
  %-  (slog leaf+"grouper: %reel refused import" u.p.sign)
  `this
::
::  timers and threads started by the old %grouper may still report here
::
++  on-arvo
  |=  [=wire =sign-arvo]
  ^-  (quip card _this)
  `this
::
++  on-fail   on-fail:def
--
