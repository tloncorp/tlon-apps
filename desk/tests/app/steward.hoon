::  tests for %steward agent (lens module + gateway module)
::
/-  s=steward, a=activity, av=activity-ver
/-  l=steward-lens
/-  g=steward-gateway
/+  *test-agent
/=  agent  /app/steward
|%
++  dap  %steward
::  agent state — single version (greenfield, no migration). `bots` is the
::  owner-side trusted set.
::
+$  state-0
  $:  %0
      owner=(unit ship)
      bots=(set ship)
      lens=state:v1:l
      gateway=state:v1:g
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
  =/  =source:a  [%dm %ship sender]
  =/  =event:a  [[%dm-post message-key [%ship sender] ~[[%inline ~['hello']]] %.n] %.n %.n]
  =/  =update:a  [%add source t event]
  [/activity [~dev %activity] [%fact %activity-update-5 !>(`update:v9:av`update)]]
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
  =/  st  !<(state-0 !<(vase q.res))
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
  =/  st  !<(state-0 !<(vase q.res))
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
  =/  st  !<(state-0 !<(vase q.res))
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
  =/  st  !<(state-0 !<(vase q.res))
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
  =/  st  !<(state-0 !<(vase q.res))
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
  =/  st  !<(state-0 !<(vase q.res))
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
  =/  st  !<(state-0 !<(vase q.res))
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
  =/  st  !<(state-0 !<(vase q.res))
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
  =/  st  !<(state-0 !<(vase q.res))
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
  =/  st  !<(state-0 !<(vase q.res))
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
  =/  st  !<(state-0 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(pending-restart.gateway.st) !>(&))
  =/  lease-time-2  (add ~2024.1.1 ~m4)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-2' lease-time-2]))
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-0 !<(vase q.res))
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
--
