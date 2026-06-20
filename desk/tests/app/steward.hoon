::  tests for %steward agent (lens module + gateway module)
::
/-  s=steward, a=activity, av=activity-ver
/+  *test-agent
/=  agent  /app/steward
|%
++  dap  %steward
+$  state-1
  $:  %1
      owner=(unit ship)
      lens=state:lens:s
      gateway=state:gateway:s
  ==
::  state-0 is the legacy shape; the agent migrates it forward on-load.
::  kept here only for the migration test.
::
+$  state-0
  $:  %0
      owner=(unit ship)
      lens=state-0:lens:s
      gateway=state:gateway:s
  ==
++  payload  ^-  @t  '{"schemaVersion":1,"summary":"run-record"}'
::
::  our ship in tests is ~dev (a galaxy; set via +setup below).  a moon's
::  sponsor is its low 32 bits, so any ship >= 2^32 whose low 32 bits equal
::  ~dev is a moon ~dev sponsors.  (add ~dev (bex 32)) is the simplest such
::  moon and passes the ownership gate ((end 5 moon) == ~dev).
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
++  ga-configure
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%gateway %configure ~m5 ~m5]))
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
  =/  st  !<(state-1 !<(vase q.res))
  (ex-equal !>(owner.st) !>(`(unit ship)``~bus))
::
::  a completely foreign ship (not ourselves, not our moon) must crash
::  the ownership gate on %steward-action-1
::
++  test-action-from-foreign-ship-crashes
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  %-  ex-fail
  %-  (do-as ~zod)
  (do-poke %steward-action-1 !>(`action:v1:s`[%configure ~zod]))
::
::  a moon we sponsor must be accepted by the ownership gate
::
::  we use ~sampel-dev as the moon (sein of ~sampel-dev is ~dev).
::  the moon pokes [%lens id payload final] — it should be stored keyed
::  by src.bowl (the moon itself).
::
++  test-action-from-sponsored-moon-accepted
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m
    %-  (do-as moon)
    (do-poke %steward-action-1 !>(`action:v1:s`[%lens %entry 'lens-moon' payload &]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  %-  ex-fact
        :*  ~[/v1/lens]
            %steward-update-1
            !>(`update:v1:s`[%lens %entry moon 'lens-moon' [& ~2024.1.1 payload]])
        ==
    ==
  ;<  res=cage  bind:m  (got-peek /x/v1/lens/run/(scot %p moon)/lens-moon)
  =+  !<(=update:v1:s q.res)
  (ex-equal !>(update) !>(`update:v1:s`[%lens %entry moon 'lens-moon' [& ~2024.1.1 payload]]))
::
::  fan-out to a non-self owner emits a %steward-action-1 poke on /lens/fanout/...
::
++  test-run-final-fans-out-to-owner
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  caz=(list card)  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%lens %entry 'lens-1' payload &]))
  %+  ex-cards  caz
  :~  %-  ex-poke
      :*  /lens/fanout/(scot %p ~bus)/(scot %t 'lens-1')
          [~bus %steward]
          %steward-action-1
          !>(`action:v1:s`[%lens %entry 'lens-1' payload &])
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
    (do-poke %steward-action-1 !>(`action:v1:s`[%lens %entry 'lens-1' payload &]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  %-  ex-fact
        :*  ~[/v1/lens]
            %steward-update-1
            !>(`update:v1:s`[%lens %entry ~dev 'lens-1' [& ~2024.1.1 payload]])
        ==
    ==
  ;<  res=cage  bind:m  (got-peek /x/v1/lens/run/(scot %p ~dev)/lens-1)
  =+  !<(=update:v1:s q.res)
  (ex-equal !>(update) !>(`update:v1:s`[%lens %entry ~dev 'lens-1' [& ~2024.1.1 payload]]))
::
::  a poke from a sponsored moon is stored keyed by src.bowl (the moon)
::
++  test-action-stores-keyed-by-source
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m
    %-  (do-as moon)
    (do-poke %steward-action-1 !>(`action:v1:s`[%lens %entry 'lens-2' payload |]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  %-  ex-fact
        :*  ~[/v1/lens]
            %steward-update-1
            !>(`update:v1:s`[%lens %entry moon 'lens-2' [| ~2024.1.1 payload]])
        ==
    ==
  ;<  res=cage  bind:m  (got-peek /x/v1/lens/run/(scot %p moon)/lens-2)
  =+  !<(=update:v1:s q.res)
  (ex-equal !>(update) !>(`update:v1:s`[%lens %entry moon 'lens-2' [| ~2024.1.1 payload]]))
::
::  final=& marks the run complete
::
++  test-final-marks-run-complete
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-action-1 !>(`action:v1:s`[%lens %entry 'lens-3' payload |]))
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-action-1 !>(`action:v1:s`[%lens %entry 'lens-3' payload &]))
  ;<  res=cage  bind:m  (got-peek /x/v1/lens/run/(scot %p moon)/lens-3)
  =+  !<(=update:v1:s q.res)
  ?>  ?=(%lens -.update)
  ?>  ?=(%entry -.update.update)
  (ex-equal !>(complete.run.entry.update.update) !>(&))
::
::  a late partial (final=|) arriving after a final (final=&) is dropped
::
++  test-late-event-after-final-is-dropped
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-action-1 !>(`action:v1:s`[%lens %entry 'lens-4' payload &]))
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now ~2024.1.2)))
  ;<  caz=(list card)  bind:m
    %-  (do-as moon)
    (do-poke %steward-action-1 !>(`action:v1:s`[%lens %entry 'lens-4' '{"partial":true}' |]))
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  res=cage  bind:m  (got-peek /x/v1/lens/run/(scot %p moon)/lens-4)
  =+  !<(=update:v1:s q.res)
  ?>  ?=(%lens -.update)
  ?>  ?=(%entry -.update.update)
  (ex-equal !>(run.entry.update.update) !>(`run:lens:s`[& ~2024.1.1 payload]))
::
::  on-init seeds the lens config (default max-runs-per-bot) and subscribes
::  to %activity. there is no prune timer — pruning is count-based and runs
::  on every insert and every %configure.
::
++  test-init-seeds-config-and-activity
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
  (ex-equal !>(max-runs-per-bot.lens.st) !>(`@ud`10.000))
::
::  on-load migrates a legacy state-0 (lens as bare map, no cap) into
::  state-1 with the default cap, preserving the stored runs.
::
++  test-state-0-migrates-to-state-1
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  =/  legacy-run=run:lens:s  [& ~2024.1.1 payload]
  =/  legacy-lens=state-0:lens:s
    (malt ~[[[moon 'old-id'] legacy-run]])
  =/  ole=state-0  [%0 `~bus legacy-lens *state:gateway:s]
  ;<  *  bind:m  (do-load agent `!>(ole))
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(owner.st) !>(`(unit ship)``~bus))
  ;<  ~  bind:m  (ex-equal !>(max-runs-per-bot.lens.st) !>(`@ud`10.000))
  ;<  ~  bind:m  (ex-equal !>(~(wyt by runs.lens.st)) !>(1))
  ?~  got=(~(get by runs.lens.st) [moon 'old-id'])
    |+~['expected migrated run to be present']
  (ex-equal !>(u.got) !>(legacy-run))
::
::  count-based prune: the oldest entries beyond max-runs-per-bot get
::  dropped on the next insert. configure the cap to 2, store 3 runs from
::  the same bot in time order, and assert the oldest is gone.
::
++  test-count-cap-prunes-oldest-on-insert
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%lens %configure 2]))
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-action-1 !>(`action:v1:s`[%lens %entry 'r1' payload &]))
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now ~2024.1.2)))
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-action-1 !>(`action:v1:s`[%lens %entry 'r2' payload &]))
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now ~2024.1.3)))
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-action-1 !>(`action:v1:s`[%lens %entry 'r3' payload &]))
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(~(wyt by runs.lens.st)) !>(2))
  ;<  ~  bind:m
    (ex-equal !>((~(has by runs.lens.st) [moon 'r1'])) !>(|))
  ;<  ~  bind:m
    (ex-equal !>((~(has by runs.lens.st) [moon 'r2'])) !>(&))
  (ex-equal !>((~(has by runs.lens.st) [moon 'r3'])) !>(&))
::
::  %configure lowers the cap and the new cap takes effect immediately
::  across every bot — not lazily on the next per-bot insert.
::
++  test-configure-applies-cap-across-all-bots
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-action-1 !>(`action:v1:s`[%lens %entry 'a1' payload &]))
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now ~2024.1.2)))
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-action-1 !>(`action:v1:s`[%lens %entry 'a2' payload &]))
  ;<  *  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%lens %configure 1]))
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(~(wyt by runs.lens.st)) !>(1))
  ::  the newer entry survives, the older was dropped.
  ::
  (ex-equal !>((~(has by runs.lens.st) [moon 'a2'])) !>(&))
::
::  /x/v1/lens/recent (no arg) defaults to 50; /x/v1/lens/recent/<n>
::  caps the returned list to <n> newest. /x/v1/lens/since/<da> returns
::  every entry with received >= cutoff.
::
++  test-recent-windowed-with-count
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-action-1 !>(`action:v1:s`[%lens %entry 'w1' payload &]))
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now ~2024.1.2)))
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-action-1 !>(`action:v1:s`[%lens %entry 'w2' payload &]))
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now ~2024.1.3)))
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-action-1 !>(`action:v1:s`[%lens %entry 'w3' payload &]))
  ;<  res=cage  bind:m  (got-peek /x/v1/lens/recent/2)
  =+  !<(=update:v1:s q.res)
  ?>  ?=(%lens -.update)
  ?>  ?=(%recent -.update.update)
  ;<  ~  bind:m  (ex-equal !>((lent entries.update.update)) !>(2))
  ?>  ?=(^ entries.update.update)
  (ex-equal !>(id.i.entries.update.update) !>('w3'))
::
++  test-since-returns-entries-from-cutoff
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-action-1 !>(`action:v1:s`[%lens %entry 's1' payload &]))
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now ~2024.1.5)))
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-action-1 !>(`action:v1:s`[%lens %entry 's2' payload &]))
  ;<  res=cage  bind:m  (got-peek /x/v1/lens/since/(scot %da ~2024.1.3))
  =+  !<(=update:v1:s q.res)
  ?>  ?=(%lens -.update)
  ?>  ?=(%recent -.update.update)
  ;<  ~  bind:m  (ex-equal !>((lent entries.update.update)) !>(1))
  ?>  ?=(^ entries.update.update)
  (ex-equal !>(id.i.entries.update.update) !>('s2'))
::
::  cap=0 means "store nothing"; the new entry is inserted then pruned
::  immediately. permitted as a config value (an admin tool to disable
::  storage without ripping out the agent).
::
++  test-configure-cap-zero-drops-everything
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%lens %configure 0]))
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-action-1 !>(`action:v1:s`[%lens %entry 'z1' payload &]))
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  (ex-equal !>(~(wyt by runs.lens.st)) !>(0))
::
::  malformed scry args return [~ ~] (not found) rather than crashing
::  the agent. covers all paths that take a parsed atom.
::
++  test-malformed-scry-args-return-not-found
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  recent=(unit (unit cage))  bind:m
    (get-peek /x/v1/lens/recent/not-a-number)
  ;<  ~  bind:m  (ex-equal !>(?=([~ ~] recent)) !>(&))
  ;<  since=(unit (unit cage))  bind:m
    (get-peek /x/v1/lens/since/not-a-date)
  ;<  ~  bind:m  (ex-equal !>(?=([~ ~] since)) !>(&))
  ;<  run=(unit (unit cage))  bind:m
    (get-peek /x/v1/lens/run/not-a-ship/some-id)
  (ex-equal !>(?=([~ ~] run)) !>(&))
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
::  RETRY ACTION TESTS
::  ==========================================================
::
::  retry from the configured owner targeting our.bowl as bot (cross-ship
::  poke owner → bot) emits a %retry-requested fact on /v1/lens for the
::  local gateway to dispatch. retry doesn't mutate stored state.
::
++  test-retry-from-owner-targeting-self-emits-fact
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  caz=(list card)  bind:m
    %-  (do-as ~bus)
    (do-poke %steward-action-1 !>(`action:v1:s`[%lens %retry ~dev 'lens-r1']))
  %+  ex-cards  caz
  :~  %-  ex-fact
      :*  ~[/v1/lens]
          %steward-update-1
          !>(`update:v1:s`[%lens %retry-requested 'lens-r1' ~bus])
      ==
  ==
::
::  self-poked retry targeting our.bowl (the local-client + self-owned-bot
::  case) emits the fact with the local ship tagged as requester.
::
++  test-retry-from-self-targeting-self-emits-fact
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~dev)
  ;<  caz=(list card)  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%lens %retry ~dev 'lens-r2']))
  %+  ex-cards  caz
  :~  %-  ex-fact
      :*  ~[/v1/lens]
          %steward-update-1
          !>(`update:v1:s`[%lens %retry-requested 'lens-r2' ~dev])
      ==
  ==
::
::  self-poked retry targeting a DIFFERENT bot (owner-side relay path):
::  we forward the same action to the bot's steward over Ames and emit
::  no local fact. the bot will accept (src=owner) and emit its own fact.
::
++  test-retry-self-poked-bot-elsewhere-relays
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%lens %retry ~bus 'lens-r-relay']))
  %+  ex-cards  caz
  :~  %-  ex-poke
      :*  /lens/retry/(scot %p ~bus)/(scot %t 'lens-r-relay')
          [~bus %steward]
          %steward-action-1
          !>(`action:v1:s`[%lens %retry ~bus 'lens-r-relay'])
      ==
  ==
::
::  retry from a non-owner, non-self ship must crash the auth gate
::  regardless of bot.
::
++  test-retry-from-non-owner-rejected
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  %-  ex-fail
  %-  (do-as ~zod)
  (do-poke %steward-action-1 !>(`action:v1:s`[%lens %retry ~dev 'lens-r3']))
::
::  retry when no owner is configured: only self is accepted.
::
++  test-retry-without-owner-rejected-from-foreign
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  %-  ex-fail
  %-  (do-as ~bus)
  (do-poke %steward-action-1 !>(`action:v1:s`[%lens %retry ~dev 'lens-r4']))
::
::  retry does NOT mutate the lens store (no new run record is created;
::  no entry fact is emitted). the gateway is expected to dispatch and
::  later push the new run back via %entry.
::
++  test-retry-does-not-mutate-store
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  *  bind:m
    %-  (do-as ~bus)
    (do-poke %steward-action-1 !>(`action:v1:s`[%lens %retry ~dev 'lens-r5']))
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  (ex-equal !>(~(wyt by runs.lens.st)) !>(0))
::
::  payloads larger than the agent cap (512KB) are dropped without store
::  mutation or fact emission — a misbehaving gateway can't force
::  unbounded growth via a single poke.
::
++  test-oversized-entry-payload-dropped
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~dev)
  ::  build a payload one byte over the cap.
  ::
  =/  big-payload=@t
    (crip (reap (add 524.288 1) 'a'))
  ;<  caz=(list card)  bind:m
    %-  (do-as moon)
    (do-poke %steward-action-1 !>(`action:v1:s`[%lens %entry 'big' big-payload &]))
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  (ex-equal !>(~(wyt by runs.lens.st)) !>(0))
::
::  retry against an existing finalized entry must not touch the stored
::  record (no overwrite, no demotion, no entry-fact re-emission).
::
++  test-retry-preserves-existing-entry
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ::  store a finalized entry as a sponsored moon first.
  ::
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-action-1 !>(`action:v1:s`[%lens %entry 'lens-r6' payload &]))
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now ~2024.1.2)))
  ::  retry it from the owner targeting us; the entry must remain unchanged
  ::  and only the retry-requested fact must be emitted (no entry fact).
  ::
  ;<  caz=(list card)  bind:m
    %-  (do-as ~bus)
    (do-poke %steward-action-1 !>(`action:v1:s`[%lens %retry ~dev 'lens-r6']))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  %-  ex-fact
        :*  ~[/v1/lens]
            %steward-update-1
            !>(`update:v1:s`[%lens %retry-requested 'lens-r6' ~bus])
        ==
    ==
  ;<  res=cage  bind:m  (got-peek /x/v1/lens/run/(scot %p moon)/lens-r6)
  =+  !<(=update:v1:s q.res)
  ?>  ?=(%lens -.update)
  ?>  ?=(%entry -.update.update)
  (ex-equal !>(run.entry.update.update) !>(`run:lens:s`[& ~2024.1.1 payload]))
::
::  ==========================================================
::  GATEWAY MODULE TESTS
::  ==========================================================
::
::  After setup+configure+ga-configure the gateway has an owner
::  (owner set) and timing configured. lifecycle pokes use the
::  steward-action-1 mark with [%gateway ...] payload.
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
  (ex-fail (do-poke %steward-action-1 !>(`action:v1:s`[%gateway %gateway-start 'boot-1' (add ~2024.1.1 ~m2)])))
::
++  test-gw-start-sets-status-up
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  =/  lease-time  (add ~2024.1.1 ~s90)
  ;<  caz=(list card)  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%gateway %gateway-start 'boot-1' lease-time]))
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
    (do-poke %steward-action-1 !>(`action:v1:s`[%gateway %gateway-start 'boot-1' lease-time]))
  ;<  ~  bind:m  (wait ~s91)
  ;<  *  bind:m  (do-arvo /gateway/lease-check [%behn %wake ~])
  =/  new-lease  (add ~2024.1.1 ~m5)
  ;<  *  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%gateway %gateway-heartbeat 'boot-1' new-lease]))
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
    (do-poke %steward-action-1 !>(`action:v1:s`[%gateway %gateway-start 'boot-1' lease-time]))
  ;<  *  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%gateway %gateway-stop 'boot-1' 'test']))
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
    (do-poke %steward-action-1 !>(`action:v1:s`[%gateway %gateway-start 'boot-1' lease-time]))
  ;<  *  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%gateway %gateway-stop 'boot-old' 'stale']))
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
    (do-poke %steward-action-1 !>(`action:v1:s`[%gateway %gateway-start 'boot-1' lease-time]))
  ;<  *  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%gateway %gateway-stop 'boot-1' 'shutdown']))
  =/  new-lease  (add ~2024.1.1 ~m5)
  ;<  *  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%gateway %gateway-heartbeat 'boot-1' new-lease]))
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
    (do-poke %steward-action-1 !>(`action:v1:s`[%gateway %gateway-start 'boot-1' lease-time]))
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
    (do-poke %steward-action-1 !>(`action:v1:s`[%gateway %gateway-start 'boot-1' lease-time]))
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
    (do-poke %steward-action-1 !>(`action:v1:s`[%gateway %gateway-start 'boot-1' lease-time]))
  ;<  *  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%gateway %gateway-stop 'boot-1' 'test']))
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(pending-restart.gateway.st) !>(&))
  =/  lease-time-2  (add ~2024.1.1 ~m4)
  ;<  *  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%gateway %gateway-start 'boot-2' lease-time-2]))
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
    (do-poke %steward-action-1 !>(`action:v1:s`[%gateway %gateway-start 'boot-1' lease-time]))
  ;<  res=cage  bind:m  (got-peek /x/v1/gateway/status)
  =+  !<([=status:gateway:s lut=(unit @da)] q.res)
  ;<  ~  bind:m  (ex-equal !>(status) !>(%up))
  (ex-equal !>(lut) !>(`lease-time))
--
