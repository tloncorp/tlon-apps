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
  (action:dejs:aj (parse-json body))
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
  :*  (some 'dev')
      (some 'Captured weekday reminder')
      (some 'Captured cron expression fixture')
      (some %.n)
      (some [%cron (some '17 4 * * 1-5') (some 'America/New_York') (some ~s45)])
      (some 'isolated')
      (some 'now')
      (some [(some 'agentTurn') (some 'Send a weekday reminder.')])
      (some (unix-milliseconds-to-date:au 1.786.416.589.889))
      (some (unix-milliseconds-to-date:au 1.786.416.589.889))
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
  '''
  {
    "project": {
      "tasks": [
        {
          "id": "trace-at-1",
          "agentId": "dev",
          "name": "Captured one-shot reminder",
          "enabled": true,
          "schedule": {
            "kind": "at",
            "at": 1785734301000
          },
          "sessionTarget": "isolated",
          "wakeMode": "now",
          "payload": {
            "kind": "agentTurn",
            "message": "Send a short reminder."
          },
          "createdAtMs": 1785734006665,
          "updatedAtMs": 1785734006665
        },
        {
          "id": "trace-every-1",
          "agentId": "dev",
          "name": "Captured interval reminder",
          "enabled": true,
          "schedule": {
            "kind": "every",
            "everyMs": 120000,
            "anchorMs": 1785735243782
          },
          "sessionTarget": "isolated",
          "wakeMode": "now",
          "payload": {
            "kind": "agentTurn",
            "message": "Send a playful reminder."
          },
          "createdAtMs": 1785735243782,
          "updatedAtMs": 1785740230441
        }
      ]
    }
  }
  '''
++  trace-task-map-json
  ^-  @t
  '''
  {
    "tasks": {
      "trace-at-1": {
        "agentId": "dev",
        "name": "Captured one-shot reminder",
        "enabled": true,
        "schedule": {
          "kind": "at",
          "at": 1785734301000
        },
        "sessionTarget": "isolated",
        "wakeMode": "now",
        "payload": {
          "kind": "agentTurn",
          "message": "Send a short reminder."
        },
        "createdAtMs": 1785734006665,
        "updatedAtMs": 1785734006665
      },
      "trace-every-1": {
        "agentId": "dev",
        "name": "Captured interval reminder",
        "enabled": true,
        "schedule": {
          "kind": "every",
          "everyMs": 120000,
          "anchorMs": 1785735243782
        },
        "sessionTarget": "isolated",
        "wakeMode": "now",
        "payload": {
          "kind": "agentTurn",
          "message": "Send a playful reminder."
        },
        "createdAtMs": 1785735243782,
        "updatedAtMs": 1785740230441
      }
    }
  }
  '''
++  trace-action
  ^-  action:v1:a
  [%project ~[['trace-at-1' trace-at-task] ['trace-every-1' trace-every-task]]]
++  trace-task-map
  ^-  task-map:v1:a
  %-  ~(gas by *(map @t task:v1:a))
  ~[['trace-at-1' trace-at-task] ['trace-every-1' trace-every-task]]
::
::  the two production marks are deliberately thin wrappers around these
::  helpers. importing /mar files as test libraries is not supported by the
::  desk build, so these tests call the exact ++grab:json/++grow:json targets
::
++  test-trace-derived-action-grab-and-grow
  =/  actual=action:v1:a  (parse-action trace-project-json)
  ;:  weld
    (expect-eq !>(trace-action) !>(actual))
    %+  expect-eq
      !>((parse-json trace-project-json))
    !>((action:enjs:aj actual))
  ==
::
::  this case is normalized from a live pinned OpenClaw cron-expression capture
::
++  test-focused-cron-schedule-codec
  =/  body=@t
    '''
    {
      "project": {
        "tasks": [
          {
            "id": "trace-cron-1",
            "agentId": "dev",
            "name": "Captured weekday reminder",
            "description": "Captured cron expression fixture",
            "enabled": false,
            "schedule": {
              "kind": "cron",
              "expr": "17 4 * * 1-5",
              "tz": "America/New_York",
              "staggerMs": 45000
            },
            "sessionTarget": "isolated",
            "wakeMode": "now",
            "payload": {
              "kind": "agentTurn",
              "message": "Send a weekday reminder."
            },
            "createdAtMs": 1786416589889,
            "updatedAtMs": 1786416589889
          }
        ]
      }
    }
    '''
  =/  expected=action:v1:a  [%project ~[['trace-cron-1' cron-task]]]
  =/  actual=action:v1:a  (parse-action body)
  ;:  weld
    (expect-eq !>(expected) !>(actual))
    (expect-eq !>((parse-json body)) !>((action:enjs:aj actual)))
  ==
++  test-empty-action-grab-and-grow
  =/  body=@t
    '''
    {
      "project": {
        "tasks": []
      }
    }
    '''
  =/  actual=action:v1:a  (parse-action body)
  ;:  weld
    (expect-eq !>(`action:v1:a`[%project ~]) !>(actual))
    (expect-eq !>((parse-json body)) !>((action:enjs:aj actual)))
  ==
++  test-absent-optionals-roundtrip
  =/  body=@t
    '''
    {
      "project": {
        "tasks": [
          {
            "id": "empty"
          }
        ]
      }
    }
    '''
  =/  expected=action:v1:a  [%project ~[['empty' empty-task]]]
  =/  actual=action:v1:a  (parse-action body)
  ;:  weld
    (expect-eq !>(expected) !>(actual))
    %+  expect-eq
      !>((parse-json body))
    !>((action:enjs:aj actual))
  ==
++  test-invalid-json-rejected
  =/  body=@t
    '''
    {
      "project":
    '''
  %-  expect-fail
  |.  (parse-action body)
++  test-duplicate-action-ids-rejected
  %-  expect-fail
  |.  %-  parse-action
      '''
      {
        "project": {
          "tasks": [
            {
              "id": "same"
            },
            {
              "id": "same"
            }
          ]
        }
      }
      '''
++  test-invalid-schedule-kind-rejected
  %-  expect-fail
  |.  %-  parse-action
      '''
      {
        "project": {
          "tasks": [
            {
              "id": "bad",
              "schedule": {
                "kind": "once"
              }
            }
          ]
        }
      }
      '''
++  test-trace-task-map-grows-ids-as-keys-only
  =/  actual=json  (task-map:enjs:aj trace-task-map)
  ;:  weld
    (expect-eq !>((parse-json trace-task-map-json)) !>(actual))
    (expect-eq !>(trace-task-map) !>((task-map:dejs:aj actual)))
  ==
++  test-populated-task-map-serializes-id-as-key-only
  =/  tasks=(map @t task:v1:a)
    (~(put by *(map @t task:v1:a)) 'map-id' named-task)
  =/  expected=json
    %-  parse-json
    '''
    {
      "tasks": {
        "map-id": {
          "name": "Named task"
        }
      }
    }
    '''
  =/  actual=json  (task-map:enjs:aj tasks)
  ;:  weld
    (expect-eq !>(expected) !>(actual))
    (expect-eq !>(tasks) !>((task-map:dejs:aj actual)))
  ==
++  test-empty-task-map-serializes-as-empty-object
  =/  tasks=task-map:v1:a  *(map @t task:v1:a)
  =/  expected=json
    %-  parse-json
    '''
    {
      "tasks": {}
    }
    '''
  ;:  weld
    (expect-eq !>(expected) !>((task-map:enjs:aj tasks)))
    (expect-eq !>(tasks) !>((task-map:dejs:aj expected)))
  ==
--
