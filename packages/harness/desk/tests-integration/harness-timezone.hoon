::  Per-conversation owner timezone scoping against the real /app/harness head.
::  -test /=harness=/tests-integration/harness-timezone
/-  c=harness-cron, hh=harness-hand, h=harness, adapter=harness-adapter,
    t=harness-tlon, renew=harness-oauth, *harness-store
/+  *test-agent, defaults=harness-defaults, hl=harness, schedule=harness-schedule,
    hd=harness-hand
/=  head  /app/harness
|%
++  t0  ~2026.10.1..12.00.00
::  No tool description names this zone, so a match proves a leak.
++  la  'Pacific/Chatham'
++  scries
  |=  =path
  ^-  (unit vase)
  ?:  ?=([%gu @ %harness-tlon @ %$ ~] path)  `!>(&)
  ?:  ?=([%gx @ %harness-tlon @ %peer-trust %noun ~] path)
    `!>(`peer-trust:t`[[& `~nec ~ %mentions ~ ~] |])
  ?:  ?=([%gx @ %harness-tlon @ %authority *] path)
    `!>(`hand-authority:adapter`[& ~])
  ?:  ?=([%gx @ %harness-tlon @ %admin @ %noun ~] path)
    `!>(=('owner-dm' i.t.t.t.t.t.path))
  `!>(|)
++  base-config
  ^-  config:h
  =/  cfg  builtin-config:defaults
  cfg(url 'http://127.0.0.1:1/completions', key '', model 'fixture', tools ~[%web %tlon])
++  has-substr
  |=  [needle=tape hay=@t]
  ^-  ?
  ?=(^ (find needle (trip hay)))
++  llm-bodies
  |=  caz=(list card)
  ^-  (list @t)
  %+  murn  caz
  |=  =card
  ?.  ?=([%pass [%llm *] %arvo %i %request *] card)  ~
  =/  sent=http-card:renew  card
  ?~(body.request.sent ~ `q.u.body.request.sent)
++  tool-fact-bodies
  |=  caz=(list card)
  ^-  (list @t)
  %+  murn  caz
  |=  =card
  ?.  ?=([%give %fact [[%tools *] ~] %noun *] card)  ~
  `;;(@t q.q.cage.p.card)
++  last-tool-body
  |=  [s=state-0 sid=@t]
  ^-  @t
  =/  session  (~(got by sessions.s) sid)
  =/  found
    %+  murn  log.session
    |=  e=event:h
    ?.  ?=(%tool-completed -.e)  ~
    `body.e
  ?>(?=(^ found) i.found)
++  run-clock
  |=  [saved=state-0 sid=@t]
  =/  m  (mare ,[receipt=@t request=@t])
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, dap %harness, now t0)))
  ;<  ~  bind:m  (set-scry-gate scries)
  ;<  *  bind:m  (do-load head `!>(saved))
  ;<  caz=(list card)  bind:m  (do-poke %harness-action !>(`action:h`[%retry sid]))
  ;<  =vase  bind:m  get-save
  =/  after  !<(state-0 vase)
  =/  bodies  (llm-bodies caz)
  ?>  ?=([@t ~] bodies)
  (pure:m [(last-tool-body after sid) i.bodies])
++  clock-session
  |=  [source=input-source:h actor=(unit @p)]
  ^-  session:h
  =/  cfg  base-config
  =/  input=admitted-input:h  [0v1 source actor ~ t0 [%user 'What time is it?']]
  =/  log=(list event:h)
    :~  [%llm-completed 1 %tool-calls [1 1] [%assistant '' ~[['c1' 'current_time' '{}']]]]
        [%llm-requested 1 %turn]
        [%input-received input]
        [%config-replaced cfg]
    ==
  [log 2]
++  base-state
  ^-  state-0
  =/  s=state-0  *state-0
  =.  defaults.s  base-config
  =.  owner-timezone.s  `la
  =.  bindings.hands.s
    %-  my
    :~  ['b-owner-dm' ['tlon' 'dm/~nec' 'owner-dm' ~['~nec'] &]]
        ['b-room' ['tlon' 'chat/~lux/test' 'room' ~['*'] &]]
        ['b-guest-dm' ['tlon' 'dm/~bus' 'guest-dm' ~['~bus'] &]]
        ['b-alice' ['custom' 'room/alice' 'alice-room' ~['alice'] &]]
        ['b-owner-hand' ['custom' 'room/owner' 'owner-hand' ~['~nec'] &]]
    ==
  s
++  test-owner-private-dm-gets-local-time-zone-line-and-cron-default
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  base-state
  =/  src=input-source:h  [%hand 'b-owner-dm' 'tlon' 'dm/~nec' 'ev1' '~nec']
  =.  sessions.s  (my ~[['owner-dm' (clock-session src `~nec)]])
  ;<  [receipt=@t request=@t]  bind:m  (run-clock s 'owner-dm')
  ;<  ~  bind:m  (ex-equal !>((has-substr "Pacific/Chatham" receipt)) !>(&))
  ;<  ~  bind:m  (ex-equal !>((has-substr "+13:45" receipt)) !>(&))
  ;<  ~  bind:m
    (ex-equal !>((has-substr "The owner's timezone is Pacific/Chatham." request)) !>(&))
  ::  Omitted timezone in cron_add defaults to the owner's timezone in owner DM.
  =/  s2  base-state
  =/  call=tool-call:h
    ['cron1' 'cron_add' '{"schedule":"0 9 * * 1","prompt":"Weekly check","runs":"2"}']
  =/  log=(list event:h)
    :~  [%tool-requested-2 2 'cron1' 'cron_add']
        [%llm-completed 1 %tool-calls [1 1] [%assistant '' ~[call]]]
        [%llm-requested 1 %turn]
        [%input-received [0v2 src `~nec ~ t0 [%user 'Every Monday at 9']]]
        [%config-replaced base-config]
    ==
  =.  sessions.s2  (my ~[['owner-dm' [log 2]]])
  =.  observations.hands.s2
    (my ~[[0v2 ['b-owner-dm' 'ev2' '~nec' 'Every Monday at 9' t0 %running]]])
  =.  active.hands.s2  (my ~[['owner-dm' 0v2]])
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, dap %harness, now t0)))
  ;<  ~  bind:m  (set-scry-gate scries)
  ;<  *  bind:m  (do-load head `!>(s2))
  ;<  caz=(list card)  bind:m
    (do-poke %harness-tool !>(`tool-request:adapter`['owner-dm' 2 call]))
  =/  facts  (tool-fact-bodies caz)
  ?>  ?=([@t ~] facts)
  (ex-equal !>((has-substr "\"timezone\":\"Pacific/Chatham\"" i.facts)) !>(&))
++  test-shared-channel-withholds-owner-timezone-even-when-owner-speaks
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  base-state
  =/  src=input-source:h  [%hand 'b-room' 'tlon' 'chat/~lux/test' 'ev1' '~nec']
  =.  sessions.s  (my ~[['room' (clock-session src `~nec)]])
  ;<  [receipt=@t request=@t]  bind:m  (run-clock s 'room')
  ;<  ~  bind:m  (ex-equal !>((has-substr "\"utc\":" receipt)) !>(&))
  ;<  ~  bind:m  (ex-equal !>((has-substr "Pacific/Chatham" receipt)) !>(|))
  ;<  ~  bind:m  (ex-equal !>((has-substr "\"local\":" receipt)) !>(|))
  ;<  ~  bind:m  (ex-equal !>((has-substr "Pacific/Chatham" request)) !>(|))
  ;<  ~  bind:m  (ex-equal !>((has-substr "The owner's timezone is" request)) !>(|))
  ::  Even when the owner calls cron_add in a shared channel, omitted timezone
  ::  must not default to or echo the owner's timezone; explicit UTC still works.
  =/  s2  base-state
  =/  omit=tool-call:h
    ['c-omit' 'cron_add' '{"schedule":"0 9 * * 1","prompt":"Room check","runs":"2"}']
  =/  explicit=tool-call:h
    :-  'c-utc'
    :-  'cron_add'
    '{"schedule":"0 9 * * 1","timezone":"UTC","prompt":"Room check","runs":"2"}'
  =/  log=(list event:h)
    :~  [%tool-requested-2 2 'c-omit' 'cron_add']
        [%tool-requested-2 2 'c-utc' 'cron_add']
        [%llm-completed 1 %tool-calls [1 1] [%assistant '' ~[omit explicit]]]
        [%llm-requested 1 %turn]
        [%input-received [0v3 src `~nec ~ t0 [%user 'Schedule in room']]]
        [%config-replaced base-config]
    ==
  =.  sessions.s2  (my ~[['room' [log 2]]])
  =.  observations.hands.s2
    (my ~[[0v3 ['b-room' 'ev3' '~nec' 'Schedule in room' t0 %running]]])
  =.  active.hands.s2  (my ~[['room' 0v3]])
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, dap %harness, now t0)))
  ;<  ~  bind:m  (set-scry-gate scries)
  ;<  *  bind:m  (do-load head `!>(s2))
  ;<  caz1=(list card)  bind:m
    (do-poke %harness-tool !>(`tool-request:adapter`['room' 2 omit]))
  =/  f1  (tool-fact-bodies caz1)
  ?>  ?=([@t ~] f1)
  ;<  ~  bind:m  (ex-equal !>((has-substr "error:" i.f1)) !>(&))
  ;<  ~  bind:m  (ex-equal !>((has-substr "Pacific/Chatham" i.f1)) !>(|))
  ;<  caz2=(list card)  bind:m
    (do-poke %harness-tool !>(`tool-request:adapter`['room' 2 explicit]))
  =/  f2  (tool-fact-bodies caz2)
  ?>  ?=([@t ~] f2)
  (ex-equal !>((has-substr "\"timezone\":\"UTC\"" i.f2)) !>(&))
++  test-non-owner-dm-and-peer-withhold-owner-timezone-while-owner-peer-receives-it
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  base-state
  =/  guest-src=input-source:h  [%hand 'b-guest-dm' 'tlon' 'dm/~bus' 'ev1' '~bus']
  =/  alice-src=input-source:h  [%hand 'b-alice' 'custom' 'room/alice' 'ev2' 'alice']
  =/  owner-hand-src=input-source:h  [%hand 'b-owner-hand' 'custom' 'room/owner' 'ev3' '~nec']
  =.  sessions.s
    %-  my
    :~  ['guest-dm' (clock-session guest-src `~bus)]
        ['alice-room' (clock-session alice-src ~)]
        ['owner-hand' (clock-session owner-hand-src `~nec)]
        ['peer--~bus' (clock-session [%peer ~bus 0v1] `~bus)]
        ['peer--~nec' (clock-session [%peer ~nec 0v2] `~nec)]
    ==
  ;<  [g-rec=@t g-req=@t]  bind:m  (run-clock s 'guest-dm')
  ;<  ~  bind:m  (ex-equal !>((has-substr "Pacific/Chatham" g-rec)) !>(|))
  ;<  ~  bind:m  (ex-equal !>((has-substr "Pacific/Chatham" g-req)) !>(|))
  ;<  [a-rec=@t a-req=@t]  bind:m  (run-clock s 'alice-room')
  ;<  ~  bind:m  (ex-equal !>((has-substr "Pacific/Chatham" a-rec)) !>(|))
  ;<  ~  bind:m  (ex-equal !>((has-substr "Pacific/Chatham" a-req)) !>(|))
  ;<  [oh-rec=@t oh-req=@t]  bind:m  (run-clock s 'owner-hand')
  ;<  ~  bind:m  (ex-equal !>((has-substr "Pacific/Chatham" oh-rec)) !>(&))
  ;<  ~  bind:m  (ex-equal !>((has-substr "The owner's timezone is Pacific/Chatham." oh-req)) !>(&))
  ;<  [bp-rec=@t bp-req=@t]  bind:m  (run-clock s 'peer--~bus')
  ;<  ~  bind:m  (ex-equal !>((has-substr "Pacific/Chatham" bp-rec)) !>(|))
  ;<  ~  bind:m  (ex-equal !>((has-substr "Pacific/Chatham" bp-req)) !>(|))
  ;<  [op-rec=@t op-req=@t]  bind:m  (run-clock s 'peer--~nec')
  ;<  ~  bind:m  (ex-equal !>((has-substr "Pacific/Chatham" op-rec)) !>(&))
  (ex-equal !>((has-substr "The owner's timezone is Pacific/Chatham." op-req)) !>(&))
++  test-scheduled-runs-and-subagents-follow-source-conversation-privacy
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  base-state
  =/  dm-src=input-source:h  [%hand 'b-owner-dm' 'tlon' 'dm/~nec' 'ev1' '~nec']
  =/  rm-src=input-source:h  [%hand 'b-room' 'tlon' 'chat/~lux/test' 'ev2' '~nec']
  =/  dm-job=schedule:c
    %:  create:schedule
      :*  %add  0v1  'b-owner-dm'  '~nec'  %prompt
          %-  pairs:enjs:format
          :~  ['schedule' %s '0 9 * * 1']  ['timezone' %s 'UTC']
              ['prompt' %s 'Check']  ['runs' %s '2']
          ==
      ==
      ['tlon' 'dm/~nec' 'owner-dm' ~['~nec'] &]
      ~  t0
    ==
  =/  rm-job=schedule:c
    %:  create:schedule
      :*  %add  0v2  'b-room'  '~nec'  %prompt
          %-  pairs:enjs:format
          :~  ['schedule' %s '0 9 * * 1']  ['timezone' %s 'UTC']
              ['prompt' %s 'Check']  ['runs' %s '2']
          ==
      ==
      ['tlon' 'chat/~lux/test' 'room' ~['*'] &]
      ~  t0
    ==
  =.  schedules.s  (my ~[[0v1 dm-job] [0v2 rm-job]])
  =.  bindings.hands.s
    %-  ~(gas by bindings.hands.s)
    ^-  (list [@t binding:hh])
    :~  [run-sid.dm-job ['tlon' 'dm/~nec' run-sid.dm-job ~['~nec'] &]]
        [run-sid.rm-job ['tlon' 'chat/~lux/test' run-sid.rm-job ~['~nec'] &]]
    ==
  =.  sessions.s
    %-  my
    :~  ['owner-dm' (clock-session dm-src `~nec)]
        ['room' (clock-session rm-src `~nec)]
        :-  run-sid.dm-job
        (clock-session [%hand run-sid.dm-job 'tlon' 'dm/~nec' 'ev3' '~nec'] `~nec)
        :-  run-sid.rm-job
        (clock-session [%hand run-sid.rm-job 'tlon' 'chat/~lux/test' 'ev4' '~nec'] `~nec)
        ['sub-dm' (clock-session [%subagent 'owner-dm' 'sub1'] ~)]
        ['sub-room' (clock-session [%subagent 'room' 'sub2'] ~)]
    ==
  ;<  [dr-rec=@t dr-req=@t]  bind:m  (run-clock s run-sid.dm-job)
  ;<  ~  bind:m  (ex-equal !>((has-substr "Pacific/Chatham" dr-rec)) !>(&))
  ;<  ~  bind:m  (ex-equal !>((has-substr "Pacific/Chatham" dr-req)) !>(&))
  ;<  [rr-rec=@t rr-req=@t]  bind:m  (run-clock s run-sid.rm-job)
  ;<  ~  bind:m  (ex-equal !>((has-substr "Pacific/Chatham" rr-rec)) !>(|))
  ;<  ~  bind:m  (ex-equal !>((has-substr "Pacific/Chatham" rr-req)) !>(|))
  ;<  [sd-rec=@t sd-req=@t]  bind:m  (run-clock s 'sub-dm')
  ;<  ~  bind:m  (ex-equal !>((has-substr "Pacific/Chatham" sd-rec)) !>(&))
  ;<  ~  bind:m  (ex-equal !>((has-substr "Pacific/Chatham" sd-req)) !>(&))
  ;<  [sr-rec=@t sr-req=@t]  bind:m  (run-clock s 'sub-room')
  ;<  ~  bind:m  (ex-equal !>((has-substr "Pacific/Chatham" sr-rec)) !>(|))
  (ex-equal !>((has-substr "Pacific/Chatham" sr-req)) !>(|))
--
