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
/-  sl=steward-lens, sg=steward-gateway, sp=steward-prompts
/+  default-agent, verb, dbug
|%
+$  card  card:agent:gall
::    .owner: shared owner ship (lens send target, gateway owner-DM tracking)
::    .bots:  owner-side trusted bots — ships allowed to send lens %entry
::            and prompts %sync pokes cross-ship. explicit and
::            ship-class-agnostic; an empty set means only local pokes are
::            accepted.
::
+$  versioned-state  $%(state-0 state-1)
+$  state-0
  $:  %0
      owner=(unit ship)
      bots=(set ship)
      lens=state:v1:sl
      gateway=state:v1:sg
  ==
+$  state-1
  $:  %1
      owner=(unit ship)
      bots=(set ship)
      lens=state:v1:sl
      gateway=state:v1:sg
      prompts=state:v1:sp
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
    ::  an incompatible state is only reachable pre-release; let it crash so
    ::  we nuke rather than silently wipe.
    ::
    =/  old  !<(versioned-state ole)
    ?-  -.old
      %1  `this(state old)
      %0  `this(state [%1 owner.old bots.old lens.old gateway.old *state:v1:sp])
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
        %configure
      ::  re-fan the canonical prompt set so a newly configured owner's
      ::  mirror doesn't stay empty until some prompt text happens to
      ::  change, and tell a replaced owner to drop its mirror so the bot
      ::  doesn't keep appearing owned/editable there
      ::
      =/  old  owner.state
      =.  owner.state  `owner.action
      ::  the gateway re-configures the same owner on every (re)connect;
      ::  don't re-fan or revoke on a no-op
      ?:  =(old `owner.action)  cor
      =?  cor  ?=(^ old)
        ?:  =(u.old our.bowl)
          (pr-drop-mirror:pr-core u.old)
        ::  the revoke must ride the same wire as our %syncs to this ship:
        ::  same wire, same ames flow, so it's delivered after any %sync
        ::  still in flight (a delayed pre-transition sync arriving after a
        ::  separate-flow revoke would recreate the stale mirror)
        %-  emit
        :^    %pass
            /prompts/sync/(scot %p u.old)
          %agent
        :+  [u.old %steward]
          %poke
        [%steward-prompts-action-1 !>(`action:v1:sp`[%revoke ~])]
      ?:  =(~ own.prompts.state)  cor
      pr-sync-owner:pr-core
    ::
        %unconfigure
      ::  the gateway's config no longer names an owner: clear it and
      ::  revoke the former owner's mirror, or that ship keeps receiving
      ::  syncs and stays authorized to %set edits indefinitely
      ::
      =/  old  owner.state
      =.  owner.state  ~
      ?~  old  cor
      ?:  =(u.old our.bowl)
        (pr-drop-mirror:pr-core u.old)
      ::  same wire as %syncs to this ship — shares their ames flow, so it
      ::  can't be overtaken by an in-flight %sync (see %configure)
      %-  emit
      :^    %pass
          /prompts/sync/(scot %p u.old)
        %agent
      :+  [u.old %steward]
        %poke
      [%steward-prompts-action-1 !>(`action:v1:sp`[%revoke ~])]
    ::
        %trust-bot
      ::  ask the bot to re-fan its prompt set: a %sync it sent before
      ::  trust was granted was nacked and won't retry on its own
      ::
      =.  bots.state  (~(put in bots.state) ship.action)
      ?:  =(ship.action our.bowl)  cor
      %-  emit
      :^    %pass
          /prompts/request/(scot %p ship.action)
        %agent
      :+  [ship.action %steward]
        %poke
      [%steward-prompts-action-1 !>(`action:v1:sp`[%request ~])]
    ::
        %untrust-bot
      ::  the prompt mirror doubles as the client's ownership signal, so a
      ::  revoked bot must not keep serving (or appearing to accept) edits
      ::
      =.  bots.state  (~(del in bots.state) ship.action)
      (pr-drop-mirror:pr-core ship.action)
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
  ::  prompts module actions. auth is per-variant (each shape expects a
  ::  different src), so it's enforced inside pr-poke-action.
  ::
      %steward-prompts-action-1
    (pr-poke-action:pr-core !<(action:v1:sp vase))
  ==
::
++  watch
  |=  =path
  ^+  cor
  ?+  path  ~|(bad-watch-path+path !!)
    [%v1 %lens *]     (le-watch:le-core [%v1 t.t.path])
    [%v1 %gateway *]  (ga-watch:ga-core [%v1 t.t.path])
    [%v1 %prompts *]  (pr-watch:pr-core [%v1 t.t.path])
  ==
::
++  peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  [~ ~]
    [%x %v1 %lens *]     (le-peek:le-core [%v1 t.t.t.path])
    [%x %v1 %gateway *]  (ga-peek:ga-core [%v1 t.t.t.path])
    [%x %v1 %prompts *]  (pr-peek:pr-core [%v1 t.t.t.path])
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
      [%prompts %set *]
    ?+  -.sign  cor
        %poke-ack
      ?~  p.sign  cor
      ((slog 'steward: prompts set relay nacked' u.p.sign) cor)
    ==
  ::
      [%prompts %sync *]
    ?+  -.sign  cor
        %poke-ack
      ?~  p.sign  cor
      ::  %syncs and owner-change %revokes share this wire (see %configure);
      ::  a revoke nack is expected when the former owner held no mirror
      ((slog 'steward: prompts owner sync nacked' u.p.sign) cor)
    ==
  ::
      [%prompts %request *]
    ?+  -.sign  cor
        %poke-ack
      ?~  p.sign  cor
      ::  expected when trusting a ship that doesn't consider us its owner
      ((slog 'steward: prompts resync request nacked' u.p.sign) cor)
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
::  |pr-core: prompts module
::
::  ship-durable gateway system prompts. the bot ship stores the canonical
::  set (.own), the gateway re-applies it to the workspace on boot, and the
::  set is mirrored to the owner ship (.mirror) so clients can read and edit
::  prompts without ever talking to the gateway.
::
++  pr-core
  |%
  ::  a single prompt is a whole workspace file; cap it well above real
  ::  prompt sizes (~10KB) but low enough that a full-set %sync poke stays
  ::  comfortably inside one ames message budget.
  ::
  ++  max-prompt-bytes  65.536
  ::  hard ceiling on a full prompt map (jammed), mirroring the lens payload
  ::  cap: a misbehaving or compromised gateway can't blow up loom with one
  ::  poke.
  ::
  ++  max-payload-bytes  524.288
  ::
  ::  prompts-action auth is per-variant, since each shape expects a
  ::  different src:
  ::    %set: src=our (a local client editing, or the start of an owner-side
  ::          relay) or the configured owner relaying an edit to us (which
  ::          must target bot==our). only a local poke may relay outward, so
  ::          we never proxy a non-local edit on to a third ship.
  ::    %seed: src=our only (the local gateway reporting effective files).
  ::    %sync: src=our (a self-owned bot storing directly) or a ship in the
  ::          owner-side trusted-bots set fanning its canonical set in.
  ::
  ++  pr-poke-action
    |=  =action:v1:sp
    ^+  cor
    ?-  -.action
        %set
      ?>  ?|  =(src.bowl our.bowl)
              ?&  ?=(^ owner.state)
                  =(src.bowl u.owner.state)
                  =(bot.action our.bowl)
              ==
          ==
      ::  reject oversized text at the first hop so the editing client's
      ::  poke nacks instead of a silent drop reading as success
      ::
      ?>  (lte (met 3 text.action) max-prompt-bytes)
      ?:  =(bot.action our.bowl)
        (pr-handle-set name.action text.action)
      ::  local request for one of our remote bots: relay to its steward
      %-  emit
      :^    %pass
          /prompts/set/(scot %p bot.action)/(scot %t name.action)
        %agent
      :+  [bot.action %steward]
        %poke
      [%steward-prompts-action-1 !>(`action:v1:sp`action)]
    ::
        %seed
      ?>  =(src.bowl our.bowl)
      (pr-handle-seed prompts.action)
    ::
        %sync
      ?>  ?|  =(src.bowl our.bowl)
              (~(has in bots.state) src.bowl)
          ==
      (pr-store-mirror src.bowl prompts.action)
    ::
        %request
      ?>  ?|  =(src.bowl our.bowl)
              ?&  ?=(^ owner.state)
                  =(src.bowl u.owner.state)
              ==
          ==
      pr-sync-owner
    ::
        %revoke
      ::  a ship may only drop its own mirror entry
      ?>  (~(has by mirror.prompts.state) src.bowl)
      (pr-drop-mirror src.bowl)
    ::
        %clear
      ::  the local gateway declares prompt sync inactive for this account
      ::  (it lost syncing authority without an owner change): wipe the
      ::  canonical set and fan the empty set so the owner's mirror — and
      ::  with it the editor UI — goes away rather than accepting edits
      ::  nothing applies
      ::
      ?>  =(src.bowl our.bowl)
      ?:  =(~ own.prompts.state)  cor
      =.  own.prompts.state  *prompts:v1:sp
      =.  cor
        %^  give  %fact  ~[/v1/prompts]
        steward-prompts-update-1+!>(`update:v1:sp`[%prompts our.bowl *prompts:v1:sp])
      pr-sync-owner
    ==
  ::
  ::  store one edit (pinned owner intent, edited=&), notify the local
  ::  gateway (which applies it to the workspace and restarts), and refresh
  ::  the owner's mirror.
  ::
  ++  pr-handle-set
    |=  [=name:v1:sp text=@t]
    ^+  cor
    =/  =prompt:v1:sp  [text now.bowl &]
    =.  own.prompts.state  (~(put by own.prompts.state) name prompt)
    =.  cor
      %^  give  %fact  ~[/v1/prompts]
      steward-prompts-update-1+!>(`update:v1:sp`[%set name prompt])
    pr-sync-owner
  ::
  ::  the gateway reports the full effective prompt set (file contents).
  ::  un-edited entries adopt it wholesale — they merely mirror the files, so
  ::  upstream prompt-set updates flow through. edited entries are pinned
  ::  owner intent: a seed with different text never overwrites one (the
  ::  gateway hasn't applied that edit yet — the race is a %set landing
  ::  between the gateway's scry and its seed), and an edited entry missing
  ::  from the seed entirely is kept rather than dropped.
  ::
  ++  pr-handle-seed
    |=  seed=(map name:v1:sp @t)
    ^+  cor
    ?:  (gth (met 3 (jam seed)) max-payload-bytes)
      %-  (slog leaf+"steward: prompts seed oversized, dropping" ~)
      cor
    =/  new=prompts:v1:sp
      %-  ~(gas by *prompts:v1:sp)
      %+  turn  ~(tap by seed)
      |=  [n=name:v1:sp t=@t]
      =/  prev  (~(get by own.prompts.state) n)
      ?~  prev  [n `prompt:v1:sp`[t now.bowl |]]
      ?:  =(text.u.prev t)  [n u.prev]
      ?:  edited.u.prev  [n u.prev]
      [n `prompt:v1:sp`[t now.bowl |]]
    ::  keep pinned edits the seed doesn't mention
    =.  new
      %-  ~(gas by new)
      %+  skim  ~(tap by own.prompts.state)
      |=  [n=name:v1:sp p=prompt:v1:sp]
      &(edited.p !(~(has by new) n))
    ::  gateways re-seed on every boot; don't re-fact or re-sync a no-op
    ?:  =(new own.prompts.state)  cor
    =.  own.prompts.state  new
    =.  cor
      %^  give  %fact  ~[/v1/prompts]
      steward-prompts-update-1+!>(`update:v1:sp`[%prompts our.bowl new])
    pr-sync-owner
  ::
  ++  pr-sync-owner
    ^+  cor
    ?~  owner.state  cor
    ?:  =(u.owner.state our.bowl)
      ::  self-owned bot: store the mirror directly, no network hop
      (pr-store-mirror our.bowl own.prompts.state)
    %-  emit
    :^    %pass
        /prompts/sync/(scot %p u.owner.state)
      %agent
    :+  [u.owner.state %steward]
      %poke
    [%steward-prompts-action-1 !>(`action:v1:sp`[%sync own.prompts.state])]
  ::
  ++  pr-store-mirror
    |=  [bot=ship new=prompts:v1:sp]
    ^+  cor
    ::  cross-ship maps are size-gated like lens payloads
    ?:  (gth (met 3 (jam new)) max-payload-bytes)
      %-  (slog leaf+"steward: prompts sync oversized, dropping" ~)
      cor
    =.  mirror.prompts.state  (~(put by mirror.prompts.state) bot new)
    %^  give  %fact  ~[/v1/prompts]
    steward-prompts-update-1+!>(`update:v1:sp`[%prompts bot new])
  ::
  ::  drop a bot's mirror (trust revoked) and fact the now-empty set so
  ::  clients stop treating the bot as owned/editable
  ::
  ++  pr-drop-mirror
    |=  bot=ship
    ^+  cor
    ?.  (~(has by mirror.prompts.state) bot)  cor
    =.  mirror.prompts.state  (~(del by mirror.prompts.state) bot)
    %^  give  %fact  ~[/v1/prompts]
    steward-prompts-update-1+!>(`update:v1:sp`[%prompts bot *prompts:v1:sp])
  ::
  ++  pr-watch
    |=  =path
    ^+  cor
    ?+  path  ~|(bad-prompts-watch-path+path !!)
      ::  no initial fact — clients backfill via the /x/v1/prompts scries
      [%v1 ~]  cor
    ==
  ::
  ++  pr-peek
    |=  =path
    ^-  (unit (unit cage))
    ?+  path  [~ ~]
        [%v1 ~]
      ::  bot role: the canonical set the local gateway applies
      ``steward-prompts-update-1+!>(`update:v1:sp`[%prompts our.bowl own.prompts.state])
    ::
        [%v1 @ ~]
      ::  owner role: a bot's mirrored set. our own ship serves the
      ::  canonical set so self-owned bots read the same path.
      =/  bot  (slav %p i.t.path)
      ?:  =(bot our.bowl)
        ``steward-prompts-update-1+!>(`update:v1:sp`[%prompts our.bowl own.prompts.state])
      ?~  found=(~(get by mirror.prompts.state) bot)  [~ ~]
      ``steward-prompts-update-1+!>(`update:v1:sp`[%prompts bot u.found])
    ==
  --
--
