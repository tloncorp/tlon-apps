::  Run the complete head against fixture Iris responses; no network effects
::  are delivered. Assert the actual emitted requests, not just configuration.
/-  h=harness, *harness-store, renew=harness-oauth, ac=acp
/+  *test-agent, policy=harness-defaults, hl=harness, j=harness-workspace-json
/=  head  /app/harness
|%
::  Load saved state as ~zod; every scry answers %.n, as the old sandbox did.
::  Produces the load's cards.
::
++  setup
  |=  saved=state-0
  =/  m  (mare ,(list card))
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now ~2026.9.17)))
  ;<  ~  bind:m  (set-scry-gate |=(path `!>(|)))
  (do-load head `!>(saved))
::
++  get-state
  =/  m  (mare ,state-0)
  ^-  form:m
  ;<  =vase  bind:m  get-save
  (pure:m !<(state-0 vase))
::  Branch points: the old tests fed different signs to the same agent core.
::
++  snapshot
  =/  m  (mare ,state)
  ^-  form:m
  |=(s=state &+[s s])
++  restore
  |=  saved=state
  (jab-state |=(* saved))
++  do-send
  |=  text=@t
  (do-poke %harness-action !>(`action:h`[%send 'fixture' text]))
++  requests
  |=  cards=(list card)
  ^-  (list http-card:renew)
  %+  murn
    cards
  |=  c=card
  ^-((unit http-card:renew) ?:(?=([%pass [%llm *] %arvo %i %request *] c) `c ~))
++  body
  |=  c=http-card:renew
  =/  octs  (need body.request.c)
  (need (de:json:html q.octs))
++  fixture
  ^-  state-0
  =/  s  *state-0
  =/  cfg  builtin-config:policy
  =.  cfg
    %=  cfg  url  'https://openrouter.ai/api/v1/chat/completions'  model  'primary'  zdr  &
      fallbacks  ~[['openrouter' 'backup']]  tools  ~
    ==
  %=  s  defaults  cfg  local-mcp-seen  1  provider-keys  (my ~[['openrouter' 'fixture-key']])
    sessions  (my ~[['fixture' [~[[%config-replaced cfg]] 0]]])
  ==
++  failed
  ^-  client-response:iris
  [%finished [429 ~] `['application/json' (as-octs:mimes:html '{"error":"limited"}')]]
++  test-failover-is-ordered-fenced-and-does-not-replace-the-primary
  (eval-mare failover)
++  failover
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (setup fixture)
  ;<  sent=(list card)  bind:m  (do-send 'Reply with hello')
  =/  primary  (snag 0 (requests sent))
  ;<  retried=(list card)  bind:m  (do-arvo wire.primary [%iris %http-response failed])
  =/  backup  (snag 0 (requests retried))
  ;<  late=(list card)  bind:m  (do-arvo wire.primary [%iris %http-response failed])
  =/  success=client-response:iris
    :*  %finished  [200 ~]
        :-  ~
        :*  'application/json'
            %-  as-octs:mimes:html
            '{"choices":[{"message":{"role":"assistant","content":"hello"},"finish_reason":"stop"}],"usage":{"prompt_tokens":4,"completion_tokens":1}}'
        ==
    ==
  ;<  *  bind:m  (do-arvo wire.backup [%iris %http-response success])
  ;<  finished=state-0  bind:m  get-state
  =/  view  (play:hl log:(~(got by sessions.finished) 'fixture'))
  ;<  repeated=(list card)  bind:m  (do-send 'Again')
  ;<  ~  bind:m  (ex-equal !>((string:j (body primary) 'model')) !>('primary'))
  ;<  ~  bind:m  (ex-equal !>((string:j (body backup) 'model')) !>('backup'))
  ;<  ~  bind:m  (ex-equal !>(!=(wire.primary wire.backup)) !>(&))
  ;<  ~  bind:m  (ex-equal !>((requests late)) !>(~))
  ;<  ~  bind:m
    %+  ex-equal
      !>((get:j (body backup) 'provider'))
    !>(`(need (de:json:html '{"zdr":true,"data_collection":"deny"}')))
  ;<  ~  bind:m  (ex-equal !>(model.config.view) !>('primary'))
  ;<  ~  bind:m  (ex-equal !>((rear items.view)) !>(`item:h`[%assistant 'hello' ~]))
  ;<  ~  bind:m  (ex-equal !>(pending.view) !>(~))
  (ex-equal !>((string:j (body (snag 0 (requests repeated))) 'model')) !>('primary'))
++  test-fallback-exhaustion-stops-and-cancellation-never-retries
  (eval-mare exhausted)
++  exhausted
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (setup fixture)
  ;<  sent=(list card)  bind:m  (do-send 'Reply')
  ;<  after-send=state  bind:m  snapshot
  =/  primary  (snag 0 (requests sent))
  ;<  retried=(list card)  bind:m  (do-arvo wire.primary [%iris %http-response failed])
  =/  backup  (snag 0 (requests retried))
  ;<  done=(list card)  bind:m  (do-arvo wire.backup [%iris %http-response failed])
  ;<  saved=state-0  bind:m  get-state
  =/  view  (play:hl log:(~(got by sessions.saved) 'fixture'))
  ::  Cancel instead, straight after the send.
  ;<  ~  bind:m  (restore after-send)
  ;<  *  bind:m  (do-poke %harness-action !>(`action:h`[%cancel 'fixture']))
  ;<  late=(list card)  bind:m  (do-arvo wire.primary [%iris %http-response failed])
  ;<  ~  bind:m  (ex-equal !>((requests done)) !>(~))
  ;<  ~  bind:m  (ex-equal !>(pending.view) !>(~))
  ;<  ~  bind:m  (ex-equal !>(?=(^ err.view)) !>(&))
  (ex-equal !>((requests late)) !>(~))
++  test-streamed-text-prevents-failover
  (eval-mare partial)
++  partial
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (setup fixture)
  ;<  sent=(list card)  bind:m  (do-send 'Reply')
  =/  primary  (snag 0 (requests sent))
  =/  chunk  (as-octs:mimes:html 'data: {"choices":[{"delta":{"content":"hello"}}]}\0a\0a')
  =/  progress=client-response:iris  [%progress [200 ~] p.chunk ~ `chunk]
  ;<  waiting=state-0  bind:m  get-state
  =.  acp-prompts.waiting  (my ~[['fixture' ['client' [%n '1'] 0]]])
  ;<  *  bind:m  (do-load head `!>(waiting))
  ;<  streamed=(list card)  bind:m  (do-arvo wire.primary [%iris %http-response progress])
  ;<  after-stream=state  bind:m  snapshot
  =/  frames
    %+  murn  streamed
    |=  =card
    ^-  (unit json)
    ?.  ?=([%pass [%acp %send ~] %agent * %poke %acp-action-1 *] card)  ~
    =/  [pass=* wire=* agent=* target=* poke=* mark=* data=vase]  card
    =/  action  !<(action:v1:ac data)
    ?>  ?=(%send -.action)
    (de:json:html payload.action)
  =/  update  (need (get:j (need (get:j (snag 0 frames) 'params')) 'update'))
  ;<  saved=state-0  bind:m  get-state
  =/  view  (play:hl log:(~(got by sessions.saved) 'fixture'))
  ?>  ?=(^ pending.view)
  ?>  =(5 sent:(~(got by streams.saved) ['fixture' req.u.pending.view]))
  ;<  done=(list card)  bind:m  (do-arvo wire.primary [%iris %http-response failed])
  ;<  finished=state-0  bind:m  get-state
  ::  Cancel instead, straight after the streamed chunk.
  ;<  ~  bind:m  (restore after-stream)
  ;<  *  bind:m  (do-poke %harness-action !>(`action:h`[%cancel 'fixture']))
  ;<  stopped=state-0  bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>((requests done)) !>(~))
  ;<  ~  bind:m
    (ex-equal !>((string:j update 'sessionUpdate')) !>('harness_agent_stream_chunk'))
  ;<  ~  bind:m
    %+  ex-equal
      !>((number:j update 'revision' 0))
    !>((lent log:(~(got by sessions.saved) 'fixture')))
  ;<  ~  bind:m  (ex-equal !>((number:j update 'offset' 999)) !>(0))
  ;<  ~  bind:m
    (ex-equal !>((string:j (need (get:j update 'content')) 'text')) !>('hello'))
  ;<  ~  bind:m  (ex-equal !>(~(wyt by streams.finished)) !>(0))
  (ex-equal !>(~(wyt by streams.stopped)) !>(0))
++  test-failover-uses-persisted-catalog-capacity-and-skips-small-models
  (eval-mare (catalog-failover |))
++  test-missing-primary-credentials-use-the-same-fallback-budget
  (eval-mare (catalog-failover &))
++  catalog-failover
  |=  missing=?
  =/  m  (mare ,~)
  ^-  form:m
  =/  initial  fixture
  =/  cfg  defaults.initial
  =.  cfg  cfg(fallbacks ~[['openrouter' 'small'] ['openrouter' 'backup']])
  =?  cfg  missing
    cfg(url 'https://api.openai.com/v1/responses', zdr |)
  =.  initial  initial(defaults cfg, sessions (my ~[['fixture' [~[[%config-replaced cfg]] 0]]]))
  ;<  loaded=(list card)  bind:m  (setup initial)
  =/  catalogs
    %+  murn  loaded
    |=  c=card
    ^-  (unit http-card:renew)
    ?:(?=([%pass [%model-context *] %arvo %i %request *] c) `c ~)
  ?>  =(1 (lent catalogs))
  =/  catalog  (snag 0 catalogs)
  =/  response=client-response:iris
    :*  %finished  [200 ~]
        :-  ~
        :*  'application/json'
            %-  as-octs:mimes:html
            '{"data":[{"id":"small","context_length":32000},{"id":"backup","context_length":128000}]}'
        ==
    ==
  ;<  *  bind:m  (do-arvo wire.catalog [%iris %http-response response])
  ;<  cached=state-0  bind:m  get-state
  ;<  *  bind:m  (do-load head ~)
  ::  This prompt requires the larger fallback's advertised window.
  =/  prompt  (rap 3 (reap 380.000 'x'))
  ;<  sent=(list card)  bind:m  (do-send prompt)
  =/  first  (snag 0 (requests sent))
  ;<  routed=(list card)  bind:m
    ?:  missing  (pure:(mare ,(list card)) sent)
    (do-arvo wire.first [%iris %http-response failed])
  =/  backup  (snag 0 (requests routed))
  ;<  saved=state-0  bind:m  get-state
  =/  view  (play:hl log:(~(got by sessions.saved) 'fixture'))
  ?>  ?=(^ route.view)
  ;<  ~  bind:m  (ex-equal !>(url.request.catalog) !>('https://openrouter.ai/api/v1/models'))
  ;<  ~  bind:m  (ex-equal !>((string:j (body backup) 'model')) !>('backup'))
  ;<  ~  bind:m  (ex-equal !>(max-context.config.u.route.view) !>(128.000))
  ;<  ~  bind:m  (ex-equal !>(max-context.config.view) !>(800.000))
  ;<  ~  bind:m  (ex-equal !>(model-contexts.saved) !>(model-contexts.cached))
  ;<  ~  bind:m  (ex-equal !>(zdr.config.u.route.view) !>(zdr.cfg))
  (ex-equal !>((lent (requests routed))) !>(1))
--
