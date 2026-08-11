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
++  duration-from-json
  =,  dejs:format
  (cu milliseconds-to-duration:au ni)
++  date-from-json
  =,  dejs:format
  (cu unix-milliseconds-to-date:au ni)
++  optional-from-json
  |*  [key=@t wit=$-(json *) jon=json]
  ?>  ?=([%o *] jon)
  =/  value  (~(get by p.jon) key)
  ?~  value  ~
  (some (wit u.value))
++  schedule-from-json
  ::  schedules from OpenClaw use a `kind` field, not a tagged JSON object
  |=  jon=json
  ^-  cron-schedule:v1:a
  ?>  ?=([%o *] jon)
  =,  dejs:format
  =/  kind  (so (~(got by p.jon) 'kind'))
  ?:  =('cron' kind)
    :*  %cron
        (optional-from-json 'expr' so jon)
        (optional-from-json 'tz' so jon)
        (optional-from-json 'staggerMs' duration-from-json jon)
    ==
  ?:  =('at' kind)
    [%at (optional-from-json 'at' date-from-json jon)]
  ?:  =('every' kind)
    :*  %every
        (optional-from-json 'everyMs' duration-from-json jon)
        (optional-from-json 'anchorMs' date-from-json jon)
    ==
  ~|(bad-schedule-kind+kind !!)
++  payload-from-json
  |=  jon=json
  ^-  cron-payload:v1:a
  =,  dejs:format
  :*  (optional-from-json 'kind' so jon)
      (optional-from-json 'text' so jon)
  ==
++  task-from-json
  |=  jon=json
  ^-  task:v1:a
  =,  dejs:format
  :*  (optional-from-json 'agentId' so jon)
      (optional-from-json 'name' so jon)
      (optional-from-json 'description' so jon)
      (optional-from-json 'enabled' bo jon)
      (optional-from-json 'schedule' schedule-from-json jon)
      (optional-from-json 'sessionTarget' so jon)
      (optional-from-json 'wakeMode' so jon)
      (optional-from-json 'payload' payload-from-json jon)
      (optional-from-json 'createdAtMs' date-from-json jon)
      (optional-from-json 'updatedAtMs' date-from-json jon)
  ==
++  identified-task-from-json
  |=  jon=json
  ^-  identified-task:v1:a
  ?>  ?=([%o *] jon)
  =/  id-json=json  (~(got by p.jon) 'id')
  =,  dejs:format
  [(so id-json) (task-from-json jon)]
++  project-from-json
  |=  jon=json
  ^-  (list identified-task:v1:a)
  =,  dejs:format
  =/  tasks=(list identified-task:v1:a)
    ((ot tasks+(ar identified-task-from-json) ~) jon)
  =/  remaining  tasks
  =/  seen=(set @t)  *(set @t)
  |-
  ?~  remaining  tasks
  ?>  !(~(has in seen) id.i.remaining)
  %=  $
    remaining  t.remaining
    seen       (~(put in seen) id.i.remaining)
  ==
++  action-from-json
  |=  jon=json
  ^-  action:v1:a
  =,  dejs:format
  %.  jon
  (of ~[[%project project-from-json]])
++  schedule-to-json
  |=  schedule=cron-schedule:v1:a
  ^-  json
  =,  enjs:format
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
++  payload-to-json
  |=  payload=cron-payload:v1:a
  ^-  json
  =,  enjs:format
  =/  fields=(list [@t json])  ~
  =.  fields  ?~(kind.payload fields [['kind' s+u.kind.payload] fields])
  =.  fields  ?~(text.payload fields [['text' s+u.text.payload] fields])
  (pairs fields)
++  task-to-json
  |=  =task:v1:a
  ^-  json
  =,  enjs:format
  =/  fields=(list [@t json])  ~
  =.  fields  ?~(agent-id.task fields [['agentId' s+u.agent-id.task] fields])
  =.  fields  ?~(name.task fields [['name' s+u.name.task] fields])
  =.  fields
    ?~(description.task fields [['description' s+u.description.task] fields])
  =.  fields  ?~(enabled.task fields [['enabled' b+u.enabled.task] fields])
  =.  fields
    ?~(schedule.task fields [['schedule' (schedule-to-json u.schedule.task)] fields])
  =.  fields
    ?~  session-target.task
      fields
    [['sessionTarget' s+u.session-target.task] fields]
  =.  fields  ?~(wake-mode.task fields [['wakeMode' s+u.wake-mode.task] fields])
  =.  fields
    ?~(payload.task fields [['payload' (payload-to-json u.payload.task)] fields])
  =.  fields
    ?~  created-at.task
      fields
    [['createdAtMs' (numb (date-to-unix-milliseconds:au u.created-at.task))] fields]
  =.  fields
    ?~  updated-at.task
      fields
    [['updatedAtMs' (numb (date-to-unix-milliseconds:au u.updated-at.task))] fields]
  (pairs fields)
++  identified-task-to-json
  |=  entry=identified-task:v1:a
  ^-  json
  =/  jon=json  (task-to-json task.entry)
  ?>  ?=([%o *] jon)
  [%o (~(put by p.jon) 'id' [%s id.entry])]
++  action-to-json
  |=  =action:v1:a
  ^-  json
  =,  enjs:format
  ?-  -.action
      %project
    (frond 'project' (frond 'tasks' a+(turn tasks.action identified-task-to-json)))
  ==
++  task-map-from-json
  |=  jon=json
  ^-  task-map:v1:a
  =,  dejs:format
  ((ot tasks+(om task-from-json) ~) jon)
++  task-map-to-json
  |=  tasks=task-map:v1:a
  ^-  json
  =,  enjs:format
  (frond 'tasks' [%o (~(run by tasks) task-to-json)])
--
