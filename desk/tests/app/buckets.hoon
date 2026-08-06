::  behavior tests for the %buckets Gall agent
::
/-  bu=buckets
/+  *test-agent
/=  buckets-agent  /app/buckets
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
++  create
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m
    (do-poke %buckets-action-1 !>(`action:bu`[%create %project-files 'Project Files' group ~]))
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
++  deny-group-scries
  |=  pax=path
  ^-  (unit vase)
  ?.  ?=([%gx @ %groups @ %v2 %groups @ @ %channels %can-read %noun ~] pax)  ~
  `!>(|=([who=ship =nest:bu] |))
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
    (do-poke %buckets-action-1 !>(`action:bu`[%begin-upload flag `2 'meadow.png' 'image/png' 2.048 ~]))
  ;<  sv=vase  b  get-save
  =/  st=state-0:bu  !<(state-0:bu sv)
  =/  bs=bucket-state:bu  (state-for st flag)
  =/  session-list=(list upload-session:bu)  ~(val by sessions.bs)
  =/  ses=upload-session:bu  ?~(session-list !! i.session-list)
  ;<  *  b
    (do-poke %buckets-action-1 !>(`action:bu`[%finish-upload flag id.ses 'https://objects.test/meadow.png']))
  ;<  sv2=vase  b  get-save
  =/  st2=state-0:bu  !<(state-0:bu sv2)
  =/  bs2=bucket-state:bu  (state-for st2 flag)
  =/  ent=entry:bu  (~(got by entries.bs2) 3)
  =/  fil=file:bu  (file-of ent)
  =/  ses2=upload-session:bu  (~(got by sessions.bs2) id.ses)
  =/  expected-url=(unit @t)  (some 'https://objects.test/meadow.png')
  =/  expected-parent=(unit @ud)  (some 2)
  (ex-equal !>([revision.bs2 status.fil status.ses2 object-url.fil parent.ent]) !>([3 %ready %complete expected-url expected-parent]))
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
::  Cross-ship writes are re-authorized against %groups' live can-read gate;
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
--
