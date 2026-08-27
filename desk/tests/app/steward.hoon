::  tests for %steward agent (lens module + gateway module + prompts module)
::
/-  s=steward, a=activity, av=activity-ver
/-  l=steward-lens
/-  g=steward-gateway
/-  p=steward-prompts
/+  *test-agent
/=  agent  /app/steward
|%
++  dap  %steward
::  current agent state. `bots` is the owner-side trusted set.
::
+$  state-1
  $:  %1
      owner=(unit ship)
      bots=(set ship)
      lens=state:v1:l
      gateway=state:v1:g
      prompts=state:v1:p
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
++  test-gw-stale-stop-ignored
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  =/  lease-time  (add ~2024.1.1 ~m2)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' lease-time]))
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-stop 'boot-old' 'stale']))
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(status.gateway.st) !>(%up))
  ;<  ~  bind:m  (ex-equal !>(boot-id.gateway.st) !>(`'boot-1'))
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
++  test-gw-non-owner-dm-ignored
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  ;<  caz=(list card)  bind:m  (do-agent (make-dm-fact ~zod ~2024.1.1))
  (ex-cards caz ~)
::
++  test-gw-self-message-ignored
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~dev)
  ;<  ~  bind:m  ga-configure
  ;<  caz=(list card)  bind:m  (do-agent (make-dm-fact ~dev ~2024.1.1))
  (ex-cards caz ~)
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
::  PROMPTS MODULE TESTS
::  ==========================================================
::
::  a gateway %seed stores the effective set and fans it to the owner
::
++  test-pr-seed-stores-and-syncs-to-owner
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  =/  seed=(map @t @t)
    (my ~[['SOUL.md' 'be kind'] ['AGENTS.md' 'do agent things']])
  =/  expect=prompts:v1:p
    %-  my
    :~  ['SOUL.md' 'be kind' ~2024.1.1 %.n]
        ['AGENTS.md' 'do agent things' ~2024.1.1 %.n]
    ==
  ;<  caz=(list card)  bind:m
    (do-poke %steward-prompts-action-1 !>(`action:v1:p`[%seed seed]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  %-  ex-fact
        :*  ~[/v1/prompts]
            %steward-prompts-update-1
            !>(`update:v1:p`[%prompts ~dev expect])
        ==
        %-  ex-poke
        :*  /prompts/sync/(scot %p ~bus)
            [~bus %steward]
            %steward-prompts-action-1
            !>(`action:v1:p`[%sync expect])
        ==
    ==
  ;<  res=cage  bind:m  (got-peek /x/v1/prompts)
  =+  !<(=update:v1:p q.res)
  (ex-equal !>(update) !>(`update:v1:p`[%prompts ~dev expect]))
::
::  gateways re-seed on every boot: an identical %seed skips the local
::  fact but still re-fans to the owner (a previous fan may have been
::  nacked while the owner's agent was restarting)
::
++  test-pr-seed-noop-still-refans-owner
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  =/  seed=(map @t @t)  (my ~[['SOUL.md' 'be kind']])
  ;<  *  bind:m
    (do-poke %steward-prompts-action-1 !>(`action:v1:p`[%seed seed]))
  ;<  caz=(list card)  bind:m
    (do-poke %steward-prompts-action-1 !>(`action:v1:p`[%seed seed]))
  %+  ex-cards  caz
  :~  %-  ex-poke
      :*  /prompts/sync/(scot %p ~bus)
          [~bus %steward]
          %steward-prompts-action-1
          !>(`action:v1:p`[%sync (my ~[['SOUL.md' 'be kind' ~2024.1.1 %.n]])])
      ==
  ==
::
::  a re-seed keeps the stored timestamp for entries whose text is unchanged
::
++  test-pr-seed-preserves-unchanged-timestamps
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m
    %+  do-poke  %steward-prompts-action-1
    !>(`action:v1:p`[%seed (my ~[['SOUL.md' 'be kind']])])
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now ~2024.1.2)))
  ;<  *  bind:m
    %+  do-poke  %steward-prompts-action-1
    !>(`action:v1:p`[%seed (my ~[['SOUL.md' 'be kind'] ['USER.md' 'james']])])
  ;<  res=cage  bind:m  (got-peek /x/v1/prompts)
  =+  !<(=update:v1:p q.res)
  =/  expect=prompts:v1:p
    %-  my
    :~  ['SOUL.md' 'be kind' ~2024.1.1 %.n]
        ['USER.md' 'james' ~2024.1.2 %.n]
    ==
  (ex-equal !>(update) !>(`update:v1:p`[%prompts ~dev expect]))
::
::  %seed is local-only (the gateway pokes as the bot ship itself)
::
++  test-pr-seed-from-foreign-ship-crashes
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  %-  ex-fail
  %-  (do-as ~zod)
  %+  do-poke  %steward-prompts-action-1
  !>(`action:v1:p`[%seed (my ~[['SOUL.md' 'evil']])])
::
::  a local %set targeting ourselves stores the edit, notifies the local
::  gateway on /v1/prompts, and refreshes the owner's mirror
::
++  test-pr-set-stores-and-notifies-gateway
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ::  a seed activates prompt sync; %set is rejected on an empty set
  ;<  *  bind:m
    %+  do-poke  %steward-prompts-action-1
    !>(`action:v1:p`[%seed (my ~[['SOUL.md' 'seeded']])])
  =/  expect=prompts:v1:p  (my ~[['SOUL.md' 'be kind' ~2024.1.1 %.y]])
  ;<  caz=(list card)  bind:m
    %+  do-poke  %steward-prompts-action-1
    !>(`action:v1:p`[%set ~dev 'SOUL.md' 'be kind'])
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  %-  ex-fact
        :*  ~[/v1/prompts]
            %steward-prompts-update-1
            !>(`update:v1:p`[%set 'SOUL.md' ['be kind' ~2024.1.1 %.y]])
        ==
        %-  ex-poke
        :*  /prompts/sync/(scot %p ~bus)
            [~bus %steward]
            %steward-prompts-action-1
            !>(`action:v1:p`[%sync expect])
        ==
    ==
  ;<  res=cage  bind:m  (got-peek /x/v1/prompts)
  =+  !<(=update:v1:p q.res)
  (ex-equal !>(update) !>(`update:v1:p`[%prompts ~dev expect]))
::
::  a local %set targeting a remote bot relays to that bot's steward and
::  leaves our own canonical set untouched
::
++  test-pr-set-relays-to-remote-bot
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m
    %+  do-poke  %steward-prompts-action-1
    !>(`action:v1:p`[%set moon 'SOUL.md' 'be kind'])
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  %-  ex-poke
        :*  /prompts/set/(scot %p moon)/(scot %t 'SOUL.md')
            [moon %steward]
            %steward-prompts-action-1
            !>(`action:v1:p`[%set moon 'SOUL.md' 'be kind'])
        ==
    ==
  ;<  res=cage  bind:m  (got-peek /x/v1/prompts)
  =+  !<(=update:v1:p q.res)
  (ex-equal !>(update) !>(`update:v1:p`[%prompts ~dev *prompts:v1:p]))
::
::  the configured owner may set prompts on its bot cross-ship
::
++  test-pr-set-from-owner-accepted
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  *  bind:m
    %+  do-poke  %steward-prompts-action-1
    !>(`action:v1:p`[%seed (my ~[['SOUL.md' 'seeded']])])
  ;<  *  bind:m
    %-  (do-as ~bus)
    %+  do-poke  %steward-prompts-action-1
    !>(`action:v1:p`[%set ~dev 'SOUL.md' 'from owner'])
  ;<  res=cage  bind:m  (got-peek /x/v1/prompts)
  =+  !<(=update:v1:p q.res)
  =/  expect=prompts:v1:p  (my ~[['SOUL.md' 'from owner' ~2024.1.1 %.y]])
  (ex-equal !>(update) !>(`update:v1:p`[%prompts ~dev expect]))
::
::  a non-owner ship must not be able to edit prompts
::
++  test-pr-set-from-foreign-ship-crashes
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  %-  ex-fail
  %-  (do-as ~zod)
  %+  do-poke  %steward-prompts-action-1
  !>(`action:v1:p`[%set ~dev 'SOUL.md' 'evil'])
::
::  a cross-ship %set must target us — we never proxy a non-local edit on
::  to a third ship
::
++  test-pr-set-relay-from-owner-to-third-ship-crashes
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  %-  ex-fail
  %-  (do-as ~bus)
  %+  do-poke  %steward-prompts-action-1
  !>(`action:v1:p`[%set moon 'SOUL.md' 'proxy attempt'])
::
::  a nacked %set relay re-facts the bot's current mirror so the editing
::  client's optimistic state reverts to what the bot actually holds
::
++  test-pr-set-relay-nack-refacts-mirror
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  =/  cur=prompts:v1:p  (my ~[['SOUL.md' 'be kind' ~2023.12.31 %.n]])
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-prompts-action-1 !>(`action:v1:p`[%sync cur]))
  ;<  *  bind:m
    %+  do-poke  %steward-prompts-action-1
    !>(`action:v1:p`[%set moon 'SOUL.md' 'new text'])
  ;<  caz=(list card)  bind:m
    %-  do-agent
    :*  /prompts/set/(scot %p moon)/(scot %t 'SOUL.md')
        [moon %steward]
        [%poke-ack `~[[%leaf "boom"]]]
    ==
  %+  ex-cards  caz
  :~  %-  ex-fact
      :*  ~[/v1/prompts]
          %steward-prompts-update-1
          !>(`update:v1:p`[%prompts moon cur])
      ==
  ==
::
::  a trusted bot's %sync is stored in the mirror keyed by src
::
++  test-pr-sync-from-trusted-bot-stores-mirror
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  =/  synced=prompts:v1:p  (my ~[['SOUL.md' 'be kind' ~2023.12.31 %.y]])
  ;<  caz=(list card)  bind:m
    %-  (do-as moon)
    (do-poke %steward-prompts-action-1 !>(`action:v1:p`[%sync synced]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  %-  ex-fact
        :*  ~[/v1/prompts]
            %steward-prompts-update-1
            !>(`update:v1:p`[%prompts moon synced])
        ==
    ==
  ;<  res=cage  bind:m  (got-peek /x/v1/prompts/(scot %p moon))
  =+  !<(=update:v1:p q.res)
  (ex-equal !>(update) !>(`update:v1:p`[%prompts moon synced]))
::
::  an untrusted ship's %sync is rejected — trust is explicit, like lens
::  %entry fan-in
::
++  test-pr-sync-from-untrusted-crashes
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  %-  ex-fail
  %-  (do-as moon)
  %+  do-poke  %steward-prompts-action-1
  !>(`action:v1:p`[%sync (my ~[['SOUL.md' 'sneaky' ~2024.1.1 %.y]])])
::
::  a self-owned bot stores its owner mirror directly, no network hop
::
++  test-pr-self-owned-set-stores-mirror-directly
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~dev)
  ;<  *  bind:m
    %+  do-poke  %steward-prompts-action-1
    !>(`action:v1:p`[%seed (my ~[['SOUL.md' 'seeded']])])
  =/  expect=prompts:v1:p  (my ~[['SOUL.md' 'be kind' ~2024.1.1 %.y]])
  ;<  caz=(list card)  bind:m
    %+  do-poke  %steward-prompts-action-1
    !>(`action:v1:p`[%set ~dev 'SOUL.md' 'be kind'])
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  %-  ex-fact
        :*  ~[/v1/prompts]
            %steward-prompts-update-1
            !>(`update:v1:p`[%set 'SOUL.md' ['be kind' ~2024.1.1 %.y]])
        ==
        %-  ex-fact
        :*  ~[/v1/prompts]
            %steward-prompts-update-1
            !>(`update:v1:p`[%prompts ~dev expect])
        ==
    ==
  ;<  res=cage  bind:m  (got-peek /x/v1/prompts/(scot %p ~dev))
  =+  !<(=update:v1:p q.res)
  (ex-equal !>(update) !>(`update:v1:p`[%prompts ~dev expect]))
::
::  an oversized prompt nacks at the first hop so the editing client sees
::  the failure instead of a silent drop reading as success
::
++  test-pr-oversized-set-crashes
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  =/  big=@t  (fil 3 65.537 'a')
  %-  ex-fail
  %+  do-poke  %steward-prompts-action-1
  !>(`action:v1:p`[%set ~dev 'SOUL.md' big])
::
::  a re-seed with changed text updates an un-edited entry (upstream
::  prompt-set updates flow through)
::
++  test-pr-seed-updates-unedited-entry
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m
    %+  do-poke  %steward-prompts-action-1
    !>(`action:v1:p`[%seed (my ~[['SOUL.md' 'v1']])])
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now ~2024.1.2)))
  ;<  *  bind:m
    %+  do-poke  %steward-prompts-action-1
    !>(`action:v1:p`[%seed (my ~[['SOUL.md' 'v2 from upstream']])])
  ;<  res=cage  bind:m  (got-peek /x/v1/prompts)
  =+  !<(=update:v1:p q.res)
  %+  ex-equal  !>(update)
  !>(`update:v1:p`[%prompts ~dev (my ~[['SOUL.md' 'v2 from upstream' ~2024.1.2 %.n]])])
::
::  a seed with different text never overwrites a pinned owner edit (the
::  gateway simply hasn't applied it yet)
::
++  test-pr-seed-preserves-pinned-edit
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m
    %+  do-poke  %steward-prompts-action-1
    !>(`action:v1:p`[%seed (my ~[['SOUL.md' 'v1']])])
  ;<  *  bind:m
    %+  do-poke  %steward-prompts-action-1
    !>(`action:v1:p`[%set ~dev 'SOUL.md' 'owner edit'])
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now ~2024.1.2)))
  ;<  *  bind:m
    %+  do-poke  %steward-prompts-action-1
    !>(`action:v1:p`[%seed (my ~[['SOUL.md' 'stale file text'] ['TOOLS.md' 'tools']])])
  ;<  res=cage  bind:m  (got-peek /x/v1/prompts)
  =+  !<(=update:v1:p q.res)
  %+  ex-equal  !>(update)
  !>
  ^-  update:v1:p
  :+  %prompts  ~dev
  %-  my
  :~  ['SOUL.md' 'owner edit' ~2024.1.1 %.y]
      ['TOOLS.md' 'tools' ~2024.1.2 %.n]
  ==
::
::  a pinned edit missing from the seed entirely is kept, not dropped
::
++  test-pr-seed-keeps-missing-pinned-edit
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m
    %+  do-poke  %steward-prompts-action-1
    !>(`action:v1:p`[%seed (my ~[['SOUL.md' 'v1']])])
  ;<  *  bind:m
    %+  do-poke  %steward-prompts-action-1
    !>(`action:v1:p`[%set ~dev 'SOUL.md' 'owner edit'])
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now ~2024.1.2)))
  ;<  *  bind:m
    %+  do-poke  %steward-prompts-action-1
    !>(`action:v1:p`[%seed (my ~[['TOOLS.md' 'tools']])])
  ;<  res=cage  bind:m  (got-peek /x/v1/prompts)
  =+  !<(=update:v1:p q.res)
  %+  ex-equal  !>(update)
  !>
  ^-  update:v1:p
  :+  %prompts  ~dev
  %-  my
  :~  ['SOUL.md' 'owner edit' ~2024.1.1 %.y]
      ['TOOLS.md' 'tools' ~2024.1.2 %.n]
  ==
::
::  trusting a bot asks it to re-fan its prompts: a %sync sent before trust
::  was granted has already been nacked and won't retry on its own
::
++  test-pr-trust-bot-requests-resync
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%trust-bot moon]))
  %+  ex-cards  caz
  :~  %-  ex-poke
      :*  /prompts/request/(scot %p moon)
          [moon %steward]
          %steward-prompts-action-1
          !>(`action:v1:p`[%request ~])
      ==
  ==
::
::  a %request from the configured owner re-fans the canonical set
::
++  test-pr-request-from-owner-resyncs
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  *  bind:m
    %+  do-poke  %steward-prompts-action-1
    !>(`action:v1:p`[%seed (my ~[['SOUL.md' 'be kind']])])
  ;<  caz=(list card)  bind:m
    %-  (do-as ~bus)
    (do-poke %steward-prompts-action-1 !>(`action:v1:p`[%request ~]))
  %+  ex-cards  caz
  :~  %-  ex-poke
      :*  /prompts/sync/(scot %p ~bus)
          [~bus %steward]
          %steward-prompts-action-1
          !>(`action:v1:p`[%sync (my ~[['SOUL.md' 'be kind' ~2024.1.1 %.n]])])
      ==
  ==
::
::  a %request from a ship that is not the configured owner is rejected
::
++  test-pr-request-from-non-owner-crashes
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  %-  ex-fail
  %-  (do-as ~zod)
  (do-poke %steward-prompts-action-1 !>(`action:v1:p`[%request ~]))
::
::  revoking trust drops the bot's prompt mirror (the client's ownership
::  signal) and facts the now-empty set
::
++  test-pr-untrust-bot-drops-mirror
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  =/  synced=prompts:v1:p  (my ~[['SOUL.md' 'be kind' ~2023.12.31 %.y]])
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-prompts-action-1 !>(`action:v1:p`[%sync synced]))
  ;<  caz=(list card)  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%untrust-bot moon]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  %-  ex-fact
        :*  ~[/v1/prompts]
            %steward-prompts-update-1
            !>(`update:v1:p`[%prompts moon *prompts:v1:p])
        ==
    ==
  ;<  res=(unit (unit cage))  bind:m  (get-peek /x/v1/prompts/(scot %p moon))
  (ex-equal !>(=(res `(unit (unit cage))`[~ ~])) !>(&))
::
::  changing the configured owner revokes the previous owner's mirror and
::  re-fans the set to the new one
::
++  test-pr-owner-change-revokes-previous
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  *  bind:m
    %+  do-poke  %steward-prompts-action-1
    !>(`action:v1:p`[%seed (my ~[['SOUL.md' 'be kind']])])
  ;<  caz=(list card)  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%configure ~fed]))
  %+  ex-cards  caz
  ::  the revoke rides the sync wire so it shares the sync ames flow and
  ::  can't be overtaken by an in-flight pre-transition %sync
  :~  %-  ex-poke
      :*  /prompts/sync/(scot %p ~bus)
          [~bus %steward]
          %steward-prompts-action-1
          !>(`action:v1:p`[%revoke ~])
      ==
      %-  ex-poke
      :*  /prompts/sync/(scot %p ~fed)
          [~fed %steward]
          %steward-prompts-action-1
          !>(`action:v1:p`[%sync (my ~[['SOUL.md' 'be kind' ~2024.1.1 %.n]])])
      ==
  ==
::
::  re-configuring the same owner is a no-op (gateways re-configure on
::  every reconnect)
::
++  test-pr-reconfigure-same-owner-noop
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  *  bind:m
    %+  do-poke  %steward-prompts-action-1
    !>(`action:v1:p`[%seed (my ~[['SOUL.md' 'be kind']])])
  ;<  caz=(list card)  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%configure ~bus]))
  (ex-cards caz ~)
::
::  %unconfigure clears the owner and revokes the former owner's mirror
::  (on the shared sync wire); the cleared owner may no longer edit
::
++  test-pr-unconfigure-revokes-owner
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  *  bind:m
    %+  do-poke  %steward-prompts-action-1
    !>(`action:v1:p`[%seed (my ~[['SOUL.md' 'be kind']])])
  ;<  caz=(list card)  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%unconfigure ~]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  %-  ex-poke
        :*  /prompts/sync/(scot %p ~bus)
            [~bus %steward]
            %steward-prompts-action-1
            !>(`action:v1:p`[%revoke ~])
        ==
    ==
  %-  ex-fail
  %-  (do-as ~bus)
  %+  do-poke  %steward-prompts-action-1
  !>(`action:v1:p`[%set ~dev 'SOUL.md' 'stale owner edit'])
::
::  %unconfigure with no owner set is a no-op
::
++  test-pr-unconfigure-when-unset-noop
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%unconfigure ~]))
  (ex-cards caz ~)
::
::  a %revoke from a ship with a mirror entry drops that entry
::
++  test-pr-revoke-drops-callers-mirror
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  ;<  *  bind:m
    %-  (do-as moon)
    %+  do-poke  %steward-prompts-action-1
    !>(`action:v1:p`[%sync (my ~[['SOUL.md' 'be kind' ~2023.12.31 %.n]])])
  ;<  caz=(list card)  bind:m
    %-  (do-as moon)
    (do-poke %steward-prompts-action-1 !>(`action:v1:p`[%revoke ~]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  %-  ex-fact
        :*  ~[/v1/prompts]
            %steward-prompts-update-1
            !>(`update:v1:p`[%prompts moon *prompts:v1:p])
        ==
    ==
  ;<  res=(unit (unit cage))  bind:m  (get-peek /x/v1/prompts/(scot %p moon))
  (ex-equal !>(=(res `(unit (unit cage))`[~ ~])) !>(&))
::
::  a %revoke from a ship without a mirror entry acks as a no-op (boot-time
::  revoke retries must converge, not nack-loop); it still only ever drops
::  the sender's own entry
::
++  test-pr-revoke-without-mirror-noop
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m
    %-  (do-as moon)
    (do-poke %steward-prompts-action-1 !>(`action:v1:p`[%revoke ~]))
  (ex-cards caz ~)
::
::  a nacked %request is retried on a behn timer, an ack stops the retries,
::  and the budget is bounded so a ship that never accepts is dropped
::
++  test-pr-request-retry-until-acked
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  req-wire  /prompts/request/(scot %p moon)
  =/  nack
    (do-agent [req-wire [moon %steward] [%poke-ack `~[[%leaf "boom"]]]])
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  ::  first nack schedules a retry
  ;<  caz=(list card)  bind:m  nack
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  %+  ex-arvo  /prompts/request-retry
        [%b %wait (add ~2024.1.1 ~m5)]
    ==
  ::  the wake re-issues the request
  ;<  caz=(list card)  bind:m
    (do-arvo /prompts/request-retry [%behn %wake ~])
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  %-  ex-poke
        :*  req-wire
            [moon %steward]
            %steward-prompts-action-1
            !>(`action:v1:p`[%request ~])
        ==
    ==
  ::  an ack clears the pending entry: the next wake emits nothing
  ;<  *  bind:m  (do-agent [req-wire [moon %steward] [%poke-ack ~]])
  ;<  caz=(list card)  bind:m
    (do-arvo /prompts/request-retry [%behn %wake ~])
  (ex-cards caz ~)
::
::  the retry budget is bounded — after max-request-tries nacks the bot is
::  dropped and no further timer is armed
::
++  test-pr-request-retry-budget-exhausts
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  req-wire  /prompts/request/(scot %p moon)
  =/  nack
    (do-agent [req-wire [moon %steward] [%poke-ack `~[[%leaf "boom"]]]])
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  ;<  *  bind:m  nack
  ;<  *  bind:m  nack
  ;<  *  bind:m  nack
  ;<  *  bind:m  nack
  ::  fifth nack spends the budget: no retry armed
  ;<  caz=(list card)  bind:m  nack
  ;<  ~  bind:m  (ex-cards caz ~)
  ::  and nothing is left pending for a stray wake to re-issue
  ;<  caz=(list card)  bind:m
    (do-arvo /prompts/request-retry [%behn %wake ~])
  (ex-cards caz ~)
::
::  untrusting a bot stops its pending request retries
::
++  test-pr-untrust-clears-pending-request
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  req-wire  /prompts/request/(scot %p moon)
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  ;<  *  bind:m
    (do-agent [req-wire [moon %steward] [%poke-ack `~[[%leaf "boom"]]]])
  ;<  *  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%untrust-bot moon]))
  ;<  caz=(list card)  bind:m
    (do-arvo /prompts/request-retry [%behn %wake ~])
  (ex-cards caz ~)
::
::  a nacked owner-change revoke is retried on the next boot-shaped moment
::  (on the dedicated revoke wire), and a confirming ack stops the retries
::
++  test-pr-revoke-retry-until-acked
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  *  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%unconfigure ~]))
  ::  the initial revoke is unconfirmed: a second unconfigure re-issues it
  ;<  caz=(list card)  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%unconfigure ~]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  %-  ex-poke
        :*  /prompts/revoke/(scot %p ~bus)
            [~bus %steward]
            %steward-prompts-action-1
            !>(`action:v1:p`[%revoke ~])
        ==
    ==
  ::  the retry acks: the former owner dropped its mirror — stop retrying
  ;<  *  bind:m
    (do-agent [/prompts/revoke/(scot %p ~bus) [~bus %steward] [%poke-ack ~]])
  ;<  caz=(list card)  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%unconfigure ~]))
  (ex-cards caz ~)
::
::  a repeated %clear still re-fans the empty set (a previous empty fan may
::  have been nacked while the owner's agent restarted)
::
++  test-pr-clear-repeat-refans-empty
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  *  bind:m
    %+  do-poke  %steward-prompts-action-1
    !>(`action:v1:p`[%seed (my ~[['SOUL.md' 'be kind']])])
  ;<  *  bind:m
    (do-poke %steward-prompts-action-1 !>(`action:v1:p`[%clear ~]))
  ;<  caz=(list card)  bind:m
    (do-poke %steward-prompts-action-1 !>(`action:v1:p`[%clear ~]))
  %+  ex-cards  caz
  :~  %-  ex-poke
      :*  /prompts/sync/(scot %p ~bus)
          [~bus %steward]
          %steward-prompts-action-1
          !>(`action:v1:p`[%sync *prompts:v1:p])
      ==
  ==
::
::  %clear (gateway lost prompt-syncing authority) wipes the canonical set
::  and fans the empty set to the owner so its mirror stops offering edits
::
++  test-pr-clear-wipes-own-and-fans-empty
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  *  bind:m
    %+  do-poke  %steward-prompts-action-1
    !>(`action:v1:p`[%seed (my ~[['SOUL.md' 'be kind']])])
  ;<  caz=(list card)  bind:m
    (do-poke %steward-prompts-action-1 !>(`action:v1:p`[%clear ~]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  %-  ex-fact
        :*  ~[/v1/prompts]
            %steward-prompts-update-1
            !>(`update:v1:p`[%prompts ~dev *prompts:v1:p])
        ==
        %-  ex-poke
        :*  /prompts/sync/(scot %p ~bus)
            [~bus %steward]
            %steward-prompts-action-1
            !>(`action:v1:p`[%sync *prompts:v1:p])
        ==
    ==
  ;<  res=cage  bind:m  (got-peek /x/v1/prompts)
  =+  !<(=update:v1:p q.res)
  (ex-equal !>(update) !>(`update:v1:p`[%prompts ~dev *prompts:v1:p]))
::
::  a %set that would push the whole canonical map past the sync payload
::  cap is nacked — an oversized set could never fan to the owner again
::
++  test-pr-set-map-cap-nacks-overflow
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ::  each text must be distinct: jam deduplicates identical subtrees, so
  ::  repeating one 64KB atom would never grow the jammed map past the cap
  =/  set-big
    |=  n=@t
    %+  do-poke  %steward-prompts-action-1
    !>(`action:v1:p`[%set ~dev n (cat 3 (fil 3 65.000 'a') n)])
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  *  bind:m
    %+  do-poke  %steward-prompts-action-1
    !>(`action:v1:p`[%seed (my ~[['S.md' 'x']])])
  ;<  *  bind:m  (set-big 'P1.md')
  ;<  *  bind:m  (set-big 'P2.md')
  ;<  *  bind:m  (set-big 'P3.md')
  ;<  *  bind:m  (set-big 'P4.md')
  ;<  *  bind:m  (set-big 'P5.md')
  ;<  *  bind:m  (set-big 'P6.md')
  ;<  *  bind:m  (set-big 'P7.md')
  ;<  *  bind:m  (set-big 'P8.md')
  (ex-fail (set-big 'P9.md'))
::
::  after a %clear, a late owner %set (racing on its own ames flow) is
::  rejected instead of recreating the mirror with text nothing applies
::
++  test-pr-set-after-clear-crashes
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  *  bind:m
    %+  do-poke  %steward-prompts-action-1
    !>(`action:v1:p`[%seed (my ~[['SOUL.md' 'be kind']])])
  ;<  *  bind:m
    (do-poke %steward-prompts-action-1 !>(`action:v1:p`[%clear ~]))
  %-  ex-fail
  %-  (do-as ~bus)
  %+  do-poke  %steward-prompts-action-1
  !>(`action:v1:p`[%set ~dev 'SOUL.md' 'late edit'])
::
::  %clear is local-only and a no-op when nothing is stored
::
++  test-pr-clear-auth-and-noop
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m
    (do-poke %steward-prompts-action-1 !>(`action:v1:p`[%clear ~]))
  ;<  ~  bind:m  (ex-cards caz ~)
  %-  ex-fail
  %-  (do-as moon)
  (do-poke %steward-prompts-action-1 !>(`action:v1:p`[%clear ~]))
::
::  configuring a (new) owner re-fans the canonical set so the new owner's
::  mirror doesn't stay empty until some prompt text changes
::
++  test-pr-configure-owner-resyncs
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m
    %+  do-poke  %steward-prompts-action-1
    !>(`action:v1:p`[%seed (my ~[['SOUL.md' 'be kind']])])
  ;<  caz=(list card)  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%configure ~bus]))
  %+  ex-cards  caz
  :~  %-  ex-poke
      :*  /prompts/sync/(scot %p ~bus)
          [~bus %steward]
          %steward-prompts-action-1
          !>(`action:v1:p`[%sync (my ~[['SOUL.md' 'be kind' ~2024.1.1 %.n]])])
      ==
  ==
--
