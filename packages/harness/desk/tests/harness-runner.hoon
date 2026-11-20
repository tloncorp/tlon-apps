/-  r=harness-runner
/+  *test, runner=harness-runner, j=harness-provider-wire
|%
++  key  'hrr_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
++  args
  (pairs:enjs:format ~[['id' %s 'laptop'] ['label' %s 'Test laptop'] ['key' %s key]])
++  issued
  ^-  state:r
  =/  out  (owner:runner *state:r 'create' args ~2026.10.1)
  ?>  ?=(%& -.out)
  db.p.out
++  test-key-has-no-cookie-or-cross-runner-authority
  ;:  weld
      (expect !>((authenticate:runner issued 'laptop' ~[['authorization' (cat 3 'Bearer ' key)]])))
      %-  expect
      !>(!(authenticate:runner issued 'another' ~[['authorization' (cat 3 'Bearer ' key)]]))
      (expect !>(!(authenticate:runner issued 'laptop' ~[['cookie' (cat 3 'Bearer ' key)]])))
      %-  expect
      !>  ?!  %^  authenticate:runner
                issued
                'laptop'
              ~[['authorization' (cat 3 'Bearer ' key)] ['Authorization' (cat 3 'Bearer ' key)]]
  ==
++  test-create-retry-is-idempotent-and-revocation-is-final
  =/  again  (owner:runner issued 'create' args ~2026.10.2)
  ?>  ?=(%& -.again)
  =/  revoked  (owner:runner issued 'revoke' args ~2026.10.2)
  ?>  ?=(%& -.revoked)
  =/  replay  (owner:runner db.p.revoked 'create' args ~2026.10.3)
  ;:  weld
      (expect-eq !>(issued) !>(db.p.again))
      (expect-eq !>(`(unit json)`~) !>((get:j result.p.again 'key')))
      (expect !>(?=(%| -.replay)))
      %-  expect
      !>(!(authenticate:runner db.p.revoked 'laptop' ~[['authorization' (cat 3 'Bearer ' key)]]))
  ==
++  test-route-and-sse-frame
  =/  value  (pairs:enjs:format ~[['text' %s 'hello\0aworld']])
  ;:  weld
      (expect-eq !>(`'laptop') !>((route:runner 'connected://laptop')))
      (expect-eq !>(`(unit @t)`~) !>((route:runner 'https://example.test')))
      %+  expect-eq
        !>('id: 1000\0aevent: harness\0adata: {"text":"hello\\nworld"}\0a\0a')
      !>((frame:runner 1.000 value))
  ==
++  test-queue-keeps-a-durable-monotonic-sequence
  =/  db  issued
  =/  old  (~(got by registry.db) 'laptop')
  =/  first  (enqueue:runner old [%s 'one'])
  ?>  ?=(%& -.first)
  =/  second  (enqueue:runner p.first [%s 'two'])
  ?>  ?=(%& -.second)
  ;:  weld
      (expect-eq !>(3) !>(next.p.second))
      (expect-eq !>(`json`[%s 'one']) !>((~(got by events.p.second) 1)))
      (expect-eq !>(`json`[%s 'two']) !>((~(got by events.p.second) 2)))
  ==
--
