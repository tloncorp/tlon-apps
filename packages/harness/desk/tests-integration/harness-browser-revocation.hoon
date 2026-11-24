::  Full adapter, synthetic authority and clock; emitted requests are inspected.
/-  t=harness-tlon, h=harness, hh=harness-hand, ad=harness-adapter
/+  *test-agent, policy=harness-tlon-policy
/=  adapter  /app/harness-tlon
|%
++  form-url  'http://127.0.0.1:8787/credential-result/fixture'
++  payment-id  '187d7950-bf80-4667-ad9d-5dd01f84a5da'
++  run
  |=  [phase=browser-phase:t live=? changed=? wallet=?]
  =/  m  (mare ,[(list card) state-3:t])
  ^-  form:m
  =/  saved  *state-3:t
  =.  owner-initialized.saved  1
  =.  policy.saved  [& `~nec ~ %mentions ~ ~]
  =.  lanes.saved  (my ~[['source' [~nec [%dm ~nec ~] 1 ~[%web]]]])
  =.  routes.saved  (my ~[['source' ['binding' %ready]]])
  =/  requested=tool-call:h
    ['call' ?:(wallet 'browser_connect_wallet' 'browser_secure_entry') '{}']
  =.  tool-receipts.saved
    (my ~[[0v1 [['source' 1 requested] %sending '' ~2026.9.6]]])
  =.  browser-entries.saved  (my ~[[0v1 [~2026.9.6..00.06.00 phase]]])
  ;<  ~  bind:m  (set-bowl %*(. *bowl our ~zod, src ~zod, now ~2026.9.6..00.07.00))
  ;<  ~  bind:m
    %-  set-scry-gate
    |=  =path
    ^-  (unit vase)
    ?:  ?=([%gu @ %contacts @ %$ ~] path)  `!>(|)
    ?:  ?=([%gu @ %harness @ %$ ~] path)  `!>(live)
    ?:  =(%$ (rear path))  `!>(&)
    ?:  (lien path |=(part=@ta =(%hand-state part)))  `!>(*state:hh)
    ?:  (lien path |=(part=@ta =(%tool-call part)))
      `!>(`(unit tool-authority:ad)`[~ requested ~])
    ?:  (lien path |=(part=@ta =(%cron-session part)))  `!>(~)
    ?:  (lien path |=(part=@ta =(%mcp part)))
      `!>((need (de:json:html '[{"id":"kernel-browser","name":"Kernel","url":"http://127.0.0.1:8787/mcp","headers":[],"enabled":true}]')))
    ?:  ?=([%gx @ %chat @ %dm %invited %ships ~] path)  `!>(~)
    ?:  (lien path |=(part=@ta =(%activity part)))  `!>(~)
    ~
  ;<  *  bind:m  (do-load adapter `!>(saved))
  ;<  ~  bind:m
    %-  jab-bowl
    |=  b=bowl
    b(wex ?:(live (~(put by wex.b) [/head ~zod %harness] [& /hand-events]) wex.b))
  ;<  caz=(list card)  bind:m
    ?.  changed  (do-arvo /poll [%behn %wake ~])
    =/  params  (policy-json:policy policy.saved(owner `~zod))
    (do-poke %noun !>(`request:ad`['fixture' [%n '1'] 'harness/tlon/configure' `params]))
  ;<  =vase  bind:m  get-save
  (pure:m caz !<(state-3:t vase))
::
++  check
  |=  [phase=browser-phase:t live=? changed=? wallet=?]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) saved=state-3:t]  bind:m  (run phase live changed wallet)
  =/  requests
    (skim caz |=(c=card ?=([%pass * %arvo %i %request *] c)))
  ;<  ~  bind:m  (ex-equal !>((lent requests)) !>(1))
  ?>  ?=(^ requests)
  =/  request  i.requests
  ?>  ?=([%pass * %arvo %i %request *] request)
  =/  envelope=[@tas wire @tas @tas @tas fetch=request:http outbound-config:iris]  request
  =/  fetch  fetch.envelope
  ;<  ~  bind:m  (ex-equal !>(method.fetch) !>(?:(wallet %'POST' %'DELETE')))
  =/  entry  (~(got by browser-entries.saved) 0v1)
  ;<  ~  bind:m  (ex-equal !>(phase.entry) !>(`browser-phase:t`[%revoke ~]))
  ?.  wallet
    (ex-equal !>(url.fetch) !>('http://127.0.0.1:8787/credentials/fixture'))
  =/  body  q:(need body.fetch)
  (ex-equal !>(?=(^ (find "payment_cancel" (trip body)))) !>(&))
::
++  test-owner-change-revokes-a-form-with-the-head-offline
  (eval-mare (check [%wait [%form form-url]] | & |))
++  test-form-timeout-revokes-the-form-before-settling
  (eval-mare (check [%wait [%form form-url]] & | |))
++  test-unacknowledged-post-revokes-the-form
  (eval-mare (check [%post [%form form-url]] & | |))
++  test-wallet-timeout-cancels-the-known-request
  (eval-mare (check [%wait [%payment payment-id]] & | &))
++  test-owner-change-cancels-a-wallet-request-with-the-head-offline
  (eval-mare (check [%wait [%payment payment-id]] | & &))
++  cancel-result
  |=  confirmed=?
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) saved=state-3:t]  bind:m  (run [%wait [%payment payment-id]] | & &)
  =/  entry  (~(got by browser-entries.saved) 0v1)
  =/  body
    ?:  confirmed
      '{"jsonrpc":"2.0","id":1,"result":{"structuredContent":{"kind":"connect","request_id":"187d7950-bf80-4667-ad9d-5dd01f84a5da","status":"cancelled"}}}'
    '{"jsonrpc":"2.0","id":1,"result":{"isError":true,"content":[{"type":"text","text":"Reconcile this payment."}]}}'
  ;<  *  bind:m
    %+  do-arvo
      /browser-entry/0v1/(scot %da next.entry)
    [%iris %http-response %finished [200 ~] `['application/json' (as-octs:mimes:html body)]]
  ;<  =vase  bind:m  get-save
  =/  settled  !<(state-3:t vase)
  =/  receipt  (~(got by tool-receipts.settled) 0v1)
  ;<  ~  bind:m  (ex-equal !>(stage.receipt) !>(%done))
  ;<  ~  bind:m  (ex-equal !>(browser-entries.settled) !>(~))
  =/  expected
    ?:  confirmed
      'Wallet request is closed. Check wallet_status or payment_status before continuing.'
    'Stripe Link connection was not confirmed. Check wallet_status before trying again.'
  (ex-equal !>(body.receipt) !>(expected))
++  test-wallet-cancellation-settles-only-after-kernel-confirms
  (eval-mare (cancel-result &))
++  test-wallet-cancellation-rpc-error-is-an-uncertain-outcome
  (eval-mare (cancel-result |))
++  test-head-outage-alone-preserves-a-pending-form
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) saved=state-3:t]  bind:m  (run [%wait [%form form-url]] | | |)
  ;<  ~  bind:m
    (ex-equal !>((lien caz |=(c=card ?=([%pass * %arvo %i %request *] c)))) !>(|))
  %+  ex-equal
    !>(phase:(~(got by browser-entries.saved) 0v1))
  !>(`browser-phase:t`[%wait [%form form-url]])
--
