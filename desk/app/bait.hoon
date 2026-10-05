::  bait: forwarder to %reel
::
::    %reel now serves lure links itself, and owns the token registry and
::    the /lure binding. this agent stays in the bill because ships that
::    create links poke [provider %bait] by name. it holds no state of its
::    own once its old state has been handed to %reel.
::
::    local pokes go to %reel unchanged. remote pokes are wrapped in a
::    %forward so %reel sees the original sender.
::
/-  reel
/+  default-agent, verb, dbug, server, *reel
|%
+$  card  card:agent:gall
+$  versioned-state
  $%  state-0
      state-1
      state-2
      state-3
      state-4
  ==
::
+$  state-0
  $:  %0
      todd=(map [inviter=ship token=cord] description=cord)
  ==
+$  state-1
  $:  %1
      token-metadata=(map [inviter=ship token=cord] metadata:v0:reel)
  ==
+$  state-2
  $:  %2
      token-metadata=(map token:reel metadata:v0:reel)
  ==
+$  state-3
  $:  %3
      token-metadata=(map token:reel metadata:v1:reel)
      stable-id=(jug cord token:reel)
      branch-secret=@t
  ==
::  pending: old state not yet acknowledged by %reel
::
+$  state-4
  $:  %4
      pending=(unit [tokens=(map token:reel metadata:v1:reel) ids=(jug cord token:reel) secret=@t])
  ==
::
++  remote
  $?  %bait-describe
      %bait-undescribe
      %bait-update
      %bait-update-group
  ==
::  +upgrade: bring any pre-forwarder state up to state-3; never given %4
::
++  upgrade
  |=  old=versioned-state
  ^-  state-3
  =?  old  ?=(%0 -.old)
    *state-2
  =?  old  ?=(%1 -.old)
    =/  new-metadata
      %-  ~(gas by *(map token:reel metadata:v0:reel))
      %+  turn
        ~(tap by token-metadata.old)
      |=  [[inviter=ship =token:reel] meta=metadata:v0:reel]
      =/  new-token
        (rap 3 (scot %p inviter) '/' token ~)
      [new-token meta]
    [%2 new-metadata]
  =?  old  ?=(%2 -.old)
    :: scan the token-metadata to construct the stable-id index
    ::
    =|  stable-id=(jug cord token:reel)
    =.  stable-id
      %+  roll  ~(tap by token-metadata.old)
      |=  [[=token:reel =metadata:v0:reel] =_stable-id]
      =+  id-old=(~(get by fields.metadata) 'group')
      =+  id-new=(~(get by fields.metadata) 'invitedGroupId')
      ?~  id=(hunt |=(^ |) id-old id-new)
        stable-id
      ::  don't index personal invite links
      ?:  =(u.id '~zod/personal-invite-link')  stable-id
      (~(put ju stable-id) u.id token)
    :*  %3
        (~(run by token-metadata.old) v1:metadata:v0:conv)
        stable-id
        ''
    ==
  ?>  ?=(%3 -.old)
  old
--
::
=|  state-4
=*  state  -
%-  agent:dbug
%^  verb  |  %warn
^-  agent:gall
=<
|_  =bowl:gall
+*  this  .
    def   ~(. (default-agent this %|) bowl)
    cor   ~(. +> bowl)
::
++  on-init  `this
++  on-save  !>(state)
++  on-load
  |=  =vase
  ^-  (quip card _this)
  =+  !<(old=versioned-state vase)
  =/  pend=_pending
    ?:  ?=(%4 -.old)  pending.old
    =/  new  (upgrade old)
    `[token-metadata.new stable-id.new branch-secret.new]
  =.  state  [%4 pend]
  :_  this
  ?~(pend ~ ~[(import:cor u.pend)])
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?:  ?=(%handle-http-request mark)
    ::  eyre only reaches us between our reload and %reel taking over
    ::  our bindings, a single event later
    ::
    =+  !<([id=@ta *] vase)
    :_  this
    %+  give-simple-payload:app:server  id
    [[503 ['retry-after' '1']~] `(as-octs:mimes:html 'lure is moving to %reel')]
  ?:  =(our src):bowl
    [~[(to-reel:cor mark vase)] this]
  ?.  ?=(remote mark)
    (on-poke:def mark vase)
  [~[(to-reel:cor %noun !>(`[%forward ship cage]`[%forward src.bowl mark vase]))] this]
::
++  on-watch
  |=  =path
  ^-  (quip card _this)
  ?+  path  (on-watch:def path)
    [%http-response *]  `this
  ==
::
++  on-leave  on-leave:def
++  on-agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _this)
  ?+    wire  `this
      [%import ~]
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign  `this(pending ~)
    ::  keep it and try again on the next load
    ::
    %-  (slog leaf+"bait: %reel refused import" u.p.sign)
    `this
  ::
      [%forward ~]
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign  `this
    %-  (slog leaf+"bait: %reel refused forwarded poke" u.p.sign)
    `this
  ==
::
::  eyre binds and branch threads started by the old %bait may still
::  report here
::
++  on-arvo
  |=  [=wire =sign-arvo]
  ^-  (quip card _this)
  `this
::
::  the old scry paths, answered from %reel
::
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  =/  base  /(scot %p our.bowl)/reel/(scot %da now.bowl)/v1
  ?+    path  [~ ~]
      [%x %metadata ~]
    ``noun+!>(.^((map token:reel metadata:reel) %gx (weld base /served/noun)))
  ::
      [%x token=@ %metadata ~]
    =/  tokens  .^((map token:reel metadata:reel) %gx (weld base /served/noun))
    ?~  meta=(~(get by tokens) i.t.path)  [~ ~]
    ``noun+!>(u.meta)
  ::
      [%x %branch-secret ~]
    ``noun+!>(.^(@t %gx (weld base /branch-secret/noun)))
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
  |=  [tokens=(map token:reel metadata:reel) ids=(jug cord token:reel) secret=@t]
  ^-  card
  [%pass /import %agent [our.bowl %reel] %poke %noun !>([%import-bait tokens ids secret])]
--
