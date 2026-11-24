/-  t=harness-tlon, c=harness-cron, hh=harness-hand, sa=steward-automation
/+  *test, automation=harness-tlon-automation, schedule=harness-schedule
|%
++  now  ~2026.11.23..12.00.00
::  A recurring job of the owner's in the owner DM, on the Tlon hand.
::
++  job
  |=  [id=@uv hand=@t actor=@t address=@t]
  ^-  schedule:c
  =/  source=binding:hh  [hand address 'source' ~[actor] &]
  =/  args=json
    %-  pairs:enjs:format
    :~  ['schedule' %s '0 9 * * 1-5']  ['timezone' %s '-06:00']
        ['prompt' %s '  Morning brief\0aRead the overnight channels.']  ['runs' %s '7']
    ==
  (create:schedule [%add id 'owner-dm' actor %prompt args] source ~[%web] now)
::
++  once
  ^-  schedule:c
  =/  source=binding:hh  ['tlon' 'chat/~bus/general' 'source' ~['~nec'] &]
  =/  args=json
    (pairs:enjs:format ~[['at' %s '2026-11-24T09:00:00Z'] ['text' %s 'Stand up']])
  (create:schedule [%add 0v4 'general' '~nec' %reminder args] source ~ now)
::
++  schedules
  ^-  (map @uv schedule:c)
  %-  my
  :~  [0v1 (job 0v1 'tlon' '~nec' 'dm/~nec')]
      [0v2 (job 0v2 'tlon' '~bus' 'dm/~bus')]
      [0v3 (job 0v3 'web' '~nec' 'room/launch')]
      [0v4 once]
  ==
::  The owner has a ready conversation in his DM only.
::
++  binding
  |=  to=destination:t
  ^-  (unit @t)
  ?:(=(to [%dm ~nec ~]) `'owner-dm' ~)
::
++  plan
  |=  [=edit:v1:sa names=(map @uv task-names:t)]
  (plan:automation edit 0v9 now ~nec schedules names binding)
::
++  refused
  |=  [=edit:v1:sa type=action-error:v1:sa]
  ^-  tang
  =/  planned  (plan edit ~)
  %+  weld
    (expect !>(?=(%| -.planned)))
  ?.  ?=(%| -.planned)  ~
  (expect-eq !>(type) !>(type.p.planned))
::
::  An edit the hand refuses as invalid, with a message naming .field.
::
++  refused-naming
  |=  [=edit:v1:sa field=@t]
  ^-  tang
  =/  planned  (plan edit ~)
  ?.  ?=(%| -.planned)  ~[leaf+"expected {(trip field)} to be refused"]
  %+  weld
    (expect-eq !>(`action-error:v1:sa`%invalid) !>(type.p.planned))
  (expect !>(?=(^ (find (trip field) (trip message.p.planned)))))
::  A field the hand cannot honor refuses a create and an update alike.
::
++  refuses-field
  |=  [field=@t change=$-(task:v1:sa task:v1:sa)]
  ^-  tang
  =/  base  (create [%cron `'0 9 * * *' ~ ~] `'Brief' ~)
  ?>  ?=(%create -.base)
  %+  weld
    (refused-naming [%create (change task.base)] field)
  (refused-naming [%update '0v1' (change *task:v1:sa)] field)
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
++  test-the-projection-holds-exactly-the-owners-tlon-schedules
  =/  tasks  (project:automation schedules ~ ~nec)
  =/  recurring  (job 0v1 'tlon' '~nec' 'dm/~nec')
  ;:  weld
      (expect-eq !>(~['0v1' '0v4']) !>((turn tasks |=(i=identified-task:v1:sa id.i))))
      %+  expect-eq
        !>  ^-  task:v1:sa
            :*  ~  `'Morning brief'  ~  `&
                `[%cron `'0 9 * * 1-5' `'-06:00' ~]
                ~  ~  `[`'agentTurn' `'  Morning brief\0aRead the overnight channels.' ~]
                `[`%announce `'tlon' `'~nec' ~ ~]  ~  ~
            ==
      !>(task:(snag 0 tasks))
      %+  expect-eq
        !>  ^-  task:v1:sa
            :*  ~  `'Stand up'  ~  `&  `[%at `~2026.11.24..09.00.00]
                ~  ~  `[`'systemEvent' `'Stand up' ~]
                `[`%announce `'tlon' `'chat/~bus/general' ~ ~]  ~  ~
            ==
      !>(task:(snag 1 tasks))
  ==
::  A cancelled or finished job stays listed, disabled, so it can be deleted.
::
++  test-a-settled-job-projects-disabled-with-its-steward-names
  =/  names  (my ~[[0v1 [`'America/Chicago' ~ `'Brief' `'Weekdays']]])
  =/  cancelled  (~(jab by schedules) 0v1 |=(j=schedule:c j(state %cancelled)))
  =/  =task:v1:sa  task:(snag 0 (project:automation cancelled names ~nec))
  ;:  weld
      (expect-eq !>(`|) !>(enabled.task))
      (expect-eq !>(`'Brief') !>(name.task))
      (expect-eq !>(`'Weekdays') !>(description.task))
      (expect-eq !>(`'America/Chicago') !>(?>(?=([~ %cron *] schedule.task) tz.u.schedule.task)))
  ==
::
++  test-a-create-with-a-zone-name-runs-at-that-zones-offset
  =/  planned  (plan (create [%cron `'0 9 * * *' `'Asia/Kolkata' ~] `'Brief me' `'~nec') ~)
  ?>  ?=(%& -.planned)
  =/  args=json
    %-  pairs:enjs:format
    :~  ['schedule' %s '0 9 * * *']  ['timezone' %s '+05:30']
        ['prompt' %s 'Brief me']  ['runs' %s '100']
    ==
  ;:  weld
      (expect-eq !>(~[[%add 0v9 'owner-dm' '~nec' %prompt args]]) !>(steps.p.planned))
      (expect-eq !>([%created '0v9']) !>(answer.p.planned))
      (expect-eq !>(`[0v9 `'Asia/Kolkata' ~ `'Brief' ~]) !>(names.p.planned))
  ==
::
++  test-a-create-without-delivery-or-zone-goes-to-the-owner-dm-at-utc
  =/  planned  (plan (create [%at `~2026.11.25..08.30.00] `'Ping' ~) ~)
  ?>  ?=(%& -.planned)
  =/  args=json
    (pairs:enjs:format ~[['at' %s '2026-11-25T08:30:00Z'] ['prompt' %s 'Ping']])
  (expect-eq !>(~[[%add 0v9 'owner-dm' '~nec' %prompt args]]) !>(steps.p.planned))
::
++  test-an-unsupported-create-is-invalid-and-creates-nothing
  ;:  weld
      (refused (create [%cron `'0 9 * * *' `'Mars/Olympus' ~] `'Brief' ~) %invalid)
      (refused (create [%cron `'0 9 * * *' ~ ~] ~ ~) %invalid)
      (refused (create [%cron `'0 9 * * *' ~ ~] `'Brief' `'chat/~bus/general') %invalid)
      (refused (create [%cron `'0 9 * * *' ~ ~] `'Brief' `'~bus') %invalid)
      (refused (create [%cron `'0 9 * * *' ~ ~] `'Brief' `'not a target') %invalid)
  ==
::
++  test-an-unknown-or-foreign-task-is-not-found
  ;:  weld
      (refused [%update '0v77' *task:v1:sa] %not-found)
      (refused [%delete '0v77'] %not-found)
      (refused [%delete 'job-1'] %not-found)
      (refused [%delete '0v2'] %not-found)
      (refused [%update '0v3' *task:v1:sa] %not-found)
  ==
::
++  test-pausing-cancels-and-a-paused-task-cannot-resume
  =/  pause  (plan [%update '0v1' %*(. *task:v1:sa enabled `|)] ~)
  =/  cancelled  (~(jab by schedules) 0v1 |=(j=schedule:c j(state %cancelled)))
  =/  resume  (plan:automation [%update '0v1' %*(. *task:v1:sa enabled `&)] 0v9 now ~nec cancelled ~ binding)
  ?>  ?=(%& -.pause)
  ;:  weld
      (expect-eq !>(~[[%cancel 0v1]]) !>(steps.p.pause))
      (expect-eq !>([%updated '0v1']) !>(answer.p.pause))
      (expect !>(?=(%| -.resume)))
  ==
::
++  test-editing-a-finished-task-does-not-turn-it-back-on
  =/  finished  (~(jab by schedules) 0v1 |=(j=schedule:c j(state %complete)))
  =/  edit  [%update '0v1' %*(. *task:v1:sa payload `[`'agentTurn' `'New brief' ~])]
  =/  planned  (plan:automation edit 0v9 now ~nec finished ~ binding)
  ?>  ?=(%& -.planned)
  ?>  ?=([[%edit *] [%cancel *] ~] steps.p.planned)
  (expect-eq !>([%cancel 0v1]) !>(i.t.steps.p.planned))
::
++  test-a-new-message-edits-the-job-at-its-stored-schedule
  =/  old  (~(got by schedules) 0v1)
  =/  planned  (plan [%update '0v1' %*(. *task:v1:sa payload `[`'agentTurn' `'New brief' ~])] ~)
  ?>  ?=(%& -.planned)
  =/  args=json
    %-  pairs:enjs:format
    :~  ['schedule' %s '0 9 * * 1-5']  ['timezone' %s '-06:00']
        ['prompt' %s 'New brief']  ['runs' %s '7']
    ==
  (expect-eq !>(~[[%edit 0v1 (sham old) args]]) !>(steps.p.planned))
::
++  test-a-rename-needs-no-head-action
  =/  planned  (plan [%update '0v1' %*(. *task:v1:sa name `'Renamed')] ~)
  ?>  ?=(%& -.planned)
  ;:  weld
      (expect-eq !>(`(list action:c)`~) !>(steps.p.planned))
      (expect-eq !>(`[0v1 ~ ~ `'Renamed' ~]) !>(names.p.planned))
  ==
::
++  test-a-task-cannot-move-to-another-conversation
  =/  move  %*(. *task:v1:sa delivery `[`%announce `'tlon' `'chat/~bus/general' ~ ~])
  =/  stay  %*(. *task:v1:sa delivery `[`%announce `'tlon' `'~nec' ~ ~])
  =/  kept  (plan [%update '0v1' stay] ~)
  ;:  weld
      (refused [%update '0v1' move] %invalid)
      (expect !>(?=(%& -.kept)))
  ==
::
++  test-delete-removes-and-test-runs-are-refused
  =/  planned  (plan [%delete '0v1'] ~)
  ?>  ?=(%& -.planned)
  ;:  weld
      (expect-eq !>(~[[%delete 0v1]]) !>(steps.p.planned))
      (expect-eq !>([%deleted '0v1']) !>(answer.p.planned))
      (refused [%test '0v1'] %invalid)
  ==
::
++  test-a-title-is-the-first-line-bounded
  ;:  weld
      (expect-eq !>(`'Line one') !>((title:automation '\0a  Line one  \0aLine two')))
      (expect-eq !>(64) !>((lent (tuba (trip (need (title:automation (rap 3 (reap 80 'é')))))))))
      (expect-eq !>(`(unit @t)`~) !>((title:automation '   ')))
  ==
::  Each field the hand cannot honor is refused, never dropped.
::
++  test-an-agent-id-is-refused
  (refuses-field 'agentId' |=(t=task:v1:sa t(agent-id `'main')))
++  test-a-session-target-is-refused
  (refuses-field 'sessionTarget' |=(t=task:v1:sa t(session-target `'isolated')))
++  test-a-wake-mode-is-refused
  (refuses-field 'wakeMode' |=(t=task:v1:sa t(wake-mode `'now')))
++  test-a-stagger-is-refused
  (refuses-field 'staggerMs' |=(t=task:v1:sa t(schedule `[%cron `'0 9 * * *' ~ `~s30])))
++  test-a-tool-allow-list-is-refused
  (refuses-field 'toolsAllow' |=(t=task:v1:sa t(payload `[`'agentTurn' `'Brief' `~['web']])))
++  test-webhook-delivery-is-refused
  (refuses-field 'webhook' |=(t=task:v1:sa t(delivery `[`%webhook ~ `'https://x.example' ~ ~])))
++  test-a-failure-destination-is-refused
  %+  refuses-field  'failureDestination'
  |=  t=task:v1:sa
  t(delivery `[`%announce `'tlon' `'~nec' ~ `[`%announce `'tlon' `'~nec' ~]])
++  test-a-delivery-account-is-refused
  %+  refuses-field  'accountId'
  |=(t=task:v1:sa t(delivery `[`%announce `'tlon' `'~nec' `'default' ~]))
::  The host's timestamps are its own record, and no stagger is the hand's
::  own behavior, so neither refuses an edit.
::
++  test-host-timestamps-and-a-zero-stagger-are-accepted
  =/  base  (create [%cron `'0 9 * * *' ~ `~s0] `'Brief' ~)
  ?>  ?=(%create -.base)
  =/  stamped  task.base(created-at `~2026.1.1, updated-at `~2026.1.2)
  =/  created  (plan [%create stamped] ~)
  =/  updated  (plan [%update '0v1' stamped(schedule ~)] ~)
  ;:  weld
      (expect !>(?=(%& -.created)))
      (expect !>(?=(%& -.updated)))
  ==
::  every schedules become cron on UTC where some expression runs at the
::  same instants.
::
++  every-cron
  |=  [interval=@dr anchor=@da expected=@t]
  ^-  tang
  %+  expect-eq  !>(`(each @t @t)`[%& expected])
  !>((every-cron:automation interval anchor))
::
++  every-refused
  |=  [interval=@dr words=tape]
  ^-  tang
  =/  made  (every-cron:automation interval ~2026.11.23..10.05.00)
  ?.  ?=(%| -.made)  ~[leaf+"expected {<interval>} to be refused"]
  (expect !>(?=(^ (find words (trip p.made)))))
::
++  test-an-every-that-divides-an-hour-is-a-minute-list
  ;:  weld
      (every-cron ~m15 ~2026.11.23..10.05.00 '5,20,35,50 * * * *')
      (every-cron ~m30 ~2026.11.23..10.50.00 '20,50 * * * *')
      (every-cron ~h1 ~2026.11.23..10.07.00 '7 * * * *')
  ==
::
++  test-an-every-of-whole-hours-that-divides-a-day-is-an-hour-list
  ;:  weld
      (every-cron ~h4 ~2026.11.23..02.15.00 '15 2,6,10,14,18,22 * * *')
      (every-cron ~h4 ~2026.11.23..13.15.00 '15 1,5,9,13,17,21 * * *')
      (every-cron ~h12 ~2026.11.23..00.00.00 '0 0,12 * * *')
      (every-cron ~d1 ~2026.11.23..07.30.00 '30 7 * * *')
  ==
::  2026-11-23 is a Monday and 1999-12-31 a Friday.
::
++  test-an-every-of-a-week-runs-on-the-anchors-weekday
  ;:  weld
      (every-cron ~d7 ~2026.11.23..09.00.00 '0 9 * * 1')
      (every-cron ~d7 ~1999.12.31..23.59.00 '59 23 * * 5')
  ==
::  Cron runs on whole minutes, so an anchor's seconds are dropped.
::
++  test-an-anchor-off-the-minute-is-truncated-to-it
  (every-cron ~m15 ~2026.11.23..10.05.59..8000 '5,20,35,50 * * * *')
::
++  test-an-every-with-no-cron-schedule-is-refused
  ;:  weld
      (every-refused ~s30 "under a minute")
      (every-refused ~s90 "whole number of minutes")
      (every-refused (add ~m5 ~s0..8000) "whole number of minutes")
      (every-refused ~m45 "45 minutes")
      (every-refused ~m90 "90 minutes")
      (every-refused ~h7 "420 minutes")
      (every-refused ~h36 "2160 minutes")
      (every-refused ~d10 "14400 minutes")
  ==
::
++  test-a-create-from-an-every-runs-its-cron-on-utc-and-keeps-the-every
  =/  anchor  ~2026.11.20..02.15.00
  =/  planned  (plan (create [%every `~h4 `anchor] `'Check in' ~) ~)
  ?>  ?=(%& -.planned)
  =/  args=json
    %-  pairs:enjs:format
    :~  ['schedule' %s '15 2,6,10,14,18,22 * * *']  ['timezone' %s 'UTC']
        ['prompt' %s 'Check in']  ['runs' %s '100']
    ==
  ;:  weld
      (expect-eq !>(~[[%add 0v9 'owner-dm' '~nec' %prompt args]]) !>(steps.p.planned))
      %+  expect-eq
        !>(`[0v9 ~ `[~h4 anchor '15 2,6,10,14,18,22 * * *'] `'Brief' ~])
      !>(names.p.planned)
  ==
::  As in OpenClaw, an every without an anchor counts from its creation.
::
++  test-an-every-without-an-anchor-counts-from-now
  =/  planned  (plan (create [%every `~h4 ~] `'Check in' ~) ~)
  ?>  ?=(%& -.planned)
  ?>  ?=([[%add *] ~] steps.p.planned)
  =/  args  args.i.steps.p.planned
  ?>  ?=([%o *] args)
  ;:  weld
      %+  expect-eq  !>(`(unit json)``[%s '0 0,4,8,12,16,20 * * *'])
      !>((~(get by p.args) 'schedule'))
      %+  expect-eq  !>(`(unit cadence:t)``[~h4 now '0 0,4,8,12,16,20 * * *'])
      !>(?~(names.p.planned ~ every.task-names.u.names.p.planned))
  ==
::  An update to the same interval with no anchor keeps the one it had.
::
++  test-an-every-update-without-an-anchor-keeps-its-anchor
  =/  anchor  ~2026.11.1..02.15.00
  =/  names  (my ~[[0v1 [~ `[~h4 anchor '0 9 * * 1-5'] ~ ~]]])
  =/  planned  (plan [%update '0v1' %*(. *task:v1:sa schedule `[%every `~h4 ~])] names)
  ?>  ?=(%& -.planned)
  %+  expect-eq  !>(`(unit cadence:t)``[~h4 anchor '15 2,6,10,14,18,22 * * *'])
  !>(?~(names.p.planned ~ every.task-names.u.names.p.planned))
::
++  test-an-every-update-with-no-cron-schedule-or-a-reminder-is-invalid
  =/  hourly  [%update '0v4' %*(. *task:v1:sa schedule `[%every `~h1 ~])]
  =/  reminder  (plan:automation hourly 0v9 now ~nec schedules ~ binding)
  ;:  weld
      (refused [%update '0v1' %*(. *task:v1:sa schedule `[%every `~m45 ~])] %invalid)
      (refused (create [%every `~m45 ~] `'Brief' ~) %invalid)
      (refused (create [%every ~ ~] `'Brief' ~) %invalid)
      (expect !>(?=(%| -.reminder)))
  ==
::  A job shows the every it was made from while it runs that expression,
::  and its cron once the expression has changed.
::
++  test-a-job-made-from-an-every-projects-as-that-every
  =/  anchor  ~2026.11.1..09.00.00
  =/  same  (my ~[[0v1 [~ `[~d7 anchor '0 9 * * 1-5'] ~ ~]]])
  =/  moved  (my ~[[0v1 [~ `[~d7 anchor '0 9 * * 1'] ~ ~]]])
  ;:  weld
      %+  expect-eq  !>(`(unit cron-schedule:v1:sa)``[%every `~d7 `anchor])
      !>(schedule:task:(snag 0 (project:automation schedules same ~nec)))
      %+  expect-eq  !>(`(unit cron-schedule:v1:sa)``[%cron `'0 9 * * 1-5' `'-06:00' ~])
      !>(schedule:task:(snag 0 (project:automation schedules moved ~nec)))
  ==
--
