::  grouper: forwarder to %reel
::
::    %reel now redeems lure bites itself and owns the enabled-groups set.
::    this agent stays in the bill because other ships still poke
::    [ship %grouper] to ask whether a group accepts lure joins, and older
::    clients poke and subscribe to it by name. it holds no state of its
::    own once its old state has been handed to %reel.
::
::    local pokes go to %reel unchanged. the two remote pokes are wrapped
::    in a %forward so %reel sees the original sender. subscriptions are
::    proxied to the same path on %reel.
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
+$  state-3
  $:  %3
      pending=(unit [enabled=(set cord) asks=(set (pair ship cord))])
  ==
--
::
=|  state-3
=*  state  -
%-  agent:dbug
%^  verb  |  %warn
^-  agent:gall
=<
|_  =bowl:gall
+*  this  .
    def   ~(. (default-agent this %.n) bowl)
    cor   ~(. +> bowl)
::
++  on-init  `this
++  on-save  !>(state)
++  on-load
  |=  =vase
  ^-  (quip card _this)
  =+  !<(old=versioned-state vase)
  =/  pend=(unit [(set cord) (set (pair ship cord))])
    ?-  -.old
      %0  `[enabled-groups.old ~]
      %1  `[enabled-groups.old outstanding-pokes.old]
      %2  `[enabled-groups.old outstanding-pokes.old]
      %3  pending.old
    ==
  =.  state  [%3 pend]
  :_  this
  %+  weld
    ^-  (list card)
    ?~(pend ~ ~[(import:cor u.pend)])
  ::  the old %grouper watched %reel for bites; %reel redeems them now
  ::
  ^-  (list card)
  ?.  (~(has by wex.bowl) [/bite-wire our.bowl %reel])  ~
  ~[[%pass /bite-wire %agent [our.bowl %reel] %leave ~]]
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?:  =(our src):bowl
    [~[(to-reel:cor mark vase)] this]
  ?.  ?=(?(%grouper-ask-enabled %grouper-answer-enabled) mark)
    (on-poke:def mark vase)
  [~[(to-reel:cor %noun !>(`[%forward ship cage]`[%forward src.bowl mark vase]))] this]
::
++  on-watch
  |=  =path
  ^-  (quip card _this)
  ?>  =(our src):bowl
  :_  this
  ?:  (~(has by wex.bowl) [[%proxy path] our.bowl %reel])  ~
  ~[[%pass [%proxy path] %agent [our.bowl %reel] %watch path]]
::
++  on-leave
  |=  =path
  ^-  (quip card _this)
  ::  stop proxying once nobody else is subscribed to this path
  ::
  =/  others
    %+  skim  ~(val by sup.bowl)
    |=([ship p=^path] =(p path))
  ?:  (gth (lent others) 1)  `this
  ?.  (~(has by wex.bowl) [[%proxy path] our.bowl %reel])  `this
  [~[[%pass [%proxy path] %agent [our.bowl %reel] %leave ~]] this]
::
++  on-agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _this)
  ?+    wire  `this
      [%import ~]
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign  `this(pending ~)
    ::  keep it and try again on the next load
    ::
    %-  (slog leaf+"grouper: %reel refused import" u.p.sign)
    `this
  ::
      [%forward ~]
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign  `this
    %-  (slog leaf+"grouper: %reel refused forwarded poke" u.p.sign)
    `this
  ::
      [%proxy *]
    =*  path  t.wire
    ?-  -.sign
      %poke-ack   `this
      %fact       [~[[%give %fact ~[path] cage.sign]] this]
      %kick       [~[[%give %kick ~[path] ~]] this]
    ::
        %watch-ack
      ?~  p.sign  `this
      [~[[%give %kick ~[path] ~]] this]
    ==
  ==
::
::  timers and threads started by the old %grouper may still report here
::
++  on-arvo
  |=  [=wire =sign-arvo]
  ^-  (quip card _this)
  `this
::
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  [~ ~]
      [%x %enabled @ ~]
    =/  =json
      .^(json %gx (scot %p our.bowl) %reel (scot %da now.bowl) /v1/enabled/[i.t.t.path]/json)
    ``json+!>(json)
  ==
::
++  on-fail   on-fail:def
--
|_  =bowl:gall
++  to-reel
  |=  [=mark =vase]
  ^-  card
  [%pass /forward %agent [our.bowl %reel] %poke mark vase]
::
++  import
  |=  [enabled=(set cord) asks=(set (pair ship cord))]
  ^-  card
  [%pass /import %agent [our.bowl %reel] %poke %noun !>([%import-grouper enabled asks])]
--
