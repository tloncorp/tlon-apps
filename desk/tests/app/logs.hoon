/-  l=logs
/+  *test-agent
/=  agent  /app/logs
|%
++  dap  %logs-test
++  test-log-fail
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap agent)
  :: ;<  *  bind:m  (set-scry-gate ,~)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(sap /gall/test)))
  ;<  =bowl:gall  bind:m  get-bowl
  =/  ev-fail=log-event:l
    [%fail %test-fail leaf+"test stacktrace" ~]
  ;<  caz=(list card)  bind:m
    (do-poke log-action+!>([%log ev-fail]))
  =/  fard=(fyrd:khan cage)
    [q.byk.bowl %posthog noun+!>(`[`path`/gall/test [now.bowl ev-fail]])]
  ::  expect log submission -posthog
  ::
  ?>  ?=([[%pass *] ~] caz)
  =/  card=card:agent:gall  i.caz
  ?>  ?=([%pass [%posthog ~] %arvo %k %fard *] card)
  ::  compare fard args value
  ::
  ;<  ~  bind:m
    %+  ex-equal
      !>(q.q.args.fard)
      !>(q.q.args.p.q.card)
  ::  compare fard type
  ::
  %+  ex-equal
    !>((~(nest ut p.q.args.fard) | p.q.args.p.q.card))
    !>(&)
--
