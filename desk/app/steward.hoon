::  steward: harness-agnostic umbrella agent
::
::    an agent that manages our harnesses. it currently tracks the state of the
::    harness gateway, as well as execution runs for each bot message.
::
::    the bot itself runs steward as well as the bot's owner, so that things
::    like lens data can be scried locally by the owner.
::
::    modules keep their own sur (sur/steward/{lens,gateway}.hoon) and marks
::    (%steward-{lens,gateway}-{action,update}-1); %steward-action-1 carries
::    only cross-cutting config (the shared owner).
::
/-  s=steward, a=activity, av=activity-ver, cv=chat-ver, st=story
/-  sl=steward-lens, sg=steward-gateway
/+  default-agent, verb, dbug
|%
+$  card  card:agent:gall
+$  state-0
  $:  %0
      owner=(unit ship)
      lens=state:v1:sl
      gateway=state:v1:sg
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
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?+  mark  ~|(bad-poke-mark+mark !!)
  ::
  ::  steward-core config: local only.
  ::
      %steward-action-1
    ?>  =(src.bowl our.bowl)
    =+  !<(=action:v1:s vase)
    ?-  -.action
      %configure  cor(owner.state `owner.action)
    ==
  ::
  ::  lens runs: accepted from ourselves, or from a ship we sponsor (jael is
  ::  the authority, via +sein:title). a bot is typically a moon of the owner
  ::  planet, so the owner accepts runs from itself and its own moons;
  ::  sponsorship rejects comets and unrelated ships. owner-role stores keyed
  ::  by src.
  ::
      %steward-lens-action-1
    ?>  ?|  =(src.bowl our.bowl)
            =(our.bowl (sein:title our.bowl now.bowl src.bowl))
        ==
    (le-poke-action:le-core !<(action:v1:sl vase))
  ::
  ::  gateway liveness: local only (enforced in ga-poke-action).
  ::
      %steward-gateway-action-1
    (ga-poke-action:ga-core !<(action:v1:sg vase))
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
      [%lens %send *]
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
      ::TODO resubscription loop
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
::  |le-core: lens module
::
++  le-core
  |%
  ++  max-runs-per-bot  1.000
  ++  max-run-age       ~d90
  ++  prune-interval    ~d1
  ++  recent-count      50
  ::
  ++  wait-prune
    ^-  card
    [%pass /lens/prune %arvo %b %wait (add now.bowl prune-interval)]
  ::
  ++  le-expired
    |=  =run:v1:sl
    ^-  ?
    (lth received.run (sub now.bowl max-run-age))
  ::  +le-poke-action: handle lens poke
  ::
  ::  the same action arrives in two roles (the ownership gate in +poke has
  ::  already vetted src as ourselves or a moon we sponsor):
  ::    - bot role (src==our): our own gateway poked us; send the run out
  ::      to our configured owner.
  ::    - owner role (src is a sponsored moon): one of our bots sent us its
  ::      run; store it keyed by src.bowl so we can serve it to clients.
  ::
  ::
  ++  le-poke-action
    |=  =action:v1:sl
    ^+  cor
    ?:  =(src.bowl our.bowl)
      (le-send id.action payload.action final.action)
    (le-store src.bowl id.action payload.action final.action)
  ::
  ++  le-watch
    |=  =path
    ^+  cor
    ?+  path  ~|(bad-lens-watch-path+path !!)
      ::  no initial fact — clients backfill via /x/v1/lens/recent
      [%v1 ~]  cor
    ==
  ::
  ++  le-peek
    |=  =path
    ^-  (unit (unit cage))
    ?+  path  [~ ~]
        [%v1 %recent ~]
      ``steward-lens-update-list-1+!>(le-recent)
    ::
        [%v1 %run @ @ ~]
      =/  bot  (slav %p i.t.t.path)
      =/  =id:v1:sl  i.t.t.t.path
      ?~  r=(~(get by lens.state) [bot id])  [~ ~]
      ?:  (le-expired u.r)  [~ ~]
      ``steward-lens-update-1+!>(`update:v1:sl`[[bot id] u.r])
    ==
  ::
  ++  le-send
    |=  [=id:v1:sl payload=json final=?]
    ^+  cor
    ?~  owner.state  cor
    ?:  =(u.owner.state our.bowl)
      ::  self-owned bot: store directly, no network hop
      (le-store our.bowl id payload final)
    =/  =action:v1:sl  [id payload final]
    %-  emit
    :^    %pass
        /lens/send/(scot %p u.owner.state)/(scot %t id)
      %agent
    [[u.owner.state %steward] %poke %steward-lens-action-1 !>(`action:v1:sl`action)]
  ::
  ++  le-store
    |=  [bot=ship =id:v1:sl payload=json final=?]
    ^+  cor
    ::  drop late partials once a run is finalized: overwriting would pair
    ::  complete=& with a stale partial payload (and fact it out)
    ::
    =/  prev  (~(get by lens.state) [bot id])
    ?:  &(?=(^ prev) complete.u.prev !final)
      cor
    =/  =run:v1:sl  [final now.bowl payload]
    =.  lens.state  (~(put by lens.state) [bot id] run)
    =.  cor  (le-prune bot)
    (give %fact ~[/v1/lens] %steward-lens-update-1 !>(`update:v1:sl`[[bot id] run]))
  ::
  ++  le-prune
    |=  for=ship
    ^+  cor
    =/  mine=(list entry:sl)
      %+  skim  ~(tap by lens.state)
      |=  [[bot=ship *] *]
      =(bot for)
    =/  [live=(list entry:sl) dead=(list entry:sl)]
      %+  skid  mine
      |=  [* =run:v1:sl]
      !(le-expired run)
    ::  we mark any live runs above the fixed limit as dead
    ::
    =?  dead  (gth (lent live) max-runs-per-bot)
      =/  sorted
        %+  sort  live
        |=  [a=[* =run:v1:sl] b=[* =run:v1:sl]]
        (lth received.run.a received.run.b)
      (weld dead (scag (sub (lent live) max-runs-per-bot) sorted))
    =/  keys  (turn dead |=([k=[bot=ship =id:v1:sl] *] k))
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
    ^-  (list update:v1:sl)
    =/  fresh=(list entry:sl)
      %+  skip  ~(tap by lens.state)
      |=  [* =run:v1:sl]
      (le-expired run)
    =/  sorted=(list entry:sl)
      %+  sort  fresh
      |=  [a=[* =run:v1:sl] b=[* =run:v1:sl]]
      (gth received.run.a received.run.b)
    %+  turn  (scag recent-count sorted)
    |=  [[bot=ship =id:v1:sl] =run:v1:sl]
    [[bot id] run]
  --
::  |ga-core: gateway module
::
::  liveness + offline auto-replies. owner is the shared
::  top-level (unit ship). single-owner: notices/auto-replies target it.
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
        %steward-gateway-update-1
        !>(`update:v1:sg`[%status status.gateway.state lease-until.gateway.state])
    ==
  ::
  ++  ga-give-update
    |=  =update:v1:sg
    ^+  cor
    (give %fact ~[/v1/gateway] %steward-gateway-update-1 !>(update))
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
    |=  =action:v1:sg
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
