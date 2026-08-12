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
  [~zod %project-files]
::
++  group
  ^-  flag:bu
  [~zod %test-group]
::
++  setup
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod)))
  ;<  *  bind:m  (do-init dap buckets-agent)
  ;<  ~  bind:m
    (jab-bowl |=(b=bowl b(now ~2026.1.1, eny 0v1234)))
  (pure:m ~)
::
++  setup-as
  |=  who=ship
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our who, src who)))
  ;<  *  bind:m  (do-init dap buckets-agent)
  ;<  ~  bind:m
    (jab-bowl |=(b=bowl b(now ~2026.1.1, eny 0v1234)))
  (pure:m ~)
::
++  create
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m
    (do-poke %buckets-action-1 !>(`action:bu`[%create %project-files 'Project Files' group ~ ~]))
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
  |=  [st=state-2:bu =flag:bu]
  ^-  bucket-state:bu
  =/  sp=space:bu  (~(got by spaces.st) flag)
  (need state.sp)
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
::  A non-host admin's local agent forwards creation to the group host rather
::  than allocating storage on the admin's ship.
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
  ;<  caz=(list card)  b
    (do-poke %buckets-action-1 !>(act))
  %+  ex-cards  caz
  :~  %-  ex-poke
      :*  /buckets/cmd/create/~zod/project-files
          [~zod %buckets]
          %buckets-command-1
          !>(`command:bu`[act])
      ==
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
    !>([[%create %project-files 'Project Files' group ~ ~]])
  ;<  sv=vase  b  get-save
  =/  st=state-2:bu  !<(state-2:bu sv)
  =/  fl=flag:bu  flag
  =/  bs=bucket-state:bu  (state-for st fl)
  %+  ex-equal
  !>([ship.fl created-by.bucket.bs updated-by.bucket.bs group.bs])
  !>([~zod ~bus ~bus group])
::
::  A stale or forged admin request is rejected by the group host's own
::  authoritative group state.
::
++  test-non-admin-cannot-create
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  (set-scry-gate deny-admin-create-scries)
  %-  ex-fail
  %-  (do-as ~bus)
  %+  do-poke  %buckets-command-1
  !>([[%create %project-files 'Project Files' group ~ ~]])
::
::  Gall retries reuse the caller-selected random name. An identical retry
::  must not allocate a second Bucket, but it does retry group registration.
::
++  test-create-retry-is-idempotent
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  =/  cmd=command:bu
    [[%create %project-files 'Project Files' group ~ ~]]
  ;<  ~  b  setup
  ;<  ~  b  (set-scry-gate allow-admin-create-scries)
  ;<  *  b  ((do-as ~bus) (do-poke %buckets-command-1 !>(cmd)))
  ;<  *  b  ((do-as ~bus) (do-poke %buckets-command-1 !>(cmd)))
  ;<  sv=vase  b  get-save
  =/  st=state-2:bu  !<(state-2:bu sv)
  %+  ex-equal
  !>([next-id.st (lent ~(tap by spaces.st))])
  !>([1 1])
::
::  Existing state-1 Buckets keep all metadata and preserve the old
::  "readers can write" behavior when the writer role-set is introduced.
::
++  test-migrate-state-1-to-2
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  =/  legacy-bucket=bucket:bu
    [41 'Legacy Files' ~zod ~2025.1.1 ~zod ~2025.1.2]
  =/  legacy-readers=(set @tas)
    (~(put in (~(put in *(set @tas)) %editor)) %member)
  =/  legacy-state=bucket-state-1:bu
    [legacy-bucket group legacy-readers ~ ~ 9]
  =/  legacy-space=space-1:bu  [%pub `legacy-state ~]
  =/  legacy-spaces=(map flag:bu space-1:bu)
    (~(put by *(map flag:bu space-1:bu)) flag legacy-space)
  =/  old=state-1:bu  [%1 legacy-spaces 42 ~ ~]
  ;<  *  b  (do-load buckets-agent `!>(old))
  ;<  sv=vase  b  get-save
  =/  migrated=state-2:bu  !<(state-2:bu sv)
  =/  bucket-state=bucket-state:bu  (state-for migrated flag)
  %+  ex-equal
  !>([next-id.migrated id.bucket.bucket-state title.bucket.bucket-state readers.bucket-state writers.bucket-state revision.bucket-state])
  !>([42 41 'Legacy Files' legacy-readers legacy-readers 9])
::
::  A complete metadata-only upload lifecycle. The bytes never enter Gall;
::  only the host-issued session, object key, and final object URL do.
::
++  test-upload-lifecycle
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  *  b
    (do-poke %buckets-action-1 !>(`action:bu`[%create-folder flag ~ 'Launch']))
  ;<  *  b
    (do-poke %buckets-action-1 !>(`action:bu`[%begin-upload flag `2 'meadow.png' 'image/png' 2.048 ~ 'legacy-capability-0000000000000000']))
  ;<  sv=vase  b  get-save
  =/  st=state-2:bu  !<(state-2:bu sv)
  =/  bs=bucket-state:bu  (state-for st flag)
  =/  session-list=(list upload-session:bu)  ~(val by sessions.bs)
  =/  ses=upload-session:bu  ?~(session-list !! i.session-list)
  ;<  *  b
    (do-poke %buckets-action-1 !>(`action:bu`[%finish-upload flag id.ses 'https://storage.googleapis.com/tlon-test-memex-assets/meadow.png']))
  ;<  sv2=vase  b  get-save
  =/  st2=state-2:bu  !<(state-2:bu sv2)
  =/  bs2=bucket-state:bu  (state-for st2 flag)
  =/  ent=entry:bu  (~(got by entries.bs2) 3)
  =/  fil=file:bu  (file-of ent)
  =/  ses2=upload-session:bu  (~(got by sessions.bs2) id.ses)
  =/  expected-url=(unit @t)  (some 'https://storage.googleapis.com/tlon-test-memex-assets/meadow.png')
  =/  expected-parent=(unit @ud)  (some 2)
  (ex-equal !>([revision.bs2 status.fil status.ses2 object-url.fil parent.ent]) !>([3 %ready %complete expected-url expected-parent]))
::
::  The Pioneer bridge binds Memex's proposed reservation exactly once and
::  only marks the file ready after a matching verified receipt callback.
::
++  test-broker-upload-lifecycle
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  =/  cap=@t  'broker-capability-00000000000000000000'
  =/  rid=@t  '00000000-0000-0000-0000-000000000001'
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  *  b
    (do-poke %buckets-action-1 !>(`action:bu`[%begin-upload flag ~ 'private.pdf' 'application/pdf' 42 ~ cap]))
  ;<  *  b
    (do-poke %buckets-broker-command-1 !>(`broker-command:bu`[%authorize-upload cap rid]))
  ;<  upload-cage=cage  b
    (got-peek /x/v1/broker/upload/[cap]/[rid])
  =/  upload-json=json  !<(json q.upload-cage)
  =/  upload-result=@t
    (so:dejs:format (get:dejs:buckets-json 'result' upload-json))
  ;<  sv=vase  b  get-save
  =/  st=state-2:bu  !<(state-2:bu sv)
  =/  aut=broker-capability:bu  (~(got by broker-capabilities.st) cap)
  =/  bs=bucket-state:bu  (state-for st flag)
  =/  session-list=(list upload-session:bu)  ~(val by sessions.bs)
  =/  ses=upload-session:bu  ?~(session-list !! i.session-list)
  =/  ent=entry:bu  (~(got by entries.bs) file-id.ses)
  =/  fil=file:bu  (file-of ent)
  ;<  ~  b
    (ex-equal !>(broker-reservation-id.aut) !>(`rid))
  =/  receipt=broker-receipt:bu
    [rid object-key.fil 'zod' (scot %ud id.bucket.bs) 42 'application/pdf']
  ;<  *  b
    (do-poke %buckets-broker-command-1 !>(`broker-command:bu`[%complete-upload receipt]))
  ::  Completion retries are idempotent.
  ;<  *  b
    (do-poke %buckets-broker-command-1 !>(`broker-command:bu`[%complete-upload receipt]))
  ;<  sv2=vase  b  get-save
  =/  st2=state-2:bu  !<(state-2:bu sv2)
  =/  bs2=bucket-state:bu  (state-for st2 flag)
  =/  ent2=entry:bu  (~(got by entries.bs2) file-id.ses)
  =/  fil2=file:bu  (file-of ent2)
  =/  ses2=upload-session:bu  (~(got by sessions.bs2) id.ses)
  =/  read-cap=@t  'read-capability-0000000000000000000000'
  =/  delete-cap=@t  'delete-capability-00000000000000000000'
  ;<  *  b
    (do-poke %buckets-action-1 !>(`action:bu`[%issue-read flag file-id.ses read-cap]))
  ;<  *  b
    (do-poke %buckets-action-1 !>(`action:bu`[%issue-delete flag file-id.ses delete-cap]))
  ;<  read-cage=cage  b
    (got-peek /x/v1/broker/read/[read-cap]/[object-key.fil2])
  ;<  delete-cage=cage  b
    (got-peek /x/v1/broker/delete/[delete-cap]/[object-key.fil2])
  ;<  denied-cage=cage  b
    (got-peek /x/v1/broker/read/[read-cap]/wrong-object)
  =/  read-json=json  !<(json q.read-cage)
  =/  delete-json=json  !<(json q.delete-cage)
  =/  denied-json=json  !<(json q.denied-cage)
  =/  read-payload=json
    (get:dejs:buckets-json 'read' read-json)
  =/  delete-payload=json
    (get:dejs:buckets-json 'delete' delete-json)
  ?>  ?=([%o *] delete-payload)
  =/  delete-filename=(unit json)
    (~(get by p.delete-payload) 'displayFilename')
  =/  read-result=@t
    (so:dejs:format (get:dejs:buckets-json 'result' read-json))
  =/  read-object=@t
    (so:dejs:format (get:dejs:buckets-json 'objectId' read-payload))
  =/  read-name=@t
    (so:dejs:format (get:dejs:buckets-json 'displayFilename' read-payload))
  =/  delete-result=@t
    (so:dejs:format (get:dejs:buckets-json 'result' delete-json))
  =/  delete-object=@t
    (so:dejs:format (get:dejs:buckets-json 'objectId' delete-payload))
  =/  denied-result=@t
    (so:dejs:format (get:dejs:buckets-json 'result' denied-json))
  =/  next-read-cap=@t  'next-read-capability-000000000000000000'
  ;<  ~  b
    (jab-bowl |=(bol=bowl bol(now ~2026.1.1..02.00.00)))
  ;<  *  b
    (do-poke %buckets-action-1 !>(`action:bu`[%issue-read flag file-id.ses next-read-cap]))
  ;<  sv3=vase  b  get-save
  =/  st3=state-2:bu  !<(state-2:bu sv3)
  =/  old-upload-pruned=?
    !(~(has by broker-capabilities.st3) cap)
  =/  old-read-pruned=?
    !(~(has by broker-capabilities.st3) read-cap)
  =/  old-delete-pruned=?
    !(~(has by broker-capabilities.st3) delete-cap)
  =/  old-reservation-pruned=?
    !(~(has by broker-reservations.st3) rid)
  =/  next-read-kept=?
    (~(has by broker-capabilities.st3) next-read-cap)
  %+  ex-equal
  !>  :*  upload-result
          status.fil2
          object-url.fil2
          status.ses2
          read-result
          read-object
          read-name
          delete-result
          delete-object
          delete-filename
          denied-result
          old-upload-pruned
          old-read-pruned
          old-delete-pruned
          old-reservation-pruned
          next-read-kept
      ==
  !>  :*  'authorized'
          %ready
          ~
          %complete
          'authorized'
          object-key.fil2
          'private.pdf'
          'authorized'
          object-key.fil2
          ~
          'denied'
          &
          &
          &
          &
          &
      ==
::
::  Legacy completion accepts only live sessions and Tlon-managed Memex URLs.
::
++  test-legacy-upload-completion-is-bounded
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  *  b
    (do-poke %buckets-action-1 !>(`action:bu`[%begin-upload flag ~ 'unsafe.txt' 'text/plain' 4 ~ 'legacy-security-capability-000000000000']))
  ;<  sv=vase  b  get-save
  =/  st=state-2:bu  !<(state-2:bu sv)
  =/  bs=bucket-state:bu  (state-for st flag)
  =/  sessions=(list upload-session:bu)  ~(val by sessions.bs)
  =/  ses=upload-session:bu  ?~(sessions !! i.sessions)
  ;<  *  b
    %-  ex-fail
    (do-poke %buckets-action-1 !>(`action:bu`[%finish-upload flag id.ses 'https://attacker.example/tracker']))
  ;<  *  b
    %-  ex-fail
    (do-poke %buckets-action-1 !>(`action:bu`[%finish-upload flag id.ses 'https://storage.googleapis.com/tlon-attacker/path/-memex-assets/tracker']))
  ;<  ~  b  (jab-bowl |=(bol=bowl bol(now ~2026.1.1..02.00.00)))
  %-  ex-fail
  (do-poke %buckets-action-1 !>(`action:bu`[%finish-upload flag id.ses 'https://storage.googleapis.com/tlon-test-memex-assets/expired.txt']))
::
::  Broker callbacks whose capability outlives a deleted Bucket deny softly
::  instead of crashing the Pioneer thread.
::
++  test-broker-command-after-delete-is-soft-denied
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  =/  cap=@t  'delete-race-capability-0000000000000000'
  =/  rid=@t  '00000000-0000-0000-0000-000000000009'
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  *  b
    (do-poke %buckets-action-1 !>(`action:bu`[%begin-upload flag ~ 'race.pdf' 'application/pdf' 42 ~ cap]))
  ;<  *  b
    (do-poke %buckets-action-1 !>(`action:bu`[%delete-bucket flag]))
  ;<  caz=(list card)  b
    (do-poke %buckets-broker-command-1 !>(`broker-command:bu`[%authorize-upload cap rid]))
  (ex-cards caz ~)
::
::  Reader changes are revisioned into the Bucket replica as well as %groups.
::
++  test-set-readers-updates-bucket-state
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  =/  readers=(set @tas)  (silt `(list @tas)`~[%member %guest])
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  *  b
    (do-poke %buckets-action-1 !>(`action:bu`[%set-readers flag readers]))
  ;<  sv=vase  b  get-save
  =/  st=state-2:bu  !<(state-2:bu sv)
  =/  bs=bucket-state:bu  (state-for st flag)
  (ex-equal !>([readers.bs revision.bs]) !>([readers 1]))
::
::  Folder parents must exist and must themselves be folders.
::
++  test-invalid-parent-rejected
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  %-  ex-fail
  (do-poke %buckets-action-1 !>(`action:bu`[%create-folder flag `999 'Bad']))
::
::  Cross-ship writes are re-authorized against %groups' live read gate;
::  membership recorded in old state is never treated as permanent authority.
::
++  test-remote-write-revoked
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  ~  b  (set-scry-gate deny-group-scries)
  %-  ex-fail
  %-  (do-as ~bus)
  %+  do-poke  %buckets-command-1
  !>([[%create-folder flag ~ 'Denied']])
::
::  %groups represents a missing/banned seat as a null permission record.
::  Buckets must deny that write instead of crashing while decoding the scry.
::
++  test-remote-write-without-seat
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  ~  b  create
  ;<  ~  b  (set-scry-gate missing-group-permission-scries)
  %-  ex-fail
  %-  (do-as ~bus)
  %+  do-poke  %buckets-command-1
  !>([[%create-folder flag ~ 'Denied']])
::
::  A readable member still needs a matching writer role for mutations.
::
++  test-remote-writer-role
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  setup
  ;<  *  b
    (do-poke %buckets-action-1 !>(`action:bu`[%create %project-files 'Project Files' group ~ (silt ~[%editor])]))
  ;<  ~  b  (set-scry-gate group-permission-scries)
  ;<  *  b
    %-  (do-as ~bus)
    %+  do-poke  %buckets-command-1
    !>([[%create-folder flag ~ 'Allowed']])
  ;<  sv=vase  b  get-save
  =/  st=state-2:bu  !<(state-2:bu sv)
  =/  bs=bucket-state:bu  (state-for st flag)
  (ex-equal !>((lent ~(val by entries.bs))) !>(1))
--
