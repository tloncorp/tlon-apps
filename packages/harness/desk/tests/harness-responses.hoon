/-  h=harness, s=harness-store
/+  *test, hp=harness-provider, hl=harness, hj=harness-json, j=harness-workspace-json,
    auth=harness-auth, storage=harness-store, routing=harness-model-routing
|%
++  api  'https://api.openai.com/v1/responses'
++  cfg
  =/  c=config:h  *config:h
  c(url api, model 'gpt-6-luna', tools ~[%web], max-context 80.000)
++  reasoning
  %-  need
  %-  de:json:html
  '{"type":"reasoning","id":"rs_fixture","summary":[],"encrypted_content":"OPAQUE_FIXTURE"}'
++  stream
  %+  rap  3
  :~  'data: {"type":"response.output_item.done","item":'
      (en:json:html reasoning)  '}\0a\0a'
      'data: {"type":"response.output_item.done","item":{"type":"function_call","call_id":"call_fixture","name":"web_search","arguments":"{}"}}\0a\0a'
      'data: {"type":"response.completed","response":{"usage":{"input_tokens":10,"output_tokens":20}}}\0a\0a'
  ==
++  log
  ^-  (list event:h)
  =/  out  (parse-responses-sse:hp stream)
  ?>  ?=(%& -.out)
  %-  flop
  ^-  (list event:h)
  :~  [%config-replaced cfg]
      [%input-admitted [%user 'Find the forecast']]
      [%llm-requested 1 %turn]
      [%llm-reasoning 1 api 'gpt-6-luna' (responses-reasoning:hp stream)]
      [%llm-completed 1 stop.p.out u.p.out it.p.out]
      [%tool-completed 'call_fixture' 'web_search' 'Forecast fixture']
  ==
++  test-api-and-subscription-use-responses-with-separate-credentials
  %-  zing
  %+  turn  `(list @t)`~[api device-url:auth]
  |=  url=@t
  =/  v=view:h  *view:h
  =.  config.v  cfg
  =.  url.config.v  url
  =/  body  (payload:hp v %turn ~)
  =/  tools  (need (get:j body 'tools'))
  ?>  ?=([%a ^] tools)
  ;:  weld
      (expect-eq !>(`json`[%s 'gpt-6-luna']) !>((need (get:j body 'model'))))
      (expect-eq !>(~) !>((get:j body 'messages')))
      (expect-eq !>(`json`[%b |]) !>((need (get:j body 'store'))))
      (expect-eq !>(`json`[%b |]) !>((need (get:j i.p.tools 'strict'))))
      %+  expect-eq
        !>(`json`[%a ~[[%s 'reasoning.encrypted_content']]])
      !>((need (get:j body 'include')))
      (expect-eq !>(?:(=(url api) 'openai' 'openai-device')) !>((credential-for-url:auth url)))
  ==
++  test-reasoning-survives-storage-and-precedes-tool-exchange
  =/  saved=state-0:s  *state-0:s
  =.  sessions.saved  (my ~[['fixture' [log 2]]])
  =/  loaded  (load:storage !>(saved))
  =/  v  (play:hl log:(~(got by sessions.loaded) 'fixture'))
  =/  body  (payload:hp v %turn ~)
  =/  input  (need (get:j body 'input'))
  ?>  ?=(%a -.input)
  ;:  weld
      (expect-eq !>(reasoning) !>((snag 1 p.input)))
      (expect-eq !>('function_call') !>((string:j (snag 2 p.input) 'type')))
      (expect-eq !>('function_call_output') !>((string:j (snag 3 p.input) 'type')))
      (expect-eq !>('call_fixture') !>((string:j (snag 3 p.input) 'call_id')))
      (expect-eq !>(3) !>((lent (transcript:hl log))))
      (expect-eq !>(`(unit step:h)`[~ [%turn ~]]) !>((decide:hl v |=(~ 1))))
  ==
++  test-reasoning-is-not-visible-or-replayed-to-another-route
  =/  v  (play:hl log)
  =/  ui  (need (get:j (view-json:hj v ~s30) 'items'))
  ?>  ?=(%a -.ui)
  =/  changed  (need (get:j (payload:hp v(model.config 'another-model') %turn ~) 'input'))
  ?>  ?=(%a -.changed)
  =/  subscription  (need (get:j (payload:hp v(url.config device-url:auth) %turn ~) 'input'))
  ?>  ?=(%a -.subscription)
  =/  chat
    %-  need
    %+  get:j
      (payload:hp v(url.config 'https://openrouter.ai/api/v1/chat/completions') %turn ~)
    'messages'
  ?>  ?=(%a -.chat)
  ;:  weld
      (expect-eq !>(3) !>((lent p.ui)))
      (expect-eq !>(3) !>((lent p.changed)))
      (expect-eq !>(3) !>((lent p.subscription)))
      (expect-eq !>(4) !>((lent p.chat)))
  ==
++  test-stale-reasoning-is-not-admitted
  =/  v
    %-  play:hl
    ~[[%llm-reasoning 2 api 'gpt-6-luna' (en:json:html [%a ~[reasoning]])] [%llm-requested 1 %turn]]
  (expect-eq !>(~) !>(items.v))
++  test-output-order-and-identifiers-are-preserved-without-duplicates
  =/  message
    %-  need
    %-  de:json:html
    '{"type":"message","id":"msg_fixture","role":"assistant","content":[{"type":"output_text","text":"Checking"}]}'
  =/  call
    %-  need
    %-  de:json:html
    '{"type":"function_call","id":"fc_fixture","call_id":"call_fixture","name":"current_time","arguments":"{}"}'
  =/  ordered=(list json)  ~[message reasoning call]
  =/  items=(list item:h)
    :~  [%reasoning api 'gpt-6-luna' (en:json:html [%a ordered])]
        [%assistant 'Checking' ~[['call_fixture' 'current_time' '{}']]]
    ==
  ;:  weld
      (expect-eq !>(ordered) !>((responses-input:hp cfg items &)))
      (expect-eq !>(2) !>((lent (responses-input:hp cfg items |))))
  ==
++  test-compaction-retains-the-continuation-with-its-assistant
  =/  items=(list item:h)
    :~  [%user 'before']  [%reasoning api 'gpt-6-luna' (responses-reasoning:hp stream)]
        [%assistant '' ~[['c' 'current_time' '{}']]]  [%tool 'c' 'current_time' 'time']
        [%assistant 'time' ~]  [%user 'again']  [%assistant 'yes' ~]  [%user 'now']
    ==
  =/  kept  (retained:hl items)
  ?>  ?=(^ kept)
  ;:  weld
      (expect-eq !>(7) !>((lent kept)))
      (expect !>(?=(%reasoning -.i.kept)))
  ==
++  test-unreplayable-reasoning-is-rejected
  %-  expect-fail
  |.  %-  responses-reasoning:hp
      'data: {"type":"response.output_item.done","item":{"type":"reasoning","id":"rs_fixture","summary":[]}}\0a\0a'
++  test-streamed-provider-failure-reports-billing-error
  =/  out
    %-  parse-responses-sse:hp
    'data: {"type":"response.failed","response":{"error":{"code":"credit_balance_exhausted","message":"No credits remaining"}}}\0a\0a'
  ?>  ?=(%| -.out)
  %+  expect-eq
    !>('provider error: {"code":"credit_balance_exhausted","message":"No credits remaining"}')
  !>(p.out)
--
