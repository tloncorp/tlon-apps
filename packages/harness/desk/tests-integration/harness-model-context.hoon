::  Catalog metadata updates capacity without admitting or retrying model work.
/-  h=harness, *harness-store, renew=harness-oauth
/+  *test-agent, policy=harness-defaults, hl=harness, auth=harness-auth, mc=harness-model-context
/=  head  /app/harness
|%
::  Load the fixture as ~zod; every scry answers %.n, as the old sandbox did.
::  Produces the load's cards, which carry the catalog request.
::
++  setup
  =/  m  (mare ,(list card))
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now ~2026.10.2)))
  ;<  ~  bind:m  (set-scry-gate |=(path `!>(|)))
  (do-load head `!>(fixture))
::
++  get-state
  =/  m  (mare ,state-0)
  ^-  form:m
  ;<  =vase  bind:m  get-save
  (pure:m !<(state-0 vase))
::
++  fixture
  ^-  state-0
  =/  saved  *state-0
  =/  cfg  builtin-config:policy
  =.  cfg  cfg(url device-url:auth, model 'gpt-6-luna', max-context 80.000)
  =/  failed=(list event:h)
    :~  [%llm-failed 0 'context budget exhausted']
        [%llm-requested 0 %turn]
        [%input-admitted [%user 'Keep the current request']]
        [%config-replaced cfg]
    ==
  =/  waiting=(list event:h)
    :~  [%llm-routed 0 cfg]
        [%llm-requested 0 %turn]
        [%input-admitted [%user 'Wait for my response']]
        [%config-replaced cfg]
    ==
  %=  saved
    defaults  cfg(model 'gpt-6-astra', max-context 272.000)
    peer-base  `cfg
    summary-models  [`cfg `cfg]
    local-mcp-seen  1
    provider-keys  (my ~[['openai-device' 'fixture-token'] ['openai-account' 'fixture-account']])
    sessions
      %-  my
      :~  ['failed' [failed 1]]
          ['pending' [waiting 1]]
          ['unknown' [~[[%config-replaced cfg(model 'unknown', max-context 123.456)]] 0]]
          ['custom' [~[[%config-replaced cfg(url 'https://example.test/responses')]] 0]]
      ==
  ==
++  requests
  |=  cards=(list card)
  ^-  (list http-card:renew)
  %+  murn
    cards
  |=  c=card
  ^-((unit http-card:renew) ?:(?=([%pass [%model-context *] %arvo %i %request *] c) `c ~))
++  reply
  |=  raw=@t
  ^-  client-response:iris
  [%finished [200 ~] `['application/json' (as-octs:mimes:html raw)]]
++  catalog
  %-  reply
  '{"models":[{"slug":"gpt-6-luna","context_window":272000,"max_context_window":872000},{"slug":"gpt-6-astra","context_window":272000,"max_context_window":872000}]}'
++  test-reload-refreshes-every-known-route-without-retrying-work
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  loaded=(list card)  bind:m  setup
  ;<  initial=state-0  bind:m  get-state
  =/  sent  (requests loaded)
  =/  request  (snag 0 sent)
  ;<  updated=(list card)  bind:m  (do-arvo wire.request [%iris %http-response catalog])
  ;<  saved=state-0  bind:m  get-state
  ;<  *  bind:m  (do-arvo wire.request [%iris %http-response catalog])
  ;<  repeated=state-0  bind:m  get-state
  =/  failed  (play:hl log:(~(got by sessions.saved) 'failed'))
  =/  pending  (play:hl log:(~(got by sessions.saved) 'pending'))
  ?>  ?&  ?=(^ peer-base.saved)
          ?=(^ compaction.summary-models.saved)
          ?=(^ lcm.summary-models.saved)
          ?=(^ route.pending)
      ==
  ;<  ~  bind:m  (ex-equal !>((lent sent)) !>(1))
  ;<  ~  bind:m  (ex-equal !>(method.request.request) !>(%'GET'))
  ;<  ~  bind:m  (ex-equal !>(url.request.request) !>(device-models:auth))
  ;<  ~  bind:m
    %+  ex-equal
      !>  %+  lien
            header-list.request.request
          |=([name=@t value=@t] &(=('chatgpt-account-id' name) =(value 'fixture-account')))
    !>(&)
  ;<  ~  bind:m  (ex-equal !>(max-context.defaults.saved) !>(872.000))
  ;<  ~  bind:m  (ex-equal !>(max-context.u.peer-base.saved) !>(872.000))
  ;<  ~  bind:m  (ex-equal !>(max-context.u.compaction.summary-models.saved) !>(872.000))
  ;<  ~  bind:m  (ex-equal !>(max-context.u.lcm.summary-models.saved) !>(872.000))
  ;<  ~  bind:m  (ex-equal !>(max-context.config.failed) !>(872.000))
  ;<  ~  bind:m  (ex-equal !>(err.failed) !>(`'context budget exhausted'))
  ;<  ~  bind:m  (ex-equal !>(items.failed) !>(~[[%user 'Keep the current request']]))
  ;<  ~  bind:m  (ex-equal !>(pending.pending) !>(`[0 %turn]))
  ;<  ~  bind:m  (ex-equal !>(max-context.config.u.route.pending) !>(80.000))
  ;<  ~  bind:m
    %+  ex-equal
      !>((~(got by sessions.saved) 'unknown'))
    !>((~(got by sessions.initial) 'unknown'))
  ;<  ~  bind:m
    %+  ex-equal
      !>((~(got by sessions.saved) 'custom'))
    !>((~(got by sessions.initial) 'custom'))
  ;<  ~  bind:m  (ex-equal !>(repeated) !>(saved))
  %+  ex-equal
    !>(!(lien updated |=(c=card ?=([%pass * %arvo %i %request *] c))))
  !>(&)
::  Each response lands on a freshly loaded agent.
::
++  test-unavailable-or-invalid-metadata-preserves-saved-capacity
  %-  zing
  %+  turn
    ^-  (list client-response:iris)
    :~  [%finished [401 ~] ~]  (reply 'invalid JSON')
        (reply '{"models":[{"slug":"gpt-6-luna","max_context_window":0}]}')
    ==
  |=  response=client-response:iris
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  loaded=(list card)  bind:m  setup
  ;<  initial=state-0  bind:m  get-state
  =/  request  (snag 0 (requests loaded))
  ;<  *  bind:m  (do-arvo wire.request [%iris %http-response response])
  ;<  updated=state-0  bind:m  get-state
  (ex-equal !>(updated) !>(initial))
++  test-credential-identity-fences-late-catalog-responses
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  loaded=(list card)  bind:m  setup
  =/  request  (snag 0 (requests loaded))
  ;<  initial=state-0  bind:m  get-state
  =.  provider-keys.initial
    %+  ~(put by provider-keys.initial)
      'openai-device'
    'replacement-token'
  ;<  =agent  bind:m  get-agent
  ;<  *  bind:m  (do-load agent `!>(initial))
  ;<  current=state-0  bind:m  get-state
  ;<  *  bind:m  (do-arvo wire.request [%iris %http-response catalog])
  ;<  updated=state-0  bind:m  get-state
  (ex-equal !>(updated) !>(current))
--
