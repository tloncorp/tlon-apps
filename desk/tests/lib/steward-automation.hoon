::  steward automation type and time conversion tests
::
/-  a=steward-automation
/+  *test, au=steward-automation
|%
++  populated-job
  ^-  cron-job:v1:a
  :*  'task-1'
      (some 'agent-1')
      (some 'Daily summary')
      (some 'Send the daily summary')
      (some %.y)
      (some [%cron (some '0 9 * * *') (some 'UTC') (some ~s30)])
      (some 'isolated')
      (some 'now')
      (some [(some 'agentTurn') (some 'Summarize activity')])
      (some ~2024.1.1)
      (some ~2024.1.2)
  ==
::
++  test-duration-boundaries-and-roundtrips
  ;:  weld
    %+  expect-eq
      !>(`@dr`~s0)
    !>((milliseconds-to-duration:au 0))
  ::
    %+  expect-eq
      !>(`@ud`0)
    !>((duration-to-milliseconds:au (milliseconds-to-duration:au 0)))
  ::
    %+  expect-eq
      !>(`@ud`1)
    !>((duration-to-milliseconds:au (milliseconds-to-duration:au 1)))
  ::
    %+  expect-eq
      !>(`@dr`~s1)
    !>((milliseconds-to-duration:au 1.000))
  ::
    %+  expect-eq
      !>(`@ud`5.000)
    !>((duration-to-milliseconds:au (milliseconds-to-duration:au 5.000)))
  ::
    %+  expect-eq
      !>(`@ud`1.234)
    !>((duration-to-milliseconds:au (milliseconds-to-duration:au 1.234)))
  ==
::
++  test-unix-date-boundaries-and-roundtrips
  ;:  weld
    %+  expect-eq
      !>(~1970.1.1)
    !>((unix-milliseconds-to-date:au 0))
  ::
    %+  expect-eq
      !>(`@ud`0)
    !>((date-to-unix-milliseconds:au ~1970.1.1))
  ::
    %+  expect-eq
      !>(`@ud`1)
    !>  (date-to-unix-milliseconds:au (unix-milliseconds-to-date:au 1))
  ::
    %+  expect-eq
      !>(~2024.1.1)
    !>((unix-milliseconds-to-date:au 1.704.067.200.000))
  ::
    %+  expect-eq
      !>(`@ud`1.704.067.200.000)
    !>  (date-to-unix-milliseconds:au (unix-milliseconds-to-date:au 1.704.067.200.000))
  ==
::
++  test-v1-types-and-optional-fields
  =/  empty=cron-job:v1:a
    :*  ''
        ~
        ~
        ~
        ~
        ~
        ~
        ~
        ~
        ~
        ~
    ==
  =/  job=cron-job:v1:a  populated-job
  =/  action=action:v1:a  [%project ~[job]]
  =/  task-list=task-list:v1:a  ~[job]
  ;:  weld
    (expect-eq !>(empty) !>(*cron-job:v1:a))
    (expect-eq !>(`action:v1:a`[%project ~[job]]) !>(action))
    (expect-eq !>(`task-list:v1:a`~[job]) !>(task-list))
  ==
::
++  test-schedule-variants-and-optional-fields
  =/  empty-cron=cron-schedule:v1:a  [%cron ~ ~ ~]
  =/  cron=cron-schedule:v1:a
    [%cron (some '0 9 * * *') (some 'UTC') (some ~s30)]
  =/  empty-at=cron-schedule:v1:a  [%at ~]
  =/  at=cron-schedule:v1:a  [%at (some ~2024.2.29..12.34.56)]
  =/  empty-every=cron-schedule:v1:a  [%every ~ ~]
  =/  every=cron-schedule:v1:a
    [%every (some ~m15) (some ~2024.1.1)]
  ;:  weld
    (expect-eq !>(`cron-schedule:v1:a`[%cron ~ ~ ~]) !>(empty-cron))
    %+  expect-eq
      !>(`cron-schedule:v1:a`[%cron (some '0 9 * * *') (some 'UTC') (some ~s30)])
    !>(cron)
    (expect-eq !>(`cron-schedule:v1:a`[%at ~]) !>(empty-at))
    %+  expect-eq
      !>(`cron-schedule:v1:a`[%at (some ~2024.2.29..12.34.56)])
    !>(at)
    (expect-eq !>(`cron-schedule:v1:a`[%every ~ ~]) !>(empty-every))
    %+  expect-eq
      !>(`cron-schedule:v1:a`[%every (some ~m15) (some ~2024.1.1)])
    !>(every)
  ==
--
