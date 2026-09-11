::  steward: harness-agnostic umbrella agent
::
::    an agent that manages our harnesses. it currently tracks the state of the
::    harness gateway, as well as execution runs for each bot message.
::
::    the bot itself runs steward as well as the bot's owner, so that things
::    like lens data can be scried locally by the owner.
::
::    modules keep their own sur
::    (sur/steward/{lens,gateway,automation}.hoon) and mark families;
::    %steward-action-1 carries only cross-cutting config (the shared owner).
::
/-  s=steward, a=activity, av=activity-ver, cv=chat-ver, st=story
/-  sl=steward-lens, sg=steward-gateway, sa=steward-automation
/+  default-agent, verb, dbug
|%
+$  card  card:agent:gall
::  versioned persisted state. state-0 is released and remains decodable for
::  migration. fresh installs and migrated agents use state-1.
::
::    .owner: shared owner ship (lens send target, gateway owner-DM tracking)
::    .bots:  owner-side trusted bots — ships allowed to send lens %entry
::            pokes cross-ship. explicit and ship-class-agnostic; an empty
::            set means only local pokes are accepted.
::
+$  versioned-state  $%(state-1 state-0)
+$  state-1
  $:  %1
      owner=(unit ship)
      bots=(set ship)
      lens=state:v1:sl
      gateway=state:v1:sg
      automation=state:v1:sa
  ==
+$  state-0
  $:  %0
      owner=(unit ship)
      bots=(set ship)
      lens=state:v1:sl
      gateway=state:v1:sg
  ==
::  default cap on first install. conservative against the per-run ceiling:
::  3.000 runs * 512KB worst-case = ~1.5GB per bot, while typical runs are far
::  smaller. ships wanting more or less can poke %steward-lens-action-1
::  %configure.
::
++  default-max-runs-per-bot  3.000
--
=|  state-1
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
    =.  max-runs-per-bot.lens.state  default-max-runs-per-bot
    [~[watch-activity:cor] this]
  ++  on-save  !>(state)
  ++  on-load
    |^  |=  ole=vase
        ^-  (quip card _this)
        =/  old=versioned-state  !<(versioned-state ole)
        =?  old  ?=(%0 -.old)  (state-0-to-1 old)
        ?>  ?=(%1 -.old)
        `this(state old)
    ::  preserve every released field and initialize the new module empty
    ::
    ++  state-0-to-1
      |=  old=state-0
      ^-  state-1
      :*  %1
          owner.old
          bots.old
          lens.old
          gateway.old
          *state:v1:sa
      ==
    --
  ++  on-poke
    |=  [=mark =vase]
    ^-  (quip card _this)
    =^  cards  state  abet:(poke:cor mark vase)
    [cards this]
  ++  on-watch
    |=  =path
    ^-  (quip card _this)
    =^  cards  state  abet:(watch:cor path)
    [cards this]
  ++  on-peek
    |=  =path
    ^-  (unit (unit cage))
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
  ::  steward-core config + trusted-bots management: local only.
  ::
      %steward-action-1
    ?>  =(src.bowl our.bowl)
    =+  !<(=action:v1:s vase)
    ?-  -.action
        %configure
      ::  a replaced owner may still hold an automation subscription
      ::  it is no longer permitted; kick it. the local ship is
      ::  always permitted, so it is never kicked
      ::
      =/  old  owner.state
      =.  owner.state  `owner.action
      ?~  old  cor
      ?:  =(u.old owner.action)  cor
      ?:  =(u.old our.bowl)  cor
      (give %kick ~[/v1/automation/tasks] `u.old)
    ::
        %trust-bot
      =.  bots.state  (~(put in bots.state) ship.action)
      (au-trust-bot:au-core ship.action)
    ::
        %untrust-bot
      =.  bots.state  (~(del in bots.state) ship.action)
      (au-untrust-bot:au-core ship.action)
    ==
  ::
  ::  lens module actions. auth is per-variant (each shape expects a
  ::  different src), so it's enforced inside le-poke-action rather than here.
  ::
      %steward-lens-action-1
    (le-poke-action:le-core !<(action:v1:sl vase))
  ::
  ::  gateway liveness: local only (enforced in ga-poke-action).
  ::
      %steward-gateway-action-1
    (ga-poke-action:ga-core !<(action:v1:sg vase))
  ::
  ::  automation snapshots. authorization is enforced in au-poke-action
  ::
      %steward-automation-action-1
    (au-poke-action:au-core !<(action:v1:sa vase))
  ==
::
::  watch auth is per-path: the automation feed admits the
::  configured owner cross-ship; every other path is local-only.
::
++  watch
  |=  =path
  ^+  cor
  ?+  path  ~|(bad-watch-path+path !!)
      [%v1 %lens *]
    ?>  =(src.bowl our.bowl)
    (le-watch:le-core [%v1 t.t.path])
  ::
      [%v1 %gateway *]
    ?>  =(src.bowl our.bowl)
    (ga-watch:ga-core [%v1 t.t.path])
  ::
      [%v1 %automation %tasks ~]
    ?>  |(=(src.bowl our.bowl) =(`src.bowl owner.state))
    au-watch-tasks:au-core
  ==
::
++  peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  [~ ~]
    [%x %v1 %lens *]        (le-peek:le-core [%v1 t.t.t.path])
    [%x %v1 %gateway *]     (ga-peek:ga-core [%v1 t.t.t.path])
    [%x %v1 %automation *]  (au-peek:au-core [%v1 t.t.t.path])
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
      [%lens %retry *]
    ?+  -.sign  cor
        %poke-ack
      ?~  p.sign  cor
      ((slog 'steward: lens retry relay nacked' u.p.sign) cor)
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
  ::
  ::  a trusted bot's automation feed: only content the payload
  ::  attributes to the wire's ship is ever applied
  ::
      [%automation %tasks @ ~]
    (au-handle-bot-sign:au-core (slav %p i.t.t.wire) sign)
  ==
::
++  arvo
  |=  [=wire sign=sign-arvo]
  ^+  cor
  ?+  wire  cor
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
  ++  recent-count  50
  ::  retention is count-bounded only; the cap lives in state and is set by
  ::  %configure (default in default-max-runs-per-bot on init / migration).
  ::  No time-based expiry — lens runs are durable memory, not transient logs.
  ::
  ::  payloads are opaque $json relayed verbatim, but a sponsored moon could
  ::  send an arbitrarily large one. cap the serialized (jammed) size so a
  ::  misbehaving or compromised gateway can't blow up loom with one poke;
  ::  the gateway-side truncates to ~50KB, this is a hard ceiling.
  ::
  ++  max-payload-bytes  524.288
  ::
  ::  lens-action auth is per-variant, since each shape expects a different
  ::  src:
  ::    %entry: src=our (the bot's own gateway pokes locally) or a ship in the
  ::            owner-side trusted-bots set (a bot we've explicitly trusted via
  ::            %trust-bot, fanning a run to us as its owner). ship-class-
  ::            agnostic — moon sponsorship is NOT an auto-trust.
  ::    %retry: src=our (a local client, or an owner-side relay forwarding to
  ::            its own bot when bot==our) or the configured owner (relaying a
  ::            retry to its bot moon).
  ::    %configure: src=our only.
  ::
  ++  le-poke-action
    |=  =action:v1:sl
    ^+  cor
    ?-  -.action
        %entry
      ?>  ?|  =(src.bowl our.bowl)
              (~(has in bots.state) src.bowl)
          ==
      (le-handle-entry id.action payload.action final.action)
    ::
        %retry
      ?>  ?|  =(src.bowl our.bowl)
              ?&  ?=(^ owner.state)
                  =(src.bowl u.owner.state)
              ==
          ==
      (le-handle-retry bot.action id.action src.bowl)
    ::
        %configure
      ?>  =(src.bowl our.bowl)
      (le-handle-configure max-runs-per-bot.action)
    ==
  ::
  ++  le-handle-configure
    |=  cap=@ud
    ^+  cor
    =.  max-runs-per-bot.lens.state  cap
    ::  the new cap takes effect on every bot immediately
    le-prune-all
  ::
  ::  the same %entry action arrives in two roles:
  ::    - bot role (src==our): our own gateway poked us; fan the run out to
  ::      our configured owner.
  ::    - owner role (src is a sponsored moon): one of our bots sent us its
  ::      run; store it keyed by src.bowl so we can serve it to clients.
  ::
  ++  le-handle-entry
    |=  [=id:v1:sl payload=json final=?]
    ^+  cor
    ::  drop oversized payloads to keep loom usage bounded
    ?:  (gth (met 3 (jam payload)) max-payload-bytes)
      %-  (slog leaf+"steward: lens payload oversized, dropping" ~)
      cor
    ?:  =(src.bowl our.bowl)
      (le-send id payload final)
    (le-store src.bowl id payload final)
  ::
  ::  retry: route based on whether we are the targeted bot or the owner-side
  ::  relay.
  ::    bot == our: we run the bot's gateway locally; emit the retry fact on
  ::                /v1/lens for the gateway to pick up. .requester is whoever
  ::                first poked (the local client, or the cross-ship owner).
  ::    bot != our: we are the owner forwarding a retry to a bot moon we own;
  ::                cross-ship poke that bot's steward, which will recognize
  ::                bot == our.bowl there and emit the fact for its gateway.
  ::  retry never mutates stored state — the gateway creates a new run with a
  ::  fresh id and pokes us back via %entry.
  ::
  ++  le-handle-retry
    |=  [bot=ship =id:v1:sl requester=ship]
    ^+  cor
    ::  only a local poke (requester==our) triggers cross-ship relay. a
    ::  retry that arrived from elsewhere (the owner) must target us — assert
    ::  bot==our so we never proxy a non-local retry on to a third ship.
    ::
    ?>  ?|(=(requester our.bowl) =(bot our.bowl))
    ?:  =(bot our.bowl)
      ::  we host the bot: hand the retry to the local gateway
      %+  give  %fact
      :*  ~[/v1/lens]
          %steward-lens-update-1
          !>(`update:v1:sl`[%retry-requested id requester])
      ==
    ::  local request for one of our remote bots: relay to its steward
    %-  emit
    :^    %pass
        /lens/retry/(scot %p bot)/(scot %t id)
      %agent
    [[bot %steward] %poke %steward-lens-action-1 !>(`action:v1:sl`[%retry bot id])]
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
      ``steward-lens-update-1+!>(`update:v1:sl`[%recent (le-recent recent-count)])
    ::
        [%v1 %recent @ ~]
      =/  count  (slav %ud i.t.t.path)
      ``steward-lens-update-1+!>(`update:v1:sl`[%recent (le-recent count)])
    ::
        [%v1 %since @ ~]
      =/  cutoff  (slav %da i.t.t.path)
      ``steward-lens-update-1+!>(`update:v1:sl`[%recent (le-since cutoff)])
    ::
        [%v1 %run @ @ ~]
      =/  bot  (slav %p i.t.t.path)
      =/  =id:v1:sl  i.t.t.t.path
      ?~  r=(~(get by runs.lens.state) [bot id])  [~ ~]
      ``steward-lens-update-1+!>(`update:v1:sl`[%entry [bot id] u.r])
    ==
  ::
  ++  le-send
    |=  [=id:v1:sl payload=json final=?]
    ^+  cor
    ?~  owner.state  cor
    ?:  =(u.owner.state our.bowl)
      ::  self-owned bot: store directly, no network hop
      (le-store our.bowl id payload final)
    %-  emit
    :^    %pass
        /lens/send/(scot %p u.owner.state)/(scot %t id)
      %agent
    :+  [u.owner.state %steward]
      %poke
    [%steward-lens-action-1 !>(`action:v1:sl`[%entry id payload final])]
  ::
  ++  le-store
    |=  [bot=ship =id:v1:sl payload=json final=?]
    ^+  cor
    ::  drop late partials once a run is finalized: overwriting would pair
    ::  complete=& with a stale partial payload (and fact it out)
    ::
    =/  prev  (~(get by runs.lens.state) [bot id])
    ?:  &(?=(^ prev) complete.u.prev !final)
      cor
    =/  =run:v1:sl  [final now.bowl payload]
    =.  runs.lens.state  (~(put by runs.lens.state) [bot id] run)
    =.  cor  (le-prune bot)
    %+  give  %fact
    :*  ~[/v1/lens]
        %steward-lens-update-1
        !>(`update:v1:sl`[%entry [bot id] run])
    ==
  ::
  ::  trim a single bot's records to .max-runs-per-bot, dropping the oldest
  ::  by .received first. invoked on every insert and on %configure.
  ::
  ++  le-prune
    |=  who=ship
    ^+  cor
    =/  mine
      %+  skim  ~(tap by runs.lens.state)
      |=  [[bot=ship *] *]
      =(bot who)
    ?:  (lte (lent mine) max-runs-per-bot.lens.state)
      cor
    =/  sorted
      %+  sort  mine
      |=  [a=[* =run:v1:sl] b=[* =run:v1:sl]]
      (lth received.run.a received.run.b)
    =/  to-drop
      (scag (sub (lent mine) max-runs-per-bot.lens.state) sorted)
    =/  keys  (turn to-drop |=([k=[bot=ship =id:v1:sl] *] k))
    |-  ^+  cor
    ?~  keys  cor
    =.  runs.lens.state  (~(del by runs.lens.state) i.keys)
    $(keys t.keys)
  ::
  ++  le-prune-all
    ^+  cor
    =/  bots=(list ship)
      %~  tap  in
      %-  ~(gas in *(set ship))
      (turn ~(tap by runs.lens.state) |=([[bot=ship *] *] bot))
    |-  ^+  cor
    ?~  bots  cor
    =.  cor  (le-prune i.bots)
    $(bots t.bots)
  ::
  ::  newest .count entries across all bots
  ::
  ++  le-recent
    |=  count=@ud
    ^-  (list entry:v1:sl)
    =/  sorted
      %+  sort  ~(tap by runs.lens.state)
      |=  [a=[* =run:v1:sl] b=[* =run:v1:sl]]
      (gth received.run.a received.run.b)
    %+  turn  (scag count sorted)
    |=  [[bot=ship =id:v1:sl] =run:v1:sl]
    `entry:v1:sl`[[bot id] run]
  ::
  ::  every entry with .received >= cutoff, newest first. the cutoff is what
  ::  lets a client page backward through history (it re-scries with the
  ::  oldest .received from the previous page); the agent itself just filters.
  ::
  ++  le-since
    |=  cutoff=@da
    ^-  (list entry:v1:sl)
    =/  fresh
      %+  skim  ~(tap by runs.lens.state)
      |=  [* =run:v1:sl]
      (gte received.run cutoff)
    =/  sorted
      %+  sort  fresh
      |=  [a=[* =run:v1:sl] b=[* =run:v1:sl]]
      (gth received.run.a received.run.b)
    %+  turn  sorted
    |=  [[bot=ship =id:v1:sl] =run:v1:sl]
    `entry:v1:sl`[[bot id] run]
  --
::  |ga-core: gateway module
::
::  liveness + offline auto-replies. owner is the shared top-level
::  (unit ship). single-owner: notices/auto-replies target it.
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
::  |au-core: automation module
::
++  au-core
  |%
  ++  au-poke-action
    |=  =action:v1:sa
    ^+  cor
    ?>  =(src.bowl our.bowl)
    ?-  -.action
        %project
      =/  projected  (au-build-task-map tasks.action)
      ::  .old reads absent-as-empty for the diff; .had keeps the
      ::  absent/empty distinction for the no-op and creation checks
      ::
      =/  old  (~(gut by tasks.automation.state) our.bowl *tasks:v1:sa)
      =/  had  (~(has by tasks.automation.state) our.bowl)
      ?:  &(=(projected old) had)  cor
      =.  tasks.automation.state
        (~(put by tasks.automation.state) our.bowl projected)
      ::  entry creation is inexpressible as task deltas: the first
      ::  accepted projection goes out as a full snapshot instead
      ::
      ?.  had  au-give-snapshot
      (au-give-deltas our.bowl old projected)
    ==
  ::
  ++  au-watch-tasks
    ^+  cor
    %+  give  %fact
    :*  ~
        %steward-automation-update-1
        !>(`update:v1:sa`[%tasks tasks.automation.state])
    ==
  ::
  ++  au-give-update
    |=  =update:v1:sa
    ^+  cor
    (give %fact ~[/v1/automation/tasks] %steward-automation-update-1 !>(update))
  ::
  ++  au-give-snapshot
    ^+  cor
    (au-give-update [%tasks tasks.automation.state])
  ::
  ++  au-give-deltas
    |=  [who=ship old=tasks:v1:sa new=tasks:v1:sa]
    ^+  cor
    =.  cor
      =/  entries  ~(tap by new)
      |-  ^+  cor
      ?~  entries  cor
      =?  cor  !=((~(get by old) p.i.entries) `q.i.entries)
        (au-give-update [%set who p.i.entries q.i.entries])
      $(entries t.entries)
    =/  entries  ~(tap by old)
    |-  ^+  cor
    ?~  entries  cor
    =?  cor  !(~(has by new) p.i.entries)
      (au-give-update [%del who p.i.entries])
    $(entries t.entries)
  ::
  ::  the local ship never gets a watch: its entry is written by
  ::  %project, not a subscription. guarding on wex.bowl (not
  ::  trust-set membership) makes a re-poke an idempotent repair
  ::  after a nacked watch without duplicating a live subscription
  ::
  ++  au-trust-bot
    |=  bot=ship
    ^+  cor
    ?:  =(bot our.bowl)  cor
    ?:  (~(has by wex.bowl) [/automation/tasks/(scot %p bot) bot %steward])
      cor
    (emit (au-watch-card bot))
  ::
  ::  the local ship is a set-only no-op: there is never a
  ::  self-subscription and the our entry is %project-owned,
  ::  untouched by trust changes
  ::
  ++  au-untrust-bot
    |=  bot=ship
    ^+  cor
    ?:  =(bot our.bowl)  cor
    =.  cor
      (emit %pass /automation/tasks/(scot %p bot) %agent [bot %steward] %leave ~)
    ?.  (~(has by tasks.automation.state) bot)  cor
    =.  tasks.automation.state  (~(del by tasks.automation.state) bot)
    (au-give-update [%gone bot])
  ::
  ++  au-watch-card
    |=  bot=ship
    ^-  card
    [%pass /automation/tasks/(scot %p bot) %agent [bot %steward] %watch /v1/automation/tasks]
  ::
  ++  au-handle-bot-sign
    |=  [bot=ship =sign:agent:gall]
    ^+  cor
    ?+  -.sign  cor
        %fact
      ::  an unexpected mark on this wire is protocol drift: crash
      ::  loudly rather than drop the fact
      ::
      ?>  ?=(%steward-automation-update-1 p.cage.sign)
      (au-apply-bot-update bot !<(update:v1:sa q.cage.sign))
    ::
    ::  the fresh subscription's snapshot repairs anything missed
    ::  while unsubscribed
    ::
        %kick
      ?.  (~(has in bots.state) bot)  cor
      (emit (au-watch-card bot))
    ::
        %watch-ack
      ?~  p.sign  cor
      ((slog 'steward: automation watch nacked' u.p.sign) cor)
    ==
  ::
  ++  au-apply-bot-update
    |=  [bot=ship =update:v1:sa]
    ^+  cor
    ?-  -.update
    ::  a snapshot is the bot's complete statement: replace the bot's
    ::  entry with its entry in the snapshot, deleting ours when the
    ::  snapshot lacks it (wiped-bot repair). content for any other
    ::  ship is ignored — the receiver-side transitive-relay guard
    ::
        %tasks
      =/  theirs  (~(get by tasks.update) bot)
      =/  ours  (~(get by tasks.automation.state) bot)
      ?:  =(theirs ours)  cor
      ?~  theirs
        =.  tasks.automation.state
          (~(del by tasks.automation.state) bot)
        (au-give-update [%gone bot])
      ?~  ours
        =.  tasks.automation.state
          (~(put by tasks.automation.state) bot u.theirs)
        au-give-snapshot
      =.  tasks.automation.state
        (~(put by tasks.automation.state) bot u.theirs)
      (au-give-deltas bot u.ours u.theirs)
    ::
    ::  deltas naming any other ship are ignored (relay guard), and a
    ::  delta never creates an entry: mirroring starts at the first
    ::  snapshot containing the bot
    ::
        %set
      ?.  =(ship.update bot)  cor
      ?~  entry=(~(get by tasks.automation.state) bot)  cor
      =.  tasks.automation.state
        %+  ~(put by tasks.automation.state)  bot
        (~(put by u.entry) id.update task.update)
      (au-give-update [%set bot id.update task.update])
    ::
        %del
      ?.  =(ship.update bot)  cor
      ?~  entry=(~(get by tasks.automation.state) bot)  cor
      ?.  (~(has by u.entry) id.update)  cor
      =.  tasks.automation.state
        %+  ~(put by tasks.automation.state)  bot
        (~(del by u.entry) id.update)
      (au-give-update [%del bot id.update])
    ::
        %gone
      ?.  =(ship.update bot)  cor
      ?.  (~(has by tasks.automation.state) bot)  cor
      =.  tasks.automation.state
        (~(del by tasks.automation.state) bot)
      (au-give-update [%gone bot])
    ==
  ::
  ++  au-peek
    |=  =path
    ^-  (unit (unit cage))
    ?+  path  [~ ~]
        [%v1 %tasks ~]
      ``steward-automation-tasks-1+!>(tasks.automation.state)
    ==
  ::  build the complete replacement before mutating state. a payload
  ::  with a duplicate ID crashes here, leaving the previous projection
  ::  untouched.
  ::
  ++  au-build-task-map
    |=  entries=(list identified-task:v1:sa)
    ^-  tasks:v1:sa
    =/  projected=tasks:v1:sa  *tasks:v1:sa
    |-
    ?~  entries  projected
    =/  entry=identified-task:v1:sa  i.entries
    ?>  ?=(~ (~(get by projected) id.entry))
    %=  $
      entries    t.entries
      projected  (~(put by projected) id.entry task.entry)
    ==
  --
--
