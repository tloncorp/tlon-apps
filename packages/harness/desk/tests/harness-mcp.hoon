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
++  test-discovery-hides-enabled-but-ungranted-servers
  =/  servers=(map mcp-server-id:h mcp-server:h)
    (my ~[['a' ['Allowed' 'https://a.example' ~ &]] ['b' ['Not granted' 'https://b.example' ~ &]]])
  =/  run  ~(. effects [*bowl:gall servers])
  =/  out  (run-tool:run ['call' 'list_mcp_servers' '{}'] ~ ~[[%mcp 'a']])
  ?>  ?=(%tool-completed -.out)
  (expect-eq !>((de:json:html '[{"id":"a","name":"Allowed"}]')) !>((de:json:html body.out)))
--
