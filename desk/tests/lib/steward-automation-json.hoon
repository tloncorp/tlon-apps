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
::  the %tasks snapshot: ships are object keys, values are the bare
::  ID-keyed task objects
::
++  trace-tasks-update-json
  ^-  @t
  '''
  {
    "tasks": {
      "~zod": {
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
  }
  '''
++  trace-action
  ^-  action:v1:a
  [%project ~[['trace-at-1' trace-at-task] ['trace-every-1' trace-every-task]]]
++  trace-tasks
  ^-  tasks:v1:a
  %-  ~(gas by *tasks:v1:a)
  ~[['trace-at-1' trace-at-task] ['trace-every-1' trace-every-task]]
::  a moon-class ship (~doznec-dozzod-dozdev, a moon of ~dozdev): fixture-
::  anchoring one alongside ~zod keeps a symmetric codec bug in ship
::  rendering from hiding behind the round-trips
::
++  moon  ^-  ship  ~doznec-dozzod-dozdev
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
::
::  %steward-automation-update-1: every variant identifies itself and
::  the ship it touches; %tasks carries the complete ship-keyed state
::
++  test-update-tasks-grows-ships-and-ids-as-keys
  =/  update=update:v1:a
    [%tasks (~(put by *(map ship tasks:v1:a)) ~zod trace-tasks)]
  =/  actual=json  (update:enjs:aj update)
  ;:  weld
    (expect-eq !>((parse-json trace-tasks-update-json)) !>(actual))
    (expect-eq !>(update) !>((update:dejs:aj actual)))
  ==
++  test-update-empty-tasks-serializes-as-empty-object
  =/  update=update:v1:a  [%tasks *(map ship tasks:v1:a)]
  =/  expected=json  (parse-json '{"tasks": {}}')
  ;:  weld
    (expect-eq !>(expected) !>((update:enjs:aj update)))
    (expect-eq !>(update) !>((update:dejs:aj expected)))
  ==
++  test-update-set-carries-ship-id-and-task
  =/  update=update:v1:a  [%set ~zod 'map-id' named-task]
  =/  expected=json
    %-  parse-json
    '''
    {
      "set": {
        "ship": "~zod",
        "id": "map-id",
        "task": {
          "name": "Named task"
        }
      }
    }
    '''
  ;:  weld
    (expect-eq !>(expected) !>((update:enjs:aj update)))
    (expect-eq !>(update) !>((update:dejs:aj expected)))
  ==
++  test-update-del-carries-ship-and-id
  =/  update=update:v1:a  [%del ~zod 'map-id']
  =/  expected=json
    (parse-json '{"del": {"ship": "~zod", "id": "map-id"}}')
  ;:  weld
    (expect-eq !>(expected) !>((update:enjs:aj update)))
    (expect-eq !>(update) !>((update:dejs:aj expected)))
  ==
++  test-update-gone-carries-ship-only
  =/  update=update:v1:a  [%gone ~zod]
  =/  expected=json  (parse-json '{"gone": {"ship": "~zod"}}')
  ;:  weld
    (expect-eq !>(expected) !>((update:enjs:aj update)))
    (expect-eq !>(update) !>((update:dejs:aj expected)))
  ==
++  test-update-moon-ship-fixture
  =/  update=update:v1:a  [%gone moon]
  =/  expected=json
    (parse-json '{"gone": {"ship": "~doznec-dozzod-dozdev"}}')
  ;:  weld
    (expect-eq !>(expected) !>((update:enjs:aj update)))
    (expect-eq !>(update) !>((update:dejs:aj expected)))
  ==
++  test-update-round-trips-all-variants
  =/  populated=(map ship tasks:v1:a)
    %-  ~(gas by *(map ship tasks:v1:a))
    ~[[~zod trace-tasks] [moon *tasks:v1:a]]
  =/  all=(list update:v1:a)
    :~  [%tasks populated]
        [%tasks *(map ship tasks:v1:a)]
        [%set ~zod 'trace-at-1' trace-at-task]
        [%set moon 'trace-every-1' trace-every-task]
        [%del ~zod 'trace-at-1']
        [%del moon 'trace-at-1']
        [%gone ~zod]
        [%gone moon]
    ==
  %+  expect-eq
    !>(all)
  !>((turn all |=(u=update:v1:a (update:dejs:aj (update:enjs:aj u)))))
::
::  +tasks grows the bare ID-keyed object, no wrapper key; its
::  dejs counterpart lives inline in the +update %tasks parser
::
++  test-tasks-grows-ids-as-keys-only
  =/  tasks=tasks:v1:a
    (~(put by *tasks:v1:a) 'map-id' named-task)
  =/  expected=json
    %-  parse-json
    '''
    {
      "map-id": {
        "name": "Named task"
      }
    }
    '''
  (expect-eq !>(expected) !>((tasks:enjs:aj tasks)))
::
::  edit loop codecs
::
++  rid  ^-  request-id:v1:a  `@uv`0x1234.5678
++  rid-json  ^-  json  s+(scot %uv rid)
++  new-task
  ^-  task:v1:a
  :*  ~
      (some 'New task')
      ~
      (some %.y)
      ~
      (some 'isolated')
      (some 'now')
      (some [(some 'agentTurn') (some 'Say hello.')])
      ~
      ~
  ==
++  round-trip-action
  |=  act=a-automation:v1:a
  ^-  a-automation:v1:a
  (a-automation:dejs:aj (a-automation:enjs:aj act))
::
++  test-edit-action-round-trips-all-verbs
  ;:  weld
    %+  expect-eq
      !>(`a-automation:v1:a`[%edit rid ~zod [%create new-task]])
    !>((round-trip-action [%edit rid ~zod [%create new-task]]))
  ::
    %+  expect-eq
      !>(`a-automation:v1:a`[%edit rid ~zod [%update 'job-1' new-task]])
    !>((round-trip-action [%edit rid ~zod [%update 'job-1' new-task]]))
  ::
    %+  expect-eq
      !>(`a-automation:v1:a`[%edit rid ~zod [%delete 'job-1']])
    !>((round-trip-action [%edit rid ~zod [%delete 'job-1']]))
  ==
::
::  the client's action shapes, parsed through the production edit codec
::
++  test-edit-json-shapes
  =/  blank=task:v1:a  empty-task
  =/  create=json
    (parse-json '{"create": {"name": "New task", "enabled": true}}')
  =/  update=json
    (parse-json '{"update": {"id": "job-1", "enabled": false}}')
  =/  delete=json
    (parse-json '{"delete": {"id": "job-1"}}')
  ;:  weld
    %+  expect-eq
      !>(`edit:v1:a`[%create blank(name (some 'New task'), enabled (some %.y))])
    !>((edit:dejs:aj create))
  ::
    %+  expect-eq
      !>(`edit:v1:a`[%update 'job-1' blank(enabled (some %.n))])
    !>((edit:dejs:aj update))
  ::
    %+  expect-eq
      !>(`edit:v1:a`[%delete 'job-1'])
    !>((edit:dejs:aj delete))
  ==
::
++  test-finalize-round-trips-all-bodies
  =/  bodies=(list response-body:v1:a)
    :~  [%created 'job-1']
        [%updated 'job-1']
        [%deleted 'job-1']
        [%error %harness-error ~[leaf+"cron job already exists"]]
        [%error %invalid ~]
        [%pending %acked]
    ==
  %+  roll  bodies
  |=  [body=response-body:v1:a out=tang]
  %+  weld  out
  %+  expect-eq
    !>(`a-automation:v1:a`[%finalize rid body])
  !>((round-trip-action [%finalize rid body]))
::
::  the harness's finalize poke: a type-discriminated body like the
::  notes v1 envelope, with the message as an array of strings
::
++  test-finalize-json-shape
  =/  jon=json
    =,  enjs:format
    %+  frond  'finalize'
    %-  pairs
    :~  ['requestId' rid-json]
        :-  'body'
        %-  pairs
        :~  ['type' s+'error']
            ['errorType' s+'not-found']
            ['message' a+~[s+'no such job']]
        ==
    ==
  %+  expect-eq
    !>(`a-automation:v1:a`[%finalize rid [%error %not-found ~[leaf+"no such job"]]])
  !>((a-automation:dejs:aj jon))
::
++  test-response-grows-request-id-and-typed-body
  =/  expected=json
    =,  enjs:format
    %-  pairs
    :~  ['requestId' rid-json]
        ['body' (pairs ~[['type' s+'created'] ['id' s+'job-1']])]
    ==
  %+  expect-eq
    !>(expected)
  !>((response:enjs:aj [rid [%created 'job-1']]))
::
++  test-response-error-grows-message-as-strings
  =/  expected=json
    =,  enjs:format
    %-  pairs
    :~  ['requestId' rid-json]
        :-  'body'
        %-  pairs
        :~  ['type' s+'error']
            ['errorType' s+'harness-offline']
            ['message' a+~[s+'no harness']]
        ==
    ==
  %+  expect-eq
    !>(expected)
  !>((response:enjs:aj [rid [%error %harness-offline ~[leaf+"no harness"]]]))
::
++  test-dispatch-grows-request-id-and-action
  =/  expected=json
    =,  enjs:format
    %-  pairs
    :~  ['requestId' rid-json]
        ['action' (frond 'delete' (frond 'id' s+'job-1'))]
    ==
  %+  expect-eq
    !>(expected)
  !>((dispatch:enjs:aj [rid [%delete 'job-1']]))
::
++  test-project-still-parses-through-a-automation
  %+  expect-eq
    !>(`a-automation:v1:a`[%project ~])
  !>((a-automation:dejs:aj (parse-json '{"project": {"tasks": []}}')))
--
