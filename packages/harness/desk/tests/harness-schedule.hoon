/-  c=harness-cron, hh=harness-hand, h=harness, *harness-store
/+  *test, schedule=harness-schedule, hd=harness-hand, ht=harness-tools, storage=harness-store
|%
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
      (expect !>((busy:schedule done db)))
      (expect !>(!(clearable:schedule done db)))
      (expect !>((clearable:schedule done db(outbox ~))))
  ==
++  test-clearing-unfired-cancelled-job-keeps-budget-unused
  =/  job  job
  (expect !>((clearable:schedule (job-value:schedule job(state %cancelled)) *state:hh)))
++  test-source-binding-scopes-list-results
  =/  job  job
  =/  jobs  (my ~[[0v1 job] [0v2 job(binding 'another-binding')]])
  =/  result  (list-json:schedule jobs *state:hh `'source-binding')
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
      (expect !>((retryable:schedule value db)))
      (expect !>((retryable:schedule value(state %complete, remaining 0) db)))
      (expect !>(!(retryable:schedule value(state %cancelled) db)))
      (expect !>(!(retryable:schedule value(kind %reminder) db)))
      (expect !>(!(retryable:schedule value db(outbox ~))))
      (expect !>(!(retryable:schedule value db(observations (my ~[[0v9 obs(phase %completed)]])))))
      (expect !>(!(retryable:schedule value db(outbox (my ~[[0v9 pub(kind %reply)]])))))
      (expect !>(!(retryable:schedule value db(outbox (my ~[[0v9 pub(status %pending)]])))))
      (expect !>(!(retryable:schedule value db(outbox (my ~[[0v9 pub(status %claimed)]])))))
      (expect !>(!(retryable:schedule value db(outbox (my ~[[0v9 pub(status %uncertain)]])))))
  ==
--
