/-  h=harness, *harness-store
/+  *test, local=harness-local-mcp, storage=harness-store
|%
++  test-registration-waits-for-the-running-local-agent
  (expect-eq !>([0 *(map mcp-server-id:h mcp-server:h)]) !>((ensure:local ~ 0 ~nec |)))
++  test-local-registration-has-ship-name-and-stores-no-credentials
  =/  out  (ensure:local ~ 0 ~nec &)
  ;:  weld
      (expect-eq !>(1) !>(seen.out))
      %+  expect-eq
        !>(['~nec-mcp' 'urbit://~nec/mcp-proxy' ~ &])
      !>((~(got by registry.out) '~nec-mcp'))
  ==
++  test-existing-disabled-or-custom-server-is-preserved
  =/  registry=(map mcp-server-id:h mcp-server:h)
    (my ~[['~nec-mcp' ['Custom' 'https://example.com/mcp' ~ |]]])
  (expect-eq !>([1 registry]) !>((ensure:local registry 0 ~nec &)))
++  test-deleted-registration-stays-deleted-after-reload
  =/  saved=state-0  *state-0
  =.  local-mcp-seen.saved  1
  =/  loaded  (load:storage !>(saved))
  %+  expect-eq
    !>([1 *(map mcp-server-id:h mcp-server:h)])
  !>((ensure:local mcp-servers.loaded local-mcp-seen.loaded ~nec &))
++  test-local-request-authenticates-with-the-supplied-key
  =/  payload  (need (de:json:html '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'))
  =/  req  (need (request:local 'fixture-key' payload))
  ;:  weld
      (expect !>(=(%'POST' method.request.req)))
      (expect-eq !>('/apps/mcp/mcp') !>(url.request.req))
      (expect-eq !>(`'fixture-key') !>((get-header:http 'x-api-key' header-list.request.req)))
      (expect-eq !>(`(as-octs:mimes:html (en:json:html payload))) !>(body.request.req))
  ==
++  test-local-request-requires-a-key-and-uses-its-current-value
  =/  first  (need (request:local 'first-key' ~))
  =/  next  (need (request:local 'next-key' ~))
  ;:  weld
      (expect-eq !>(~) !>((request:local '' ~)))
      (expect-eq !>(`'next-key') !>((get-header:http 'x-api-key' header-list.request.next)))
      (expect !>(!=(header-list.request.first header-list.request.next)))
  ==
--
