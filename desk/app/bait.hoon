::  bait: retired, hands its state to %reel
::
::    %reel now serves lure links, owns the token registry and binds /lure;
::    ships poke the provider's %reel directly. this agent's only job is to
::    run once more on upgrade and hand its old state to %reel; it refuses
::    everything else. delete it, and drop it from desk.bill, in the
::    release after %reel's state-8 ships.
::
/-  reel
/+  default-agent, verb, dbug, *reel
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
::  +upgrade: bring any pre-retirement state up to state-3; never given %4
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
  %-  (slog leaf+"bait: %reel refused import" u.p.sign)
  `this
::
::  eyre binds and branch threads started by the old %bait may still
::  report here
::
++  on-arvo
  |=  [=wire =sign-arvo]
  ^-  (quip card _this)
  `this
::
++  on-fail   on-fail:def
--
|_  =bowl:gall
++  import
  |=  [tokens=(map token:reel metadata:reel) ids=(jug cord token:reel) secret=@t]
  ^-  card
  [%pass /import %agent [our.bowl %reel] %poke %noun !>([%import-bait tokens ids secret])]
--
