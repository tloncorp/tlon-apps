::  tests for %context-lens agent
::
/-  l=context-lens
/+  *test-agent
/=  agent  /app/context-lens
|%
++  dap  %context-lens
+$  state-0
  $:  %0
      owners=(set ship)
      runs=(map [bot=ship =id-run:l] run:l)
  ==
++  payload  ^-  @t  '{"schemaVersion":1,"summary":"run-record"}'
++  setup
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~dev, src ~dev)))
  ;<  *  bind:m  (do-init dap agent)
  ::  do-init resets the bowl, so set the clock after it
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now ~2024.1.1)))
  (pure:m ~)
++  configure
  |=  owners=(set ship)
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m
    (do-poke %context-lens-action-1 !>(`action:v1:l`[%configure owners]))
  (pure:m ~)
++  test-configure-sets-owners
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m
    (do-poke %context-lens-action-1 !>(`action:v1:l`[%configure (silt ~[~bus])]))
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-0 !<(vase q.res))
  (ex-equal !>(owners.st) !>((silt ~[~bus])))
++  test-action-from-foreign-ship-crashes
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  %-  ex-fail
  %-  (do-as ~zod)
  (do-poke %context-lens-action-1 !>(`action:v1:l`[%configure (silt ~[~zod])]))
++  test-run-final-fans-out-to-owners
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure (silt ~[~bus]))
  ;<  caz=(list card)  bind:m
    (do-poke %context-lens-action-1 !>(`action:v1:l`[%run-final 'lens-1' payload]))
  %+  ex-cards  caz
  :~  %-  ex-poke
      :*  /signal/(scot %p ~bus)/(scot %t 'lens-1')
          [~bus %context-lens]
          %context-lens-signal-1
          !>(`signal:v1:l`[%run-final 'lens-1' payload])
      ==
  ==
++  test-self-owner-stores-without-network-hop
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure (silt ~[~dev]))
  ;<  caz=(list card)  bind:m
    (do-poke %context-lens-action-1 !>(`action:v1:l`[%run-final 'lens-1' payload]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  %-  ex-fact
        :*  ~[/v1]
            %context-lens-update-1
            !>(`update:v1:l`[%run ~dev 'lens-1' [& ~2024.1.1 payload]])
        ==
    ==
  ;<  res=cage  bind:m  (got-peek /x/run/(scot %p ~dev)/lens-1)
  =+  !<(=update:v1:l q.res)
  (ex-equal !>(update) !>(`update:v1:l`[%run ~dev 'lens-1' [& ~2024.1.1 payload]]))
++  test-signal-stores-keyed-by-source
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m
    %-  (do-as ~zod)
    (do-poke %context-lens-signal-1 !>(`signal:v1:l`[%run-event 'lens-2' payload]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  %-  ex-fact
        :*  ~[/v1]
            %context-lens-update-1
            !>(`update:v1:l`[%run ~zod 'lens-2' [| ~2024.1.1 payload]])
        ==
    ==
  ;<  res=cage  bind:m  (got-peek /x/run/(scot %p ~zod)/lens-2)
  =+  !<(=update:v1:l q.res)
  (ex-equal !>(update) !>(`update:v1:l`[%run ~zod 'lens-2' [| ~2024.1.1 payload]]))
++  test-final-marks-run-complete
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m
    %-  (do-as ~zod)
    (do-poke %context-lens-signal-1 !>(`signal:v1:l`[%run-event 'lens-3' payload]))
  ;<  *  bind:m
    %-  (do-as ~zod)
    (do-poke %context-lens-signal-1 !>(`signal:v1:l`[%run-final 'lens-3' payload]))
  ;<  res=cage  bind:m  (got-peek /x/run/(scot %p ~zod)/lens-3)
  =+  !<(=update:v1:l q.res)
  ?>  ?=(%run -.update)
  (ex-equal !>(complete.run.entry.update) !>(&))
++  test-late-event-after-final-is-dropped
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m
    %-  (do-as ~zod)
    (do-poke %context-lens-signal-1 !>(`signal:v1:l`[%run-final 'lens-4' payload]))
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now ~2024.1.2)))
  ;<  caz=(list card)  bind:m
    %-  (do-as ~zod)
    (do-poke %context-lens-signal-1 !>(`signal:v1:l`[%run-event 'lens-4' '{"partial":true}']))
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  res=cage  bind:m  (got-peek /x/run/(scot %p ~zod)/lens-4)
  =+  !<(=update:v1:l q.res)
  ?>  ?=(%run -.update)
  (ex-equal !>(run.entry.update) !>(`run:l`[& ~2024.1.1 payload]))
++  test-old-runs-pruned-by-age
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m
    %-  (do-as ~zod)
    (do-poke %context-lens-signal-1 !>(`signal:v1:l`[%run-final 'old-run' payload]))
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now (add ~2024.1.1 ~d31))))
  ;<  *  bind:m
    %-  (do-as ~zod)
    (do-poke %context-lens-signal-1 !>(`signal:v1:l`[%run-final 'new-run' payload]))
  ;<  res=cage  bind:m  (got-peek /x/recent)
  =+  !<(=update:v1:l q.res)
  ?>  ?=(%runs -.update)
  ;<  ~  bind:m  (ex-equal !>((lent entries.update)) !>(1))
  ?>  ?=(^ entries.update)
  (ex-equal !>(id-run.i.entries.update) !>('new-run'))
++  test-watch-rejects-foreign-ship
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  %-  ex-fail
  %-  (do-as ~zod)
  (do-watch /v1)
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
  =/  recent  (mule |.((~(on-peek agent.s bowl.s) /x/recent)))
  ?:  ?=(%& -.recent)
    |+~['expected foreign /x/recent peek to crash']
  =/  run  (mule |.((~(on-peek agent.s bowl.s) /x/run/(scot %p ~zod)/lens-1)))
  ?:  ?=(%& -.run)
    |+~['expected foreign /x/run peek to crash']
  &+[~ s]
--
