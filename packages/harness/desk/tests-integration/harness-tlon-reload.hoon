::  Opt-in: -test /=harness=/tests-integration/harness-tlon-reload
::  Keep full-agent construction out of the default 2 GB loom unit suite.
/-  t=harness-tlon
/+  *test-agent
/=  adapter  /app/harness-tlon
|%
::  Load saved state with every scry answered %.n, as before.
::
++  load
  |=  saved=vase
  =/  m  (mare ,[(list card) state-2:t])
  ^-  form:m
  ;<  ~                bind:m  (jab-bowl |=(b=bowl b(now ~2026.9.6)))
  ;<  ~                bind:m  (set-scry-gate |=(path `!>(|)))
  ;<  caz=(list card)  bind:m  (do-load adapter `saved)
  ;<  =vase            bind:m  get-save
  (pure:m caz !<(state-2:t vase))
::
++  reload
  |=  phase=?(%fetch %put %grant %hosted-put)
  =/  m  (mare ,state-2:t)
  ^-  form:m
  =/  state=state-2:t  *state-2:t
  =.  uploads.state
    %-  my
    :~  :*  0v1
            ^-  upload:t
            [phase 0v2 'key' 'image/png' 'https://storage.googleapis.com/bucket/key' [2 1]]
        ==
    ==
  =.  tool-receipts.state
    %-  my
    ~[[0v1 `tool-receipt:t`[['s' 1 ['call' 'tlon_upload_image' '{}']] %sending '' ~2026.9.6]]]
  ;<  [caz=(list card) loaded=state-2:t]  bind:m  (load !>(state))
  ::  Reload may cancel the old duct and publish a result, never request HTTP.
  ;<  ~  bind:m
    (ex-equal !>((lien caz |=(c=card ?=([%pass * %arvo %i %request *] c)))) !>(|))
  (pure:m loaded)
::
++  test-native-download-reload-is-known-not-uploaded
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  state=state-2:t  bind:m  (reload %fetch)
  =/  receipt  (~(got by tool-receipts.state) 0v1)
  %+  ex-equal
    !>  ?&  =(~ uploads.state)  =(%done stage.receipt)
            ?=(^ (find "before any upload" (trip body.receipt)))
        ==
  !>(&)
++  test-hosted-grant-reload-is-uncertain-without-claiming-a-put
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  state=state-2:t  bind:m  (reload %grant)
  =/  receipt  (~(got by tool-receipts.state) 0v1)
  %+  ex-equal
    !>  ?&  =(~ uploads.state)  =(%uncertain stage.receipt)
            ?=(^ (find "no image PUT was sent" (trip body.receipt)))
        ==
  !>(&)
++  test-hosted-put-reload-discards-bytes-without-retrying
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  state=state-2:t  bind:m  (reload %hosted-put)
  %+  ex-equal
    !>(&(=(~ uploads.state) =(%uncertain stage:(~(got by tool-receipts.state) 0v1))))
  !>(&)
--
