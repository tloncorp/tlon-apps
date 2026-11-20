/-  h=harness
/+  *test, provision=harness-hosted-provision, auth=harness-auth, defaults=harness-defaults,
    ht=harness-tools
|%
++  servers
  ^-  (map mcp-server-id:h mcp-server:h)
  %-  my
  ~[['local' ['Local' 'urbit://~zod/mcp-proxy' ~ &]] ['off' ['Off' 'https://example.com/mcp' ~ |]]]
++  test-platform-snapshot-preserves-local-keys-and-model-selection
  =/  keys  (my ~[['openai-device' 'subscription'] ['openrouter' 'owner'] ['hosted-brave' 'stale']])
  =/  cfg  builtin-config:defaults
  =.  cfg  cfg(url device-url:auth, model 'gpt-5.6-luna')
  =/  args  (need (de:json:html '{"providerKeys":{"openrouter":"platform","brave":"search"}}'))
  =/  out  (apply:provision cfg keys servers args |)
  =/  again  (apply:provision config.out keys.out servers args |)
  ;:  weld
      (expect-eq !>(out) !>(again))
      (expect-eq !>(url.cfg) !>(url.config.out))
      (expect-eq !>(model.cfg) !>(model.config.out))
      (expect-eq !>('owner') !>((key:auth keys.out 'openrouter')))
      (expect-eq !>('subscription') !>((key:auth keys.out 'openai-device')))
      (expect-eq !>('search') !>((key:auth keys.out 'brave')))
      (expect !>((mcp-granted:ht 'local' tools.config.out)))
      (expect !>(!(mcp-granted:ht 'off' tools.config.out)))
  ==
++  test-platform-initializes-primary-and-fallbacks-once
  =/  cfg  builtin-config:defaults
  =/  args
    %-  need
    %-  de:json:html
    '{"providerKeys":{"openrouter":"platform"},"primary":{"provider":"openrouter","model":"hosted-primary"},"fallbacks":[{"provider":"openrouter","model":"hosted-backup"}]}'
  =/  out  (apply:provision cfg ~ servers args &)
  =/  selected
    config.out(url device-url:auth, model 'owner-model', zdr |, headers ~[['owner' 'header']])
  =/  again  (apply:provision selected keys.out servers args |)
  ;:  weld
      (expect-eq !>('https://openrouter.ai/api/v1/chat/completions') !>(url.config.out))
      (expect-eq !>('hosted-primary') !>(model.config.out))
      (expect !>(zdr.config.out))
      %+  expect-eq
        !>(`(list model-choice:h)`~[['openrouter' 'hosted-backup']])
      !>(fallbacks.config.out)
      (expect-eq !>(system.cfg) !>(system.config.out))
      (expect-eq !>('platform') !>((key:auth keys.out 'openrouter')))
      (expect-eq !>(selected) !>(config.again))
  ==
++  test-direct-provider-default-disables-zdr
  =/  cfg  builtin-config:defaults
  =.  zdr.cfg  &
  =/  args
    %-  need
    %-  de:json:html
    '{"providerKeys":{},"primary":{"provider":"openai","model":"direct-primary"}}'
  =/  out  (apply:provision cfg ~ servers args &)
  (expect !>(!zdr.config.out))
++  test-owner-zdr-choice-survives-provision
  =/  args
    %-  need
    %-  de:json:html
    '{"providerKeys":{},"primary":{"provider":"openrouter","model":"hosted-primary"}}'
  =/  cfg  builtin-config:defaults
  =/  enabled  (apply:provision cfg(zdr &) ~ servers args |)
  =/  disabled  (apply:provision cfg(zdr |) ~ servers args |)
  ;:  weld
      (expect !>(zdr.config.enabled))
      (expect !>(!zdr.config.disabled))
  ==
++  test-invalid-primary-is-rejected
  =/  args
    %-  need
    (de:json:html '{"providerKeys":{},"primary":{"provider":"unknown","model":"fixture"}}')
  =/  attempted  (mule |.((apply:provision builtin-config:defaults ~ ~ args &)))
  (expect !>(?=(%| -.attempted)))
++  test-platform-key-rotation-removal-and-explicit-empty-override
  =/  keys
    %-  my
    ~[['hosted-openrouter' 'old'] ['hosted-brave' 'removed'] ['xai' ''] ['hosted-xai' 'platform']]
  =/  args  (need (de:json:html '{"providerKeys":{"openrouter":"new","xai":"next"}}'))
  =/  out  (apply:provision builtin-config:defaults keys ~ args |)
  ;:  weld
      (expect-eq !>('new') !>((key:auth keys.out 'openrouter')))
      (expect-eq !>('') !>((key:auth keys.out 'brave')))
      (expect-eq !>('') !>((key:auth keys.out 'xai')))
      (expect-eq !>('') !>((key:auth keys.out 'xai-device')))
  ==
++  test-owner-tools-use-live-enabled-servers-and-all-configurable-families
  =/  tools  (owner-tools:ht servers)
  ;:  weld
      (expect !>((mcp-granted:ht 'local' tools)))
      (expect !>(!(mcp-granted:ht 'off' tools)))
      (expect !>((tool-granted:ht 'run_js' tools)))
      (expect !>((clay-granted:ht /base/app tools)))
      (expect !>((tool-granted:ht 'write_skill' tools)))
      (expect !>(!(tool-granted:ht 'harness_admin' tools)))
  ==
--
