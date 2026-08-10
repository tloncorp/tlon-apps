::  steward automation production JSON codec tests
::
/-  a=steward-automation
/+  *test, aj=steward-automation-json
|%
++  parse-json
  |=  body=@t
  ^-  json
  (need (de:json:html body))
++  parse-action
  |=  body=@t
  ^-  action:v1:a
  (action-from-json:aj (parse-json body))
++  empty-task
  ^-  task:v1:a
  :*  ~
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
++  cron-task
  ^-  task:v1:a
  :*  (some 'agent-1')
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
++  at-task
  ^-  task:v1:a
  :*  ~
      (some 'One shot')
      ~
      (some %.n)
      (some [%at (some ~2024.1.1)])
      ~
      ~
      ~
      ~
      ~
  ==
++  every-task
  ^-  task:v1:a
  :*  ~
      (some 'Quarter hourly')
      ~
      ~
      (some [%every (some ~m15) (some ~2024.1.1)])
      ~
      ~
      ~
      ~
      ~
  ==
++  named-task
  ^-  task:v1:a
  :*  ~
      (some 'Named task')
      ~
      ~
      ~
      ~
      ~
      ~
      ~
      ~
  ==
::
++  test-populated-action-parses-and-roundtrips
  =/  input=@t
    '{"project":{"tasks":[{"id":"cron-1","agentId":"agent-1","name":"Daily summary","description":"Send the daily summary","enabled":true,"schedule":{"kind":"cron","expr":"0 9 * * *","tz":"UTC","staggerMs":30000},"sessionTarget":"isolated","wakeMode":"now","payload":{"kind":"agentTurn","text":"Summarize activity"},"createdAtMs":1704067200000,"updatedAtMs":1704153600000,"state":{"lastStatus":"ok"},"lastRunAtMs":1704153600000},{"id":"at-1","name":"One shot","enabled":false,"schedule":{"kind":"at","at":1704067200000}},{"id":"every-1","name":"Quarter hourly","schedule":{"kind":"every","everyMs":900000,"anchorMs":1704067200000}}]}}'
  =/  normalized=@t
    '{"project":{"tasks":[{"id":"cron-1","agentId":"agent-1","name":"Daily summary","description":"Send the daily summary","enabled":true,"schedule":{"kind":"cron","expr":"0 9 * * *","tz":"UTC","staggerMs":30000},"sessionTarget":"isolated","wakeMode":"now","payload":{"kind":"agentTurn","text":"Summarize activity"},"createdAtMs":1704067200000,"updatedAtMs":1704153600000},{"id":"at-1","name":"One shot","enabled":false,"schedule":{"kind":"at","at":1704067200000}},{"id":"every-1","name":"Quarter hourly","schedule":{"kind":"every","everyMs":900000,"anchorMs":1704067200000}}]}}'
  =/  expected=action:v1:a
    [%project ~[['cron-1' cron-task] ['at-1' at-task] ['every-1' every-task]]]
  =/  actual=action:v1:a  (parse-action input)
  ;:  weld
    (expect-eq !>(expected) !>(actual))
    %+  expect-eq
      !>((parse-json normalized))
    !>((action-to-json:aj actual))
  ==
::
++  test-absent-optionals-roundtrip
  =/  expected=action:v1:a  [%project ~[['empty' empty-task]]]
  =/  actual=action:v1:a
    (parse-action '{"project":{"tasks":[{"id":"empty"}]}}')
  ;:  weld
    (expect-eq !>(expected) !>(actual))
    %+  expect-eq
      !>((parse-json '{"project":{"tasks":[{"id":"empty"}]}}'))
    !>((action-to-json:aj actual))
  ==
::
++  test-duplicate-action-ids-rejected
  %-  expect-fail
  |.  %-  parse-action
      '{"project":{"tasks":[{"id":"same"},{"id":"same"}]}}'
::
++  test-invalid-schedule-kind-rejected
  %-  expect-fail
  |.  %-  parse-action
      '{"project":{"tasks":[{"id":"bad","schedule":{"kind":"once"}}]}}'
::
++  test-populated-task-map-serializes-id-as-key-only
  =/  tasks=(map @t task:v1:a)
    (~(put by *(map @t task:v1:a)) 'map-id' named-task)
  =/  expected=json
    (parse-json '{"tasks":{"map-id":{"name":"Named task"}}}')
  =/  actual=json  (task-map-to-json:aj tasks)
  ;:  weld
    (expect-eq !>(expected) !>(actual))
    (expect-eq !>(tasks) !>((task-map-from-json:aj actual)))
  ==
::
++  test-empty-task-map-serializes-as-empty-object
  =/  tasks=task-map:v1:a  *(map @t task:v1:a)
  =/  expected=json  (parse-json '{"tasks":{}}')
  ;:  weld
    (expect-eq !>(expected) !>((task-map-to-json:aj tasks)))
    (expect-eq !>(tasks) !>((task-map-from-json:aj expected)))
  ==
--
