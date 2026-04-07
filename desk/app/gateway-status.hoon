::  gateway-status: offline-reply and liveness agent for openclaw gateway
::
/-  gs=gateway-status, a=activity, cv=chat-ver, s=story
/+  default-agent, verb, dbug
|%
+$  card  card:agent:gall
+$  versioned-state  state-0:gs
--
=|  versioned-state
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
    [~ this(state !<(versioned-state ole))]
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
      [%give %fact ~ %gateway-status-update-1 !>(`update-1:gs`[%status status lease-until])]~
    ==
  ++  on-leave  |=(path `this)
  ++  on-peek
    |=  =path
    ^-  (unit (unit cage))
    ?+  path  [~ ~]
        [%x %status ~]       ``noun+!>([status lease-until])
        [%x %owner-activity ~]  ``noun+!>(last-owner-message-at)
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
  (emit %pass /activity %agent [our.bowl %activity] %watch /v4)
::
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?>  =(src our):bowl
  ?>  ?=(%gateway-status-action-1 mark)
  =/  act  !<(action-1:gs vase)
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
  |=  [sts=?(%unknown %up %down) lut=(unit @da)]
  ^+  cor
  (give %fact ~[/v1] %gateway-status-update-1 !>(`update-1:gs`[%status sts lut]))
::
++  is-owner-recently-active
  |=  now=@da
  ^-  ?
  ?&  (gth last-owner-message-at *@da)
      (lth (sub now last-owner-message-at) active-window)
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
  =.  offline-reply-cooldown  orc
  (status-update status lease-until)
::
++  handle-gateway-start
  |=  [bid=@t lut=@da]
  ^+  cor
  =/  owner-guard  (need owner)  ::  crash if owner not configured
  =/  should-notify  ?&(pending-restart-notice (is-owner-recently-active now.bowl))
  =.  cor  cancel-lease-timer
  =.  status  %up
  =.  boot-id  `bid
  =.  lease-until  `lut
  =.  last-start-at  `now.bowl
  =.  pending-restart-notice  %.n
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
  =.  pending-restart-notice  %.n
  =.  lease-until  `lut
  =.  last-heartbeat-at  `now.bowl
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
  =.  last-stop-at  `now.bowl
  =.  pending-restart-notice  %.y
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
      ?.  ?=(%activity-update-4 p.cage.sign)  cor
      =/  own  owner
      ?~  own  cor
      =/  upd  !<(update:a q.cage.sign)
      ?.  ?=(%add -.upd)  cor
      (handle-activity-add u.own source.upd event.upd)
        %kick
      (emit %pass /activity %agent [our.bowl %activity] %watch /v4)
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
  ?:  (is-gateway-live:gs status lease-until now.bowl)  %.n
  =/  lrt  last-offline-auto-reply-to
  ?:  ?&(?=(^ lrt) =(u.lrt current-key))  %.n
  =/  lra  last-offline-auto-reply-at
  ?:  ?&(?=(^ lra) (lth (sub now.bowl u.lra) offline-reply-cooldown))  %.n
  %.y
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
  =.  last-owner-message-at  now.bowl
  =.  last-owner-message-id  `u.mkey
  =?  last-offline-auto-reply-at  should-reply  `now.bowl
  =?  last-offline-auto-reply-to  should-reply  `u.mkey
  =.  cor  (give %fact ~[/v1] %gateway-status-update-1 !>(`update-1:gs`[%owner-activity now.bowl]))
  ?.  should-reply  cor
  =.  cor  (send-dm 'Your Tlon bot is offline right now, so replies are paused. I\'ll let you know when I\'m back. 🛰️')
  (give %fact ~[/v1] %gateway-status-update-1 !>(`update-1:gs`[%auto-reply who now.bowl]))
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
    =.  pending-restart-notice  %.y
    (status-update %down lease-until)
  ==
--
