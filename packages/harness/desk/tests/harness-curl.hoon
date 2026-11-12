/-  h=harness
/+  *test, curl=harness-curl, ht=harness-tools, defaults=harness-defaults
|%
++  request
  |=  args=@t
  (request-card:curl 's' 7 ['call' 'curl' args])
++  test-curl-default-grant-still-distinct-from-web-and-rehearsal
  %-  expect
  !>  ?&  (tool-granted:ht 'curl' ~[%curl])  !(tool-granted:ht 'curl' ~[%web])
          !(tool-granted:ht 'http_fetch' ~[%curl])  (tool-granted:ht 'curl' default-tools:defaults)
          !(tool-granted:ht 'curl' (rehearsal-tools:ht ~[%curl]))
      ==
++  test-curl-default-get-no-ambient-authority
  =/  expected=(unit card:agent:gall)
    `[%pass /tool-2/s/7/call %arvo %i %request [%'GET' 'http://127.0.0.1/private' ~ ~] [0 0]]
  (expect-eq !>(expected) !>((request '{"url":"http://127.0.0.1/private"}')))
++  test-curl-explicit-mutation-headers-body-and-redirects
  =/  expected=(unit card:agent:gall)
    :-  ~
    :*  %pass  /tool-2/s/7/call  %arvo  %i  %request
        :*  %'PATCH'  'https://example.com/'  ~[['Authorization' 'Bearer explicit']]
            `(as-octs:mimes:html 'payload')
        ==
        [2 0]
    ==
  %+  expect-eq
    !>(expected)
  !>  %-  request
      '{"url":"https://example.com/","method":"PATCH","headers":{"Authorization":"Bearer explicit"},"body":"payload","redirects":2}'
++  test-curl-all-native-methods
  =/  methods=(list @t)  ~['GET' 'HEAD' 'POST' 'PUT' 'PATCH' 'DELETE' 'OPTIONS' 'TRACE' 'CONNECT']
  =/  valid=?
    %+  levy  methods
    |=  method=@t
    ?=(^ (request (rap 3 '{"url":"https://example.com/","method":"' method '"}' ~)))
  (expect !>(valid))
++  test-curl-invalid-arguments-never-dispatch
  =/  args=(list @t)
    :~  '{"url":"http://"}'
        '{"url":"file:///tmp/file"}'
        '{"url":"http://localhost/\\n"}'
        '{"url":"https://example.com/","method":"INVALID"}'
        '{"url":"https://example.com/","method":1}'
        '{"url":"https://example.com/","headers":{"bad header":"x"}}'
        '{"url":"https://example.com/","headers":{"X":"bad\\r\\nInjected: yes"}}'
        '{"url":"https://example.com/","headers":{"X":1}}'
        '{"url":"https://example.com/","headers":[]}'
        '{"url":"https://example.com/","body":{}}'
        '{"url":"https://example.com/","redirects":-1}'
        '{"url":"https://example.com/","redirects":1.5}'
        '{"url":"https://example.com/","redirects":21}'
    ==
  (expect !>((levy args |=(arg=@t =(~ (request arg))))))
--
