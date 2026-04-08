::  presence: short-lived personal activity indication
::
::    contexts are paths refering to dms, channels and groups.
::    participants subscribe to the context host at a personalized path.
::    participants poke the context host with presence, containing
::    display and timeout deets, and optional disclosure set.
::    context host fans the update out to participants as a fact.
::
::    presence is considered "owned" by the host of the context, in the
::    same way that channel contents and group metadata are.
::    dms are an exception here too: when poking ourselves with an action,
::    we put the counterparty in the context, but when subscribing to the
::    counterparty, we put ourselves in the context, because that's the
::    context _from their perspective_.
::
::    we use personalized subscription paths so that two parties can
::    communicate presence to each other in a public channel without
::    signalling that presence to all channel members. the channel host
::    still acts as intermediary, but does not store the presence unless it
::    itself is in the disclosure set.
::
::    context hosts do not give initial facts to subscribers. timing out of
::    presences does not get propagated to subscribers, but explicit %clear
::    does. (the latter goes out to _all_ subscribers, regardless of the
::    disclosure set of the prior presence.)
::
::    we do not solve for clock skew, instead respecting the received
::    timestamps and timeouts as-is, and ignoring any that have expired
::    by the time we receive them. if it's in the future, treat it as now.
::
::TODO  make chat, channels clear %typing whenever we receive a msg?
::TODO  discipline
::
/-  *presence, cv=channels-ver
/+  dbug, verb
::
|%
::NOTE  .want contains a [ship context] pair, because for ease-of-use we
::      specify the context as it exists _on their end_ (which is relevant for
::      the dm case).
::      wires only contain the context, because src.bowl indicates the ship.
+$  state-0
  $:  %0
      =places
      :: ships=(jug ship context)
    ::
      want=(set [ship context])  ::  desired outgoing subs
      subs=(jug context ship)    ::  real incoming subs
      ::TODO  wack=(set ship)    ::  waiting for acks (load prevention)
  ==
::
+$  card  card:agent:gall
::
++  default-timeout
  |=  =topic
  ^-  @dr
  ?-  topic
    %typing     ~s30
    %computing  ~m1
    %other      ~s30
  ==
::
++  context-host
  |=  [=context our=@p]
  ^-  ship
  ?+  context  !!
    [%dm @ ~]                          our
    [%channel kind=@ ship=@ name=@ ~]  (slav %p i.t.t.context)
    [%group ship=@ term=@ ~]           (slav %p i.t.context)
  ==
::
++  put-presence
  |=  [=places key =timing =display]
  ^+  places
  %+  ~(put by places)  context
  =+  tos=(~(gut by places) context *topics)
  %+  ~(put by tos)  topic
  =+  pes=(~(gut by tos) topic *people)
  (~(put by pes) ship timing display)
::
++  del-presence
  |=  [=places key]
  ^+  places
  =/  tos  (~(gut by places) context *topics)
  =/  pes  (~(gut by tos) topic *people)
  =.  pes  (~(del by pes) ship)
  =.  tos  ?:  =(~ pes)  (~(del by tos) topic)
           (~(put by tos) topic pes)
  ?:  =(~ tos)  (~(del by places) context)
  (~(put by places) context tos)
::
++  give-update
  |=  [subs=(jug context ship) disclose=(set ship) upd=update-1]
  ^-  (list card)
  =/  =key  ?-(-.upd %set key.upd, %clear key.upd)
  =/  s
    ?:  =(~ disclose)  (~(get ju subs) context.key)
    (~(int in disclose) (~(get ju subs) context.key))
  ?:  =(~ s)  ~
  =/  paz=(list path)
    %+  turn  ~(tap in s)
    |=(s=ship `path`[%context (scot %p s) context.key])
  [%give %fact paz %presence-update-1 !>(upd)]~
::
++  give-response
  |=  res=response-1
  ^-  card
  [%give %fact ~[/v1] %presence-response-1 !>(`response-1`res)]
::
++  await-setup
  |=  [wen=@da wat=(unit [s=ship c=context])]
  ^-  card
  =;  =wire  [%pass wire %arvo %b %wait wen]
  [%setup ?~(wat ~ [(scot %p s.u.wat) c.u.wat])]
::
++  dm-contexts
  |=  =bowl:gall
  ^-  (set [ship context])
  %.  (late /dm/(scot %p our.bowl))
  %~  run  in
  .^  (set ship)  %gx
    /(scot %p our.bowl)/chat/(scot %da now.bowl)/dm/ships
  ==
::
++  channel-contexts
  |=  =bowl:gall
  ^-  (set [ship context])
  %.  |=  nest:v9:cv
      [ship /channel/[kind]/(scot %p ship)/[name]]
  %~  run  in
  %~  key  by
  .^  channels:v9:cv  %gx
    /(scot %p our.bowl)/channels/(scot %da now.bowl)/v4/channels/channels-4
  ==
::
++  watch-context
  |=  [our=ship who=ship =context]
  ^-  card
  ?<  =(our who)
  ::NOTE  we watch-as, so the publisher will attempt conversion.
  ::      this will work as long as we're aligned or behind the publisher.
  ::      ⚠️ if we're ahead and ask about a mark they don't know,
  ::      conversion will fail, we will get get kicked!
  :+  %pass      [%context context]
  :+  %agent     [who %presence]
  :+  %watch-as  %presence-update-1
  [%context (scot %p our) context]
::
++  inflate
  |=  [=bowl:gall want=(set [ship context])]
  ^-  (list card)
  ;:  weld
    ::  leave contexts that we have but don't want
    ::
    %+  murn  ~(tap by wex.bowl)
    |=  [[=wire =ship =term] *]
    ^-  (unit card)
    ?.  ?=([%context *] wire)  ~
    =*  context  t.wire
    ?:  (~(has in want) ship context)  ~
    `[%pass wire %agent [ship term] %leave ~]
  ::
    ::  watch contexts that we don't have but want
    ::
    %+  murn  ~(tap in want)
    |=  [=ship =context]
    ^-  (unit card)
    ?:  =(ship our.bowl)  ~  ::  don't subscribe to ourselves
    =/  =wire  [%context context]
    ?:  (~(has by wex.bowl) wire ship dap.bowl)  ~
    `(watch-context our.bowl ship context)
  ::
    ::  ensure we have local subs in place
    ::
    %+  murn
      ^-  (list [wire dude:gall path])
      :~  [/chat/invited %chat /dm/invited]  ::REVIEW  not firing as often as expected..?
          [/channels/all %channels /v3]  ::REVIEW  can we watch anything "smaller"?
      ==
    |=  [=wire =dude:gall =path]
    ^-  (unit card)
    ?:  (~(has by wex.bowl) wire our.bowl dude)  ~
    `[%pass wire %agent [our.bowl dude] %watch path]
  ==
--
::
=|  state-0
=*  state  -
::
%-  agent:dbug
%^  verb  &  %warn
::
^-  agent:gall
|_  =bowl:gall
+*  this  .
++  on-init
  ^-  (quip card _this)
  :-  [(await-setup now.bowl ~)]~
  this
::
++  on-save  !>(state)
::
++  on-load
  |=  ole=vase
  ^-  (quip card _this)
  :-  [(await-setup now.bowl ~)]~
  this(state !<(state-0 ole))
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ~|  mark=mark
  ?>  =(src our):bowl
  ?+  mark  !!
      %presence-action-1
    =+  !<(act=action-1 vase)
    ?:  ?=(%nuke -.act)
      ::TODO  response?
      [~ this(places (~(del by places) context))]
    =;  =cage
      =/  =key     ?-(-.act %set key.act, %clear key.act)
      =/  host=@p  (context-host context.key our.bowl)
      [[%pass [%context context.key] %agent [host dap.bowl] %poke cage]~ this]
    :-  %presence-command-1
    !>  ^-  command-1
    ?-  -.act
      %set    act(timeout [now.bowl timeout.act])
      %clear  act
    ==
  ::
      %presence-command-1
    =+  !<(cmd=command-1 vase)
    =/  =key  ?-(-.cmd %set key.cmd, %clear key.cmd)
    ~|  [context=context.key src=src.bowl]
    ::  only acceptable if we are the context host,
    ::  and the sender could be a participant,
    ::  and it's a presence for the sender
    ::
    ?>  =(our.bowl (context-host context.key our.bowl))
    ?>  |(!?=([%dm *] context.key) =(our src):bowl)
    ?>  =(src.bowl ship.key)
    ?-  -.cmd
        %set
      ::  ack but no-op on timed out presence
      ::
      =?  since.timing.cmd  (gth since.timing.cmd now.bowl)
        now.bowl
      =/  end=@da
        %+  add  since.timing.cmd
        (fall timeout.timing.cmd (default-timeout topic.key.cmd))
      ?:  (gth now.bowl end)
        ::TODO  maybe delete existing one at key?
        [~ this]
      =/  fus=(list card)
        %+  give-update
          (~(del ju subs) context.key.cmd src.bowl)
        [disclose.cmd %set +>.cmd]
      ?.  (~(has in disclose.cmd) our.bowl)
        [fus this]
      ::TODO  send response too?
      :_  this(places (put-presence places +>.cmd))
      :+  (give-response %here +>.cmd)
        :+  %pass
          ::TODO  +key-wire
          [%expire (scot %p ship.key.cmd) topic.key.cmd context.key.cmd]
        [%arvo %b %wait end]
      fus
    ::
        %clear
      ::TODO  no-op if we didn't have it anyway
      :_  this(places (del-presence places key.cmd))
      :-  (give-response %gone key.cmd)
      %+  give-update
        (~(del ju subs) context.key.cmd src.bowl)
      [~ %clear key.cmd]
    ==
  ==
::
++  on-watch
  |=  =path
  ^-  (quip card _this)
  ?+  path  !!
      [%v1 ~]
    ?>  =(src our):bowl
    :_  this
    [%give %fact ~ %presence-response-1 !>(`response-1`[%init places])]~
  ::
      [%context @ *]
    ::  context watch paths must be properly personalized
    ::
    ?>  =(src.bowl (slav %p i.t.path))
    =.  subs  (~(put ju subs) t.t.path src.bowl)
    ::NOTE  no initial fact, since all data is short-lived,        ::REVIEW
    ::      and we don't want to hot-loop on mark incompatibility  ::REVIEW
    [~ this]
  ==
::
++  on-leave
  |=  =path
  ^-  (quip card _this)
  ?+  path  [~ this]
      [%context @ *]
    =.  subs  (~(del ju subs) t.t.path src.bowl)
    [~ this]
  ==
::
++  on-agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _this)
  ~|  wire=wire
  ?+  wire  ~|(%strange-wire !!)
      ?([%chat %invited ~] [%channels %all ~])
    ?-  -.sign
      %poke-ack  ~|(%unexpeced-poke-ack !!)
    ::
        %kick
      ::  re-do setup after brief wait, preventing hot-looping.
      ::  particularly important here because it's a local subscription.
      ::
      [[(await-setup (add now.bowl ~s30) ~)]~ this]
    ::
        %watch-ack
      ?~  p.sign  [~ this]
      ::TODO  log formally
      %-  (slog (rap 3 dap.bowl ' rejected by local for ' (spat wire) ~) u.p.sign)
      [~ this]
    ::
        %fact
      ?-  wire
          [%chat %invited ~]
        ?.  ?=(%ships p.cage.sign)
          ::TODO  log formally
          [~ this]
        ::  if nothing new, no-op. otherwise, initiate setup/inflation.
        ::  we do full setup instead of adding piecemeal, so that we can
        ::  catch & clean up deletions more easily.
        ::
        ?:  %-  ~(all in !<((set ship) q.cage.sign))
            |=  who=ship
            (~(has in want) who /dm/(scot %p our.bowl))
          [~ this]
        ::  setup will scry out relevant dms
        ::
        [[(await-setup now.bowl ~)]~ this]
      ::
          [%channels %all ~]
        ?.  ?=(%channel-response-4 p.cage.sign)
          ::TODO  log formally
          [~ this]
        ::TODO  would love to do a smaller sub, so we don't end up doing these
        ::      checks for literally anything that happens in channels agent...
        =+  !<(rc=r-channels:v9:cv q.cage.sign)
        ::  never subscribe to ourselves
        ::
        ?:  =(our.bowl ship.nest.rc)  [~ this]
        =/  new=[=ship context]
          =,  nest.rc
          [ship /channel/[kind]/(scot %p ship)/[name]]
        ::  if it was previously unknown, register and subscribe
        ::
        ?:  (~(has in want) new)  [~ this]
        [[(watch-context our.bowl new)]~ this(want (~(put in want) new))]
      ==
    ==
  ::
      [%context *]
    =*  context  t.wire
    ?-  -.sign
        %poke-ack
      ?~  p.sign  [~ this]
      %.  [~ this]
      ::TODO  log formally
      (slog (rap 3 dap.bowl ': poke-nacked by ' (scot %p src.bowl) ~) u.p.sign)
    ::
        %kick
      :_  this
      ::  resubscribe after brief wait, prevent hot-looping
      ::
      [(await-setup (add now.bowl ~s15) `[src.bowl context])]~
    ::
        %watch-ack
      ?~  p.sign  [~ this]
      ::  nacked, can't do anything, drop desire
      ::
      [~ this(want (~(del by want) src.bowl context))]
    ::
        %fact
      ?.  ?=(%presence-update-1 p.cage.sign)
        ::NOTE  unexpected because we %watch-as in +watch-context
        ::TODO  log formally
        [~ this]
      =+  !<(upd=update-1 q.cage.sign)
      ?-  -.upd
          %set
        =?  since.timing.upd  (gth since.timing.upd now.bowl)
          now.bowl
        =/  end=@da
          %+  add  since.timing.upd
          (fall timeout.timing.upd (default-timeout topic.key.upd))
        ?:  (gth now.bowl end)
          ::TODO  maybe delete existing one at key?
          [~ this]
        ::TODO  should we be adjusting the context.key.upd to the local
        ::      perspective? or does sender take care of that?
        ::      dm context paths hard to track...
        :_  this(places (put-presence places +.upd))
        :~  (give-response %here +.upd)
            :+  %pass
              ::TODO  +key-wire
              [%expire (scot %p ship.key.upd) topic.key.upd context.key.upd]
            [%arvo %b %wait end]
        ==
      ::
          %clear
        ::TODO  no-op if we didn't have it anyway
        :_  this(places (del-presence places key.upd))
        [(give-response %gone key.upd)]~
      ==
    ==
  ==
::
++  on-arvo
  |=  [=wire sign=sign-arvo]
  ^-  (quip card _this)
  ~|  wire=wire
  ?+  wire  ~|(%strange-wire !!)
      [%setup ?(~ ^)]
    ?>  ?=([%behn %wake *] sign)
    ?^  error.sign
      ::TODO  log formally
      %.  [~ this]
      (slog (rap 3 dap.bowl ': failed wake on ' (spat wire) ~) u.error.sign)
    ?~  t.wire
      ::  ensure we .want all relevant contexts, then inflate fully.
      ::  this implicitly drops any contexts not in +channel- or +dm-contexts!
      ::
      =.  want
        %-  ~(uni in (dm-contexts bowl))
        (channel-contexts bowl)
      [(inflate bowl want) this]
    ::  set up subscription for a specific context
    ::
    =/  =ship  (slav %p i.t.wire)
    ?<  =(ship our.bowl)  ::  don't subscribe to ourselves
    =*  context  t.t.wire
    ?:  (~(has by wex.bowl) [%context context] ship dap.bowl)
      [~ this]
    [[(watch-context our.bowl ship context)]~ this]
  ::
      [%expire @ topic *]
    ::TODO  +wire-key
    =/  =ship    (slav %p i.t.wire)
    =*  topic    i.t.t.wire
    =*  context  t.t.t.wire
    =*  key      [context ship topic]
    ::TODO  no-op if we didn't have it anyway
    =.  places   (del-presence places key)
    [[(give-response %gone key)]~ this]
  ==
::
++  on-fail
  |=  [=term =tang]
  ^-  (quip card _this)
  ::TODO  want to ~(del by want) if ?=(%fact term) but don't know the wire...
  %.  [~ this]
  (slog (rap 3 dap.bowl ': +on-fail: ' term ~) tang)
::
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  ~
      [%x %v1 %init ~]
    ``presence-response-1+!>(`response-1`[%init places])
  ==
--
