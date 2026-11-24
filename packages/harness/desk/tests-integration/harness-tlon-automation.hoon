::  The hand plays Steward's local harness: it projects the owner's Tlon
::  schedules and applies Steward's edits through the head's cron API.
::  Steward and the head are answered by the fixture's scries and facts;
::  their pokes stay in the fixture.
/-  t=harness-tlon, c=harness-cron, hh=harness-hand, sa=steward-automation,
    steward-gateway, ad=harness-adapter
/+  *test-agent, schedule=harness-schedule
/=  adapter  /app/harness-tlon
|%
++  now  ~2026.11.23..12.00.00
::  The owner ~nec has a ready DM conversation with the bot.
::
++  saved
  |=  owner=(unit @p)
  ^-  state-5:t
  =/  saved=state-5:t  *state-5:t
  %=  saved  owner-initialized  1  policy  [& owner ~ %mentions ~ ~]  watching  &
    activity-through  now
    identities  (my ~[[[%dm ~nec ~] 'nec-dm']])
    routes  (my ~[['nec-dm' ['owner-dm' %ready]]])
    lanes  (my ~[['nec-dm' [[%dm ~nec ~] 0 ~]]])
  ==
::  Loads the hand online. .lease is whether Steward holds this hand's
::  gateway lease; a Steward without it is new to the hand.
::
++  boot
  |=  [owner=(unit @p) running=? lease=?]
  (boot-from (saved owner) running lease)
::
++  boot-from
  |=  [saved=state-5:t running=? lease=?]
  =/  m  (mare ,(list card))
  ^-  form:m
  ;<  ~  bind:m  (set-bowl %*(. *bowl our ~zod, src ~zod, now now))
  ;<  ~  bind:m
    %-  jab-bowl
    |=  b=bowl
    %=  b  wex
      %-  ~(gas by wex.b)
      :~  [[/head ~zod %harness] [& /hand-events]]
          [[/activity ~zod %activity] [& /v4]]
      ==
    ==
  ;<  ~  bind:m  (set-scry-gate (scries running lease))
  (do-load adapter `!>(saved))
::
++  scries
  |=  [running=? lease=?]
  (scries-left running lease `~)
::  .left is Steward's task map, ~ for one that must not be read.
::
++  scries-left
  |=  [running=? lease=? left=(unit (map @p tasks:v1:sa))]
  |=  =path
  ^-  (unit vase)
  ?:  ?=([%gu @ %steward @ %$ ~] path)  `!>(running)
  ?:  ?=([%gx @ %steward @ %v1 %automation %tasks %steward-automation-tasks-1 ~] path)
    ?~  left  ~
    `!>(u.left)
  ?:  ?=([%gx @ %steward @ %v1 %gateway %status %noun ~] path)
    =/  status  ?:(lease [%up `(add now ~m15)] [%down ~])
    `!>(`[status:v1:steward-gateway (unit @da)]`status)
  ?:  ?=([%gu @ %contacts @ %$ ~] path)  `!>(|)
  ?:  =(%$ (rear path))  `!>(&)
  ?:  ?=([%gx @ %chat @ %dm %invited %ships ~] path)  `!>(~)
  ?:  (lien path |=(part=@ta =(%hand-state part)))  `!>(*state:hh)
  ?:  (lien path |=(part=@ta =(%hand-index part)))  `!>(*index:hh)
  ?:  (lien path |=(part=@ta =(%activity part)))  `!>(~)
  ~
::
::  A schedule of .actor's in the owner DM, on .hand.
::
++  job
  |=  [id=@uv hand=@t actor=@t]
  ^-  schedule:c
  =/  source=binding:hh  [hand 'dm/~nec' 'nec-dm' ~[actor] &]
  =/  args=json
    %-  pairs:enjs:format
    :~  ['schedule' %s '0 9 * * *']  ['timezone' %s 'UTC']
        ['prompt' %s 'Morning brief']  ['runs' %s '5']
    ==
  (create:schedule [%add id 'owner-dm' actor %prompt args] source ~ now)
::
++  snapshot
  ^-  (map @uv schedule:c)
  %-  my
  :~  [0v1 (job 0v1 'tlon' '~nec')]
      [0v2 (job 0v2 'tlon' '~bus')]
      [0v3 (job 0v3 'web' '~nec')]
  ==
::
++  schedules
  |=  jobs=(map @uv schedule:c)
  %+  do-agent  /steward/schedules
  [[~zod %harness] [%fact %harness-schedules-1 !>(`schedules:c`jobs)]]
::
++  dispatch
  |=  [id=@uv =edit:v1:sa]
  %+  do-agent  /steward/dispatch
  :-  [~zod %steward]
  [%fact %steward-automation-dispatch-1 !>(`dispatch:v1:sa`[id edit])]
::  The head's answer to the edit's current request.
::
++  head-result
  |=  [id=@uv result=(each json @t)]
  (do-agent /steward/edit/(scot %uv id) [~zod %harness] [%fact %noun !>(result)])
::
++  projections
  |=  cards=(list card)
  ^-  (list (list identified-task:v1:sa))
  %+  murn  cards
  |=  =card
  ^-  (unit (list identified-task:v1:sa))
  ?.  ?=([%pass [%steward %project ~] %agent [@ %steward] %poke *] card)  ~
  =/  [* * * * * * data=vase]  card
  =/  action  !<(action:v1:sa data)
  ?>  ?=(%project -.action)
  `tasks.action
::
++  leases
  |=  cards=(list card)
  ^-  (list card)
  %+  skim  cards
  |=  =card
  ?=([%pass [%steward %lease ~] %agent [@ %steward] %poke *] card)
::
++  answers
  |=  cards=(list card)
  ^-  (list response:v1:sa)
  %+  murn  cards
  |=  =card
  ^-  (unit response:v1:sa)
  ?.  ?=([%pass [%steward %finalize ~] %agent [@ %steward] %poke *] card)  ~
  =/  [* * * * * * data=vase]  card
  =/  action  !<(action:v1:sa data)
  ?>  ?=(%finalize -.action)
  `[request-id.action body.action]
::
++  requests
  |=  cards=(list card)
  ^-  (list action:c)
  %+  murn  cards
  |=  =card
  ^-  (unit action:c)
  ?.  ?=([%pass [%steward %edit @ ~] %agent [@ %harness] %poke %harness-cron *] card)  ~
  =/  [* * * * * * data=vase]  card
  `act:!<(request:c data)
::
++  watches
  |=  cards=(list card)
  ^-  (list wire)
  %+  murn  cards
  |=  =card
  ^-  (unit wire)
  ?.  ?=([%pass [%steward ?(%schedules %dispatch) ~] %agent * %watch *] card)  ~
  =/  [* =wire *]  card
  `wire
::
++  create
  |=  [schedule=cron-schedule:v1:sa message=(unit @t) to=(unit @t)]
  ^-  edit:v1:sa
  =/  =task:v1:sa  *task:v1:sa
  =:  name.task  `'Brief'
      schedule.task  `schedule
      payload.task  `[`'agentTurn' message ~]
      delivery.task  ?~(to ~ `[`%announce `'tlon' to ~ ~])
    ==
  [%create task]
::
++  refuses
  |=  [=edit:v1:sa type=action-error:v1:sa]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  caz=(list card)  bind:m  (dispatch 0v9 edit)
  ;<  ~  bind:m  (ex-equal !>((requests caz)) !>(`(list action:c)`~))
  =/  answered  (answers caz)
  ?>  ?=([[@ %error *] ~] answered)
  (ex-equal !>(type.body.i.answered) !>(type))
::
::  Steward's task map holding a task another runtime wrote for the bot.
::
++  left-behind
  ^-  (map @p tasks:v1:sa)
  (my ~[[~zod (my ~[['openclaw-1' %*(. *task:v1:sa name `'Old brief')]])]])
::  A new schedule watch is the hand's usual first projection.
::
::  The owner's choice of a new owner, as Settings sends it.
::
++  set-owner
  |=  owner=@p
  =/  params=json
    %-  pairs:enjs:format
    :~  ['owner' %s (scot %p owner)]
        ['expectedOwner' %s '~nec']
        ['siblingMoonOwners' %b |]
        ['expectedSiblingMoonOwners' %b |]
    ==
  %+  do-poke  %noun
  !>(`request:ad`['fixture' [%n '1'] 'harness/tlon/owner/set' `params])
::
++  schedule-watch
  (do-agent /steward/schedules [~zod %harness] [%watch-ack ~])
::
++  held-status
  =/  m  (mare ,?)
  ^-  form:m
  ;<  =cage  bind:m  (got-peek /x/status)
  =/  status  !<(json q.cage)
  ?>  ?=(%o -.status)
  =/  held  (~(got by p.status) 'automationHeld')
  ?>  ?=(%b -.held)
  (pure:m p.held)
::
++  test-a-steward-with-no-entry-or-an-empty-one-is-projected-at-once
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  none=(list (list identified-task:v1:sa))  ~[~]
  ;<  *  bind:m  (boot `~nec & &)
  ;<  ~  bind:m  (set-scry-gate (scries-left & & `~))
  ;<  caz=(list card)  bind:m  schedule-watch
  ;<  ~  bind:m  (ex-equal !>((projections caz)) !>(none))
  ;<  *  bind:m  (boot `~nec & &)
  ;<  ~  bind:m  (set-scry-gate (scries-left & & `(my ~[[~zod ~]])))
  ;<  caz=(list card)  bind:m  schedule-watch
  ;<  ~  bind:m  (ex-equal !>((projections caz)) !>(none))
  ;<  held=?  bind:m  held-status
  (ex-equal !>(held) !>(|))
::  Another runtime's tasks stay in Steward for the operator's import, so
::  Messenger keeps showing them, while the hand has no task of its own.
::
++  test-tasks-another-runtime-left-in-steward-are-not-projected-over-while-the-hand-has-none
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  others  (~(del by snapshot) 0v1)
  ;<  *  bind:m  (boot `~nec & &)
  ;<  ~  bind:m  (set-scry-gate (scries-left & & `left-behind))
  ;<  caz=(list card)  bind:m  schedule-watch
  ;<  ~  bind:m  (ex-equal !>((lent (projections caz))) !>(0))
  ;<  caz=(list card)  bind:m  (schedules others)
  ;<  ~  bind:m  (ex-equal !>((lent (projections caz))) !>(0))
  ::  A Steward new to the hand, which takes the lease, is held too.
  ;<  ~  bind:m  (set-scry-gate (scries-left & | `left-behind))
  ;<  caz=(list card)  bind:m  (do-agent /head [~zod %harness] [%watch-ack ~])
  ;<  ~  bind:m  (ex-equal !>((lent (projections caz))) !>(0))
  ;<  held=?  bind:m  held-status
  ;<  ~  bind:m  (ex-equal !>(held) !>(&))
  ::  An edit of an old task finds no schedule of the hand's.
  (refuses [%delete 'openclaw-1'] %not-found)
::
++  test-the-first-task-of-its-own-ends-the-hold-and-replaces-the-list
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (boot `~nec & &)
  ;<  ~  bind:m  (set-scry-gate (scries-left & & `left-behind))
  ;<  *  bind:m  schedule-watch
  ;<  caz=(list card)  bind:m  (schedules snapshot)
  =/  projected  (projections caz)
  ?>  ?=([* ~] projected)
  ;<  ~  bind:m
    (ex-equal !>((turn i.projected |=(i=identified-task:v1:sa id.i))) !>(~['0v1']))
  ;<  held=?  bind:m  held-status
  (ex-equal !>(held) !>(|))
::  The fixture fails a step that reads Steward's tasks once the hand has
::  projected, so these projections are made without a read.
::
++  test-a-hand-that-has-projected-never-reads-stewards-tasks
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  none=(list (list identified-task:v1:sa))  ~[~]
  ;<  *  bind:m  (boot `~nec & &)
  ;<  *  bind:m  (schedules snapshot)
  ;<  ~  bind:m  (set-scry-gate (scries-left & & ~))
  ;<  caz=(list card)  bind:m  (schedules (~(del by snapshot) 0v1))
  ;<  ~  bind:m  (ex-equal !>((projections caz)) !>(none))
  ;<  caz=(list card)  bind:m  schedule-watch
  ;<  ~  bind:m  (ex-equal !>((projections caz)) !>(none))
  ::  A Steward without the lease is projected to again, as the head
  ::  connects and on a reload.
  ;<  ~  bind:m  (set-scry-gate (scries-left & | ~))
  ;<  caz=(list card)  bind:m  (do-agent /head [~zod %harness] [%watch-ack ~])
  ;<  ~  bind:m  (ex-equal !>((projections caz)) !>(none))
  ;<  =vase  bind:m  get-save
  ;<  caz=(list card)  bind:m  (do-load adapter `vase)
  (ex-equal !>((projections caz)) !>(none))
::
++  test-a-reload-while-held-stays-held-and-projects-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (boot `~nec & &)
  ;<  ~  bind:m  (set-scry-gate (scries-left & & `left-behind))
  ;<  *  bind:m  (do-agent /head [~zod %harness] [%watch-ack ~])
  ;<  *  bind:m  schedule-watch
  ;<  =vase  bind:m  get-save
  ::  Without the lease, loading would project if it were not held.
  ;<  ~  bind:m  (set-scry-gate (scries-left & | `left-behind))
  ;<  caz=(list card)  bind:m  (do-load adapter `vase)
  ;<  ~  bind:m  (ex-equal !>((lent (leases caz))) !>(1))
  ;<  ~  bind:m  (ex-equal !>((lent (projections caz))) !>(0))
  ;<  held=?  bind:m  held-status
  (ex-equal !>(held) !>(&))
::  The read is of this ship's entry whoever owns the bot, so a new owner's
::  hand still holds until it has a task of its own.
::
++  test-an-owner-change-while-held-still-holds-until-the-new-owner-has-a-task
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  web  (my ~[[0v3 (~(got by snapshot) 0v3)]])
  ;<  *  bind:m  (boot `~nec & &)
  ;<  ~  bind:m  (set-scry-gate (scries-left & & `left-behind))
  ;<  *  bind:m  (schedules web)
  ;<  caz=(list card)  bind:m  (set-owner ~bus)
  ;<  ~  bind:m  (ex-equal !>((lent (projections caz))) !>(0))
  ;<  caz=(list card)  bind:m  schedule-watch
  ;<  ~  bind:m  (ex-equal !>((lent (projections caz))) !>(0))
  ;<  caz=(list card)  bind:m  (schedules (~(put by web) 0v4 (job 0v4 'tlon' '~bus')))
  =/  projected  (projections caz)
  ?>  ?=([* ~] projected)
  (ex-equal !>((turn i.projected |=(i=identified-task:v1:sa id.i))) !>(~['0v4']))
::
++  test-the-projection-holds-exactly-the-owners-tlon-schedules
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  caz=(list card)  bind:m  (boot `~nec & &)
  ;<  ~  bind:m
    (ex-equal !>((watches caz)) !>(`(list wire)`~[/steward/schedules /steward/dispatch]))
  ;<  caz=(list card)  bind:m  (schedules snapshot)
  =/  projected  (projections caz)
  ?>  ?=([* ~] projected)
  ;<  ~  bind:m
    (ex-equal !>((turn i.projected |=(i=identified-task:v1:sa id.i))) !>(~['0v1']))
  =/  =task:v1:sa  task:(snag 0 i.projected)
  ;<  ~  bind:m  (ex-equal !>(name.task) !>(`'Morning brief'))
  ;<  ~  bind:m  (ex-equal !>(schedule.task) !>(`[%cron `'0 9 * * *' `'UTC' ~]))
  (ex-equal !>(delivery.task) !>(`[`%announce `'tlon' `'~nec' ~ ~]))
::  Steward creates the bot's entry on its first projection, so a new
::  watch projects even when the owner has no schedules.
::
++  test-a-new-schedule-watch-projects-even-an-empty-set
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (boot `~nec & &)
  ;<  caz=(list card)  bind:m  (do-agent /steward/schedules [~zod %harness] [%watch-ack ~])
  (ex-equal !>((projections caz)) !>(~[`(list identified-task:v1:sa)`~]))
::  A run advancing a job's bookkeeping changes the head's snapshot but not
::  the task, so Steward is not poked again.
::
++  test-a-changed-snapshot-reprojects-and-an-unchanged-task-set-sends-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (boot `~nec & &)
  ;<  *  bind:m  (schedules snapshot)
  =/  ran  (~(jab by snapshot) 0v1 |=(j=schedule:c j(remaining `4, next (add next.j ~d1))))
  ;<  caz=(list card)  bind:m  (schedules ran)
  ;<  ~  bind:m  (ex-equal !>((lent (projections caz))) !>(0))
  =/  cancelled  (~(jab by ran) 0v1 |=(j=schedule:c j(state %cancelled)))
  ;<  caz=(list card)  bind:m  (schedules cancelled)
  =/  projected  (projections caz)
  ?>  ?=([[* ~] ~] projected)
  (ex-equal !>(enabled.task.i.i.projected) !>(`|))
::
++  test-no-steward-or-no-owner-means-no-projection-and-no-feed-watch
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  caz=(list card)  bind:m  (boot `~nec | |)
  ;<  ~  bind:m  (ex-equal !>((watches caz)) !>(`(list wire)`~))
  ;<  ~  bind:m  (ex-equal !>((lent (projections caz))) !>(0))
  ;<  caz=(list card)  bind:m  (boot ~ & |)
  ;<  ~  bind:m  (ex-equal !>((watches caz)) !>(`(list wire)`~))
  (ex-equal !>((lent (projections caz))) !>(0))
::  A Steward that started after the hand holds no lease for it; the hand
::  takes one and fills Steward with the schedules it already has.
::
++  test-a-steward-without-the-lease-gets-the-projection
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (boot `~nec & &)
  ;<  *  bind:m  (schedules snapshot)
  ;<  ~  bind:m  (set-scry-gate (scries & |))
  ;<  caz=(list card)  bind:m  (do-agent /head [~zod %harness] [%watch-ack ~])
  =/  projected  (projections caz)
  ?>  ?=([* ~] projected)
  (ex-equal !>((lent i.projected)) !>(1))
::
++  test-a-create-with-a-zone-name-runs-at-its-offset-and-projects-the-name
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (boot `~nec & &)
  ;<  *  bind:m  (schedules snapshot)
  ;<  caz=(list card)  bind:m
    (dispatch 0v9 (create [%cron `'0 9 * * *' `'Asia/Kolkata' ~] `'Brief me' `'~nec'))
  =/  sent  (requests caz)
  ?>  ?=([[%add *] ~] sent)
  =/  args  args.i.sent
  ?>  ?=(%o -.args)
  ;<  ~  bind:m  (ex-equal !>(binding.i.sent) !>('owner-dm'))
  ;<  ~  bind:m  (ex-equal !>(actor.i.sent) !>('~nec'))
  ;<  ~  bind:m  (ex-equal !>((~(get by p.args) 'timezone')) !>(`[%s '+05:30']))
  ;<  ~  bind:m  (ex-equal !>((answers caz)) !>(`(list response:v1:sa)`~))
  ;<  caz=(list card)  bind:m  (head-result 0v9 [%& ~])
  ;<  ~  bind:m  (ex-equal !>((answers caz)) !>(`(list response:v1:sa)`~[[0v9 %created '0v9']]))
  =/  created  (create:schedule i.sent ['tlon' 'dm/~nec' 'nec-dm' ~['~nec'] &] ~ now)
  ;<  caz=(list card)  bind:m  (schedules (~(put by snapshot) 0v9 created))
  =/  projected  (projections caz)
  ?>  ?=([* ~] projected)
  =/  =task:v1:sa  task:(snag 1 i.projected)
  ;<  ~  bind:m  (ex-equal !>(name.task) !>(`'Brief'))
  (ex-equal !>(schedule.task) !>(`[%cron `'0 9 * * *' `'Asia/Kolkata' ~]))
::
::  A channel's conversation is shared, whoever opened it. The owner's task
::  there runs in it as the owner.
::
++  test-a-channel-create-runs-in-the-channels-shared-conversation-as-the-owner
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  room=destination:t  [%channel [%chat ~bus %general] ~]
  =/  s  (saved `~nec)
  =.  s
    %=  s
      identities  (~(put by identities.s) room 'room')
      routes  (~(put by routes.s) 'room' ['room-binding' %ready])
      lanes  (~(put by lanes.s) 'room' [room 0 ~])
    ==
  ;<  *  bind:m  (boot-from s & &)
  ;<  *  bind:m  (schedules snapshot)
  ;<  caz=(list card)  bind:m
    (dispatch 0v9 (create [%cron `'0 9 * * *' ~ ~] `'Brief the room' `'chat/~bus/general'))
  =/  sent  (requests caz)
  ?>  ?=([[%add *] ~] sent)
  ;<  ~  bind:m  (ex-equal !>(binding.i.sent) !>('room-binding'))
  (ex-equal !>(actor.i.sent) !>('~nec'))
::
++  test-an-unsupported-create-finalizes-invalid-and-creates-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (boot `~nec & &)
  ;<  *  bind:m  (schedules snapshot)
  ;<  ~  bind:m  (refuses (create [%cron `'0 9 * * *' `'Mars/Olympus' ~] `'Brief' ~) %invalid)
  ;<  ~  bind:m  (refuses (create [%every `~m45 ~] `'Brief' ~) %invalid)
  ;<  ~  bind:m  (refuses [%update '0v1' %*(. *task:v1:sa agent-id `'ops')] %invalid)
  ;<  ~  bind:m  (refuses (create [%cron `'0 9 * * *' ~ ~] `'Brief' `'chat/~bus/general') %invalid)
  (refuses (create [%cron `'0 9 * * *' ~ ~] ~ ~) %invalid)
::
::  Each task field the hand cannot honor finalizes invalid and reaches
::  no head request.
::
++  test-each-unsupported-field-finalizes-invalid
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  fields=(list task:v1:sa)
    :~  %*(. *task:v1:sa agent-id `'ops')
        %*(. *task:v1:sa session-target `'main')
        %*(. *task:v1:sa wake-mode `'next-heartbeat')
        %*(. *task:v1:sa schedule `[%cron `'0 9 * * *' ~ `~s30])
        %*(. *task:v1:sa payload `[`'agentTurn' `'Brief' `~['web']])
        %*(. *task:v1:sa delivery `[`%webhook ~ `'https://x.example' ~ ~])
        =/  away  [`%announce `'tlon' `'~nec' ~]
        %*(. *task:v1:sa delivery `[`%announce `'tlon' `'~nec' ~ `away])
        %*(. *task:v1:sa delivery `[`%announce `'tlon' `'~nec' `'default' ~])
    ==
  ;<  *  bind:m  (boot `~nec & &)
  ;<  *  bind:m  (schedules snapshot)
  |-
  ?~  fields  (pure:m ~)
  ;<  ~  bind:m  (refuses [%update '0v1' i.fields] %invalid)
  $(fields t.fields)
::
++  test-an-edit-of-an-unknown-task-finalizes-not-found
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (boot `~nec & &)
  ;<  *  bind:m  (schedules snapshot)
  ;<  ~  bind:m  (refuses [%update '0v77' *task:v1:sa] %not-found)
  ;<  ~  bind:m  (refuses [%delete '0v77'] %not-found)
  (refuses [%delete '0v2'] %not-found)
::  Steward replays unanswered commands to a new subscriber. One already
::  applying is not sent again, and a replay after the answer repeats the
::  same create, which the head answers with the job it already made.
::
++  test-a-replayed-dispatch-does-not-create-a-second-job
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  edit  (create [%cron `'0 9 * * *' ~ ~] `'Brief me' ~)
  =/  args=json
    %-  pairs:enjs:format
    :~  ['schedule' %s '0 9 * * *']  ['timezone' %s 'UTC']
        ['prompt' %s 'Brief me']
    ==
  =/  add=(list action:c)  ~[[%add 0v9 'owner-dm' '~nec' %prompt args]]
  ;<  *  bind:m  (boot `~nec & &)
  ;<  *  bind:m  (schedules snapshot)
  ;<  caz=(list card)  bind:m  (dispatch 0v9 edit)
  ;<  ~  bind:m  (ex-equal !>((requests caz)) !>(add))
  ;<  caz=(list card)  bind:m  (dispatch 0v9 edit)
  ;<  ~  bind:m  (ex-equal !>((requests caz)) !>(`(list action:c)`~))
  ;<  *  bind:m  (head-result 0v9 [%& ~])
  ;<  caz=(list card)  bind:m  (dispatch 0v9 edit)
  (ex-equal !>((requests caz)) !>(add))
::
++  test-pausing-cancels-the-job
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (boot `~nec & &)
  ;<  *  bind:m  (schedules snapshot)
  ;<  caz=(list card)  bind:m  (dispatch 0v9 [%update '0v1' %*(. *task:v1:sa enabled `|)])
  ;<  ~  bind:m  (ex-equal !>((requests caz)) !>(`(list action:c)`~[[%cancel 0v1]]))
  ;<  caz=(list card)  bind:m  (head-result 0v9 [%& ~])
  (ex-equal !>((answers caz)) !>(`(list response:v1:sa)`~[[0v9 %updated '0v1']]))
::
++  test-a-head-refusal-finalizes-harness-error
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (boot `~nec & &)
  ;<  *  bind:m  (schedules snapshot)
  ;<  *  bind:m  (dispatch 0v9 [%delete '0v1'])
  ;<  caz=(list card)  bind:m  (head-result 0v9 [%| 'Work or delivery is still pending'])
  %+  ex-equal  !>((answers caz))
  !>(`(list response:v1:sa)`~[[0v9 %error %harness-error ~[leaf+"Work or delivery is still pending"]]])
::
++  test-delete-removes-the-task-from-the-next-projection
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (boot `~nec & &)
  ;<  *  bind:m  (schedules snapshot)
  ;<  caz=(list card)  bind:m  (dispatch 0v9 [%delete '0v1'])
  ;<  ~  bind:m  (ex-equal !>((requests caz)) !>(`(list action:c)`~[[%delete 0v1]]))
  ;<  caz=(list card)  bind:m  (head-result 0v9 [%& ~])
  ;<  ~  bind:m  (ex-equal !>((answers caz)) !>(`(list response:v1:sa)`~[[0v9 %deleted '0v1']]))
  ;<  caz=(list card)  bind:m  (schedules (~(del by snapshot) 0v1))
  (ex-equal !>((projections caz)) !>(~[`(list identified-task:v1:sa)`~]))
::  Gall hands an ack back before a poke queued behind it, so an ack that
::  sent again would poke Steward without end.
::
++  test-a-steward-ack-sends-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  refused=sign:agent:gall  [%poke-ack `~[leaf+"refused"]]
  ;<  *  bind:m  (boot `~nec & |)
  ;<  *  bind:m  (schedules snapshot)
  ;<  caz=(list card)  bind:m  (do-agent /steward/project [~zod %steward] [%poke-ack ~])
  ;<  ~  bind:m  (ex-equal !>(caz) !>(`(list card)`~))
  ;<  caz=(list card)  bind:m  (do-agent /steward/project [~zod %steward] refused)
  ;<  ~  bind:m  (ex-equal !>(caz) !>(`(list card)`~))
  ;<  caz=(list card)  bind:m  (do-agent /steward/finalize [~zod %steward] [%poke-ack ~])
  ;<  ~  bind:m  (ex-equal !>(caz) !>(`(list card)`~))
  ;<  caz=(list card)  bind:m  (do-agent /steward/finalize [~zod %steward] refused)
  ;<  ~  bind:m  (ex-equal !>(caz) !>(`(list card)`~))
  ;<  caz=(list card)  bind:m  (do-agent /steward/lease [~zod %steward] refused)
  ;<  ~  bind:m  (ex-equal !>(caz) !>(`(list card)`~))
  ;<  caz=(list card)  bind:m  (do-agent /claims [~zod %contacts] refused)
  (ex-equal !>(caz) !>(`(list card)`~))
::  A kicked head watch lost the edit's result. The edit answers an error
::  and ends, so Steward's replay of it is applied rather than ignored.
::
++  test-a-kicked-head-result-fails-the-edit-and-the-replay-applies
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  edit  (create [%cron `'0 9 * * *' ~ ~] `'Brief me' ~)
  ;<  *  bind:m  (boot `~nec & &)
  ;<  *  bind:m  (schedules snapshot)
  ;<  first=(list card)  bind:m  (dispatch 0v9 edit)
  ;<  caz=(list card)  bind:m
    (do-agent /steward/edit/(scot %uv 0v9) [~zod %harness] [%kick ~])
  =/  lost=tang
    ~[leaf+"the head dropped the result; the change may have applied, so check the task"]
  ;<  ~  bind:m
    (ex-equal !>((answers caz)) !>(`(list response:v1:sa)`~[[0v9 %error %harness-error lost]]))
  ;<  caz=(list card)  bind:m  (dispatch 0v9 edit)
  ;<  ~  bind:m  (ex-equal !>(=(~ (requests caz))) !>(|))
  (ex-equal !>((requests caz)) !>((requests first)))
::  A head fact under another mark is not a result.
::
++  test-a-head-fact-of-another-mark-is-ignored
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (boot `~nec & &)
  ;<  *  bind:m  (schedules snapshot)
  ;<  *  bind:m  (dispatch 0v9 [%delete '0v1'])
  ;<  caz=(list card)  bind:m
    (do-agent /steward/edit/(scot %uv 0v9) [~zod %harness] [%fact %json !>(~)])
  ;<  ~  bind:m  (ex-equal !>((answers caz)) !>(`(list response:v1:sa)`~))
  ;<  caz=(list card)  bind:m  (head-result 0v9 [%& ~])
  (ex-equal !>((answers caz)) !>(`(list response:v1:sa)`~[[0v9 %deleted '0v1']]))
::  Messenger's Scheduled Tasks screen, as the client builds its edits:
::  buildTaskCreate, buildTaskUpdate and deliveryFor in
::  packages/app/ui/components/automationTaskDraft.ts, sent unchanged by
::  packages/api/src/client/stewardAutomationApi.ts. A change to what those
::  send belongs here too.
::
++  client-create
  |=  [expr=@t tz=(unit @t) to=(unit @t)]
  ^-  task:v1:sa
  :*  agent-id=~
      name=`'Night summary'
      description=~
      enabled=`&
      schedule=`[%cron `expr tz ~]
      session-target=`'isolated'
      wake-mode=`'now'
      payload=`[`'agentTurn' `'Summarize the night' ~]
      delivery=?~(to ~ `[`%announce `'tlon' to ~ ~])
      created-at=~
      updated-at=~
  ==
::  A create reaches the head as one job in .binding at .timezone, and
::  answers created once the head has it.
::
++  creates
  |=  [id=@uv =task:v1:sa binding=@t timezone=@t]
  =/  m  (mare ,~)
  ^-  form:m
  ?>  ?=([~ %cron [~ @] *] schedule.task)
  =/  args=json
    %-  pairs:enjs:format
    :~  ['schedule' %s u.expr.u.schedule.task]  ['timezone' %s timezone]
        ['prompt' %s 'Summarize the night']
    ==
  ;<  caz=(list card)  bind:m  (dispatch id [%create task])
  ;<  ~  bind:m
    %+  ex-equal  !>((requests caz))
    !>(`(list action:c)`~[[%add id binding '~nec' %prompt args]])
  ;<  caz=(list card)  bind:m  (head-result id [%& ~])
  %+  ex-equal  !>((answers caz))
  !>(`(list response:v1:sa)`~[[id %created (scot %uv id)]])
::
++  test-each-create-messenger-builds-is-created
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  room=destination:t  [%channel [%chat ~bus %general] ~]
  =/  s  (saved `~nec)
  =.  s
    %=  s
      identities  (~(put by identities.s) room 'room')
      routes  (~(put by routes.s) 'room' ['room-binding' %ready])
      lanes  (~(put by lanes.s) 'room' [room 0 ~])
    ==
  ;<  *  bind:m  (boot-from s & &)
  ;<  *  bind:m  (schedules snapshot)
  ;<  ~  bind:m
    (creates 0v9 (client-create '30 7 * * 1,3' ~ `'~nec') 'owner-dm' 'UTC')
  ;<  ~  bind:m
    %:  creates
      0va
      (client-create '30 7 * * *' `'America/Chicago' `'~nec')
      'owner-dm'
      '-06:00'
    ==
  ;<  ~  bind:m
    %:  creates
      0vb
      (client-create '0 18 * * 5' `'Asia/Kolkata' `'chat/~bus/general')
      'room-binding'
      '+05:30'
    ==
  (creates 0vc (client-create '0 8 * * *' ~ ~) 'owner-dm' 'UTC')
::  Each patch buildTaskUpdate makes of a task the hand projected. The
::  schedule patch copies the projected tz and staggerMs back, and the hand
::  projects no stagger, so it goes back without one.
::
++  test-each-patch-messenger-builds-gets-its-answer
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  job  (~(got by snapshot) 0v1)
  ;<  *  bind:m  (boot `~nec & &)
  ;<  caz=(list card)  bind:m  (schedules snapshot)
  =/  projected  (projections caz)
  ?>  ?=([* ~] projected)
  =/  current=task:v1:sa  task:(snag 0 i.projected)
  ?>  ?=([~ %cron *] schedule.current)
  ?>  ?=(^ payload.current)
  ;<  ~  bind:m  (ex-equal !>(stagger.u.schedule.current) !>(`(unit @dr)`~))
  ::  name only
  ;<  caz=(list card)  bind:m
    (dispatch 0v9 [%update '0v1' %*(. *task:v1:sa name `'Renamed')])
  ;<  ~  bind:m  (ex-equal !>((requests caz)) !>(`(list action:c)`~))
  ;<  ~  bind:m
    (ex-equal !>((answers caz)) !>(`(list response:v1:sa)`~[[0v9 %updated '0v1']]))
  ::  payload, with the task's own kind
  =/  prompt  %*(. *task:v1:sa payload `[kind.u.payload.current `'New prompt' ~])
  ;<  caz=(list card)  bind:m  (dispatch 0va [%update '0v1' prompt])
  =/  args=json
    %-  pairs:enjs:format
    :~  ['schedule' %s '0 9 * * *']  ['timezone' %s 'UTC']
        ['prompt' %s 'New prompt']  ['runs' %s '5']
    ==
  ;<  ~  bind:m
    (ex-equal !>((requests caz)) !>(`(list action:c)`~[[%edit 0v1 (sham job) args]]))
  ;<  caz=(list card)  bind:m  (head-result 0va [%& ~])
  ;<  ~  bind:m
    (ex-equal !>((answers caz)) !>(`(list response:v1:sa)`~[[0va %updated '0v1']]))
  ::  schedule, with the projected tz and stagger copied back
  =/  retimed
    %*  .  *task:v1:sa
      schedule  `[%cron `'30 7 * * 1,3' tz.u.schedule.current stagger.u.schedule.current]
    ==
  ;<  caz=(list card)  bind:m  (dispatch 0vb [%update '0v1' retimed])
  =/  args=json
    %-  pairs:enjs:format
    :~  ['schedule' %s '30 7 * * 1,3']  ['timezone' %s 'UTC']
        ['prompt' %s 'Morning brief']  ['runs' %s '5']
    ==
  ;<  ~  bind:m
    (ex-equal !>((requests caz)) !>(`(list action:c)`~[[%edit 0v1 (sham job) args]]))
  ;<  caz=(list card)  bind:m  (head-result 0vb [%& ~])
  ;<  ~  bind:m
    (ex-equal !>((answers caz)) !>(`(list response:v1:sa)`~[[0vb %updated '0v1']]))
  ::  delivery to another conversation
  =/  moved
    %*(. *task:v1:sa delivery `[`%announce `'tlon' `'chat/~bus/general' ~ ~])
  ;<  ~  bind:m  (refuses [%update '0v1' moved] %invalid)
  ::  the pause switch
  ;<  caz=(list card)  bind:m
    (dispatch 0vc [%update '0v1' %*(. *task:v1:sa enabled `|)])
  (ex-equal !>((requests caz)) !>(`(list action:c)`~[[%cancel 0v1]]))
--
