/-  *harness-hosted, h=harness, renew=harness-oauth, store=harness-store
/+  *test, hosted=harness-hosted-auth, j=harness-workspace-json, auth=harness-auth,
    storage=harness-store, renewal=harness-oauth
|%
++  now  ~2026.9.17
++  args
  |=(provider=@t (pairs:enjs:format ~[['provider' %s provider] ['requestId' %s 'test-login']]))
++  fixture-start
  ^-  result:hosted
  (run:hosted *state ~ 'start' (args 'openai') now)
++  reply
  |=  [status=@ud body=@t]
  ^-  client-response:iris
  [%finished [status ~] `['application/json' (as-octs:mimes:html body)]]
++  fixture-code
  ^-  result:hosted
  %:  receive:hosted
    db:fixture-start
    keys:fixture-start
    'test-login'
    1
    (reply 200 '{"device_auth_id":"PRIVATE_DEVICE","user_code":"VISIBLE_CODE","interval":"5"}')
    now
  ==
++  fixture-poll
  ^-  result:hosted
  (wake:hosted db:fixture-code keys:fixture-code 'test-login' 1 | (add now ~s5))
++  fixture-exchange
  ^-  result:hosted
  %:  receive:hosted
    db:fixture-poll
    keys:fixture-poll
    'test-login'
    2
    (reply 200 '{"authorization_code":"PRIVATE_CODE","code_verifier":"PRIVATE_VERIFIER"}')
    (add now ~s6)
  ==
++  fixture-verify
  ^-  result:hosted
  %:  receive:hosted
    db:fixture-exchange
    keys:fixture-exchange
    'test-login'
    3
    (reply 200 '{"access_token":"PRIVATE_ACCESS","refresh_token":"PRIVATE_REFRESH"}')
    (add now ~s7)
  ==
++  fixture-done
  ^-  result:hosted
  %:  receive:hosted
    db:fixture-verify
    keys:fixture-verify
    'test-login'
    4
    (reply 200 '{"models":[{"slug":"fixture-model","display_name":"Fixture"}]}')
    (add now ~s8)
  ==
++  test-model-catalog-allows-large-provider-metadata
  =/  body
    %:  rap
      3
      '{"models":[{"slug":"fixture-model","display_name":"Fixture","base_instructions":"'
      (crip (reap 320.000 'x'))
      '"}]}'
      ~
    ==
  =/  done
    %:  receive:hosted
      db:fixture-verify
      keys:fixture-verify
      'test-login'
      4
      (reply 200 body)
      (add now ~s8)
    ==
  =/  expected  [%a ~[(pairs:enjs:format ~[['id' %s 'fixture-model'] ['name' %s 'Fixture']])]]
  =/  catalog  (~(get by catalogs.db.done) 'openai')
  ;:  weld
      (expect-eq !>(%done) !>(phase:(~(got by flows.db.done) 'test-login')))
      (expect-eq !>('PRIVATE_ACCESS') !>((key:auth keys.done 'openai-device')))
      (expect-eq !>(expected) !>(?~(catalog ~ models.u.catalog)))
  ==
++  test-model-catalog-remains-bounded-and-does-not-save-credentials
  =/  response=client-response:iris
    [%finished [200 ~] `['application/json' [2.097.153 '{}']]]
  =/  failed
    %:  receive:hosted
      db:fixture-verify
      keys:fixture-verify
      'test-login'
      4
      response
      (add now ~s8)
    ==
  =/  f  (~(got by flows.db.failed) 'test-login')
  ;:  weld
      (expect-eq !>(%error) !>(phase.f))
      (expect-eq !>('Provider model catalog exceeds the 2 MiB limit.') !>(error.f))
      (expect-eq !>(~) !>(keys.failed))
      (expect-eq !>(~) !>(catalogs.db.failed))
      (expect-eq !>(['' '' '']) !>([token.f refresh.f account.f]))
  ==
++  test-token-response-retains-its-smaller-budget
  =/  response=client-response:iris
    [%finished [200 ~] `['application/json' [262.145 '{}']]]
  =/  failed
    %:  receive:hosted
      db:fixture-exchange
      keys:fixture-exchange
      'test-login'
      3
      response
      (add now ~s7)
    ==
  ;:  weld
      %+  expect-eq
        !>('Provider authentication response exceeds the 256 KiB limit.')
      !>(error:(~(got by flows.db.failed) 'test-login'))
      (expect-eq !>(~) !>(keys.failed))
  ==
++  test-invalid-token-response-identifies-the-stage-without-secrets
  =/  failed
    %:  receive:hosted
      db:fixture-exchange
      keys:fixture-exchange
      'test-login'
      3
      (reply 200 '{"access_token":null,"refresh_token":"PRIVATE_REFRESH"}')
      (add now ~s7)
    ==
  ;:  weld
      %+  expect-eq
        !>('Provider returned an invalid token-exchange response.')
      !>(error:(~(got by flows.db.failed) 'test-login'))
      (expect-eq !>(~) !>(keys.failed))
  ==
++  test-malformed-model-catalog-identifies-verification
  =/  failed
    %:  receive:hosted
      db:fixture-verify
      keys:fixture-verify
      'test-login'
      4
      (reply 200 'PRIVATE_PROVIDER_BODY')
      (add now ~s8)
    ==
  ;:  weld
      %+  expect-eq
        !>('Provider returned an invalid model catalog while verifying the login.')
      !>(error:(~(got by flows.db.failed) 'test-login'))
      (expect-eq !>(~) !>(keys.failed))
  ==
++  test-server-flow-commits-only-after-verification
  ;:  weld
      (expect-eq !>(%poll) !>(phase:(~(got by flows.db:fixture-code) 'test-login')))
      (expect-eq !>(%exchange) !>(phase:(~(got by flows.db:fixture-exchange) 'test-login')))
      (expect-eq !>(%verify) !>(phase:(~(got by flows.db:fixture-verify) 'test-login')))
      (expect-eq !>(~) !>(keys:fixture-verify))
      (expect-eq !>('PRIVATE_ACCESS') !>((key:auth keys:fixture-done 'openai-device')))
      (expect-eq !>('PRIVATE_REFRESH') !>((key:auth keys:fixture-done 'openai-refresh')))
      (expect-eq !>(%done) !>(phase:(~(got by flows.db:fixture-done) 'test-login')))
      (expect-eq !>('') !>(token:(~(got by flows.db:fixture-done) 'test-login')))
  ==
++  test-status-and-flow-never-return-secrets
  =/  flow  (public-flow:hosted 'test-login' (~(got by flows.db:fixture-verify) 'test-login') now)
  =/  status  (status:hosted db:fixture-done keys:fixture-done *state:renew *state:renew now)
  =/  body  (need (get:j status 'body'))
  ;:  weld
      (expect-eq !>(~) !>((get:j flow 'token')))
      (expect-eq !>(~) !>((get:j flow 'device')))
      (expect-eq !>(~) !>((get:j flow 'refresh')))
      (expect-eq !>(~) !>((get:j body 'keys')))
      (expect-eq !>('authenticating') !>((string:j flow 'status')))
  ==
++  test-verification-keeps-temporary-credential-at-renewal-boundary
  =/  result  (filter:renewal cards:fixture-verify *state:renew ~ now 'openai')
  ;:  weld
      (expect-eq !>(cards:fixture-verify) !>(cards.result))
      (expect-eq !>(~) !>(failed.result))
      (expect-eq !>(~) !>(keys.result))
  ==
++  test-start-retry-is-idempotent
  =/  retry  (run:hosted db:fixture-start keys:fixture-start 'start' (args 'openai') now)
  ;:  weld
      (expect-eq !>(db:fixture-start) !>(db.retry))
      (expect-eq !>(~) !>(cards.retry))
  ==
++  test-disconnect-fences-late-token-response
  =/  cleared
    %:  run:hosted
      db:fixture-exchange
      keys:fixture-exchange
      'disconnect'
      (args 'openai')
      now
    ==
  =/  late
    %:  receive:hosted
      db.cleared
      keys.cleared
      'test-login'
      3
      (reply 200 '{"access_token":"MUST_NOT_SAVE"}')
      now
    ==
  ;:  weld
      (expect-eq !>(keys.cleared) !>(keys.late))
      (expect-eq !>(~) !>(flows.db.late))
      (expect-eq !>(~) !>(cards.late))
  ==
++  test-poll-pending-is-not-an-authentication-failure
  =/  pending
    %:  receive:hosted
      db:fixture-poll
      keys:fixture-poll
      'test-login'
      2
      (reply 403 'PRIVATE_PROVIDER_BODY')
      now
    ==
  ;:  weld
      (expect-eq !>(%poll) !>(phase:(~(got by flows.db.pending) 'test-login')))
      (expect-eq !>(1) !>((lent cards.pending)))
      (expect-eq !>(~) !>(keys.pending))
  ==
++  test-timeout-fences-late-response
  =/  timed  (wake:hosted db:fixture-start keys:fixture-start 'test-login' 1 & (add now ~s31))
  =/  late
    %:  receive:hosted
      db.timed
      keys.timed
      'test-login'
      1
      (reply 200 '{"device_auth_id":"late","user_code":"late"}')
      (add now ~s32)
    ==
  (expect-eq !>(db.timed) !>(db.late))
++  test-deadline-fences-response-before-watchdog-delivery
  =/  late
    %:  receive:hosted
      db:fixture-start
      keys:fixture-start
      'test-login'
      1
      (reply 200 '{"device_auth_id":"late","user_code":"late"}')
      (add now ~s31)
    ==
  (expect-eq !>(%error) !>(phase:(~(got by flows.db.late) 'test-login')))
++  test-failure-does-not-publish-provider-body
  =/  failed
    %:  receive:hosted
      db:fixture-start
      keys:fixture-start
      'test-login'
      1
      (reply 500 'PRIVATE_TOKEN')
      now
    ==
  %+  expect-eq
    !>('Provider rejected authentication. Check your login and try again.')
  !>(error:(~(got by flows.db.failed) 'test-login'))
++  test-unknown-provider-does-not-emit-network-work
  =/  result  (run:hosted *state ~ 'start' (args 'unknown') now)
  (expect-eq !>(~) !>(cards.result))
++  test-setup-token-isolated-from-api-key
  =/  keys  (my ~[['anthropic' 'API_KEY'] ['anthropic-device' 'SETUP_TOKEN']])
  =/  cleared  (run:hosted *state keys 'disconnect' (args 'anthropic') now)
  ;:  weld
      (expect-eq !>('API_KEY') !>((key:auth keys.cleared 'anthropic')))
      (expect-eq !>('') !>((key:auth keys.cleared 'anthropic-device')))
  ==
++  test-setup-token-submission-retry-does-not-repeat-verification
  =/  started  (run:hosted *state ~ 'start' (args 'anthropic') now)
  =/  token  (cat 3 'sk-ant-oat01-' (crip (reap 80 'a')))
  =/  input  (pairs:enjs:format ~[['flowId' %s 'test-login'] ['token' %s token]])
  =/  sent  (run:hosted db.started keys.started 'complete' input now)
  =/  retry  (run:hosted db.sent keys.sent 'complete' input now)
  =/  verified
    %:  receive:hosted
      db.sent
      keys.sent
      'test-login'
      1
      (reply 200 '{"data":[{"id":"fixture-model"}]}')
      now
    ==
  =/  receipt  (run:hosted db.verified keys.verified 'complete' input now)
  ;:  weld
      (expect-eq !>(db.sent) !>(db.retry))
      (expect-eq !>(~) !>(cards.retry))
      (expect-eq !>(token) !>((key:auth keys.receipt 'anthropic-device')))
      (expect-eq !>(200) !>((number:j response.receipt 'status' 0)))
  ==
++  test-request-id-bounds-and-alphabet
  %-  zing
  %+  turn
    :~  ['' 400]
        ['Uppercase' 400]
        ['path/segment' 400]
        ['has_space' 400]
        [(crip (reap 129 'a')) 400]
        [(crip (reap 128 'a')) 202]
        ['login-01.retry' 202]
    ==
  |=  [id=@t expected=@ud]
  =/  input
    (pairs:enjs:format ~[['provider' %s 'openai'] ['requestId' %s id]])
  =/  result  (run:hosted *state ~ 'start' input now)
  ;:  weld
      (expect-eq !>(expected) !>((number:j response.result 'status' 0)))
      (expect-eq !>(?:(=(202 expected) 2 0)) !>((lent cards.result)))
      (expect-eq !>(?:(=(202 expected) 1 0)) !>(~(wyt by flows.db.result)))
  ==
++  test-credential-change-fences-verification
  %-  zing
  %+  turn  `(list @t)`~['openai-device' 'openai-refresh' 'openai-account']
  |=  slot=@t
  =/  changed  (~(put by keys:fixture-verify) slot 'REPLACEMENT')
  =/  result
    %:  receive:hosted
      db:fixture-verify
      changed
      'test-login'
      4
      (reply 200 '{"models":[]}')
      (add now ~s8)
    ==
  =/  login  (~(got by flows.db.result) 'test-login')
  ;:  weld
      (expect-eq !>(changed) !>(keys.result))
      (expect-eq !>(~) !>(catalogs.db.result))
      (expect-eq !>(~) !>(cards.result))
      (expect-eq !>(%error) !>(phase.login))
      (expect-eq !>('Login expired or credentials changed. Start a new login.') !>(error.login))
      (expect-eq !>(['' '' '' '']) !>([device.login token.login refresh.login account.login]))
  ==
--
