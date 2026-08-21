::  steward: harness-agnostic umbrella agent
::
::    an agent that manages our harnesses. it currently tracks the state of the
::    harness gateway, execution runs for each bot message, and the roster of
::    bot moons we've minted.
::
::    the bot itself runs steward as well as the bot's owner, so that things
::    like lens data can be scried locally by the owner.
::
::    modules keep their own sur (sur/steward/{lens,gateway,roster}.hoon) and
::    marks (%steward-{lens,gateway,roster}-{action,update}-1);
::    %steward-action-1 carries only cross-cutting config (the shared owner).
::
/-  s=steward, a=activity, av=activity-ver, cv=chat-ver, st=story
/-  sl=steward-lens, sg=steward-gateway, sr=steward-roster
/-  v=vouch, ct=contacts
/+  default-agent, verb, dbug
|%
+$  card  card:agent:gall
::  steward now runs on live hosted ships carrying meaningful gateway lease
::  state, so state-0 -> state-1 is a REAL migration (not the greenfield
::  reset-to-bunt this used to be): state-1 only adds the .roster module
::  slice, lifting an old state-0 in with a bunted roster.
::
::    .owner: shared owner ship (lens send target, gateway owner-DM tracking)
::    .bots:  owner-side trusted bots — ships allowed to send lens %entry
::            pokes cross-ship. explicit and ship-class-agnostic; an empty
::            set means only local pokes are accepted.
::
+$  versioned-state
  $%  state-0
      state-1
  ==
::
+$  state-0
  $:  %0
      owner=(unit ship)
      bots=(set ship)
      lens=state:v1:sl
      gateway=state:v1:sg
  ==
::
+$  state-1
  $:  %1
      owner=(unit ship)
      bots=(set ship)
      lens=state:v1:sl
      gateway=state:v1:sg
      roster=state:v1:sr
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
    |=  ole=vase
    ^-  (quip card _this)
    =/  old  !<(versioned-state ole)
    ::  state-0 -> state-1: add the roster module slice, bunted (nothing
    ::  minted yet under the old state). state-1 loads as-is.
    ::
    ?-  -.old
        %0
      `this(state [%1 owner.old bots.old lens.old gateway.old *state:v1:sr])
    ::
        %1
      `this(state old)
    ==
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
  ::  steward-core config + trusted-bots management: local only.
  ::
      %steward-action-1
    ?>  =(src.bowl our.bowl)
    =+  !<(=action:v1:s vase)
    ?-  -.action
      %configure    cor(owner.state `owner.action)
      %trust-bot    cor(bots.state (~(put in bots.state) ship.action))
      %untrust-bot  cor(bots.state (~(del in bots.state) ship.action))
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
  ::  roster: mint/configure/retire bot moons. local only (enforced in
  ::  ro-poke-action).
  ::
      %steward-roster-action-1
    (ro-poke-action:ro-core !<(action:v1:sr vase))
  ==
::
++  watch
  |=  =path
  ^+  cor
  ?+  path  ~|(bad-watch-path+path !!)
    [%v1 %lens *]     (le-watch:le-core [%v1 t.t.path])
    [%v1 %gateway *]  (ga-watch:ga-core [%v1 t.t.path])
    [%v1 %roster *]   (ro-watch:ro-core [%v1 t.t.path])
  ==
::
++  peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  [~ ~]
    [%x %v1 %lens *]     (le-peek:le-core [%v1 t.t.t.path])
    [%x %v1 %gateway *]  (ga-peek:ga-core [%v1 t.t.t.path])
    [%x %v1 %roster *]   (ro-peek:ro-core [%v1 t.t.t.path])
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
      [%roster %vouch *]
    ?+  -.sign  cor
        %poke-ack
      ?~  p.sign  cor
      ((slog 'steward: roster vouch classify nacked' u.p.sign) cor)
    ==
  ::
      [%roster %profile *]
    ?+  -.sign  cor
        %poke-ack
      ?~  p.sign  cor
      ((slog 'steward: roster profile publish nacked' u.p.sign) cor)
    ==
  ::
      [%roster %claim *]
    ?+  -.sign  cor
        %poke-ack
      ?~  p.sign  cor
      ((slog 'steward: roster bots-claim nacked' u.p.sign) cor)
    ==
  ==
::
++  arvo
  |=  [=wire sign=sign-arvo]
  ^+  cor
  ?+  wire  cor
      [%gateway %lease-check ~]
    ?.  ?=([%behn %wake *] sign)  cor
    ga-lease-check:ga-core
  ::
      [%roster %mint @ ~]
    ?.  ?=([%jael %done *] sign)  cor
    ?~  error.sign  cor
    =/  mon  (slav %p i.t.t.wire)
    %-  (slog leaf+"steward: roster mint failed for {(scow %p mon)}" tang.u.error.sign)
    =.  bots.roster.state  (~(del by bots.roster.state) mon)
    (give %fact ~[/v1/roster] %steward-roster-update-1 !>(`update:v1:sr`[%retired mon]))
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
::  |ro-core: roster module
::
::  mints bot moons: spawns+reserves a moon under us via jael, classifies it
::  %bot in vouch, publishes its profile via contacts, and records its
::  runner config. every action is local only (an owner mints its own
::  bots) -- enforced once in ro-poke-action, not per-variant, since every
::  roster shape expects the same src.
::
++  ro-core
  |%
  ::  only a ship that can sponsor a moon (galaxy/star/planet) may mint one;
  ::  a moon or comet has no room under it to spawn a bot into.
  ::
  ++  ro-can-host
    ^-  ?
    ?=(?(%czar %king %duke) (clan:title our.bowl))
  ::
  ++  ro-poke-action
    |=  =action:v1:sr
    ^+  cor
    ?>  =(src.bowl our.bowl)
    ?-  -.action
        %mint
      %+  ro-handle-mint  nickname.action
      [avatar.action model.action harness.action persona.action]
    ::
        %configure
      %+  ro-handle-configure  ship.action
      [nickname.action avatar.action model.action harness.action persona.action]
    ::
        %retire
      (ro-handle-retire ship.action)
    ==
  ::
  ++  ro-watch
    |=  =path
    ^+  cor
    ?+  path  ~|(bad-roster-watch-path+path !!)
        [%v1 ~]
      ::  paths ~: the %init fact goes only to the subscription being
      ::  opened, not to every existing /v1/roster subscriber.
      %+  give  %fact
      :*  ~
          %steward-roster-update-1
          !>(`update:v1:sr`[%init bots.roster.state])
      ==
    ==
  ::
  ++  ro-peek
    |=  =path
    ^-  (unit (unit cage))
    ?+  path  [~ ~]
        [%v1 ~]
      ``noun+!>(bots.roster.state)
    ::
        [%v1 @ *]
      =/  who  (slav %p i.t.path)
      ?~  got=(~(get by bots.roster.state) who)  [~ ~]
      ``noun+!>(u.got)
    ==
  ::
  ::  pick a fresh moon under us: a random 32-bit suffix over our @p (the
  ::  same shape |moon uses), retried up to 16 times against a collision on
  ::  either side:
  ::    - jael's own %ryft scry: a non-~ result means keys are already set
  ::      for that ship, whether from a real (booted) point or a previous
  ::      %moon registration.
  ::    - our own roster: covers the (unlikely) case where a prior mint's
  ::      jael registration succeeded but we haven't processed its %done
  ::      ack yet.
  ::
  ++  ro-pick-moon
    |=  tries=@ud
    ^-  ship
    ?:  (gte tries 16)
      ~|  %roster-moon-picks-exhausted
      !!
    =/  cand=ship
      (add our.bowl (lsh 5 (end 5 (shaz (mix eny.bowl tries)))))
    =/  ryf=(unit rift)
      .^((unit rift) %j /(scot %p our.bowl)/ryft/(scot %da now.bowl)/(scot %p cand))
    ?:  |(?=(^ ryf) (~(has by bots.roster.state) cand))
      $(tries +(tries))
    cand
  ::
  ++  ro-build-contact
    |=  [nickname=@t avatar=(unit @t)]
    ^-  contact:ct
    %-  malt
    ^-  (list (pair @tas value:ct))
    =/  base  [%nickname [%text nickname]]~
    ?~  avatar  base
    [[%avatar [%look u.avatar]] base]
  ::
  ::  +ro-claim: claim a moon in our own published profile's %bots field (a
  ::  native contact %set of %ship values): minting IS the owner claiming,
  ::  and clients recognize our bots from the claim without consulting
  ::  %vouch. merged with the current set; the scry degrades to an empty
  ::  profile so a contacts hiccup can't fail the mint. idempotent (sets),
  ::  so %configure re-asserts it as a repair path.
  ::
  ++  ro-claim
    |=  mon=ship
    ^+  cor
    =/  cur=contact:ct
      =/  res
        %-  mule
        |.  .^(contact:ct %gx /(scot %p our.bowl)/contacts/(scot %da now.bowl)/v1/self/noun)
      ?:(?=(%& -.res) p.res *contact:ct)
    =/  claim=(set value:ct)
      =/  old  (~(get by cur) %bots)
      ?:  ?=([~ %set *] old)  p.u.old
      *(set value:ct)
    =/  bots-val=value:ct  [%set (~(put in claim) `value:ct`[%ship mon])]
    %-  emit
    :*  %pass  /roster/claim/(scot %p mon)  %agent  [our.bowl %contacts]
        %poke  %contact-action-1
        !>(`action:ct`[%self (malt ~[[%bots bots-val]])])
    ==
  ::
  ++  ro-handle-mint
    |=  [nickname=@t avatar=(unit @t) model=@t harness=@t persona=@t]
    ^+  cor
    ?>  ro-can-host
    =/  mon=ship  (ro-pick-moon 0)
    ::  derive the moon's keypair locally and register only the PUBLIC
    ::  half with jael (life 1, crypto suite %b/crub). the private seed is
    ::  never slogged, stored, or emitted -- it's discarded the instant
    ::  we're done deriving .pass, right here. this is deliberate: a bot
    ::  moon is unbootable by design, so nobody -- not even us -- can ever
    ::  assume its identity. if the owner ever wants a real, bootable moon
    ::  instead, |moon-cycle-keys replaces these keys with ones it
    ::  actually keeps.
    ::
    =/  cic  (pit:nu:cric:crypto 512 (shaz (jam mon 1 eny.bowl)) %b ~)
    =/  =pass  pub:ex:cic
    =.  cor
      %-  emit
      [%pass /roster/mint/(scot %p mon) %arvo %j %moon mon *id:block:jael %keys [1 1 pass] %.n]
    =.  cor
      %-  emit
      :*  %pass  /roster/vouch/(scot %p mon)  %agent  [our.bowl %vouch]
          %poke  %vouch-learn  !>(`learn:v`[mon %bot])
      ==
    =/  con=contact:ct  (ro-build-contact nickname avatar)
    =.  cor
      %-  emit
      :*  %pass  /roster/profile/(scot %p mon)  %agent  [our.bowl %contacts]
          %poke  %contact-bot-0  !>(`[who=ship con=contact:ct]`[mon con])
      ==
    =.  cor  (ro-claim mon)
    =/  =bot:v1:sr  [nickname avatar model harness persona now.bowl]
    =.  bots.roster.state  (~(put by bots.roster.state) mon bot)
    (give %fact ~[/v1/roster] %steward-roster-update-1 !>(`update:v1:sr`[%minted mon bot]))
  ::
  ::  NB: the sample face is .who, not .ship -- a bare =ship sample would
  ::  shadow the ship mold for the rest of this arm's body, breaking the
  ::  `[who=ship ...]` cast below (see mar door convention in CLAUDE.md).
  ::
  ++  ro-handle-configure
    |=  [who=ship nickname=@t avatar=(unit @t) model=@t harness=@t persona=@t]
    ^+  cor
    ?~  got=(~(get by bots.roster.state) who)
      ~|  %roster-configure-unknown-bot  !!
    =/  =bot:v1:sr  [nickname avatar model harness persona created.u.got]
    =.  bots.roster.state  (~(put by bots.roster.state) who bot)
    =/  con=contact:ct  (ro-build-contact nickname avatar)
    =.  cor
      %-  emit
      :*  %pass  /roster/profile/(scot %p who)  %agent  [our.bowl %contacts]
          %poke  %contact-bot-0  !>(`[who=ship con=contact:ct]`[who con])
      ==
    ::  re-assert the claim (idempotent): repairs bots minted before the
    ::  claim existed, or a claim lost to a profile edit
    =.  cor  (ro-claim who)
    (give %fact ~[/v1/roster] %steward-roster-update-1 !>(`update:v1:sr`[%configured who bot]))
  ::
  ++  ro-handle-retire
    |=  who=ship
    ^+  cor
    ?.  (~(has by bots.roster.state) who)
      ~|  %roster-retire-unknown-bot  !!
    ::  vouch is deliberately left untouched: the moon stays classified
    ::  %bot even after retirement, so history involving it (past chat
    ::  messages, etc) stays routable/attributable. retiring only drops it
    ::  from the roster the runner actively manages.
    ::
    =.  bots.roster.state  (~(del by bots.roster.state) who)
    (give %fact ~[/v1/roster] %steward-roster-update-1 !>(`update:v1:sr`[%retired who]))
  --
--
