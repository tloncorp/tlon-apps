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
::  +genuine-scries: %buckets authenticates itself to the broker with the
::  secret %genuine holds, so anything that mints or revokes a token reads it.
::
++  genuine-scries
  |=  pax=path
  ^-  (unit vase)
  ?:  ?=([%gu @ %genuine *] pax)  `!>(&)
  ?:  ?=([%gx @ %genuine @ %secret %json ~] pax)
    `!>(`json`[%s '0wsecret'])
  ~
::
::  +only-iris: the single outbound HTTP request in a card list.
::
++  only-iris
  |=  caz=(list card)
  ^-  [=wire =request:http]
  =/  found=(list [wire request:http])
    %+  murn  caz
    |=  =card
    ^-  (unit [wire request:http])
    ?.  ?=([%pass * %arvo %i %request * *] card)  ~
    `[p.card request.q.card]
  ?~  found  ~|(%no-iris-card !!)
  i.found
::
::  +ex-iris: an outbound HTTP request on the given wire. The request itself
::  is checked field by field rather than matched whole, so the assertion
::  does not depend on JSON key order.
::
++  ex-iris
  |=  =wire
  |=  car=card
  ^-  tang
  ?.  ?=([%pass * %arvo %i %request * *] car)
    ~[leaf+"expected an outbound http request, got:" >car<]
  ?:  =(wire p.car)  ~
  ~[leaf+"iris request on the wrong wire" >wire< >p.car<]
::
::  +push-wire-for: the wire a token mint rides while the broker answers.
::
++  push-wire-for
  |=  [token=@t expiry=@da rid=@uv]
  ^-  wire
  %+  weld
    /buckets/push/~sampel-palnet/project-files
  /~sampel-palnet/[token]/(scot %da expiry)/(scot %uv rid)
::
++  iris-ok
  ^-  sign-arvo
  [%iris %http-response [%finished [200 ~] ~]]
::
++  iris-status
  |=  code=@ud
  ^-  sign-arvo
  [%iris %http-response [%finished [code ~] ~]]
::
::  +reader-scries: %genuine plus a group that grants read access.
::
++  reader-scries
  |=  pax=path
  ^-  (unit vase)
  ?:  ?=([%gx @ %groups @ %v2 %groups @ @ %channels %can-read %noun ~] pax)
    `!>(|=([who=ship =nest:bu] &))
  (genuine-scries pax)
::
::  +revoked-scries: the same, after read access has been pulled.
::
++  revoked-scries
  |=  pax=path
  ^-  (unit vase)
  ?:  ?=([%gx @ %groups @ %v2 %groups @ @ %channels %can-read %noun ~] pax)
    `!>(|=([who=ship =nest:bu] |))
  (genuine-scries pax)
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
  ;<  ~  b  (set-scry-gate genuine-scries)
  ;<  read-caz=(list card)  b  (ask 0v2 [%bucket flag [%issue-bucket-read ~]])
  =/  read-token=@t  (scot %uv 0v5678)
  =/  expiry=@da  (add ~2026.1.1 ~d1)
  ::  A mint is not a token yet: it goes to the broker first, and the client
  ::  is told %pending until the broker has it.
  ;<  ~  b
    %+  ex-cards  read-caz
    :~  (ex-iris (push-wire-for read-token expiry 0v2))
        (grant-fact 0v2 [%pending ~])
    ==
  =/  push=[=wire =request:http]  (only-iris read-caz)
  =/  body=json
    ?~  body.request.push  ~
    (need (de:json:html q.u.body.request.push))
  =/  field=$-(@t @t)
    |=(key=@t (so:dejs:format (get:dejs:buckets-json key body)))
  ;<  ~  b
    %+  ex-equal
      !>  :*  method.request.push
              url.request.push
              (field 'token')
              (field 'bucketHost')
              (field 'bucketName')
              (field 'actorShip')
          ==
    !>  :*  %'PUT'
            'https://memex.tlon.network/v2/buckets/tokens/sampel-palnet?token=0wsecret'
            read-token
            'sampel-palnet'
            'project-files'
            'sampel-palnet'
        ==
  ::  Only once the broker has accepted it does the token become real: the
  ::  refresh is armed, then the request settles with the token.
  ;<  confirm-caz=(list card)  b  (do-arvo wire.push iris-ok)
  ;<  ~  b
    %+  ex-cards  confirm-caz
    :~  %-  ex-arvo
        :*  /buckets/token/~sampel-palnet/project-files
            [%b %wait (sub expiry ~h1)]
        ==
        (grant-fact 0v2 [%token read-token expiry])
    ==
  ::  The client reads the held token over Eyre as JSON, so the peek has to
  ::  answer a mark that grows to json -- %noun does not.
  ;<  held-cage=cage  b
    (got-peek /x/v1/buckets/~sampel-palnet/project-files/read-token)
  ;<  ~  b
    %+  ex-equal
      !>  :-  p.held-cage
          (read-token:enjs:buckets-json !<(read-token:bu q.held-cage))
    !>  :-  %buckets-read-token-1
        %-  pairs:enjs:format
        :~  ['token' s+read-token]
            ['expiresAt' s+(scot %da expiry)]
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
::  A broker that predates pushed tokens has no route to push to, and answers
::  404. It will ask us over Pioneer instead, so the mint stands rather than
::  being thrown away — this is what lets the two halves deploy in either
::  order. A refusal that is not a 404 does throw the mint away.
::
++  test-old-broker-keeps-the-mint
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  ~  b  (set-scry-gate reader-scries)
  ;<  mint-caz=(list card)  b  (ask 0v2 [%bucket flag [%issue-bucket-read ~]])
  =/  push=[=wire =request:http]  (only-iris mint-caz)
  ;<  *  b  (do-arvo wire.push (iris-status 404))
  ;<  sv=vase  b  get-save
  =/  st=state-0:bu  !<(state-0:bu sv)
  ::  a second reader, so the mint is fresh rather than the one just kept,
  ::  against a broker that refuses it outright
  ;<  ~  b  (jab-bowl |=(bol=bowl bol(eny 0v9999)))
  ;<  again-caz=(list card)  b
    %-  (do-as ~bus)
    %+  do-poke  %buckets-command-1
    !>(`command:bu`[0v3 [%bucket flag [%issue-bucket-read ~]]])
  =/  retry=[=wire =request:http]  (only-iris again-caz)
  ;<  *  b  (do-arvo wire.retry (iris-status 500))
  ;<  sv2=vase  b  get-save
  =/  st2=state-0:bu  !<(state-0:bu sv2)
  ::  the 404 mint is real and ours; the 500 mint left nothing behind
  %+  ex-equal
    !>  :*  (~(has by read-tokens.st) flag)
            ~(wyt by object-capabilities.st)
            ~(wyt by object-capabilities.st2)
        ==
  !>([%.y 1 1])
::
::  Deleting a folder has to take the uploads underneath it. Their entries are
::  deliberately absent from the manifest until the object lands, so they are
::  never among the folder's descendants -- and a session left behind would
::  later publish a file parented to a folder that no longer exists.
::
++  test-deleting-a-folder-drops-uploads-under-it
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  *  b  (ask 0v1 [%bucket flag [%create-folder ~ 'Launch']])
  ;<  sv=vase  b  get-save
  =/  st=state-0:bu  !<(state-0:bu sv)
  =/  bs=bucket-state:bu  (state-for st flag)
  =/  folder=@ud
    =/  ents  ~(tap by entries.bs)
    ?~(ents !! p.i.ents)
  ::  an upload lands inside that folder, and one at the root
  ;<  *  b
    (ask 0v2 [%bucket flag [%begin-upload `folder 'inside.pdf' 'application/pdf' 9 ~]])
  ;<  ~  b  (jab-bowl |=(bol=bowl bol(eny 0v4321)))
  ;<  *  b
    (ask 0v3 [%bucket flag [%begin-upload ~ 'outside.pdf' 'application/pdf' 9 ~]])
  ;<  sv2=vase  b  get-save
  =/  st2=state-0:bu  !<(state-0:bu sv2)
  =/  before=@ud  ~(wyt by sessions.st2)
  ::  deleting the folder recursively takes the upload inside it, not the other
  ;<  *  b  (ask 0v5 [%bucket flag [%entry folder [%delete &]]])
  ;<  sv3=vase  b  get-save
  =/  st3=state-0:bu  !<(state-0:bu sv3)
  =/  survivors=(list @t)
    %+  turn  ~(val by sessions.st3)
    |=(ses=upload-session:bu name.entry.ses)
  (ex-equal !>([before survivors]) !>([2 ~['outside.pdf']]))
::
::  A mint lives only on the wire while the broker answers, so the revocation
::  pass cannot see it. If access is pulled in that window the token must not
::  be installed on arrival -- the broker has already accepted it, so it is
::  revoked instead and the requester told no.
::
++  test-in-flight-token-rechecks-access
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  ~  b  (set-scry-gate reader-scries)
  ;<  mint-caz=(list card)  b
    %-  (do-as ~bus)
    %+  do-poke  %buckets-command-1
    !>(`command:bu`[0v9 [%bucket flag [%issue-bucket-read ~]]])
  =/  push=[=wire =request:http]  (only-iris mint-caz)
  ::  access is pulled while the push is in flight
  ;<  ~  b  (set-scry-gate revoked-scries)
  ;<  caz=(list card)  b  (do-arvo wire.push iris-ok)
  =/  revoke=[=wire =request:http]  (only-iris caz)
  ;<  sv=vase  b  get-save
  =/  st=state-0:bu  !<(state-0:bu sv)
  ::  nothing installed, the broker told to drop it, the asker refused
  ;<  ~  b
    %+  ex-equal
      !>  :-  ~(wyt by object-capabilities.st)
          method.request.revoke
    !>([0 %'DELETE'])
  %+  ex-cards  (skim caz |=(car=card ?=([%give %fact *] car)))
  :~  %+  ex-fact  ~[/v1/request/~bus/0v9]
      :-  %buckets-req-response-1
      !>  ^-  req-response:bu
      [0v9 [%error %not-authorized 'no longer permitted to read this bucket']]
  ==
::
::  A revoke the broker did not confirm is not a revoke. Dropping the token
::  locally does not stop it working -- the broker honours a pushed token
::  without asking us again -- so a transient failure has to be retried rather
::  than logged and forgotten.
::
++  test-failed-revocation-is-retried
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  ~  b  (set-scry-gate reader-scries)
  ;<  mint-caz=(list card)  b
    %-  (do-as ~bus)
    %+  do-poke  %buckets-command-1
    !>(`command:bu`[0v11 [%bucket flag [%issue-bucket-read ~]]])
  =/  push=[=wire =request:http]  (only-iris mint-caz)
  ;<  *  b  (do-arvo wire.push iris-ok)
  ::  access is pulled, so the token is revoked at the broker
  ;<  ~  b  (set-scry-gate revoked-scries)
  ;<  caz=(list card)  b
    %^    do-agent
        /groups
      [~sampel-palnet %groups]
    [%fact %group-update !>([group %noun])]
  =/  revoke=[=wire =request:http]  (only-iris caz)
  ::  the broker fails it; the outbox keeps it and a retry is armed
  ;<  failed=(list card)  b  (do-arvo wire.revoke (iris-status 503))
  ;<  sv=vase  b  get-save
  =/  st=state-0:bu  !<(state-0:bu sv)
  ;<  ~  b  (ex-equal !>(~(wyt by revoking.st)) !>(1))
  ::  the retry timer re-sends it, and a 2xx finally clears the outbox
  ;<  retried=(list card)  b
    (do-arvo /buckets/revoke-retry [%behn %wake ~])
  =/  again=[=wire =request:http]  (only-iris retried)
  ;<  *  b  (do-arvo wire.again iris-ok)
  ;<  sv2=vase  b  get-save
  =/  st2=state-0:bu  !<(state-0:bu sv2)
  %+  ex-equal
    !>  :*  wire.again
            method.request.again
            ~(wyt by revoking.st2)
        ==
  !>([wire.revoke %'DELETE' 0])
::
::  A reader that took a token and then dropped its subscription still has to
::  be revoked. It produces no kick, and the broker honours a pushed token
::  without asking us again, so deriving revocations from the subscription
::  list alone would leave a bearer token working until it lapsed.
::
++  test-revokes-a-token-held-by-an-unsubscribed-reader
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  ~  b  (set-scry-gate reader-scries)
  ::  ~bus takes a token, and never appears in sup.bowl
  ;<  mint-caz=(list card)  b
    %-  (do-as ~bus)
    %+  do-poke  %buckets-command-1
    !>(`command:bu`[0v8 [%bucket flag [%issue-bucket-read ~]]])
  =/  push=[=wire =request:http]  (only-iris mint-caz)
  ;<  *  b  (do-arvo wire.push iris-ok)
  ;<  sv=vase  b  get-save
  =/  st=state-0:bu  !<(state-0:bu sv)
  ::  then it loses read access
  ;<  ~  b  (set-scry-gate revoked-scries)
  ;<  caz=(list card)  b
    %^    do-agent
        /groups
      [~sampel-palnet %groups]
    [%fact %group-update !>([group %noun])]
  =/  revoke=[=wire =request:http]  (only-iris caz)
  ;<  sv2=vase  b  get-save
  =/  st2=state-0:bu  !<(state-0:bu sv2)
  =/  kicks=(list card)
    %+  skim  caz
    |=(car=card ?=([%give %kick *] car))
  ::  no kick, because it was not subscribed -- but the token is gone locally
  ::  and the broker is told to drop it
  %+  ex-equal
    !>  :*  ~(wyt by object-capabilities.st)
            ~(wyt by object-capabilities.st2)
            method.request.revoke
            (lent kicks)
        ==
  !>([1 0 %'DELETE' 0])
::
::  A reader who loses group access stops reading immediately: the host kicks
::  the subscription and tells the broker to drop that reader's token, rather
::  than leaving it live until it lapses.
::
++  test-losing-read-access-revokes-the-token
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  ~  b  (set-scry-gate reader-scries)
  ::  a remote reader asks the host for a token, and the broker accepts it
  ;<  mint-caz=(list card)  b
    %-  (do-as ~bus)
    %+  do-poke  %buckets-command-1
    !>(`command:bu`[0v7 [%bucket flag [%issue-bucket-read ~]]])
  =/  push=[=wire =request:http]  (only-iris mint-caz)
  ;<  *  b  (do-arvo wire.push iris-ok)
  ;<  sv=vase  b  get-save
  =/  st=state-0:bu  !<(state-0:bu sv)
  =/  minted=@ud  ~(wyt by object-capabilities.st)
  ::  the reader is subscribed, and then loses read access
  ;<  ~  b
    %-  jab-bowl
    |=  bol=bowl
    %=    bol
        sup
      %-  malt
      :~  :-  ~[/reader]
          [~bus /v1/buckets/~sampel-palnet/project-files/updates]
      ==
    ==
  ;<  ~  b  (set-scry-gate revoked-scries)
  ;<  kick-caz=(list card)  b
    %^    do-agent
        /groups
      [~sampel-palnet %groups]
    [%fact %group-update !>([group %noun])]
  =/  revoke=[=wire =request:http]  (only-iris kick-caz)
  ;<  sv2=vase  b  get-save
  =/  st2=state-0:bu  !<(state-0:bu sv2)
  =/  kicked=(list ship)
    %+  murn  kick-caz
    |=  car=card
    ?.(?=([%give %kick * ^] car) ~ ship.p.car)
  %+  ex-equal
    !>  :*  minted
            method.request.revoke
            url.request.revoke
            ~(wyt by object-capabilities.st2)
            kicked
        ==
  !>  :*  1
          %'DELETE'
          %+  rap  3
          :~  'https://memex.tlon.network/v2/buckets/tokens/sampel-palnet/'
              (scot %uv 0v1234)  '?token=0wsecret'
          ==
          0
          ~[~bus]
      ==
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
  ::  The watch precedes the poke, so a host that answers in the same event it
  ::  is poked cannot publish its fact before we are listening.
  %+  ex-cards  caz
  :~  %-  ex-task
      :*  /buckets/req/~sampel-palnet/0v4/watch
          [~sampel-palnet %buckets]
          [%watch /v1/request/~bus/0v4]
      ==
      %-  ex-poke
      :*  /buckets/req/~sampel-palnet/0v4/poke
          [~sampel-palnet %buckets]
          %buckets-command-1
          !>(`command:bu`[0v4 act])
      ==
      %-  ex-arvo
      :*  /buckets/req/~sampel-palnet/0v4/wake
          [%b %wait (add ~2026.1.1 ~m2)]
      ==
      (grant-fact 0v4 [%pending ~])
  ==
::
::  A host's %pending is not an answer. A forwarded request stays open across
::  it, so the real answer that follows still settles the client -- this is the
::  path a cold-start read on a remote bucket takes, where the host has to
::  reach the broker before it can hand back a token.
::
++  test-forwarded-request-survives-a-pending-answer
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  =/  act=action:bu  [%bucket flag [%issue-bucket-read ~]]
  ;<  ~  b  (setup-as ~bus)
  ;<  *  b
    (do-poke %group-channel-join !>(`channel-join:bu`[[%buckets ~sampel-palnet %project-files] group]))
  ;<  *  b  (ask 0v4 act)
  ::  the host says it is still working; nothing is settled and the request
  ::  must stay open
  ;<  waiting=(list card)  b
    %^    do-agent
        /buckets/req/~sampel-palnet/0v4/watch
      [~sampel-palnet %buckets]
    :+  %fact  %buckets-req-response-1
    !>(`req-response:bu`[0v4 [%pending ~]])
  ;<  ~  b  (ex-cards waiting ~)
  ::  then the real answer lands, and it settles
  =/  tok=read-token:bu  ['0v1.2345' (add ~2026.1.1 ~d1)]
  ;<  answered=(list card)  b
    %^    do-agent
        /buckets/req/~sampel-palnet/0v4/watch
      [~sampel-palnet %buckets]
    :+  %fact  %buckets-req-response-1
    !>(`req-response:bu`[0v4 [%token tok]])
  ;<  sv=vase  b  get-save
  =/  st=state-0:bu  !<(state-0:bu sv)
  ;<  ~  b
    %+  ex-equal
      !>((~(get by read-tokens.st) flag))
    !>(`tok)
  %+  ex-cards  answered
  :~  %-  ex-task
      :*  /buckets/req/~sampel-palnet/0v4/watch
          [~sampel-palnet %buckets]
          [%leave ~]
      ==
      %-  ex-arvo
      :*  /buckets/req/~sampel-palnet/0v4/wake
          [%b %rest (add ~2026.1.1 ~m2)]
      ==
      %-  ex-arvo
      :*  /buckets/token/~sampel-palnet/project-files
          [%b %wait (sub expires-at.tok ~h1)]
      ==
      (grant-fact 0v4 [%token tok])
  ==
::
::  Read tokens are bucket-scoped, so a token answer has to be filed under the
::  bucket its request named. Two buckets on one host is where guessing from
::  the host goes wrong: whichever the map happened to yield first would take
::  the other's token, leaving one wrong and one empty.
::
++  test-remote-token-is-filed-under-its-own-bucket
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  =/  other=flag:bu  [~sampel-palnet %archive]
  ;<  ~  b  (setup-as ~bus)
  ;<  *  b
    (do-poke %group-channel-join !>(`channel-join:bu`[[%buckets ~sampel-palnet %project-files] group]))
  ;<  *  b
    (do-poke %group-channel-join !>(`channel-join:bu`[[%buckets ~sampel-palnet %archive] group]))
  ::  ask for a token on the second bucket
  ;<  *  b  (ask 0v7 [%bucket other [%issue-bucket-read ~]])
  =/  tok=read-token:bu  ['0v9.8765' (add ~2026.1.1 ~d1)]
  ;<  *  b
    %^    do-agent
        /buckets/req/~sampel-palnet/0v7/watch
      [~sampel-palnet %buckets]
    :+  %fact  %buckets-req-response-1
    !>(`req-response:bu`[0v7 [%token tok]])
  ;<  sv=vase  b  get-save
  =/  st=state-0:bu  !<(state-0:bu sv)
  ::  it lands on the bucket that asked, and the sibling still holds none
  %+  ex-equal
    !>  :-  (~(get by read-tokens.st) other)
        (~(get by read-tokens.st) flag)
  !>([`tok ~])
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
  :~  %-  ex-task
      :*  /buckets/req/~sampel-palnet/0v1/watch
          [~sampel-palnet %buckets]
          [%watch /v1/request/~bus/0v1]
      ==
      %-  ex-poke
      :*  /buckets/req/~sampel-palnet/0v1/poke
          [~sampel-palnet %buckets]
          %buckets-command-1
          !>(`command:bu`[0v1 act])
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
