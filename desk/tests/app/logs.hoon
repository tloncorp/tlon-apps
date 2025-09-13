/-  l=logs
/+  *test-agent
/=  agent  /app/logs
|%
++  dap  %logs-test
++  test-log-fail
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap agent)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(sap /gall/test)))
  ;<  =bowl:gall  bind:m  get-bowl
  =/  fail=log-event:l
    [%fail %test-fail leaf+"test stacktrace"]
  ;<  caz=(list card)  bind:m
    (do-poke log-action+!>(`a-log:l`[%log fail ~]))
  =/  =log-item:l
    [now.bowl fail]
  =/  =log-data:l
    ~['commit'^s+'development']
  =/  fard=(fyrd:khan cage)
    [q.byk.bowl %posthog noun+!>(`[`path`/gall/test log-item log-data])]
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
