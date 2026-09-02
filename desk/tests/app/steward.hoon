::  tests for %steward agent modules
::
/-  s=steward, a=activity, av=activity-ver
/-  l=steward-lens, g=steward-gateway, au=steward-automation
/+  *test-agent, aj=steward-automation-json
/=  agent  /app/steward
|%
++  dap  %steward
::  current state and the released state shape accepted by +on-load
::
+$  state-1
  $:  %1
      owner=(unit ship)
      bots=(set ship)
      lens=state:v1:l
      gateway=state:v1:g
      automation=state:v1:au
  ==
+$  state-0
  $:  %0
      owner=(unit ship)
      bots=(set ship)
      lens=state:v1:l
      gateway=state:v1:g
  ==
::  lens run payloads are opaque $json; a simple value suffices for tests
::
++  payload   ^-  json  s+'run-record'
++  payload2  ^-  json  s+'partial'
++  automation-task
  |=  name=@t
  ^-  task:v1:au
  :*  ~
      `name
      ~
      `&
      ~
      ~
      ~
      ~
      ~
      ~
  ==
++  project-automation
  |=  tasks=(list identified-task:v1:au)
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (do-project tasks)
  (pure:m ~)
++  parse-json
  |=  body=@t
  ^-  json
  (need (de:json:html body))
::  the %project variant's task list, parsed through the production codec
::
++  project-tasks-json
  |=  body=@t
  ^-  (list identified-task:v1:au)
  =/  action=action:v1:au  (action:dejs:aj (parse-json body))
  ?>  ?=(%project -.action)
  tasks.action
++  project-automation-json
  |=  body=@t
  (project-automation (project-tasks-json body))
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
++  trace-tasks-json
  ^-  @t
  '''
  {
      "~dev": {
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
++  reconcile-initial-project-json
  ^-  @t
  '''
  {
    "project": {
      "tasks": [
        {
          "id": "daily-status",
          "agentId": "main",
          "name": "Daily status",
          "enabled": true,
          "schedule": {
            "kind": "cron",
            "expr": "0 9 * * *",
            "tz": "UTC",
            "staggerMs": 0
          },
          "sessionTarget": "isolated",
          "wakeMode": "now",
          "payload": {
            "kind": "agentTurn",
            "message": "Send the daily status."
          },
          "createdAtMs": 1785734000000,
          "updatedAtMs": 1785734000000
        },
        {
          "id": "disabled-reminder",
          "agentId": "main",
          "name": "Paused reminder",
          "enabled": false,
          "schedule": {
            "kind": "every",
            "everyMs": 120000,
            "anchorMs": 1785735243782
          },
          "sessionTarget": "isolated",
          "wakeMode": "now",
          "payload": {
            "kind": "agentTurn",
            "message": "Send the paused reminder."
          },
          "createdAtMs": 1785735243782,
          "updatedAtMs": 1785735243782
        }
      ]
    }
  }
  '''
++  reconcile-initial-tasks-json
  ^-  @t
  '''
  {
      "~dev": {
        "daily-status": {
          "agentId": "main",
          "name": "Daily status",
          "enabled": true,
          "schedule": {
            "kind": "cron",
            "expr": "0 9 * * *",
            "tz": "UTC",
            "staggerMs": 0
          },
          "sessionTarget": "isolated",
          "wakeMode": "now",
          "payload": {
            "kind": "agentTurn",
            "message": "Send the daily status."
          },
          "createdAtMs": 1785734000000,
          "updatedAtMs": 1785734000000
        },
        "disabled-reminder": {
          "agentId": "main",
          "name": "Paused reminder",
          "enabled": false,
          "schedule": {
            "kind": "every",
            "everyMs": 120000,
            "anchorMs": 1785735243782
          },
          "sessionTarget": "isolated",
          "wakeMode": "now",
          "payload": {
            "kind": "agentTurn",
            "message": "Send the paused reminder."
          },
          "createdAtMs": 1785735243782,
          "updatedAtMs": 1785735243782
        }
      }
  }
  '''
++  reconcile-current-project-json
  ^-  @t
  '''
  {
    "project": {
      "tasks": [
        {
          "id": "daily-status",
          "agentId": "main",
          "name": "Daily status updated",
          "enabled": true,
          "schedule": {
            "kind": "cron",
            "expr": "30 9 * * *",
            "tz": "UTC",
            "staggerMs": 0
          },
          "sessionTarget": "isolated",
          "wakeMode": "now",
          "payload": {
            "kind": "agentTurn",
            "message": "Send the updated daily status."
          },
          "createdAtMs": 1785734000000,
          "updatedAtMs": 1785740000000
        },
        {
          "id": "one-shot-reminder",
          "agentId": "main",
          "name": "One-shot reminder",
          "enabled": true,
          "schedule": {
            "kind": "at",
            "at": 1785740301000
          },
          "sessionTarget": "isolated",
          "wakeMode": "now",
          "payload": {
            "kind": "agentTurn",
            "message": "Send the one-shot reminder."
          },
          "createdAtMs": 1785740000000,
          "updatedAtMs": 1785740000000
        }
      ]
    }
  }
  '''
++  reconcile-current-tasks-json
  ^-  @t
  '''
  {
      "~dev": {
        "daily-status": {
          "agentId": "main",
          "name": "Daily status updated",
          "enabled": true,
          "schedule": {
            "kind": "cron",
            "expr": "30 9 * * *",
            "tz": "UTC",
            "staggerMs": 0
          },
          "sessionTarget": "isolated",
          "wakeMode": "now",
          "payload": {
            "kind": "agentTurn",
            "message": "Send the updated daily status."
          },
          "createdAtMs": 1785734000000,
          "updatedAtMs": 1785740000000
        },
        "one-shot-reminder": {
          "agentId": "main",
          "name": "One-shot reminder",
          "enabled": true,
          "schedule": {
            "kind": "at",
            "at": 1785740301000
          },
          "sessionTarget": "isolated",
          "wakeMode": "now",
          "payload": {
            "kind": "agentTurn",
            "message": "Send the one-shot reminder."
          },
          "createdAtMs": 1785740000000,
          "updatedAtMs": 1785740000000
        }
      }
  }
  '''
::
::  our ship in tests is ~dev (set via +setup below). +moon stands in for a
::  remote bot ship; the %entry gate is now an explicit trusted-bots set
::  (not sponsorship), so tests that fan in from it call +trust-moon first.
::
++  moon  ^-  ship  ~doznec-dozzod-dozdev
::
++  scries
  |=  =path
  ^-  (unit vase)
  ?+  path  ~
    [%gu @ %activity @ %$ ~]  `!>(&)
  ==
::
++  setup
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (set-scry-gate scries)
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~dev, src ~dev)))
  ;<  *  bind:m  (do-init dap agent)
  ::  do-init resets the bowl, so set the clock after it
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now ~2024.1.1)))
  (pure:m ~)
::
++  configure
  |=  owner=ship
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%configure owner]))
  (pure:m ~)
::
++  trust
  |=  bot=ship
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%trust-bot bot]))
  (pure:m ~)
::
++  trust-moon
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (trust moon)
  (pure:m ~)
::
::  automation sync fixtures: ~dev doubles as the bot under test (with
::  ~bus configured as its owner) and as the owner mirroring +moon
::
++  moon-tasks-wire  ^-  wire  /automation/tasks/(scot %p moon)
::
++  got-state
  =/  m  (mare ,state-1)
  ^-  form:m
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  (pure:m !<(state-1 !<(vase q.res)))
::
::  the local projection: the local ship's entry, read as empty while
::  the harness has never projected
::
++  local-automation-tasks
  |=  st=state-1
  ^-  tasks:v1:au
  (~(gut by tasks.automation.st) ~dev *tasks:v1:au)
::
++  task-map-of
  |=  entries=(list identified-task:v1:au)
  ^-  tasks:v1:au
  (~(gas by *tasks:v1:au) entries)
::
++  ship-tasks-of
  |=  entries=(list [ship tasks:v1:au])
  ^-  (map ship tasks:v1:au)
  (~(gas by *(map ship tasks:v1:au)) entries)
::
++  do-project
  |=  tasks=(list identified-task:v1:au)
  (do-poke %steward-automation-action-1 !>(`action:v1:au`[%project tasks]))
::
++  do-moon-tasks-sign
  |=  =sign:agent:gall
  (do-agent moon-tasks-wire [moon %steward] sign)
::
++  give-moon-update
  |=  =update:v1:au
  (do-moon-tasks-sign %fact %steward-automation-update-1 !>(update))
::
++  ex-moon-automation-watch
  (ex-task moon-tasks-wire [moon %steward] %watch /v1/automation/tasks)
::
++  ex-moon-automation-leave
  (ex-task moon-tasks-wire [moon %steward] %leave ~)
::
++  ex-tasks-fact
  |=  =update:v1:au
  (ex-fact ~[/v1/automation/tasks] %steward-automation-update-1 !>(update))
::
::  initial watch facts go out on empty paths (new subscriber only)
::
++  ex-tasks-snapshot-fact
  |=  tasks=(map ship tasks:v1:au)
  (ex-fact ~ %steward-automation-update-1 !>(`update:v1:au`[%tasks tasks]))
::
::  the expected delta facts for one ship's entry change, in the
::  agent's emission order: %set per added or changed ID in new-map
::  iteration order, then %del per removed ID in old-map order.
::  deterministic because equal map contents give equal nouns and thus
::  equal +tap order
::
++  ex-delta-facts
  |=  [who=ship old=tasks:v1:au new=tasks:v1:au]
  ^-  (list $-(card tang))
  %+  weld
    ^-  (list $-(card tang))
    %+  murn  ~(tap by new)
    |=  [id=@t t=task:v1:au]
    ^-  (unit $-(card tang))
    ?:  =((~(get by old) id) `t)  ~
    `(ex-tasks-fact %set who id t)
  ^-  (list $-(card tang))
  %+  murn  ~(tap by old)
  |=  [id=@t t=task:v1:au]
  ^-  (unit $-(card tang))
  ?:  (~(has by new) id)  ~
  `(ex-tasks-fact %del who id)
::
++  ga-configure
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%configure ~m5 ~m5]))
  (pure:m ~)
::
++  make-dm-fact
  |=  [sender=ship t=@da]
  ^-  [wire gill:gall sign:agent:gall]
  =/  =message-key:a  [[sender t] t]
  =/  source=source:v9:av  [%dm %ship sender]
  =/  event=event:v9:av
    [[%dm-post message-key [%ship sender] ~[[%inline ~['hello']]] %.n] %.n %.n]
  =/  update=update:v9:av  [%add source t event]
  [/activity [~dev %activity] [%fact %activity-update-5 !>(update)]]
::
++  populate-released-slices
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (configure ~bus)
  ;<  ~  bind:m  trust-moon
  ;<  *  bind:m
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%configure 17]))
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'migrated-run' payload &]))
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%configure ~m7 ~m9]))
  ;<  *  bind:m
    %+  do-poke  %steward-gateway-action-1
    !>(`action:v1:g`[%gateway-start 'migrated-boot' (add ~2024.1.1 ~m3)])
  ;<  *  bind:m  (do-agent (make-dm-fact ~bus (add ~2024.1.1 ~s10)))
  (pure:m ~)
::
++  as-released-state
  |=  current=state-1
  ^-  state-0
  :*  %0
      owner.current
      bots.current
      lens.current
      gateway.current
  ==
::
++  assert-migrated-state
  |=  [old=state-0 current=state-1]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (ex-equal !>(owner.current) !>(owner.old))
  ;<  ~  bind:m  (ex-equal !>(bots.current) !>(bots.old))
  ;<  ~  bind:m  (ex-equal !>(lens.current) !>(lens.old))
  ;<  ~  bind:m  (ex-equal !>(gateway.current) !>(gateway.old))
  (ex-equal !>(tasks.automation.current) !>(*(map ship tasks:v1:au)))
::
::  ==========================================================
::  released state migration tests
::  ==========================================================
::
++  test-migration-preserves-populated-released-state
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  populate-released-slices
  ;<  before-res=cage  bind:m  (got-peek /x/dbug/state)
  =/  before=state-1  !<(state-1 !<(vase q.before-res))
  =/  old=state-0  (as-released-state before)
  ;<  caz=(list card)  bind:m  (do-load agent `!>(old))
  ;<  ~  bind:m  (ex-cards caz ~[ex-eyre-connect (ex-cleanup-timer ~2024.1.1)])
  ;<  after-res=cage  bind:m  (got-peek /x/dbug/state)
  =/  after=state-1  !<(state-1 !<(vase q.after-res))
  (assert-migrated-state old after)
::
++  test-migration-persists-through-current-save-load
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  populate-released-slices
  ;<  before-res=cage  bind:m  (got-peek /x/dbug/state)
  =/  old=state-0
    (as-released-state !<(state-1 !<(vase q.before-res)))
  ;<  *  bind:m  (do-load agent `!>(old))
  ;<  *  bind:m  (do-load agent ~)
  ;<  after-res=cage  bind:m  (got-peek /x/dbug/state)
  =/  after=state-1  !<(state-1 !<(vase q.after-res))
  (assert-migrated-state old after)
::
++  test-migration-malformed-state-fails-without-reset
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  populate-released-slices
  ;<  before-res=cage  bind:m  (got-peek /x/dbug/state)
  =/  before=state-1  !<(state-1 !<(vase q.before-res))
  ;<  ~  bind:m  (ex-fail (do-load agent `!>([%0 'malformed'])))
  ;<  after-res=cage  bind:m  (got-peek /x/dbug/state)
  =/  after=state-1  !<(state-1 !<(vase q.after-res))
  (ex-equal !>(after) !>(before))
::
::  ==========================================================
::  automation module tests
::  ==========================================================
::
++  test-automation-project-populates-id-keyed-map
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  task-a=task:v1:au  (automation-task 'Task A')
  =/  task-b=task:v1:au  (automation-task 'Task B')
  ;<  ~  bind:m  setup
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m
    (ex-equal !>(tasks.automation.st) !>(*(map ship tasks:v1:au)))
  ;<  ~  bind:m
    (project-automation ~[['task-a' task-a] ['task-b' task-b]])
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  =/  expected=(map @t task:v1:au)
    %-  ~(gas by *(map @t task:v1:au))
    ~[['task-a' task-a] ['task-b' task-b]]
  (ex-equal !>((local-automation-tasks st)) !>(expected))
::
++  test-automation-project-repeats-omits-and-clears
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  task-a=task:v1:au  (automation-task 'Task A')
  =/  task-b=task:v1:au  (automation-task 'Task B')
  =/  both=(list identified-task:v1:au)
    ~[['task-a' task-a] ['task-b' task-b]]
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (project-automation both)
  ;<  ~  bind:m  (project-automation both)
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  =/  expected=(map @t task:v1:au)
    %-  ~(gas by *(map @t task:v1:au))
    both
  ;<  ~  bind:m  (ex-equal !>((local-automation-tasks st)) !>(expected))
  ;<  ~  bind:m  (project-automation ~[['task-b' task-b]])
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  =/  expected=(map @t task:v1:au)
    (~(put by *(map @t task:v1:au)) 'task-b' task-b)
  ;<  ~  bind:m  (ex-equal !>((local-automation-tasks st)) !>(expected))
  ;<  ~  bind:m  (project-automation ~)
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ::  a projected-empty entry still exists; +got proves its presence
  (ex-equal !>((~(got by tasks.automation.st) ~dev)) !>(*tasks:v1:au))
::
++  test-automation-project-rejects-duplicate-without-mutation
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  task-a=task:v1:au  (automation-task 'Task A')
  =/  task-b=task:v1:au  (automation-task 'Task B')
  =/  initial=(list identified-task:v1:au)  ~[['task-a' task-a]]
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (project-automation initial)
  ;<  ~  bind:m
    (ex-fail (project-automation ~[['duplicate' task-a] ['duplicate' task-b]]))
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  =/  expected=(map @t task:v1:au)
    (~(put by *(map @t task:v1:au)) 'task-a' task-a)
  (ex-equal !>((local-automation-tasks st)) !>(expected))
::
++  test-automation-project-rejects-foreign-without-mutation
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  task-a=task:v1:au  (automation-task 'Task A')
  =/  initial=(list identified-task:v1:au)  ~[['task-a' task-a]]
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (project-automation initial)
  ;<  ~  bind:m
    %-  ex-fail
    %-  (do-as ~zod)
    (project-automation-json trace-project-json)
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  =/  expected=(map @t task:v1:au)
    (~(put by *(map @t task:v1:au)) 'task-a' task-a)
  (ex-equal !>((local-automation-tasks st)) !>(expected))
::
::  the scry serves its dedicated mark carrying the bare ship-keyed
::  map, the empty state growing to {}
::
++  test-automation-tasks-scry-empty
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  res=cage  bind:m  (got-peek /x/v1/automation/tasks)
  ;<  ~  bind:m
    (ex-equal !>(p.res) !>(%steward-automation-tasks-1))
  =/  actual=(map ship tasks:v1:au)  !<((map ship tasks:v1:au) q.res)
  ;<  ~  bind:m
    (ex-equal !>(actual) !>(*(map ship tasks:v1:au)))
  (ex-equal !>((ship-tasks:enjs:aj actual)) !>((parse-json '{}')))
::
++  test-automation-tasks-scry-populated-json
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  projected=(list identified-task:v1:au)
    (project-tasks-json trace-project-json)
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (project-automation-json trace-project-json)
  ;<  res=cage  bind:m  (got-peek /x/v1/automation/tasks)
  ;<  ~  bind:m
    (ex-equal !>(p.res) !>(%steward-automation-tasks-1))
  =/  actual=(map ship tasks:v1:au)  !<((map ship tasks:v1:au) q.res)
  =/  expected=(map ship tasks:v1:au)
    (ship-tasks-of ~[[~dev (~(gas by *tasks:v1:au) projected)]])
  ;<  ~  bind:m  (ex-equal !>(actual) !>(expected))
  %+  ex-equal
    !>((ship-tasks:enjs:aj actual))
  !>((parse-json trace-tasks-json))
::
++  test-automation-project-persists-through-save-load
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  projected=(list identified-task:v1:au)
    (project-tasks-json trace-project-json)
  =/  expected=(map ship tasks:v1:au)
    (ship-tasks-of ~[[~dev (~(gas by *tasks:v1:au) projected)]])
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (project-automation-json trace-project-json)
  ;<  *  bind:m  (do-load agent ~)
  ;<  res=cage  bind:m  (got-peek /x/v1/automation/tasks)
  ;<  ~  bind:m
    (ex-equal !>(p.res) !>(%steward-automation-tasks-1))
  =/  actual=(map ship tasks:v1:au)  !<((map ship tasks:v1:au) q.res)
  (ex-equal !>(actual) !>(expected))
::
++  assert-automation-tasks-json
  |=  expected=@t
  =/  m  (mare ,~)
  ^-  form:m
  ;<  res=cage  bind:m  (got-peek /x/v1/automation/tasks)
  ;<  ~  bind:m
    (ex-equal !>(p.res) !>(%steward-automation-tasks-1))
  =/  actual=(map ship tasks:v1:au)  !<((map ship tasks:v1:au) q.res)
  (ex-equal !>((ship-tasks:enjs:aj actual)) !>((parse-json expected)))
::
++  test-automation-json-scry-reconciles-and-persists
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m
    (project-automation-json reconcile-initial-project-json)
  ;<  ~  bind:m
    (assert-automation-tasks-json reconcile-initial-tasks-json)
  ;<  *  bind:m  (do-load agent ~)
  ;<  ~  bind:m
    (project-automation-json reconcile-current-project-json)
  ;<  ~  bind:m
    (assert-automation-tasks-json reconcile-current-tasks-json)
  ;<  *  bind:m  (do-load agent ~)
  (assert-automation-tasks-json reconcile-current-tasks-json)
::
::  ==========================================================
::  automation sync tests: bot-side broadcast
::  ==========================================================
::
::  a local subscriber gets exactly one initial snapshot fact, on empty
::  paths, even while the stored projection is empty
::
++  test-automation-tasks-watch-gives-empty-snapshot
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m  (do-watch /v1/automation/tasks)
  (ex-cards caz ~[(ex-tasks-snapshot-fact *(map ship tasks:v1:au))])
::
++  test-automation-tasks-watch-gives-populated-snapshot
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  task-a=task:v1:au  (automation-task 'Task A')
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (project-automation ~[['task-a' task-a]])
  ;<  caz=(list card)  bind:m  (do-watch /v1/automation/tasks)
  %+  ex-cards  caz
  ~[(ex-tasks-snapshot-fact (ship-tasks-of ~[[~dev (task-map-of ~[['task-a' task-a]])]]))]
::
::  a %project that adds, changes, and removes tasks emits exactly the
::  matching %set/%del delta facts naming ~dev on the feed
::
++  test-automation-project-emits-deltas
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  task-a=task:v1:au  (automation-task 'Task A')
  =/  task-a2=task:v1:au  (automation-task 'Task A changed')
  =/  task-b=task:v1:au  (automation-task 'Task B')
  =/  task-c=task:v1:au  (automation-task 'Task C')
  =/  old=tasks:v1:au
    (task-map-of ~[['task-a' task-a] ['task-b' task-b]])
  =/  new=tasks:v1:au
    (task-map-of ~[['task-a' task-a2] ['task-c' task-c]])
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (project-automation ~[['task-a' task-a] ['task-b' task-b]])
  ;<  caz=(list card)  bind:m
    (do-project ~[['task-a' task-a2] ['task-c' task-c]])
  ;<  ~  bind:m  (ex-cards caz (ex-delta-facts ~dev old new))
  ;<  st=state-1  bind:m  got-state
  (ex-equal !>((local-automation-tasks st)) !>(new))
::
::  an equal %project emits no facts and leaves state identical
::
++  test-automation-equal-project-emits-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  task-a=task:v1:au  (automation-task 'Task A')
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (project-automation ~[['task-a' task-a]])
  ;<  before=state-1  bind:m  got-state
  ;<  caz=(list card)  bind:m  (do-project ~[['task-a' task-a]])
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  after=state-1  bind:m  got-state
  (ex-equal !>(after) !>(before))
::
::  the first accepted %project creates the local entry, which is
::  inexpressible as task deltas: subscribers get one fresh full-map
::  snapshot fact on the feed instead
::
++  test-automation-first-project-emits-snapshot
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  task-a=task:v1:au  (automation-task 'Task A')
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m  (do-project ~[['task-a' task-a]])
  %+  ex-cards  caz
  ~[(ex-tasks-fact %tasks (ship-tasks-of ~[[~dev (task-map-of ~[['task-a' task-a]])]]))]
::
::  a first empty %project still creates the local entry, announced to
::  subscribers as a full-map snapshot in which it is present and empty
::
++  test-automation-first-empty-project-creates-local-entry
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m  (do-project ~)
  ;<  ~  bind:m
    (ex-cards caz ~[(ex-tasks-fact %tasks (ship-tasks-of ~[[~dev *tasks:v1:au]]))])
  ;<  st=state-1  bind:m  got-state
  (ex-equal !>((~(got by tasks.automation.st) ~dev)) !>(*tasks:v1:au))
::
::  watch auth: the configured owner is admitted cross-ship and gets the
::  initial snapshot
::
++  test-automation-tasks-watch-admits-configured-owner
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  caz=(list card)  bind:m
    %-  (do-as ~bus)
    (do-watch /v1/automation/tasks)
  (ex-cards caz ~[(ex-tasks-snapshot-fact *(map ship tasks:v1:au))])
::
::  watch auth: a ship that is neither local nor the owner is rejected
::
++  test-automation-tasks-watch-rejects-stranger
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  %-  ex-fail
  %-  (do-as ~zod)
  (do-watch /v1/automation/tasks)
::
::  watch auth: with no owner configured every remote source is rejected
::  (the local baseline is +test-automation-tasks-watch-gives-empty-snapshot)
::
++  test-automation-tasks-watch-rejects-remote-without-owner
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m
    %-  ex-fail
    %-  (do-as ~bus)
    (do-watch /v1/automation/tasks)
  ::  the same owner-less ship still accepts a local subscription
  ::
  ;<  caz=(list card)  bind:m  (do-watch /v1/automation/tasks)
  (ex-cards caz ~[(ex-tasks-snapshot-fact *(map ship tasks:v1:au))])
::
::  replacing the owner kicks the previous owner off the projection feed
::
++  test-automation-configure-kicks-replaced-owner
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  *  bind:m
    %-  (do-as ~bus)
    (do-watch /v1/automation/tasks)
  ;<  caz=(list card)  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%configure ~zod]))
  (ex-cards caz ~[(ex-card %give %kick ~[/v1/automation/tasks] `~bus)])
::
++  test-automation-configure-same-owner-no-kick
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  caz=(list card)  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%configure ~bus]))
  (ex-cards caz ~)
::
::  the local ship is always permitted, so replacing a self-owner kicks
::  nobody
::
++  test-automation-configure-replacing-self-owner-no-kick
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~dev)
  ;<  caz=(list card)  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%configure ~bus]))
  (ex-cards caz ~)
::
::  ==========================================================
::  automation sync tests: owner-side mirror
::  ==========================================================
::
::  %trust-bot subscribes to the bot's projection feed; no mirror entry
::  exists until the first snapshot arrives
::
++  test-automation-trust-bot-subscribes-without-mirror-entry
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%trust-bot moon]))
  ;<  ~  bind:m  (ex-cards caz ~[ex-moon-automation-watch])
  ;<  st=state-1  bind:m  got-state
  (ex-equal !>((~(has by tasks.automation.st) moon)) !>(|))
::
::  re-poking %trust-bot while the subscription is live in wex does not
::  duplicate it
::
++  test-automation-trust-repoke-live-sub-no-duplicate
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  ;<  caz=(list card)  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%trust-bot moon]))
  (ex-cards caz ~)
::
::  a nacked watch leaves wex empty, so a %trust-bot re-poke repairs the
::  subscription
::
++  test-automation-trust-repoke-after-nack-resubscribes
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  ;<  caz=(list card)  bind:m
    (do-moon-tasks-sign %watch-ack `~[leaf+"denied"])
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  caz=(list card)  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%trust-bot moon]))
  (ex-cards caz ~[ex-moon-automation-watch])
::
::  trusting the local ship never self-subscribes; the our entry is
::  %project-owned and untouched
::
++  test-automation-trust-local-ship-no-subscription
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  task-a=task:v1:au  (automation-task 'Task A')
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (project-automation ~[['task-a' task-a]])
  ;<  caz=(list card)  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%trust-bot ~dev]))
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  st=state-1  bind:m  got-state
  ;<  ~  bind:m
    (ex-equal !>((local-automation-tasks st)) !>((task-map-of ~[['task-a' task-a]])))
  ;<  b=bowl  bind:m  get-bowl
  %+  ex-equal
    !>((~(has by wex.b) [/automation/tasks/(scot %p ~dev) ~dev %steward]))
  !>(|)
::
::  %untrust-bot of a mirrored bot leaves the subscription, deletes the
::  entry, and tells clients it is gone
::
++  test-automation-untrust-leaves-clears-and-gones
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  task-a=task:v1:au  (automation-task 'Task A')
  =/  tasks=tasks:v1:au  (task-map-of ~[['task-a' task-a]])
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  ;<  *  bind:m  (give-moon-update %tasks (ship-tasks-of ~[[moon tasks]]))
  ;<  caz=(list card)  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%untrust-bot moon]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  ex-moon-automation-leave
        (ex-tasks-fact %gone moon)
    ==
  ;<  st=state-1  bind:m  got-state
  (ex-equal !>((~(has by tasks.automation.st) moon)) !>(|))
::
::  untrust before the first snapshot: leave, but no entry was ever
::  created, so no %gone
::
++  test-automation-untrust-before-snapshot-leaves-without-gone
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  ;<  caz=(list card)  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%untrust-bot moon]))
  ;<  ~  bind:m  (ex-cards caz ~[ex-moon-automation-leave])
  ;<  st=state-1  bind:m  got-state
  (ex-equal !>((~(has by tasks.automation.st) moon)) !>(|))
::
::  untrusting the local ship is an automation no-op: no leave, no
::  %gone, the our entry untouched
::
++  test-automation-untrust-local-ship-noop
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  task-a=task:v1:au  (automation-task 'Task A')
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (project-automation ~[['task-a' task-a]])
  ;<  caz=(list card)  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%untrust-bot ~dev]))
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  st=state-1  bind:m  got-state
  (ex-equal !>((local-automation-tasks st)) !>((task-map-of ~[['task-a' task-a]])))
::
::  a snapshot fact creates the entry (announced to subscribers as a
::  fresh full-map snapshot) and a later snapshot atomically replaces
::  it, dropping tasks absent from the snapshot and re-emitting the
::  change as deltas naming the bot
::
++  test-automation-snapshot-creates-and-replaces-entry
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  task-a=task:v1:au  (automation-task 'Task A')
  =/  task-b=task:v1:au  (automation-task 'Task B')
  =/  initial=tasks:v1:au
    (task-map-of ~[['task-a' task-a] ['task-b' task-b]])
  =/  replaced=tasks:v1:au  (task-map-of ~[['task-b' task-b]])
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  ;<  caz=(list card)  bind:m
    (give-moon-update %tasks (ship-tasks-of ~[[moon initial]]))
  ;<  ~  bind:m
    (ex-cards caz ~[(ex-tasks-fact %tasks (ship-tasks-of ~[[moon initial]]))])
  ;<  st=state-1  bind:m  got-state
  ;<  ~  bind:m
    (ex-equal !>((~(got by tasks.automation.st) moon)) !>(initial))
  ;<  caz=(list card)  bind:m
    (give-moon-update %tasks (ship-tasks-of ~[[moon replaced]]))
  ;<  ~  bind:m  (ex-cards caz (ex-delta-facts moon initial replaced))
  ;<  st=state-1  bind:m  got-state
  (ex-equal !>((~(got by tasks.automation.st) moon)) !>(replaced))
::
::  an unchanged snapshot produces no client facts
::
++  test-automation-unchanged-snapshot-emits-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  task-a=task:v1:au  (automation-task 'Task A')
  =/  tasks=tasks:v1:au  (task-map-of ~[['task-a' task-a]])
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  ;<  *  bind:m  (give-moon-update %tasks (ship-tasks-of ~[[moon tasks]]))
  ;<  caz=(list card)  bind:m  (give-moon-update %tasks (ship-tasks-of ~[[moon tasks]]))
  (ex-cards caz ~)
::
::  %set upserts and %del removes, each re-emitted to clients attributed
::  to the bot; the mirror converges on the bot's projection
::
++  test-automation-bot-deltas-converge-mirror
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  task-a=task:v1:au  (automation-task 'Task A')
  =/  task-a2=task:v1:au  (automation-task 'Task A changed')
  =/  task-b=task:v1:au  (automation-task 'Task B')
  =/  initial=tasks:v1:au  (task-map-of ~[['task-a' task-a]])
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  ;<  *  bind:m  (give-moon-update %tasks (ship-tasks-of ~[[moon initial]]))
  ;<  caz=(list card)  bind:m  (give-moon-update %set moon 'task-b' task-b)
  ;<  ~  bind:m
    (ex-cards caz ~[(ex-tasks-fact %set moon 'task-b' task-b)])
  ;<  caz=(list card)  bind:m  (give-moon-update %set moon 'task-a' task-a2)
  ;<  ~  bind:m
    (ex-cards caz ~[(ex-tasks-fact %set moon 'task-a' task-a2)])
  ;<  caz=(list card)  bind:m  (give-moon-update %del moon 'task-a')
  ;<  ~  bind:m  (ex-cards caz ~[(ex-tasks-fact %del moon 'task-a')])
  ;<  st=state-1  bind:m  got-state
  %+  ex-equal
    !>((~(got by tasks.automation.st) moon))
  !>((task-map-of ~[['task-b' task-b]]))
::
::  %del of an ID that is not mirrored is a no-op with no facts
::
++  test-automation-del-unknown-id-is-noop
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  task-a=task:v1:au  (automation-task 'Task A')
  =/  tasks=tasks:v1:au  (task-map-of ~[['task-a' task-a]])
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  ;<  *  bind:m  (give-moon-update %tasks (ship-tasks-of ~[[moon tasks]]))
  ;<  caz=(list card)  bind:m  (give-moon-update %del moon 'missing')
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  st=state-1  bind:m  got-state
  (ex-equal !>((~(got by tasks.automation.st) moon)) !>(tasks))
::
::  a delta for a bot with no mirror entry (no snapshot yet) is ignored
::  rather than creating one
::
++  test-automation-unexpected-mark-fact-crashes
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  %-  ex-fail
  (do-moon-tasks-sign %fact %steward-gateway-update-1 !>(0))
::
++  test-automation-delta-before-snapshot-ignored
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  task-a=task:v1:au  (automation-task 'Task A')
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  ;<  caz=(list card)  bind:m  (give-moon-update %set moon 'task-a' task-a)
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  caz=(list card)  bind:m  (give-moon-update %del moon 'task-a')
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  st=state-1  bind:m  got-state
  (ex-equal !>((~(has by tasks.automation.st) moon)) !>(|))
::
::  a kick while the bot is still trusted resubscribes, and the fresh
::  snapshot repairs the mirror
::
++  test-automation-kick-while-trusted-resubscribes
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  task-a=task:v1:au  (automation-task 'Task A')
  =/  task-b=task:v1:au  (automation-task 'Task B')
  =/  initial=tasks:v1:au  (task-map-of ~[['task-a' task-a]])
  =/  repaired=tasks:v1:au  (task-map-of ~[['task-b' task-b]])
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  ;<  *  bind:m  (give-moon-update %tasks (ship-tasks-of ~[[moon initial]]))
  ;<  caz=(list card)  bind:m  (do-moon-tasks-sign %kick ~)
  ;<  ~  bind:m  (ex-cards caz ~[ex-moon-automation-watch])
  ;<  *  bind:m  (give-moon-update %tasks (ship-tasks-of ~[[moon repaired]]))
  ;<  st=state-1  bind:m  got-state
  (ex-equal !>((~(got by tasks.automation.st) moon)) !>(repaired))
::
::  a kick for a no-longer-trusted bot does not resubscribe. the leave
::  already cleared the harness's wex, so restore the entry to model a
::  kick that raced the leave
::
++  test-automation-kick-after-untrust-no-resubscribe
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  ;<  *  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%untrust-bot moon]))
  ;<  ~  bind:m
    %-  jab-bowl
    |=  b=bowl
    %_  b
      wex  %+  ~(put by wex.b)
             [/automation/tasks/(scot %p moon) moon %steward]
           [& /v1/automation/tasks]
    ==
  ;<  caz=(list card)  bind:m  (do-moon-tasks-sign %kick ~)
  (ex-cards caz ~)
::
::  a watch-nack neither crashes nor disturbs mirrored state (the slog
::  itself is not assertable)
::
++  test-automation-watch-nack-preserves-mirror
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  task-a=task:v1:au  (automation-task 'Task A')
  =/  tasks=tasks:v1:au  (task-map-of ~[['task-a' task-a]])
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  ;<  *  bind:m  (give-moon-update %tasks (ship-tasks-of ~[[moon tasks]]))
  ;<  caz=(list card)  bind:m
    (do-moon-tasks-sign %watch-ack `~[leaf+"denied"])
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  st=state-1  bind:m  got-state
  (ex-equal !>((~(got by tasks.automation.st) moon)) !>(tasks))
::
::  a snapshot lacking the bot's entry deletes it — the wiped-bot
::  repair after kick/resubscribe — re-emitted to subscribers as %gone
::
++  test-automation-snapshot-lacking-entry-clears-it
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  task-a=task:v1:au  (automation-task 'Task A')
  =/  tasks=tasks:v1:au  (task-map-of ~[['task-a' task-a]])
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  ;<  *  bind:m  (give-moon-update %tasks (ship-tasks-of ~[[moon tasks]]))
  ;<  caz=(list card)  bind:m
    (give-moon-update %tasks *(map ship tasks:v1:au))
  ;<  ~  bind:m  (ex-cards caz ~[(ex-tasks-fact %gone moon)])
  ;<  st=state-1  bind:m  got-state
  (ex-equal !>((~(has by tasks.automation.st) moon)) !>(|))
::
::  a %gone fact naming the wire bot deletes its entry and re-emits
::
++  test-automation-bot-gone-deletes-and-reemits
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  task-a=task:v1:au  (automation-task 'Task A')
  =/  tasks=tasks:v1:au  (task-map-of ~[['task-a' task-a]])
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  ;<  *  bind:m  (give-moon-update %tasks (ship-tasks-of ~[[moon tasks]]))
  ;<  caz=(list card)  bind:m  (give-moon-update %gone moon)
  ;<  ~  bind:m  (ex-cards caz ~[(ex-tasks-fact %gone moon)])
  ;<  st=state-1  bind:m  got-state
  (ex-equal !>((~(has by tasks.automation.st) moon)) !>(|))
::
::  content attributed to any ship other than the wire bot is ignored:
::  deltas naming another ship touch neither state nor the feed
::
++  test-automation-foreign-attributed-deltas-ignored
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  task-a=task:v1:au  (automation-task 'Task A')
  =/  task-b=task:v1:au  (automation-task 'Task B')
  =/  tasks=tasks:v1:au  (task-map-of ~[['task-a' task-a]])
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  ;<  *  bind:m  (give-moon-update %tasks (ship-tasks-of ~[[moon tasks]]))
  ;<  caz=(list card)  bind:m  (give-moon-update %set ~zod 'task-b' task-b)
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  caz=(list card)  bind:m  (give-moon-update %del ~zod 'task-a')
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  caz=(list card)  bind:m  (give-moon-update %gone ~zod)
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  st=state-1  bind:m  got-state
  ;<  ~  bind:m
    (ex-equal !>((~(got by tasks.automation.st) moon)) !>(tasks))
  (ex-equal !>((~(has by tasks.automation.st) ~zod)) !>(|))
::
::  a received snapshot mentioning another ship never creates that
::  ship's entry: only the wire bot's entry is taken from the map
::
++  test-automation-foreign-snapshot-entry-not-created
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  task-a=task:v1:au  (automation-task 'Task A')
  =/  task-b=task:v1:au  (automation-task 'Task B')
  =/  moon-tasks=tasks:v1:au  (task-map-of ~[['task-a' task-a]])
  =/  zod-tasks=tasks:v1:au  (task-map-of ~[['task-b' task-b]])
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  ;<  caz=(list card)  bind:m
    (give-moon-update %tasks (ship-tasks-of ~[[moon moon-tasks] [~zod zod-tasks]]))
  ;<  ~  bind:m
    (ex-cards caz ~[(ex-tasks-fact %tasks (ship-tasks-of ~[[moon moon-tasks]]))])
  ;<  st=state-1  bind:m  got-state
  ;<  ~  bind:m
    (ex-equal !>((~(got by tasks.automation.st) moon)) !>(moon-tasks))
  (ex-equal !>((~(has by tasks.automation.st) ~zod)) !>(|))
::
::  a subscriber gets exactly one initial fact carrying the complete
::  ship-keyed state, local and mirrored entries alike
::
++  test-automation-tasks-watch-gives-complete-state
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  task-a=task:v1:au  (automation-task 'Task A')
  =/  task-b=task:v1:au  (automation-task 'Task B')
  =/  local=tasks:v1:au  (task-map-of ~[['task-a' task-a]])
  =/  remote=tasks:v1:au  (task-map-of ~[['task-b' task-b]])
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (project-automation ~[['task-a' task-a]])
  ;<  ~  bind:m  trust-moon
  ;<  *  bind:m  (give-moon-update %tasks (ship-tasks-of ~[[moon remote]]))
  ;<  caz=(list card)  bind:m  (do-watch /v1/automation/tasks)
  %+  ex-cards  caz
  ~[(ex-tasks-snapshot-fact (ship-tasks-of ~[[~dev local] [moon remote]]))]
::
::  self-owned bot: the local projection appears in the initial
::  snapshot under ~dev, with no subscription from the ship to itself
::
++  test-automation-tasks-watch-self-owned-serves-local
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  task-a=task:v1:au  (automation-task 'Task A')
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~dev)
  ;<  ~  bind:m  (project-automation ~[['task-a' task-a]])
  ;<  caz=(list card)  bind:m  (do-watch /v1/automation/tasks)
  ;<  ~  bind:m
    %+  ex-cards  caz
    ~[(ex-tasks-snapshot-fact (ship-tasks-of ~[[~dev (task-map-of ~[['task-a' task-a]])]]))]
  ;<  b=bowl  bind:m  get-bowl
  %+  ex-equal
    !>((~(has by wex.b) [/automation/tasks/(scot %p ~dev) ~dev %steward]))
  !>(|)
::
::  the retired per-bot mirror surface stays gone: the watch path is
::  unknown (a crash even for a local source) and the scry binds no data
::
++  test-automation-mirror-surface-gone
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (ex-fail (do-watch /v1/automation/mirror))
  ;<  res=(unit (unit cage))  bind:m  (get-peek /x/v1/automation/mirror)
  (ex-equal !>(?=([~ ~] res)) !>(&))
::
::  ==========================================================
::  LENS MODULE TESTS
::  ==========================================================
::
++  test-configure-sets-owner
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%configure ~bus]))
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  (ex-equal !>(owner.st) !>(`(unit ship)``~bus))
::
::  a completely foreign ship (not ourselves) must crash the local-only
::  %steward-action-1 (configure) gate
::
++  test-configure-from-foreign-ship-crashes
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  %-  ex-fail
  %-  (do-as ~zod)
  (do-poke %steward-action-1 !>(`action:v1:s`[%configure ~zod]))
::
::  %configure is local-only: a foreign ship must not be able to repoint
::  the owner
::
++  test-configure-from-moon-crashes
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  %-  ex-fail
  %-  (do-as moon)
  (do-poke %steward-action-1 !>(`action:v1:s`[%configure ~bus]))
::
::  a lens run from an untrusted ship crashes the %entry gate
::
++  test-lens-from-foreign-ship-crashes
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  %-  ex-fail
  %-  (do-as ~zod)
  (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'lens-x' payload &]))
::
::  a trusted bot's run is accepted; stored keyed by src (the bot)
::
++  test-lens-from-trusted-bot-accepted
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  ;<  caz=(list card)  bind:m
    %-  (do-as moon)
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'lens-moon' payload &]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  %-  ex-fact
        :*  ~[/v1/lens]
            %steward-lens-update-1
            !>(`update:v1:l`[%entry [moon 'lens-moon'] [& ~2024.1.1 payload]])
        ==
    ==
  ;<  res=cage  bind:m  (got-peek /x/v1/lens/run/(scot %p moon)/lens-moon)
  =+  !<(=update:v1:l q.res)
  (ex-equal !>(update) !>(`update:v1:l`[%entry [moon 'lens-moon'] [& ~2024.1.1 payload]]))
::
::  an untrusted ship's %entry is rejected — sponsorship is not auto-trust
::
++  test-entry-from-untrusted-rejected
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  %-  ex-fail
  %-  (do-as moon)
  (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'no-trust' payload &]))
::
::  %untrust-bot revokes trust; a later %entry from that ship is rejected
::
++  test-untrust-bot-removes-trust
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'while-trusted' payload &]))
  ;<  *  bind:m
    (do-poke %steward-action-1 !>(`action:v1:s`[%untrust-bot moon]))
  %-  ex-fail
  %-  (do-as moon)
  (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'after-untrust' payload &]))
::
::  %trust-bot is self-only — a foreign ship cannot grant itself trust
::
++  test-trust-bot-rejects-foreign-source
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  %-  ex-fail
  %-  (do-as ~zod)
  (do-poke %steward-action-1 !>(`action:v1:s`[%trust-bot ~zod]))
::
::  %untrust-bot is also self-only
::
++  test-untrust-bot-rejects-foreign-source
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  %-  ex-fail
  %-  (do-as ~zod)
  (do-poke %steward-action-1 !>(`action:v1:s`[%untrust-bot ~zod]))
::
::  sending to a non-self owner emits a %steward-lens-action-1 poke
::
++  test-run-final-sends-to-owner
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  caz=(list card)  bind:m
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'lens-1' payload &]))
  %+  ex-cards  caz
  :~  %-  ex-poke
      :*  /lens/send/(scot %p ~bus)/(scot %t 'lens-1')
          [~bus %steward]
          %steward-lens-action-1
          !>(`action:v1:l`[%entry 'lens-1' payload &])
      ==
  ==
::
::  self-owned bot stores directly without a network hop
::
++  test-self-owner-stores-without-network-hop
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~dev)
  ;<  caz=(list card)  bind:m
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'lens-1' payload &]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  %-  ex-fact
        :*  ~[/v1/lens]
            %steward-lens-update-1
            !>(`update:v1:l`[%entry [~dev 'lens-1'] [& ~2024.1.1 payload]])
        ==
    ==
  ;<  res=cage  bind:m  (got-peek /x/v1/lens/run/(scot %p ~dev)/lens-1)
  =+  !<(=update:v1:l q.res)
  (ex-equal !>(update) !>(`update:v1:l`[%entry [~dev 'lens-1'] [& ~2024.1.1 payload]]))
::
::  a poke from a trusted bot is stored keyed by src.bowl (the bot)
::
++  test-action-stores-keyed-by-source
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  ;<  caz=(list card)  bind:m
    %-  (do-as moon)
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'lens-2' payload |]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  %-  ex-fact
        :*  ~[/v1/lens]
            %steward-lens-update-1
            !>(`update:v1:l`[%entry [moon 'lens-2'] [| ~2024.1.1 payload]])
        ==
    ==
  ;<  res=cage  bind:m  (got-peek /x/v1/lens/run/(scot %p moon)/lens-2)
  =+  !<(=update:v1:l q.res)
  (ex-equal !>(update) !>(`update:v1:l`[%entry [moon 'lens-2'] [| ~2024.1.1 payload]]))
::
::  final=& marks the run complete
::
++  test-final-marks-run-complete
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'lens-3' payload |]))
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'lens-3' payload &]))
  ;<  res=cage  bind:m  (got-peek /x/v1/lens/run/(scot %p moon)/lens-3)
  =+  !<(=update:v1:l q.res)
  ?>  ?=(%entry -.update)
  (ex-equal !>(complete.run.entry.update) !>(&))
::
::  a late partial (final=|) arriving after a final (final=&) is dropped
::
++  test-late-event-after-final-is-dropped
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'lens-4' payload &]))
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now ~2024.1.2)))
  ;<  caz=(list card)  bind:m
    %-  (do-as moon)
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'lens-4' payload2 |]))
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  res=cage  bind:m  (got-peek /x/v1/lens/run/(scot %p moon)/lens-4)
  =+  !<(=update:v1:l q.res)
  ?>  ?=(%entry -.update)
  (ex-equal !>(run.entry.update) !>(`run:v1:l`[& ~2024.1.1 payload]))
::
::  retention is count-only: with the cap at 2, a third run for the same bot
::  drops the oldest, regardless of age
::
++  test-runs-pruned-by-count
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  ;<  *  bind:m
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%configure 2]))
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'run-a' payload &]))
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now (add ~2024.1.1 ~m1))))
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'run-b' payload &]))
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now (add ~2024.1.1 ~m2))))
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'run-c' payload &]))
  ;<  res=cage  bind:m  (got-peek /x/v1/lens/recent)
  =+  !<(=update:v1:l q.res)
  ?>  ?=(%recent -.update)
  ;<  ~  bind:m  (ex-equal !>((lent entries.update)) !>(2))
  ::  oldest (run-a) dropped; newest first
  =/  ids  (turn entries.update |=(=entry:v1:l id.entry))
  (ex-equal !>(ids) !>(`(list @t)`~['run-c' 'run-b']))
::
::  %configure sets the per-bot cap and prunes every bot immediately
::
++  test-configure-cap-prunes-existing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'run-a' payload &]))
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now (add ~2024.1.1 ~m1))))
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'run-b' payload &]))
  ;<  *  bind:m
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%configure 1]))
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  (ex-equal !>(~(wyt by runs.lens.st)) !>(1))
::
::  /x/v1/lens/since/[da] returns entries with received >= cutoff, newest
::  first
::
++  test-since-scry-filters-by-cutoff
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'run-a' payload &]))
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now (add ~2024.1.1 ~m1))))
  ;<  *  bind:m
    %-  (do-as moon)
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'run-b' payload &]))
  ;<  res=cage  bind:m
    (got-peek /x/v1/lens/since/(scot %da (add ~2024.1.1 ~m1)))
  =+  !<(=update:v1:l q.res)
  ?>  ?=(%recent -.update)
  ;<  ~  bind:m  (ex-equal !>((lent entries.update)) !>(1))
  ?>  ?=(^ entries.update)
  (ex-equal !>(id.i.entries.update) !>('run-b'))
::
::  an oversized payload (jam > 512KB) is dropped, not stored or facted
::
++  test-oversized-payload-dropped
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  trust-moon
  =/  big=json  [%s `@t`(rap 3 (reap 530.000 'x'))]
  ;<  caz=(list card)  bind:m
    %-  (do-as moon)
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%entry 'big' big &]))
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  run=(unit (unit cage))  bind:m
    (get-peek /x/v1/lens/run/(scot %p moon)/big)
  (ex-equal !>(?=([~ ~] run)) !>(&))
::
::  a retry for a run we host locally (bot == our) emits a %retry-requested
::  fact on /v1/lens for the local gateway to pick up
::
++  test-retry-local-emits-fact
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%retry ~dev 'lens-r']))
  %+  ex-cards  caz
  :~  %-  ex-fact
      :*  ~[/v1/lens]
          %steward-lens-update-1
          !>(`update:v1:l`[%retry-requested 'lens-r' ~dev])
      ==
  ==
::
::  a retry for a bot we own (bot != our) relays cross-ship to that bot's
::  steward
::
++  test-retry-relays-cross-ship
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%retry moon 'lens-r']))
  %+  ex-cards  caz
  :~  %-  ex-poke
      :*  /lens/retry/(scot %p moon)/(scot %t 'lens-r')
          [moon %steward]
          %steward-lens-action-1
          !>(`action:v1:l`[%retry moon 'lens-r'])
      ==
  ==
::
::  a retry from the configured owner (cross-ship) for one of our bots is
::  accepted and emits the local fact
::
++  test-retry-from-owner-accepted
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  caz=(list card)  bind:m
    %-  (do-as ~bus)
    (do-poke %steward-lens-action-1 !>(`action:v1:l`[%retry ~dev 'lens-r']))
  %+  ex-cards  caz
  :~  %-  ex-fact
      :*  ~[/v1/lens]
          %steward-lens-update-1
          !>(`update:v1:l`[%retry-requested 'lens-r' ~bus])
      ==
  ==
::
::  a cross-ship retry (from the owner) must target us — it is never proxied
::  on to a third ship
::
++  test-retry-cross-ship-no-proxy
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  %-  ex-fail
  %-  (do-as ~bus)
  (do-poke %steward-lens-action-1 !>(`action:v1:l`[%retry ~zod 'lens-r']))
::
::  a retry from a foreign ship (neither us nor the configured owner) crashes
::
++  test-retry-from-foreign-crashes
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  %-  ex-fail
  %-  (do-as ~zod)
  (do-poke %steward-lens-action-1 !>(`action:v1:l`[%retry ~dev 'lens-r']))
::
::  fresh initialization uses current state, seeds lens, and starts empty
::
++  test-migration-fresh-initialization
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (set-scry-gate scries)
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~dev, src ~dev)))
  ;<  caz=(list card)  bind:m  (do-init dap agent)
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-task /activity [~dev %activity] %watch /v5)
        ex-eyre-connect
        (ex-cleanup-timer ~2000.1.1)
    ==
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(-.st) !>(%1))
  ;<  ~  bind:m
    (ex-equal !>(max-runs-per-bot.lens.st) !>(`@ud`3.000))
  (ex-equal !>(tasks.automation.st) !>(*(map ship tasks:v1:au)))
::
++  test-watch-rejects-foreign-ship
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  %-  ex-fail
  %-  (do-as ~zod)
  (do-watch /v1/lens)
::  the gateway path's local-only guard is per-path code since the
::  automation change; it needs its own rejection coverage
::
++  test-watch-rejects-foreign-ship-gateway
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  %-  ex-fail
  %-  (do-as ~zod)
  (do-watch /v1/gateway)
::  ==========================================================
::  GATEWAY MODULE TESTS
::  ==========================================================
::
::  after setup+configure+ga-configure the gateway has an owner and timing.
::  lifecycle pokes use %steward-gateway-action-1.
::
++  setup-gateway
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  ~  bind:m  ga-configure
  (pure:m ~)
::
++  test-gw-configure-sets-timing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(active-window.gateway.st) !>(~m5))
  (ex-equal !>(reply-cooldown.gateway.st) !>(~m5))
::
++  test-gw-lifecycle-poke-crashes-without-owner
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  ga-configure
  (ex-fail (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' (add ~2024.1.1 ~m2)])))
::
++  test-gw-start-sets-status-up
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  =/  lease-time  (add ~2024.1.1 ~s90)
  ;<  caz=(list card)  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' lease-time]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-arvo /gateway/lease-check %b %wait lease-time)
        (ex-fact-paths ~[/v1/gateway])
    ==
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(status.gateway.st) !>(%up))
  (ex-equal !>(lease-until.gateway.st) !>(`lease-time))
::
++  test-gw-heartbeat-restores-up-after-expiry
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  =/  lease-time  (add ~2024.1.1 ~s90)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' lease-time]))
  ;<  ~  bind:m  (wait ~s91)
  ;<  *  bind:m  (do-arvo /gateway/lease-check [%behn %wake ~])
  =/  new-lease  (add ~2024.1.1 ~m5)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-heartbeat 'boot-1' new-lease]))
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(status.gateway.st) !>(%up))
  ;<  ~  bind:m  (ex-equal !>(pending-restart.gateway.st) !>(|))
  (ex-equal !>(lease-until.gateway.st) !>(`new-lease))
::
++  test-gw-stop-sets-down
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  =/  lease-time  (add ~2024.1.1 ~m2)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' lease-time]))
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-stop 'boot-1' 'test']))
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(status.gateway.st) !>(%down))
  (ex-equal !>(pending-restart.gateway.st) !>(&))
::
++  test-gw-stale-stop-ignored
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  =/  lease-time  (add ~2024.1.1 ~m2)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' lease-time]))
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-stop 'boot-old' 'stale']))
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(status.gateway.st) !>(%up))
  ;<  ~  bind:m  (ex-equal !>(boot-id.gateway.st) !>(`'boot-1'))
  (ex-equal !>(pending-restart.gateway.st) !>(|))
::
++  test-gw-stale-heartbeat-after-stop-ignored
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  =/  lease-time  (add ~2024.1.1 ~m2)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' lease-time]))
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-stop 'boot-1' 'shutdown']))
  =/  new-lease  (add ~2024.1.1 ~m5)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-heartbeat 'boot-1' new-lease]))
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(status.gateway.st) !>(%down))
  ;<  ~  bind:m  (ex-equal !>(boot-id.gateway.st) !>(~))
  (ex-equal !>(pending-restart.gateway.st) !>(&))
::
++  test-gw-lease-expiry
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  =/  lease-time  (add ~2024.1.1 ~s90)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' lease-time]))
  ;<  ~  bind:m  (wait ~s91)
  ;<  *  bind:m  (do-arvo /gateway/lease-check [%behn %wake ~])
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(status.gateway.st) !>(%down))
  (ex-equal !>(pending-restart.gateway.st) !>(&))
::
++  test-gw-owner-dm-while-down-sends-reply
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  ::  gateway is %down (never started)
  ;<  caz=(list card)  bind:m  (do-agent (make-dm-fact ~bus ~2024.1.1))
  %+  ex-cards  caz
  :~  (ex-fact-paths ~[/v1/gateway])
      (ex-poke-wire /gateway/dm/send)
      (ex-fact-paths ~[/v1/gateway])
  ==
::
++  test-gw-owner-dm-while-healthy-no-reply
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  =/  lease-time  (add ~2024.1.1 ~m2)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' lease-time]))
  ;<  caz=(list card)  bind:m  (do-agent (make-dm-fact ~bus ~2024.1.1))
  %+  ex-cards  caz
  :~  (ex-fact-paths ~[/v1/gateway])
  ==
::
++  test-gw-non-owner-dm-ignored
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  ;<  caz=(list card)  bind:m  (do-agent (make-dm-fact ~zod ~2024.1.1))
  (ex-cards caz ~)
::
++  test-gw-self-message-ignored
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~dev)
  ;<  ~  bind:m  ga-configure
  ;<  caz=(list card)  bind:m  (do-agent (make-dm-fact ~dev ~2024.1.1))
  (ex-cards caz ~)
::
++  test-gw-dedupe-same-message-key
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  ;<  caz=(list card)  bind:m  (do-agent (make-dm-fact ~bus ~2024.1.1))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-fact-paths ~[/v1/gateway])
        (ex-poke-wire /gateway/dm/send)
        (ex-fact-paths ~[/v1/gateway])
    ==
  ;<  ~  bind:m  (wait ~m6)
  ;<  caz=(list card)  bind:m  (do-agent (make-dm-fact ~bus ~2024.1.1))
  %+  ex-cards  caz
  :~  (ex-fact-paths ~[/v1/gateway])
  ==
::
++  test-gw-cooldown-suppresses-second-reply
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  ;<  caz=(list card)  bind:m  (do-agent (make-dm-fact ~bus ~2024.1.1))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-fact-paths ~[/v1/gateway])
        (ex-poke-wire /gateway/dm/send)
        (ex-fact-paths ~[/v1/gateway])
    ==
  ;<  ~  bind:m  (wait ~s1)
  =/  t2  (add ~2024.1.1 ~s1)
  ;<  caz=(list card)  bind:m  (do-agent (make-dm-fact ~bus t2))
  %+  ex-cards  caz
  :~  (ex-fact-paths ~[/v1/gateway])
  ==
::
++  test-gw-start-clears-pending-restart
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  =/  lease-time  (add ~2024.1.1 ~m2)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' lease-time]))
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-stop 'boot-1' 'test']))
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(pending-restart.gateway.st) !>(&))
  =/  lease-time-2  (add ~2024.1.1 ~m4)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-2' lease-time-2]))
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(status.gateway.st) !>(%up))
  (ex-equal !>(pending-restart.gateway.st) !>(|))
::
++  test-gw-scry-status
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup-gateway
  =/  lease-time  (add ~2024.1.1 ~m2)
  ;<  *  bind:m
    (do-poke %steward-gateway-action-1 !>(`action:v1:g`[%gateway-start 'boot-1' lease-time]))
  ;<  res=cage  bind:m  (got-peek /x/v1/gateway/status)
  =+  !<([=status:v1:g lut=(unit @da)] q.res)
  ;<  ~  bind:m  (ex-equal !>(status) !>(%up))
  (ex-equal !>(lut) !>(`lease-time))
::
::  ==========================================================
::  automation edit loop
::  ==========================================================
::
::  ~dev is the bot when ~bus is its configured owner, and the owner
::  when editing +moon's tasks. .rid is a fixed request id; every edit
::  creates one task
::
++  rid  ^-  request-id:v1:au  `@uv`0x1234.5678
++  edit-create  ^-  edit:v1:au  [%create (automation-task 'New task')]
++  created  ^-  response-body:v1:au  [%created 'job-1']
++  req-wire
  |=  [bot=ship kind=@ta]
  ^-  wire
  /automation/req/(scot %p bot)/(scot %uv rid)/[kind]
++  req-path
  |=  requester=ship
  ^-  path
  /v1/automation/request/(scot %p requester)/(scot %uv rid)
++  local-req-path  ^-  path  /v1/automation/request/(scot %uv rid)
++  harness-path  ^-  path  /v1/automation/harness
++  cleanup-wire  ^-  wire  /automation/cleanup
::
++  do-edit
  |=  [bot=ship =edit:v1:au]
  (do-poke %steward-automation-action-1 !>(`action:v1:au`[%edit rid bot edit]))
++  do-command
  |=  =edit:v1:au
  (do-poke %steward-automation-command-1 !>(`c-automation:v1:au`[%edit rid edit]))
++  do-finalize
  |=  body=response-body:v1:au
  (do-poke %steward-automation-action-1 !>(`action:v1:au`[%finalize rid body]))
++  do-req-watch-sign
  |=  [bot=ship =sign:agent:gall]
  (do-agent (req-wire bot %watch) [bot %steward] sign)
++  do-req-poke-sign
  |=  [bot=ship =sign:agent:gall]
  (do-agent (req-wire bot %poke) [bot %steward] sign)
++  do-req-wake
  |=  bot=ship
  (do-arvo (req-wire bot %wake) [%behn %wake ~])
++  do-cleanup-wake
  (do-arvo cleanup-wire [%behn %wake ~])
++  response-fact
  |=  body=response-body:v1:au
  ^-  sign:agent:gall
  [%fact %steward-automation-response-1 !>(`response:v1:au`[rid body])]
::
++  ex-req-watch
  |=  bot=ship
  (ex-task (req-wire bot %watch) [bot %steward] %watch (req-path ~dev))
++  ex-req-poke
  |=  [bot=ship =edit:v1:au]
  %^  ex-task  (req-wire bot %poke)  [bot %steward]
  [%poke %steward-automation-command-1 !>(`c-automation:v1:au`[%edit rid edit])]
++  ex-req-wake
  |=  [bot=ship at=@da]
  (ex-card %pass (req-wire bot %wake) %arvo %b %wait (add at ~s20))
++  ex-req-leave
  |=  bot=ship
  (ex-task (req-wire bot %watch) [bot %steward] %leave ~)
++  ex-local-response
  |=  body=response-body:v1:au
  %^  ex-fact  ~[local-req-path]  %steward-automation-response-1
  !>(`response:v1:au`[rid body])
++  ex-bot-response
  |=  [requester=ship body=response-body:v1:au]
  %^  ex-fact  ~[(req-path requester)]  %steward-automation-response-1
  !>(`response:v1:au`[rid body])
++  ex-dispatch
  |=  [paths=(list path) =edit:v1:au]
  (ex-fact paths %steward-automation-dispatch-1 !>(`dispatch:v1:au`[rid edit]))
++  ex-cleanup-timer
  |=  at=@da
  (ex-card %pass cleanup-wire %arvo %b %wait (add at ~m5))
++  ex-eyre-connect
  (ex-card %pass /eyre/steward %arvo %e %connect [~ /steward] %steward)
++  ex-relay
  |=  [bot=ship =edit:v1:au at=@da]
  ^-  (list $-(card tang))
  ~[(ex-req-watch bot) (ex-req-poke bot edit) (ex-req-wake bot at)]
::
++  got-request
  =/  m  (mare ,incoming-request:v1:au)
  ^-  form:m
  ;<  st=state-1  bind:m  got-state
  (pure:m (~(got by requests.automation.st) rid))
++  got-requests
  =/  m  (mare ,requests:v1:au)
  ^-  form:m
  ;<  st=state-1  bind:m  got-state
  (pure:m requests.automation.st)
++  got-pending
  =/  m  (mare ,pending:v1:au)
  ^-  form:m
  ;<  st=state-1  bind:m  got-state
  (pure:m pending.automation.st)
++  advance-clock
  |=  by=@dr
  (jab-bowl |=(b=bowl b(now (add now.b by))))
::
::  HTTP fixtures
::
++  http-request
  |=  [authenticated=? method=method:http url=@t body=(unit @t)]
  ^-  inbound-request:eyre
  :*  authenticated
      |
      [%ipv4 .127.0.0.1]
      [method url ~ ?~(body ~ `(as-octs:mimes:html u.body))]
  ==
++  do-http
  |=  [eyre-id=@ta req=inbound-request:eyre]
  (do-poke %handle-http-request !>([eyre-id req]))
++  ex-http
  |=  [eyre-id=@ta code=@ud ct=@t body=@t]
  ^-  (list $-(card tang))
  =/  paths=(list path)  ~[/http-response/[eyre-id]]
  :~  %^  ex-fact  paths  %http-response-header
      !>(`response-header:http`[code ~[['content-type' ct]]])
      (ex-fact paths %http-response-data !>(`(unit octs)``(as-octs:mimes:html body)))
      (ex-card %give %kick paths ~)
  ==
++  ex-http-response
  |=  [eyre-id=@ta body=response-body:v1:au]
  ^-  (list $-(card tang))
  %-  ex-http
  :^  eyre-id  200  'application/json'
  (en:json:html (response:enjs:aj [rid body]))
++  edit-url  ^-  @t  '/steward/~/v1/automation'
++  request-url
  ^-  @t
  (crip "/steward/~/v1/automation/request/{(scow %uv rid)}")
++  tasks-url  ^-  @t  '/steward/~/v1/automation/tasks'
++  edit-post-body
  |=  with-rid=?
  ^-  @t
  =/  fields=(list [@t json])
    :~  ['bot' s+(scot %p moon)]
        ['action' (edit:enjs:aj edit-create)]
    ==
  =?  fields  with-rid  [['requestId' s+(scot %uv rid)] fields]
  (en:json:html (pairs:enjs:format fields))
::
::  ----------------------------------------------------------
::  owner side
::  ----------------------------------------------------------
::
::  an edit registers a request and relays it: watch first, then the
::  command poke, then the pending wake
::
++  test-automation-edit-registers-and-relays
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m  (do-edit moon edit-create)
  ;<  ~  bind:m  (ex-cards caz (ex-relay moon edit-create ~2024.1.1))
  ;<  req=incoming-request:v1:au  bind:m  got-request
  ;<  ~  bind:m  (ex-equal !>(bot.req) !>(moon))
  ;<  ~  bind:m  (ex-equal !>(http-id.req) !>(*(unit @ta)))
  ;<  ~  bind:m  (ex-equal !>(poke-status.req) !>(%sending))
  (ex-equal !>(result.req) !>(*(unit response-body:v1:au)))
::
++  test-automation-edit-rejects-foreign-source
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m
    %-  ex-fail
    %-  (do-as ~zod)
    (do-edit moon edit-create)
  ;<  reqs=requests:v1:au  bind:m  got-requests
  (ex-equal !>(reqs) !>(*requests:v1:au))
::
::  a nacked per-request watch is a typed not-authorized response
::
++  test-automation-edit-watch-nack-is-not-authorized
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  why=tang  ~[leaf+"denied"]
  ;<  ~  bind:m  setup
  ;<  *  bind:m  (do-edit moon edit-create)
  ;<  caz=(list card)  bind:m  (do-req-watch-sign moon %watch-ack `why)
  ;<  ~  bind:m
    (ex-cards caz ~[(ex-local-response [%error %not-authorized why])])
  ;<  req=incoming-request:v1:au  bind:m  got-request
  (ex-equal !>(result.req) !>(`[%error %not-authorized why]))
::
++  test-automation-edit-poke-ack-marks-acked
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  (do-edit moon edit-create)
  ;<  caz=(list card)  bind:m  (do-req-poke-sign moon %poke-ack ~)
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  req=incoming-request:v1:au  bind:m  got-request
  (ex-equal !>(poke-status.req) !>(%acked))
::
::  a nacked command is a typed unknown response, and the watch is left
::
++  test-automation-edit-poke-nack-is-unknown
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  why=tang  ~[leaf+"crash"]
  ;<  ~  bind:m  setup
  ;<  *  bind:m  (do-edit moon edit-create)
  ;<  caz=(list card)  bind:m  (do-req-poke-sign moon %poke-ack `why)
  ;<  ~  bind:m
    (ex-cards caz ~[(ex-local-response [%error %unknown why]) (ex-req-leave moon)])
  ;<  req=incoming-request:v1:au  bind:m  got-request
  ;<  ~  bind:m  (ex-equal !>(poke-status.req) !>(%nacked))
  (ex-equal !>(result.req) !>(`[%error %unknown why]))
::
::  the bot's response finalizes the request on the client's path and
::  leaves the bot watch
::
++  test-automation-edit-response-finalizes-and-leaves
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  (do-edit moon edit-create)
  ;<  caz=(list card)  bind:m  (do-req-watch-sign moon (response-fact created))
  ;<  ~  bind:m
    (ex-cards caz ~[(ex-local-response created) (ex-req-leave moon)])
  ;<  req=incoming-request:v1:au  bind:m  got-request
  ;<  ~  bind:m  (ex-equal !>(result.req) !>(`created))
  (ex-equal !>(final-at.req) !>(`~2024.1.1))
::
::  a response naming another request is ignored
::
++  test-automation-edit-response-for-other-id-ignored
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  other=response:v1:au  [`@uv`0xdead created]
  ;<  ~  bind:m  setup
  ;<  *  bind:m  (do-edit moon edit-create)
  ;<  caz=(list card)  bind:m
    (do-req-watch-sign moon %fact %steward-automation-response-1 !>(other))
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  req=incoming-request:v1:au  bind:m  got-request
  (ex-equal !>(result.req) !>(*(unit response-body:v1:au)))
::
::  the wake marks the request pending; a late response still lands
::
++  test-automation-edit-wake-pends-then-late-response-lands
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  (do-edit moon edit-create)
  ;<  caz=(list card)  bind:m  (do-req-wake moon)
  ;<  ~  bind:m  (ex-cards caz ~[(ex-local-response [%pending %sending])])
  ;<  req=incoming-request:v1:au  bind:m  got-request
  ;<  ~  bind:m  (ex-equal !>(result.req) !>(`[%pending %sending]))
  ;<  caz=(list card)  bind:m  (do-req-watch-sign moon (response-fact created))
  ;<  ~  bind:m
    (ex-cards caz ~[(ex-local-response created) (ex-req-leave moon)])
  ;<  req=incoming-request:v1:au  bind:m  got-request
  (ex-equal !>(result.req) !>(`created))
::
++  test-automation-edit-wake-after-terminal-is-silent
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  (do-edit moon edit-create)
  ;<  *  bind:m  (do-req-watch-sign moon (response-fact created))
  ;<  caz=(list card)  bind:m  (do-req-wake moon)
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  req=incoming-request:v1:au  bind:m  got-request
  (ex-equal !>(result.req) !>(`created))
::
::  a client subscribing after the result landed gets it at once; before
::  it lands, nothing; a foreign ship never gets it
::
++  test-automation-edit-local-request-watch-replays-result
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  (do-edit moon edit-create)
  ;<  caz=(list card)  bind:m  (do-watch local-req-path)
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  *  bind:m  (do-req-watch-sign moon (response-fact created))
  ;<  *  bind:m  (do-leave local-req-path)
  ;<  caz=(list card)  bind:m  (do-watch local-req-path)
  %+  ex-cards  caz
  ~[(ex-fact ~ %steward-automation-response-1 !>(`response:v1:au`[rid created]))]
::
++  test-automation-edit-local-request-watch-rejects-foreign
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  (do-edit moon edit-create)
  %-  ex-fail
  %-  (do-as ~zod)
  (do-watch local-req-path)
::
::  sweep: a recent unfetched terminal record survives; an aged one, a
::  pending one past its hour, and a fetched one are evicted; an
::  in-flight record is left for its wake
::
++  test-automation-edit-cleanup-keeps-recent-terminal
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  (do-edit moon edit-create)
  ;<  *  bind:m  (do-req-watch-sign moon (response-fact created))
  ;<  caz=(list card)  bind:m  do-cleanup-wake
  ;<  ~  bind:m  (ex-cards caz ~[(ex-cleanup-timer ~2024.1.1)])
  ;<  reqs=requests:v1:au  bind:m  got-requests
  (ex-equal !>((~(has by reqs) rid)) !>(&))
::
++  test-automation-edit-cleanup-evicts-aged-terminal
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  (do-edit moon edit-create)
  ;<  *  bind:m  (do-req-watch-sign moon (response-fact created))
  ;<  ~  bind:m  (advance-clock ~d2)
  ;<  caz=(list card)  bind:m  do-cleanup-wake
  ;<  ~  bind:m  (ex-cards caz ~[(ex-cleanup-timer (add ~2024.1.1 ~d2))])
  ;<  reqs=requests:v1:au  bind:m  got-requests
  (ex-equal !>(reqs) !>(*requests:v1:au))
::
++  test-automation-edit-cleanup-evicts-pending-after-hour
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  (do-edit moon edit-create)
  ;<  *  bind:m  (do-req-wake moon)
  ;<  ~  bind:m  (advance-clock ~m30)
  ;<  *  bind:m  do-cleanup-wake
  ;<  reqs=requests:v1:au  bind:m  got-requests
  ;<  ~  bind:m  (ex-equal !>((~(has by reqs) rid)) !>(&))
  ;<  ~  bind:m  (advance-clock ~m31)
  ;<  *  bind:m  do-cleanup-wake
  ;<  reqs=requests:v1:au  bind:m  got-requests
  (ex-equal !>(reqs) !>(*requests:v1:au))
::
++  test-automation-edit-cleanup-keeps-in-flight
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  (do-edit moon edit-create)
  ;<  ~  bind:m  (advance-clock ~d2)
  ;<  *  bind:m  do-cleanup-wake
  ;<  reqs=requests:v1:au  bind:m  got-requests
  (ex-equal !>((~(has by reqs) rid)) !>(&))
::
::  ----------------------------------------------------------
::  bot side
::  ----------------------------------------------------------
::
::  only the configured owner may command; a local poke is not the owner
::  unless the owner is this ship
::
++  test-automation-command-requires-owner
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m
    %-  ex-fail
    %-  (do-as ~bus)
    (do-command edit-create)
  ;<  ~  bind:m  (configure ~bus)
  ;<  ~  bind:m
    %-  ex-fail
    %-  (do-as ~zod)
    (do-command edit-create)
  ;<  ~  bind:m  (ex-fail (do-command edit-create))
  ;<  pen=pending:v1:au  bind:m  got-pending
  (ex-equal !>(pen) !>(*pending:v1:au))
::
::  with no harness subscribed the bot refuses at once
::
++  test-automation-command-harness-offline-fails-fast
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  caz=(list card)  bind:m
    %-  (do-as ~bus)
    (do-command edit-create)
  ;<  ~  bind:m
    (ex-cards caz ~[(ex-bot-response ~bus [%error %harness-offline ~])])
  ;<  pen=pending:v1:au  bind:m  got-pending
  (ex-equal !>(pen) !>(*pending:v1:au))
::
::  with a harness subscribed the command is recorded and dispatched
::
++  test-automation-command-dispatches-to-harness
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  caz=(list card)  bind:m  (do-watch harness-path)
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  caz=(list card)  bind:m
    %-  (do-as ~bus)
    (do-command edit-create)
  ;<  ~  bind:m  (ex-cards caz ~[(ex-dispatch ~[harness-path] edit-create)])
  ;<  pen=pending:v1:au  bind:m  got-pending
  =/  expected=pending-command:v1:au  [rid ~bus edit-create ~2024.1.1]
  (ex-equal !>((~(get by pen) rid)) !>(`expected))
::
++  test-automation-finalize-responds-and-drops-pending
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  *  bind:m  (do-watch harness-path)
  ;<  *  bind:m
    %-  (do-as ~bus)
    (do-command edit-create)
  ;<  caz=(list card)  bind:m  (do-finalize created)
  ;<  ~  bind:m  (ex-cards caz ~[(ex-bot-response ~bus created)])
  ;<  pen=pending:v1:au  bind:m  got-pending
  (ex-equal !>(pen) !>(*pending:v1:au))
::
::  a late finalize, long after the owner's wake, still answers
::
++  test-automation-finalize-late-still-responds
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  *  bind:m  (do-watch harness-path)
  ;<  *  bind:m
    %-  (do-as ~bus)
    (do-command edit-create)
  ;<  ~  bind:m  (advance-clock ~m10)
  ;<  caz=(list card)  bind:m  (do-finalize created)
  (ex-cards caz ~[(ex-bot-response ~bus created)])
::
++  test-automation-finalize-unknown-id-ignored
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  caz=(list card)  bind:m  (do-finalize created)
  (ex-cards caz ~)
::
++  test-automation-finalize-rejects-foreign-source
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  %-  ex-fail
  %-  (do-as ~bus)
  (do-finalize created)
::
::  a harness (re)subscribing receives every outstanding command; a
::  foreign ship cannot subscribe
::
++  test-automation-harness-watch-replays-pending
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  *  bind:m  (do-watch harness-path)
  ;<  *  bind:m
    %-  (do-as ~bus)
    (do-command edit-create)
  ;<  *  bind:m  (do-leave harness-path)
  ;<  caz=(list card)  bind:m  (do-watch harness-path)
  (ex-cards caz ~[(ex-dispatch ~ edit-create)])
::
++  test-automation-harness-watch-rejects-foreign
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  %-  ex-fail
  %-  (do-as ~bus)
  (do-watch harness-path)
::
::  the bot's per-request path admits only the owner, on its own path
::
++  test-automation-request-watch-admits-owner-requester-only
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  caz=(list card)  bind:m
    %-  (do-as ~bus)
    (do-watch (req-path ~bus))
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  ~  bind:m
    %-  ex-fail
    %-  (do-as ~zod)
    (do-watch (req-path ~zod))
  %-  ex-fail
  %-  (do-as ~bus)
  (do-watch (req-path ~zod))
::
::  the edit loop never touches the task map
::
++  test-automation-edit-loop-leaves-tasks-untouched
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  task-a=task:v1:au  (automation-task 'Task A')
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~bus)
  ;<  ~  bind:m  (project-automation ~[['task-a' task-a]])
  ;<  *  bind:m  (do-watch harness-path)
  ;<  *  bind:m
    %-  (do-as ~bus)
    (do-command edit-create)
  ;<  *  bind:m  (do-finalize created)
  ;<  st=state-1  bind:m  got-state
  (ex-equal !>((local-automation-tasks st)) !>((task-map-of ~[['task-a' task-a]])))
::
::  a self-owned bot: the owner still pokes the bot (itself); gall would
::  loop the watch and poke back, which the test delivers by hand
::
++  test-automation-self-owned-edit-round-trip
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (configure ~dev)
  ;<  *  bind:m  (do-watch harness-path)
  ;<  caz=(list card)  bind:m  (do-edit ~dev edit-create)
  ;<  ~  bind:m  (ex-cards caz (ex-relay ~dev edit-create ~2024.1.1))
  ;<  caz=(list card)  bind:m  (do-watch (req-path ~dev))
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  caz=(list card)  bind:m  (do-command edit-create)
  ;<  ~  bind:m  (ex-cards caz ~[(ex-dispatch ~[harness-path] edit-create)])
  ;<  caz=(list card)  bind:m  (do-finalize created)
  ;<  ~  bind:m  (ex-cards caz ~[(ex-bot-response ~dev created)])
  ;<  caz=(list card)  bind:m  (do-req-watch-sign ~dev (response-fact created))
  ;<  ~  bind:m
    (ex-cards caz ~[(ex-local-response created) (ex-req-leave ~dev)])
  ;<  req=incoming-request:v1:au  bind:m  got-request
  ;<  ~  bind:m  (ex-equal !>(result.req) !>(`created))
  ;<  pen=pending:v1:au  bind:m  got-pending
  (ex-equal !>(pen) !>(*pending:v1:au))
::
::  ----------------------------------------------------------
::  HTTP surface
::  ----------------------------------------------------------
::
++  test-automation-http-unauthenticated-is-401
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m
    (do-http 'eyre-1' (http-request | %'POST' edit-url `(edit-post-body &)))
  ;<  ~  bind:m  (ex-cards caz (ex-http 'eyre-1' 401 'text/plain' 'unauthorized'))
  ;<  reqs=requests:v1:au  bind:m  got-requests
  (ex-equal !>(reqs) !>(*requests:v1:au))
::
::  a POST registers the request with its eyre id and relays it; the
::  held request completes when the response lands
::
++  test-automation-http-post-holds-then-completes
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m
    (do-http 'eyre-1' (http-request & %'POST' edit-url `(edit-post-body &)))
  ;<  ~  bind:m  (ex-cards caz (ex-relay moon edit-create ~2024.1.1))
  ;<  req=incoming-request:v1:au  bind:m  got-request
  ;<  ~  bind:m  (ex-equal !>(http-id.req) !>(`'eyre-1'))
  ;<  caz=(list card)  bind:m  (do-req-watch-sign moon (response-fact created))
  ;<  ~  bind:m
    %+  ex-cards  caz
    ;:  weld
      `(list $-(card tang))`~[(ex-local-response created)]
      (ex-http-response 'eyre-1' created)
      `(list $-(card tang))`~[(ex-req-leave moon)]
    ==
  ;<  req=incoming-request:v1:au  bind:m  got-request
  (ex-equal !>(http-id.req) !>(*(unit @ta)))
::
::  the wake completes the held request with pending; the late response
::  is stored but does not complete it a second time
::
++  test-automation-http-post-pending-completes-once
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m
    (do-http 'eyre-1' (http-request & %'POST' edit-url `(edit-post-body &)))
  ;<  caz=(list card)  bind:m  (do-req-wake moon)
  ;<  ~  bind:m
    %+  ex-cards  caz
    %+  weld  `(list $-(card tang))`~[(ex-local-response [%pending %sending])]
    (ex-http-response 'eyre-1' [%pending %sending])
  ;<  caz=(list card)  bind:m  (do-req-watch-sign moon (response-fact created))
  ;<  ~  bind:m
    (ex-cards caz ~[(ex-local-response created) (ex-req-leave moon)])
  ;<  req=incoming-request:v1:au  bind:m  got-request
  (ex-equal !>(result.req) !>(`created))
::
++  test-automation-http-post-mints-request-id
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m
    (do-http 'eyre-1' (http-request & %'POST' edit-url `(edit-post-body |)))
  ;<  reqs=requests:v1:au  bind:m  got-requests
  ;<  ~  bind:m  (ex-equal !>(~(wyt by reqs)) !>(1))
  =/  req=incoming-request:v1:au  q:(head ~(tap by reqs))
  ;<  ~  bind:m  (ex-equal !>(bot.req) !>(moon))
  (ex-equal !>(http-id.req) !>(`'eyre-1'))
::
++  test-automation-http-post-malformed-is-400
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m
    (do-http 'eyre-1' (http-request & %'POST' edit-url `'nope'))
  ;<  ~  bind:m  (ex-cards caz (ex-http 'eyre-1' 400 'text/plain' 'invalid json'))
  ;<  caz=(list card)  bind:m
    (do-http 'eyre-2' (http-request & %'POST' edit-url `'{"bot": "~zod"}'))
  ;<  ~  bind:m
    (ex-cards caz (ex-http 'eyre-2' 400 'text/plain' 'missing `action` field'))
  ;<  caz=(list card)  bind:m
    %+  do-http  'eyre-3'
    (http-request & %'POST' edit-url `'{"bot": "~zod", "action": {"explode": {}}}')
  ;<  ~  bind:m  (ex-cards caz (ex-http 'eyre-3' 400 'text/plain' 'malformed action'))
  ;<  reqs=requests:v1:au  bind:m  got-requests
  (ex-equal !>(reqs) !>(*requests:v1:au))
::
++  test-automation-http-wrong-method-is-405
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m
    (do-http 'eyre-1' (http-request & %'GET' edit-url ~))
  (ex-cards caz (ex-http 'eyre-1' 405 'text/plain' 'method not allowed'))
::
::  GET by id returns the record and marks it fetched; unknown is 404
::
++  test-automation-http-get-request
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m
    (do-http 'eyre-1' (http-request & %'GET' request-url ~))
  ;<  ~  bind:m
    (ex-cards caz (ex-http 'eyre-1' 404 'text/plain' 'request not found'))
  ;<  *  bind:m  (do-edit moon edit-create)
  ;<  caz=(list card)  bind:m
    (do-http 'eyre-2' (http-request & %'GET' request-url ~))
  ;<  ~  bind:m  (ex-cards caz (ex-http-response 'eyre-2' [%pending %sending]))
  ;<  *  bind:m  (do-req-watch-sign moon (response-fact created))
  ;<  caz=(list card)  bind:m
    (do-http 'eyre-3' (http-request & %'GET' request-url ~))
  ;<  ~  bind:m  (ex-cards caz (ex-http-response 'eyre-3' created))
  ;<  req=incoming-request:v1:au  bind:m  got-request
  (ex-equal !>(fetched.req) !>(&))
::
++  test-automation-http-get-tasks
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  task-a=task:v1:au  (automation-task 'Task A')
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (project-automation ~[['task-a' task-a]])
  ;<  st=state-1  bind:m  got-state
  ;<  caz=(list card)  bind:m
    (do-http 'eyre-1' (http-request & %'GET' tasks-url ~))
  %+  ex-cards  caz
  %-  ex-http
  :^  'eyre-1'  200  'application/json'
  (en:json:html (ship-tasks:enjs:aj tasks.automation.st))
::
++  test-automation-http-unknown-route-is-404
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m
    (do-http 'eyre-1' (http-request & %'GET' '/steward/~/v1/nope' ~))
  (ex-cards caz (ex-http 'eyre-1' 404 'text/plain' 'not found'))
--
