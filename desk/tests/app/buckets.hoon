::  behavior tests for the %buckets Gall agent
::
/-  bu=buckets
/+  *test-agent
/=  buckets-agent  /app/buckets
/=  buckets-json  /lib/buckets/json
|%
++  dap  %buckets
::
++  flag
  ^-  flag:bu
  [~sampel-palnet %project-files]
::
++  group
  ^-  flag:bu
  [~sampel-palnet %test-group]
::
::  The bowl pins eny, so a session id is predictable: +begin-upload mints it
::  as `@uv`eny.bowl, which is also the token handed to the broker.
::
++  seed  0v1234
++  seed-token  ^-(@t (scot %uv seed))
::
++  setup
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~sampel-palnet, src ~sampel-palnet)))
  ;<  *  bind:m  (do-init dap buckets-agent)
  ;<  ~  bind:m
    (jab-bowl |=(b=bowl b(now ~2026.1.1, eny seed)))
  (pure:m ~)
::
++  setup-as
  |=  who=ship
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our who, src who)))
  ;<  *  bind:m  (do-init dap buckets-agent)
  ;<  ~  bind:m
    (jab-bowl |=(b=bowl b(now ~2026.1.1, eny seed)))
  (pure:m ~)
::
::  +ask: submit a local client action under a request id.
::
++  ask
  |=  [rid=@uv act=action:bu]
  =/  m  (mare ,(list card))
  ^-  form:m
  (do-poke %buckets-action-1 !>(`command:bu`[rid act]))
::
++  create
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m
    (ask 0v0 [%create %project-files 'Project Files' group ~ ~])
  (pure:m ~)
::
++  file-of
  |=  ent=entry:bu
  ^-  file:bu
  ?-  -.kind.ent
    %folder  ~|(%expected-file !!)
    %file    +.kind.ent
  ==
::
++  state-for
  |=  [st=state-0:bu =flag:bu]
  ^-  bucket-state:bu
  =/  sp=space:bu  (~(got by spaces.st) flag)
  (need state.sp)
::
++  only-session
  |=  st=state-0:bu
  ^-  upload-session:bu
  =/  sessions=(list upload-session:bu)  ~(val by sessions.st)
  ?~(sessions !! i.sessions)
::
::  +grant-fact: the single card a settled local action produces.
::
++  grant-fact
  |=  [rid=@uv body=response-body:bu]
  (ex-fact ~[/v1/requests] %buckets-req-response-1 !>(`req-response:bu`[rid body]))
::
++  deny-group-scries
  |=  pax=path
  ^-  (unit vase)
  ?.  ?=([%gx @ %groups @ %v2 %groups @ @ %channels %can-read %noun ~] pax)  ~
  `!>(|=([who=ship =nest:bu] |))
::
++  group-permission-scries
  |=  pax=path
  ^-  (unit vase)
  ?:  ?=([%gx @ %groups @ %v2 %groups @ @ %channels %can-read %noun ~] pax)
    `!>(|=([who=ship =nest:bu] &))
  ?.  ?=([%gx @ %groups @ %v2 %groups @ @ %channels %buckets @ @ %can-write @ %noun ~] pax)  ~
  `!>(`(unit [admin=? roles=(set @tas)])`[~ [admin=| roles=(silt ~[%editor])]])
::
++  missing-group-permission-scries
  |=  pax=path
  ^-  (unit vase)
  ?:  ?=([%gx @ %groups @ %v2 %groups @ @ %channels %can-read %noun ~] pax)
    `!>(|=([who=ship =nest:bu] &))
  ?.  ?=([%gx @ %groups @ %v2 %groups @ @ %channels %buckets @ @ %can-write @ %noun ~] pax)  ~
  `!>(`(unit [admin=? roles=(set @tas)])`~)
::
++  allow-admin-create-scries
  |=  pax=path
  ^-  (unit vase)
  ?.  ?=([%gx @ %groups @ %v2 %groups @ @ %seats @ %is-admin %noun ~] pax)  ~
  `!>(&)
::
++  deny-admin-create-scries
  |=  pax=path
  ^-  (unit vase)
  ?.  ?=([%gx @ %groups @ %v2 %groups @ @ %seats @ %is-admin %noun ~] pax)  ~
  `!>(|)
::
::  A pending upload is answered privately and announced to nobody. The token
::  goes to the requester alone, and the manifest gains nothing until the
::  object lands — so no subscriber can learn the session id.
::
++  test-begin-upload-grants-token-privately
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  caz=(list card)  b
    (ask 0v7 [%bucket flag [%begin-upload ~ 'private.pdf' 'application/pdf' 42 ~]])
  ;<  ~  b
    %+  ex-cards  caz
    :~  %+  grant-fact  0v7
        [%grant seed-token 2 (add ~2026.1.1 ~h1)]
    ==
  ;<  sv=vase  b  get-save
  =/  st=state-0:bu  !<(state-0:bu sv)
  =/  bs=bucket-state:bu  (state-for st flag)
  =/  ses=upload-session:bu  (only-session st)
  %+  ex-equal
  !>  :*  ~(wyt by entries.bs)
          revision.bs
          [flag.ses status.ses requested-by.ses]
          [id.entry.ses name.entry.ses]
      ==
  !>  :*  0
          0
          [flag %pending ~sampel-palnet]
          [2 'private.pdf']
      ==
::
::  Input Memex would refuse is refused here first, so a bad request never
::  allocates an entry id or a session.
::
++  test-begin-upload-rejects-bad-input
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  caz=(list card)  b
    (ask 0v8 [%bucket flag [%begin-upload ~ 'empty.pdf' 'application/pdf' 0 ~]])
  ;<  ~  b
    %+  ex-cards  caz
    :~  %+  grant-fact  0v8
        [%error %invalid-input 'file size must be greater than zero']
    ==
  ;<  caz2=(list card)  b
    (ask 0v9 [%bucket flag [%begin-upload ~ 'bad.pdf' 'pdf' 42 ~]])
  ;<  ~  b
    %+  ex-cards  caz2
    :~  %+  grant-fact  0v9
        [%error %invalid-input 'missing or malformed content type']
    ==
  ;<  caz3=(list card)  b
    (ask 0v10 [%bucket flag [%begin-upload `99 'orphan.pdf' 'application/pdf' 42 ~]])
  ;<  ~  b
    %+  ex-cards  caz3
    :~  %+  grant-fact  0v10
        [%error %not-found 'no such parent folder']
    ==
  ;<  sv=vase  b  get-save
  =/  st=state-0:bu  !<(state-0:bu sv)
  (ex-equal !>([~(wyt by sessions.st) next-id.st]) !>([0 1]))
::
::  A pending upload is absent from the manifest until the object lands, then
::  appears in one revision. Driven through the broker, which is now the only
::  completion path.
::
++  test-upload-invisible-until-ready
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  =/  rid=@t  '00000000-0000-0000-0000-00000000000a'
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  *  b  (ask 0v1 [%bucket flag [%create-folder ~ 'Launch']])
  ;<  *  b  (ask 0v2 [%bucket flag [%begin-upload `2 'meadow.png' 'image/png' 2.048 ~]])
  ;<  sv=vase  b  get-save
  =/  st=state-0:bu  !<(state-0:bu sv)
  =/  bs=bucket-state:bu  (state-for st flag)
  =/  ses=upload-session:bu  (only-session st)
  ::  the folder is published, the pending file is not
  ;<  ~  b  (ex-equal !>([~(wyt by entries.bs) revision.bs]) !>([1 1]))
  ;<  *  b
    (do-poke %buckets-broker-command-1 !>(`broker-command:bu`[%authorize-upload seed-token rid]))
  =/  fil=file:bu  (file-of entry.ses)
  =/  receipt=broker-receipt:bu
    [rid object-key.fil 'sampel-palnet' (scot %ud id.bucket.bs) 2.048 'image/png']
  ;<  *  b
    (do-poke %buckets-broker-command-1 !>(`broker-command:bu`[%complete-upload receipt]))
  ;<  sv2=vase  b  get-save
  =/  st2=state-0:bu  !<(state-0:bu sv2)
  =/  bs2=bucket-state:bu  (state-for st2 flag)
  =/  ent=entry:bu  (~(got by entries.bs2) id.entry.ses)
  =/  fil2=file:bu  (file-of ent)
  =/  ses2=upload-session:bu  (~(got by sessions.st2) id.ses)
  %+  ex-equal
  !>([~(wyt by entries.bs2) revision.bs2 status.fil2 status.ses2 parent.ent])
  !>([2 2 %ready %complete `2])
::
::  The session id is the broker token. Memex's reservation binds once, and
::  the file only becomes visible after a verified receipt.
::
++  test-broker-upload-lifecycle
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  =/  rid=@t  '00000000-0000-0000-0000-000000000001'
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  *  b  (ask 0v1 [%bucket flag [%begin-upload ~ 'private.pdf' 'application/pdf' 42 ~]])
  ;<  *  b
    (do-poke %buckets-broker-command-1 !>(`broker-command:bu`[%authorize-upload seed-token rid]))
  ;<  upload-cage=cage  b
    (got-peek /x/v1/broker/upload/[seed-token]/[rid])
  =/  upload-result=@t
    (so:dejs:format (get:dejs:buckets-json 'result' !<(json q.upload-cage)))
  ;<  sv=vase  b  get-save
  =/  st=state-0:bu  !<(state-0:bu sv)
  =/  ses=upload-session:bu  (only-session st)
  =/  bs=bucket-state:bu  (state-for st flag)
  =/  fil=file:bu  (file-of entry.ses)
  ;<  ~  b  (ex-equal !>(reservation.ses) !>(`rid))
  =/  receipt=broker-receipt:bu
    [rid object-key.fil 'sampel-palnet' (scot %ud id.bucket.bs) 42 'application/pdf']
  ;<  *  b
    (do-poke %buckets-broker-command-1 !>(`broker-command:bu`[%complete-upload receipt]))
  ::  Completion retries are idempotent — no second entry, no second revision.
  ;<  *  b
    (do-poke %buckets-broker-command-1 !>(`broker-command:bu`[%complete-upload receipt]))
  ;<  sv2=vase  b  get-save
  =/  st2=state-0:bu  !<(state-0:bu sv2)
  =/  bs2=bucket-state:bu  (state-for st2 flag)
  =/  ent2=entry:bu  (~(got by entries.bs2) id.entry.ses)
  =/  fil2=file:bu  (file-of ent2)
  ;<  complete-cage=cage  b  (got-peek /x/v1/broker/complete/[rid])
  =/  complete-result=@t
    (so:dejs:format (get:dejs:buckets-json 'result' !<(json q.complete-cage)))
  %+  ex-equal
  !>  :*  upload-result
          complete-result
          status.fil2
          [~(wyt by entries.bs2) revision.bs2]
      ==
  !>([%'authorized' %'completed' %ready [1 1]])
::
::  One read token covers the whole bucket: it authorizes any ready object in
::  it, and nothing outside it. Deletes stay bound to a single object.
::
++  test-read-token-covers-the-bucket
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  =/  rid=@t  '00000000-0000-0000-0000-000000000002'
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  *  b  (ask 0v1 [%bucket flag [%begin-upload ~ 'private.pdf' 'application/pdf' 42 ~]])
  ;<  *  b
    (do-poke %buckets-broker-command-1 !>(`broker-command:bu`[%authorize-upload seed-token rid]))
  ;<  sv=vase  b  get-save
  =/  st=state-0:bu  !<(state-0:bu sv)
  =/  bs=bucket-state:bu  (state-for st flag)
  =/  ses=upload-session:bu  (only-session st)
  =/  fil=file:bu  (file-of entry.ses)
  =/  receipt=broker-receipt:bu
    [rid object-key.fil 'sampel-palnet' (scot %ud id.bucket.bs) 42 'application/pdf']
  ;<  *  b
    (do-poke %buckets-broker-command-1 !>(`broker-command:bu`[%complete-upload receipt]))
  ::  A fresh eny so the read token differs from the upload session id.
  ;<  ~  b  (jab-bowl |=(bol=bowl bol(eny 0v5678)))
  ;<  read-caz=(list card)  b  (ask 0v2 [%bucket flag [%issue-bucket-read ~]])
  =/  read-token=@t  (scot %uv 0v5678)
  =/  expiry=@da  (add ~2026.1.1 ~m30)
  ;<  ~  b
    %+  ex-cards  read-caz
    ::  the refresh is armed while applying the action, so it precedes the
    ::  response the request settles with
    :~  %-  ex-arvo
        :*  /buckets/token/~sampel-palnet/project-files
            [%b %wait (sub expiry ~m5)]
        ==
        (grant-fact 0v2 [%token read-token expiry])
    ==
  ;<  ok-cage=cage  b
    (got-peek /x/v1/broker/read/[read-token]/[object-key.fil])
  ;<  bad-cage=cage  b
    (got-peek /x/v1/broker/read/[read-token]/wrong-object)
  =/  ok-json=json  !<(json q.ok-cage)
  =/  ok-result=@t
    (so:dejs:format (get:dejs:buckets-json 'result' ok-json))
  =/  payload=json  (get:dejs:buckets-json 'read' ok-json)
  =/  ok-name=@t
    (so:dejs:format (get:dejs:buckets-json 'displayFilename' payload))
  =/  bad-result=@t
    (so:dejs:format (get:dejs:buckets-json 'result' !<(json q.bad-cage)))
  ::  the token names no object, so the bucket's own file is authorized while
  ::  a key that belongs to no entry is refused
  (ex-equal !>([ok-result ok-name bad-result]) !>([%'authorized' 'private.pdf' %'denied']))
::
::  Expired grants and pending sessions are swept the next time authority is
::  touched, and their reservation bindings go with them.
::
++  test-expired-authority-is-pruned
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  =/  rid=@t  '00000000-0000-0000-0000-000000000003'
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  *  b  (ask 0v1 [%bucket flag [%begin-upload ~ 'private.pdf' 'application/pdf' 42 ~]])
  ;<  *  b
    (do-poke %buckets-broker-command-1 !>(`broker-command:bu`[%authorize-upload seed-token rid]))
  ;<  ~  b  (jab-bowl |=(bol=bowl bol(now ~2026.1.2, eny 0v9999)))
  ;<  *  b  (ask 0v2 [%bucket flag [%begin-upload ~ 'later.pdf' 'application/pdf' 7 ~]])
  ;<  sv=vase  b  get-save
  =/  st=state-0:bu  !<(state-0:bu sv)
  %+  ex-equal
  !>  :*  (~(has by sessions.st) seed)
          (~(has by reservations.st) rid)
          ~(wyt by sessions.st)
      ==
  !>([%.n %.n 1])
::
::  A subscriber forwards to the host, subscribes for the answer, arms a
::  timeout, and tells its own client the request is in flight.
::
++  test-subscriber-forwards-and-reports-pending
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  =/  act=action:bu  [%bucket flag [%create-folder ~ 'Launch']]
  ;<  ~  b  (setup-as ~bus)
  ;<  *  b
    (do-poke %group-channel-join !>(`channel-join:bu`[[%buckets ~sampel-palnet %project-files] group]))
  ;<  caz=(list card)  b  (ask 0v4 act)
  %+  ex-cards  caz
  :~  %-  ex-poke
      :*  /buckets/req/~sampel-palnet/0v4/poke
          [~sampel-palnet %buckets]
          %buckets-command-1
          !>(`command:bu`[0v4 act])
      ==
      %-  ex-task
      :*  /buckets/req/~sampel-palnet/0v4/watch
          [~sampel-palnet %buckets]
          [%watch /v1/request/~bus/0v4]
      ==
      %-  ex-arvo
      :*  /buckets/req/~sampel-palnet/0v4/wake
          [%b %wait (add ~2026.1.1 ~m2)]
      ==
      (grant-fact 0v4 [%pending ~])
  ==
::
::  A kick is not a revocation. The replica survives and the subscription is
::  re-established; only a nack from the host drops the bucket.
::
++  test-kick-resubscribes
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  (setup-as ~bus)
  ;<  *  b
    (do-poke %group-channel-join !>(`channel-join:bu`[[%buckets ~sampel-palnet %project-files] group]))
  ;<  caz=(list card)  b
    %^    do-agent
        /buckets/sub/~sampel-palnet/project-files
      [~sampel-palnet %buckets]
    [%kick ~]
  ;<  ~  b
    %+  ex-cards  caz
    :~  %-  ex-task
        :*  /buckets/sub/~sampel-palnet/project-files
            [~sampel-palnet %buckets]
            [%watch /v1/buckets/~sampel-palnet/project-files/updates]
        ==
    ==
  ;<  sv=vase  b  get-save
  =/  st=state-0:bu  !<(state-0:bu sv)
  (ex-equal !>((~(has by spaces.st) flag)) !>(%.y))
::
::  A member without a writer role is refused with a typed error rather than
::  a bare crash, so the requester learns why.
::
++  test-remote-write-denied-without-permission
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  ~  b  (set-scry-gate missing-group-permission-scries)
  ;<  caz=(list card)  b
    %-  (do-as ~bus)
    %+  do-poke  %buckets-command-1
    !>(`command:bu`[0v5 [%bucket flag [%create-folder ~ 'Launch']]])
  %+  ex-cards  caz
  :~  %-  ex-fact
      :*  ~[/v1/request/~bus/0v5]
          %buckets-req-response-1
          !>(`req-response:bu`[0v5 [%error %not-authorized 'not authorized for this bucket']])
      ==
  ==
::
::  A member holding a configured writer role is accepted.
::
++  test-remote-write-allowed-with-writer-role
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  *  b
    (ask 0v0 [%create %project-files 'Project Files' group ~ (silt ~[%editor])])
  ;<  ~  b  (set-scry-gate group-permission-scries)
  ;<  *  b
    %-  (do-as ~bus)
    %+  do-poke  %buckets-command-1
    !>(`command:bu`[0v6 [%bucket flag [%create-folder ~ 'Launch']]])
  ;<  sv=vase  b  get-save
  =/  st=state-0:bu  !<(state-0:bu sv)
  =/  bs=bucket-state:bu  (state-for st flag)
  (ex-equal !>([~(wyt by entries.bs) revision.bs]) !>([1 1]))
::
::  A non-host admin forwards creation to the group host rather than
::  allocating storage on its own ship.
::
++  test-non-host-admin-forwards-create
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  =/  act=action:bu
    [%create %project-files 'Project Files' group ~ ~]
  ;<  ~  b  (setup-as ~bus)
  ;<  ~  b  (set-scry-gate allow-admin-create-scries)
  ;<  caz=(list card)  b  (ask 0v1 act)
  %+  ex-cards  caz
  :~  %-  ex-poke
      :*  /buckets/req/~sampel-palnet/0v1/poke
          [~sampel-palnet %buckets]
          %buckets-command-1
          !>(`command:bu`[0v1 act])
      ==
      %-  ex-task
      :*  /buckets/req/~sampel-palnet/0v1/watch
          [~sampel-palnet %buckets]
          [%watch /v1/request/~bus/0v1]
      ==
      %-  ex-arvo
      :*  /buckets/req/~sampel-palnet/0v1/wake
          [%b %wait (add ~2026.1.1 ~m2)]
      ==
      (grant-fact 0v1 [%pending ~])
  ==
::
::  A Moon cannot own Bucket storage, even when it hosts the group and the
::  caller is an admin.
::
++  test-moon-host-cannot-create
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  =/  moon=ship  ~pinser-botter-sampel-palnet
  =/  moon-group=flag:bu  [moon %test-group]
  ;<  ~  b  (setup-as moon)
  ;<  ~  b  (set-scry-gate allow-admin-create-scries)
  ;<  caz=(list card)  b
    (ask 0v1 [%create %project-files 'Project Files' moon-group ~ ~])
  %+  ex-cards  caz
  :~  %+  grant-fact  0v1
      [%error %invalid-input 'only a planet may host a bucket']
  ==
::
::  The authoritative group host accepts a live remote admin, owns the Bucket,
::  and records the initiating admin as its creator.
::
++  test-remote-admin-creates-on-group-host
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  (set-scry-gate allow-admin-create-scries)
  ;<  *  b
    %-  (do-as ~bus)
    %+  do-poke  %buckets-command-1
    !>(`command:bu`[0v1 [%create %project-files 'Project Files' group ~ ~]])
  ;<  sv=vase  b  get-save
  =/  st=state-0:bu  !<(state-0:bu sv)
  =/  bs=bucket-state:bu  (state-for st flag)
  %+  ex-equal
  !>([created-by.bucket.bs updated-by.bucket.bs group.bs])
  !>([~bus ~bus group])
::
::  Gall retries reuse the caller-selected random name. An identical retry
::  must not allocate a second Bucket.
::
++  test-create-retry-is-idempotent
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  =/  cmd=command:bu
    [0v1 [%create %project-files 'Project Files' group ~ ~]]
  ;<  ~  b  setup
  ;<  ~  b  (set-scry-gate allow-admin-create-scries)
  ;<  *  b  ((do-as ~bus) (do-poke %buckets-command-1 !>(cmd)))
  ;<  *  b  ((do-as ~bus) (do-poke %buckets-command-1 !>(cmd)))
  ;<  sv=vase  b  get-save
  =/  st=state-0:bu  !<(state-0:bu sv)
  (ex-equal !>([next-id.st ~(wyt by spaces.st)]) !>([1 1]))
::
::  +on-load must round-trip the persisted state unchanged. A cast failure
::  here silently reverts the whole |commit, so it is worth pinning even with
::  nothing to migrate from.
::
++  test-load-round-trips-state
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  *  b  (ask 0v1 [%bucket flag [%create-folder ~ 'Launch']])
  ;<  before=vase  b  get-save
  ;<  *  b  (do-load buckets-agent `before)
  ;<  after=vase  b  get-save
  (ex-equal after before)
::  +http-post: submit an action over the Eyre surface.
::
++  http-post
  |=  [authed=? body=@t]
  =/  m  (mare ,(list card))
  ^-  form:m
  %+  do-poke  %handle-http-request
  !>  ^-  [@ta inbound-request:eyre]
  :-  'eyre-0'
  :*  authenticated=authed
      secure=&
      address=[%ipv4 .0.0.0.0]
      :*  method=%'POST'
          url='/buckets/~/v1'
          header-list=~
          body=`(as-octs:mimes:html body)
      ==
  ==
::
++  http-header
  |=  [code=@ud ct=@t]
  %^    ex-fact
      [/http-response/eyre-0]~
    %http-response-header
  !>(`response-header:http`[code ~[['content-type' ct]]])
::
::  An action submitted over HTTP is answered on that same request, so a
::  client needs no correlation of its own. A refusal comes back as a typed
::  error with a 200, not as a crash.
::
++  test-http-post-answers-inline
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  =/  body=@t
    '{"requestId":"0v5","action":{"type":"create","name":"smoke","title":"Smoke","group":{"host":"~pinser-botter-sampel-palnet","name":"demo"},"readers":[],"writers":[]}}'
  ;<  ~  b  setup
  ;<  caz=(list card)  b  (http-post & body)
  ::  the answer goes to the local subscription first, then closes out the
  ::  held request — same body, two deliveries.
  %+  ex-cards  caz
  :~  %+  grant-fact  0v5
      [%error %invalid-input 'only a planet may host a bucket']
      (http-header 200 'application/json')
      (ex-fact-paths [/http-response/eyre-0]~)
      (ex-card [%give %kick [/http-response/eyre-0]~ ~])
  ==
::
::  Eyre validates the session; an unauthenticated request never reaches
::  the action layer.
::
++  test-http-requires-authentication
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  caz=(list card)  b  (http-post | '{"action":{"type":"create"}}')
  %+  ex-cards  caz
  :~  (http-header 401 'text/plain')
      (ex-fact-paths [/http-response/eyre-0]~)
      (ex-card [%give %kick [/http-response/eyre-0]~ ~])
  ==
::
::  A body that is not a recognizable action is a client error, not a crash.
::
++  test-http-rejects-malformed-action
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  caz=(list card)  b  (http-post & '{"action":{"type":"no-such-verb"}}')
  %+  ex-cards  caz
  :~  (http-header 400 'text/plain')
      (ex-fact-paths [/http-response/eyre-0]~)
      (ex-card [%give %kick [/http-response/eyre-0]~ ~])
  ==
--
