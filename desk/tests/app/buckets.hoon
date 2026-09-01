::  behavior tests for the %buckets Gall agent
::
/-  bu=buckets, gv=groups-ver
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
++  group-exists-path
  |=  pax=path
  ^-  ?
  ?=([%gu @ %groups @ %groups @ @ ~] pax)
::
++  genuine-scries
  |=  pax=path
  ^-  (unit vase)
  ?:  ?=([%gu @ %genuine *] pax)  `!>(&)
  ?:  (group-exists-path pax)  `!>(&)
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
::  +reader-wire-for: the wire one reader-sync rides. The revision is what
::  the broker answers about, so it is what the wire carries.
::
++  reader-wire-for
  |=  [reader=@p revision=@ud]
  ^-  wire
  %+  weld
    /buckets/reader/~sampel-palnet/project-files
  /(scot %p reader)/(scot %ud revision)
::
::  +granted-count: pairs currently holding a grant, whatever their sync state.
::
++  granted-count
  |=  st=state-0:bu
  ^-  @ud
  %-  lent
  %+  skim  ~(val by readers.st)
  |=(sync=reader-sync:bu ?=(%granted -.desired.sync))
::
::  +owed-count: pairs the broker has not caught up with.
::
++  owed-count
  |=  st=state-0:bu
  ^-  @ud
  %-  lent
  %+  skim  ~(val by readers.st)
  ::  mirrors +owed: a revision the broker rejected as invalid is not owed
  |=(sync=reader-sync:bu &(!failed.sync (gth revision.sync synced.sync)))
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
::  +iris-revision: an answer carrying the revision the broker says it holds.
::
++  iris-revision
  |=  [code=@ud revision=@ud]
  ^-  sign-arvo
  =/  body=@t
    (en:json:html (pairs:enjs:format ~[['currentRevision' (numb:enjs:format revision)]]))
  :+  %iris  %http-response
  :+  %finished  [code ~]
  `['application/json' [(met 3 body) body]]
::
::  +iris-receipt: the broker's full answer to a sync, which says outright
::  whether it took the write rather than leaving it to be inferred.
::
++  iris-receipt
  |=  [revision=@ud applied=?]
  ^-  sign-arvo
  =/  body=@t
    %-  en:json:html
    %-  pairs:enjs:format
    :~  ['currentRevision' (numb:enjs:format revision)]
        ['applied' b+applied]
    ==
  :+  %iris  %http-response
  :+  %finished  [200 ~]
  `['application/json' [(met 3 body) body]]
::
::  +iris-grant: the broker answering our own upload-grant call.
::
++  iris-grant
  |=  [reservation=@t url=@t]
  ^-  sign-arvo
  =/  body=@t
    %-  en:json:html
    %-  pairs:enjs:format
    :~  ['reservationId' s+reservation]
        ['objectId' s+seed-token]
        ['uploadUrl' s+url]
        ['uploadExpiresAtMillis' (numb:enjs:format 1.767.240.000.000)]
        :-  'requiredHeaders'
        a+~[a+~[s+'content-type' s+'application/pdf']]
    ==
  :+  %iris  %http-response
  :+  %finished  [200 ~]
  `['application/json' [(met 3 body) body]]
::
::  +iris-object: the receipt the broker returns when we complete an upload.
::
++  iris-object
  |=  [object=@t size=@ud mime=@t]
  ^-  sign-arvo
  =/  body=@t
    %-  en:json:html
    %-  pairs:enjs:format
    :~  ['objectId' s+object]
        ['size' (numb:enjs:format size)]
        ['mimeType' s+mime]
    ==
  :+  %iris  %http-response
  :+  %finished  [200 ~]
  `['application/json' [(met 3 body) body]]
::
::  +begun: open an upload and take the broker's grant, leaving a session
::  whose reservation is bound. The shape every upload test starts from.
::
++  begun
  |=  [rid=@uv name=@t size=@ud]
  =/  m  (mare ,(list card))
  ^-  form:m
  ;<  ~  bind:m  (set-scry-gate genuine-scries)
  ;<  caz=(list card)  bind:m
    (ask rid [%bucket flag [%begin-upload ~ name 'application/pdf' size ~]])
  =/  push=[=wire =request:http]  (only-iris caz)
  (do-arvo wire.push (iris-grant 'res-1' 'https://storage.test/put'))
::
::  +iris-refusal: the broker's shape for a failure it has classified.
::
++  iris-refusal
  |=  [code=@ud retryable=?]
  ^-  sign-arvo
  =/  body=@t
    %-  en:json:html
    %-  pairs:enjs:format
    :~  ['code' s+'malformed_input']
        ['message' s+'nope']
        ['retryable' b+retryable]
    ==
  :+  %iris  %http-response
  :+  %finished  [code ~]
  `['application/json' [(met 3 body) body]]
::
::  +sync-for: the pair's sync record, for asserting revisions directly.
::
++  sync-for
  |=  [st=state-0:bu reader=@p]
  ^-  reader-sync:bu
  (~(got by readers.st) [flag reader])
::
::  +group-changed: a well-formed %groups fact about `group`.
::
::  The agent decodes these strictly, as %channels-server does, so a stub
::  noun here would pass a test the live path could not survive. %meta is the
::  least interesting variant that still says "this group changed".
::
++  group-changed
  ^-  r-groups:v9:gv
  [group [%meta ['' '' '' '']]]
::
::  +role-deleted: the same, saying a role is gone.
::
++  role-deleted
  |=  roles=(set @tas)
  ^-  r-groups:v9:gv
  [group [%role roles [%del ~]]]
::
::  +answers: the terminal responses in a card list. Not every fact is one --
::  /lib/verb emits its own -- so this matches on the mark rather than on
::  %give %fact, which quietly counted logging as an answer.
::
++  answers
  |=  caz=(list card)
  ^-  (list card)
  %+  skim  caz
  |=(=card ?=([%give %fact * %buckets-req-response-1 *] card))
::
::  +only-answer: the body of the one answer a settled action produced.
::
++  only-answer
  |=  caz=(list card)
  ^-  response-body:bu
  =/  found=(list response-body:bu)
    %+  murn  caz
    |=  =card
    ^-  (unit response-body:bu)
    ?.  ?=([%give %fact * %buckets-req-response-1 *] card)  ~
    `body:!<(req-response:bu q.cage.p.card)
  ?~  found  ~|(%no-answer !!)
  i.found
::
::  +secretless-scries: the group is there, but %genuine has not initialised.
::  A real state on a fresh ship, and the one place a mint is answered in the
::  same event that records what is owed.
::
++  secretless-scries
  |=  pax=path
  ^-  (unit vase)
  ?:  ?=([%gu @ %genuine *] pax)  `!>(|)
  ?:  (group-exists-path pax)  `!>(&)
  ~
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
::  +missing-group-scries: %groups no longer holds the group, which is what a
::  deletion looks like. The permission gates must not be reached at all here
::  -- if they were, the mock would block and the example would fail.
::
++  missing-group-scries
  |=  pax=path
  ^-  (unit vase)
  ?:  (group-exists-path pax)  `!>(|)
  (genuine-scries pax)
::
++  deny-group-scries
  |=  pax=path
  ^-  (unit vase)
  ?:  (group-exists-path pax)  `!>(&)
  ?.  ?=([%gx @ %groups @ %v2 %groups @ @ %channels %can-read %noun ~] pax)  ~
  `!>(|=([who=ship =nest:bu] |))
::
++  group-permission-scries
  |=  pax=path
  ^-  (unit vase)
  ?:  (group-exists-path pax)  `!>(&)
  ?:  ?=([%gx @ %groups @ %v2 %groups @ @ %channels %can-read %noun ~] pax)
    `!>(|=([who=ship =nest:bu] &))
  ?.  ?=([%gx @ %groups @ %v2 %groups @ @ %channels %buckets @ @ %can-write @ %noun ~] pax)  ~
  `!>(`(unit [admin=? roles=(set @tas)])`[~ [admin=| roles=(silt ~[%editor])]])
::
++  missing-group-permission-scries
  |=  pax=path
  ^-  (unit vase)
  ?:  (group-exists-path pax)  `!>(&)
  ?:  ?=([%gx @ %groups @ %v2 %groups @ @ %channels %can-read %noun ~] pax)
    `!>(|=([who=ship =nest:bu] &))
  ?.  ?=([%gx @ %groups @ %v2 %groups @ @ %channels %buckets @ @ %can-write @ %noun ~] pax)  ~
  `!>(`(unit [admin=? roles=(set @tas)])`~)
::
++  allow-admin-create-scries
  |=  pax=path
  ^-  (unit vase)
  ?:  (group-exists-path pax)  `!>(&)
  ?.  ?=([%gx @ %groups @ %v2 %groups @ @ %seats @ %is-admin %noun ~] pax)  ~
  `!>(&)
::
++  deny-admin-create-scries
  |=  pax=path
  ^-  (unit vase)
  ?:  (group-exists-path pax)  `!>(&)
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
  ;<  ~  b  (set-scry-gate genuine-scries)
  ;<  caz=(list card)  b
    (ask 0v7 [%bucket flag [%begin-upload ~ 'private.pdf' 'application/pdf' 42 ~]])
  ::  The URL is the broker's to issue, so the request is held rather than
  ::  answered, and the only other card is the call that will answer it.
  ;<  ~  b
    %+  ex-cards
      %+  skim  caz
      |=(=card ?=([%give %fact *] card))
    :~  (grant-fact 0v7 [%pending ~])
    ==
  ::  +only-iris crashes unless exactly one broker call was made.
  =/  push=[=wire =request:http]  (only-iris caz)
  ;<  done=(list card)  b
    (do-arvo wire.push (iris-grant 'res-1' 'https://storage.test/put'))
  ;<  ~  b
    %+  ex-cards  done
    :~  %+  grant-fact  0v7
        :*  %upload  seed
            2
            'https://storage.test/put'
            ~[['content-type' 'application/pdf']]
            ~2026.1.1..04.00.00
        ==
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
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  *  b  (ask 0v1 [%bucket flag [%create-folder ~ 'Launch']])
  ;<  ~  b  (set-scry-gate genuine-scries)
  ;<  caz=(list card)  b
    (ask 0v2 [%bucket flag [%begin-upload `2 'meadow.png' 'image/png' 2.048 ~]])
  =/  push=[=wire =request:http]  (only-iris caz)
  ;<  *  b  (do-arvo wire.push (iris-grant 'res-a' 'https://storage.test/put'))
  ;<  sv=vase  b  get-save
  =/  st=state-0:bu  !<(state-0:bu sv)
  =/  bs=bucket-state:bu  (state-for st flag)
  =/  ses=upload-session:bu  (only-session st)
  ::  the folder is published, the pending file is not
  ;<  ~  b  (ex-equal !>([~(wyt by entries.bs) revision.bs]) !>([1 1]))
  =/  fil=file:bu  (file-of entry.ses)
  ;<  fin=(list card)  b  (ask 0v3 [%bucket flag [%finish-upload id.ses]])
  =/  done=[=wire =request:http]  (only-iris fin)
  ;<  *  b  (do-arvo wire.done (iris-object object-key.fil 2.048 'image/png'))
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
::  Cancelling says the uploader gave up, not that the bytes did not land --
::  it cannot know that. Its own completion call is what failed, and losing
::  that answer says nothing about whether the broker took the object. So a
::  completion arriving afterwards still publishes; refusing it would leave
::  the object stored and paid for with nothing in the manifest for it.
::
++  test-cancelling-releases-the-reservation
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  *  b  (begun 0v1 'private.pdf' 42)
  ;<  sv=vase  b  get-save
  =/  ses=upload-session:bu  (only-session !<(state-0:bu sv))
  ::  Quota is reserved before the first byte moves, so withdrawing has to
  ::  reach the broker or the space stays held until the reservation lapses.
  ;<  caz=(list card)  b
    (ask 0v2 [%bucket flag [%cancel-upload id.ses 'connection lost']])
  =/  push=[=wire =request:http]  (only-iris caz)
  ;<  ~  b
    (ex-equal !>(wire.push) !>(/buckets/upload/(scot %uv id.ses)/cancel))
  ::  The session stops issuing URLs whether or not the broker is reachable
  ::  to hear about it, so it is already cancelled here.
  ;<  mid=vase  b  get-save
  =/  cancelled=upload-session:bu  (only-session !<(state-0:bu mid))
  ;<  ~  b  (ex-equal !>(status.cancelled) !>(%cancelled))
  ;<  done=(list card)  b  (do-arvo wire.push iris-ok)
  %+  ex-cards  done
  :~  (grant-fact 0v2 [%ok ~])
  ==
::
++  test-broker-upload-lifecycle
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  ~  b  (set-scry-gate genuine-scries)
  ;<  caz=(list card)  b
    (ask 0v1 [%bucket flag [%begin-upload ~ 'private.pdf' 'application/pdf' 42 ~]])
  =/  push=[=wire =request:http]  (only-iris caz)
  ;<  ~  b
    (ex-equal !>(wire.push) !>(/buckets/upload/(scot %uv seed)/grant))
  ;<  *  b  (do-arvo wire.push (iris-grant 'res-1' 'https://storage.test/put'))
  ;<  sv=vase  b  get-save
  =/  st=state-0:bu  !<(state-0:bu sv)
  =/  ses=upload-session:bu  (only-session st)
  =/  fil=file:bu  (file-of entry.ses)
  ::  The reservation is what the broker told us, not something it proposed
  ::  and we had to bind and echo back.
  ;<  ~  b  (ex-equal !>(reservation.ses) !>(`'res-1'))
  ;<  ~  b  (ex-equal !>((~(got by reservations.st) 'res-1')) !>(id.ses))
  ::  Another URL runs against the same reservation rather than opening a
  ::  second one, so the broker's retry budget still applies.
  ;<  again=(list card)  b  (ask 0v2 [%bucket flag [%retry-upload id.ses]])
  =/  retry=[=wire =request:http]  (only-iris again)
  ;<  ~  b
    (ex-equal !>(wire.retry) !>(/buckets/upload/(scot %uv id.ses)/retry))
  ;<  *  b  (do-arvo wire.retry (iris-grant 'res-1' 'https://storage.test/again'))
  ::  The receipt answers our own completion call, so the entry is published
  ::  in the same event rather than waiting for a push that may not come.
  ;<  fin=(list card)  b  (ask 0v3 [%bucket flag [%finish-upload id.ses]])
  =/  done=[=wire =request:http]  (only-iris fin)
  ;<  ~  b
    (ex-equal !>(wire.done) !>(/buckets/upload/(scot %uv id.ses)/complete))
  ;<  *  b  (do-arvo wire.done (iris-object object-key.fil 42 'application/pdf'))
  ;<  sv2=vase  b  get-save
  =/  st2=state-0:bu  !<(state-0:bu sv2)
  =/  bs2=bucket-state:bu  (state-for st2 flag)
  =/  ent2=entry:bu  (~(got by entries.bs2) id.entry.ses)
  =/  fil2=file:bu  (file-of ent2)
  =/  ses2=upload-session:bu  (~(got by sessions.st2) id.ses)
  %+  ex-equal
  !>([status.fil2 status.ses2 ~(wyt by entries.bs2) revision.bs2])
  !>([%ready %complete 1 1])
::
::  One read token covers the whole bucket: it authorizes any ready object in
::  it, and nothing outside it. Deletes stay bound to a single object.
::
++  test-read-token-covers-the-bucket
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  *  b  (begun 0v1 'private.pdf' 42)
  ;<  sv=vase  b  get-save
  =/  st=state-0:bu  !<(state-0:bu sv)
  =/  ses=upload-session:bu  (only-session st)
  =/  fil=file:bu  (file-of entry.ses)
  ;<  fin=(list card)  b  (ask 0v9 [%bucket flag [%finish-upload id.ses]])
  =/  done=[=wire =request:http]  (only-iris fin)
  ;<  *  b  (do-arvo wire.done (iris-object object-key.fil 42 'application/pdf'))
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
    :~  (ex-iris (reader-wire-for ~sampel-palnet 1))
        ::  One timer drives everything still owed. It is cancelled before it
        ::  is set, and lands on a fixed grid rather than now-plus-a-minute,
        ::  so arming it twice cannot leave two timers behind.
        %-  ex-arvo
        [/buckets/reader-retry [%b %rest (add ~2026.1.1 ~m2)]]
        %-  ex-arvo
        [/buckets/reader-retry [%b %wait (add ~2026.1.1 ~m2)]]
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
              ::  the credential goes in a header, never the URL
              (~(got by (malt header-list.request.push)) 'x-landscape-token')
          ==
    !>  :*  %'PUT'
            'https://memex.tlon.network/v2/buckets/tokens/sampel-palnet'
            read-token
            'sampel-palnet'
            'project-files'
            'sampel-palnet'
            '0wsecret'
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
::  A refused sync is owed, not lost: the desired state stands and the retry
::  timer sends it again. What must not happen is handing the token out before
::  the broker has it, so nothing is served while the pair is still owed.
::
++  test-refused-sync-is-owed-not-served
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
  ::  a 404 is a refusal like any other now
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
  ::  nothing served either way, and both pairs still owed
  %+  ex-equal
    !>  :*  (~(has by read-tokens.st) flag)
            (owed-count st)
            (owed-count st2)
        ==
  !>([%.n 1 2])
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
  ;<  ~  b  (set-scry-gate genuine-scries)
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
::  A delete answers with a grant for every object it unlinked.
::
::  The requester cannot ask for these one at a time beforehand and be right:
::  between reading the manifest and the delete landing, someone else can
::  publish a file that this delete then removes. Its bytes are only reachable
::  if the answer names them, so the set the host reports is the set it took.
::
::  The two tokens must also differ. There is one +eny per event, so minting
::  from it alone would hand back the same token twice and one of the two
::  objects could never be deleted.
::
++  test-delete-answers-with-a-grant-per-object
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  *  b  (ask 0v1 [%bucket flag [%create-folder ~ 'Launch']])
  ;<  ~  b  (set-scry-gate genuine-scries)
  ;<  sv=vase  b  get-save
  =/  st=state-0:bu  !<(state-0:bu sv)
  =/  bs=bucket-state:bu  (state-for st flag)
  =/  folder=@ud
    =/  ents  ~(tap by entries.bs)
    ?~(ents !! p.i.ents)
  ::  one file lands inside the folder
  ;<  caz=(list card)  b
    (ask 0v2 [%bucket flag [%begin-upload `folder 'first.png' 'image/png' 8 ~]])
  =/  push=[=wire =request:http]  (only-iris caz)
  ;<  *  b  (do-arvo wire.push (iris-grant 'res-a' 'https://storage.test/put'))
  ;<  sv2=vase  b  get-save
  =/  st2=state-0:bu  !<(state-0:bu sv2)
  =/  ses=upload-session:bu  (only-session st2)
  =/  one=file:bu  (file-of entry.ses)
  ;<  fin=(list card)  b  (ask 0v3 [%bucket flag [%finish-upload id.ses]])
  ;<  *  b
    (do-arvo wire:(only-iris fin) (iris-object object-key.one 8 'image/png'))
  ::  and a second one the deleter never saw
  ;<  ~  b  (jab-bowl |=(bol=bowl bol(eny 0v4321)))
  ;<  caz2=(list card)  b
    (ask 0v4 [%bucket flag [%begin-upload `folder 'second.png' 'image/png' 8 ~]])
  =/  push2=[=wire =request:http]  (only-iris caz2)
  ;<  *  b  (do-arvo wire.push2 (iris-grant 'res-b' 'https://storage.test/put'))
  ;<  sv3=vase  b  get-save
  =/  st3=state-0:bu  !<(state-0:bu sv3)
  =/  ses2=upload-session:bu
    =/  live=(list upload-session:bu)
      %+  skim  ~(val by sessions.st3)
      |=(s=upload-session:bu =('second.png' name.entry.s))
    ?~(live !! i.live)
  =/  two=file:bu  (file-of entry.ses2)
  ;<  fin2=(list card)  b  (ask 0v5 [%bucket flag [%finish-upload id.ses2]])
  ;<  *  b
    (do-arvo wire:(only-iris fin2) (iris-object object-key.two 8 'image/png'))
  ::  deleting the folder reports both objects, under two distinct tokens
  ;<  del=(list card)  b  (ask 0v6 [%bucket flag [%entry folder [%delete &]]])
  =/  body=response-body:bu  (only-answer del)
  ?.  ?=([%deleted *] body)
    (ex-equal !>(-.body) !>(%deleted))
  =/  objects=(set @t)  (silt (turn grants.body |=(g=delete-grant:bu object.g)))
  =/  tokens=(set @t)  (silt (turn grants.body |=(g=delete-grant:bu token.g)))
  ;<  sv4=vase  b  get-save
  =/  st4=state-0:bu  !<(state-0:bu sv4)
  =/  registered=(list ?)
    %+  turn  ~(tap in tokens)
    |=(tok=@t (~(has by object-capabilities.st4) tok))
  %+  ex-equal
  !>([objects ~(wyt in tokens) registered])
  !>([(silt ~[object-key.one object-key.two]) 2 ~[& &]])
::
::  A revoke issued while a grant is still in flight supersedes it, because
::  it carries a higher revision — the broker keeps the newer state whichever
::  order the two arrive in. The client waiting on that grant is told so
::  rather than left to time out, and the stale ack changes nothing when it
::  finally lands.
::
++  test-revoke-supersedes-an-in-flight-grant
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
  =/  grant=[=wire =request:http]  (only-iris mint-caz)
  ::  access is pulled while that grant is still in flight
  ;<  ~  b  (set-scry-gate revoked-scries)
  ;<  revoke-caz=(list card)  b
    %^    do-agent
        /groups
      [~sampel-palnet %groups]
    [%fact %group-response-1 !>(group-changed)]
  ;<  ~  b
    %+  ex-cards  (skim revoke-caz |=(car=card ?=([%give %fact *] car)))
    :~  %+  ex-fact  ~[/v1/request/~bus/0v9]
        :-  %buckets-req-response-1
        !>  ^-  req-response:bu
        :-  0v9
        [%error %not-authorized 'access changed while the token was being issued']
    ==
  ::  the stale grant ack arrives afterwards and resurrects nothing
  ;<  *  b  (do-arvo wire.grant iris-ok)
  ;<  sv=vase  b  get-save
  =/  st=state-0:bu  !<(state-0:bu sv)
  (ex-equal !>((granted-count st)) !>(0))
::
::  A retry of a dropped POST reuses its request id, and must not run the
::  action a second time -- a create-folder or begin-upload would duplicate
::  state, and the answer would go to a connection that is already gone.
::
++  test-reused-request-id-does-not-run-twice
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  =/  body=@t
    '{"requestId":"0v30","action":{"type":"create-folder","flag":{"host":"~sampel-palnet","name":"project-files"},"name":"Launch"}}'
  ;<  *  b  (http-post & body)
  ;<  sv=vase  b  get-save
  =/  before=@ud  ~(wyt by entries:(state-for !<(state-0:bu sv) flag))
  ::  the same id again, once the first has settled
  ;<  again=(list card)  b  (http-post & body)
  ;<  sv2=vase  b  get-save
  =/  after=@ud  ~(wyt by entries:(state-for !<(state-0:bu sv2) flag))
  ::  one folder, and the retry still gets an answer
  =/  answered=?  ?=(^ (skim again |=(car=card ?=([%give %fact *] car))))
  (ex-equal !>([before after answered]) !>([1 1 %.y]))
::
::  The broker classifies its own failures. A validation refusal will answer
::  the same way next time, so it stops being owed; a service failure is worth
::  another go and stays owed for the retry timer.
::
++  test-refusal-is-retried-only-when-the-broker-says-so
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  ~  b  (set-scry-gate reader-scries)
  ::  a temporary failure stays owed
  ;<  caz=(list card)  b  (ask 0v40 [%bucket flag [%issue-bucket-read ~]])
  =/  first=[=wire =request:http]  (only-iris caz)
  ;<  *  b  (do-arvo wire.first (iris-refusal 503 &))
  ;<  sv=vase  b  get-save
  =/  owed-after-503=@ud  (owed-count !<(state-0:bu sv))
  ::  a validation refusal does not
  ;<  ~  b  (jab-bowl |=(bol=bowl bol(eny 0v4141)))
  ;<  caz2=(list card)  b
    %-  (do-as ~bus)
    %+  do-poke  %buckets-command-1
    !>(`command:bu`[0v41 [%bucket flag [%issue-bucket-read ~]]])
  =/  second=[=wire =request:http]  (only-iris caz2)
  ;<  denied=(list card)  b  (do-arvo wire.second (iris-refusal 400 |))
  ;<  sv2=vase  b  get-save
  =/  st2=state-0:bu  !<(state-0:bu sv2)
  ::  the rejected pair is no longer owed, and its asker was told
  =/  answered=?
    ?=(^ (skim denied |=(car=card ?=([%give %fact *] car))))
  %+  ex-equal
    !>([owed-after-503 (owed-count st2) answered])
  !>([1 1 %.y])
::
::  Re-granting after a revoke has to outrank it, or the broker keeps the
::  revoked state and the reader never gets back in.
::
++  test-regrant-after-revoke-outranks-it
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  ~  b  (set-scry-gate reader-scries)
  ;<  *  b
    %-  (do-as ~bus)
    %+  do-poke  %buckets-command-1
    !>(`command:bu`[0v20 [%bucket flag [%issue-bucket-read ~]]])
  ::  access is pulled, then restored
  ;<  ~  b  (set-scry-gate revoked-scries)
  ;<  *  b
    %^    do-agent
        /groups
      [~sampel-palnet %groups]
    [%fact %group-response-1 !>(group-changed)]
  ;<  ~  b  (set-scry-gate reader-scries)
  ;<  ~  b  (jab-bowl |=(bol=bowl bol(eny 0v7777)))
  ;<  *  b
    %-  (do-as ~bus)
    %+  do-poke  %buckets-command-1
    !>(`command:bu`[0v21 [%bucket flag [%issue-bucket-read ~]]])
  ;<  sv=vase  b  get-save
  =/  sync=reader-sync:bu  (sync-for !<(state-0:bu sv) ~bus)
  ::  grant, revoke, grant -- each strictly above the last
  %+  ex-equal
    !>([revision.sync -.desired.sync])
  !>([3 %granted])
::
::  The same answer delivered twice settles the pair once. Nothing about the
::  second delivery should re-answer a client or move the revision.
::
++  test-duplicate-delivery-is-harmless
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  ~  b  (set-scry-gate genuine-scries)
  ;<  caz=(list card)  b  (ask 0v22 [%bucket flag [%issue-bucket-read ~]])
  =/  push=[=wire =request:http]  (only-iris caz)
  ;<  first=(list card)  b  (do-arvo wire.push iris-ok)
  ;<  again=(list card)  b  (do-arvo wire.push iris-ok)
  ;<  sv=vase  b  get-save
  =/  sync=reader-sync:bu  (sync-for !<(state-0:bu sv) ~sampel-palnet)
  ::  the second delivery answers nobody and changes nothing
  ;<  ~  b  (ex-cards again ~)
  %+  ex-equal
    !>([revision.sync synced.sync])
  !>([1 1])
::
::  If the broker reports a revision above ours, our counter is behind it --
::  state loss on our side, or an earlier incarnation. Adopt its number and
::  re-send, or everything we say from here on is discarded as stale.
::
::  It arrives on the success path, because a stale write is not an error to
::  the broker: it keeps the higher revision and answers 200 with the number
::  it kept. That is the only route by which we catch up.
::
++  test-adopts-a-higher-revision-from-the-broker
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  ~  b  (set-scry-gate genuine-scries)
  ;<  caz=(list card)  b  (ask 0v23 [%bucket flag [%issue-bucket-read ~]])
  =/  push=[=wire =request:http]  (only-iris caz)
  ::  the write was stale; the broker names what it holds instead
  ;<  resent=(list card)  b  (do-arvo wire.push (iris-revision 200 41))
  =/  retry=[=wire =request:http]  (only-iris resent)
  ;<  sv=vase  b  get-save
  =/  sync=reader-sync:bu  (sync-for !<(state-0:bu sv) ~sampel-palnet)
  ::  we jump past it and say the same thing again at a revision that wins
  %+  ex-equal
    !>([revision.sync wire.retry])
  !>([42 (reader-wire-for ~sampel-palnet 42)])
::
::  A rejection is a rejection whatever else it says. Reading a revision out
::  of a non-2xx body and treating it as agreement would install a grant the
::  broker just refused, and hand the client a token it will not honour.
::
++  test-a-rejection-carrying-a-revision-is-still-a-rejection
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  ~  b  (set-scry-gate genuine-scries)
  ;<  caz=(list card)  b  (ask 0v23 [%bucket flag [%issue-bucket-read ~]])
  =/  push=[=wire =request:http]  (only-iris caz)
  ;<  refused=(list card)  b  (do-arvo wire.push (iris-revision 400 1))
  ;<  sv=vase  b  get-save
  =/  st=state-0:bu  !<(state-0:bu sv)
  =/  sync=reader-sync:bu  (sync-for st ~sampel-palnet)
  ::  nothing was confirmed, nothing is servable, nobody was told otherwise
  %+  ex-equal
    !>([synced.sync ~(wyt by read-tokens.st) (lent (answers refused))])
  !>([0 0 0])
::
::  Deleting a group must revoke its buckets' tokens, not crash trying. The
::  permission scry answers no-such-path once the group is gone, which makes .^
::  crash rather than return -- so the pass that revokes has to check the group
::  is still there before asking about it.
::
++  test-deleted-group-revokes-rather-than-crashing
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
    !>(`command:bu`[0v12 [%bucket flag [%issue-bucket-read ~]]])
  =/  push=[=wire =request:http]  (only-iris mint-caz)
  ;<  *  b  (do-arvo wire.push iris-ok)
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
  ::  the group is deleted, so the permission gates are unreachable
  ;<  ~  b  (set-scry-gate missing-group-scries)
  ;<  caz=(list card)  b
    %^    do-agent
        /groups
      [~sampel-palnet %groups]
    [%fact %group-response-1 !>(group-changed)]
  =/  revoke=[=wire =request:http]  (only-iris caz)
  ;<  sv=vase  b  get-save
  =/  st=state-0:bu  !<(state-0:bu sv)
  =/  kicked=(list ship)
    %+  murn  caz
    |=(car=card ?.(?=([%give %kick * ^] car) ~ ship.p.car))
  ::  the reader is kicked, and its access synced as revoked
  %+  ex-equal
    !>  :*  (granted-count st)
            method.request.revoke
            kicked
        ==
  !>([0 %'PUT' ~[~bus]])
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
    [%fact %group-response-1 !>(group-changed)]
  =/  revoke=[=wire =request:http]  (only-iris caz)
  ::  the broker fails it, so the pair stays owed and a retry is armed
  ;<  *  b  (do-arvo wire.revoke (iris-status 503))
  ;<  sv=vase  b  get-save
  =/  st=state-0:bu  !<(state-0:bu sv)
  ;<  ~  b  (ex-equal !>((owed-count st)) !>(1))
  ::  the retry timer re-sends the same revision, and a 2xx settles it
  ;<  retried=(list card)  b
    (do-arvo /buckets/reader-retry [%behn %wake ~])
  =/  again=[=wire =request:http]  (only-iris retried)
  ;<  *  b  (do-arvo wire.again iris-ok)
  ;<  sv2=vase  b  get-save
  =/  st2=state-0:bu  !<(state-0:bu sv2)
  %+  ex-equal
    !>  :*  wire.again
            method.request.again
            (owed-count st2)
        ==
  !>([wire.revoke %'PUT' 0])
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
    [%fact %group-response-1 !>(group-changed)]
  =/  revoke=[=wire =request:http]  (only-iris caz)
  ;<  sv2=vase  b  get-save
  =/  st2=state-0:bu  !<(state-0:bu sv2)
  =/  kicks=(list card)
    %+  skim  caz
    |=(car=card ?=([%give %kick *] car))
  ::  no kick, because it was not subscribed -- but the token is gone locally
  ::  and the broker is told to drop it
  %+  ex-equal
    !>  :*  (granted-count st)
            (granted-count st2)
            method.request.revoke
            (lent kicks)
        ==
  !>([1 0 %'PUT' 0])
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
  =/  minted=@ud  (granted-count st)
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
    [%fact %group-response-1 !>(group-changed)]
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
            (granted-count st2)
            kicked
        ==
  !>  :*  1
          %'PUT'
          'https://memex.tlon.network/v2/buckets/tokens/sampel-palnet'
          0
          ~[~bus]
      ==
::
::  Expired grants and pending sessions are swept the next time authority is
::  touched, and their reservation bindings go with them.
::
::  A pending session that ran out of time may have bytes behind it: the
::  uploader held a signed PUT, and a large file on a slow link outlasts our
::  window. Dropping our record alone leaves the broker holding a reservation,
::  its quota, and possibly a stored object nothing will publish.
::
++  test-a-lapsed-upload-is-given-up-at-the-broker
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  *  b  (begun 0v1 'huge.iso' 42)
  ;<  sv=vase  b  get-save
  =/  ses=upload-session:bu  (only-session !<(state-0:bu sv))
  ;<  ~  b  (ex-equal !>(reservation.ses) !>(`'res-1'))
  ::  Past the session window, with something else driving a prune.
  ;<  ~  b  (jab-bowl |=(bol=bowl bol(now ~2026.1.2, eny 0v9999)))
  ;<  caz=(list card)  b
    (ask 0v2 [%bucket flag [%begin-upload ~ 'later.pdf' 'application/pdf' 7 ~]])
  =/  cancels=(list [=wire =request:http])
    %+  murn  caz
    |=  =card
    ^-  (unit [wire request:http])
    ?.  ?=([%pass * %arvo %i %request * *] card)  ~
    ?.  =(/buckets/upload/(scot %uv id.ses)/cancel p.card)  ~
    `[p.card request.q.card]
  ;<  ~  b  (ex-equal !>((lent cancels)) !>(1))
  ::  And the lapsed session is gone from our own state either way.
  ;<  after=vase  b  get-save
  =/  st=state-0:bu  !<(state-0:bu after)
  (ex-equal !>((~(has by sessions.st) id.ses)) !>(|))
::
++  test-expired-authority-is-pruned
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  *  b  (begun 0v1 'private.pdf' 42)
  ;<  ~  b  (jab-bowl |=(bol=bowl bol(now ~2026.1.2, eny 0v9999)))
  ;<  *  b  (ask 0v2 [%bucket flag [%begin-upload ~ 'later.pdf' 'application/pdf' 7 ~]])
  ;<  sv=vase  b  get-save
  =/  st=state-0:bu  !<(state-0:bu sv)
  %+  ex-equal
  !>  :*  (~(has by sessions.st) seed)
          (~(has by reservations.st) 'res-1')
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
::  A refused action that has nothing to do with tokens must leave ours alone.
::  The subscriber only learns which request was a token request from what it
::  recorded when forwarding -- without that, a denied folder rename discards a
::  perfectly good read token, and with it the reader's offline reads.
::
++  test-unrelated-refusal-keeps-the-read-token
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  (setup-as ~bus)
  ;<  *  b
    (do-poke %group-channel-join !>(`channel-join:bu`[[%buckets ~sampel-palnet %project-files] group]))
  ::  hold a token, obtained the normal way
  ;<  *  b  (ask 0v4 [%bucket flag [%issue-bucket-read ~]])
  =/  tok=read-token:bu  ['0v1.2345' (add ~2026.1.1 ~d1)]
  ;<  *  b
    %^    do-agent
        /buckets/req/~sampel-palnet/0v4/watch
      [~sampel-palnet %buckets]
    :+  %fact  %buckets-req-response-1
    !>(`req-response:bu`[0v4 [%token tok]])
  ::  now a folder rename is refused
  ;<  *  b  (ask 0v5 [%bucket flag [%entry 1 [%rename 'nope']]])
  ;<  caz=(list card)  b
    %^    do-agent
        /buckets/req/~sampel-palnet/0v5/watch
      [~sampel-palnet %buckets]
    :+  %fact  %buckets-req-response-1
    !>(`req-response:bu`[0v5 [%error %not-authorized 'not authorized for this bucket']])
  ;<  sv=vase  b  get-save
  =/  st=state-0:bu  !<(state-0:bu sv)
  ::  the token is untouched, and no token timer was armed on its behalf
  =/  token-timers=(list card)
    %+  skim  caz
    |=(car=card ?=([%pass [%buckets %token *] %arvo *] car))
  %+  ex-equal
    !>([(~(get by read-tokens.st) flag) (lent token-timers)])
  !>([`tok 0])
::
::  A token request that times out has to come back on its own. Nothing else
::  will: the request is gone, no refresh is armed, and the local scry keeps
::  answering with the token we already hold until it lapses.
::
::  The same loss, reached the other three ways. A forwarded request can die
::  by timeout, by kick, by a refused watch, or by a nacked poke; all four
::  leave a renewal with its refresh already fired and nothing to rearm it.
::  They are one arm now because the poke path was missing this.
::
++  test-every-way-a-request-dies-rearms-the-renewal
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  =/  n  (mare ,(list card))
  =/  o  (mare ,@ud)
  =/  host=gill:gall  [~sampel-palnet %buckets]
  =/  req=path  /buckets/req/~sampel-palnet/0v6
  ::  a renewal in flight, ended by `end`; answers how many refreshes it rearmed
  =/  rearms
    |=  end=form:n
    =*  b  bind:o
    ^-  form:o
    ;<  ~  b  (setup-as ~bus)
    ;<  *  b
      (do-poke %group-channel-join !>(`channel-join:bu`[[%buckets ~sampel-palnet %project-files] group]))
    ;<  *  b  (ask 0v6 [%bucket flag [%issue-bucket-read ~]])
    ;<  caz=(list card)  b  end
    %-  pure:o
    (lent (skim caz |=(car=card ?=([%pass [%buckets %token *] %arvo *] car))))
  ;<  timeout=@ud  b  (rearms (do-arvo (snoc req %wake) [%behn %wake ~]))
  ;<  kicked=@ud  b  (rearms (do-agent (snoc req %watch) host [%kick ~]))
  ;<  refused=@ud  b
    (rearms (do-agent (snoc req %watch) host [%watch-ack `~[leaf+"no"]]))
  ;<  nacked=@ud  b
    (rearms (do-agent (snoc req %poke) host [%poke-ack `~[leaf+"no"]]))
  %+  ex-equal
    !>([timeout kicked refused nacked])
  !>([1 1 1 1])
::
::  Without the %genuine secret a mint cannot be sent, so the request is
::  answered in the same event that records what is owed. The record must not
::  also name it as the one waiting: when the retry finally lands, confirming
::  it would send a second terminal answer for a request already finished.
::
++  test-a-mint-answered-now-is-not-also-answered-later
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  ~  b  (set-scry-gate secretless-scries)
  ;<  refused=(list card)  b  (ask 0v7 [%bucket flag [%issue-bucket-read ~]])
  ::  told now, and nothing went out
  ;<  ~  b
    %+  ex-cards  refused
    :~  %-  ex-arvo
        [/buckets/reader-retry [%b %rest (add ~2026.1.1 ~m2)]]
        %-  ex-arvo
        [/buckets/reader-retry [%b %wait (add ~2026.1.1 ~m2)]]
        %+  ex-fact  ~[/v1/requests]
        :-  %buckets-req-response-1
        !>  ^-  req-response:bu
        [0v7 %error %unknown 'this ship cannot reach storage yet']
    ==
  ::  the secret appears and the retry timer sends what was owed
  ;<  ~  b  (set-scry-gate genuine-scries)
  ;<  sent=(list card)  b  (do-arvo /buckets/reader-retry [%behn %wake ~])
  =/  push=[=wire =request:http]  (only-iris sent)
  ;<  landed=(list card)  b  (do-arvo wire.push iris-ok)
  ::  the grant is installed, but nobody is answered a second time
  ;<  sv=vase  b  get-save
  =/  st=state-0:bu  !<(state-0:bu sv)
  %+  ex-equal
    !>([(granted-count st) (lent (answers landed))])
  !>([1 0])
::
::  A settled record past its expiry says nothing either way: the token it
::  names has lapsed, so a grant is worthless and a revoke is moot. Judging
::  only the revoked ones kept a row for every reader that ever read.
::
++  test-an-expired-grant-is-pruned-like-an-expired-revoke
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  ~  b  (set-scry-gate genuine-scries)
  ;<  caz=(list card)  b  (ask 0v8 [%bucket flag [%issue-bucket-read ~]])
  =/  push=[=wire =request:http]  (only-iris caz)
  ;<  *  b  (do-arvo wire.push iris-ok)
  ;<  sv=vase  b  get-save
  =/  before=@ud  ~(wyt by readers:!<(state-0:bu sv))
  ::  read-window later, the grant it confirmed has lapsed
  ;<  ~  b  (jab-bowl |=(bol=bowl bol(now (add ~2026.1.1 ~d1), eny 0v7777)))
  ;<  *  b  (ask 0v9 [%bucket flag [%issue-bucket-read ~]])
  ;<  after=vase  b  get-save
  =/  st=state-0:bu  !<(state-0:bu after)
  ::  the lapsed row is gone; what replaced it is a fresh mint at revision 1
  =/  sync=reader-sync:bu  (sync-for st ~sampel-palnet)
  %+  ex-equal
    !>([before ~(wyt by readers.st) revision.sync synced.sync])
  !>([1 1 1 0])
::
::  Both entry points keep the one-answer contract. The poke path used to
::  dispatch straight through, so a Gall caller retrying a lost answer ran the
::  action a second time and was answered twice.
::
++  test-a-repeated-poke-request-id-does-not-run-twice
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  *  b  (ask 0v11 [%bucket flag [%create-folder ~ 'notes']])
  ;<  sv=vase  b  get-save
  =/  first=@ud  ~(wyt by entries:(state-for !<(state-0:bu sv) flag))
  ::  the same id again, as a caller that lost our answer would send it
  ;<  again=(list card)  b  (ask 0v11 [%bucket flag [%create-folder ~ 'notes']])
  ;<  after=vase  b  get-save
  =/  second=@ud  ~(wyt by entries:(state-for !<(state-0:bu after) flag))
  ::  no second folder, and the stored result is replayed rather than remade
  %+  ex-equal
    !>([first second (lent (answers again))])
  !>([1 1 1])
::
::  The %groups subscription is the only thing that calls +recheck-host-subs,
::  which is the only thing that revokes. A refusal loses it exactly as a kick
::  does, so it has to be recovered the same way -- otherwise a reader who
::  loses access keeps a working token for as long as the ship runs, silently.
::
++  test-a-refused-groups-watch-is-retried
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ::  %groups refuses the subscription
  ;<  refused=(list card)  b
    %^    do-agent
        /groups
      [~sampel-palnet %groups]
    [%watch-ack `~[leaf+"no"]]
  ;<  ~  b
    %+  ex-cards  refused
    :~  (ex-arvo /groups/retry [%b %wait (add ~2026.1.1 ~m5)])
    ==
  ::  and the wake asks again
  ;<  again=(list card)  b  (do-arvo /groups/retry [%behn %wake ~])
  %+  ex-cards  again
  :~  %-  ex-card
      :*  %pass  /groups  %agent
          [~sampel-palnet %groups]  %watch  /v1/groups
      ==
  ==
::
::  A broker that retains the revision we just sent has not taken our write,
::  however the numbers compare. This is reachable precisely because pruning
::  a lapsed record resets our counter while the broker's row persists: the
::  next grant opens at 1 against a retained 1, and reading that as agreement
::  hands the client a token the broker never stored.
::
++  test-an-equal-retained-revision-is-a-collision-not-agreement
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  ~  b  (set-scry-gate genuine-scries)
  ;<  caz=(list card)  b  (ask 0v6 [%bucket flag [%issue-bucket-read ~]])
  =/  push=[=wire =request:http]  (only-iris caz)
  ::  the broker answers 200, names the revision we sent, and says it did not
  ::  take it -- the shape a stale write has after our record was pruned
  ;<  resent=(list card)  b  (do-arvo wire.push (iris-receipt 1 |))
  =/  retry=[=wire =request:http]  (only-iris resent)
  ;<  sv=vase  b  get-save
  =/  st=state-0:bu  !<(state-0:bu sv)
  =/  sync=reader-sync:bu  (sync-for st ~sampel-palnet)
  ::  we go above what it kept rather than settling, and nothing is servable
  ::  until it says it took one
  %+  ex-equal
    !>  :*  revision.sync
            wire.retry
            ~(wyt by read-tokens.st)
        ==
  !>  :*  2
          (reader-wire-for ~sampel-palnet 2)
          0
      ==
::
::  An applied write is still an applied write; the collision check must not
::  make ordinary success resend forever.
::
++  test-an-applied-write-settles
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  ~  b  (set-scry-gate genuine-scries)
  ;<  caz=(list card)  b  (ask 0v6 [%bucket flag [%issue-bucket-read ~]])
  =/  push=[=wire =request:http]  (only-iris caz)
  ;<  settled=(list card)  b  (do-arvo wire.push (iris-receipt 1 &))
  ;<  sv=vase  b  get-save
  =/  st=state-0:bu  !<(state-0:bu sv)
  =/  sync=reader-sync:bu  (sync-for st ~sampel-palnet)
  %+  ex-equal
    !>([revision.sync synced.sync (lent (skim settled |=(c=card ?=([%pass * %arvo %i *] c))))])
  !>([1 1 0])
::
::  A role that no longer exists must stop granting writes. Role ids come from
::  the role's title, so deleting a role and making another by the same name
::  reuses the id -- and a stale id left in .writers hands write and delete on
::  every bucket that named it to whoever joins the new role.
::
++  test-a-deleted-role-stops-granting-writes
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  *  b  (ask 0v1 [%bucket flag [%set-writers (silt `(list @tas)`~[%editors %moderators])]])
  ;<  sv=vase  b  get-save
  =/  before=(set @tas)  writers:(state-for !<(state-0:bu sv) flag)
  ::  %groups says the moderators role is gone
  ;<  *  b
    %^    do-agent
        /groups
      [~sampel-palnet %groups]
    [%fact %group-response-1 !>((role-deleted (silt `(list @tas)`~[%moderators])))]
  ;<  after=vase  b  get-save
  =/  kept=(set @tas)  writers:(state-for !<(state-0:bu after) flag)
  %+  ex-equal
    !>([before kept])
  !>([(silt `(list @tas)`~[%editors %moderators]) (silt `(list @tas)`~[%editors])])
::
::  The incremental drop only fires for a fact we actually see. A group that
::  arrives whole is the repair for one we did not: anything we still hold
::  that its roles do not have is stale however we came to miss it.
::
++  test-a-whole-group-reconciles-stale-writers
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  *  b  (ask 0v1 [%bucket flag [%set-writers (silt `(list @tas)`~[%editors %ghosts])]])
  ::  the group arrives whole, and knows only about editors
  ;<  *  b
    %^    do-agent
        /groups
      [~sampel-palnet %groups]
    =/  whole=group:v9:gv
      =/  bare=group:v9:gv  *group:v9:gv
      bare(roles (malt ~[[%editors *role:v9:gv]]))
    [%fact %group-response-1 !>(`r-groups:v9:gv`[group %create whole])]
  ;<  after=vase  b  get-save
  %+  ex-equal
    !>(writers:(state-for !<(state-0:bu after) flag))
  !>((silt `(list @tas)`~[%editors]))
::
::  A record that lapsed while still owed used to be stranded: +owed skipped
::  it for being expired, and pruning kept it for never having settled, so it
::  belonged to nobody and stayed for good. A revoke is where that arises --
::  it has no request waiting on it, so nothing else was ever going to retire
::  it. Expiry now decides a record's state on its own, which is what makes
::  the case unreachable rather than merely fixed.
::
++  test-a-revoke-that-lapsed-while-owed-is-not-stranded
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
    !>(`command:bu`[0v7 [%bucket flag [%issue-bucket-read ~]]])
  =/  push=[=wire =request:http]  (only-iris mint-caz)
  ::  confirmed, so no request is left waiting on this pair
  ;<  *  b  (do-arvo wire.push iris-ok)
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
  ::  access is pulled, which revokes with nobody waiting on the result
  ;<  ~  b  (set-scry-gate revoked-scries)
  ;<  revoke-caz=(list card)  b
    %^    do-agent
        /groups
      [~sampel-palnet %groups]
    [%fact %group-response-1 !>(group-changed)]
  =/  revoke=[=wire =request:http]  (only-iris revoke-caz)
  ::  the broker keeps failing in a way worth retrying, and never takes it
  ;<  *  b  (do-arvo wire.revoke (iris-refusal 503 &))
  ;<  sv=vase  b  get-save
  =/  mid=reader-sync:bu  (sync-for !<(state-0:bu sv) ~bus)
  ::  owed, unanswerable, and nobody waiting: the shape that used to persist
  ;<  ~  b
    %+  ex-equal
      !>([revision.mid synced.mid awaiting.mid])
    !>([2 1 ~])
  ::  the grant's own expiry passes with the revoke still owed
  ;<  ~  b  (jab-bowl |=(bol=bowl bol(now (add ~2026.1.1 ~d1), eny 0v4444)))
  ;<  ~  b  (set-scry-gate reader-scries)
  ;<  *  b  (ask 0v5 [%bucket flag [%issue-bucket-read ~]])
  ;<  after=vase  b  get-save
  =/  st=state-0:bu  !<(state-0:bu after)
  ::  the stranded revoke is gone; only our own fresh mint remains
  %+  ex-equal
    !>([~(wyt by readers.st) (~(has by readers.st) [flag ~bus])])
  !>([1 %.n])
::
::  The client mints its own request id so a lost answer stays addressable.
::  The agent parses it with (slav %uv) and falls back to one of its own for
::  anything that does not parse, so a shape mismatch would show up as nothing
::  at all -- the id simply not being the one the client kept. This is a real
::  id from the client's generator.
::
++  test-a-client-minted-request-id-is-the-one-used
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  =/  rid=@t  '0v6unph.s88pj.iv67p.6ch2o.kfdam'
  ;<  ~  b  setup
  ;<  ~  b  create
  =/  body=@t
    %-  en:json:html
    %-  pairs:enjs:format
    :~  ['requestId' s+rid]
        :-  'action'
        %-  pairs:enjs:format
        :~  ['type' s+'set-title']
            ['flag' (flag:enjs:buckets-json flag)]
            ['title' s+'Renamed']
        ==
    ==
  ;<  caz=(list card)  b  (http-post & body)
  ::  the answer comes back under the id we sent, not one the agent chose
  =/  answered=(list @uv)
    %+  murn  caz
    |=  =card
    ^-  (unit @uv)
    ?.  ?=([%give %fact *] card)  ~
    ?.  =(%buckets-req-response-1 p.cage.p.card)  ~
    `request-id:!<(req-response:bu q.cage.p.card)
  %+  ex-equal
    !>(answered)
  !>(~[(slav %uv rid)])
::
::  Listing buckets must not carry their contents. Entries are unbounded, and
::  everything that lists -- channel sync, routing -- wants the metadata only.
::  The manifest is still reachable, at /full, the way %channels does it.
::
++  test-listing-buckets-leaves-their-contents-behind
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  *  b  (ask 0v1 [%bucket flag [%create-folder ~ 'notes']])
  ;<  brief=cage  b  (got-peek /x/v1/buckets)
  ;<  whole=cage  b  (got-peek /x/v1/buckets/full)
  =/  sums=(list summary:bu)  !<((list summary:bu) q.brief)
  =/  snaps=(list snapshot:bu)  !<((list snapshot:bu) q.whole)
  ::  same buckets either way, and the metadata a lister needs is on both
  %+  ex-equal
    !>  :*  p.brief
            p.whole
            (lent sums)
            (lent snaps)
            flag:(snag 0 sums)
            writers:(snag 0 sums)
            ::  the folder is in the manifest, and only there
            ~(wyt by entries:bucket-state:(snag 0 snaps))
        ==
  !>  :*  %buckets-summaries-1
          %buckets-snapshots-1
          1
          1
          flag
          writers:bucket-state:(snag 0 snaps)
          1
      ==
::
::  Whether %buckets is here at all has to be answerable without reading what
::  it holds. /v1/buckets was serving that question, and it renders every
::  bucket's whole manifest, so a yes/no got slower the more anyone stored.
::
++  test-readiness-is-a-constant-not-the-manifest
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  ::  a bucket with an entry in it, so a manifest read would differ from a
  ::  constant one
  ;<  *  b  (ask 0v1 [%bucket flag [%create-folder ~ 'notes']])
  ;<  =cage  b  (got-peek /x/v1/ready)
  ;<  ~  b  (ex-equal !>(p.cage) !>(%json))
  %+  ex-equal
    q.cage
  !>(`json`[%b &])
::
::  A ship has no environment to read, so the broker it syncs to is a poke.
::  The guard matters more than the knob: the credential in a sync is a bearer
::  header, so a base naming an unexpected or plaintext host does not fail
::  closed, it hands the secret over.
::
++  test-the-broker-base-is-settable-but-only-over-https
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  =/  test=@t  'https://memex.test.tlon.systems/v2/buckets'
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  ~  b  (set-scry-gate genuine-scries)
  ::  a plaintext base is refused, and the default stands
  ;<  *  b  (do-poke %noun !>([%set-broker-base `'http://evil.example/v2/buckets']))
  ;<  before=vase  b  get-save
  ::  so is one that is not a url at all
  ;<  *  b  (do-poke %noun !>([%set-broker-base `'memex.test.tlon.systems']))
  ;<  still=vase  b  get-save
  ::  an https base lands, with its trailing slash trimmed
  ;<  *  b  (do-poke %noun !>([%set-broker-base `(cat 3 test '/')]))
  ;<  caz=(list card)  b  (ask 0v3 [%bucket flag [%issue-bucket-read ~]])
  =/  push=[=wire =request:http]  (only-iris caz)
  ;<  ~  b
    %+  ex-equal
      !>  :*  broker-base:!<(state-0:bu before)
              broker-base:!<(state-0:bu still)
              url.request.push
          ==
    !>  :*  'https://memex.tlon.network/v2/buckets'
            'https://memex.tlon.network/v2/buckets'
            (cat 3 test '/tokens/sampel-palnet')
        ==
  ::  and ~ puts it back
  ;<  *  b  (do-poke %noun !>([%set-broker-base `(unit @t)`~]))
  ;<  sv=vase  b  get-save
  %+  ex-equal
    !>(broker-base:!<(state-0:bu sv))
  !>('https://memex.tlon.network/v2/buckets')
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
::  A host we subscribe to publishes facts about its own bucket and no other.
::  The wire says which bucket the subscription is for; the fact says which it
::  is about, and only an honest host makes those agree. Applying the fact's
::  own claim would let a host we joined rewrite a replica of someone else's
::  bucket -- an empty writer set being the payload that matters, since
::  clients mirror writers and an admin saving that bucket's settings would
::  carry the emptiness to its real host.
::
++  test-a-host-cannot-publish-about-another-bucket
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  =/  theirs=flag:bu  [~bus %their-files]
  ;<  ~  b  (setup-as ~rus)
  ::  We hold replicas of two buckets, hosted by different ships.
  ;<  *  b
    (do-poke %group-channel-join !>(`channel-join:bu`[[%buckets ~sampel-palnet %project-files] group]))
  ;<  *  b
    (do-poke %group-channel-join !>(`channel-join:bu`[[%buckets ~bus %their-files] group]))
  =/  bare=bucket:bu  [1 'Theirs' ~bus ~2026.1.1 ~bus ~2026.1.1]
  =/  st=bucket-state:bu  [bare group (silt `(list @tas)`~[%admin]) ~ 1]
  ::  ~bus, whose subscription this is, publishes a snapshot claiming to be
  ::  about ~sampel-palnet's bucket, with nobody able to write.
  =/  lie=response:bu
    [%snapshot flag st(writers *(set @tas))]
  ;<  caz=(list card)  b
    %^    do-agent
        /buckets/sub/(scot %p ~bus)/their-files
      [~bus %buckets]
    [%fact %buckets-response-1 !>(lie)]
  ::  Nothing is applied and nothing is forwarded to our own clients.
  ;<  ~  b  (ex-cards caz ~)
  ;<  sv=vase  b  get-save
  =/  saved=state-0:bu  !<(state-0:bu sv)
  =/  sp=space:bu  (~(got by spaces.saved) flag)
  %+  ex-equal  !>(state.sp)  !>(~)
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
::  A create that collides on the name is bad client input, not a broken
::  invariant. It used to crash the event, which reaches the caller as a nack
::  or a timeout rather than as the error the contract promises. An otherwise
::  identical create from a second admin is still the same create.
::
++  test-a-conflicting-create-is-an-error-not-a-crash
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  ~  b  (set-scry-gate allow-admin-create-scries)
  ::  Same name, different title -- a real collision.
  ;<  caz=(list card)  b
    (ask 0v1 [%create %project-files 'Something Else' group ~ ~])
  ;<  ~  b
    %+  ex-cards  caz
    :~  %+  grant-fact  0v1
        [%error %invalid-input 'that bucket name is taken']
    ==
  ::  Identical, but from another admin. .actor is not part of the comparison,
  ::  so this is the idempotent path and re-registers rather than erroring.
  ;<  caz2=(list card)  b
    %-  (do-as ~bus)
    %+  do-poke  %buckets-command-1
    !>(`command:bu`[0v2 [%create %project-files 'Project Files' group ~ ~]])
  ::  A re-register republishes the snapshot; an error would not.
  ;<  ~  b
    %+  ex-cards
      %+  skim  caz2
      |=(=card ?=([%give %fact * %buckets-response-1 *] card))
    :~  (ex-fact-paths ~[/v1])
    ==
  ;<  sv=vase  b  get-save
  =/  st=state-0:bu  !<(state-0:bu sv)
  =/  bs=bucket-state:bu  (state-for st flag)
  ::  One Bucket, and the collision did not overwrite its title.
  %+  ex-equal
  !>([~(wyt by spaces.st) next-id.st title.bucket.bs])
  !>([1 1 'Project Files'])
::
::  Local clients watch our /v1, not the host's, so dropping a replica has to
::  say so here or a mounted client keeps rendering a manifest this ship no
::  longer holds.
::
++  test-dropping-a-replica-tells-local-watchers
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  =/  nes=nest:bu  [%buckets ~sampel-palnet %project-files]
  ;<  ~  b  (setup-as ~bus)
  ;<  *  b  (do-poke %group-channel-join !>(`channel-join:bu`[nes group]))
  ;<  caz=(list card)  b
    (do-poke %group-channel-leave !>(`channel-leave:bu`[nes]))
  %+  ex-cards
    %+  skim  caz
    |=(=card ?=([%give %fact * %buckets-response-1 *] card))
  :~  %^    ex-fact
          ~[/v1 /v1/buckets/~sampel-palnet/project-files/updates]
        %buckets-response-1
      !>(`response:bu`[%update flag 0 [%delete ~]])
  ==
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
::  Every verb a client can send has to survive the JSON decoder, and only
::  the HTTP path goes through it -- poking a typed vase, as most of these
::  examples do, skips it entirely. %finish-upload and %retry-upload shipped
::  decoded by nothing and failed as malformed against a live client while
::  the whole typed suite stayed green.
::
++  test-http-decodes-every-session-verb
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  *  b  (begun 0v1 'private.pdf' 42)
  ;<  sv=vase  b  get-save
  =/  ses=upload-session:bu  (only-session !<(state-0:bu sv))
  =/  sid=@t  (scot %uv id.ses)
  =/  verb
    |=  [rid=@t type=@t]
    ^-  @t
    %+  rap  3
    :~  '{"requestId":"'  rid
        '","action":{"type":"'  type
        '","flag":{"host":"~sampel-palnet","name":"project-files"}'
        ',"sessionId":"'  sid  '"}}'
    ==
  ::  Reaching the arm is the whole point: a verb the decoder does not know
  ::  answers %invalid-input and makes no broker call at all, so the call's
  ::  wire is what pins the decode.
  ;<  fin=(list card)  b  (http-post & (verb '0v2' 'finish-upload'))
  ;<  ~  b
    %+  ex-equal
      !>(wire:(only-iris fin))
    !>(/buckets/upload/[sid]/complete)
  ;<  ret=(list card)  b  (http-post & (verb '0v3' 'retry-upload'))
  %+  ex-equal
    !>(wire:(only-iris ret))
  !>(/buckets/upload/[sid]/retry)
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
