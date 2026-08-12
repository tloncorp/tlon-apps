::  json conversion helpers for steward automation marks
::
::  pinned OpenClaw exposes the %at schedule's `at` as an ISO string. the
::  normalized Steward boundary deliberately uses integer Unix milliseconds
::  under the same `at` key, so all absolute dates cross this boundary as
::  integers and the TypeScript normalizer owns ISO parsing.
::
/-  a=steward-automation
/+  au=steward-automation
|%
++  dejs
  =,  dejs:format
  |%
  ++  duration
    (cu milliseconds-to-duration:au ni)
  ++  date
    (cu unix-milliseconds-to-date:au ni)
  ++  optional
    |*  [key=@t wit=$-(json *) jon=json]
    ?>  ?=([%o *] jon)
    =/  value  (~(get by p.jon) key)
    ?~  value  ~
    (some (wit u.value))
  ++  schedule
    ::  schedules from OpenClaw use a `kind` field, not a tagged JSON object
    |=  jon=json
    ^-  cron-schedule:v1:a
    ?>  ?=([%o *] jon)
    =/  kind  (so (~(got by p.jon) 'kind'))
    ?:  =('cron' kind)
      :*  %cron
          (optional 'expr' so jon)
          (optional 'tz' so jon)
          (optional 'staggerMs' duration jon)
      ==
    ?:  =('at' kind)
      [%at (optional 'at' date jon)]
    ?:  =('every' kind)
      :*  %every
          (optional 'everyMs' duration jon)
          (optional 'anchorMs' date jon)
      ==
    ~|(bad-schedule-kind+kind !!)
  ++  payload
    |=  jon=json
    ^-  task-payload:v1:a
    :*  (optional 'kind' so jon)
        (optional 'message' so jon)
    ==
  ++  task
    |=  jon=json
    ^-  task:v1:a
    :*  (optional 'agentId' so jon)
        (optional 'name' so jon)
        (optional 'description' so jon)
        (optional 'enabled' bo jon)
        (optional 'schedule' schedule jon)
        (optional 'sessionTarget' so jon)
        (optional 'wakeMode' so jon)
        (optional 'payload' payload jon)
        (optional 'createdAtMs' date jon)
        (optional 'updatedAtMs' date jon)
    ==
  ++  identified-task
    |=  jon=json
    ^-  identified-task:v1:a
    ?>  ?=([%o *] jon)
    =/  id-json=json  (~(got by p.jon) 'id')
    [(so id-json) (task jon)]
  ++  project
    |=  jon=json
    ^-  (list identified-task:v1:a)
    =/  tasks=(list identified-task:v1:a)
      ((ot tasks+(ar identified-task) ~) jon)
    =/  remaining  tasks
    =/  seen=(set @t)  *(set @t)
    |-
    ?~  remaining  tasks
    ?>  !(~(has in seen) id.i.remaining)
    %=  $
      remaining  t.remaining
      seen       (~(put in seen) id.i.remaining)
    ==
  ++  action
    |=  jon=json
    ^-  action:v1:a
    %.  jon
    (of ~[[%project project]])
  ++  task-map
    |=  jon=json
    ^-  task-map:v1:a
    ((ot tasks+(om task) ~) jon)
  --
::
++  enjs
  =,  enjs:format
  |%
  ++  schedule
    |=  schedule=cron-schedule:v1:a
    ^-  json
    ?-  -.schedule
        %cron
      =/  fields=(list [@t json])  ~[['kind' s+'cron']]
      =.  fields  ?~(expr.schedule fields [['expr' s+u.expr.schedule] fields])
      =.  fields  ?~(tz.schedule fields [['tz' s+u.tz.schedule] fields])
      =.  fields
        ?~  stagger.schedule
          fields
        [['staggerMs' (numb (duration-to-milliseconds:au u.stagger.schedule))] fields]
      (pairs fields)
    ::
        %at
      =/  fields=(list [@t json])  ~[['kind' s+'at']]
      =.  fields
        ?~  at.schedule
          fields
        [['at' (numb (date-to-unix-milliseconds:au u.at.schedule))] fields]
      (pairs fields)
    ::
        %every
      =/  fields=(list [@t json])  ~[['kind' s+'every']]
      =.  fields
        ?~  every.schedule
          fields
        [['everyMs' (numb (duration-to-milliseconds:au u.every.schedule))] fields]
      =.  fields
        ?~  anchor.schedule
          fields
        [['anchorMs' (numb (date-to-unix-milliseconds:au u.anchor.schedule))] fields]
      (pairs fields)
    ==
  ++  payload
    |=  payload=task-payload:v1:a
    ^-  json
    =/  fields=(list [@t json])  ~
    =.  fields  ?~(kind.payload fields [['kind' s+u.kind.payload] fields])
    =.  fields  ?~(message.payload fields [['message' s+u.message.payload] fields])
    (pairs fields)
  ++  task
    |=  =task:v1:a
    ^-  json
    =/  fields=(list [@t json])  ~
    =.  fields  ?~(agent-id.task fields [['agentId' s+u.agent-id.task] fields])
    =.  fields  ?~(name.task fields [['name' s+u.name.task] fields])
    =.  fields
      ?~(description.task fields [['description' s+u.description.task] fields])
    =.  fields  ?~(enabled.task fields [['enabled' b+u.enabled.task] fields])
    =.  fields
      ?~(schedule.task fields [['schedule' (schedule u.schedule.task)] fields])
    =.  fields
      ?~  session-target.task
        fields
      [['sessionTarget' s+u.session-target.task] fields]
    =.  fields  ?~(wake-mode.task fields [['wakeMode' s+u.wake-mode.task] fields])
    =.  fields
      ?~(payload.task fields [['payload' (payload u.payload.task)] fields])
    =.  fields
      ?~  created-at.task
        fields
      [['createdAtMs' (numb (date-to-unix-milliseconds:au u.created-at.task))] fields]
    =.  fields
      ?~  updated-at.task
        fields
      [['updatedAtMs' (numb (date-to-unix-milliseconds:au u.updated-at.task))] fields]
    (pairs fields)
  ++  identified-task
    |=  entry=identified-task:v1:a
    ^-  json
    =/  jon=json  (task task.entry)
    ?>  ?=([%o *] jon)
    [%o (~(put by p.jon) 'id' [%s id.entry])]
  ++  action
    |=  =action:v1:a
    ^-  json
    ?-  -.action
        %project
      (frond 'project' (frond 'tasks' a+(turn tasks.action identified-task)))
    ==
  ++  task-map
    |=  tasks=task-map:v1:a
    ^-  json
    (frond 'tasks' [%o (~(run by tasks) task)])
  --
--
