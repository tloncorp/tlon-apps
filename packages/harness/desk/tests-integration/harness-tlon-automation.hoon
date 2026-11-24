::  The hand plays Steward's local harness: it projects the owner's Tlon
::  schedules and applies Steward's edits through the head's cron API.
::  Steward and the head are answered by the fixture's scries and facts;
::  their pokes stay in the fixture.
/-  t=harness-tlon, c=harness-cron, hh=harness-hand, sa=steward-automation,
    steward-gateway
/+  *test-agent, schedule=harness-schedule
/=  adapter  /app/harness-tlon
|%
++  now  ~2026.11.23..12.00.00
::  The owner ~nec has a ready DM conversation with the bot.
::
++  saved
  |=  owner=(unit @p)
  ^-  state-4:t
  =/  saved=state-4:t  *state-4:t
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
  (do-load adapter `!>((saved owner)))
::
++  scries
  |=  [running=? lease=?]
  |=  =path
  ^-  (unit vase)
  ?:  ?=([%gu @ %steward @ %$ ~] path)  `!>(running)
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
  (do-agent /steward/schedules [~zod %harness] [%fact %noun !>(jobs)])
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
  =/  ran  (~(jab by snapshot) 0v1 |=(j=schedule:c j(remaining 4, next (add next.j ~d1))))
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
++  test-an-unsupported-create-finalizes-invalid-and-creates-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (boot `~nec & &)
  ;<  *  bind:m  (schedules snapshot)
  ;<  ~  bind:m  (refuses (create [%cron `'0 9 * * *' `'Mars/Olympus' ~] `'Brief' ~) %invalid)
  ;<  ~  bind:m  (refuses (create [%every `~h1 ~] `'Brief' ~) %invalid)
  ;<  ~  bind:m  (refuses (create [%cron `'0 9 * * *' ~ ~] `'Brief' `'chat/~bus/general') %invalid)
  (refuses (create [%cron `'0 9 * * *' ~ ~] ~ ~) %invalid)
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
  ;<  *  bind:m  (boot `~nec & &)
  ;<  *  bind:m  (schedules snapshot)
  ;<  first=(list card)  bind:m  (dispatch 0v9 edit)
  ;<  caz=(list card)  bind:m  (dispatch 0v9 edit)
  ;<  ~  bind:m  (ex-equal !>((requests caz)) !>(`(list action:c)`~))
  ;<  *  bind:m  (head-result 0v9 [%& ~])
  ;<  caz=(list card)  bind:m  (dispatch 0v9 edit)
  (ex-equal !>((requests caz)) !>((requests first)))
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
  (ex-equal !>(caz) !>(`(list card)`~))
--
