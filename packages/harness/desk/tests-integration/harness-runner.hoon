::  Public transport exercises the full head without executing outbound cards.
/-  *harness-store, r=harness-runner, h=harness
/+  *test-agent, j=harness-provider-wire, hl=harness, policy=harness-defaults,
    runner=harness-runner
/=  head  /app/harness
/=  seed  /tests/harness-runner
|%
++  t0  ~2026.10.1
++  saved
  ^-  state-0
  =/  s=state-0  *state-0
  s(runners issued:seed, local-mcp-seen 1)
::  Load from saved state. Every scry answers %.n, as the old sandbox did.
::
++  setup
  |=  initial=state-0
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now t0)))
  ;<  ~  bind:m  (set-scry-gate |=(path `!>(|)))
  ;<  *  bind:m  (do-load head `!>(initial))
  (pure:m ~)
::  Several checks branch from one point: take the whole test state and
::  return to it afterwards.
::
++  snapshot
  =/  m  (mare state)
  ^-  form:m
  |=(s=state &+[s s])
++  restore
  |=  =state
  (jab-state |=(* state))
++  get-state
  =/  m  (mare ,state-0)
  ^-  form:m
  ;<  =vase  bind:m  get-save
  (pure:m !<(state-0 vase))
++  request
  |=  body=@t
  ^-  inbound-request:eyre
  :*  |  |  [%ipv4 .127.0.0.1]
      :*  %'POST'  '/harness/runners/laptop/events'
          ~[['authorization' (cat 3 'Bearer ' key:seed)] ['content-type' 'application/json']]
          `(as-octs:mimes:html body)
      ==
  ==
++  do-http
  |=  [id=@ta req=inbound-request:eyre]
  (do-poke %handle-http-request !>([id req]))
++  code
  |=  cards=(list card)
  ^-  @ud
  =/  headers
    %+  murn  cards
    |=  c=card
    ?.  ?=([%give %fact * %http-response-header *] c)  ~
    =/  [give=* fact=* paths=* mark=* data=vase]  c
    `!<(response-header:http data)
  status-code:(snag 0 headers)
++  test-transport-key-origin-tls-path-version-and-sequence
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~             bind:m  (setup saved)
  ;<  loaded=state  bind:m  snapshot
  =/  req  (request '{"version":1,"sequence":1,"type":"ack","through":0}')
  =/  cases=(list [inbound-request:eyre @ud])
    :~  [req 200]
        [req(header-list.request ~[['cookie' 'urbauth-~zod=not-a-key']]) 401]
        [req(header-list.request [['origin' 'null'] ['Origin' 'null'] header-list.request.req]) 403]
        [req(address [%ipv4 .10.0.0.1]) 403]
        [req(address [%ipv4 .10.0.0.1], secure &) 200]
        [req(url.request '/harness/runners/laptop/events?key=no') 404]
        [(request '{"version":2,"sequence":1,"type":"ack","through":0}') 400]
        [(request '{"version":1,"sequence":2,"type":"ack","through":0}') 409]
    ==
  (pose-cases loaded cases)
::  Each case is posed to the freshly loaded agent.
::
++  pose-cases
  |=  [loaded=state cases=(list [inbound-request:eyre @ud])]
  =/  m  (mare ,~)
  ^-  form:m
  ?~  cases  (pure:m ~)
  ;<  ~                bind:m  (restore loaded)
  ;<  caz=(list card)  bind:m  (do-http %fixture -.i.cases)
  ;<  ~                bind:m  (ex-equal !>((code caz)) !>(+.i.cases))
  (pose-cases loaded t.cases)
++  test-native-dispatch-reply-replay-and-cancel
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  cfg  builtin-config:policy
  =.  cfg  cfg(url 'connected://laptop', model '', tools ~[%web])
  =/  initial  saved
  =.  initial
    initial(defaults cfg, sessions (my ~[['channel' [~[[%config-replaced cfg]] 0]]]))
  ;<  ~                bind:m  (setup initial)
  ;<  sent=(list card)  bind:m  (do-poke %harness-action !>(`action:h`[%send 'channel' 'Hello']))
  =/  submits
    %+  murn  sent
    |=  c=card
    ?.  ?=([%pass * %agent * %poke %harness-runner-request *] c)  ~
    =/  [pass=* wire=* agent=* who=* poke=* mark=* data=vase]  c
    `!<(request:r data)
  ;<  ~  bind:m  (ex-equal !>((lent submits)) !>(1))
  ?>  ?=(^ submits)
  =/  job  i.submits
  ;<  *  bind:m  (do-poke %harness-runner-request !>(job))
  ;<  queued=state      bind:m  snapshot
  ;<  queue-state=state-0  bind:m  get-state
  =/  envelope  (~(got by events:(~(got by registry.runners.queue-state) 'laptop')) 1)
  =/  event
    |=  [sequence=@ud type=@t]
    %-  pairs:enjs:format
    :~  ['version' %n '1']
        ['sequence' (numb:enjs:format sequence)]
        ['type' %s type]
        ['attemptId' %s attempt.job]
        ['conversationId' %s 'channel']
        ['turnId' %s (scot %ud req.job)]
    ==
  =/  claim  (request (en:json:html (event 1 'claim')))
  ;<  claimed=(list card)  bind:m  (do-http %fixture claim)
  ;<  after-claim=state    bind:m  snapshot
  ;<  again=(list card)    bind:m  (do-http %fixture claim)
  ::  Reply and replay, continuing after the repeated claim.
  =/  delta  (put:j (event 2 'delta') 'text' [%s 'Hello 🙂'])
  ;<  *                    bind:m  (do-http %fixture (request (en:json:html delta)))
  ;<  streaming=state-0    bind:m  get-state
  =/  complete
    %^  put:j
      (event 3 'complete')
      'response'
    %-  need
    %-  de:json:html
    '{"choices":[{"finish_reason":"stop","message":{"role":"assistant","content":"Hello back"}}]}'
  ;<  done=(list card)      bind:m  (do-http %fixture (request (en:json:html complete)))
  ;<  repeated=(list card)  bind:m  (do-http %fixture (request (en:json:html complete)))
  ;<  final=state-0         bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>((str:j envelope 'type')) !>('prompt'))
  ;<  ~  bind:m  (ex-equal !>((code claimed)) !>(200))
  ;<  ~  bind:m  (ex-equal !>((code again)) !>(200))
  ;<  ~  bind:m
    %+  ex-equal
      !>((~(got by streams.streaming) ['channel' req.job]))
    !>(`stream-progress`['Hello 🙂' 10])
  ;<  ~  bind:m  (ex-equal !>(~(wyt by streams.final)) !>(0))
  ;<  ~  bind:m  (ex-equal !>((code done)) !>(200))
  ;<  ~  bind:m  (ex-equal !>((code repeated)) !>(200))
  ;<  ~  bind:m
    %+  ex-equal
      !>((rear items:(play:hl log:(~(got by sessions.final) 'channel'))))
    !>(`item:h`[%assistant 'Hello back' ~])
  ;<  ~  bind:m  (ex-equal !>(~(wyt by jobs.runners.final)) !>(0))
  ::  Cancel a job parked on a tool call, from the first claim.
  =/  tool-complete
    %^  put:j
      (event 2 'complete')
      'response'
    %-  need
    %-  de:json:html
    '{"choices":[{"finish_reason":"tool_calls","message":{"role":"assistant","content":"","tool_calls":[{"id":"fetch","type":"function","function":{"name":"http_fetch","arguments":"{\\"url\\":\\"https://example.test\\"}"}}]}}]}'
  ;<  ~                       bind:m  (restore after-claim)
  ;<  *                       bind:m  (do-http %fixture (request (en:json:html tool-complete)))
  ;<  parked-state=state-0    bind:m  get-state
  ;<  *                       bind:m  (do-poke %harness-action !>(`action:h`[%cancel 'channel']))
  ;<  parked-stopped=state-0  bind:m  get-state
  ::  Cancel a queued job before any claim.
  ;<  ~                       bind:m  (restore queued)
  ;<  *                       bind:m  (do-poke %harness-action !>(`action:h`[%cancel 'channel']))
  ;<  stopped-state=state-0   bind:m  get-state
  ::  Revoking the runner and reloading drops its jobs.
  =/  revoked  (owner:runner runners.queue-state 'revoke' args:seed t0)
  ?>  ?=(%& -.revoked)
  ;<  *                       bind:m  (do-load head `!>(queue-state(runners db.p.revoked)))
  ;<  revoke-state=state-0    bind:m  get-state
  ;<  ~  bind:m
    (ex-equal !>(parked:(~(got by jobs.runners.parked-state) attempt.job)) !>(&))
  ;<  ~  bind:m  (ex-equal !>(~(wyt by jobs.runners.parked-stopped)) !>(0))
  ;<  ~  bind:m
    %+  ex-equal
      !>((str:j (~(got by events:(~(got by registry.runners.parked-stopped) 'laptop')) 2) 'type'))
    !>('cancel')
  ;<  ~  bind:m  (ex-equal !>(~(wyt by jobs.runners.stopped-state)) !>(0))
  ;<  ~  bind:m
    %+  ex-equal
      !>((str:j (~(got by events:(~(got by registry.runners.stopped-state) 'laptop')) 2) 'type'))
    !>('cancel')
  (ex-equal !>(~(wyt by jobs.runners.revoke-state)) !>(0))
::
++  test-expired-job-notifies-hands-once
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  config  builtin-config:policy
  =.  config  config(url 'connected://laptop', model '', tools ~)
  =/  events=(list event:h)
    :~  [%llm-routed 0 config]
        [%llm-requested 0 %turn]
        [%input-admitted [%user 'Hello']]
        [%config-replaced config]
    ==
  =/  job=request:r  ['laptop' 'timeout' 0 %turn 'attempt' (sham events) ~]
  =/  initial  saved
  =.  sessions.initial  (~(put by sessions.initial) 'timeout' [events 1])
  =.  jobs.runners.initial
    (~(put by jobs.runners.initial) 'attempt' [job (sub t0 ~m31) | |])
  ;<  ~                 bind:m  (setup initial)
  ;<  running=state-0   bind:m  get-state
  ;<  ~  bind:m  (ex-equal !>(?=(^ wake.runners.running)) !>(&))
  ?>  ?=(^ wake.runners.running)
  =/  at  u.wake.runners.running
  ;<  ~                    bind:m  (jab-bowl |=(b=bowl b(now at)))
  ;<  expired=(list card)  bind:m  (do-arvo /runner-wake/(scot %da at) [%behn %wake ~])
  ;<  final=state-0        bind:m  get-state
  =/  notifications
    %+  skim  expired
    |=  =card
    ?=([%give %fact [[%hand-events ~] ~] %noun *] card)
  =/  view  (play:hl log:(~(got by sessions.final) 'timeout'))
  ;<  ~  bind:m  (ex-equal !>((lent notifications)) !>(1))
  ;<  ~  bind:m  (ex-equal !>(~(wyt by jobs.runners.final)) !>(0))
  ;<  ~  bind:m  (ex-equal !>(pending.view) !>(~))
  (ex-equal !>(?=(^ err.view)) !>(&))
::
++  test-reconnect-replays-after-cursor-and-closes-prior-stream
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  initial  saved
  =/  row  (~(got by registry.runners.initial) 'laptop')
  =.  row
    row(next 4, acknowledged 1, events (my ~[[2 [%s 'two']] [3 [%s 'three']]]))
  =.  registry.runners.initial  (~(put by registry.runners.initial) 'laptop' row)
  =/  connect
    |=  cursor=@t
    =/  inbound  (request '')
    %=  inbound  method.request  %'GET'  body.request  ~  header-list.request
        [['last-event-id' cursor] header-list.request.inbound]
    ==
  ;<  ~                   bind:m  (setup initial)
  ;<  *                   bind:m  (do-http %first (connect '1'))
  ;<  second=(list card)  bind:m  (do-http %second (connect '2'))
  ;<  final=state-0       bind:m  get-state
  ;<  connected-at=state  bind:m  snapshot
  =/  connected  (~(got by registry.runners.final) 'laptop')
  =/  data
    (as-octs:mimes:html (cat 3 ': connected\0a\0a' (frame:runner 3 [%s 'three'])))
  =/  transport
    %+  skim  second
    |=  =card
    ?=(%give -.card)
  ;<  stale=(list card)   bind:m  (do-http %stale (connect '0'))
  ;<  unchanged=state-0   bind:m  get-state
  ;<  ~                   bind:m  (restore connected-at)
  ;<  future=(list card)  bind:m  (do-http %future (connect '4'))
  ;<  ~  bind:m
    %+  ex-cards  transport
    :~  (ex-card [%give %fact ~[/http-response/first] %http-response-data !>(`(unit octs)`~)])
        (ex-card [%give %kick ~[/http-response/first] ~])
        %-  ex-card
        :*  %give  %fact  ~[/http-response/second]  %http-response-header
            !>  ^-  response-header:http
                :-  200
                :~  ['content-type' 'text/event-stream']
                    ['cache-control' 'no-store']
                    ['x-accel-buffering' 'no']
                ==
        ==
        %-  ex-card
        [%give %fact ~[/http-response/second] %http-response-data !>(`(unit octs)`(some data))]
    ==
  ;<  ~  bind:m  (ex-equal !>((need stream.connected)) !>(`@ta`%second))
  ;<  ~  bind:m  (ex-equal !>(events.connected) !>(events.row))
  ;<  ~  bind:m  (ex-equal !>((code stale)) !>(409))
  ;<  ~  bind:m  (ex-equal !>((code future)) !>(409))
  (ex-equal !>(runners.unchanged) !>(runners.final))
--
