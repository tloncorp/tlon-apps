::  A channel has one session whoever speaks in it. Full adapter, synthetic
::  scries only; no emitted cards are executed.
::  -test /=harness=/tests-integration/harness-tlon-shared-session
/-  t=harness-tlon, ad=harness-adapter, h=harness, g=groups-ver,
    a=activity-ver, hh=harness-hand, d=story
/+  *test-agent, continuity=harness-tlon-continuity, policy-lib=harness-tlon-policy,
    hj=harness-json
/=  adapter  /app/harness-tlon
|%
++  room  `destination:t`[%channel [%chat ~lux %test] ~]
++  room-sid  (identity:continuity room)
++  bus-dm  `destination:t`[%dm ~bus ~]
++  owner-defaults  `(list tool-grant:h)`~[%web %workspace %tlon %code]
::  ~nec owns the ship; ~bus is trusted with %web; ~dev may not read the room.
::
++  fixture
  ^-  state-5:t
  =/  s=state-5:t  *state-5:t
  =.  owner-initialized.s  1
  =.  activity-through.s  ~2026.9.9
  =.  policy.s
    [& `~nec (my ~[[~bus ~[%web]]]) %mentions ~ (my ~[[[%chat ~lux %test] [%mentions &]]]) ~ ~]
  s
::  The room's shared session and ~bus's DM, both with ready routes.
::
++  ready
  ^-  state-5:t
  =/  s  fixture
  %=  s
    identities  (my ~[[room room-sid] [bus-dm 'dm']])
    lanes  (my ~[[room-sid [room 1 owner-defaults]] ['dm' [bus-dm 1 ~[%web]]]])
    routes  (my ~[[room-sid ['binding-room' %ready]] ['dm' ['binding-dm' %ready]]])
  ==
++  hands
  ^-  state:hh
  =/  db  *state:hh
  %=  db  bindings
    %-  my
    :~  ['binding-room' ['tlon' 'chat/~lux/test' room-sid ~['*'] &]]
        ['binding-dm' ['tlon' 'dm/~bus' 'dm' ~['~bus'] &]]
    ==
  ==
++  room-group
  ^-  group:v9:g
  =/  group  *group:v9:g
  =.  seats.group  (my ~[[~bus `seat:v9:g`[~ ~2026.9.9]]])
  group(channels (my ~[[[%chat ~lux %test] *channel:v9:g]]))
++  head-connected
  %-  jab-bowl
  |=  b=bowl
  b(wex (~(put by wex.b) [/head ~zod %harness] [& /hand-events]))
::  One mention in the room per speaker, at its time.
::
++  posts
  |=  speakers=(list [who=@p at=@da])
  ^-  stream:v10:a
  %+  roll  speakers
  |=  [[who=@p at=@da] stream=stream:v10:a]
  =/  event=incoming-event:v8:a
    [%post [[who at] at] [%chat ~lux %test] [~lux %test] ~[[%inline ~['hello']]] &]
  (put:on-stream:v10:a stream at [event | |])
++  scries
  |=  [stream=stream:v10:a ledger=state:hh]
  |=  =path
  ^-  (unit vase)
  ?:  ?=([%gu @ %steward @ %$ ~] path)  `!>(|)
  ?:  ?=([%gu @ %contacts @ %$ ~] path)  `!>(|)
  ?:  (lien path |=(part=@ta =(%can-read part)))  `!>(|=([who=@p *] !=(~dev who)))
  ?:  (lien path |=(part=@ta =(%groups part)))  `!>((my ~[[[~lux %test] room-group]]))
  ?:  (lien path |=(part=@ta =(%cron-session part)))  `!>(~)
  ::  Local %channels lacks the channel, so no message is read for its author.
  ?:  ?=([%gu @ %channels @ %v4 *] path)  `!>(|)
  ?:  =(%$ (rear path))  `!>(&)
  ?:  ?=([%gx @ %chat @ %dm %invited %ships ~] path)  `!>(~)
  ?:  ?=([%gx @ %activity @ %v6 %all %noun ~] path)  `!>(stream)
  ?:  (lien path |=(part=@ta =(%hand-state part)))  `!>(ledger)
  ?:  ?=([%gx @ %harness @ %sessions %json ~] path)  `!>(`json`[%a ~])
  ?:  ?=([%gx @ %harness @ %defaults %json ~] path)
    `!>((config-json:hj %*(. *config:h tools owner-defaults)))
  ~
::  Load .saved, then deliver .speakers' posts through Activity catch-up.
::
++  admit
  |=  [saved=state-5:t speakers=(list [@p @da])]
  (admit-stream saved (posts speakers))
++  admit-stream
  |=  [saved=state-5:t stream=stream:v10:a]
  =/  m  (mare ,[(list card) state-5:t])
  ^-  form:m
  ;<  ~  bind:m  (set-bowl %*(. *bowl our ~zod, src ~zod, now ~2026.9.10))
  ;<  ~  bind:m  head-connected
  ;<  ~  bind:m  (set-scry-gate (scries stream hands))
  ;<  *  bind:m  (do-load adapter `!>(saved))
  ;<  ~  bind:m  head-connected
  ;<  caz=(list card)  bind:m  (do-agent /activity [~zod %activity] [%watch-ack ~])
  ;<  =vase  bind:m  get-save
  (pure:m caz !<(state-5:t vase))
::  Load .saved, then save .next as the policy, as the settings page does.
::
++  configure
  |=  [saved=state-5:t next=policy:t]
  (configure-with saved next hands)
++  configure-with
  |=  [saved=state-5:t next=policy:t ledger=state:hh]
  =/  m  (mare ,[(list card) state-5:t])
  ^-  form:m
  ;<  ~  bind:m  (set-bowl %*(. *bowl our ~zod, src ~zod, now ~2026.9.10))
  ;<  ~  bind:m  head-connected
  ;<  ~  bind:m  (set-scry-gate (scries *stream:v10:a ledger))
  ;<  *  bind:m  (do-load adapter `!>(saved))
  ;<  ~  bind:m  head-connected
  =/  params  (policy-json:policy-lib next)
  ;<  caz=(list card)  bind:m
    %+  do-poke  %noun
    !>(`request:ad`['fixture' [%n '1'] 'harness/tlon/configure' `params])
  ;<  =vase  bind:m  get-save
  (pure:m caz !<(state-5:t vase))
::
++  pokes
  |=  [caz=(list card) mark=@tas]
  ^-  (list *)
  %+  murn  caz
  |=  c=card
  ?.  ?=([%pass * %agent * %poke *] c)  ~
  ?.  =(mark p.cage.task.q.c)  ~
  `q.q.cage.task.q.c
++  hand-acts
  |=  caz=(list card)
  ^-  (list action:hh)
  (turn (pokes caz %harness-hand) |=(noun=* act:;;(request:hh noun)))
++  head-acts
  |=  caz=(list card)
  ^-  (list *)
  (pokes caz %harness-action)
++  disabled
  |=  [caz=(list card) binding=@t]
  ^-  ?
  (lien (hand-acts caz) |=(act=action:hh =(act [%enable binding |])))
++  fenced
  |=  [caz=(list card) sid=@t]
  ^-  ?
  (lien (head-acts caz) |=(act=* =(act [%fence sid])))
::
++  test-two-speakers-in-one-channel-share-one-identity
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-5:t]  bind:m
    (admit ready ~[[~bus ~2026.9.9..12.00.00] [~nec ~2026.9.9..12.00.01]])
  =/  bind
    `action:hh`[%bind 'binding-room' ['tlon' 'chat/~lux/test' room-sid ~['*'] &]]
  =/  start  ready
  ;<  ~  bind:m  (ex-equal !>(identities.s) !>(identities.start))
  ;<  ~  bind:m
    %+  ex-equal
      !>((silt (turn ~(val by jobs.s) |=(=job:t [actor.input.job sid.job]))))
    !>((silt ~[[~bus room-sid] [~nec room-sid]]))
  (ex-equal !>((skim (hand-acts caz) |=(act=action:hh ?=(%bind -.act)))) !>(~[bind bind]))
++  test-second-speaker-is-observed-on-the-same-binding
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [* s=state-5:t]  bind:m
    (admit ready ~[[~bus ~2026.9.9..12.00.00] [~nec ~2026.9.9..12.00.01]])
  =/  second  (skim ~(tap by jobs.s) |=([* =job:t] =(~nec actor.input.job)))
  ?>  ?=([* ~] second)
  =/  [id=@uv =job:t]  i.second
  ;<  caz=(list card)  bind:m
    %^  do-agent  /hand/bind/(scot %uv id)  [~zod %harness]
    [%fact %noun !>(`(each json @t)`[%& ~])]
  %+  ex-equal
    !>((hand-acts caz))
  !>(`(list action:hh)`~[[%observe 'binding-room' event.input.job '~nec' '~nec: hello']])
::  A message the head parses as a command reaches it as written, so it still
::  runs; one that only starts with a slash, such as a path, is attributed.
::
++  test-a-command-is-observed-as-written-and-a-path-with-its-speaker
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  observed
    |=  content=(list inline:d)
    =/  m  (mare ,(list @t))
    ^-  form:m
    =/  at  ~2026.9.9..12.00.00
    =/  event=incoming-event:v8:a
      [%post [[~nec at] at] [%chat ~lux %test] [~lux %test] ~[[%inline content]] &]
    ;<  [* s=state-5:t]  bind:m
      (admit-stream ready (put:on-stream:v10:a *stream:v10:a at [event | |]))
    =/  admitted  ~(tap by jobs.s)
    ?>  ?=([* ~] admitted)
    ;<  caz=(list card)  bind:m
      %^  do-agent  /hand/bind/(scot %uv p.i.admitted)  [~zod %harness]
      [%fact %noun !>(`(each json @t)`[%& ~])]
    (pure:m (turn (hand-acts caz) |=(act=action:hh ?>(?=(%observe -.act) text.act))))
  ;<  command=(list @t)  bind:m  (observed ~[[%ship ~zod] ' /model'])
  ;<  ~  bind:m  (ex-equal !>(command) !>(`(list @t)`~['/model']))
  ;<  path=(list @t)  bind:m  (observed ~['/tmp/file is broken'])
  (ex-equal !>(path) !>(`(list @t)`~['~nec: /tmp/file is broken']))
::  A guest's message opens the room, but the session is saved with the
::  owner's Defaults; the guest's own ceiling narrows each of its turns.
::
++  test-session-created-by-a-guest-saves-the-owners-tools
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-5:t]  bind:m  (admit fixture ~[[~bus ~2026.9.9..12.00.00]])
  ;<  ~  bind:m  (ex-equal !>(lanes.s) !>((my ~[[room-sid [room 0 owner-defaults]]])))
  =/  created
    %+  murn  (head-acts caz)
    |=  act=*
    ?.  ?=([%new *] act)  ~
    `;;([%new sid=@t =config:h js-timeout=@dr] act)
  ?>  ?=([* ~] created)
  ;<  ~  bind:m  (ex-equal !>(sid.i.created) !>(room-sid))
  ;<  ~  bind:m  (ex-equal !>(tools.config.i.created) !>(owner-defaults))
  =/  prompt  (trip system.config.i.created)
  (ex-equal !>(?=(^ (find "conversation at chat/~lux/test, shared" prompt))) !>(&))
++  test-one-speakers-grant-change-keeps-the-channel-route-and-binding
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  start  ready
  =/  next  policy.start
  =.  trusted.next  (my ~[[~bus ~[%web %workspace]]])
  ;<  [caz=(list card) s=state-5:t]  bind:m  (configure start next)
  ;<  ~  bind:m  (ex-equal !>((~(get by routes.s) room-sid)) !>(`['binding-room' %ready]))
  ;<  ~  bind:m  (ex-equal !>((~(get by lanes.s) room-sid)) !>(`[room 1 owner-defaults]))
  ;<  ~  bind:m  (ex-equal !>((disabled caz 'binding-room')) !>(|))
  ;<  ~  bind:m  (ex-equal !>((fenced caz room-sid)) !>(|))
  ::  ~bus's own DM is its partner's, and resets.
  ;<  ~  bind:m  (ex-equal !>((~(has by lanes.s) 'dm')) !>(|))
  ;<  ~  bind:m  (ex-equal !>((disabled caz 'binding-dm')) !>(&))
  (ex-equal !>((fenced caz 'dm')) !>(&))
++  test-channel-rule-change-still-resets-the-channel
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  start  ready
  =/  next  policy.start
  =.  channels.next  (my ~[[[%chat ~lux %test] [%all &]]])
  ;<  [caz=(list card) s=state-5:t]  bind:m  (configure start next)
  ;<  ~  bind:m  (ex-equal !>((~(has by lanes.s) room-sid)) !>(|))
  ;<  ~  bind:m  (ex-equal !>((~(has by routes.s) room-sid)) !>(|))
  ;<  ~  bind:m  (ex-equal !>((disabled caz 'binding-room')) !>(&))
  ;<  ~  bind:m  (ex-equal !>((fenced caz room-sid)) !>(&))
  ;<  ~  bind:m  (ex-equal !>((~(get by routes.s) 'dm')) !>(`['binding-dm' %ready]))
  (ex-equal !>((disabled caz 'binding-dm')) !>(|))
++  test-disabling-tlon-resets-every-route
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  start  ready
  ;<  [caz=(list card) s=state-5:t]  bind:m  (configure start policy.start(enabled |))
  ;<  ~  bind:m  (ex-equal !>(lanes.s) !>(*(map @t lane:t)))
  ;<  ~  bind:m  (ex-equal !>(routes.s) !>(*(map @t route:t)))
  ;<  ~  bind:m  (ex-equal !>((disabled caz 'binding-room')) !>(&))
  ;<  ~  bind:m  (ex-equal !>((disabled caz 'binding-dm')) !>(&))
  (ex-equal !>(&((fenced caz room-sid) (fenced caz 'dm'))) !>(&))
::  ~bus is revoked while its turn runs in the room and another message of
::  its waits, beside a queued message from the owner. The room keeps its
::  route; only ~bus's work there stops.
::
++  test-revoked-speakers-running-and-queued-work-is-cancelled-and-others-continue
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  start  ready
  =.  jobs.start
    %-  my
    :~  [0v1 [[~bus 'bus-event' room 'again'] room-sid %bind '']]
        [0v2 [[~nec 'nec-event' room 'hi'] room-sid %bind '']]
    ==
  =/  ledger  hands
  =.  observations.ledger
    (my ~[[0v3 ['binding-room' 'running' '~bus' '~bus: hello' ~2026.9.9 %running]]])
  =/  next  policy.start
  =.  trusted.next  ~
  ;<  [caz=(list card) s=state-5:t]  bind:m  (configure-with start next ledger)
  =/  fences
    %+  murn  (head-acts caz)
    |=  act=*
    ?.  ?=([%fence-actor *] act)  ~
    `;;([%fence-actor @t @t] act)
  ;<  ~  bind:m  (ex-equal !>(fences) !>(~[[%fence-actor room-sid '~bus']]))
  ;<  ~  bind:m  (ex-equal !>(~(key by jobs.s)) !>((silt ~[0v2])))
  ;<  ~  bind:m  (ex-equal !>((~(get by routes.s) room-sid)) !>(`['binding-room' %ready]))
  (ex-equal !>((disabled caz 'binding-room')) !>(|))
::  The head asks whether a speaker may change a conversation's settings.
::  In the room only the owner and the operator's local prompt may; a DM's
::  partner may change their own DM.
::
++  test-only-the-owner-may-change-a-shared-channel
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (set-bowl %*(. *bowl our ~zod, src ~zod, now ~2026.9.10))
  ;<  ~  bind:m  head-connected
  ;<  ~  bind:m  (set-scry-gate (scries *stream:v10:a hands))
  ;<  *  bind:m  (do-load adapter `!>(ready))
  =/  may
    |=  [sid=@t who=@p]
    =/  m  (mare ,?)
    ^-  form:m
    ;<  =cage  bind:m  (got-peek /x/settings/[sid]/(scot %p who))
    (pure:m !<(? q.cage))
  ;<  guest=?  bind:m  (may room-sid ~bus)
  ;<  owner=?  bind:m  (may room-sid ~nec)
  ;<  operator=?  bind:m  (may room-sid ~zod)
  ;<  partner=?  bind:m  (may 'dm' ~bus)
  (ex-equal !>([guest owner operator partner]) !>([| & & &]))
--
