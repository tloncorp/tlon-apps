::  tests for %steward agent (lens module + gateway module)
::
/-  s=steward, a=activity, av=activity-ver
/-  l=steward-lens
/-  g=steward-gateway
/-  cv=chat-ver, st=story, c=contacts
/-  chv=channels-ver, gv=groups-ver
/+  *test-agent
/=  agent  /app/steward
|%
++  dap  %steward
::  agent state mirrors. state-1 is current; state-0/gateway-0 are the
::  pre-migration shapes used only by the on-load test. `bots` is the
::  owner-side trusted set.
::
+$  state-1
  $:  %1
      owner=(unit ship)
      bots=(set ship)
      lens=state:v1:l
      gateway=state:v1:g
  ==
+$  state-0
  $:  %0
      owner=(unit ship)
      bots=(set ship)
      lens=state:v1:l
      gateway=gateway-0
  ==
+$  gateway-0
  $:  last-owner-msg=@da
      last-owner-msg-id=(unit message-key:a)
      status=status:v1:g
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
::  lens run payloads are opaque $json; a simple value suffices for tests
::
++  payload   ^-  json  s+'run-record'
++  payload2  ^-  json  s+'partial'
::
::  our ship in tests is ~dev (set via +setup below). +moon stands in for a
::  remote bot ship; the %entry gate is now an explicit trusted-bots set
::  (not sponsorship), so tests that fan in from it call +trust-moon first.
::
++  moon  ^-  ship  (add ~dev (bex 32))
::
++  scries
  |=  =path
  ^-  (unit vase)
  ?+  path  ~
    [%gu @ %activity @ %$ ~]  `!>(&)
  ==
::
++  setup
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (set-scry-gate scries)
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~dev, src ~dev)))
  ;<  *  bind:m  (do-init dap agent)
  ::  do-init resets the bowl, so set the clock after it
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now ~2024.1.1)))
  (pure:m ~)
::
++  configure
  |=  owner=ship
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%configure owner]))
  (pure:m ~)
::
++  trust
  |=  bot=ship
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%trust-bot bot]))
  (pure:m ~)
::
++  trust-moon
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (trust moon)
  (pure:m ~)
::
++  ga-configure
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%configure ~m5 ~m5]))
  (pure:m ~)
::
++  make-dm-fact
  |=  [sender=ship t=@da]
  ^-  [wire gill:gall sign:agent:gall]
  =/  =message-key:a  [[sender t] t]
  =/  source=source:v9:av  [%dm %ship sender]
  =/  event=event:v9:av
    [[%dm-post message-key [%ship sender] ~[[%inline ~['hello']]] %.n] %.n %.n]
  =/  update=update:v9:av  [%add source t event]
  [/activity [~dev %activity] [%fact %activity-update-5 !>(update)]]
::
::  a group post or thread reply as the bot's %activity feed reports it.
::  .mention says the bot was @-mentioned; for replies .parent is the
::  thread root's author (a reply in the bot's own thread when it's ~dev).
::
++  make-post-fact
  |=  [author=ship t=@da mention=?]
  ^-  [wire gill:gall sign:agent:gall]
  =/  =message-key:a  [[author t] t]
  =/  =nest:chv  [%chat ~dev %general]
  =/  =flag:gv  [~dev %group]
  =/  source=source:v9:av  [%channel nest flag]
  =/  event=event:v9:av
    [[%post message-key nest flag ~[[%inline ~['hi']]] mention] %.n %.n]
  =/  update=update:v9:av  [%add source t event]
  [/activity [~dev %activity] [%fact %activity-update-5 !>(update)]]
::
++  make-reply-fact
  |=  [author=ship parent=ship t=@da mention=?]
  ^-  [wire gill:gall sign:agent:gall]
  =/  =message-key:a  [[author t] t]
  =/  parent-key=message-key:a  [[parent (sub t ~m1)] (sub t ~m1)]
  =/  =nest:chv  [%chat ~dev %general]
  =/  =flag:gv  [~dev %group]
  =/  source=source:v9:av  [%thread parent-key nest flag]
  =/  event=event:v9:av
    [[%reply message-key parent-key nest flag ~[[%inline ~['hi']]] mention] %.n %.n]
  =/  update=update:v9:av  [%add source t event]
  [/activity [~dev %activity] [%fact %activity-update-5 !>(update)]]
::
++  make-dm-reply-fact
  |=  [sender=ship t=@da]
  ^-  [wire gill:gall sign:agent:gall]
  =/  =message-key:a  [[sender t] t]
  =/  parent-key=message-key:a  [[~dev (sub t ~m1)] (sub t ~m1)]
  =/  source=source:v9:av  [%dm-thread parent-key %ship sender]
  =/  event=event:v9:av
    [[%dm-reply message-key parent-key [%ship sender] ~[[%inline ~['hi']]] %.n] %.n %.n]
  =/  update=update:v9:av  [%add source t event]
  [/activity [~dev %activity] [%fact %activity-update-5 !>(update)]]
::
::  the exact %contacts %self poke the gateway module emits on every
::  liveness transition (bot-liveness claim; see docs/bot-liveness.md)
::
++  liveness-poke
  |=  up=?
  =/  claim=@t
    ?:  up  '{"v":1,"state":"online"}'
    '{"v":1,"state":"offline"}'
  =/  con=contact:c
    (~(gas by *contact:c) ~[[%bot-liveness [%text claim]]])
  %-  ex-poke
  :*  /gateway/liveness
      [~dev %contacts]
      %contact-action-1
      !>(`action:c`[%self con])
  ==
::
::  the exact owner-notice DM (mirrors +ga-send-dm in the app) sent to the
::  configured owner ~bus at .at
::
++  dm-poke
  |=  [text=@t at=@da]
  =/  content=story:st  ~[[%inline ~[text]]]
  =/  =essay:v7:cv  [[content ~dev at] chat+/ ~ ~]
  =/  =diff:dm:v7:cv  [[~dev at] %add essay `at]
  =/  =action:dm:v7:cv  [~bus diff]
  %-  ex-poke
  :*  /gateway/dm/send
      [~dev %chat]
      %chat-dm-action-2
      !>(action)
  ==
::
++  restart-text  'Your Tlon bot is restarting. I should be back shortly. 🔧'
++  model-text
  'Your Tlon bot is restarting to switch models. I should be back shortly. 🔧'
++  online-text  'Your Tlon bot is back online and ready to chat again. ✅'
::
::  ==========================================================
::  LENS MODULE TESTS
::  ==========================================================
::
++  test-configure-sets-owner
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%configure ~bus]))
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  (ex-equal !>(owner.st) !>(`(unit ship)``~bus))
::
::  a completely foreign ship (not ourselves) must crash the local-only
::  %steward-action-1 (configure) gate
::
++  test-configure-from-foreign-ship-crashes
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  %-  ex-fail
  %-  (do-as ~zod)
  (do-poke %steward-action-1 !>(`action:v1:s`[%configure ~zod]))
::
::  %configure is local-only: a foreign ship must not be able to repoint
::  the owner
::
++  test-configure-from-moon-crashes
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  %-  ex-fail
  %-  (do-as moon)
  (do-poke %steward-action-1 !>(`action:v1:s`[%configure ~bus]))
::
::  a lens run from an untrusted ship crashes the %entry gate
::
++  test-lens-from-foreign-ship-crashes
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  %-  ex-fail
  %-  (do-as ~zod)
  (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'lens-x' payload &]))
::
::  a trusted bot's run is accepted; stored keyed by src (the bot)
::
++  test-lens-from-trusted-bot-accepted
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  ;<  caz=(list card)  bind:m
    %-  (do-as moon)
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'lens-moon' payload &]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  %-  ex-fact
        :*  ~[/v1/lens]
            %steward-lens-update-1
            !>(`update:v1:l`[%entry [moon 'lens-moon'] [& ~2024.1.1 payload]])
        ==
    ==
  ;<  res=cage  bind:m  (got-peek /x/v1/lens/run/(scot %p moon)/lens-moon)
  =+  !<(=update:v1:l q.res)
  (ex-equal !>(update) !>(`update:v1:l`[%entry [moon 'lens-moon'] [& ~2024.1.1 payload]]))
::
::  an untrusted ship's %entry is rejected — sponsorship is not auto-trust
::
++  test-entry-from-untrusted-rejected
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  %-  ex-fail
  %-  (do-as moon)
  (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'no-trust' payload &]))
::
::  %untrust-bot revokes trust; a later %entry from that ship is rejected
::
++  test-untrust-bot-removes-trust
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'while-trusted' payload &]))
  ;<  *  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%untrust-bot moon]))
  %-  ex-fail
  %-  (do-as moon)
  (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'after-untrust' payload &]))
::
::  %trust-bot is self-only — a foreign ship cannot grant itself trust
::
++  test-trust-bot-rejects-foreign-source
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  %-  ex-fail
  %-  (do-as ~zod)
  (do-poke %steward-action-1 !>(`action:v1:s`[%trust-bot ~zod]))
::
::  %untrust-bot is also self-only
::
++  test-untrust-bot-rejects-foreign-source
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  %-  ex-fail
  %-  (do-as ~zod)
  (do-poke %steward-action-1 !>(`action:v1:s`[%untrust-bot ~zod]))
::
::  sending to a non-self owner emits a %steward-lens-action-1 poke
::
++  test-run-final-sends-to-owner
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  caz=(list card)  bind:m
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'lens-1' payload &]))
  %+  ex-cards  caz
  :~  %-  ex-poke
      :*  /lens/send/(scot %p ~bus)/(scot %t 'lens-1')
          [~bus %steward]
          %steward-lens-action-1
          !>(`action:v1:l`[%entry 'lens-1' payload &])
      ==
  ==
::
::  self-owned bot stores directly without a network hop
::
++  test-self-owner-stores-without-network-hop
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~dev)
  ;<  caz=(list card)  bind:m
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'lens-1' payload &]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  %-  ex-fact
        :*  ~[/v1/lens]
            %steward-lens-update-1
            !>(`update:v1:l`[%entry [~dev 'lens-1'] [& ~2024.1.1 payload]])
        ==
    ==
  ;<  res=cage  bind:m  (got-peek /x/v1/lens/run/(scot %p ~dev)/lens-1)
  =+  !<(=update:v1:l q.res)
  (ex-equal !>(update) !>(`update:v1:l`[%entry [~dev 'lens-1'] [& ~2024.1.1 payload]]))
::
::  a poke from a trusted bot is stored keyed by src.bowl (the bot)
::
++  test-action-stores-keyed-by-source
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  ;<  caz=(list card)  bind:m
    %-  (do-as moon)
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'lens-2' payload |]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  %-  ex-fact
        :*  ~[/v1/lens]
            %steward-lens-update-1
            !>(`update:v1:l`[%entry [moon 'lens-2'] [| ~2024.1.1 payload]])
        ==
    ==
  ;<  res=cage  bind:m  (got-peek /x/v1/lens/run/(scot %p moon)/lens-2)
  =+  !<(=update:v1:l q.res)
  (ex-equal !>(update) !>(`update:v1:l`[%entry [moon 'lens-2'] [| ~2024.1.1 payload]]))
::
::  final=& marks the run complete
::
++  test-final-marks-run-complete
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'lens-3' payload |]))
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'lens-3' payload &]))
  ;<  res=cage  bind:m  (got-peek /x/v1/lens/run/(scot %p moon)/lens-3)
  =+  !<(=update:v1:l q.res)
  ?>  ?=(%entry -.update)
  (ex-equal !>(complete.run.entry.update) !>(&))
::
::  a late partial (final=|) arriving after a final (final=&) is dropped
::
++  test-late-event-after-final-is-dropped
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'lens-4' payload &]))
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now ~2024.1.2)))
  ;<  caz=(list card)  bind:m
    %-  (do-as moon)
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'lens-4' payload2 |]))
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  res=cage  bind:m  (got-peek /x/v1/lens/run/(scot %p moon)/lens-4)
  =+  !<(=update:v1:l q.res)
  ?>  ?=(%entry -.update)
  (ex-equal !>(run.entry.update) !>(`run:v1:l`[& ~2024.1.1 payload]))
::
::  retention is count-only: with the cap at 2, a third run for the same bot
::  drops the oldest, regardless of age
::
++  test-runs-pruned-by-count
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  ;<  *  bind:m
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%configure 2]))
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'run-a' payload &]))
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now (add ~2024.1.1 ~m1))))
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'run-b' payload &]))
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now (add ~2024.1.1 ~m2))))
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'run-c' payload &]))
  ;<  res=cage  bind:m  (got-peek /x/v1/lens/recent)
  =+  !<(=update:v1:l q.res)
  ?>  ?=(%recent -.update)
  ;<  ~  bind:m  (ex-equal !>((lent entries.update)) !>(2))
  ::  oldest (run-a) dropped; newest first
  =/  ids  (turn entries.update |=(=entry:v1:l id.entry))
  (ex-equal !>(ids) !>(`(list @t)`~['run-c' 'run-b']))
::
::  %configure sets the per-bot cap and prunes every bot immediately
::
++  test-configure-cap-prunes-existing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'run-a' payload &]))
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now (add ~2024.1.1 ~m1))))
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'run-b' payload &]))
  ;<  *  bind:m
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%configure 1]))
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  (ex-equal !>(~(wyt by runs.lens.st)) !>(1))
::
::  /x/v1/lens/since/[da] returns entries with received >= cutoff, newest
::  first
::
++  test-since-scry-filters-by-cutoff
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'run-a' payload &]))
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now (add ~2024.1.1 ~m1))))
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'run-b' payload &]))
  ;<  res=cage  bind:m
    (got-peek /x/v1/lens/since/(scot %da (add ~2024.1.1 ~m1)))
  =+  !<(=update:v1:l q.res)
  ?>  ?=(%recent -.update)
  ;<  ~  bind:m  (ex-equal !>((lent entries.update)) !>(1))
  ?>  ?=(^ entries.update)
  (ex-equal !>(id.i.entries.update) !>('run-b'))
::
::  an oversized payload (jam > 512KB) is dropped, not stored or facted
::
++  test-oversized-payload-dropped
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  =/  big=json  [%s `@t`(rap 3 (reap 530.000 'x'))]
  ;<  caz=(list card)  bind:m
    %-  (do-as moon)
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'big' big &]))
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  run=(unit (unit cage))  bind:m
    (get-peek /x/v1/lens/run/(scot %p moon)/big)
  (ex-equal !>(?=([~ ~] run)) !>(&))
::
::  a retry for a run we host locally (bot == our) emits a %retry-requested
::  fact on /v1/lens for the local gateway to pick up
::
++  test-retry-local-emits-fact
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%retry ~dev 'lens-r']))
  %+  ex-cards  caz
  :~  %-  ex-fact
      :*  ~[/v1/lens]
          %steward-lens-update-1
          !>(`update:v1:l`[%retry-requested 'lens-r' ~dev])
      ==
  ==
::
::  a retry for a bot we own (bot != our) relays cross-ship to that bot's
::  steward
::
++  test-retry-relays-cross-ship
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%retry moon 'lens-r']))
  %+  ex-cards  caz
  :~  %-  ex-poke
      :*  /lens/retry/(scot %p moon)/(scot %t 'lens-r')
          [moon %steward]
          %steward-lens-action-1
          !>(`action:v1:l`[%retry moon 'lens-r'])
      ==
  ==
::
::  a retry from the configured owner (cross-ship) for one of our bots is
::  accepted and emits the local fact
::
++  test-retry-from-owner-accepted
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  caz=(list card)  bind:m
    %-  (do-as ~bus)
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%retry ~dev 'lens-r']))
  %+  ex-cards  caz
  :~  %-  ex-fact
      :*  ~[/v1/lens]
          %steward-lens-update-1
          !>(`update:v1:l`[%retry-requested 'lens-r' ~bus])
      ==
  ==
::
::  a cross-ship retry (from the owner) must target us — it is never proxied
::  on to a third ship
::
++  test-retry-cross-ship-no-proxy
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  %-  ex-fail
  %-  (do-as ~bus)
  (do-poke %steward-lens-action-1 !>(`action:v1:l`[%retry ~zod 'lens-r']))
::
::  a retry from a foreign ship (neither us nor the configured owner) crashes
::
++  test-retry-from-foreign-crashes
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  %-  ex-fail
  %-  (do-as ~zod)
  (do-poke %steward-lens-action-1 !>(`action:v1:l`[%retry ~dev 'lens-r']))
::
::  on-init subscribes to %activity and seeds the default retention cap
::
++  test-init-arms-activity-and-cap
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (set-scry-gate scries)
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~dev, src ~dev)))
  ;<  caz=(list card)  bind:m  (do-init dap agent)
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-task /activity [~dev %activity] %watch /v5)
    ==
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  (ex-equal !>(max-runs-per-bot.lens.st) !>(`@ud`3.000))
::
++  test-watch-rejects-foreign-ship
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  %-  ex-fail
  %-  (do-as ~zod)
  (do-watch /v1/lens)
::  +get-peek calls +on-peek bare (no +mock), so a ?> crash would take
::  down the runner; mule the calls directly instead of using +ex-fail
::
++  test-peek-rejects-foreign-ship
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (set-src ~zod)
  |=  s=state
  =/  recent  (mule |.((~(on-peek agent.s bowl.s) /x/v1/lens/recent)))
  ?:  ?=(%& -.recent)
    |+~['expected foreign /x/v1/lens/recent peek to crash']
  =/  run  (mule |.((~(on-peek agent.s bowl.s) /x/v1/lens/run/(scot %p ~zod)/lens-1)))
  ?:  ?=(%& -.run)
    |+~['expected foreign /x/v1/lens/run peek to crash']
  &+[~ s]
::
::  ==========================================================
::  GATEWAY MODULE TESTS
::  ==========================================================
::
::  after setup+configure+ga-configure the gateway has an owner and timing.
::  lifecycle pokes use %steward-gateway-action-1.
::
++  setup-gateway
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  ~  bind:m  ga-configure
  (pure:m ~)
::
++  test-gw-configure-sets-timing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(active-window.gateway.st) !>(~m5))
  (ex-equal !>(reply-cooldown.gateway.st) !>(~m5))
::
++  test-gw-lifecycle-poke-crashes-without-owner
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  ga-configure
  (ex-fail (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' (add ~2024.1.1 ~m2)])))
::
++  test-gw-start-sets-status-up
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  =/  lease-time  (add ~2024.1.1 ~s90)
  ;<  caz=(list card)  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' lease-time]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-arvo /gateway/lease-check %b %wait lease-time)
        (liveness-poke &)
        (ex-fact-paths ~[/v1/gateway])
    ==
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(status.gateway.st) !>(%up))
  (ex-equal !>(lease-until.gateway.st) !>(`lease-time))
::
++  test-gw-heartbeat-restores-up-after-expiry
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  =/  lease-time  (add ~2024.1.1 ~s90)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' lease-time]))
  ;<  ~  bind:m  (wait ~s91)
  ;<  *  bind:m  (do-arvo /gateway/lease-check [%behn %wake ~])
  =/  new-lease  (add ~2024.1.1 ~m5)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-heartbeat 'boot-1' new-lease]))
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(status.gateway.st) !>(%up))
  ;<  ~  bind:m  (ex-equal !>(pending-restart.gateway.st) !>(|))
  (ex-equal !>(lease-until.gateway.st) !>(`new-lease))
::
++  test-gw-stop-sets-down
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  =/  lease-time  (add ~2024.1.1 ~m2)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' lease-time]))
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-stop 'boot-1' 'test']))
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(status.gateway.st) !>(%down))
  (ex-equal !>(pending-restart.gateway.st) !>(&))
::
::  a stop for a stale boot-id is a no-op even when it carries an
::  owner-initiated reason: no DM, no liveness poke, no fact, no latch
::
++  test-gw-stale-stop-ignored
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  =/  lease-time  (add ~2024.1.1 ~m2)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' lease-time]))
  ;<  caz=(list card)  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-stop 'boot-old' 'model-change']))
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(status.gateway.st) !>(%up))
  ;<  ~  bind:m  (ex-equal !>(boot-id.gateway.st) !>(`'boot-1'))
  ;<  ~  bind:m  (ex-equal !>(notify-on-start.gateway.st) !>(|))
  (ex-equal !>(pending-restart.gateway.st) !>(|))
::
++  test-gw-stale-heartbeat-after-stop-ignored
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  =/  lease-time  (add ~2024.1.1 ~m2)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' lease-time]))
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-stop 'boot-1' 'shutdown']))
  =/  new-lease  (add ~2024.1.1 ~m5)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-heartbeat 'boot-1' new-lease]))
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(status.gateway.st) !>(%down))
  ;<  ~  bind:m  (ex-equal !>(boot-id.gateway.st) !>(~))
  (ex-equal !>(pending-restart.gateway.st) !>(&))
::
++  test-gw-lease-expiry
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  =/  lease-time  (add ~2024.1.1 ~s90)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' lease-time]))
  ;<  ~  bind:m  (wait ~s91)
  ;<  *  bind:m  (do-arvo /gateway/lease-check [%behn %wake ~])
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(status.gateway.st) !>(%down))
  (ex-equal !>(pending-restart.gateway.st) !>(&))
::
++  test-gw-owner-dm-while-down-sends-reply
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  ::  gateway is %down (never started)
  ;<  caz=(list card)  bind:m  (do-agent (make-dm-fact ~bus ~2024.1.1))
  %+  ex-cards  caz
  :~  (ex-fact-paths ~[/v1/gateway])
      (ex-poke-wire /gateway/dm/send)
      (ex-fact-paths ~[/v1/gateway])
  ==
::
++  test-gw-owner-dm-while-healthy-no-reply
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  =/  lease-time  (add ~2024.1.1 ~m2)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' lease-time]))
  ;<  caz=(list card)  bind:m  (do-agent (make-dm-fact ~bus ~2024.1.1))
  %+  ex-cards  caz
  :~  (ex-fact-paths ~[/v1/gateway])
  ==
::
::  a non-owner DM never gets the offline auto-reply or an owner-activity
::  fact (it does count as an interaction — see the activity-window tests)
::
++  test-gw-non-owner-dm-no-cards
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  ;<  caz=(list card)  bind:m  (do-agent (make-dm-fact ~zod ~2024.1.1))
  (ex-cards caz ~)
::
::  the bot's own messages are neither owner activity nor an interaction
::
++  test-gw-self-message-ignored
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~dev)
  ;<  ~  bind:m  ga-configure
  ;<  caz=(list card)  bind:m  (do-agent (make-dm-fact ~dev ~2024.1.1))
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(last-owner-msg.gateway.st) !>(*@da))
  (ex-equal !>(last-interaction.gateway.st) !>(*@da))
::
++  test-gw-dedupe-same-message-key
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  ;<  caz=(list card)  bind:m  (do-agent (make-dm-fact ~bus ~2024.1.1))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-fact-paths ~[/v1/gateway])
        (ex-poke-wire /gateway/dm/send)
        (ex-fact-paths ~[/v1/gateway])
    ==
  ;<  ~  bind:m  (wait ~m6)
  ;<  caz=(list card)  bind:m  (do-agent (make-dm-fact ~bus ~2024.1.1))
  %+  ex-cards  caz
  :~  (ex-fact-paths ~[/v1/gateway])
  ==
::
++  test-gw-cooldown-suppresses-second-reply
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  ;<  caz=(list card)  bind:m  (do-agent (make-dm-fact ~bus ~2024.1.1))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-fact-paths ~[/v1/gateway])
        (ex-poke-wire /gateway/dm/send)
        (ex-fact-paths ~[/v1/gateway])
    ==
  ;<  ~  bind:m  (wait ~s1)
  =/  t2  (add ~2024.1.1 ~s1)
  ;<  caz=(list card)  bind:m  (do-agent (make-dm-fact ~bus t2))
  %+  ex-cards  caz
  :~  (ex-fact-paths ~[/v1/gateway])
  ==
::
++  test-gw-start-clears-pending-restart
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  =/  lease-time  (add ~2024.1.1 ~m2)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' lease-time]))
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-stop 'boot-1' 'test']))
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(pending-restart.gateway.st) !>(&))
  =/  lease-time-2  (add ~2024.1.1 ~m4)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-2' lease-time-2]))
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(status.gateway.st) !>(%up))
  (ex-equal !>(pending-restart.gateway.st) !>(|))
::
++  test-gw-scry-status
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  =/  lease-time  (add ~2024.1.1 ~m2)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' lease-time]))
  ;<  res=cage  bind:m  (got-peek /x/v1/gateway/status)
  =+  !<([=status:v1:g lut=(unit @da)] q.res)
  ;<  ~  bind:m  (ex-equal !>(status) !>(%up))
  (ex-equal !>(lut) !>(`lease-time))
::
::  ==========================================================
::  OWNER-INITIATED RESTART NOTICES + LIVENESS PUBLICATION
::  ==========================================================
::
::  a %gateway-stop with an owner-initiated reason ('model-change') sends the
::  specific 🔧 notice even though the owner never messaged, and latches
::  notify-on-start. card order: %rest, DM, liveness poke, status fact.
::
++  test-gw-model-change-stop-notifies-without-activity
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  =/  lease-time  (add ~2024.1.1 ~m2)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' lease-time]))
  ;<  caz=(list card)  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-stop 'boot-1' 'model-change']))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-arvo /gateway/lease-check %b %rest lease-time)
        (dm-poke model-text ~2024.1.1)
        (liveness-poke |)
        (ex-fact-paths ~[/v1/gateway])
    ==
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(notify-on-start.gateway.st) !>(&))
  (ex-equal !>(pending-restart.gateway.st) !>(&))
::
::  a generic stop with no recent owner activity stays silent (today's
::  behaviour): no DM, but the offline liveness claim still goes out
::
++  test-gw-generic-stop-silent-without-activity
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  =/  lease-time  (add ~2024.1.1 ~m2)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' lease-time]))
  ;<  caz=(list card)  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-stop 'boot-1' 'gateway stopping']))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-arvo /gateway/lease-check %b %rest lease-time)
        (liveness-poke |)
        (ex-fact-paths ~[/v1/gateway])
    ==
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  (ex-equal !>(notify-on-start.gateway.st) !>(|))
::
::  the start after an owner-initiated stop sends ✅ without owner activity
::  and clears the latch. the stale lease's %rest precedes the new %wait.
::
++  test-gw-start-after-model-change-notifies-without-activity
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  =/  lease-time  (add ~2024.1.1 ~m2)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' lease-time]))
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-stop 'boot-1' 'model-change']))
  ;<  ~  bind:m  (wait ~s13)
  =/  t2  (add ~2024.1.1 ~s13)
  =/  lease-time-2  (add t2 ~m2)
  ;<  caz=(list card)  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-2' lease-time-2]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-arvo /gateway/lease-check %b %rest lease-time)
        (ex-arvo /gateway/lease-check %b %wait lease-time-2)
        (dm-poke online-text t2)
        (liveness-poke &)
        (ex-fact-paths ~[/v1/gateway])
    ==
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(notify-on-start.gateway.st) !>(|))
  (ex-equal !>(pending-restart.gateway.st) !>(|))
::
::  a latch older than the 15-minute window no longer forces ✅; the start
::  falls back to the (absent) activity gate and still clears the latch
::
++  test-gw-latch-expires
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  =/  lease-time  (add ~2024.1.1 ~m2)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' lease-time]))
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-stop 'boot-1' 'model-change']))
  ;<  ~  bind:m  (wait ~m16)
  =/  lease-time-2  (add ~2024.1.1 ~m18)
  ;<  caz=(list card)  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-2' lease-time-2]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-arvo /gateway/lease-check %b %rest lease-time)
        (ex-arvo /gateway/lease-check %b %wait lease-time-2)
        (liveness-poke &)
        (ex-fact-paths ~[/v1/gateway])
    ==
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  (ex-equal !>(notify-on-start.gateway.st) !>(|))
::
::  regression guard for today's generic notices: a recently active owner
::  gets 🔧 on a generic stop and ✅ on the following start
::
++  test-gw-generic-restart-notifies-after-activity
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  =/  lease-time  (add ~2024.1.1 ~m2)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' lease-time]))
  ::  owner DM while the gateway is up: activity only, no auto-reply
  ;<  *  bind:m  (do-agent (make-dm-fact ~bus ~2024.1.1))
  ;<  caz=(list card)  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-stop 'boot-1' 'gateway stopping']))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-arvo /gateway/lease-check %b %rest lease-time)
        (dm-poke restart-text ~2024.1.1)
        (liveness-poke |)
        (ex-fact-paths ~[/v1/gateway])
    ==
  =/  lease-time-2  (add ~2024.1.1 ~m4)
  ;<  caz=(list card)  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-2' lease-time-2]))
  %+  ex-cards  caz
  :~  (ex-arvo /gateway/lease-check %b %rest lease-time)
      (ex-arvo /gateway/lease-check %b %wait lease-time-2)
      (dm-poke online-text ~2024.1.1)
      (liveness-poke &)
      (ex-fact-paths ~[/v1/gateway])
  ==
::
::  lease expiry publishes offline; a heartbeat that revives the lease
::  publishes online again
::
++  test-gw-lease-expiry-advertises-offline
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  =/  lease-time  (add ~2024.1.1 ~s90)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' lease-time]))
  ;<  ~  bind:m  (wait ~s91)
  ;<  caz=(list card)  bind:m  (do-arvo /gateway/lease-check [%behn %wake ~])
  %+  ex-cards  caz
  :~  (liveness-poke |)
      (ex-fact-paths ~[/v1/gateway])
  ==
::
++  test-gw-heartbeat-restore-advertises-online
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  =/  lease-time  (add ~2024.1.1 ~s90)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' lease-time]))
  ;<  ~  bind:m  (wait ~s91)
  ;<  *  bind:m  (do-arvo /gateway/lease-check [%behn %wake ~])
  =/  new-lease  (add ~2024.1.1 ~m5)
  ;<  caz=(list card)  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-heartbeat 'boot-1' new-lease]))
  %+  ex-cards  caz
  :~  (ex-arvo /gateway/lease-check %b %rest lease-time)
      (ex-arvo /gateway/lease-check %b %wait new-lease)
      (liveness-poke &)
      (ex-fact-paths ~[/v1/gateway])
  ==
::
::  a heartbeat while already up is not a transition: no liveness poke
::
++  test-gw-heartbeat-while-up-no-liveness-poke
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  =/  lease-time  (add ~2024.1.1 ~s90)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' lease-time]))
  =/  new-lease  (add ~2024.1.1 ~m5)
  ;<  caz=(list card)  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-heartbeat 'boot-1' new-lease]))
  %+  ex-cards  caz
  :~  (ex-arvo /gateway/lease-check %b %rest lease-time)
      (ex-arvo /gateway/lease-check %b %wait new-lease)
      (ex-fact-paths ~[/v1/gateway])
  ==
::
::  on-load migrates a %0 state: every gateway field survives and the new
::  notify-on-start flag starts cleared
::
++  test-on-load-migrates-state-0
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  =/  g=gateway-0  *gateway-0
  =.  last-owner-msg.g  ~2024.1.1
  =.  pending-restart.g  &
  =.  reply-cooldown.g  ~m3
  =.  active-window.g  ~m5
  =.  status.g  %up
  =/  old=state-0  [%0 `~bus (sy ~[moon]) *state:v1:l g]
  ;<  caz=(list card)  bind:m  (do-load agent `!>(old))
  ::  an already-up gateway seeds the liveness claim it predates
  ;<  ~  bind:m  (ex-cards caz (liveness-poke &) ~)
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(owner.st) !>(`(unit ship)``~bus))
  ;<  ~  bind:m  (ex-equal !>((~(has in bots.st) moon)) !>(&))
  ;<  ~  bind:m  (ex-equal !>(notify-on-start.gateway.st) !>(|))
  ;<  ~  bind:m  (ex-equal !>(last-interaction.gateway.st) !>(*@da))
  ;<  ~  bind:m  (ex-equal !>(last-owner-msg.gateway.st) !>(~2024.1.1))
  ;<  ~  bind:m  (ex-equal !>(pending-restart.gateway.st) !>(&))
  ;<  ~  bind:m  (ex-equal !>(reply-cooldown.gateway.st) !>(~m3))
  (ex-equal !>(active-window.gateway.st) !>(~m5))
::
::  a migrated bot whose gateway is down seeds offline
::
++  test-on-load-migration-seeds-offline-when-down
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  =/  g=gateway-0  *gateway-0
  =.  status.g  %down
  =/  old=state-0  [%0 `~bus (sy ~[moon]) *state:v1:l g]
  ;<  caz=(list card)  bind:m  (do-load agent `!>(old))
  (ex-cards caz (liveness-poke |) ~)
::
::  no seed without an owner (%steward runs on every ship) ...
::
++  test-on-load-migration-seeds-nothing-without-owner
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  =/  g=gateway-0  *gateway-0
  =.  status.g  %up
  =/  old=state-0  [%0 ~ (sy ~[moon]) *state:v1:l g]
  ;<  caz=(list card)  bind:m  (do-load agent `!>(old))
  (ex-cards caz ~)
::
::  ... or for a gateway that never registered
::
++  test-on-load-migration-seeds-nothing-when-unknown
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  =/  old=state-0  [%0 `~bus (sy ~[moon]) *state:v1:l *gateway-0]
  ;<  caz=(list card)  bind:m  (do-load agent `!>(old))
  (ex-cards caz ~)
::
::  ==========================================================
::  ACTIVITY WINDOW: ANYONE ENGAGING THE BOT COUNTS
::  ==========================================================
::
::  a group @-mention of the bot by a non-owner puts it in the notice window:
::  the next generic stop sends 🔧 although the owner never DM'd
::
++  test-gw-group-mention-widens-notice-window
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  =/  lease-time  (add ~2024.1.1 ~m2)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' lease-time]))
  ;<  caz=(list card)  bind:m  (do-agent (make-post-fact ~zod ~2024.1.1 &))
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  caz=(list card)  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-stop 'boot-1' 'gateway stopping']))
  %+  ex-cards  caz
  :~  (ex-arvo /gateway/lease-check %b %rest lease-time)
      (dm-poke restart-text ~2024.1.1)
      (liveness-poke |)
      (ex-fact-paths ~[/v1/gateway])
  ==
::
::  a group post that merely passes through a channel the bot watches does
::  not count: no notice on the following generic stop
::
++  test-gw-group-post-without-mention-ignored
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  =/  lease-time  (add ~2024.1.1 ~m2)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' lease-time]))
  ;<  *  bind:m  (do-agent (make-post-fact ~zod ~2024.1.1 |))
  ;<  caz=(list card)  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-stop 'boot-1' 'gateway stopping']))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-arvo /gateway/lease-check %b %rest lease-time)
        (liveness-poke |)
        (ex-fact-paths ~[/v1/gateway])
    ==
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  (ex-equal !>(last-interaction.gateway.st) !>(*@da))
::
::  a reply in one of the bot's own threads counts even without a mention
::
++  test-gw-reply-in-bot-thread-widens-notice-window
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  =/  lease-time  (add ~2024.1.1 ~m2)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' lease-time]))
  ;<  *  bind:m  (do-agent (make-reply-fact ~zod ~dev ~2024.1.1 |))
  ;<  caz=(list card)  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-stop 'boot-1' 'gateway stopping']))
  %+  ex-cards  caz
  :~  (ex-arvo /gateway/lease-check %b %rest lease-time)
      (dm-poke restart-text ~2024.1.1)
      (liveness-poke |)
      (ex-fact-paths ~[/v1/gateway])
  ==
::
::  a reply in someone else's thread, with no mention, does not count
::
++  test-gw-reply-in-other-thread-ignored
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  =/  lease-time  (add ~2024.1.1 ~m2)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' lease-time]))
  ;<  *  bind:m  (do-agent (make-reply-fact ~zod ~bus ~2024.1.1 |))
  ;<  caz=(list card)  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-stop 'boot-1' 'gateway stopping']))
  %+  ex-cards  caz
  :~  (ex-arvo /gateway/lease-check %b %rest lease-time)
      (liveness-poke |)
      (ex-fact-paths ~[/v1/gateway])
  ==
::
::  an @-mention in a reply counts even when the thread isn't the bot's
::
++  test-gw-reply-mention-elsewhere-widens-notice-window
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  =/  lease-time  (add ~2024.1.1 ~m2)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' lease-time]))
  ;<  *  bind:m  (do-agent (make-reply-fact ~zod ~bus ~2024.1.1 &))
  ;<  caz=(list card)  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-stop 'boot-1' 'gateway stopping']))
  %+  ex-cards  caz
  :~  (ex-arvo /gateway/lease-check %b %rest lease-time)
      (dm-poke restart-text ~2024.1.1)
      (liveness-poke |)
      (ex-fact-paths ~[/v1/gateway])
  ==
::
::  a DM thread reply from a non-owner counts like a DM post
::
++  test-gw-non-owner-dm-reply-widens-notice-window
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  =/  lease-time  (add ~2024.1.1 ~m2)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' lease-time]))
  ;<  caz=(list card)  bind:m  (do-agent (make-dm-reply-fact ~zod ~2024.1.1))
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  caz=(list card)  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-stop 'boot-1' 'gateway stopping']))
  %+  ex-cards  caz
  :~  (ex-arvo /gateway/lease-check %b %rest lease-time)
      (dm-poke restart-text ~2024.1.1)
      (liveness-poke |)
      (ex-fact-paths ~[/v1/gateway])
  ==
::
::  a DM from a non-owner counts too (while up it triggers no auto-reply
::  and no owner-activity fact, only the interaction timestamp)
::
++  test-gw-non-owner-dm-widens-notice-window
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  =/  lease-time  (add ~2024.1.1 ~m2)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' lease-time]))
  ;<  caz=(list card)  bind:m  (do-agent (make-dm-fact ~zod ~2024.1.1))
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  caz=(list card)  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-stop 'boot-1' 'gateway stopping']))
  %+  ex-cards  caz
  :~  (ex-arvo /gateway/lease-check %b %rest lease-time)
      (dm-poke restart-text ~2024.1.1)
      (liveness-poke |)
      (ex-fact-paths ~[/v1/gateway])
  ==
::
::  an interaction older than the window no longer counts
::
++  test-gw-stale-interaction-outside-window
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  =/  lease-time  (add ~2024.1.1 ~m10)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' lease-time]))
  ;<  *  bind:m  (do-agent (make-post-fact ~zod ~2024.1.1 &))
  ;<  ~  bind:m  (wait ~m6)
  ;<  caz=(list card)  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-stop 'boot-1' 'gateway stopping']))
  %+  ex-cards  caz
  :~  (ex-arvo /gateway/lease-check %b %rest lease-time)
      (liveness-poke |)
      (ex-fact-paths ~[/v1/gateway])
  ==
--
