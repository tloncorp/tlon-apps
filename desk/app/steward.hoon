::  steward: harness-agnostic umbrella agent
::
::    an agent that manages our harnesses. it currently tracks the state of the
::    harness gateway and execution runs, and emits message-delivery telemetry.
::
::    the bot itself runs steward as well as the bot's owner, so that things
::    like lens data can be scried locally by the owner.
::
::    modules keep their own sur
::    (sur/steward/{lens,gateway,automation}.hoon) and mark families;
::    %steward-action-1 carries only cross-cutting config (the shared owner).
::
/-  s=steward, a=activity, av=activity-ver, c=chat, ch=channels, co=contacts
/-  cv=chat-ver, chv=channels-ver, st=story
/-  sl=steward-lens, sg=steward-gateway, sa=steward-automation
/-  lg=logs
/+  default-agent, verb, dbug, server, logs, utils=channel-utils
/+  aj=steward-automation-json
|%
+$  card  card:agent:gall
::  state is versioned; +on-load migrates older shapes forward.
::
::    .owner: shared owner ship (lens send target, gateway owner-DM tracking)
::    .bots:  owner-side trusted bots — ships allowed to send lens %entry
::            pokes cross-ship. explicit and ship-class-agnostic; an empty
::            set means only local pokes are accepted.
::
+$  state-2
  $:  %2
      owner=(unit ship)
      bots=(set ship)
      lens=state:v1:sl
      gateway=state:v1:sg
      automation=state:v1:sa
  ==
+$  versioned-state  $%(state-0 state-1 state-2)
::  pre-%2 shapes, kept for +on-load only. state-1 is the released shape
::  before the automation slice; gateway-0 is the gateway slice before
::  .notify-on-start was prepended (see sur/steward/gateway.hoon).
::
+$  state-1
  $:  %1
      owner=(unit ship)
      bots=(set ship)
      lens=state:v1:sl
      gateway=state:v1:sg
  ==
+$  state-0
  $:  %0
      owner=(unit ship)
      bots=(set ship)
      lens=state:v1:sl
      gateway=gateway-0
  ==
+$  gateway-0
  $:  last-owner-msg=@da
      last-owner-msg-id=(unit message-key:a)
      status=status:v1:sg
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
::  default cap on first install. conservative against the per-run ceiling:
::  3.000 runs * 512KB worst-case = ~1.5GB per bot, while typical runs are far
::  smaller. ships wanting more or less can poke %steward-lens-action-1
::  %configure.
::
++  default-max-runs-per-bot  3.000
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
    [(weld init-subs:cor au-init-cards:au-core:cor) this]
  ++  on-save  !>(state)
  ++  on-load
    |=  =vase
    ^-  (quip card _this)
    =^  cards  state  abet:(load:cor vase)
    [(weld init-subs:cor cards) this]
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
    :_  this
    [(~(on-fail logs bowl /logs) term tang)]~
  --
|_  [=bowl:gall cards=(list card)]
+*  log  ~(. logs [bowl /logs])
++  cor   .
++  abet  [(flop cards) state]
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))
++  give  |=(=gift:agent:gall (emit %give gift))
::  +log-tell, +log-fail: report to %logs, which forwards at or above its
::  volume threshold to PostHog and to OTLP (docs/backend/desk/app/steward.md).
::  .event names the event and .extra rides along as properties, so a
::  fleet-wide question has an answer without reading slogs on one ship.
::
::    +log-fail is for faults only: it emits a %fail, which is what the
::    crash dashboards and the unknown-crash burst alert count. An expected
::    outcome, however unwelcome, is a +log-tell.
::
++  log-tell
  |=  [vol=volume:v1:lg event=@t =echo:v1:lg extra=log-data:v1:lg]
  ^+  cor
  (emit (tell:log vol echo ['event'^s+event extra]))
++  log-fail
  |=  [event=@t =echo:v1:lg =tang extra=log-data:v1:lg]
  ^+  cor
  (emit (fail:log %error echo tang ['event'^s+event extra]))
::
::  +load: progressive migration, one version per step, with cards emitted
::  at the version they belong to (the shape of +load in %activity).
::
++  load
  |=  =vase
  ^+  cor
  =+  !<(old=versioned-state vase)
  =?  cor  ?=(%0 -.old)  (seed-migrated-liveness old)
  =?  old  ?=(%0 -.old)  (state-0-to-1 old)
  ::  the sweep is a self-rearming chain: it starts once, when the
  ::  automation slice is created, and a later load must not stack another
  ::
  =/  new-slice  ?=(%1 -.old)
  =?  old  ?=(%1 -.old)  (state-1-to-2 old)
  ?>  ?=(%2 -.old)
  =.  state  old
  ::  re-establish the eyre binding on every load; re-connecting a bound
  ::  path is harmless
  ::
  =.  cor  (emit au-eyre-card:au-core)
  ?.  new-slice  cor
  (emit au-cleanup-card:au-core)
::  %0 → %1: the gateway slice gained leading .notify-on-start and
::  .last-interaction fields
++  state-0-to-1
  |=  old=state-0
  ^-  state-1
  [%1 owner.old bots.old lens.old [| *@da gateway.old]]
::  %1 → %2: the automation module arrives with an empty slice
++  state-1-to-2
  |=  old=state-1
  ^-  state-2
  [%2 owner.old bots.old lens.old gateway.old *state:v1:sa]
::  a %0 bot's gateway registered before the liveness claim existed, and
::  heartbeats only advertise on an up transition: seed the claim from the
::  migrated status, or an already-up gateway stays unknown until its next
::  restart. no owner means no bot (%steward runs on every ship); %unknown
::  means the gateway never registered.
++  seed-migrated-liveness
  |=  old=state-0
  ^+  cor
  ?.  &(?=(^ owner.old) !?=(%unknown status.gateway.old))  cor
  (ga-advertise-liveness:ga-core =(%up status.gateway.old))
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
  ::  automation actions: all local-only, enforced in au-poke-action
  ::
      %steward-automation-action-1
    (au-poke-action:au-core !<(action:v1:sa vase))
  ::
  ::  owner → bot edit command: only the configured owner, enforced in
  ::  au-poke-command
  ::
      %steward-automation-command-1
    (au-poke-command:au-core !<(c-automation:v1:sa vase))
  ::
  ::  the owner ship's HTTP surface for the edit loop. eyre pokes from
  ::  the local ship; a remote poke of this mark could forge an
  ::  authenticated request, so the source is checked before the body
  ::
      %handle-http-request
    ?>  =(src.bowl our.bowl)
    (au-handle-http:au-core !<([eyre-id=@ta =inbound-request:eyre] vase))
  ==
::
::  watch auth is per-path: the automation feed admits the
::  configured owner cross-ship; every other path is local-only.
::
++  watch
  |=  =path
  ^+  cor
  ?+  path  ~|(bad-watch-path+path !!)
  ::
  ::  eyre subscribes here for each inbound HTTP request before it pokes
  ::  %handle-http-request; the response facts go out on this path
  ::
      [%http-response *]
    ?>  =(src.bowl our.bowl)
    cor
  ::
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
  ::
  ::  the harness's pending-command feed (bot side): local only
  ::
      [%v1 %automation %harness ~]
    ?>  =(src.bowl our.bowl)
    au-watch-harness:au-core
  ::
  ::  a client's per-request stream (owner side): local only
  ::
      [%v1 %automation %request @ ~]
    ?>  =(src.bowl our.bowl)
    (au-watch-local-request:au-core (slav %uv i.t.t.t.path))
  ::
  ::  the owner's per-request stream (bot side): only the requester named
  ::  in the path, and only when it is the configured owner
  ::
      [%v1 %automation %request @ @ ~]
    =/  requester  (slav %p i.t.t.t.path)
    ?>  ?&  =(src.bowl requester)
            ?=(^ owner.state)
            =(src.bowl u.owner.state)
        ==
    cor
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
      (log-fail 'Lens Fan-out Nacked' ~['lens fan-out nacked'] u.p.sign ~)
    ==
  ::
      [%lens %retry *]
    ?+  -.sign  cor
        %poke-ack
      ?~  p.sign  cor
      (log-fail 'Lens Retry Nacked' ~['lens retry relay nacked'] u.p.sign ~)
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
      %:  log-fail  'Activity Watch Nacked'
          ~['activity watch nacked']  u.p.sign  ~
      ==
    ==
  ::
      [%journey %chat ~]
    ?+    -.sign  cor
        %fact
      ?.  =(%writ-response-4 p.cage.sign)  cor
      =/  payload=[whom:c response:writs:c]
        !<([whom:c response:writs:c] q.cage.sign)
      (jo-observe-chat:jo-core payload)
    ::
        %kick
      (emit watch-journey-chat)
    ::
        %watch-ack
      ?~  p.sign  cor
      ((slog 'steward: journey chat watch nacked' u.p.sign) cor)
    ==
  ::
      [%journey %channels ~]
    ?+    -.sign  cor
        %fact
      ?.  =(%channel-response-5 p.cage.sign)  cor
      =/  response=r-channels:v10:chv
        !<(r-channels:v10:chv q.cage.sign)
      (jo-observe-channel:jo-core response)
    ::
        %kick
      (emit watch-journey-channels)
    ::
        %watch-ack
      ?~  p.sign  cor
      ((slog 'steward: journey channels watch nacked' u.p.sign) cor)
    ==
  ::
      [%journey %logs ~]
    ?+  -.sign  cor
        %poke-ack
      ?~  p.sign  cor
      ((slog 'steward: journey log poke nacked' u.p.sign) cor)
    ==
  ::
      [%gateway %dm %send ~]
    ?+  -.sign  cor
        %poke-ack
      ?~  p.sign  cor
      %:  log-fail  'Gateway DM Send Failed'
          ~['gateway dm send failed']  u.p.sign  ~
      ==
    ==
  ::
      [%gateway %liveness ~]
    ?+  -.sign  cor
        %poke-ack
      ?~  p.sign  cor
      %:  log-fail  'Gateway Liveness Nacked'
          ~['liveness publish nacked']  u.p.sign  ~
      ==
    ==
  ::
  ::  a trusted bot's automation feed: only content the payload
  ::  attributes to the wire's ship is ever applied
  ::
      [%automation %tasks @ ~]
    (au-handle-bot-sign:au-core (slav %p i.t.t.wire) sign)
  ::
  ::  the owner's per-request relay to a bot: wire carries bot and id
  ::
      [%automation %req @ @ %watch ~]
    %-  au-handle-req-watch-sign:au-core
    [(slav %p i.t.t.wire) (slav %uv i.t.t.t.wire) sign]
  ::
      [%automation %req @ @ %poke ~]
    %-  au-handle-req-poke-sign:au-core
    [(slav %p i.t.t.wire) (slav %uv i.t.t.t.wire) sign]
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
      [%eyre %steward ~]
    cor
  ::
      [%automation %cleanup ~]
    ?.  ?=([%behn %wake *] sign)  cor
    au-cleanup:au-core
  ::
      [%automation %req @ @ %wake ~]
    ?.  ?=([%behn %wake *] sign)  cor
    (au-finalize-pending:au-core (slav %uv i.t.t.t.wire))
  ==
::
++  watch-activity
  ^-  card
  [%pass /activity %agent [our.bowl %activity] %watch /v5]
::
++  watch-journey-chat
  ^-  card
  [%pass /journey/chat %agent [our.bowl %chat] %watch /v4]
::
++  watch-journey-channels
  ^-  card
  [%pass /journey/channels %agent [our.bowl %channels] %watch /v4]
::
::  one subscription initializer serves fresh installs and upgrades. gall
::  preserves live watches across load, so only repair missing subscriptions.
::
++  init-subs
  ^-  (list card)
  =/  subs=(list card)  ~
  =?  subs  !(~(has by wex.bowl) [/activity our.bowl %activity])
    [watch-activity subs]
  =?  subs  !(~(has by wex.bowl) [/journey/chat our.bowl %chat])
    [watch-journey-chat subs]
  =?  subs  !(~(has by wex.bowl) [/journey/channels our.bowl %channels])
    [watch-journey-channels subs]
  (flop subs)
::  |jo-core: content-free backend journey telemetry for OpenClaw messages
::
::  this module is deliberately stateless. a DM or group post is eligible only
::  when the relevant %contacts profile already contains bot-info JSON
::  identifying an OpenClaw harness. missing or malformed markers fail closed.
::
++  jo-core
  |%
  ++  jo-contact
    |=  who=ship
    ^-  (unit contact:co)
    =/  base=path  /(scot %p our.bowl)/contacts/(scot %da now.bowl)
    ?.  .^(? %gu (weld base /$))
      ~
    ?:  =(who our.bowl)
      `.^(contact:co %gx (weld base /v1/self/contact-1))
    =/  peer=path  (weld base /v1/contact/(scot %p who))
    ?.  .^(? %gu peer)
      ~
    `.^(contact:co %gx (weld peer /contact-1))
  ::
  ++  jo-valid-text
    |=  jon=(unit json)
    ^-  ?
    ?~  jon  |
    ?.  ?=([%s *] u.jon)  |
    ?:  =('' p.u.jon)  |
    =/  length=(unit @ud)  (mole |.((lent (tuba (trip p.u.jon)))))
    ?~  length  |
    (lte u.length 64)
  ::
  ++  jo-is-openclaw
    |=  who=ship
    ^-  ?
    =/  con=(unit contact:co)  (jo-contact who)
    ?~  con  |
    ?~  info=(~(get by u.con) %bot-info)  |
    ?.  ?=([%text *] u.info)  |
    ?.  (lte (met 3 p.u.info) 512)  |
    ?~  jon=(de:json:html p.u.info)  |
    ?.  ?=([%o *] u.jon)  |
    ?~  schema-version=(~(get by p.u.jon) 'v')  |
    ?.  =([%n '1'] u.schema-version)  |
    ?~  harness=(~(get by p.u.jon) 'harness')  |
    ?.  ?=([%s *] u.harness)  |
    ?.  (jo-valid-text harness)  |
    ?.  =('openclaw' p.u.harness)  |
    =/  claim-ver=(unit json)  (~(get by p.u.jon) 'version')
    ?.  (jo-valid-text claim-ver)  |
    =/  harness-ver=(unit json)  (~(get by p.u.jon) 'harnessVersion')
    ?~  harness-ver  &
    (jo-valid-text harness-ver)
  ::
  ++  jo-chat-message
    |=  response=response:writs:c
    ^-  (unit [id=id:c author=author:c])
    ?-  -.response.response
      %add
        `[id.response author.essay.response.response]
      %del  ~
      %reply
        =*  delta  delta.response.response
        ?.  ?=(%add -.delta)  ~
        `[id.response.response author.reply-essay.delta]
      %add-react  ~
      %del-react  ~
    ==
  ::
  ::  channel IDs belong to the host; the plugin knows the sender timestamp.
  ::
  ++  jo-channel-message
    |=  response=r-channels:v10:chv
    ^-  (unit [nest=nest:ch id=id:c author=ship])
    =*  nest  nest.response
    ?.  ?|(?=(%chat kind.nest) ?=(%heap kind.nest))  ~
    =*  r-channel  r-channel.response
    ?.  ?=(%post -.r-channel)  ~
    =*  r-post  r-post.r-channel
    ?-  -.r-post
      %set
        ?:  ?=(%| -.post.r-post)  ~
        =/  post=post:v10:chv  +.post.r-post
        ?.  =(0 rev.post)  ~
        =/  author=ship  (get-author-ship:utils author.post)
        `[nest [author sent.post] author]
      %reply
        =*  r-reply  r-reply.r-post
        ?.  ?=(%set -.r-reply)  ~
        ?:  ?=(%| -.reply.r-reply)  ~
        =/  reply=reply:v10:chv  +.reply.r-reply
        ?.  =(0 rev.reply)  ~
        =/  author=ship  (get-author-ship:utils author.reply)
        `[nest [author sent.reply] author]
      %reacts  ~
      %essay   ~
    ==
  ::
  ++  jo-log
    |=  [stage=@t =id:c owner=ship bot=ship destination=@t]
    ^+  cor
    =/  message-id=@t
      (rap 3 (scot %p p.id) '/' (scot %ud q.id) ~)
    =/  id-key=@t
      ?:  ?|  =(stage 'bot_message_sent')
              =(stage 'owner_message_received')
              =(stage 'group_host_message_received')
              =(stage 'owner_group_message_received')
          ==
        'tlon.message_journey.output_message_id'
      'tlon.message_journey.input_message_id'
    =/  data=log-data:logs
      :~  `(pair @t json)`['tlon.message_journey.schema_version' [%n '1']]
          'tlon.message_journey.event'^s+stage
          'tlon.message_journey.message_id'^s+message-id
          id-key^s+message-id
          'tlon.message_journey.owner_ship'^s+(scot %p owner)
          'tlon.message_journey.bot_ship'^s+(scot %p bot)
          'tlon.message_journey.destination_kind'^s+destination
          'tlon.message_journey.source'^s+'steward/journey'
      ==
    =/  body=@t  (cat 3 'tlon.message_journey.' stage)
    =/  echo=echo:logs  ~[`tank`body]
    (emit (~(tell logs bowl /journey/logs) %info echo data))
  ::
  ++  jo-observe-chat
    |=  [=whom:c response=response:writs:c]
    ^+  cor
    ?.  ?=(%ship -.whom)  cor
    =/  peer=ship  p.whom
    ?~  msg=(jo-chat-message response)  cor
    =/  author=author:c  author.u.msg
    =/  author-ship=ship  (get-author-ship:utils author)
    =/  peer-is-child=?
      ?&  ?=(%earl (clan:title peer))
          =(our.bowl (end 5 peer))
      ==
    =/  peer-is-owner=?
      ?~  owner.state  |
      =(peer u.owner.state)
    ?:  =(author-ship our.bowl)
      ?:  peer-is-child
        ?.  (jo-is-openclaw peer)  cor
        (jo-log 'owner_message_sent' id.u.msg our.bowl peer 'dm')
      ?.  peer-is-owner  cor
      ?.  (jo-is-openclaw our.bowl)  cor
      (jo-log 'bot_message_sent' id.u.msg peer our.bowl 'dm')
    ?:  peer-is-child
      ?.  (jo-is-openclaw peer)  cor
      (jo-log 'owner_message_received' id.u.msg our.bowl peer 'dm')
    ?.  peer-is-owner  cor
    ?.  (jo-is-openclaw our.bowl)  cor
    (jo-log 'bot_message_received' id.u.msg peer our.bowl 'dm')
  ::
  ++  jo-observe-channel
    |=  response=r-channels:v10:chv
    ^+  cor
    ?~  msg=(jo-channel-message response)  cor
    =/  bot=ship  author.u.msg
    =/  host=ship  ship.nest.u.msg
    ?:  =(our.bowl host)
      ?.  (jo-is-openclaw bot)  cor
      =/  owner=ship
        ?:  ?=(%earl (clan:title bot))
          (end 5 bot)
        (sein:title our.bowl now.bowl bot)
      =.  cor
        (jo-log 'group_host_message_received' id.u.msg owner bot 'group_channel')
      ?:  =(our.bowl owner)
        (jo-log 'owner_group_message_received' id.u.msg owner bot 'group_channel')
      cor
    ?.  ?&  ?=(%earl (clan:title bot))
            =(our.bowl (end 5 bot))
        ==
      cor
    ?.  (jo-is-openclaw bot)  cor
    (jo-log 'owner_group_message_received' id.u.msg our.bowl bot 'group_channel')
  --
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
      %:  log-tell  %warn  'Lens Payload Oversized'
          ~['lens payload oversized, dropping']
          ~['ship'^s+(scot %p src.bowl)]
      ==
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
  ::  the restart-notice window: the owner DM'd the bot, or anyone engaged it
  ::  (see +ga-note-interaction), within .active-window
  ::
  ++  ga-is-recently-active
    |=  now=@da
    ^-  ?
    ?|  (ga-is-owner-recently-active now)
        ?&  (gth last-interaction.gateway.state *@da)
            (lth (sub now last-interaction.gateway.state) active-window.gateway.state)
        ==
    ==
  ::
  ::  anyone engaging the bot counts as it being in use: an @-mention or a
  ::  reply in one of its threads in a group, or a DM from anyone but itself.
  ::  plain channel traffic the bot merely observes does not.
  ::
  ++  ga-note-interaction
    |=  =event:a
    ^+  cor
    =/  engaged=?
      ?+  -<.event  |
        %post      mention.event
        %reply     |(mention.event =(our.bowl p.id.parent.event))
        %dm-post   !=(our.bowl p.id.key.event)
        %dm-reply  !=(our.bowl p.id.key.event)
      ==
    ?.  engaged  cor
    cor(last-interaction.gateway.state now.bowl)
  ::
  ::  owner-initiated stop reasons (the owner just asked for this restart in
  ::  the app) get a specific notice regardless of owner activity; every other
  ::  reason keeps the activity-gated generic notice. the reason arrives from
  ::  the harness via %gateway-stop (docs/backend/desk/app/steward.md, "stop-reason marker").
  ::
  ++  ga-owner-notice
    |=  reason=@t
    ^-  (unit @t)
    ?:  =('model-change' reason)
      `'Your Tlon bot is restarting to switch models. I should be back shortly. 🔧'
    ~
  ::
  ::  an owner-initiated stop latches .notify-on-start so the next start
  ::  sends ✅ unconditionally. the latch only counts while the stop is
  ::  recent; a restart that takes much longer falls back to the activity
  ::  gate. evaluated lazily at start — no timer.
  ::
  ++  ga-latch-window  ~m15
  ++  ga-is-latch-fresh
    |=  now=@da
    ^-  ?
    =/  ls  last-stop.gateway.state
    ?~  ls  |
    (lth (sub now u.ls) ga-latch-window)
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
  ::  publish liveness into our own %contacts profile as a `bot-liveness`
  ::  %text claim, so peers who have met this bot see when its gateway is
  ::  down (docs/bot-liveness.md). %contacts merges %self and drops an
  ::  unchanged edit, so emitting on every transition costs one local poke.
  ::
  ++  ga-advertise-liveness
    |=  up=?
    ^+  cor
    =/  claim=@t
      ?:  up  '{"v":1,"state":"online"}'
      '{"v":1,"state":"offline"}'
    =/  con=contact:co
      (~(gas by *contact:co) ~[[%bot-liveness [%text claim]]])
    =/  =action:co  [%self con]
    %-  emit
    :^    %pass  /gateway/liveness
        %agent
    [[our.bowl %contacts] %poke contact-action-1+!>(action)]
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
    =/  latched
      &(notify-on-start.gateway.state (ga-is-latch-fresh now.bowl))
    =?  cor
        ?&  pending-restart.gateway.state
            |((ga-is-recently-active now.bowl) latched)
        ==
      =/  tgt  ga-notice-target
      ?~  tgt  cor
      (ga-send-dm u.tgt 'Your Tlon bot is back online and ready to chat again. ✅')
    =.  pending-restart.gateway.state  |
    =.  notify-on-start.gateway.state  |
    =.  cor  (ga-advertise-liveness &)
    ga-give-status-update
  ::
  ++  ga-handle-heartbeat
    |=  [bid=@t lut=@da]
    ^+  cor
    ?>  ga-has-owner
    ?.  =(boot-id.gateway.state `bid)  cor
    =/  was-up  =(%up status.gateway.state)
    =.  status.gateway.state  %up
    =.  pending-restart.gateway.state  |
    =.  cor  (ga-cancel-lease-timer lease-until.gateway.state)
    =.  lease-until.gateway.state  `lut
    =.  last-heartbeat.gateway.state  `now.bowl
    =.  cor  (emit %pass /gateway/lease-check %arvo %b %wait lut)
    ::  a heartbeat that revives an expired lease is an up transition
    =?  cor  !was-up  (ga-advertise-liveness &)
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
    =/  owner-notice  (ga-owner-notice reason)
    =?  notify-on-start.gateway.state  ?=(^ owner-notice)  &
    =/  notice=(unit @t)
      ?^  owner-notice  owner-notice
      ?.  (ga-is-recently-active now.bowl)  ~
      `'Your Tlon bot is restarting. I should be back shortly. 🔧'
    =?  cor  ?=(^ notice)
      =/  tgt  ga-notice-target
      ?~  tgt  cor
      (ga-send-dm u.tgt u.notice)
    =.  cor  (ga-advertise-liveness |)
    ga-give-status-update
  ::
  ++  ga-lease-check
    ^+  cor
    =/  st  status.gateway.state
    ?.  ?=(%up st)  cor
    =/  lut  lease-until.gateway.state
    ?~  lut  cor
    ?.  (lte u.lut now.bowl)  cor
    =.  cor
      %:  log-tell  %warn  'Gateway Lease Expired'
          ~['gateway lease expired, transitioning to down']
          ~
      ==
    =.  status.gateway.state  %down
    =.  pending-restart.gateway.state  &
    =.  cor  (ga-advertise-liveness |)
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
    =.  cor  (ga-note-interaction event)
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
  ::  every automation event carries the same flow, so one PostHog or Loki
  ::  query covers the whole edit loop across owner and bot
  ::
  ++  au-tell
    |=  [vol=volume:v1:lg event=@t =echo:v1:lg extra=log-data:v1:lg]
    ^+  cor
    (log-tell vol event echo ['flow'^s+'steward-automation' extra])
  ++  au-fail
    |=  [event=@t =echo:v1:lg =tang extra=log-data:v1:lg]
    ^+  cor
    (log-fail event echo tang ['flow'^s+'steward-automation' extra])
  ++  au-log-props
    |=  [rid=request-id:v1:sa key=@t who=ship]
    ^-  log-data:v1:lg
    ~['requestId'^s+(scot %uv rid) key^s+(scot %p who)]
  ::
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
    ::
        %edit
      ?>  (au-bot-editable bot.action)
      (au-handle-edit request-id.action bot.action edit.action ~)
    ::
        %finalize
      (au-handle-finalize [request-id body]:action)
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
      %:  au-fail  'Mirror Watch Nacked'
          ~['automation mirror watch nacked']  u.p.sign
          ~['bot'^s+(scot %p bot)]
      ==
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
  ::
  ::  edit loop: client → owner → bot → harness, with the response
  ::  walking back the same way. steward never touches the task map on
  ::  an edit; the change becomes visible through the harness's next
  ::  %project. see docs/backend/desk/app/steward.md
  ::
  ++  au-eyre-card
    ^-  card
    [%pass /eyre/steward %arvo %e %connect [~ /steward] %steward]
  ++  au-cleanup-card
    ^-  card
    [%pass /automation/cleanup %arvo %b %wait (add now.bowl ~m5)]
  ++  au-init-cards
    ^-  (list card)
    ~[au-eyre-card au-cleanup-card]
  ::
  ++  au-harness-path  `path`/v1/automation/harness
  ::  the owner edits its own bots: the local ship, or a trusted one
  ::
  ++  au-bot-editable
    |=  bot=ship
    ^-  ?
    |(=(bot our.bowl) (~(has in bots.state) bot))
  ++  au-req-wire
    |=  [bot=ship rid=request-id:v1:sa kind=@ta]
    ^-  wire
    /automation/req/(scot %p bot)/(scot %uv rid)/[kind]
  ++  au-req-path
    |=  [requester=ship rid=request-id:v1:sa]
    ^-  path
    /v1/automation/request/(scot %p requester)/(scot %uv rid)
  ++  au-local-req-path
    |=  rid=request-id:v1:sa
    ^-  path
    /v1/automation/request/(scot %uv rid)
  ::
  ::  owner side
  ::
  ::  watch the bot's per-request path first so the response cannot be
  ::  missed, then poke the command, then arm the pending wake. the
  ::  owner always pokes the bot; gall loops the poke back when the bot
  ::  is this ship
  ::
  ::    both entry points land here, so the retry guard lives here: a
  ::    second watch on a live wire crashes the poke, and a second command
  ::    applies the edit twice. the HTTP handler answers a retried id from
  ::    its record before calling; a client on the action path is watching
  ::    the per-request path, which replays a stored result on subscribe
  ::
  ++  au-handle-edit
    |=  [rid=request-id:v1:sa bot=ship =edit:v1:sa http-id=(unit @ta)]
    ^+  cor
    ?:  (~(has by requests.automation.state) rid)
      %:  au-tell  %info  'Edit Duplicate'
          ~['request id already in flight, not relaying again']
          (au-log-props rid 'bot' bot)
      ==
    =.  requests.automation.state
      %+  ~(put by requests.automation.state)  rid
      [rid bot http-id %sending ~ ~ |]
    =.  cor
      %:  au-tell  %dbug  'Edit Relayed'
          ~['relaying edit to bot']
          (au-log-props rid 'bot' bot)
      ==
    =.  cor
      %-  emit
      :*  %pass  (au-req-wire bot rid %watch)
          %agent  [bot %steward]
          %watch  (au-req-path our.bowl rid)
      ==
    =.  cor
      %-  emit
      :*  %pass  (au-req-wire bot rid %poke)
          %agent  [bot %steward]
          %poke  %steward-automation-command-1
          !>(`c-automation:v1:sa`[%edit rid edit])
      ==
    %-  emit
    [%pass (au-req-wire bot rid %wake) %arvo %b %wait (add now.bowl ~s20)]
  ::
  ++  au-leave-req
    |=  [bot=ship rid=request-id:v1:sa]
    ^+  cor
    (emit %pass (au-req-wire bot rid %watch) %agent [bot %steward] %leave ~)
  ::
  ++  au-handle-req-watch-sign
    |=  [bot=ship rid=request-id:v1:sa =sign:agent:gall]
    ^+  cor
    ?+  -.sign  cor
        %watch-ack
      ?~  p.sign  cor
      (au-finalize-request rid [%error %not-authorized u.p.sign])
    ::
        %fact
      ?>  ?=(%steward-automation-response-1 p.cage.sign)
      =+  !<(=response:v1:sa q.cage.sign)
      ?.  =(id.response rid)  cor
      =.  cor  (au-finalize-request rid body.response)
      (au-leave-req bot rid)
    ==
  ::
  ++  au-handle-req-poke-sign
    |=  [bot=ship rid=request-id:v1:sa =sign:agent:gall]
    ^+  cor
    ?.  ?=(%poke-ack -.sign)  cor
    ?~  req=(~(get by requests.automation.state) rid)  cor
    ?~  p.sign
      ::  a wake that already stored %pending reads its status from the
      ::  result, so refresh that too or a poller reads %sending forever
      ::
      =/  next  u.req(poke-status %acked)
      =?  result.next  ?=([~ %pending *] result.next)  `[%pending %acked]
      =.  requests.automation.state
        (~(put by requests.automation.state) rid next)
      cor
    =.  requests.automation.state
      (~(put by requests.automation.state) rid u.req(poke-status %nacked))
    =.  cor  (au-finalize-request rid [%error %unknown u.p.sign])
    (au-leave-req bot rid)
  ::
  ::  store the terminal body, fact it on the client's per-request path,
  ::  and complete a held HTTP request exactly once
  ::
  ++  au-finalize-request
    |=  [rid=request-id:v1:sa body=response-body:v1:sa]
    ^+  cor
    ?~  req=(~(get by requests.automation.state) rid)  cor
    =/  =response:v1:sa  [rid body]
    =.  cor  (au-report-result rid bot.u.req body)
    =.  requests.automation.state
      %+  ~(put by requests.automation.state)  rid
      u.req(http-id ~, result `body, final-at `now.bowl)
    =.  cor
      %-  give
      [%fact ~[(au-local-req-path rid)] %steward-automation-response-1 !>(response)]
    ?~  http-id.u.req  cor
    (au-give-http-response u.http-id.u.req response)
  ::  +au-report-result: one report per settled edit. only a fault is a
  ::  %fail: harness-offline is the bot telling us its plugin is down, and
  ::  invalid or not-found is the client's own input coming back
  ::
  ++  au-report-result
    |=  [rid=request-id:v1:sa bot=ship body=response-body:v1:sa]
    ^+  cor
    =/  props  (au-log-props rid 'bot' bot)
    ?.  ?=(%error -.body)
      (au-tell %dbug 'Edit Settled' ~['edit settled'] props)
    =/  vol=?(%info %warn %error)
      ?+  type.body        %warn
        %harness-offline   %info
        %not-authorized    %error
        %harness-error     %error
        %unknown           %error
      ==
    =.  props  ['errorType'^s+type.body props]
    =/  =echo:v1:lg  ~[(cat 3 'edit failed: ' type.body)]
    ?:  ?=(%error vol)
      (au-fail 'Edit Failed' echo message.body props)
    (au-tell vol 'Edit Failed' echo props)
  ::
  ::  the pending wake: close a held HTTP request with %pending and keep
  ::  the record for the late answer. a request already terminal is
  ::  untouched. final-at is stamped so a never-answered request ages
  ::  out in au-cleanup
  ::
  ++  au-finalize-pending
    |=  rid=request-id:v1:sa
    ^+  cor
    ?~  req=(~(get by requests.automation.state) rid)  cor
    ?:  ?=(^ result.u.req)  cor
    =/  body=response-body:v1:sa  [%pending poke-status.u.req]
    =/  =response:v1:sa  [rid body]
    =.  cor
      %:  au-tell  %dbug  'Edit Pending'
          ~['pending wake fired before the bot answered']
          (au-log-props rid 'bot' bot.u.req)
      ==
    =.  requests.automation.state
      %+  ~(put by requests.automation.state)  rid
      u.req(http-id ~, result `body, final-at `now.bowl)
    =.  cor
      %-  give
      [%fact ~[(au-local-req-path rid)] %steward-automation-response-1 !>(response)]
    ?~  http-id.u.req  cor
    (au-give-http-response u.http-id.u.req response)
  ::
  ::  a client subscribing after the result landed gets it immediately
  ::
  ++  au-watch-local-request
    |=  rid=request-id:v1:sa
    ^+  cor
    ?~  req=(~(get by requests.automation.state) rid)  cor
    ?~  result.u.req  cor
    %-  give
    [%fact ~ %steward-automation-response-1 !>(`response:v1:sa`[rid u.result.u.req])]
  ::
  ::  bot side
  ::
  ++  au-harness-online
    ^-  ?
    %+  lien  ~(val by sup.bowl)
    |=  [=ship =path]
    &(=(ship our.bowl) =(path au-harness-path))
  ::
  ::  an accepted command is handed to the harness when one is
  ::  subscribed, and refused at once when none is. the pending record
  ::  carries no deadline: a late answer still completes the request
  ::
  ++  au-poke-command
    |=  =c-automation:v1:sa
    ^+  cor
    ::  narrow a local, not the state field: narrowing .owner in place
    ::  would retype the core and fight the +cor assignments below
    ::
    =/  own  owner.state
    ?>  ?&(?=(^ own) =(src.bowl u.own))
    ?-  -.c-automation
        %edit
      =*  rid  request-id.c-automation
      ?.  au-harness-online
        =.  cor
          %:  au-tell  %info  'Command Refused'
              ~['no harness subscribed, refusing edit']
              (au-log-props rid 'requester' src.bowl)
          ==
        (au-give-response src.bowl [rid %error %harness-offline ~])
      =.  pending.automation.state
        %+  ~(put by pending.automation.state)  rid
        [rid src.bowl edit.c-automation now.bowl]
      =.  cor
        %:  au-tell  %dbug  'Command Dispatched'
            ~['handing edit to the harness']
            (au-log-props rid 'requester' src.bowl)
        ==
      (au-give-dispatch ~[au-harness-path] [rid edit.c-automation])
    ==
  ::
  ++  au-give-dispatch
    |=  [paths=(list path) =dispatch:v1:sa]
    ^+  cor
    (give %fact paths %steward-automation-dispatch-1 !>(dispatch))
  ::
  ++  au-give-response
    |=  [requester=ship =response:v1:sa]
    ^+  cor
    %-  give
    :*  %fact  ~[(au-req-path requester id.response)]
        %steward-automation-response-1  !>(response)
    ==
  ::
  ::  a finalize for an id no longer pending is ignored
  ::
  ++  au-handle-finalize
    |=  [rid=request-id:v1:sa body=response-body:v1:sa]
    ^+  cor
    ?~  pen=(~(get by pending.automation.state) rid)
      %:  au-tell  %dbug  'Finalize Unknown'
          ~['finalize names no pending command']
          ~['requestId'^s+(scot %uv rid)]
      ==
    =.  pending.automation.state  (~(del by pending.automation.state) rid)
    (au-give-response requester.u.pen [rid body])
  ::
  ::  a (re)subscribing harness receives every outstanding command,
  ::  oldest first, so a restart resumes in-flight work
  ::
  ++  au-watch-harness
    ^+  cor
    =/  entries=(list pending-command:v1:sa)
      %+  sort  ~(val by pending.automation.state)
      |=([a=pending-command:v1:sa b=pending-command:v1:sa] (lth sent-at.a sent-at.b))
    |-  ^+  cor
    ?~  entries  cor
    =.  cor  (au-give-dispatch ~ [id edit]:i.entries)
    $(entries t.entries)
  ::
  ::  sweep: terminal records go once fetched or after a day; a pending
  ::  result and a pending command each live an hour; a record with no
  ::  result yet is left for its wake
  ::
  ++  au-cleanup
    ^+  cor
    ::  a request that aged out still holding a %pending result was never
    ::  answered by the bot: the client asked for something and nothing
    ::  ever came back, so it is the one sweep case worth reporting
    ::
    =/  stranded
      %+  skim  ~(val by requests.automation.state)
      |=  req=incoming-request:v1:sa
      ?&  ?=([~ %pending *] result.req)
          ?=(^ final-at.req)
          (gte now.bowl u.final-at.req)
          (gth (sub now.bowl u.final-at.req) ~h1)
      ==
    =.  cor
      |-  ^+  cor
      ?~  stranded  cor
      =.  cor
        %:  au-tell  %warn  'Request Expired'
            ~['request expired without an answer']
            (au-log-props id.i.stranded 'bot' bot.i.stranded)
        ==
      $(stranded t.stranded)
    =.  requests.automation.state
      %-  ~(rep by requests.automation.state)
      |=  [[id=request-id:v1:sa req=incoming-request:v1:sa] out=requests:v1:sa]
      ?~  final-at.req  (~(put by out) id req)
      ?:  (lth now.bowl u.final-at.req)  (~(put by out) id req)
      =/  age  (sub now.bowl u.final-at.req)
      ?:  ?=([~ %pending *] result.req)
        ?:((gth age ~h1) out (~(put by out) id req))
      ?:  |(fetched.req (gth age ~d1))  out
      (~(put by out) id req)
    ::  a command the harness never answered is closed out to its
    ::  requester as harness-offline, so the owner's record finalizes
    ::  instead of ageing out as pending
    ::
    =/  expired
      |=  pen=pending-command:v1:sa
      &((gte now.bowl sent-at.pen) (gth (sub now.bowl sent-at.pen) ~h1))
    =/  dropped  (skim ~(val by pending.automation.state) expired)
    =.  cor
      |-  ^+  cor
      ?~  dropped  cor
      =.  cor
        %:  au-tell  %warn  'Command Expired'
            ~['command expired without a harness answer']
            (au-log-props id.i.dropped 'requester' requester.i.dropped)
        ==
      =.  cor
        (au-give-response requester.i.dropped [id.i.dropped %error %harness-offline ~])
      $(dropped t.dropped)
    =.  pending.automation.state
      %-  ~(rep by pending.automation.state)
      |=  [[id=request-id:v1:sa pen=pending-command:v1:sa] out=pending:v1:sa]
      ?:  (expired pen)  out
      (~(put by out) id pen)
    (emit %pass /automation/cleanup %arvo %b %wait (add now.bowl ~m5))
  ::
  ::  HTTP surface on the owner ship, bound at /steward. auth is eyre's
  ::  authenticated-session check on every route; a request id is not a
  ::  capability, so GET is gated like POST
  ::
  ++  au-handle-http
    |=  [eyre-id=@ta =inbound-request:eyre]
    ^+  cor
    =/  =request-line:server
      (parse-request-line:server url.request.inbound-request)
    =*  site  site.request-line
    =*  ext   ext.request-line
    =/  method=@tas  method.request.inbound-request
    ?.  authenticated.inbound-request
      (au-http-error eyre-id 401 'unauthorized')
    ?:  =(site ~[%steward %~.~ %v1 %automation])
      ?.  =(%'POST' method)  (au-http-error eyre-id 405 'method not allowed')
      (au-handle-http-edit eyre-id inbound-request)
    ?:  =(site ~[%steward %~.~ %v1 %automation %tasks])
      ?.  =(%'GET' method)  (au-http-error eyre-id 405 'method not allowed')
      %^  au-give-http  eyre-id  200
      ['application/json' (en:json:html (ship-tasks:enjs:aj tasks.automation.state))]
    ?:  ?=([%steward %~.~ %v1 %automation %request @ ~] site)
      ?.  =(%'GET' method)  (au-http-error eyre-id 405 'method not allowed')
      ::  a @uv carries dots; apat split its last dot-group off as a
      ::  file extension, so glue it back before parsing
      ::
      =/  rid-knot=@t
        ?~  ext  i.t.t.t.t.t.site
        (rap 3 i.t.t.t.t.t.site '.' u.ext ~)
      (au-handle-http-get-request eyre-id rid-knot)
    ::  the harness answers a dispatch here (bot side): the reply is the
    ::  acknowledgement a channel poke never gives it
    ::
    ?:  =(site ~[%steward %~.~ %v1 %automation %finalize])
      ?.  =(%'POST' method)  (au-http-error eyre-id 405 'method not allowed')
      (au-handle-http-finalize eyre-id inbound-request)
    (au-http-error eyre-id 404 'not found')
  ::
  ::  POST body: { requestId?, bot, action }. malformed input is a 400,
  ::  never a crash. a client-supplied id is honored when it parses;
  ::  otherwise one is minted and rides back in the envelope. the record
  ::  is registered with the eyre id so the request is held open
  ::
  ++  au-handle-http-edit
    |=  [eyre-id=@ta =inbound-request:eyre]
    ^+  cor
    ?~  body.request.inbound-request
      (au-http-error eyre-id 400 'missing body')
    ?~  jon=(de:json:html q.u.body.request.inbound-request)
      (au-http-error eyre-id 400 'invalid json')
    ?.  ?=([%o *] u.jon)
      (au-http-error eyre-id 400 'body must be a json object')
    =/  bot-j=(unit json)  (~(get by p.u.jon) 'bot')
    ?.  ?&(?=(^ bot-j) ?=([%s *] u.bot-j))
      (au-http-error eyre-id 400 'missing `bot` field')
    =/  bot-res=(each ship tang)  (mule |.((slav %p p.u.bot-j)))
    ?:  ?=(%| -.bot-res)
      (au-http-error eyre-id 400 'malformed bot')
    ?~  act-j=(~(get by p.u.jon) 'action')
      (au-http-error eyre-id 400 'missing `action` field')
    =/  edit-res=(each edit:v1:sa tang)  (mule |.((edit:dejs:aj u.act-j)))
    ?:  ?=(%| -.edit-res)
      (au-http-error eyre-id 400 'malformed action')
    ::  a well-formed body is authorized last, so malformed input stays 400
    ::
    ?.  (au-bot-editable p.bot-res)
      (au-http-error eyre-id 403 'bot is not trusted')
    =/  rid=request-id:v1:sa
      =/  rj=(unit json)  (~(get by p.u.jon) 'requestId')
      ?.  ?&(?=(^ rj) ?=([%s *] u.rj))
        `@uv`eny.bowl
      =/  parsed=(each @uv tang)  (mule |.((slav %uv p.u.rj)))
      ?:(?=(%& -.parsed) p.parsed `@uv`eny.bowl)
    ::  a retried id is answered from its record and never re-dispatched:
    ::  a second watch on the same wire would crash the poke, and a second
    ::  command would apply the edit twice
    ::
    =/  existing  (~(get by requests.automation.state) rid)
    ?^  existing
      %+  au-give-http-response  eyre-id
      ?~  result.u.existing  [rid %pending poke-status.u.existing]
      [rid u.result.u.existing]
    (au-handle-edit rid p.bot-res p.edit-res `eyre-id)
  ::
  ::  POST body: the response JSON, { requestId, body }. answers
  ::  { requestId, finalized }, with finalized false for an id no longer
  ::  pending, so a retry after a lost reply is harmless
  ::
  ++  au-handle-http-finalize
    |=  [eyre-id=@ta =inbound-request:eyre]
    ^+  cor
    ?~  body.request.inbound-request
      (au-http-error eyre-id 400 'missing body')
    ?~  jon=(de:json:html q.u.body.request.inbound-request)
      (au-http-error eyre-id 400 'invalid json')
    =/  parsed=(each response:v1:sa tang)
      %-  mule  |.
      %.  u.jon
      (ot:dejs:format 'requestId'^request-id:dejs:aj body+response-body:dejs:aj ~)
    ?:  ?=(%| -.parsed)
      (au-http-error eyre-id 400 'malformed response')
    =/  finalized  (~(has by pending.automation.state) id.p.parsed)
    =.  cor  (au-handle-finalize id.p.parsed body.p.parsed)
    %^  au-give-http  eyre-id  200
    :-  'application/json'
    %-  en:json:html
    %-  pairs:enjs:format
    :~  ['requestId' (request-id:enjs:aj id.p.parsed)]
        ['finalized' b+finalized]
    ==
  ::
  ++  au-handle-http-get-request
    |=  [eyre-id=@ta rid-knot=@t]
    ^+  cor
    =/  parsed=(each @uv tang)  (mule |.((slav %uv rid-knot)))
    ?:  ?=(%| -.parsed)
      (au-http-error eyre-id 400 'malformed request id')
    ?~  req=(~(get by requests.automation.state) p.parsed)
      (au-http-error eyre-id 404 'request not found')
    =/  body=response-body:v1:sa
      ?~  result.u.req  [%pending poke-status.u.req]
      u.result.u.req
    ::  only a terminal body counts as fetched; a poller that saw %pending
    ::  must still find the late result before the sweep evicts it
    ::
    =?  requests.automation.state  !?=(%pending -.body)
      (~(put by requests.automation.state) p.parsed u.req(fetched &))
    (au-give-http-response eyre-id [p.parsed body])
  ::
  ++  au-give-http
    |=  [eyre-id=@ta code=@ud ct=@t body=@t]
    ^+  cor
    =/  paths=(list path)  ~[/http-response/[eyre-id]]
    =/  header=response-header:http  [code ~[['content-type' ct]]]
    =.  cor  (give %fact paths %http-response-header !>(header))
    =/  data=(unit octs)  `(as-octs:mimes:html body)
    =.  cor  (give %fact paths %http-response-data !>(data))
    (give %kick paths ~)
  ::
  ++  au-http-error
    |=  [eyre-id=@ta code=@ud message=@t]
    ^+  cor
    =.  cor
      %:  au-tell  %info  'HTTP Error'
          ~[(cat 3 'http error: ' message)]
          ~['status'^n+(scot %ud code) 'detail'^s+message]
      ==
    (au-give-http eyre-id code 'text/plain' message)
  ::
  ++  au-give-http-response
    |=  [eyre-id=@ta =response:v1:sa]
    ^+  cor
    %^  au-give-http  eyre-id  200
    ['application/json' (en:json:html (response:enjs:aj response))]
  --
--
