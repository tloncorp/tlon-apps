/-  h=harness
/+  *test, effects=harness-effects
|%
++  fetch
  |=  args=@t
  (~(fetch-card effects [*bowl:gall ~]) 's' 1 ['call' 'http_fetch' args])
++  test-fetch-is-get-with-no-body-headers-redirects-or-retries
  =/  got  (fetch '{"url":"https://example.com/"}')
  =/  expected=(unit card:agent:gall)
    `[%pass /tool-2/s/1/call %arvo %i %request [%'GET' 'https://example.com/' ~ ~] [0 0]]
  (expect-eq !>(expected) !>(got))
++  test-fetch-accepts-explicit-get-for-older-clients
  %+  expect-eq
    !>((fetch '{"url":"https://example.com/"}'))
  !>((fetch '{"url":"https://example.com/","method":"GET"}'))
++  test-fetch-rejects-mutations-and-bodies-before-dispatch
  =/  args=(list @t)
    :~  '{"url":"https://example.com/","method":"POST"}'
        '{"url":"https://example.com/","method":"DELETE"}'
        '{"url":"https://example.com/","method":1}'
        '{"url":"https://example.com/","body":""}'
        '{"url":"https://example.com/","body":{"x":1}}'
        '{"url":"file:///private"}'
        '{"url":"http://127.0.0.1/test\\n"}'
        '{"url":"https://user:secret@example.com/"}'
        '{"url":"https://example.com/#fragment"}'
        '{"url":"http://"}'
    ==
  (expect !>((levy args |=(arg=@t =(~ (fetch arg))))))
--
