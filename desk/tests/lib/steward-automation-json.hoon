::  steward automation production JSON codec tests
::
/-  a=steward-automation
/+  *test, aj=steward-automation-json, au=steward-automation
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
++  trace-at-task
  ^-  task:v1:a
  :*  (some 'dev')
      (some 'Captured one-shot reminder')
      ~
      (some %.y)
      (some [%at (some (unix-milliseconds-to-date:au 1.785.734.301.000))])
      (some 'isolated')
      (some 'now')
      (some [(some 'agentTurn') (some 'Send a short reminder.')])
      (some (unix-milliseconds-to-date:au 1.785.734.006.665))
      (some (unix-milliseconds-to-date:au 1.785.734.006.665))
  ==
++  trace-every-task
  ^-  task:v1:a
  :*  (some 'dev')
      (some 'Captured interval reminder')
      ~
      (some %.y)
      (some [%every (some ~m2) (some (unix-milliseconds-to-date:au 1.785.735.243.782))])
      (some 'isolated')
      (some 'now')
      (some [(some 'agentTurn') (some 'Send a playful reminder.')])
      (some (unix-milliseconds-to-date:au 1.785.735.243.782))
      (some (unix-milliseconds-to-date:au 1.785.740.230.441))
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
++  trace-project-json
  ^-  @t
  '{"project":{"tasks":[{"id":"trace-at-1","agentId":"dev","name":"Captured one-shot reminder","enabled":true,"schedule":{"kind":"at","at":1785734301000},"sessionTarget":"isolated","wakeMode":"now","payload":{"kind":"agentTurn","text":"Send a short reminder."},"createdAtMs":1785734006665,"updatedAtMs":1785734006665},{"id":"trace-every-1","agentId":"dev","name":"Captured interval reminder","enabled":true,"schedule":{"kind":"every","everyMs":120000,"anchorMs":1785735243782},"sessionTarget":"isolated","wakeMode":"now","payload":{"kind":"agentTurn","text":"Send a playful reminder."},"createdAtMs":1785735243782,"updatedAtMs":1785740230441}]}}'
++  trace-task-map-json
  ^-  @t
  '{"tasks":{"trace-at-1":{"agentId":"dev","name":"Captured one-shot reminder","enabled":true,"schedule":{"kind":"at","at":1785734301000},"sessionTarget":"isolated","wakeMode":"now","payload":{"kind":"agentTurn","text":"Send a short reminder."},"createdAtMs":1785734006665,"updatedAtMs":1785734006665},"trace-every-1":{"agentId":"dev","name":"Captured interval reminder","enabled":true,"schedule":{"kind":"every","everyMs":120000,"anchorMs":1785735243782},"sessionTarget":"isolated","wakeMode":"now","payload":{"kind":"agentTurn","text":"Send a playful reminder."},"createdAtMs":1785735243782,"updatedAtMs":1785740230441}}}'
++  trace-action
  ^-  action:v1:a
  [%project ~[['trace-at-1' trace-at-task] ['trace-every-1' trace-every-task]]]
++  trace-task-map
  ^-  task-map:v1:a
  %-  ~(gas by *(map @t task:v1:a))
  ~[['trace-at-1' trace-at-task] ['trace-every-1' trace-every-task]]
::
::  The two production marks are deliberately thin wrappers around these
::  helpers. Importing /mar files as test libraries is not supported by the
::  desk build, so these tests call the exact ++grab:json/++grow:json targets.
::
++  test-trace-derived-action-grab-and-grow
  =/  actual=action:v1:a  (parse-action trace-project-json)
  ;:  weld
    (expect-eq !>(trace-action) !>(actual))
    %+  expect-eq
      !>((parse-json trace-project-json))
    !>((action-to-json:aj actual))
  ==
::
::  No cron-expression job was present in the captured runtime history. Keep
::  this synthetic case focused on the third supported schedule codec.
::
++  test-focused-cron-schedule-codec
  =/  body=@t
    '{"project":{"tasks":[{"id":"cron-focused","agentId":"agent-1","name":"Daily summary","description":"Send the daily summary","enabled":true,"schedule":{"kind":"cron","expr":"0 9 * * *","tz":"UTC","staggerMs":30000},"sessionTarget":"isolated","wakeMode":"now","payload":{"kind":"agentTurn","text":"Summarize activity"},"createdAtMs":1704067200000,"updatedAtMs":1704153600000}]}}'
  =/  expected=action:v1:a  [%project ~[['cron-focused' cron-task]]]
  =/  actual=action:v1:a  (parse-action body)
  ;:  weld
    (expect-eq !>(expected) !>(actual))
    (expect-eq !>((parse-json body)) !>((action-to-json:aj actual)))
  ==
++  test-empty-action-grab-and-grow
  =/  body=@t  '{"project":{"tasks":[]}}'
  =/  actual=action:v1:a  (parse-action body)
  ;:  weld
    (expect-eq !>(`action:v1:a`[%project ~]) !>(actual))
    (expect-eq !>((parse-json body)) !>((action-to-json:aj actual)))
  ==
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
++  test-invalid-json-rejected
  %-  expect-fail
  |.  (parse-action '{"project":')
++  test-duplicate-action-ids-rejected
  %-  expect-fail
  |.  %-  parse-action
      '{"project":{"tasks":[{"id":"same"},{"id":"same"}]}}'
++  test-invalid-schedule-kind-rejected
  %-  expect-fail
  |.  %-  parse-action
      '{"project":{"tasks":[{"id":"bad","schedule":{"kind":"once"}}]}}'
++  test-trace-task-map-grows-ids-as-keys-only
  =/  actual=json  (task-map-to-json:aj trace-task-map)
  ;:  weld
    (expect-eq !>((parse-json trace-task-map-json)) !>(actual))
    (expect-eq !>(trace-task-map) !>((task-map-from-json:aj actual)))
  ==
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
++  test-empty-task-map-serializes-as-empty-object
  =/  tasks=task-map:v1:a  *(map @t task:v1:a)
  =/  expected=json  (parse-json '{"tasks":{}}')
  ;:  weld
    (expect-eq !>(expected) !>((task-map-to-json:aj tasks)))
    (expect-eq !>(tasks) !>((task-map-from-json:aj expected)))
  ==
--
