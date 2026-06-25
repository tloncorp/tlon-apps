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
::  legacy steward state (lens was a bare map, no retention config).
::  on-load migrates this into state-2 with a default cap and an empty
::  trusted-bots set.
::
+$  state-0
  $:  %0
      owner=(unit ship)
      lens=state-0:lens:s
      gateway=state:gateway:s
  ==
::  state-1: post-cap, pre-trust-bots. accepted lens %entry pokes either
::  from self or from moons sponsored by this ship. on-load migrates
::  this into state-2 by initializing an empty trusted-bots set —
::  operators must explicitly re-grant trust post-upgrade for cross-
::  ship fan-out to resume (the prior moon-sponsor auto-trust path is
::  removed; trust is now ship-class-agnostic and explicit).
::
+$  state-1
  $:  %1
      owner=(unit ship)
      lens=state:lens:s
      gateway=state:gateway:s
  ==
::  state-2: ships we (as the owner) accept lens %entry fan-outs from
::  live in `.bots`. populated by [%trust-bot ship]; checked in the
::  lens %entry gate. empty set means "no remote bot trusted" — only
::  local pokes accepted. trust is explicit and ship-class-agnostic:
::  a bot may be a planet, moon, comet, star, or galaxy. moon
::  sponsorship is NOT an auto-trust — even a moon we sponsor must
::  be trusted with %trust-bot to fan-out runs to us.
::
+$  state-2
  $:  %2
      owner=(unit ship)
      bots=(set ship)
      lens=state:lens:s
      gateway=state:gateway:s
  ==
::  default cap on first install or on state-0 → state-2 migration. set
::  generously: at ~20KB/run that's ~200MB per bot, well within modern
::  loom budgets. ships that want more (or less) can poke %lens %configure.
::
++  default-max-runs-per-bot  ^-  @ud  10.000
--
=|  state-2
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
    ::  try current state-2 first, then state-1 with migration (add
    ::  empty bots set), then state-0 with migration (add default cap
    ::  and empty bots set), then bunt.
    ::
    =/  two  (mule |.(!<(state-2 ole)))
    ?:  ?=(%& -.two)
      [~ this(state p.two)]
    =/  one  (mule |.(!<(state-1 ole)))
    ?:  ?=(%& -.one)
      =/  upgraded=state-2
        :*  %2
            owner.p.one
            ~
            lens.p.one
            gateway.p.one
        ==
      [~ this(state upgraded)]
    =/  zero  (mule |.(!<(state-0 ole)))
    ?:  ?=(%& -.zero)
      =/  upgraded=state-2
        :*  %2
            owner.p.zero
            ~
            [lens.p.zero default-max-runs-per-bot]
            gateway.p.zero
        ==
      [~ this(state upgraded)]
    %-  (slog 'steward: on-load state mismatch, resetting to bunt' ~)
    =.  max-runs-per-bot.lens.state  default-max-runs-per-bot
    [~[watch-activity:cor] this]
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
::  %steward-action-1 auth is per-variant rather than blanket-gated, since
::  the lens module accepts two distinct inbound shapes:
::    %entry: data flowing in from the bot's gateway (src=our) or fanning
::            in from a remote bot we have explicitly trusted via
::            [%trust-bot ship].
::    %retry: an owner-initiated retry request, which cross-ships from
::            the owner planet to the bot — owner is not in our trusted
::            bots set, so the entry gate would reject it.
::  gateway, %configure, %trust-bot and %untrust-bot remain self-only.
::
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?+  mark  ~|(bad-poke-mark+mark !!)
      %steward-action-1
    =+  !<(=action:v1:s vase)
    ?-  -.action
        %configure
      ?>  =(src.bowl our.bowl)
      cor(owner.state `owner.action)
    ::
        %trust-bot
      ?>  =(src.bowl our.bowl)
      cor(bots.state (~(put in bots.state) ship.action))
    ::
        %untrust-bot
      ?>  =(src.bowl our.bowl)
      cor(bots.state (~(del in bots.state) ship.action))
    ::
        %lens
      (le-poke-action:le-core action.action)
    ::
        %gateway
      ?>  =(src.bowl our.bowl)
      (ga-poke-action:ga-core action.action)
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
  ::  retention is count-bounded only; the cap lives in state and is set
  ::  by %lens %configure (default in default-max-runs-per-bot on init /
  ::  state-0 → state-2 migration). No time-based expiry — lens runs are
  ::  durable memory of agent activity, not transient logs.
  ::
  ::  payloads are opaque to %steward, but a trusted bot could send
  ::  arbitrarily large cords. cap incoming bytes so a misbehaving (or
  ::  compromised) gateway can't blow up loom usage with a single poke.
  ::  the gateway-side truncates to ~50KB; this is a hard ceiling.
  ::
  ++  max-payload-bytes  ^-  @ud  524.288
  ::
  ++  le-handle-configure
    |=  cap=@ud
    ^+  cor
    =.  max-runs-per-bot.lens.state  cap
    ::  the new cap takes effect on every bot immediately.
    ::
    le-prune-all
  ::
  ::  lens-action auth: per-variant, since each shape has a different src
  ::  expectation.
  ::    %entry: src=our (bot's own gateway pokes locally) or src is a bot
  ::            we explicitly trust via [%trust-bot ship] (a remote bot
  ::            fanning a run to us as its owner). data flow: bot → owner.
  ::            ship class is irrelevant — bots may be planets, moons,
  ::            comets, stars, or galaxies. trust is the only gate.
  ::    %retry: src=our (local client OR an owner-side relay forwarding to
  ::            its own bot when bot == our) or src is the configured owner
  ::            (an owner ship relaying a retry to its bot). data flow:
  ::            owner → bot, with the owner's steward acting as the cross-
  ::            ship relay if bot != our.
  ::    %configure: src=our only.
  ::
  ++  le-poke-action
    |=  =action:lens:s
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
  ::  the same %entry action arrives in two roles:
  ::    - bot role (src==our): our own gateway poked us; fan the run out
  ::      to our configured owner.
  ::    - owner role (src is a trusted bot): one of our bots sent us its
  ::      run; store it keyed by src.bowl so we can serve it to clients.
  ::
  ++  le-handle-entry
    |=  [=id:lens:s =payload:lens:s final=?]
    ^+  cor
    ::  drop oversized payloads to keep loom usage bounded; a trusted
    ::  bot misbehaving (or compromised) can't force unbounded growth.
    ::
    ?:  (gth (met 3 payload) max-payload-bytes)
      %-  (slog leaf+"steward: lens payload oversized, dropping" ~)
      cor
    ?:  =(src.bowl our.bowl)
      (le-fan-out id payload final)
    (le-store src.bowl id payload final)
  ::
  ::  retry: route based on whether we are the targeted bot or just the
  ::  owner-side relay.
  ::    bot == our: we run the bot's gateway locally; emit the retry fact
  ::                on /v1/lens for the gateway to pick up. .requester is
  ::                whoever first poked (the local client, or the cross-
  ::                ship owner if we received this via fan-out).
  ::    bot != our: we are the owner forwarding a retry to a bot we own.
  ::                cross-ship poke that bot's steward with the same
  ::                action; the bot will recognize bot == our.bowl there
  ::                and emit the fact for its local gateway.
  ::  retry never mutates stored state — the gateway will create a new
  ::  lens run with a fresh id and poke us back via %entry.
  ::
  ++  le-handle-retry
    |=  [bot=ship =id:lens:s requester=ship]
    ^+  cor
    ?:  =(bot our.bowl)
      %+  give  %fact
      :*  ~[/v1/lens]
          %steward-update-1
          !>(`update:v1:s`[%lens %retry-requested id requester])
      ==
    %-  emit
    :^    %pass
        /lens/retry/(scot %p bot)/(scot %t id)
      %agent
    :+  [bot %steward]
      %poke
    :-  %steward-action-1
    !>(`action:v1:s`[%lens %retry bot id])
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
      ``steward-update-1+!>(`update:v1:s`[%lens %recent (le-recent 50)])
    ::
        [%v1 %recent @ ~]
      =/  parsed  (slaw %ud i.t.t.path)
      ?~  parsed  [~ ~]
      ``steward-update-1+!>(`update:v1:s`[%lens %recent (le-recent u.parsed)])
    ::
        [%v1 %since @ ~]
      =/  parsed  (slaw %da i.t.t.path)
      ?~  parsed  [~ ~]
      ``steward-update-1+!>(`update:v1:s`[%lens %recent (le-since u.parsed)])
    ::
        [%v1 %run @ @ ~]
      =/  parsed-bot  (slaw %p i.t.t.path)
      ?~  parsed-bot  [~ ~]
      =/  =id:lens:s  i.t.t.t.path
      ?~  r=(~(get by runs.lens.state) [u.parsed-bot id])  [~ ~]
      ``steward-update-1+!>(`update:v1:s`[%lens %entry u.parsed-bot id u.r])
    ==
  ::
  ++  le-fan-out
    |=  [=id:lens:s =payload:lens:s final=?]
    ^+  cor
    ?~  owner.state  cor
    ?:  =(u.owner.state our.bowl)
      ::  self-owned bot: store directly, no network hop
      (le-store our.bowl id payload final)
    =/  =action:lens:s  [%entry id payload final]
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
    =/  prev  (~(get by runs.lens.state) [bot id])
    ?:  &(?=(^ prev) complete.u.prev !final)
      cor
    =/  =run:lens:s  [final now.bowl payload]
    =.  runs.lens.state  (~(put by runs.lens.state) [bot id] run)
    =.  cor  (le-prune bot)
    %+  give  %fact
    :*  ~[/v1/lens]
        %steward-update-1
        !>(`update:v1:s`[%lens %entry bot id run])
    ==
  ::
  ::  trim a single bot's records to .max-runs-per-bot, dropping the
  ::  oldest by .received first. invoked on every insert (bounds that
  ::  bot's tail) and on %configure (applies a new cap to every bot).
  ::
  ++  le-prune
    |=  for=ship
    ^+  cor
    =/  mine
      %+  skim  ~(tap by runs.lens.state)
      |=  [[bot=ship *] *]
      =(bot for)
    ?:  (lte (lent mine) max-runs-per-bot.lens.state)
      cor
    =/  sorted
      %+  sort  mine
      |=  [a=[* =run:lens:s] b=[* =run:lens:s]]
      (lth received.run.a received.run.b)
    =/  to-drop
      (scag (sub (lent mine) max-runs-per-bot.lens.state) sorted)
    =/  keys  (turn to-drop |=([k=[bot=ship =id:lens:s] *] k))
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
  ::  newest .count entries across all bots.
  ::
  ++  le-recent
    |=  count=@ud
    ^-  (list entry:lens:s)
    =/  sorted
      %+  sort  ~(tap by runs.lens.state)
      |=  [a=[* =run:lens:s] b=[* =run:lens:s]]
      (gth received.run.a received.run.b)
    %+  turn  (scag count sorted)
    |=  [[bot=ship =id:lens:s] =run:lens:s]
    `entry:lens:s`[bot id run]
  ::
  ::  every entry with .received >= cutoff, newest first. paginate
  ::  history by passing the oldest .received from the last page.
  ::
  ++  le-since
    |=  cutoff=@da
    ^-  (list entry:lens:s)
    =/  fresh
      %+  skim  ~(tap by runs.lens.state)
      |=  [* =run:lens:s]
      (gte received.run cutoff)
    =/  sorted
      %+  sort  fresh
      |=  [a=[* =run:lens:s] b=[* =run:lens:s]]
      (gth received.run.a received.run.b)
    %+  turn  sorted
    |=  [[bot=ship =id:lens:s] =run:lens:s]
    `entry:lens:s`[bot id run]
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
  ++  ga-notice-target
    ^-  (unit ship)
    ?~  last-owner-msg-id.gateway.state  ~
    `p.id.u.last-owner-msg-id.gateway.state
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
