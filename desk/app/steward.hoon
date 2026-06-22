::  steward: harness-agnostic umbrella agent
::
::    an agent that manages our harnesses. it currently tracks the state of the
::    harness gateway, as well as execution runs for each bot message.
::
::    the bot itself runs steward as well as the bot's owner, so that things
::    like lens data can be scried locally by the owner.
::
/-  s=steward, a=activity, av=activity-ver, cv=chat-ver, st=story
/+  default-agent, verb, dbug
|%
+$  card  card:agent:gall
+$  state-0
  $:  %0
      owner=(unit ship)
      lens=state:lens:s
      gateway=state:gateway:s
  ==
::
--
=|  state-0
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
    ^-  (quip card _this)
    [~[wait-prune:le-core:cor watch-activity:cor] this]
  ++  on-save  !>(state)
  ++  on-load
    |=  ole=vase
    ^-  (quip card _this)
    =/  attempt  (mule |.(!<(state-0 ole)))
    ?:  ?=(%& -.attempt)
      [~ this(state p.attempt)]
    %-  (slog 'steward: on-load state mismatch, resetting to bunt' ~)
    [~[wait-prune:le-core:cor watch-activity:cor] this]
  ++  on-poke
    |=  [=mark =vase]
    ^-  (quip card _this)
    =^  cards  state  abet:(poke:cor mark vase)
    [cards this]
  ++  on-watch
    |=  =path
    ^-  (quip card _this)
    ?>  =(src our):bowl
    =^  cards  state  abet:(watch:cor path)
    [cards this]
  ++  on-peek
    |=  =path
    ^-  (unit (unit cage))
    ?>  =(src our):bowl
    (peek:cor path)
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
  ++  on-leave  |=(path `this)
  ++  on-fail
    |=  [=term =tang]
    ^-  (quip card _this)
    %-  (slog 'steward: on-fail' >term< tang)
    [~ this]
  --
|_  [=bowl:gall cards=(list card)]
++  cor   .
++  abet  [(flop cards) state]
++  emit  |=(=card cor(cards [card cards]))
++  give  |=(=gift:agent:gall (emit %give gift))
::
::  %steward-action-1 is accepted from ourselves, or from a ship we
::  sponsor (jael is the authority, via +sein:title). a bot is typically
::  a moon of the owner planet, so the owner accepts lens runs from itself
::  and from its own moons; sponsorship rejects comets and unrelated ships.
::
::  %configure and %gateway sub-actions additionally require src==our: only
::  the local gateway sets the owner / drives liveness. %lens is the one
::  action a sponsored moon may submit (its runs, stored keyed by src).
::
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?+  mark  ~|(bad-poke-mark+mark !!)
      %steward-action-1
    ?>  ?|  =(src.bowl our.bowl)
            =(our.bowl (sein:title our.bowl now.bowl src.bowl))
        ==
    =+  !<(=action:v1:s vase)
    ?-  -.action
      %configure  ?>(=(src.bowl our.bowl) cor(owner.state `owner.action))
      %lens       (le-poke-action:le-core action.action)
      %gateway    (ga-poke-action:ga-core action.action)
    ==
  ==
::
++  watch
  |=  =path
  ^+  cor
  ?+  path  ~|(bad-watch-path+path !!)
    [%v1 %lens *]     (le-watch:le-core [%v1 t.t.path])
    [%v1 %gateway *]  (ga-watch:ga-core [%v1 t.t.path])
  ==
::
++  peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  [~ ~]
    [%x %v1 %lens *]     (le-peek:le-core [%v1 t.t.t.path])
    [%x %v1 %gateway *]  (ga-peek:ga-core [%v1 t.t.t.path])
  ==
::
++  agent
  |=  [=wire =sign:agent:gall]
  ^+  cor
  ?+  wire  cor
      [%lens %fanout *]
    ?+  -.sign  cor
        %poke-ack
      ?~  p.sign  cor
      ((slog 'steward: lens run fan-out nacked' u.p.sign) cor)
    ==
  ::
      [%activity ~]
    ?+    -.sign  cor
        %fact
      ?.  ?=(%activity-update-5 p.cage.sign)  cor
      ?:  ?=(~ owner.state)  cor
      =+  !<(=update:v9:av q.cage.sign)
      ?.  ?=(%add -.update)  cor
      (ga-handle-activity-add:ga-core source.update event.update)
    ::
        %kick
      (emit watch-activity)
    ::
        %watch-ack
      ?~  p.sign  cor
      ((slog 'steward: activity watch nacked' u.p.sign) cor)
    ==
  ::
      [%gateway %dm %send ~]
    ?+  -.sign  cor
        %poke-ack
      ?~  p.sign  cor
      ((slog 'steward: gateway dm send failed' u.p.sign) cor)
    ==
  ==
::
++  arvo
  |=  [=wire sign=sign-arvo]
  ^+  cor
  ?+  wire  cor
      [%lens %prune ~]
    ?.  ?=([%behn %wake *] sign)  cor
    =?  cor  ?=(^ error.sign)
      ((slog 'steward: lens prune wake failed' u.error.sign) cor)
    =.  cor  le-prune-all:le-core
    (emit wait-prune:le-core)
  ::
      [%gateway %lease-check ~]
    ?.  ?=([%behn %wake *] sign)  cor
    ga-lease-check:ga-core
  ==
::
++  watch-activity
  ^-  card
  [%pass /activity %agent [our.bowl %activity] %watch /v5]
::
++  le-core
  |%
  ++  max-runs-per-bot  ^-  @ud  1.000
  ++  max-run-age       ^-  @dr  ~d90
  ++  prune-interval    ^-  @dr  ~d1
  ::
  ++  wait-prune
    ^-  card
    [%pass /lens/prune %arvo %b %wait (add now.bowl prune-interval)]
  ::
  ++  le-expired
    |=  =run:lens:s
    ^-  ?
    (lth received.run (sub now.bowl max-run-age))
  ::
  ::  the same action arrives in two roles (the ownership gate in +poke
  ::  has already vetted src as ourselves or a moon we sponsor):
  ::    - bot role (src==our): our own gateway poked us; fan the run out
  ::      to our configured owner.
  ::    - owner role (src is a sponsored moon): one of our bots sent us
  ::      its run; store it keyed by src.bowl so we can serve it to clients.
  ::
  ++  le-poke-action
    |=  =action:lens:s
    ^+  cor
    ?:  =(src.bowl our.bowl)
      (le-fan-out id.action payload.action final.action)
    (le-store src.bowl id.action payload.action final.action)
  ::
  ++  le-watch
    |=  =path
    ^+  cor
    ?+  path  ~|(bad-lens-watch-path+path !!)
      ::  no initial fact — clients backfill via /x/lens/recent
      [%v1 ~]  cor
    ==
  ::
  ++  le-peek
    |=  =path
    ^-  (unit (unit cage))
    ?+  path  [~ ~]
        [%v1 %recent ~]
      ``noun+!>(le-recent)
    ::
        [%v1 %run @ @ ~]
      =/  bot  (slav %p i.t.t.path)
      =/  =id:lens:s  i.t.t.t.path
      ?~  r=(~(get by lens.state) [bot id])  [~ ~]
      ?:  (le-expired u.r)  [~ ~]
      ``steward-update-1+!>(`update:v1:s`[%lens bot id u.r])
    ==
  ::
  ++  le-fan-out
    |=  [=id:lens:s =payload:lens:s final=?]
    ^+  cor
    ?~  owner.state  cor
    ?:  =(u.owner.state our.bowl)
      ::  self-owned bot: store directly, no network hop
      (le-store our.bowl id payload final)
    =/  =action:lens:s  [id payload final]
    %-  emit
    :^    %pass
        /lens/fanout/(scot %p u.owner.state)/(scot %t id)
      %agent
    [[u.owner.state %steward] %poke %steward-action-1 !>(`action:v1:s`[%lens action])]
  ::
  ++  le-store
    |=  [bot=ship =id:lens:s =payload:lens:s final=?]
    ^+  cor
    ::  drop late partials once a run is finalized: overwriting would
    ::  pair complete=& with a stale partial payload (and fact it out)
    ::
    =/  prev  (~(get by lens.state) [bot id])
    ?:  &(?=(^ prev) complete.u.prev !final)
      cor
    =/  =run:lens:s  [final now.bowl payload]
    =.  lens.state  (~(put by lens.state) [bot id] run)
    =.  cor  (le-prune bot)
    %+  give  %fact
    :*  ~[/v1/lens]
        %steward-update-1
        !>(`update:v1:s`[%lens bot id run])
    ==
  ::
  ++  le-prune
    |=  for=ship
    ^+  cor
    =/  mine
      %+  skim  ~(tap by lens.state)
      |=  [[bot=ship *] *]
      =(bot for)
    =/  dead
      %+  skim  mine
      |=  [* =run:lens:s]
      (le-expired run)
    =/  live
      %+  skip  mine
      |=  [* =run:lens:s]
      (le-expired run)
    =?  dead  (gth (lent live) max-runs-per-bot)
      =/  sorted
        %+  sort  live
        |=  [a=[* =run:lens:s] b=[* =run:lens:s]]
        (lth received.run.a received.run.b)
      (weld dead (scag (sub (lent live) max-runs-per-bot) sorted))
    =/  keys  (turn dead |=([k=[bot=ship =id:lens:s] *] k))
    |-  ^+  cor
    ?~  keys  cor
    =.  lens.state  (~(del by lens.state) i.keys)
    $(keys t.keys)
  ::
  ++  le-prune-all
    ^+  cor
    =/  bots=(list ship)
      %~  tap  in
      %-  ~(gas in *(set ship))
      (turn ~(tap by lens.state) |=([[bot=ship *] *] bot))
    |-  ^+  cor
    ?~  bots  cor
    =.  cor  (le-prune i.bots)
    $(bots t.bots)
  ::
  ++  le-recent
    ^-  (list update:lens:s)
    =/  fresh
      %+  skip  ~(tap by lens.state)
      |=  [* =run:lens:s]
      (le-expired run)
    =/  sorted
      %+  sort  fresh
      |=  [a=[* =run:lens:s] b=[* =run:lens:s]]
      (gth received.run.a received.run.b)
    %+  turn  (scag 50 sorted)
    |=  [[bot=ship =id:lens:s] =run:lens:s]
    [bot id run]
  --
::
++  ga-core
  |%
  ++  ga-has-owner  ^-  ?  ?=(^ owner.state)
  ::
  ++  ga-is-gateway-live
    ^-  ?
    ?&  ?=(%up status.gateway.state)
        ?=(^ lease-until.gateway.state)
        (gth u.lease-until.gateway.state now.bowl)
    ==
  ::
  ++  ga-is-owner-recently-active
    |=  now=@da
    ^-  ?
    ?&  (gth last-owner-msg.gateway.state *@da)
        (lth (sub now last-owner-msg.gateway.state) active-window.gateway.state)
    ==
  ::
  ++  ga-cancel-lease-timer
    |=  lease=(unit @da)
    ^+  cor
    ?~  lease  cor
    (emit %pass /gateway/lease-check %arvo %b %rest u.lease)
  ::
  ++  ga-give-status-update
    ^+  cor
    %+  give  %fact
    :*  ~[/v1/gateway]
        %steward-update-1
        !>(`update:v1:s`[%gateway %status status.gateway.state lease-until.gateway.state])
    ==
  ::
  ++  ga-give-update
    |=  =update:gateway:s
    ^+  cor
    (give %fact ~[/v1/gateway] %steward-update-1 !>(`update:v1:s`[%gateway update]))
  ::
  ++  ga-send-dm
    |=  [target=ship text=@t]
    ^+  cor
    =/  content=story:st  ~[[%inline ~[text]]]
    =/  =essay:v7:cv  [[content our.bowl now.bowl] chat+/ ~ ~]
    =/  =diff:dm:v7:cv  [[our.bowl now.bowl] %add essay `now.bowl]
    =/  =action:dm:v7:cv  [target diff]
    (emit %pass /gateway/dm/send %agent [our.bowl %chat] %poke %chat-dm-action-2 !>(action))
  ::
  ::  restart/back-online notices go to the currently configured owner,
  ::  not whoever last messaged (which may be a since-replaced owner).
  ::
  ++  ga-notice-target
    ^-  (unit ship)
    owner.state
  ::
  ++  ga-poke-action
    |=  =action:gateway:s
    ^+  cor
    ?>  =(src.bowl our.bowl)
    ?-  -.action
      %configure          (ga-handle-configure active-window.action reply-cooldown.action)
      %gateway-start      (ga-handle-start boot-id.action lease-until.action)
      %gateway-heartbeat  (ga-handle-heartbeat boot-id.action lease-until.action)
      %gateway-stop       (ga-handle-stop boot-id.action reason.action)
    ==
  ::
  ++  ga-watch
    |=  =path
    ^+  cor
    ?+  path  ~|(bad-gateway-watch-path+path !!)
      [%v1 ~]  ga-give-status-update
    ==
  ::
  ++  ga-peek
    |=  =path
    ^-  (unit (unit cage))
    ?+  path  [~ ~]
        [%v1 %status ~]          ``noun+!>([status.gateway.state lease-until.gateway.state])
        [%v1 %owner-activity ~]  ``noun+!>(last-owner-msg.gateway.state)
    ==
  ::
  ++  ga-handle-configure
    |=  [win=@dr orc=@dr]
    ^+  cor
    =.  active-window.gateway.state  win
    =.  reply-cooldown.gateway.state  orc
    ga-give-status-update
  ::
  ++  ga-handle-start
    |=  [bid=@t lut=@da]
    ^+  cor
    ?>  ga-has-owner
    =.  status.gateway.state  %up
    =.  boot-id.gateway.state  `bid
    =.  cor  (ga-cancel-lease-timer lease-until.gateway.state)
    =.  lease-until.gateway.state  `lut
    =.  last-start.gateway.state  `now.bowl
    =.  cor  (emit %pass /gateway/lease-check %arvo %b %wait lut)
    =?  cor
        ?&  pending-restart.gateway.state
            (ga-is-owner-recently-active now.bowl)
        ==
      =/  tgt  ga-notice-target
      ?~  tgt  cor
      (ga-send-dm u.tgt 'Your Tlon bot is back online and ready to chat again. ✅')
    =.  pending-restart.gateway.state  |
    ga-give-status-update
  ::
  ++  ga-handle-heartbeat
    |=  [bid=@t lut=@da]
    ^+  cor
    ?>  ga-has-owner
    ?.  =(boot-id.gateway.state `bid)  cor
    =.  status.gateway.state  %up
    =.  pending-restart.gateway.state  |
    =.  cor  (ga-cancel-lease-timer lease-until.gateway.state)
    =.  lease-until.gateway.state  `lut
    =.  last-heartbeat.gateway.state  `now.bowl
    =.  cor  (emit %pass /gateway/lease-check %arvo %b %wait lut)
    ga-give-status-update
  ::
  ++  ga-handle-stop
    |=  [bid=@t reason=@t]
    ^+  cor
    ?>  ga-has-owner
    ?.  =(boot-id.gateway.state `bid)  cor
    =.  status.gateway.state  %down
    =.  boot-id.gateway.state  ~
    =.  cor  (ga-cancel-lease-timer lease-until.gateway.state)
    =.  last-stop.gateway.state  `now.bowl
    =.  pending-restart.gateway.state  &
    =?  cor  (ga-is-owner-recently-active now.bowl)
      =/  tgt  ga-notice-target
      ?~  tgt  cor
      (ga-send-dm u.tgt 'Your Tlon bot is restarting. I should be back shortly. 🔧')
    ga-give-status-update
  ::
  ++  ga-lease-check
    ^+  cor
    =/  st  status.gateway.state
    ?.  ?=(%up st)  cor
    =/  lut  lease-until.gateway.state
    ?~  lut  cor
    ?.  (lte u.lut now.bowl)  cor
    %-  (slog leaf+"steward: gateway lease expired, transitioning to down" ~)
    =.  status.gateway.state  %down
    =.  pending-restart.gateway.state  &
    ga-give-status-update
  ::
  ++  ga-should-auto-reply
    |=  current-key=message-key:a
    ^-  ?
    ?:  ga-is-gateway-live  |
    ?:  ?&  ?=(^ last-auto-reply-to.gateway.state)
            =(u.last-auto-reply-to.gateway.state current-key)
        ==
      |
    ?:  ?&  ?=(^ last-auto-reply.gateway.state)
            (lth (sub now.bowl u.last-auto-reply.gateway.state) reply-cooldown.gateway.state)
        ==
      |
    &
  ::
  ++  ga-handle-activity-add
    |=  [=source:a =event:a]
    ^+  cor
    =/  mkey=(unit message-key:a)
      ?+  -<.event  ~
        %dm-post   `key.event
        %dm-reply  `key.event
      ==
    ?~  mkey  cor
    =*  sender  p.id.u.mkey
    ?.  =(`sender owner.state)  cor
    ?:  =(sender our.bowl)  cor
    =.  last-owner-msg.gateway.state  now.bowl
    =.  last-owner-msg-id.gateway.state  `u.mkey
    =.  cor  (ga-give-update [%owner-activity now.bowl])
    =+  should-reply=(ga-should-auto-reply u.mkey)
    =?  last-auto-reply.gateway.state  should-reply  `now.bowl
    =?  last-auto-reply-to.gateway.state  should-reply  `u.mkey
    ?.  should-reply  cor
    =.  cor
      (ga-send-dm sender 'Your Tlon bot is offline right now, so replies are paused. I\'ll let you know when I\'m back. 🛰️')
    (ga-give-update [%auto-reply sender now.bowl])
  --
--
