/-  h=harness
/+  *test, auth=harness-auth
|%
++  fixture
  ^-  (map @t @t)
  %-  my
  :~  ['openai' 'sk-fixture-api']  ['openai-device' 'fixture-device-token']
      ['openai-account' 'fixture-account']
  ==
++  test-openai-credentials-are-isolated
  %-  expect
  !>  ?&  =('sk-fixture-api' (key:auth fixture 'openai'))
          =('fixture-device-token' (key:auth fixture 'openai-device'))
          =('openai-device' (credential-for-url:auth device-url:auth))
          =('openai' (credential-for-url:auth 'https://api.openai.com/v1/responses'))
      ==
++  test-shared-device-token-never-becomes-api-key
  =/  keys=(map @t @t)  (my ~[['openai' 'eyJ.fixture.device']])
  %-  expect
  !>(&(=('' (key:auth keys 'openai')) =('eyJ.fixture.device' (key:auth keys 'openai-device'))))
++  test-saving-api-key-preserves-existing-device-login
  =/  keys=(map @t @t)  (my ~[['openai' 'eyJ.fixture.device']])
  =/  next  (put-key:auth keys 'openai' 'sk-fixture-api')
  %-  expect
  !>  ?&  =('sk-fixture-api' (key:auth next 'openai'))
          =('eyJ.fixture.device' (key:auth next 'openai-device'))
      ==
++  test-api-key-is-never-device-fallback
  =/  keys=(map @t @t)  (my ~[['openai' 'sk-fixture-api']])
  (expect-eq !>('') !>((key:auth keys 'openai-device')))
++  test-explicit-empty-device-slot-does-not-resurrect-shared-token
  =/  keys=(map @t @t)  (my ~[['openai' 'eyJ.fixture.device'] ['openai-device' '']])
  (expect-eq !>('') !>((key:auth keys 'openai-device')))
++  test-only-device-route-gets-account-header
  =/  extras=(list [name=@t value=@t])
    ~[['Authorization' 'Bearer wrong'] ['ChatGPT-Account-ID' 'wrong-account'] ['x-extra' 'kept']]
  =/  api  (headers:auth fixture 'https://api.openai.com/v1/responses' extras)
  =/  device  (headers:auth fixture device-url:auth extras)
  %-  expect
  !>  ?&  =(~[['x-extra' 'kept']] api)
          =(~[['chatgpt-account-id' 'fixture-account'] ['x-extra' 'kept']] device)
          =(extras (headers:auth fixture 'https://custom.example' extras))
      ==
++  test-missing-selected-credential-fails-before-dispatch
  =/  cfg=config:h  *config:h
  =.  zdr.cfg  |
  =.  url.cfg  'https://api.openai.com/v1/responses'
  =/  keys=(map @t @t)  (my ~[['openai-device' 'fixture-device']])
  %-  expect
  !>  ?&  ?=(^ (missing:auth keys cfg))  ?=(~ (missing:auth keys cfg(url device-url:auth)))
          ?=(~ (missing:auth ~ cfg(url 'https://custom.example')))
      ==
++  test-anthropic-auth-selection-does-not-cross-credential-slots
  =/  cfg=config:h  *config:h
  =.  zdr.cfg  |
  =.  url.cfg  'https://api.anthropic.com/v1/messages'
  =/  device  cfg(headers ~[['anthropic-beta' 'oauth-2025-04-20']])
  =/  keys  (my ~[['anthropic' 'API_KEY']])
  ;:  weld
      (expect-eq !>('anthropic') !>((credential-for-config:auth cfg)))
      (expect-eq !>('anthropic-device') !>((credential-for-config:auth device)))
      (expect !>(?=(^ (missing:auth keys device))))
      (expect !>(?=(~ (missing:auth keys cfg))))
  ==
++  test-zdr-rejects-direct-provider-dispatch
  =/  cfg=config:h  *config:h
  =.  cfg  cfg(zdr &, url 'https://api.openai.com/v1/responses')
  (expect !>(?=(^ (missing:auth fixture cfg))))
--
