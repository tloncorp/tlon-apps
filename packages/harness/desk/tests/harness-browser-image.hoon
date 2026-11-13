/+  *test, image=harness-browser-image, mcp=harness-mcp
|%
++  packet
  '{"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"Screenshot captured."},{"type":"image","mimeType":"image/png","data":"dGVzdA=="}]}}'
++  test-receipt-keeps-pixels-separate-from-text
  =/  expected  ['Screenshot captured.' `['image/png' 'dGVzdA==']]
  ;:  weld
    (expect-eq !>(expected) !>((receipt:image (cat 3 'HTTP 200\0a\0a' packet))))
    %+  expect-eq
      !>(expected)
    !>((receipt:image (rap 3 'HTTP 200\0a\0aevent: message\0adata: ' packet '\0a\0a' ~)))
  ==
++  test-attach-only-matches-the-latest-correlated-tool-message
  =/  payload
    %-  need
    %-  de:json:html
    '{"messages":[{"role":"tool","tool_call_id":"earlier","content":"Old."},{"role":"user","content":"Proceed."},{"role":"tool","tool_call_id":"now","content":"Screenshot captured."}]}'
  =/  expected
    %-  de:json:html
    '{"messages":[{"role":"tool","tool_call_id":"earlier","content":"Old."},{"role":"user","content":"Proceed."},{"role":"tool","tool_call_id":"now","content":[{"type":"text","text":"Screenshot captured."},{"type":"image_url","image_url":{"url":"data:image/png;base64,dGVzdA=="}}]}]}'
  ;:  weld
    (expect-eq !>((need expected)) !>((attach:image payload 'now' 'image/png' 'dGVzdA==' &)))
    (expect-eq !>(payload) !>((attach:image payload 'missing' 'image/png' 'dGVzdA==' &)))
  ==
++  test-session-create-keeps-the-handle-and-removes-the-viewer-capability
  =/  body
    'HTTP 200\0a\0a{"id":1,"result":{"structuredContent":{"session_id":"handle","viewer_url":"https://viewer.example/s/private"}}}'
  =/  expected
    'HTTP 200\0a\0a{"id":1,"result":{"structuredContent":{"session_id":"handle"}}}'
  %+  expect-eq
    !>((de:json:html (rsh 3^10 expected)))
  !>((de:json:html (rsh 3^10 (browser-session:mcp body |))))
++  test-session-release-keeps-the-receipt-and-removes-the-dashboard-link
  =/  body
    'HTTP 200\0a\0a{"id":1,"result":{"content":[{"type":"text","text":"Released.\\n- Session dashboard: https://viewer.example/s/private\\n- Login state saved."}],"structuredContent":{"released":true}}}'
  =/  expected
    'HTTP 200\0a\0a{"id":1,"result":{"content":[{"type":"text","text":"Released.\\n- Login state saved."}],"structuredContent":{"released":true}}}'
  %+  expect-eq
    !>((de:json:html (rsh 3^10 expected)))
  !>((de:json:html (rsh 3^10 (browser-session:mcp body &))))
--
