::  gateway-status: offline-reply and liveness agent for openclaw gateway
::
/-  gs=gateway-status, a=activity, av=activity-ver, cv=chat-ver, s=story
/+  default-agent, verb, dbug
|%
+$  card  card:agent:gall
::  $state-0: agent state
::
::    .owner: ship whose DMs trigger offline replies (~ = unconfigured/inert)
::    .last-owner-msg: timestamp of most recent owner DM
::    .last-owner-msg-id: key of most recent owner DM
::    .status: gateway liveness as seen by the ship
::    .boot-id: identifies the current gateway process (~ after graceful stop)
::    .lease-until: when the current heartbeat lease expires
::    .last-heartbeat: timestamp of most recent accepted heartbeat
::    .last-stop: timestamp of most recent graceful stop
::    .last-start: timestamp of most recent gateway start
::    .pending-restart: whether to send a back-online DM on next start
::    .last-auto-reply: when the last offline auto-reply was sent
::    .last-auto-reply-to: key of DM that last triggered an auto-reply (deduplication)
::    .reply-cooldown: minimum interval between offline auto-replies
::    .active-window: how recently owner must have messaged to get notices
::
+$  state-0
  $:  %0
      owner=(unit ship)
      last-owner-msg=@da
      last-owner-msg-id=(unit message-key:a)
      =status:gs
      boot-id=(unit @t)
      lease-until=(unit @da)
      last-heartbeat=(unit @da)
      last-stop=(unit @da)
      last-start=(unit @da)
      pending-restart=?
      last-auto-reply=(unit @da)
      last-auto-reply-to=(unit message-key:a)
      reply-cooldown=@dr
      active-window=@dr
  ==
::  $state-1: internal subscription logic bump
::
+$  state-1
  $:  %1
      owner=(unit ship)
      last-owner-msg=@da
      last-owner-msg-id=(unit message-key:a)
      =status:gs
      boot-id=(unit @t)
      lease-until=(unit @da)
      last-heartbeat=(unit @da)
      last-stop=(unit @da)
      last-start=(unit @da)
      pending-restart=?
      last-auto-reply=(unit @da)
      last-auto-reply-to=(unit message-key:a)
      reply-cooldown=@dr
      active-window=@dr
  ==
::
+$  versioned-state
  $%  state-0
      state-1
  ==
::
+$  current-state  state-1
::
++  migrate-state
  |=  old=versioned-state
  ^-  current-state
  ?-  -.old
    %0  $(old (migrate-0-to-1 old))
    %1  old
  ==
::
++  migrate-0-to-1
  |=  old=state-0
  ^-  state-1
  :*  %1
      owner.old
      last-owner-msg.old
      last-owner-msg-id.old
      status.old
      boot-id.old
      lease-until.old
      last-heartbeat.old
      last-stop.old
      last-start.old
      pending-restart.old
      last-auto-reply.old
      last-auto-reply-to.old
      reply-cooldown.old
      active-window.old
  ==
--
=|  current-state
=*  state  -
%-  agent:dbug
%^  verb  |  %warn
^-  agent:gall
=<
  |_  =bowl:gall
  +*  this  .
      def   ~(. (default-agent this %.n) bowl)
      cor   ~(. +> [bowl ~])
  ++  on-init
    =^  cards  state  abet:init:cor
    [cards this]
  ++  on-save  !>(state)
  ++  on-load
    |=  ole=vase
    ^-  (quip card _this)
    =/  old  !<(versioned-state ole)
    =/  migrated  (migrate-state old)
    =/  cards=(list card)
      ?:  ?=(%0 -.old)
        :~  [%pass /activity %agent [our.bowl %activity] %leave ~]
            [%pass /activity %agent [our.bowl %activity] %watch /v5]
        ==
      ~
    [cards this(state migrated)]
  ++  on-poke
    |=  [=mark =vase]
    ^-  (quip card _this)
    =^  cards  state  abet:(poke:cor mark vase)
    [cards this]
  ++  on-agent
    |=  [=wire =sign:agent:gall]
    ^-  (quip card _this)
    =^  cards  state  abet:(agent:cor wire sign)
    [cards this]
  ++  on-arvo
    |=  [=wire sign=sign-arvo]
    ^-  (quip card _this)
    =^  cards  state  abet:(arvo:cor wire sign)
    [cards this]
  ++  on-watch
    |=  =path
    ^-  (quip card _this)
    ?>  =(src our):bowl
    ?+  path  (on-watch:def path)
        [%v1 ~]
      :_  this
      [%give %fact ~ %gateway-status-update-1 !>(`update:v1:gs`[%status status lease-until])]~
    ==
  ++  on-leave  |=(path `this)
  ++  on-peek
    |=  =path
    ^-  (unit (unit cage))
    ?+  path  [~ ~]
        [%x %status ~]       ``noun+!>([status lease-until])
        [%x %owner-activity ~]  ``noun+!>(last-owner-msg)
        [%x %state ~]        ``noun+!>(state)
    ==
  ++  on-fail
    |=  [=term =tang]
    ^-  (quip card _this)
    %-  (slog 'gateway-status: on-fail' >term< tang)
    [~ this]
  --
|_  [=bowl:gall cards=(list card)]
++  cor   .
++  abet  [(flop cards) state]
++  emit  |=(=card cor(cards [card cards]))
++  give  |=(=gift:agent:gall (emit %give gift))
::
++  init
  ^+  cor
  (emit %pass /activity %agent [our.bowl %activity] %watch /v5)
::
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?>  =(src our):bowl
  ?>  ?=(%gateway-status-action-1 mark)
  =/  act  !<(action:v1:gs vase)
  ?-  -.act
    %configure          (handle-configure +.act)
    %gateway-start      (handle-gateway-start +.act)
    %gateway-heartbeat  (handle-gateway-heartbeat +.act)
    %gateway-stop       (handle-gateway-stop +.act)
  ==
::
++  cancel-lease-timer
  ^+  cor
  =/  lut  lease-until
  ?~  lut  cor
  (emit %pass /lease-check %arvo %b %rest u.lut)
::
++  status-update
  |=  [sts=status:gs lut=(unit @da)]
  ^+  cor
  (give %fact ~[/v1] %gateway-status-update-1 !>(`update:v1:gs`[%status sts lut]))
::
++  is-owner-recently-active
  |=  now=@da
  ^-  ?
  ?&  (gth last-owner-msg *@da)
      (lth (sub now last-owner-msg) active-window)
  ==
::
++  is-gateway-live
  ^-  ?
  ?&  ?=(%up status)
      ?=(^ lease-until)
      (gth u.lease-until now.bowl)
  ==
::
++  send-dm
  |=  text=@t
  ^+  cor
  =/  content=story:s  ~[[%inline ~[text]]]
  =/  =essay:v7:cv  [[content our.bowl now.bowl] chat+/ ~ ~]
  =/  =diff:dm:v7:cv  [[our.bowl now.bowl] %add essay `now.bowl]
  =/  =action:dm:v7:cv  [(need owner) diff]
  (emit %pass /dm/send %agent [our.bowl %chat] %poke %chat-dm-action-2 !>(action))
::
++  handle-configure
  |=  [who=ship aw=@dr orc=@dr]
  ^+  cor
  =.  owner  `who
  =.  active-window  aw
  =.  reply-cooldown  orc
  (status-update status lease-until)
::
++  handle-gateway-start
  |=  [bid=@t lut=@da]
  ^+  cor
  =/  owner-guard  (need owner)  ::  crash if owner not configured
  =/  should-notify  ?&(pending-restart (is-owner-recently-active now.bowl))
  =.  cor  cancel-lease-timer
  =.  status  %up
  =.  boot-id  `bid
  =.  lease-until  `lut
  =.  last-start  `now.bowl
  =.  pending-restart  |
  =.  cor  (emit %pass /lease-check %arvo %b %wait lut)
  =?  cor  should-notify
    (send-dm 'Your Tlon bot is back online and ready to chat again. ✅')
  (status-update status lease-until)
::
++  handle-gateway-heartbeat
  |=  [bid=@t lut=@da]
  ^+  cor
  =/  owner-guard  (need owner)  ::  crash if owner not configured
  ?.  =(boot-id `bid)  cor
  =.  cor  cancel-lease-timer
  =.  status  %up
  =.  pending-restart  |
  =.  lease-until  `lut
  =.  last-heartbeat  `now.bowl
  =.  cor  (emit %pass /lease-check %arvo %b %wait lut)
  (status-update status lease-until)
::
++  handle-gateway-stop
  |=  [bid=@t reason=@t]
  ^+  cor
  =/  owner-guard  (need owner)  ::  crash if owner not configured
  ?.  =(boot-id `bid)  cor
  =/  should-notify  (is-owner-recently-active now.bowl)
  =.  cor  cancel-lease-timer
  =.  status  %down
  =.  boot-id  ~
  =.  last-stop  `now.bowl
  =.  pending-restart  &
  =?  cor  should-notify
    (send-dm 'Your Tlon bot is restarting. I should be back shortly. 🔧')
  (status-update status lease-until)
::
++  agent
  |=  [=wire =sign:agent:gall]
  ^+  cor
  ?+  wire  cor
      [%activity ~]
    ?+  -.sign  cor
        %fact
      ?.  ?=(%activity-update-5 p.cage.sign)  cor
      =/  own  owner
      ?~  own  cor
      =/  upd  !<(update:v9:av q.cage.sign)
      ?.  ?=(%add -.upd)  cor
      (handle-activity-add u.own source.upd event.upd)
        %kick
      (emit %pass /activity %agent [our.bowl %activity] %watch /v5)
        %watch-ack
      ?~  p.sign  cor
      ((slog 'gateway-status: activity watch nacked' u.p.sign) cor)
    ==
      [%dm %send ~]
    ?+  -.sign  cor
        %poke-ack
      ?~  p.sign  cor
      ((slog 'gateway-status: dm send failed' u.p.sign) cor)
    ==
  ==
::
++  should-auto-reply
  |=  current-key=message-key:a
  ^-  ?
  ?:  is-gateway-live  |
  =/  lrt  last-auto-reply-to
  ?:  ?&(?=(^ lrt) =(u.lrt current-key))  |
  =/  lra  last-auto-reply
  ?:  ?&(?=(^ lra) (lth (sub now.bowl u.lra) reply-cooldown))  |
  &
::
++  handle-activity-add
  |=  [who=ship =source:a =event:a]
  ^+  cor
  =/  mkey=(unit message-key:a)
    ?+  -<.event  ~
      %dm-post   `key.event
      %dm-reply  `key.event
    ==
  ?~  mkey  cor
  =/  sender=ship  p.id.u.mkey
  ?.  =(sender who)  cor
  ?:  =(sender our.bowl)  cor
  =/  should-reply  (should-auto-reply u.mkey)
  =.  last-owner-msg  now.bowl
  =.  last-owner-msg-id  `u.mkey
  =?  last-auto-reply  should-reply  `now.bowl
  =?  last-auto-reply-to  should-reply  `u.mkey
  =.  cor  (give %fact ~[/v1] %gateway-status-update-1 !>(`update:v1:gs`[%owner-activity now.bowl]))
  ?.  should-reply  cor
  =.  cor  (send-dm 'Your Tlon bot is offline right now, so replies are paused. I\'ll let you know when I\'m back. 🛰️')
  (give %fact ~[/v1] %gateway-status-update-1 !>(`update:v1:gs`[%auto-reply who now.bowl]))
::
++  arvo
  |=  [=wire sign=sign-arvo]
  ^+  cor
  ?+  wire  cor
      [%lease-check ~]
    ?>  ?=([%behn %wake *] sign)
    ?.  =(status %up)  cor
    ?~  lease-until  cor
    ?.  (lte u.lease-until now.bowl)  cor
    %-  (slog leaf+"gateway-status: lease expired, transitioning to down" ~)
    =.  status  %down
    =.  pending-restart  &
    (status-update %down lease-until)
  ==
--
