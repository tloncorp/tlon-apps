/+  *test, browser=harness-browser-entry
|%
++  viewer-path
  '/s/fixture.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA?clipboardBridge=true'
::
++  test-viewer-result-origin
  =/  trusted  (cat 3 'https://browser-session.test.tlon.systems' viewer-path)
  =/  local  (cat 3 'http://127.0.0.1:8787' viewer-path)
  =/  untrusted  (cat 3 'https://browser-session.tlon.network.example.test' viewer-path)
  ;:  weld
    %+  expect-eq
      !>('https://browser-session.test.tlon.systems/credential-result/fixture.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')
    !>((result-endpoint:browser trusted |))
    %+  expect-eq
      !>('http://127.0.0.1:8787/credential-result/fixture.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')
    !>((result-endpoint:browser local &))
    (expect !>(=(~ (mole |.((result-endpoint:browser local |))))))
    (expect !>(=(~ (mole |.((result-endpoint:browser untrusted &))))))
  ==
::
++  test-private-result-projection
  =/  result  (outcome:browser '{"status":"filled","submitted":false,"private":"synthetic-secret"}')
  %+  expect-eq
    !>(`(unit @t)`[~ 'Secure entry filled. Inspect the page and choose the next action.'])
  !>(result)
::
++  test-expired-form-result
  %+  expect-eq
    !>(`(unit @t)`[~ 'Secure entry expired or is no longer available.'])
  !>((outcome:browser '{"status":"failed","outcome":"expired"}'))
::
++  test-saved-login-card-binds-record-revision
  =/  session  'session-1'
  =/  raw  '{"session_id":"session-1","form_id":"187d7950-bf80-4667-ad9d-5dd01f84a5da","record":{"id":"saved","revision":1001},"bindings":[{"sourceField":"email","targetField":"f0"}]}'
  =/  input  (arguments:browser 'browser_approve_login' raw)
  =/  body  '{"jsonrpc":"2.0","id":1,"result":{"structuredContent":{"session_id":"session-1","viewer_url":"https://browser-session.test.tlon.systems/s/fixture.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}}}'
  =/  card  (prepare-reply:browser session | selected.input body)
  =/  expected  '[{"type":"browser-secure-entry","version":1,"viewerUrl":"https://browser-session.test.tlon.systems/s/fixture.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","loginApproval":{"record":{"id":"saved","revision":1001}}}]'
  (expect-eq !>((de:json:html expected)) !>((de:json:html blob.card)))
::
++  test-payment-card-contains-only-the-request-id
  =/  id  '187d7950-bf80-4667-ad9d-5dd01f84a5da'
  =/  body  '{"jsonrpc":"2.0","id":1,"result":{"structuredContent":{"session_id":"session-1","kind":"payment","request_id":"187d7950-bf80-4667-ad9d-5dd01f84a5da","status":"review","owner_action_required":true,"action":{"url":"https://example.com/private"}}}}'
  =/  payment  (wallet-reply:browser `'session-1' body)
  ;:  weld
    (expect !>(=([id 'review' &] payment)))
    %+  expect-eq
      !>((de:json:html '[{"type":"browser-wallet","version":1,"requestId":"187d7950-bf80-4667-ad9d-5dd01f84a5da"}]'))
    !>((de:json:html (wallet-card:browser id.payment)))
  ==
::
++  test-link-connect-response-needs-no-browser-session
  =/  body  '{"jsonrpc":"2.0","id":1,"result":{"structuredContent":{"kind":"connect","request_id":"187d7950-bf80-4667-ad9d-5dd01f84a5da","status":"pending","owner_action_required":true}}}'
  =/  connected  '{"jsonrpc":"2.0","id":1,"result":{"structuredContent":{"status":"connected","provider":"link"}}}'
  ;:  weld
    (expect !>(=(['187d7950-bf80-4667-ad9d-5dd01f84a5da' 'pending' &] (wallet-reply:browser ~ body))))
    (expect !>(=(['' 'connected' |] (wallet-reply:browser ~ connected))))
    (expect !>(=(~ (mole |.((wallet-reply:browser `'session-1' body))))))
    (expect !>(=(~ (wallet-outcome:browser & 'ready'))))
  ==
--
