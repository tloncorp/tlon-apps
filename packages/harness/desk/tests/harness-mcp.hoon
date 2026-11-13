/-  h=harness, t=harness-tlon, *harness-store
/+  *test, ht=harness-tools, hj=harness-json, hl=harness, storage=harness-store,
    policy=harness-defaults, tp=harness-tlon-policy, effects=harness-effects
|%
++  test-grants-roundtrip-and-reject-ambient-authority
  =/  grant=tool-grant:h  [%mcp 'calendar']
  =/  legacy  (mule |.((json-grant:hj [%s 'mcp'])))
  %-  expect
  !>  ?&  =(grant (json-grant:hj (grant-json:hj grant)))  ?=(%| -.legacy)
          !(tool-granted:ht 'list_mcp_servers' ~[%mcp])
      ==
++  test-server-is-the-boundary-not-the-tool-name
  =/  tools=(list tool-grant:h)  ~[[%mcp 'calendar']]
  =/  allowed=tool-call:h  ['a' 'call_mcp_tool' '{"server":"calendar","name":"any_tool"}']
  =/  denied  allowed(args '{"server":"notes","name":"any_tool"}')
  %-  expect
  !>  ?&  (call-granted:ht allowed tools)  !(call-granted:ht denied tools)
          !(call-granted:ht allowed ~[%mcp])  !(call-granted:ht allowed (rehearsal-tools:ht tools))
      ==
++  test-multiple-servers-advertise-one-schema-family
  (expect-eq !>((tool-defs:ht ~[[%mcp 'a']])) !>((tool-defs:ht ~[[%mcp 'a'] [%mcp 'b']])))
++  test-mcp-call-without-a-tool-name-produces-no-request
  =/  call=tool-call:h  ['a' 'call_mcp_tool' '{"server":"kernel-browser"}']
  =/  valid  call(args '{"server":"kernel-browser","name":"browser_session_create"}')
  (expect !>(&(?=(~ (mcp-payload:effects call)) ?=(^ (mcp-payload:effects valid)))))
++  test-kernel-owner-handoffs-cannot-use-the-raw-mcp-mutation
  =/  tools=(list tool-grant:h)  ~[[%mcp 'kernel-browser']]
  =/  list-login=tool-call:h
    ['a' 'call_mcp_tool' '{"server":"kernel-browser","name":"browser_login","arguments":"{\\"action\\":\\"list\\"}"}']
  =/  raw-login=tool-call:h
    ['a' 'call_mcp_tool' '{"server":"kernel-browser","name":"browser_login","arguments":"{}"}']
  =/  raw-payment=tool-call:h
    ['a' 'call_mcp_tool' '{"server":"kernel-browser","name":"payment_request","arguments":"{}"}']
  =/  raw-wallet=tool-call:h
    ['a' 'call_mcp_tool' '{"server":"kernel-browser","name":"wallet_connect","arguments":"{}"}']
  %-  expect
  !>  ?&  (call-granted:ht list-login tools)
          !(call-granted:ht raw-login tools)
          !(call-granted:ht raw-payment tools)
          !(call-granted:ht raw-wallet tools)
          (call-granted:ht ['a' 'browser_approve_login' '{}'] tools)
          (call-granted:ht ['a' 'browser_request_payment' '{}'] tools)
          (call-granted:ht ['a' 'browser_connect_wallet' '{}'] tools)
          !(call-granted:ht ['a' 'browser_approve_login' '{}'] ~[[%mcp 'other']])
      ==
++  test-discovery-hides-enabled-but-ungranted-servers
  =/  servers=(map mcp-server-id:h mcp-server:h)
    (my ~[['a' ['Allowed' 'https://a.example' ~ &]] ['b' ['Not granted' 'https://b.example' ~ &]]])
  =/  run  ~(. effects [*bowl:gall servers])
  =/  out  (run-tool:run ['call' 'list_mcp_servers' '{}'] ~ ~[[%mcp 'a']])
  ?>  ?=(%tool-completed -.out)
  (expect-eq !>((de:json:html '[{"id":"a","name":"Allowed"}]')) !>((de:json:html body.out)))
--
