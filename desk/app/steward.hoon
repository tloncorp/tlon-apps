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
::  legacy steward state (lens was a bare map, no time-cap-free retention
::  config). on-load migrates this into state-1 with a default cap.
::
+$  state-0
  $:  %0
      owner=(unit ship)
      lens=state-0:lens:s
      gateway=state:gateway:s
  ==
+$  state-1
  $:  %1
      owner=(unit ship)
      lens=state:lens:s
      gateway=state:gateway:s
  ==
::  default cap on first install or on state-0 → state-1 migration. set
::  generously: at ~20KB/run that's ~200MB per bot, well within modern
::  loom budgets. ships that want more (or less) can poke %lens %configure.
::
++  default-max-runs-per-bot  ^-  @ud  10.000
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
    ::  try current state-1 first, then state-0 with migration, then bunt.
    ::
    =/  one  (mule |.(!<(state-1 ole)))
    ?:  ?=(%& -.one)
      [~ this(state p.one)]
    =/  zero  (mule |.(!<(state-0 ole)))
    ?:  ?=(%& -.zero)
      =/  upgraded=state-1
        :*  %1
            owner.p.zero
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
::            in from a moon we sponsor (src is a bot we own).
::    %retry: an owner-initiated retry request, which cross-ship from the
::            owner planet to the bot moon — owner is not a moon we sponsor,
::            so the entry gate would reject it.
::  gateway and top-level %configure remain self-only.
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
  ::  state-0 migration). No time-based expiry — lens runs are durable
  ::  memory of agent activity, not transient logs.
  ::
  ++  le-handle-configure
    |=  cap=@ud
    ^+  cor
    =.  max-runs-per-bot.lens.state  cap
    ::  the new cap takes effect on every bot immediately.
    ::
    le-prune-all
  ::
  ::  lens-action auth: per-variant, since %entry and %retry take pokes from
  ::  different src shapes.
  ::    %entry: src=our (bot's own gateway) or src is a moon we sponsor (a
  ::            bot we own fanning a run to us as its owner).
  ::    %retry: src=our (local client) or src is the configured owner (an
  ::            owner planet poking its bot moon).
  ::
  ++  le-poke-action
    |=  =action:lens:s
    ^+  cor
    ?-  -.action
        %entry
      ?>  ?|  =(src.bowl our.bowl)
              ?&  !=(src.bowl (end 5 src.bowl))
                  =(our.bowl (end 5 src.bowl))
              ==
          ==
      (le-handle-entry id.action payload.action final.action)
    ::
        %retry
      ?>  ?|  =(src.bowl our.bowl)
              ?&  ?=(^ owner.state)
                  =(src.bowl u.owner.state)
              ==
          ==
      (le-handle-retry id.action src.bowl)
    ::
        %configure
      ?>  =(src.bowl our.bowl)
      (le-handle-configure max-runs-per-bot.action)
    ==
  ::
  ::  the same %entry action arrives in two roles:
  ::    - bot role (src==our): our own gateway poked us; fan the run out
  ::      to our configured owner.
  ::    - owner role (src is a sponsored moon): one of our bots sent us
  ::      its run; store it keyed by src.bowl so we can serve it to clients.
  ::
  ++  le-handle-entry
    |=  [=id:lens:s =payload:lens:s final=?]
    ^+  cor
    ?:  =(src.bowl our.bowl)
      (le-fan-out id payload final)
    (le-store src.bowl id payload final)
  ::
  ::  retry: emit a fact on /v1/lens that the local gateway picks up and
  ::  re-dispatches. retry doesn't mutate stored state — the gateway will
  ::  create a new lens run with a fresh id and poke us back with %entry.
  ::
  ++  le-handle-retry
    |=  [=id:lens:s requester=ship]
    ^+  cor
    %+  give  %fact
    :*  ~[/v1/lens]
        %steward-update-1
        !>(`update:v1:s`[%lens %retry-requested id requester])
    ==
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
      ``noun+!>((le-recent 50))
    ::
        [%v1 %recent @ ~]
      =/  parsed  (slaw %ud i.t.t.path)
      ?~  parsed  [~ ~]
      ``noun+!>((le-recent u.parsed))
    ::
        [%v1 %since @ ~]
      =/  parsed  (slaw %da i.t.t.path)
      ?~  parsed  [~ ~]
      ``noun+!>((le-since u.parsed))
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
  ::  newest .count runs across all bots, as %entry updates.
  ::
  ++  le-recent
    |=  count=@ud
    ^-  (list update:lens:s)
    =/  sorted
      %+  sort  ~(tap by runs.lens.state)
      |=  [a=[* =run:lens:s] b=[* =run:lens:s]]
      (gth received.run.a received.run.b)
    %+  turn  (scag count sorted)
    |=  [[bot=ship =id:lens:s] =run:lens:s]
    `update:lens:s`[%entry bot id run]
  ::
  ::  every entry with .received >= cutoff, newest first. paginate
  ::  history by passing the oldest .received from the last page.
  ::
  ++  le-since
    |=  cutoff=@da
    ^-  (list update:lens:s)
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
    `update:lens:s`[%entry bot id run]
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
