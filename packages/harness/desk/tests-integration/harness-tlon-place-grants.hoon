::  Per-place grants: a DM or one channel. Full adapter, synthetic scries
::  only; no emitted cards are executed.
::  -test /=harness=/tests-integration/harness-tlon-place-grants
/-  t=harness-tlon, ad=harness-adapter, h=harness, g=groups-ver,
    a=activity-ver, hh=harness-hand, dv=channels-ver
/+  *test-agent, continuity=harness-tlon-continuity, policy-lib=harness-tlon-policy,
    hj=harness-json
/=  adapter  /app/harness-tlon
|%
++  room-nest  `nest:dv`[%chat ~lux %test]
++  other-nest  `nest:dv`[%chat ~lux %other]
++  room  `destination:t`[%channel room-nest ~]
++  room-sid  (identity:continuity room)
++  owner-defaults  `(list tool-grant:h)`~[%web %workspace %tlon %code]
::  ~nec owns the ship. ~bus has a grant for its DM, ~dev one for the room
::  and ~bud is allowed everywhere. Both channels need mentions.
::
++  fixture
  ^-  state-5:t
  =/  s=state-5:t  *state-5:t
  =.  owner-initialized.s  1
  =.  activity-through.s  ~2026.9.9
  =.  policy.s
    :*  &  `~nec  ~  %mentions  (silt ~[~bud])
        (my ~[[room-nest [%mentions |]] [other-nest [%mentions |]]])
        (silt ~[~bus])
        (my ~[[room-nest (silt ~[~dev])]])
    ==
  s
++  room-group
  ^-  group:v9:g
  =/  group  *group:v9:g
  =.  seats.group
    %-  malt
    %+  turn  `(list @p)`~[~bus ~dev ~bud ~nus]
    |=(who=@p [who `seat:v9:g`[~ ~2026.9.9]])
  group(channels (my ~[[room-nest *channel:v9:g] [other-nest *channel:v9:g]]))
++  head-connected
  %-  jab-bowl
  |=  b=bowl
  b(wex (~(put by wex.b) [/head ~zod %harness] [& /hand-events]))
++  mention
  |=  [who=@p nest=nest:dv at=@da]
  ^-  incoming-event:v8:a
  [%post [[who at] at] nest [~lux %test] ~[[%inline ~['hello']]] &]
++  dm
  |=  [who=@p at=@da]
  ^-  incoming-event:v8:a
  [%dm-post [[who at] at] [%ship who] ~[[%inline ~['hello']]] |]
++  stream
  |=  events=(list [at=@da event=incoming-event:v8:a])
  ^-  stream:v10:a
  %+  roll  events
  |=  [[at=@da event=incoming-event:v8:a] =stream:v10:a]
  (put:on-stream:v10:a stream at [event | |])
++  scries
  |=  events=stream:v10:a
  |=  =path
  ^-  (unit vase)
  ?:  ?=([%gu @ %contacts @ %$ ~] path)  `!>(|)
  ::  Every ship here may read both channels natively.
  ?:  (lien path |=(part=@ta =(%can-read part)))  `!>(|=([who=@p *] &))
  ?:  (lien path |=(part=@ta =(%groups part)))  `!>((my ~[[[~lux %test] room-group]]))
  ?:  (lien path |=(part=@ta =(%cron-session part)))  `!>(~)
  ?:  ?=([%gu @ %channels @ %v4 *] path)  `!>(|)
  ?:  =(%$ (rear path))  `!>(&)
  ?:  ?=([%gx @ %chat @ %dm %invited %ships ~] path)  `!>(~)
  ?:  ?=([%gx @ %activity @ %v6 %all %noun ~] path)  `!>(events)
  ?:  (lien path |=(part=@ta =(%hand-state part)))  `!>(*state:hh)
  ?:  ?=([%gx @ %harness @ %sessions %json ~] path)  `!>(`json`[%a ~])
  ?:  ?=([%gx @ %harness @ %defaults %json ~] path)
    `!>((config-json:hj %*(. *config:h tools owner-defaults)))
  ~
::  Load .saved, then deliver .events through Activity catch-up.
::
++  admit
  |=  [saved=state-5:t events=(list [@da incoming-event:v8:a])]
  =/  m  (mare ,[(list card) state-5:t])
  ^-  form:m
  ;<  ~  bind:m  (set-bowl %*(. *bowl our ~zod, src ~zod, now ~2026.9.10))
  ;<  ~  bind:m  head-connected
  ;<  ~  bind:m  (set-scry-gate (scries (stream events)))
  ;<  *  bind:m  (do-load adapter `!>(saved))
  ;<  ~  bind:m  head-connected
  ;<  caz=(list card)  bind:m  (do-agent /activity [~zod %activity] [%watch-ack ~])
  ;<  =vase  bind:m  get-save
  (pure:m caz !<(state-5:t vase))
::  Load .saved, then save .next through the policy endpoint.
::
++  configure
  |=  [saved=state-5:t next=policy:t]
  =/  m  (mare ,[(list card) state-5:t])
  ^-  form:m
  ;<  ~  bind:m  (set-bowl %*(. *bowl our ~zod, src ~zod, now ~2026.9.10))
  ;<  ~  bind:m  head-connected
  ;<  ~  bind:m  (set-scry-gate (scries *stream:v10:a))
  ;<  *  bind:m  (do-load adapter `!>(saved))
  ;<  ~  bind:m  head-connected
  =/  params  (policy-json:policy-lib next)
  ;<  caz=(list card)  bind:m
    %+  do-poke  %noun
    !>(`request:ad`['fixture' [%n '1'] 'harness/tlon/configure' `params])
  ;<  =vase  bind:m  get-save
  (pure:m caz !<(state-5:t vase))
::  Load .saved, then hear from %channels that the bot left .nest.
::
++  leave
  |=  [saved=state-5:t nest=nest:dv]
  =/  m  (mare ,[(list card) state-5:t])
  ^-  form:m
  ;<  ~  bind:m  (set-bowl %*(. *bowl our ~zod, src ~zod, now ~2026.9.10))
  ;<  ~  bind:m  head-connected
  ;<  ~  bind:m  (set-scry-gate (scries *stream:v10:a))
  ;<  *  bind:m  (do-load adapter `!>(saved))
  ;<  ~  bind:m  head-connected
  ;<  caz=(list card)  bind:m
    %^  do-agent  /publications  [~zod %channels]
    [%fact %channel-response-4 !>(`r-channels:v9:dv`[nest %leave ~])]
  ;<  =vase  bind:m  get-save
  (pure:m caz !<(state-5:t vase))
::  The same, with the %harness head not running.
::
++  leave-headless
  |=  [saved=state-5:t nest=nest:dv]
  =/  m  (mare ,[(list card) state-5:t])
  ^-  form:m
  ;<  ~  bind:m  (set-bowl %*(. *bowl our ~zod, src ~zod, now ~2026.9.10))
  ;<  ~  bind:m
    %-  set-scry-gate
    |=  =path
    ^-  (unit vase)
    ?:  ?=([%gu @ %harness @ %$ ~] path)  `!>(|)
    ?:  ?=([%gx @ %harness *] path)  ~
    ((scries *stream:v10:a) path)
  ;<  *  bind:m  (do-load adapter `!>(saved))
  ;<  caz=(list card)  bind:m
    %^  do-agent  /publications  [~zod %channels]
    [%fact %channel-response-4 !>(`r-channels:v9:dv`[nest %leave ~])]
  ;<  =vase  bind:m  get-save
  (pure:m caz !<(state-5:t vase))
::
++  admitted
  |=  s=state-5:t
  ^-  (set [@p destination:t])
  (silt (turn ~(val by jobs.s) |=(=job:t [actor to]:input.job)))
++  pokes
  |=  [caz=(list card) mark=@tas]
  ^-  (list *)
  %+  murn  caz
  |=  c=card
  ?.  ?=([%pass * %agent * %poke *] c)  ~
  ?.  =(mark p.cage.task.q.c)  ~
  `q.q.cage.task.q.c
::
++  test-a-ship-granted-one-channel-is-answered-there-and-ignored-elsewhere
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [* s=state-5:t]  bind:m
    %+  admit  fixture
    :~  [~2026.9.9..12.00.00 (mention ~dev room-nest ~2026.9.9..12.00.00)]
        [~2026.9.9..12.00.01 (mention ~dev other-nest ~2026.9.9..12.00.01)]
        [~2026.9.9..12.00.02 (dm ~dev ~2026.9.9..12.00.02)]
    ==
  (ex-equal !>((admitted s)) !>((silt ~[[~dev room]])))
++  test-a-ship-granted-its-dm-is-answered-there-and-ignored-in-channels
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [* s=state-5:t]  bind:m
    %+  admit  fixture
    :~  [~2026.9.9..12.00.00 (dm ~bus ~2026.9.9..12.00.00)]
        [~2026.9.9..12.00.01 (mention ~bus room-nest ~2026.9.9..12.00.01)]
        [~2026.9.9..12.00.02 (mention ~bus other-nest ~2026.9.9..12.00.02)]
    ==
  (ex-equal !>((admitted s)) !>((silt ~[[~bus `destination:t`[%dm ~bus ~]]])))
++  test-a-dm-grant-accepts-its-dm-invitation-and-a-channel-grant-does-not
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) *]  bind:m
    %+  admit  fixture
    :~  [~2026.9.9..12.00.00 [%dm-invite [%ship ~bus]]]
        [~2026.9.9..12.00.01 [%dm-invite [%ship ~dev]]]
    ==
  %+  ex-equal
    !>((pokes caz %chat-dm-rsvp))
  !>(`(list *)`~[[~bus &]])
++  test-a-place-grant-does-not-make-the-bot-accept-a-group-invite
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) *]  bind:m
    %+  admit  fixture
    :~  [~2026.9.9..12.00.00 [%group-invite [~bus %one] ~bus]]
        [~2026.9.9..12.00.01 [%group-invite [~dev %two] ~dev]]
        [~2026.9.9..12.00.02 [%group-invite [~bud %three] ~bud]]
    ==
  %+  ex-equal
    !>((pokes caz %group-join))
  !>(`(list *)`~[[[~bud %three] &]])
::  ~bus was granted its DM at ~2026.9.9 and is granted the room at
::  ~2026.9.10. Its earlier DM is still answered; its earlier room
::  mention, from before the room grant, is not.
::
++  test-a-channel-grant-does-not-move-the-same-ships-dm-cutoff
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  fixture
  =.  place-cuts.saved  (my ~[[[~bus ~] ~2026.9.9]])
  =/  next  policy.saved
  =.  channel-grants.next  (~(put by channel-grants.next) room-nest (silt ~[~dev ~bus]))
  ;<  [* granted=state-5:t]  bind:m  (configure saved next)
  ;<  ~  bind:m  (ex-equal !>(cuts.granted) !>(cuts.saved))
  ;<  ~  bind:m
    %+  ex-equal
      !>(place-cuts.granted)
    !>((my ~[[[~bus ~] ~2026.9.9] [[~bus `room-nest] ~2026.9.10]]))
  ;<  [* s=state-5:t]  bind:m
    %+  admit  granted
    :~  [~2026.9.9..12.00.00 (dm ~bus ~2026.9.9..12.00.00)]
        [~2026.9.9..12.00.01 (mention ~bus room-nest ~2026.9.9..12.00.01)]
    ==
  (ex-equal !>((admitted s)) !>((silt ~[[~bus `destination:t`[%dm ~bus ~]]])))
::  ~dev holds the room and is granted its DM; its earlier room mention is
::  still answered.
::
++  test-a-dm-grant-does-not-move-the-same-ships-channel-cutoff
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  fixture
  =.  place-cuts.saved  (my ~[[[~dev `room-nest] ~2026.9.9]])
  =/  next  policy.saved
  =.  dm-grants.next  (~(put in dm-grants.next) ~dev)
  ;<  [* granted=state-5:t]  bind:m  (configure saved next)
  ;<  ~  bind:m
    %+  ex-equal
      !>(`(unit @da)`(~(get by place-cuts.granted) [~dev `room-nest]))
    !>(`(unit @da)``~2026.9.9)
  ;<  [* s=state-5:t]  bind:m
    %+  admit  granted
    :~  [~2026.9.9..12.00.00 (mention ~dev room-nest ~2026.9.9..12.00.00)]
        [~2026.9.9..12.00.01 (dm ~dev ~2026.9.9..12.00.01)]
    ==
  (ex-equal !>((admitted s)) !>((silt ~[[~dev room]])))
::  ~dev speaks in the room, in the other channel and in its DM, holding a
::  grant for each. Revoking its room grant fences its work in the room alone
::  and keeps every route. The head runs the turn; the adapter's part is the
::  fence it sends and the queued work it drops.
::
++  test-removing-a-channel-grant-cancels-that-ships-work-there-only
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  fixture
  =/  other  `destination:t`[%channel other-nest ~]
  =/  other-sid  (identity:continuity other)
  =/  dev-dm  `destination:t`[%dm ~dev ~]
  =.  saved
    %=  saved
      dm-grants.policy  (silt ~[~bus ~dev])
      channel-grants.policy  (my ~[[room-nest (silt ~[~dev])] [other-nest (silt ~[~dev])]])
      identities  (my ~[[room room-sid] [other other-sid] [dev-dm 'dm']])
      lanes
        %-  my
        :~  [room-sid [room 1 owner-defaults]]
            [other-sid [other 1 owner-defaults]]
            ['dm' [dev-dm 1 ~[%web]]]
        ==
      routes
        %-  my
        :~  [room-sid ['binding-room' %ready]]
            [other-sid ['binding-other' %ready]]
            ['dm' ['binding-dm' %ready]]
        ==
      jobs
        %-  my
        :~  [0v1 [[~dev 'e1' room 'hi'] room-sid %bind '']]
            [0v2 [[~dev 'e2' other 'hi'] other-sid %bind '']]
            [0v3 [[~dev 'e3' dev-dm 'hi'] 'dm' %bind '']]
        ==
    ==
  =/  next  policy.saved
  =.  channel-grants.next  (my ~[[other-nest (silt ~[~dev])]])
  ;<  [caz=(list card) s=state-5:t]  bind:m  (configure saved next)
  =/  acts  (pokes caz %harness-action)
  ;<  ~  bind:m
    %+  ex-equal
      !>((skim acts |=(act=* ?=([%fence-actor *] act))))
    !>(`(list *)`~[[%fence-actor room-sid '~dev']])
  ;<  ~  bind:m  (ex-equal !>((lien acts |=(act=* ?=([%fence *] act)))) !>(|))
  ;<  ~  bind:m  (ex-equal !>(~(key by lanes.s)) !>((silt ~[room-sid other-sid 'dm'])))
  ;<  ~  bind:m  (ex-equal !>(~(key by routes.s)) !>((silt ~[room-sid other-sid 'dm'])))
  (ex-equal !>(~(key by jobs.s)) !>((silt ~[0v2 0v3])))
::  ~nus is on no list and reads an open room, where it is already answered.
::  A grant there, and its removal, change nothing: no fence, no dropped
::  work, no cutoff. ~bud is allowed everywhere; its room grant is the same.
::
++  test-a-grant-that-changes-no-access-cancels-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  fixture
  =.  saved
    %=  saved
      channels.policy  (my ~[[room-nest [%mentions &]] [other-nest [%mentions |]]])
      identities  (my ~[[room room-sid]])
      lanes  (my ~[[room-sid [room 1 owner-defaults]]])
      routes  (my ~[[room-sid ['binding-room' %ready]]])
      jobs
        %-  my
        :~  [0v1 [[~nus 'e1' room 'hi'] room-sid %bind '']]
            [0v2 [[~bud 'e2' room 'hi'] room-sid %bind '']]
        ==
    ==
  =/  granted  policy.saved
  =.  channel-grants.granted  (my ~[[room-nest (silt ~[~dev ~nus ~bud])]])
  ;<  [caz=(list card) s=state-5:t]  bind:m  (configure saved granted)
  =/  fences
    |=  caz=(list card)
    (skim (pokes caz %harness-action) |=(act=* ?=([%fence-actor *] act)))
  ;<  ~  bind:m  (ex-equal !>((fences caz)) !>(`(list *)`~))
  ;<  ~  bind:m  (ex-equal !>(~(key by jobs.s)) !>((silt ~[0v1 0v2])))
  ;<  ~  bind:m  (ex-equal !>(place-cuts.s) !>(place-cuts.saved))
  ::  The removal mirror.
  ;<  [caz=(list card) t=state-5:t]  bind:m  (configure s policy.saved)
  ;<  ~  bind:m  (ex-equal !>((fences caz)) !>(`(list *)`~))
  ;<  ~  bind:m  (ex-equal !>(~(key by jobs.t)) !>((silt ~[0v1 0v2])))
  (ex-equal !>(place-cuts.t) !>(place-cuts.saved))
::  Load .saved and read .speaker's authority in session .sid.
::
++  authority
  |=  [saved=state-5:t sid=@t speaker=@p]
  =/  m  (mare ,*)
  ^-  form:m
  ;<  ~  bind:m  (set-bowl %*(. *bowl our ~zod, src ~zod, now ~2026.9.10))
  ;<  ~  bind:m  head-connected
  ;<  ~  bind:m  (set-scry-gate (scries *stream:v10:a))
  ;<  *  bind:m  (do-load adapter `!>(saved))
  ;<  ~  bind:m  head-connected
  ;<  =cage  bind:m  (got-peek /x/authority/[sid]/(scot %p speaker))
  (pure:m q.q.cage)
::  The ceiling a ship's turn is given, Tlon tools included, is the same
::  for a ship with a per-place grant as for an allowed ship, in a channel
::  and in a DM, and holds no named tool.
::
++  test-a-place-grant-gives-the-same-ceiling-as-an-allowed-ship
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  fixture
  =/  bus-dm  `destination:t`[%dm ~bus ~]
  =/  bud-dm  `destination:t`[%dm ~bud ~]
  =.  saved
    %=  saved
      lanes
        %-  my
        :~  [room-sid [room 1 owner-defaults]]
            ['dm-bus' [bus-dm 1 ~[%web]]]
            ['dm-bud' [bud-dm 1 ~[%web]]]
        ==
      routes
        %-  my
        :~  [room-sid ['binding-room' %ready]]
            ['dm-bus' ['binding-bus' %ready]]
            ['dm-bud' ['binding-bud' %ready]]
        ==
    ==
  =/  allowed  `hand-authority:ad`[& `~[%web %tlon-read %tlon-write]]
  ;<  placed-room=*  bind:m  (authority saved room-sid ~dev)
  ;<  allowed-room=*  bind:m  (authority saved room-sid ~bud)
  ;<  placed-dm=*  bind:m  (authority saved 'dm-bus' ~bus)
  ;<  allowed-dm=*  bind:m  (authority saved 'dm-bud' ~bud)
  ;<  ~  bind:m  (ex-equal !>(placed-room) !>(allowed-room))
  ;<  ~  bind:m  (ex-equal !>(placed-dm) !>(allowed-dm))
  ;<  ~  bind:m  (ex-equal !>(allowed-room) !>(`*`allowed))
  (ex-equal !>(allowed-dm) !>(`*`allowed))
++  test-leaving-a-channel-removes-its-grants
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  fixture
  =.  channel-grants.policy.saved
    (~(put by channel-grants.policy.saved) other-nest (silt ~[~bus]))
  ;<  [* s=state-5:t]  bind:m  (leave saved room-nest)
  ;<  ~  bind:m
    %+  ex-equal
      !>(channel-grants.policy.s)
    !>((my ~[[other-nest (silt ~[~bus])]]))
  ;<  ~  bind:m  (ex-equal !>(dm-grants.policy.s) !>(dm-grants.policy.saved))
  ::  Joining again finds no grant there: ~dev is ignored in the room.
  ;<  [* again=state-5:t]  bind:m
    (admit s ~[[~2026.9.10..12.00.00 (mention ~dev room-nest ~2026.9.10..12.00.00)]])
  (ex-equal !>((admitted again)) !>(`(set [@p destination:t])`~))
++  test-leaving-a-channel-without-grants-changes-no-policy
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [* s=state-5:t]  bind:m  (leave fixture other-nest)
  (ex-equal !>(policy.s) !>(policy:fixture))
++  test-grants-are-removed-on-leave-even-when-the-head-is-not-running
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [* s=state-5:t]  bind:m  (leave-headless fixture room-nest)
  (ex-equal !>(channel-grants.policy.s) !>(`(map nest:dv (set @p))`~))
::  ~bud is allowed and has a DM turn queued. A save that takes it off the
::  allowed list retires its DM route, drops the work and moves its cutoff,
::  as it always has, whether the same save gives it a DM grant or not.
::
++  bud-dm  `destination:t`[%dm ~bud ~]
++  with-bud-dm
  |=  saved=state-5:t
  ^-  state-5:t
  %=  saved
    cuts  (my ~[[~bud ~2026.9.8]])
    identities  (my ~[[bud-dm 'dm-bud']])
    lanes  (my ~[['dm-bud' [bud-dm 1 ~[%web]]]])
    routes  (my ~[['dm-bud' ['binding-bud' %ready]]])
    jobs  (my ~[[0v1 [[~bud 'e1' bud-dm 'hi'] 'dm-bud' %bind '']]])
  ==
++  test-a-ship-wide-change-cancels-work-as-before-with-or-without-a-place-grant
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  (with-bud-dm fixture)
  =/  removed  policy.saved
  =.  allowed.removed  ~
  =/  moved  removed
  =.  dm-grants.moved  (~(put in dm-grants.moved) ~bud)
  =/  check
    |=  next=policy:t
    =/  m  (mare ,~)
    ^-  form:m
    ;<  [caz=(list card) s=state-5:t]  bind:m  (configure saved next)
    =/  acts  (pokes caz %harness-action)
    ;<  ~  bind:m  (ex-equal !>((lien acts |=(act=* =(act [%fence 'dm-bud'])))) !>(&))
    ;<  ~  bind:m  (ex-equal !>(~(key by lanes.s)) !>(`(set @t)`~))
    ;<  ~  bind:m  (ex-equal !>(~(key by jobs.s)) !>(`(set @uv)`~))
    (ex-equal !>((~(got by cuts.s) ~bud)) !>(~2026.9.10))
  ;<  ~  bind:m  (check removed)
  ;<  ~  bind:m  (check moved)
  ::  ~bud already held its DM grant, with an older cutoff there. The save
  ::  moves its ship-wide cutoff to now, and a DM is admitted only after the
  ::  later of the two.
  =/  granted  saved
  =.  dm-grants.policy.granted  (~(put in dm-grants.policy.granted) ~bud)
  =.  place-cuts.granted  (my ~[[[~bud ~] ~2026.9.8]])
  =/  next  policy.granted
  =.  allowed.next  ~
  ;<  [* s=state-5:t]  bind:m  (configure granted next)
  ;<  ~  bind:m  (ex-equal !>((~(got by place-cuts.s) [~bud ~])) !>(~2026.9.8))
  ;<  [* w=state-5:t]  bind:m
    %+  admit  s
    :~  [~2026.9.9..12.00.00 (dm ~bud ~2026.9.9..12.00.00)]
        [~2026.9.10..00.00.01 (dm ~bud ~2026.9.10..00.00.01)]
    ==
  =/  later  ~2026.9.10..00.00.01
  %+  ex-equal
    !>((turn ~(val by jobs.w) |=(=job:t event.input.job)))
  !>(`(list @t)`~[(scot %uv (sham [bud-dm [[~bud later] later]]))])
::  ~dev is allowed and holds the room. Taking it off the allowed list moves
::  its ship-wide cutoff past its room cutoff; a later unrelated save keeps
::  that cutoff, so a room mention from between the two stays unanswered.
::
++  test-a-ships-ship-wide-cutoff-survives-later-saves-while-it-holds-a-place-grant
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  fixture
  =.  allowed.policy.saved  (silt ~[~bud ~dev])
  =.  cuts.saved  (my ~[[~dev ~2026.9.7]])
  =.  place-cuts.saved  (my ~[[[~dev `room-nest] ~2026.9.8]])
  =/  first  policy.saved
  =.  allowed.first  (silt ~[~bud])
  ;<  [* s=state-5:t]  bind:m  (configure saved first)
  =/  second  first
  =.  allowed.second  (silt ~[~bud ~nus])
  ;<  [* w=state-5:t]  bind:m  (configure s second)
  ;<  ~  bind:m  (ex-equal !>((~(get by cuts.w) ~dev)) !>(`(unit @da)``~2026.9.10))
  ;<  [* u=state-5:t]  bind:m
    %+  admit  w
    :~  [~2026.9.9..12.00.00 (mention ~dev room-nest ~2026.9.9..12.00.00)]
        [~2026.9.10..00.00.01 (mention ~dev room-nest ~2026.9.10..00.00.01)]
    ==
  =/  later  ~2026.9.10..00.00.01
  %+  ex-equal
    !>((turn ~(val by jobs.u) |=(=job:t event.input.job)))
  !>(`(list @t)`~[(scot %uv (sham [room [[~dev later] later]]))])
::  ~nus is trusted and also holds its DM. Saving the same tools in another
::  order changes nothing there.
::
++  test-reordering-a-trusted-ships-tools-beside-a-place-grant-changes-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  nus-dm  `destination:t`[%dm ~nus ~]
  =/  saved  fixture
  =.  saved
    %=  saved
      trusted.policy  (my ~[[~nus ~[%web %skills]]])
      dm-grants.policy  (silt ~[~bus ~nus])
      cuts  (my ~[[~nus ~2026.9.7]])
      place-cuts  (my ~[[[~nus ~] ~2026.9.8]])
      identities  (my ~[[nus-dm 'dm-nus']])
      lanes  (my ~[['dm-nus' [nus-dm 1 ~[%web %skills]]]])
      routes  (my ~[['dm-nus' ['binding-nus' %ready]]])
      jobs  (my ~[[0v1 [[~nus 'e1' nus-dm 'hi'] 'dm-nus' %bind '']]])
    ==
  =/  next  policy.saved
  =.  trusted.next  (my ~[[~nus ~[%skills %web]]])
  ;<  [caz=(list card) s=state-5:t]  bind:m  (configure saved next)
  =/  acts  (pokes caz %harness-action)
  ;<  ~  bind:m  (ex-equal !>((lien acts |=(act=* ?=([?(%fence %fence-actor) *] act)))) !>(|))
  ;<  ~  bind:m  (ex-equal !>(~(key by lanes.s)) !>((silt ~['dm-nus'])))
  ;<  ~  bind:m  (ex-equal !>(~(key by jobs.s)) !>((silt ~[0v1])))
  ;<  ~  bind:m  (ex-equal !>(cuts.s) !>(cuts.saved))
  (ex-equal !>(place-cuts.s) !>(place-cuts.saved))
--
