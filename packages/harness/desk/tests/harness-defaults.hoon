/-  h=harness
/+  *test, defaults=harness-defaults, auth=harness-auth
|%
++  test-openai-device-login-is-the-bootstrap-route
  =/  config  builtin-config:defaults
  ;:  weld
      (expect-eq !>(device-url:auth) !>(url.config))
      (expect-eq !>('openai-device') !>((credential-for-config:auth config)))
  ==
::  Insertion order is not composition order.
++  test-layers-compose-in-fixed-order-with-one-blank-line-between
  =/  layers=prompts:h
    %-  my
    :~  [%'MEMORY.md' 'memory']  [%'TOOLS.md' 'tools']  [%'SOUL.md' 'soul']
        [%'BOOTSTRAP.md' 'bootstrap']  [%'USER.md' 'user']
        [%'IDENTITY.md' 'identity']  [%'AGENTS.md' 'agents']
    ==
  %+  expect-eq
    !>('agents\0a\0asoul\0a\0aidentity\0a\0auser\0a\0atools\0a\0abootstrap\0a\0amemory')
  !>((compose-prompts:defaults layers))
++  test-a-lone-layer-composes-to-itself-byte-for-byte
  =/  body  'Line one.\0a\0a  Line two.\0a'
  ;:  weld
      (expect-eq !>(body) !>((compose-prompts:defaults (my ~[[%'AGENTS.md' body]]))))
      (expect-eq !>(body) !>((compose-prompts:defaults (my ~[[%'USER.md' body]]))))
      (expect-eq !>('') !>((compose-prompts:defaults ~)))
  ==
--
