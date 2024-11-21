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
    [q.byk.bowl %posthog noun+!>(`[%test ^-(log-item:l [now.bowl ev-fail])])]
  ::  expect log submission -posthog
  ::
  %+  ex-cards  caz
  :~  (ex-arvo /posthog/test/(scot %da now.bowl) %k %fard fard)
  ==
--
