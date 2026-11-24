/-  c=harness-cron, hh=harness-hand, h=harness, *harness-store
/+  *test, schedule=harness-schedule, hd=harness-hand, ht=harness-tools, storage=harness-store
|%
++  ix
  |=  db=state:hh
  ^-  indexed:hh
  [db (reindex:hd db)]
++  source
  ^-  binding:hh
  ['fixture-chat' 'room/launch' 'source' ~['alice'] &]
++  action
  ^-  $>(%add action:c)
  :*  %add  0v1  'source-binding'  'alice'  %prompt
      %-  pairs:enjs:format
      :~  ['schedule' %s '* * * * *']  ['timezone' %s 'UTC']  ['prompt' %s 'Check launch status']
          ['runs' %s '2']
      ==
  ==
++  job
  ^-  schedule:c
  (create:schedule action source ~[%web] ~2026.9.9)
++  test-maintenance-follows-invalidation-and-the-armed-deadline
  =/  job  job
  =/  jobs  (my ~[[0v1 job]])
  ;:  weld
      (expect !>(!(maintenance-needed:schedule jobs `next.job ~2026.9.9 |)))
      (expect !>((maintenance-needed:schedule jobs `next.job ~2026.9.9 &)))
      (expect !>((maintenance-needed:schedule jobs `next.job next.job |)))
      (expect !>((maintenance-needed:schedule jobs `next.job (add next.job ~s1) |)))
      (expect !>((maintenance-needed:schedule jobs ~ ~2026.9.9 |)))
  ==
++  test-overdue-busy-job-respects-backoff-until-receipt-or-wake
  =/  job  job
  =/  jobs  (my ~[[0v1 job]])
  =/  now  (add next.job ~s1)
  =/  retry  (add now ~s30)
  ;:  weld
      (expect !>(!(maintenance-needed:schedule jobs `retry now |)))
      (expect !>((maintenance-needed:schedule jobs `retry now &)))
      (expect !>((maintenance-needed:schedule jobs `retry retry |)))
  ==
++  test-settled-jobs-do-not-sweep-on-reads-but-still-invalidate
  =/  job  job
  =/  jobs  (my ~[[0v1 job(state %complete)] [0v2 job(state %cancelled)] [0v3 job(state %paused)]])
  ;:  weld
      (expect !>(!(maintenance-needed:schedule jobs ~ ~2026.9.10 |)))
      (expect !>((maintenance-needed:schedule jobs ~ ~2026.9.10 &)))
      (expect !>(!(maintenance-needed:schedule ~ ~ ~2026.9.10 |)))
      (expect !>((maintenance-needed:schedule ~ `~2026.9.11 ~2026.9.10 &)))
  ==
++  test-scheduler-has-no-tlon-dependency
  =/  job  job
  ;:  weld
      (expect-eq !>('fixture-chat') !>(hand.job))
      (expect-eq !>('room/launch') !>(destination.job))
      (expect-eq !>('source-binding') !>(binding.job))
      (expect-eq !>('alice') !>(actor.job))
      (expect-eq !>(`%harness) !>((tool-hand:ht 'cron_add')))
  ==
++  test-unknown-actor-and-disabled-binding-rejected
  =/  action  action
  =/  source  source
  =/  wrong  (mule |.((create:schedule action(actor 'mallory') source ~ ~2026.9.9)))
  =/  disabled  (mule |.((create:schedule action source(enabled |) ~ ~2026.9.9)))
  (expect !>(&(?=(%| -.wrong) ?=(%| -.disabled))))
++  test-reminder-cannot-change-hand-destination
  =/  action  action
  =/  args
    %-  pairs:enjs:format
    :~  ['at' %s '2026-09-10T10:00:00-05:00']  ['destination' %s 'another-room']
        ['text' %s 'literal text']
    ==
  =/  wrong  (mule |.((create:schedule action(kind %reminder, args args) source ~ ~2026.9.9)))
  (expect !>(?=(%| -.wrong)))
++  test-valid-reminder-keeps-timezone-and-literal-body
  =/  action  action
  =/  args
    %-  pairs:enjs:format
    :~  ['at' %s '2026-09-10T10:00:00-05:00']  ['destination' %s 'room/launch']
        ['text' %s '/cancel is literal reminder text']
    ==
  =/  out  (create:schedule action(kind %reminder, args args) source ~ ~2026.9.9)
  ;:  weld
      (expect-eq !>(%reminder) !>(kind.out))
      (expect-eq !>('UTC-05:00') !>(timezone.out))
      (expect-eq !>('/cancel is literal reminder text') !>(prompt.out))
      (expect-eq !>(1) !>(remaining.out))
  ==
++  test-reminder-destination-defaults-to-source
  =/  action  action
  =/  args
    %-  pairs:enjs:format
    :~  ['at' %s '2035-03-13T09:00:00+09:00']  ['text' %s 'Visa renewal is due tomorrow']
    ==
  =/  out  (create:schedule action(kind %reminder, args args) source ~ ~2026.9.9)
  ;:  weld
      (expect-eq !>('room/launch') !>(destination.out))
      (expect-eq !>(~2035.3.13) !>(next.out))
      (expect-eq !>('UTC+09:00') !>(timezone.out))
  ==
++  test-schedule-kinds-share-the-authorized-source-and-run-identity
  =/  action  action
  =/  once
    (pairs:enjs:format ~[['at' %s '2026-09-10T10:00:00Z'] ['prompt' %s 'One-time work']])
  =/  reminder
    %-  pairs:enjs:format
    :~  ['at' %s '2026-09-10T10:00:00Z']  ['destination' %s 'room/launch']
        ['text' %s 'Literal reminder']
    ==
  =/  variants=(list action:c)
    ~[action action(args once) action(kind %reminder, args reminder)]
  %+  roll  variants
  |=  [variant=action:c checks=tang]
  =/  out  (create:schedule variant source ~[%web %workspace] ~2026.9.9)
  ;:  weld
      checks
      (expect-eq !>('room/launch') !>(destination.out))
      (expect-eq !>('source') !>(sid.out))
      (expect-eq !>('schedule-0v1') !>(run-sid.out))
      (expect-eq !>(`(list tool-grant:h)`~[%web %workspace]) !>(tools.out))
      (expect-eq !>(%active) !>(state.out))
      (expect-eq !>('') !>(reason.out))
      (expect-eq !>(`(unit @uv)`~) !>(last.out))
      (expect-eq !>((fingerprint:schedule variant)) !>(fingerprint.out))
  ==
++  test-downtime-coalesces-and-run-budget-terminates
  =/  once  (advance:schedule job 0v1 ~2026.9.10..12.00.30)
  =/  done  (advance:schedule once 0v2 ~2026.9.10..12.02.00)
  ;:  weld
      (expect-eq !>(1) !>(remaining.once))
      (expect-eq !>(~2026.9.10..12.01.00) !>(next.once))
      (expect-eq !>(%complete) !>(state.done))
      (expect-eq !>(0) !>(remaining.done))
  ==
++  test-one-time-work-uses-exact-time-and-completes-once
  =/  action  action
  =/  args
    %-  pairs:enjs:format
    :~  ['at' %s '2026-09-10T10:02:17-05:00']
        ['prompt' %s 'Fetch the confirmed quote and finish the home task.']
    ==
  =/  once  (create:schedule action(args args) source ~[%workspace %curl] ~2026.9.9)
  =/  done  (advance:schedule once 0v3 ~2026.9.10..15.02.18)
  =/  repeat  (mule |.((advance:schedule done 0v4 ~2026.9.11)))
  ;:  weld
      (expect-eq !>(%prompt) !>(kind.once))
      (expect-eq !>(~2026.9.10..15.02.17) !>(next.once))
      (expect-eq !>('UTC-05:00') !>(timezone.once))
      (expect-eq !>(1) !>(remaining.once))
      (expect-eq !>(%complete) !>(state.done))
      (expect-eq !>(0) !>(remaining.done))
      (expect !>(?=(%| -.repeat)))
      (expect-eq !>(`%harness) !>((tool-hand:ht 'schedule_once')))
  ==
++  test-one-time-work-rejects-invalid-or-past-time
  =/  action  action
  %-  zing
  %+  turn
    ~['2026-09-08T10:00:00Z' '2026-09-10T10:00:00' '2026-09-31T10:00:00Z' '2037-09-10T10:00:00Z']
  |=  at=@t
  =/  args  (pairs:enjs:format ~[['at' %s at] ['prompt' %s 'Work']])
  =/  invalid  (mule |.((create:schedule action(args args) source ~ ~2026.9.9)))
  (expect !>(?=(%| -.invalid)))
++  recurring
  |=  [schedule=@t timezone=@t]
  ^-  json
  %-  pairs:enjs:format
  :~  ['schedule' %s schedule]  ['timezone' %s timezone]  ['prompt' %s 'Morning brief']
      ['runs' %s '3']
  ==
++  test-offset-job-keeps-its-offset-on-every-occurrence
  =/  action  action
  =/  out  (create:schedule action(args (recurring '0 9 * * *' '-06:00')) source ~ ~2026.9.9)
  =/  second  (advance:schedule out 0v1 next.out)
  ::  Downtime past the second occurrence coalesces to the next local 09:00.
  =/  late  (advance:schedule second 0v2 ~2026.9.12)
  ;:  weld
      (expect-eq !>('-06:00') !>(timezone.out))
      (expect-eq !>(~2026.9.9..15.00.00) !>(next.out))
      (expect-eq !>(~2026.9.10..15.00.00) !>(next.second))
      (expect-eq !>(~2026.9.12..15.00.00) !>(next.late))
      %+  expect-eq  !>([%s '-06:00'])
      !>((~(got by (pairs-of (one-json:schedule 0v1 out *state:hh))) 'timezone'))
  ==
++  test-offset-job-matches-local-calendar-across-the-date-line
  =/  action  action
  =/  west  (create:schedule action(args (recurring '0 23 * * 5' '-06:00')) source ~ ~2026.9.9)
  =/  east  (create:schedule action(args (recurring '30 0 1 * *' '+05:30')) source ~ ~2026.9.9)
  =/  east-again  (advance:schedule east 0v1 next.east)
  ;:  weld
      (expect-eq !>(~2026.9.12..05.00.00) !>(next.west))
      (expect-eq !>(~2026.9.30..19.00.00) !>(next.east))
      (expect-eq !>(~2026.10.31..19.00.00) !>(next.east-again))
  ==
++  test-edit-to-an-offset-moves-the-next-run
  =/  j  job
  =/  edited  (editable:schedule 0v1 j (recurring '0 9 * * *' '+05:30') ~2026.9.9)
  ;:  weld
      (expect-eq !>('+05:30') !>(timezone.edited))
      (expect-eq !>(~2026.9.9..03.30.00) !>(next.edited))
  ==
++  test-utc-and-zero-offset-jobs-run-as-before
  =/  action  action
  =/  utc  (create:schedule action(args (recurring '0 9 * * *' 'UTC')) source ~ ~2026.9.9)
  =/  zero  (create:schedule action(args (recurring '0 9 * * *' '+00:00')) source ~ ~2026.9.9)
  ;:  weld
      (expect-eq !>('UTC') !>(timezone.utc))
      (expect-eq !>(~2026.9.9..09.00.00) !>(next.utc))
      (expect-eq !>(~2026.9.10..09.00.00) !>(next:(advance:schedule utc 0v1 next.utc)))
      (expect-eq !>('+00:00') !>(timezone.zero))
      (expect-eq !>(next.utc) !>(next.zero))
  ==
++  test-recurring-timezone-accepts-only-utc-or-a-fixed-offset
  =/  action  action
  =/  invalid=(list @t)
    :~  'America/Chicago'  'Z'  'utc'  '+5'  '+05'  '+0500'  'UTC+5'  'UTC+05:00'
        '-00:00'  '+15:00'  '-14:30'  '+05:60'  '05:00'  '+5:00'  ' +05:00'  ''
    ==
  =/  accepted=(list @t)  ~['+14:00' '-12:00' '+05:45' '+00:00']
  ;:  weld
      %-  expect
      !>  %+  levy  invalid
          |=  timezone=@t
          =/  args  (recurring '0 9 * * *' timezone)
          =/  result  (mule |.((create:schedule action(args args) source ~ ~2026.9.9)))
          ?=(%| -.result)
      %-  expect
      !>  %+  levy  accepted
          |=  timezone=@t
          =/  args  (recurring '0 9 * * *' timezone)
          =/  result  (mule |.((create:schedule action(args args) source ~ ~2026.9.9)))
          ?=(%& -.result)
  ==
++  pairs-of
  |=  value=json
  ^-  (map @t json)
  ?>  ?=(%o -.value)
  p.value
++  test-pending-and-uncertain-work-prevent-overlap-and-clear
  =/  job  job
  =/  db=state:hh  *state:hh
  =.  observations.db  (my ~[[0v1 [run-sid.job 'event' 'alice' 'test' ~2026.9.9 %completed]]])
  =.  outbox.db
    %-  my
    :~  :*  0v1
            :*  0v1  run-sid.job  hand.job  destination.job  run-sid.job  %reply  'answer'
                %uncertain  'worker'  ''  ~
            ==
        ==
    ==
  =/  done  (job-value:schedule job(state %complete, remaining 0, last `0v1))
  ;:  weld
      (expect !>((busy:schedule done (ix db))))
      (expect !>(!(clearable:schedule done (ix db))))
      (expect !>((clearable:schedule done (ix db(outbox ~)))))
  ==
++  test-clearing-unfired-cancelled-job-keeps-budget-unused
  =/  job  job
  (expect !>((clearable:schedule (job-value:schedule job(state %cancelled)) (ix *state:hh))))
++  test-source-binding-scopes-list-results
  =/  job  job
  =/  jobs  (my ~[[0v1 job] [0v2 job(binding 'another-binding')]])
  =/  result  (list-json:schedule jobs (ix *state:hh) `'source-binding')
  ?>  ?=(%a -.result)
  (expect-eq !>(1) !>((lent p.result)))
++  test-schedules-strip-recursion-delegation-and-administration
  %+  expect-eq
    !>(`(list tool-grant:h)`~[%web %workspace])
  !>((scheduled-tools:ht ~[%cron %subagents %code %admin %web %workspace]))
++  test-management-is-owner-or-same-binding-and-actor
  ;:  weld
      (expect !>((accessible:schedule job & 'owner-dm' '~zod')))
      (expect !>((accessible:schedule job | 'source-binding' 'alice')))
      (expect !>(!(accessible:schedule job | 'source-binding' 'bob')))
      (expect !>(!(accessible:schedule job | 'other-room' 'alice')))
      (expect !>((tool-granted:ht 'cron_update' ~[%cron])))
      (expect !>(!(tool-granted:ht 'cron_retry' (scheduled-tools:ht ~[%cron %web]))))
  ==
++  test-edit-keeps-identity-history-and-grants
  =/  j  job
  =.  last.j  `0v9
  =/  args
    %-  pairs:enjs:format
    :~  ['schedule' %s '0 9 * * *']  ['timezone' %s 'UTC']
        ['prompt' %s 'Check the deployment status']  ['runs' %s '5']
    ==
  =/  edited  (editable:schedule 0v1 j args ~2026.9.9)
  =/  invalid
    %-  mule
    |.  %:  editable:schedule
          0v1
          j
          (pairs:enjs:format ~[['at' %s '2026-09-08T00:00:00Z'] ['prompt' %s 'Past']])
          ~2026.9.9
        ==
  ;:  weld
      (expect-eq !>(binding.j) !>(binding.edited))
      (expect-eq !>(run-sid.j) !>(run-sid.edited))
      (expect-eq !>(last.j) !>(last.edited))
      (expect-eq !>(tools.j) !>(tools.edited))
      (expect-eq !>(fingerprint.j) !>(fingerprint.edited))
      (expect-eq !>(5) !>(remaining.edited))
      (expect-eq !>(~2026.9.9..09.00.00) !>(next.edited))
      (expect !>(?=(%| -.invalid)))
  ==
++  test-retry-requires-failed-execution-and-settled-delivery
  =/  j  job
  =.  last.j  `0v9
  =/  db=state:hh  *state:hh
  =/  obs=observation:hh  [run-sid.j 'event' actor.j prompt.j ~2026.9.9 %failed]
  =/  pub=publication:hh
    :*  0v9  run-sid.j  hand.j  destination.j  run-sid.j  %failure  'Authentication failed'
        %delivered  'worker'  'post'  ~
    ==
  =.  observations.db  (my ~[[0v9 obs]])
  =.  outbox.db  (my ~[[0v9 pub]])
  =/  value  (job-value:schedule j)
  ;:  weld
      (expect !>((retryable:schedule value (ix db))))
      (expect !>((retryable:schedule value(state %complete, remaining 0) (ix db))))
      (expect !>(!(retryable:schedule value(state %cancelled) (ix db))))
      (expect !>(!(retryable:schedule value(kind %reminder) (ix db))))
      (expect !>(!(retryable:schedule value (ix db(outbox ~)))))
      (expect !>(!(retryable:schedule value (ix db(observations (my ~[[0v9 obs(phase %completed)]]))))))
      (expect !>(!(retryable:schedule value (ix db(outbox (my ~[[0v9 pub(kind %reply)]]))))))
      (expect !>(!(retryable:schedule value (ix db(outbox (my ~[[0v9 pub(status %pending)]]))))))
      (expect !>(!(retryable:schedule value (ix db(outbox (my ~[[0v9 pub(status %claimed)]]))))))
      (expect !>(!(retryable:schedule value (ix db(outbox (my ~[[0v9 pub(status %uncertain)]]))))))
  ==
--
