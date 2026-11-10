/-  *harness-hosted, renew=harness-oauth, h=harness, store=harness-store
/+  *test, hosted=harness-hosted-auth, oa=harness-oauth, auth=harness-auth,
    settings=harness-hosted-settings, hp=harness-provider, j=harness-workspace-json,
    storage=harness-store
|%
++  now  ~2026.9.17
++  args  (pairs:enjs:format ~[['provider' %s 'xai'] ['requestId' %s 'xai-test']])
++  reply
  |=  [status=@ud body=@t]
  ^-  client-response:iris
  [%finished [status ~] `['application/json' (as-octs:mimes:html body)]]
++  started  (run:hosted *state ~ 'start' args now)
++  code
  %:  receive:hosted
    db:started
    ~
    'xai-test'
    1
    %+  reply
      200
    '{"device_code":"SECRET_DEVICE","user_code":"ABCD-1234","verification_uri":"https://accounts.x.ai/oauth2/device","expires_in":1800,"interval":5}'
    now
  ==
++  poll  (wake:hosted db:code ~ 'xai-test' 1 | (add now ~s5))
++  verify
  %:  receive:hosted
    db:poll
    ~
    'xai-test'
    2
    %+  reply
      200
    '{"access_token":"OPAQUE_ACCESS","refresh_token":"SECRET_REFRESH","expires_in":3600}'
    (add now ~s6)
  ==
++  done
  %:  receive:hosted
    db:verify
    ~
    'xai-test'
    3
    %+  reply
      200
    '{"data":[{"id":"grok-build","name":"Grok Build","api_backend":"responses"},{"id":"grok-imagine-image","api_backend":"image"}]}'
    (add now ~s7)
  ==
++  test-device-flow-verifies-before-saving-and-redacts-secrets
  =/  f  (~(got by flows.db:done) 'xai-test')
  =/  catalog  (~(got by catalogs.db:done) 'xai')
  =/  expected  [%a ~[(pairs:enjs:format ~[['id' %s 'grok-build'] ['name' %s 'Grok Build']])]]
  ;:  weld
      (expect-eq !>(~) !>(keys:verify))
      (expect-eq !>(%done) !>(phase.f))
      (expect-eq !>('OPAQUE_ACCESS') !>((key:auth keys:done 'xai-device')))
      (expect-eq !>('SECRET_REFRESH') !>((key:auth keys:done 'xai-refresh')))
      (expect-eq !>(`(add now (add ~s6 ~h1))) !>((saved-expiry:oa keys:done 'xai')))
      (expect-eq !>(['' '' '']) !>([device.f token.f refresh.f]))
      (expect-eq !>(expected) !>(models.catalog))
      (expect-eq !>(~) !>((get:j (public-flow:hosted 'xai-test' f now) 'token')))
  ==
++  test-grok-model-catalog-uses-model-ids-and-excludes-nonchat-modes
  =/  body
    '{"data":[{"model":"grok-build","name":"Grok Build","api_backend":"responses"},{"id":"grok-imagine-image"},{"id":"grok-multi-agent"}]}'
  =/  out  (receive:hosted db:verify ~ 'xai-test' 3 (reply 200 body) (add now ~s7))
  =/  models  (parse-model-list:hp (need (de:json:html body)))
  ;:  weld
      (expect-eq !>(~[['grok-build' ~]]) !>(models))
      %+  expect-eq
        !>(models:(~(got by catalogs.db:done) 'xai'))
      !>(models:(~(got by catalogs.db.out) 'xai'))
  ==
++  test-device-request-and-poll-use-xai-form-endpoints
  =/  raw  (snag 0 cards:started)
  ?>  ?=([%pass * %arvo %i %request *] raw)
  =/  request=http-card:renew  raw
  =/  raw  (snag 0 cards:poll)
  ?>  ?=([%pass * %arvo %i %request *] raw)
  =/  polling=http-card:renew  raw
  ;:  weld
      (expect-eq !>('https://auth.x.ai/oauth2/device/code') !>(url.request.request))
      (expect-eq !>('https://auth.x.ai/oauth2/token') !>(url.request.polling))
      (expect-eq !>([0 0]) !>(outbound-config.request))
  ==
++  test-pending-and-slow-down-remain-pollable
  =/  pending
    %:  receive:hosted
      db:poll
      ~
      'xai-test'
      2
      (reply 400 '{"error":"authorization_pending"}')
      (add now ~s6)
    ==
  =/  slow
    %:  receive:hosted
      db:poll
      ~
      'xai-test'
      2
      (reply 400 '{"error":"slow_down"}')
      (add now ~s6)
    ==
  =/  f  (~(got by flows.db.slow) 'xai-test')
  =/  again  (wake:hosted db.slow ~ 'xai-test' 2 | (add now ~s16))
  ;:  weld
      (expect-eq !>(%poll) !>(phase:(~(got by flows.db.pending) 'xai-test')))
      (expect-eq !>(10) !>(interval.f))
      (expect-eq !>(1) !>((lent cards.slow)))
      (expect-eq !>(2) !>((lent cards.again)))
  ==
++  test-denial-expiry-and-malformed-tokens-do-not-save
  %-  zing
  %+  turn
    ^-  (list [@ud @t])
    :~  [400 '{"error":"access_denied"}']  [400 '{"error":"expired_token"}']
        [200 '{"access_token":"PRIVATE","expires_in":3600}']
        [200 '{"access_token":"PRIVATE","refresh_token":"PRIVATE","expires_in":0}']
    ==
  |=  [status=@ud body=@t]
  =/  out  (receive:hosted db:poll ~ 'xai-test' 2 (reply status body) (add now ~s6))
  ;:  weld
      (expect-eq !>(%error) !>(phase:(~(got by flows.db.out) 'xai-test')))
      (expect-eq !>(~) !>(keys.out))
  ==
++  test-verification-uri-is-pinned
  =/  out
    %:  receive:hosted
      db:started
      ~
      'xai-test'
      1
      %+  reply
        200
      '{"device_code":"PRIVATE","user_code":"CODE","verification_uri":"https://accounts.x.ai.evil.test/oauth2/device","expires_in":1800}'
      now
    ==
  (expect-eq !>(%error) !>(phase:(~(got by flows.db.out) 'xai-test')))
++  test-disconnect-preserves-api-key-and-fences-late-response
  =/  keys  (~(put by keys:done) 'xai' 'API_KEY')
  =/  cleared  (run:hosted db:done keys 'disconnect' args now)
  =/  late  (receive:hosted db.cleared keys.cleared 'xai-test' 3 (reply 200 '{"data":[]}') now)
  ;:  weld
      (expect-eq !>('API_KEY') !>((key:auth keys.late 'xai')))
      (expect-eq !>('') !>((key:auth keys.late 'xai-device')))
      (expect-eq !>('') !>((key:auth keys.late 'xai-refresh')))
      (expect-eq !>(~) !>(cards.late))
  ==
++  request
  ^-  http-card:renew
  :*  %pass  /llm/xai/0/turn  %arvo  %i  %request
      :*  %'POST'  xai-url:auth
          ~[['authorization' 'Bearer stale'] ['chatgpt-account-id' 'WRONG_ACCOUNT']]
          `(as-octs:mimes:html '{}')
      ==
      [0 0]
  ==
++  test-renewal-coalesces-and-rotates-only-xai-credentials
  =/  req=http-card:renew  request
  =/  keys  (~(put by keys:done) 'openai-device' 'KEEP_OPENAI')
  =/  due  (add now ~h1)
  =/  waiting  (filter:oa ~[req req(wire /models/1)] *state:renew keys due 'xai')
  =/  out
    %:  receive:oa
      oauth.waiting
      keys
      due
      1
      (reply 200 '{"access_token":"FRESH","refresh_token":"ROTATED","expires_in":3600}')
      'xai'
    ==
  =/  sent=http-card:renew  ;;(http-card:renew (snag 0 cards.out))
  ;:  weld
      (expect-eq !>(2) !>((lent cards.waiting)))
      (expect-eq !>(2) !>((lent cards.out)))
      (expect-eq !>('KEEP_OPENAI') !>((key:auth keys.out 'openai-device')))
      (expect-eq !>('FRESH') !>((key:auth keys.out 'xai-device')))
      (expect-eq !>('ROTATED') !>((key:auth keys.out 'xai-refresh')))
      (expect-eq !>(~[['authorization' 'Bearer FRESH']]) !>(header-list.request.sent))
      (expect-eq !>(~) !>(waiting.oauth.out))
  ==
++  test-xai-renewal-does-not-touch-api-or-openai-requests
  =/  req=http-card:renew  request
  =/  incoming
    ~[req(url.request 'https://api.x.ai/v1/chat/completions') req(url.request device-url:auth)]
  =/  out  (filter:oa incoming *state:renew keys:done (add now ~h1) 'xai')
  (expect-eq !>(incoming) !>(cards.out))
++  test-disconnected-refresh-cannot-restore-a-login
  =/  due  (add now ~h1)
  =/  first  (filter:oa ~[request] *state:renew keys:done due 'xai')
  =/  disconnected  (run:hosted db:done keys:done 'disconnect' args due)
  =/  late
    %:  receive:oa
      oauth.first
      keys.disconnected
      due
      1
      (reply 200 '{"access_token":"MUST_NOT_SAVE","expires_in":3600}')
      'xai'
    ==
  (expect-eq !>(keys.disconnected) !>(keys.late))
++  test-server-failure-does-not-resend-rotating-token
  =/  due  (add now ~h1)
  =/  first  (filter:oa ~[request] *state:renew keys:done due 'xai')
  =/  failed  (receive:oa oauth.first keys:done due 1 (reply 503 'PRIVATE') 'xai')
  =/  again  (filter:oa ~[request] oauth.failed keys.failed (add due ~m2) 'xai')
  (expect !>(&(terminal.oauth.again =(~ cards.again) =(keys:done keys.again))))
++  test-expired-access-token-remains-connected-when-renewable
  =/  status  (status:hosted db:done keys:done *state:renew *state:renew (add now ~h2))
  =/  body  (need (get:j status 'body'))
  =/  providers  (need (get:j body 'providers'))
  ?>  ?=(%a -.providers)
  %-  expect
  !>  %+  lien
        p.providers
      |=(row=json &(=('xai' (string:j row 'provider')) =('expiring' (string:j row 'status'))))
++  test-xai-uses-responses-for-inference-and-stream-decoding
  =/  v=view:h  *view:h
  =.  config.v
    :*  |  ~  'https://cli-chat-proxy.grok.com/v1/responses'  'grok-build'  ''  ~
        'Answer the question.'  80.000  ~
    ==
  =.  items.v  ~[[%user 'What is two plus two?']]
  =/  body  (payload:hp v %turn ~)
  =/  response
    %-  parse-responses-sse:hp
    'data: {"type":"response.output_item.done","item":{"type":"message","content":[{"text":"4"}]}}\0adata: {"type":"response.completed","response":{"usage":{"input_tokens":6,"output_tokens":1}}}\0a'
  ;:  weld
      (expect-eq !>('grok-build') !>((string:j body 'model')))
      (expect-eq !>(~) !>((get:j body 'messages')))
      (expect-eq !>([%& %stop [6 1] [%assistant '4' ~]]) !>(response))
  ==
++  test-refresh-timeout-is-terminal-and-fences-late-success
  =/  due  (add now ~h1)
  =/  first  (filter:oa ~[request] *state:renew keys:done due 'xai')
  =/  late
    %:  receive:oa
      oauth.first
      keys:done
      (add due ~s31)
      1
      (reply 200 '{"access_token":"MUST_NOT_SAVE","expires_in":3600}')
      'xai'
    ==
  =/  retry  (filter:oa ~[request] oauth.late keys.late (add due ~m2) 'xai')
  ;:  weld
      (expect !>(terminal.oauth.late))
      (expect-eq !>(keys:done) !>(keys.late))
      (expect-eq !>(~) !>(cards.retry))
      (expect-eq !>(1) !>((lent failed.retry)))
  ==
++  test-hosted-settings-select-matching-credential-and-transport
  =/  cfg=config:h  *config:h
  =/  input
    %-  pairs:enjs:format
    :~  ['revision' %s (revision:settings cfg)]  ['provider' %s 'xai']  ['model' %s 'grok-build']
        ['auth' %s 'subscription']
    ==
  =/  out  (apply:settings cfg keys:done input)
  =/  body  (need (get:j response.out 'body'))
  ;:  weld
      (expect-eq !>(xai-url:auth) !>(url.config.out))
      (expect-eq !>('xai-device') !>((credential-for-config:auth config.out)))
      (expect-eq !>('subscription') !>((string:j body 'auth')))
      (expect !>((responses-route:hp url.config.out)))
  ==
--
