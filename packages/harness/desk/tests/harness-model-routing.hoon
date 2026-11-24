/-  h=harness, *harness-store
/+  *test, routing=harness-model-routing, hp=harness-provider, j=harness-workspace-json,
    hj=harness-json, storage=harness-store, policy=harness-defaults, hl=harness,
    context=harness-model-context
|%
++  test-zdr-is-on-turns-and-checkpoints-and-is-absent-when-disabled
  =/  v  *view:h
  =/  cfg  builtin-config:policy
  =.  config.v  cfg(zdr &, url 'https://openrouter.ai/api/v1/chat/completions')
  =/  expected  (need (de:json:html '{"zdr":true,"data_collection":"deny"}'))
  ;:  weld
      (expect-eq !>(`expected) !>((get:j (payload:hp v %turn ~) 'provider')))
      (expect-eq !>(`expected) !>((get:j (payload:hp v %compaction ~) 'provider')))
      (expect-eq !>(~) !>((get:j (payload:hp v(zdr.config |) %turn ~) 'provider')))
      %+  expect-eq
        !>(~)
      !>  %+  get:j
            (payload:hp v(zdr.config |, url.config 'https://api.openai.com/v1/responses') %turn ~)
          'provider'
  ==
++  test-fallback-consumes-order-and-preserves-privacy-and-authority
  =/  cfg  builtin-config:policy
  =.  zdr.cfg  &
  =.  fallbacks.cfg  ~[['openai' 'direct'] ['openrouter' 'first'] ['openrouter' 'last']]
  =/  keys  (my ~[['openrouter' 'fixture-key'] ['openai' 'fixture-key']])
  =/  first  (need (next:routing cfg keys ~))
  =/  last  (need (next:routing first keys ~))
  ;:  weld
      (expect-eq !>('first') !>(model.first))
      (expect-eq !>('last') !>(model.last))
      (expect-eq !>(~) !>((next:routing last keys ~)))
      (expect !>(zdr.first))
      (expect-eq !>(tools.cfg) !>(tools.first))
      (expect-eq !>(system.cfg) !>(system.first))
      (expect-eq !>('') !>(key.first))
      (expect-eq !>(~) !>(headers.first))
      (expect-eq !>(~) !>((next:routing cfg ~ ~)))
  ==
++  test-routing-json-roundtrip-and-rejects-invalid-chains
  =/  cfg  builtin-config:policy
  =.  cfg  cfg(zdr &, fallbacks ~[['openrouter' 'backup']])
  =/  invalid  (mule |.((parse:routing [%s 'invalid'])))
  =/  unsupported
    %-  mule
    |.((parse:routing (need (de:json:html '[{"provider":"custom","model":"x"}]'))))
  =/  json  (config-json:hj cfg)
  ?>  ?=(%o -.json)
  =.  p.json  (~(put by p.json) 'key' [%s ''])
  ;:  weld
      (expect-eq !>(cfg) !>((json-config:hj json)))
      (expect !>(?=(%| -.invalid)))
      (expect !>(?=(%| -.unsupported)))
  ==
++  test-fallbacks-use-route-catalogs-and-default-only-unknown-capacity
  =/  cfg  builtin-config:policy
  =.  cfg
    %=  cfg  url  'https://openrouter.ai/api/v1/chat/completions'  model  'primary'  fallbacks
        ~[['openrouter' 'large'] ['openrouter' 'small'] ['openrouter' 'unknown']]
    ==
  =/  keys  (my ~[['openrouter' 'fixture-key']])
  =/  catalogs  (remember:context ~ keys 'openrouter' (my ~[['large' 1.000.000] ['small' 32.000]]))
  =/  first  (need (next:routing cfg keys catalogs))
  =/  second  (need (next:routing first keys catalogs))
  =/  third  (need (next:routing second keys catalogs))
  =/  rotated  (~(put by keys) 'openrouter' 'new-account-key')
  ;:  weld
      (expect-eq !>(1.000.000) !>(max-context.first))
      (expect-eq !>(32.000) !>(max-context.second))
      (expect-eq !>(800.000) !>(max-context.third))
      (expect-eq !>(800.000) !>(max-context:(need (next:routing cfg rotated catalogs))))
      (expect-eq !>(800.000) !>(max-context:(need (next:routing cfg keys ~))))
  ==
++  test-catalog-capacity-survives-incomplete-metadata-for-the-same-route
  =/  keys  (my ~[['openrouter' 'fixture-key']])
  =/  catalogs  (remember:context ~ keys 'openrouter' (my ~[['a' 128.000] ['b' 1.000.000]]))
  =/  updated  (remember:context catalogs keys 'openrouter' (my ~[['a' 256.000]]))
  =/  cfg  builtin-config:policy
  =.  cfg  cfg(url 'https://openrouter.ai/api/v1/chat/completions')
  ;:  weld
      (expect-eq !>(256.000) !>(max-context:(resolve:context cfg(model 'a') keys updated)))
      (expect-eq !>(1.000.000) !>(max-context:(resolve:context cfg(model 'b') keys updated)))
      (expect-eq !>(updated) !>((remember:context updated keys 'openrouter' ~)))
  ==
--
