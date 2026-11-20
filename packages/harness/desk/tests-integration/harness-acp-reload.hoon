::  Opt-in: -test /=harness=/tests-integration/harness-acp-reload
::  Exercise the saved transport through test-agent.
/+  *test-agent
/=  transport  /app/acp
/=  up  /tests/harness-upgrade
|%
++  get-state
  =/  m  (mare ,acp-state:up)
  ^-  form:m
  ;<  =vase  bind:m  get-save
  (pure:m !<(acp-state:up vase))
::
++  test-reload-keeps-connections-and-queues
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now ~2026.11.15)))
  ;<  caz=(list card)  bind:m  (do-load transport `!>(acp-populated:up))
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  state=acp-state:up  bind:m  get-state
  (ex-same:up !>(state) !>(acp-populated:up))
--
