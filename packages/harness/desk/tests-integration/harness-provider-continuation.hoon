::  Real local tool execution through the head, with provider-wire fixtures.
/-  h=harness, *harness-store, renew=harness-oauth
/+  *test-agent, policy=harness-defaults, hl=harness, w=harness-provider-wire, hp=harness-provider,
    hj=harness-json
/=  head  /app/harness
/=  fixture  /tests/harness-provider-continuation
|%
::  Load saved state as ~zod; every scry answers %.n, as the old sandbox did.
::
++  setup
  |=  [now=@da saved=state-0]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now now)))
  ;<  ~  bind:m  (set-scry-gate |=(path `!>(|)))
  ;<  *  bind:m  (do-load head `!>(saved))
  (pure:m ~)
::
++  get-state
  =/  m  (mare ,state-0)
  ^-  form:m
  ;<  =vase  bind:m  get-save
  (pure:m !<(state-0 vase))
::
++  test-chat-and-native-tools-preserve-continuations-through-reload
  %-  zing
  %+  turn  `(list @t)`~[native:fixture router:fixture 'https://example.test/v1/chat/completions']
  |=(url=@t (eval-mare (exchange url)))
++  requests
  |=  cards=(list card)
  ^-  (list http-card:renew)
  %+  murn
    cards
  |=  c=card
  ^-((unit http-card:renew) ?:(?=([%pass [%llm *] %arvo %i %request *] c) `c ~))
++  test-failed-history-retries-with-valid-utf8-without-repeating-tools
  (eval-mare retry-text)
++  retry-text
  =/  m  (mare ,~)
  ^-  form:m
  =/  cfg  builtin-config:policy
  =.  cfg
    %=  cfg  url  'https://chatgpt.com/backend-api/codex/responses'  model  'fixture'  tools
        ~[%web]  key  ''
    ==
  =/  broken=@t  (cat 3 (end [3 2] '🐛') ' ...(truncated)')
  =/  log=(list event:h)
    :~  [%llm-failed 1 'http error 400: Bad Request']
        [%llm-requested 1 %turn]
        [%tool-completed 'fetch' 'http_fetch' broken]
        [%tool-requested 'fetch' 'http_fetch']
        :*  %llm-completed  0  %tool-calls  [0 0]
            [%assistant '' ~[['fetch' 'http_fetch' '{"url":"https://example.com"}']]]
        ==
        [%llm-requested 0 %turn]
        [%input-admitted [%user 'Read this page']]
        [%config-replaced cfg]
    ==
  =/  saved=state-0  *state-0
  =.  saved
    %=  saved  local-mcp-seen  1  provider-keys  (my ~[['openai-device' 'fixture-token']])  sessions
        (my ~[['fixture' [log 2]]])
    ==
  ;<  ~  bind:m  (setup ~2026.9.29 saved)
  ;<  retried=(list card)  bind:m  (do-poke %harness-action !>(`action:h`[%retry 'fixture']))
  ;<  retained=state-0  bind:m  get-state
  =/  sent  (requests retried)
  =/  raw  q:(need body.request:(snag 0 sent))
  =/  input  (need (get:w (body (snag 0 sent)) 'input'))
  ?>  ?=(%a -.input)
  ;<  ~  bind:m  (ex-equal !>((lent sent)) !>(1))
  ;<  ~  bind:m  (ex-equal !>((sune:de:json:html raw)) !>(&))
  ;<  ~  bind:m
    (ex-equal !>((get:w (rear p.input) 'output')) !>(`[%s '�� ...(truncated)']))
  ;<  ~  bind:m
    %+  ex-equal
      !>(items:(play:hl log:(~(got by sessions.retained) 'fixture')))
    !>(items:(play:hl log))
  %+  ex-equal
    !>(!(lien retried |=(c=card ?=([%pass [%tool-2 *] %arvo %i %request *] c))))
  !>(&)
++  body
  |=  c=http-card:renew
  (need (de:json:html q:(need body.request.c)))
++  exchange
  |=  url=@t
  =/  m  (mare ,~)
  ^-  form:m
  =/  native=?  =(url native:fixture)
  =/  saved=state-0  *state-0
  =/  cfg  builtin-config:policy
  =.  cfg  cfg(url url, model 'fixture-model', tools ~, key 'fixture-key')
  =.  saved
    %=  saved  defaults  cfg  local-mcp-seen  1  sessions
        (my ~[['fixture' [~[[%config-replaced cfg]] 0]]])
    ==
  ;<  ~  bind:m  (setup ~2026.9.24 saved)
  ;<  sent=(list card)  bind:m
    (do-poke %harness-action !>(`action:h`[%send 'fixture' 'What time is it?']))
  =/  first  (snag 0 (requests sent))
  =/  raw  ?:(native native-stream:fixture chat-stream:fixture)
  =/  response=client-response:iris
    [%finished [200 ~] `['text/event-stream' (as-octs:mimes:html raw)]]
  ;<  executed=(list card)  bind:m  (do-arvo wire.first [%iris %http-response response])
  =/  next  (snag 0 (requests executed))
  =/  messages  (need (get:w (body next) 'messages'))
  ?>  ?=(%a -.messages)
  =/  assistant  (snag ?:(native 1 2) p.messages)
  =/  fields  (need (de:json:html (continuation:hp url raw)))
  ?>  ?=(%o -.fields)
  ::  Reload a fresh head from the saved state before the final reply lands.
  ;<  *  bind:m  (do-load head ~)
  ;<  restored=state-0  bind:m  get-state
  =/  view  (play:hl log:(~(got by sessions.restored) 'fixture'))
  =/  final-text
    ?:  native
      '{"type":"message","role":"assistant","content":[{"type":"text","text":"Done."}],"stop_reason":"end_turn","usage":{"input_tokens":4,"output_tokens":2}}'
    '{"choices":[{"finish_reason":"stop","message":{"role":"assistant","content":"Done."}}],"usage":{"prompt_tokens":4,"completion_tokens":2}}'
  =/  final=client-response:iris
    [%finished [200 ~] `['application/json' (as-octs:mimes:html final-text)]]
  ;<  *  bind:m  (do-arvo wire.next [%iris %http-response final])
  ;<  retained=state-0  bind:m  get-state
  =/  v  (play:hl log:(~(got by sessions.retained) 'fixture'))
  =/  display  (need (get:w (view-json:hj view ~s30) 'items'))
  ?>  ?=(%a -.display)
  ;<  ~  bind:m  (ex-equal !>(url.request.next) !>(url))
  ;<  ~  bind:m
    %+  ex-equal
      !>((levy ~(tap by p.fields) |=([key=@t value=json] =(`value (get:w assistant key)))))
    !>(&)
  ;<  ~  bind:m
    %+  ex-equal
      !>((get:w (body next) 'messages'))
    !>((get:w (payload:hp (identify:hp view %turn ~zod ~) %turn ~) 'messages'))
  ;<  ~  bind:m  (ex-equal !>((lent p.display)) !>(3))
  ;<  ~  bind:m
    (ex-equal !>((lien items.view |=(it=item:h &(?=(%tool -.it) !=('' body.it))))) !>(&))
  ;<  ~  bind:m  (ex-equal !>((rear items.v)) !>(`item:h`[%assistant 'Done.' ~]))
  ;<  ~  bind:m  (ex-equal !>(pending.v) !>(~))
  (ex-equal !>(total.v) !>(?:(native [37 7] [4 2])))
--
