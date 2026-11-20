/-  h=harness, l=logs, *harness-store, renew=harness-oauth
/+  *test-agent, policy=harness-defaults
/=  head  /app/harness
|%
++  reports
  |=  cards=(list card)
  ^-  (list a-log:l)
  %+  murn
    cards
  |=  c=card
  ?:(?=([%pass [%telemetry ~] %agent * %poke %log-action-1 *] c) `!<(a-log:l +127.c) ~)
::  Every scry is refused.
::
++  setup
  |=  [now=@da saved=state-0]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now now)))
  ;<  ~  bind:m  (set-scry-gate |=(path `!>(|)))
  ;<  *  bind:m  (do-load head `!>(saved))
  (pure:m ~)
++  do-response
  |=  [=wire response=client-response:iris]
  (do-arvo wire [%iris %http-response response])
::
++  test-terminal-events-emit-once-and-sink-failure-is-inert
  ::  A repeated response and a telemetry nack each follow the first
  ::  completion; a failure follows the load. Run each branch from a fresh load.
  ;:  weld
    %-  eval-mare
    =/  m  (mare ,~)
    ^-  form:m
    ;<  ~  bind:m  private-setup
    ;<  completed=(list card)  bind:m  (do-response private-wire private-reply)
    ;<  again=(list card)  bind:m  (do-response private-wire private-reply)
    ;<  ~  bind:m  (ex-equal !>((lent (reports completed))) !>(1))
    (ex-equal !>((reports again)) !>(~))
  ::
    %-  eval-mare
    =/  m  (mare ,~)
    ^-  form:m
    ;<  ~  bind:m  private-setup
    ;<  *  bind:m  (do-response private-wire private-reply)
    ;<  completed=vase  bind:m  get-save
    ;<  nack=(list card)  bind:m
      (do-agent /telemetry [~zod %logs] [%poke-ack `~[leaf+"sink unavailable"]])
    ;<  after=vase  bind:m  get-save
    ;<  ~  bind:m  (ex-equal !>(nack) !>(~))
    (ex-equal after completed)
  ::
    %-  eval-mare
    =/  m  (mare ,~)
    ^-  form:m
    ;<  ~  bind:m  private-setup
    ;<  failed=(list card)  bind:m
      %+  do-response  private-wire
      [%finished [401 ~] `['application/json' (as-octs:mimes:html 'PRIVATE_ERROR')]]
    (ex-equal !>((lent (reports failed))) !>(1))
  ==
++  private-wire  /llm/private-session/0/turn
++  private-setup
  =/  cfg  builtin-config:policy
  =.  cfg  cfg(key 'PRIVATE_KEY')
  =/  log=(list event:h)
    ~[[%llm-requested 0 %turn] [%input-admitted [%user 'PRIVATE_PROMPT']] [%config-replaced cfg]]
  =/  saved=state-0  *state-0
  =.  saved  saved(local-mcp-seen 1, sessions (my ~[['private-session' [log 1]]]))
  (setup ~2026.9.25 saved)
++  private-reply
  ^-  client-response:iris
  :*  %finished  [200 ~]
      :-  ~
      :*  'application/json'
          %-  as-octs:mimes:html
          '{"choices":[{"finish_reason":"stop","message":{"role":"assistant","content":"PRIVATE_REPLY"}}],"usage":{"prompt_tokens":10,"completion_tokens":5}}'
      ==
  ==
::
++  test-fallback-logs-once-without-logging-stream-chunks
  ::  A late failure follows the retry; a stream chunk follows the send.
  ;:  weld
    %-  eval-mare
    =/  m  (mare ,~)
    ^-  form:m
    ;<  ~  bind:m  (setup ~2026.9.17 fallback-fixture)
    ;<  sent=(list card)  bind:m  send-private
    =/  request  (snag 0 (requests sent))
    ;<  retried=(list card)  bind:m  (do-response wire.request fallback-failed)
    ;<  late=(list card)  bind:m  (do-response wire.request fallback-failed)
    ;<  ~  bind:m  (ex-equal !>((reports sent)) !>(~))
    ;<  ~  bind:m  (ex-equal !>((lent (reports retried))) !>(1))
    (ex-equal !>((reports late)) !>(~))
  ::
    %-  eval-mare
    =/  m  (mare ,~)
    ^-  form:m
    ;<  ~  bind:m  (setup ~2026.9.17 fallback-fixture)
    ;<  sent=(list card)  bind:m  send-private
    =/  request  (snag 0 (requests sent))
    =/  chunk  (as-octs:mimes:html 'data: {"choices":[{"delta":{"content":"private"}}]}\0a\0a')
    =/  progress=client-response:iris  [%progress [200 ~] p.chunk ~ `chunk]
    ;<  streamed=(list card)  bind:m  (do-response wire.request progress)
    (ex-equal !>((reports streamed)) !>(~))
  ==
++  send-private
  (do-poke %harness-action !>(`action:h`[%send 'fixture' 'private']))
::  Fallback fixture, as in harness-model-routing: a primary model with one
::  backup, and a rate-limited response.
::
++  requests
  |=  cards=(list card)
  ^-  (list http-card:renew)
  %+  murn
    cards
  |=  c=card
  ^-((unit http-card:renew) ?:(?=([%pass [%llm *] %arvo %i %request *] c) `c ~))
++  fallback-fixture
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
++  fallback-failed
  ^-  client-response:iris
  [%finished [429 ~] `['application/json' (as-octs:mimes:html '{"error":"limited"}')]]
--
