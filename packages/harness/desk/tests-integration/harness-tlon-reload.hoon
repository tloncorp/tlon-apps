::  Opt-in: -test /=harness=/tests-integration/harness-tlon-reload
::  Keep full-agent construction out of the default 2 GB loom unit suite.
/-  t=harness-tlon, hh=harness-hand
/+  *test-agent, migrate=harness-tlon-migrate
/=  adapter  /app/harness-tlon
/=  up  /tests/harness-upgrade
|%
::  Load saved state with every scry answered %.n, as before.
::
++  load
  |=  saved=vase
  =/  m  (mare ,[(list card) state-5:t])
  ^-  form:m
  ;<  ~                bind:m  (jab-bowl |=(b=bowl b(now ~2026.9.6)))
  ;<  ~                bind:m  (set-scry-gate |=(path `!>(|)))
  ;<  caz=(list card)  bind:m  (do-load adapter `saved)
  ;<  =vase            bind:m  get-save
  (pure:m caz !<(state-5:t vase))
::
++  reload
  |=  phase=?(%fetch %put %grant %hosted-put)
  =/  m  (mare ,state-5:t)
  ^-  form:m
  =/  state=state-5:t  *state-5:t
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
  ;<  [caz=(list card) loaded=state-5:t]  bind:m  (load !>(state))
  ::  Reload may cancel the old duct and publish a result, never request HTTP.
  ;<  ~  bind:m
    (ex-equal !>((lien caz |=(c=card ?=([%pass * %arvo %i %request *] c)))) !>(|))
  (pure:m loaded)
::
++  test-native-download-reload-is-known-not-uploaded
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  state=state-5:t  bind:m  (reload %fetch)
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
  ;<  state=state-5:t  bind:m  (reload %grant)
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
  ;<  state=state-5:t  bind:m  (reload %hosted-put)
  %+  ex-equal
    !>(&(=(~ uploads.state) =(%uncertain stage:(~(got by tool-receipts.state) 0v1))))
  !>(&)
::  Per-speaker channel conversations do not survive the upgrade to shared
::  sessions. A ready one's binding may still hold queued input, so loading
::  disables it and fences its session; a kept DM is left alone.
::
++  test-load-disables-and-fences-dropped-channel-bindings
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  room=destination:t  [%channel [%chat ~lux %test] ~]
  =/  dm=destination:t  [%dm ~bus ~]
  =/  old  *state-2:migrate
  =.  old
    %=  old
      epoch  5
      identities  (my ~[[[~bus room] 'room'] [[~bus dm] 'dm']])
      lanes  (my ~[['room' [~bus room 4 ~]] ['dm' [~bus dm 4 ~]]])
      routes  (my ~[['room' ['binding-room' %ready]] ['dm' ['binding-dm' %ready]]])
    ==
  ;<  [caz=(list card) loaded=state-5:t]  bind:m  (load !>(old))
  =/  pokes=(list [@tas *])
    %+  murn  caz
    |=  c=card
    ?.  ?=([%pass * %agent * %poke *] c)  ~
    `[p.cage.task.q.c q.q.cage.task.q.c]
  =/  disable  (rap 3 'tlon-disable-' (scot %uv (sham ['room' 5])) ~)
  ;<  ~  bind:m
    %+  ex-equal
      !>  ?&  (lien pokes |=(p=[@tas *] =(p [%harness-hand disable %enable 'binding-room' |])))
              (lien pokes |=(p=[@tas *] =(p [%harness-action %fence 'room'])))
          ==
    !>(&)
  ;<  ~  bind:m
    %+  ex-equal
      !>  %+  lien  pokes
          |=  p=[@tas *]
          |(=(p [%harness-action %fence 'dm']) ?=([%harness-hand * %enable %binding-dm *] p))
    !>(|)
  (ex-equal !>(~(key by lanes.loaded)) !>((silt ~['dm'])))
::
::  Each upload is retired into its receipt, and the wake is the unfinished
::  send's timeout. The hand is disabled, so no other deadline applies.
++  test-reload-keeps-populated-state
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  e  populated-5:up
  =/  retire
    |=  [s=state-5:t id=@uv stage=?(%done %uncertain) body=@t]
    ^-  state-5:t
    =/  receipt  (~(got by tool-receipts.s) id)
    s(tool-receipts (~(put by tool-receipts.s) id receipt(stage stage, body body)))
  =.  e
    %:  retire  e  0v8a  %done
      'failed: image download retired before any upload was dispatched'
    ==
  =.  e
    %:  retire  e  0v8b  %uncertain
      'uncertain: upload was dispatched but its acceptance is not known; do not automatically repeat this action'
    ==
  =.  e
    %:  retire  e  0v8c  %uncertain
      'uncertain: hosted upload-URL request was retired; no image PUT was sent, but allocation may have occurred; do not automatically repeat this action'
    ==
  =.  e
    %:  retire  e  0v8d  %uncertain
      'uncertain: upload was dispatched but its acceptance is not known; do not automatically repeat this action'
    ==
  =.  uploads.e  ~
  =.  wake.e  `(add at:(~(got by tool-receipts.e) 0v8e) ~m1)
  ;<  [* loaded=state-5:t]  bind:m  (load !>(populated-5:up))
  (ex-same:up !>(loaded) !>(e))
::  A moon with no explicit owner takes its parent as owner on the first load
::  only, and cuts off the owner's history before then. An owner cleared
::  later stays cleared.
++  test-reload-initializes-owner-once
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  parent=@p  ~sampel-palnet
  =/  first=@da  ~2026.9.6
  =/  e  unowned:up
  =.  e  e(owner-initialized 1, owner.policy `parent, cuts (my ~[[parent first]]))
  ::  A disabled hand is not watching.
  =.  watching.e  |
  ::  Jael names the moon's parent; every other scry answers %.n, as above.
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our (add parent (bex 32)), now first)))
  ;<  ~  bind:m  (set-scry-gate |=(p=path ?:(?=([%j *] p) `!>(parent) `!>(|))))
  ;<  *  bind:m  (do-load adapter `!>(unowned:up))
  ;<  once=vase  bind:m  get-save
  ;<  ~  bind:m  (ex-same:up once !>(e))
  =.  e  e(owner.policy ~)
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now (add first ~d1))))
  ;<  *  bind:m  (do-load adapter `!>(e))
  ;<  twice=vase  bind:m  get-save
  (ex-same:up twice !>(e))
--
