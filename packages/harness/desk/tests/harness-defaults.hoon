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
    !>('agents\0a\0asoul\0a\0aidentity\0a\0auser\0a\0atools\0a\0abootstrap')
  !>((compose-prompts:defaults layers))
::  MEMORY.md is the owner's private memory; every conversation inherits the
::  composition, shared channels and other ships' DMs included.
++  test-a-memory-layer-is-never-composed
  ;:  weld
      %+  expect-eq  !>('')
      !>((compose-prompts:defaults (my ~[[%'MEMORY.md' 'Private.']])))
      %+  expect-eq  !>('agents')
      !>((compose-prompts:defaults (my ~[[%'AGENTS.md' 'agents'] [%'MEMORY.md' 'Private.']])))
  ==
::  Two layers composed with one blank line between them, `size` bytes in all.
++  two-layers
  |=  size=@ud
  ^-  prompts:h
  (my ~[[%'AGENTS.md' (fil 3 1.000 'a')] [%'SOUL.md' (fil 3 (sub size 1.002) 's')]])
++  test-a-layer-write-may-fill-the-composition-to-its-limit-and-no-further
  =/  limit  composed-limit:defaults
  =/  layers  (two-layers (sub limit 100))
  ;:  weld
      (expect-eq !>(limit) !>((met 3 (compose-prompts:defaults (two-layers limit)))))
      (expect !>((prompt-fits:defaults layers %'USER.md' (fil 3 98 'u'))))
      (expect !>(!(prompt-fits:defaults layers %'USER.md' (fil 3 99 'u'))))
      (expect !>(!(prompt-fits:defaults layers %'AGENTS.md' (fil 3 1.101 'a'))))
      ::  MEMORY.md is not composed, so it does not count.
      (expect !>((prompt-fits:defaults (two-layers limit) %'MEMORY.md' (fil 3 1.000 'm'))))
  ==
::  An upgrade loads a longer single text as it was; a write may still shrink
::  it, or leave it.
++  test-an-upgraded-text-over-the-limit-may-shrink-but-not-grow
  =/  layers  (two-layers (add composed-limit:defaults 10))
  ;:  weld
      (expect !>((prompt-fits:defaults layers %'AGENTS.md' (fil 3 995 'a'))))
      (expect !>((prompt-fits:defaults layers %'AGENTS.md' (fil 3 1.000 'a'))))
      (expect !>(!(prompt-fits:defaults layers %'AGENTS.md' (fil 3 1.001 'a'))))
      (expect !>((prompt-fits:defaults layers %'SOUL.md' '')))
  ==
++  test-a-lone-layer-composes-to-itself-byte-for-byte
  =/  body  'Line one.\0a\0a  Line two.\0a'
  ;:  weld
      (expect-eq !>(body) !>((compose-prompts:defaults (my ~[[%'AGENTS.md' body]]))))
      (expect-eq !>(body) !>((compose-prompts:defaults (my ~[[%'USER.md' body]]))))
      (expect-eq !>('') !>((compose-prompts:defaults ~)))
  ==
--
