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
  ++  request-id  (se %uv)
  ++  edit
    |=  jon=json
    ^-  edit:v1:a
    %.  jon
    %-  of
    :~  [%create task]
        [%update identified-task]
        [%delete (ot id+so ~)]
    ==
  ::  +response-body: type-discriminated like the %notes v1 envelope, so
  ::  clients switch on body.type
  ::
  ++  response-body
    |=  jon=json
    ^-  response-body:v1:a
    ?>  ?=([%o *] jon)
    =/  type  (so (~(got by p.jon) 'type'))
    ?:  =('created' type)  [%created (so (~(got by p.jon) 'id'))]
    ?:  =('updated' type)  [%updated (so (~(got by p.jon) 'id'))]
    ?:  =('deleted' type)  [%deleted (so (~(got by p.jon) 'id'))]
    ?:  =('pending' type)
      [%pending ;;(poke-status:v1:a (so:dejs:format (~(got by p.jon) 'status')))]
    ?:  =('error' type)
      :+  %error
        ;;(action-error:v1:a (so (~(got by p.jon) 'errorType')))
      =/  message  (~(get by p.jon) 'message')
      ?~  message  ~
      ((ar (cu |=(t=@t leaf+(trip t)) so)) u.message)
    ~|(bad-response-type+type !!)
  ++  a-automation
    |=  jon=json
    ^-  a-automation:v1:a
    %.  jon
    %-  of
    :~  [%project project]
        [%edit (ot 'requestId'^request-id bot+(se %p) action+edit ~)]
        [%finalize (ot 'requestId'^request-id body+response-body ~)]
    ==
  ++  action  a-automation
  ::  +ship-tasks: the bare ship-keyed task-map object
  ::
  ++  ship-tasks
    |=  jon=json
    ^-  (map @p tasks:v1:a)
    ((op ;~(pfix sig fed:ag) (om task)) jon)
  ++  update
    |=  jon=json
    ^-  update:v1:a
    %.  jon
    %-  of
    :~  [%tasks ship-tasks]
        [%set (ot ship+(se %p) id+so task+task ~)]
        [%del (ot ship+(se %p) id+so ~)]
        [%gone (ot ship+(se %p) ~)]
    ==
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
  ++  request-id
    |=  id=request-id:v1:a
    ^-  json
    s+(scot %uv id)
  ++  edit
    |=  =edit:v1:a
    ^-  json
    ?-  -.edit
      %create  (frond 'create' (task task.edit))
      %update  (frond 'update' (identified-task [id task]:edit))
      %delete  (frond 'delete' (frond 'id' s+id.edit))
    ==
  ::  =, enjs:format shadows +tank, so reach past it for the type
  ::
  ++  tang-json
    |=  ts=(list ^tank)
    ^-  json
    :-  %a
    %+  turn  ts
    |=  t=^tank
    s+(crip (zing (join "\0a" (wash [0 80] t))))
  ++  response-body
    |=  body=response-body:v1:a
    ^-  json
    ?-  -.body
        ?(%created %updated %deleted)
      (pairs ~[['type' s+(scot %tas -.body)] ['id' s+id.body]])
    ::
        %error
      %-  pairs
      :~  ['type' s+'error']
          ['errorType' s+(scot %tas type.body)]
          ['message' (tang-json message.body)]
      ==
    ::
        %pending
      (pairs ~[['type' s+'pending'] ['status' s+(scot %tas status.body)]])
    ==
  ++  response
    |=  =response:v1:a
    ^-  json
    (pairs ~[['requestId' (request-id id.response)] ['body' (response-body body.response)]])
  ++  dispatch
    |=  =dispatch:v1:a
    ^-  json
    (pairs ~[['requestId' (request-id id.dispatch)] ['action' (edit edit.dispatch)]])
  ++  a-automation
    |=  =a-automation:v1:a
    ^-  json
    ?-  -.a-automation
        %project
      (frond 'project' (frond 'tasks' a+(turn tasks.a-automation identified-task)))
    ::
        %edit
      %+  frond  'edit'
      %-  pairs
      :~  ['requestId' (request-id request-id.a-automation)]
          ['bot' s+(scot %p bot.a-automation)]
          ['action' (edit edit.a-automation)]
      ==
    ::
        %finalize
      %+  frond  'finalize'
      %-  pairs
      :~  ['requestId' (request-id request-id.a-automation)]
          ['body' (response-body body.a-automation)]
      ==
    ==
  ++  action  a-automation
  ::  +tasks: the bare ID-keyed task object, without a wrapper key
  ::
  ++  tasks
    |=  tasks=tasks:v1:a
    ^-  json
    [%o (~(run by tasks) task)]
  ::  +ship-tasks: the bare ship-keyed task-map object
  ::
  ++  ship-tasks
    |=  all=(map @p tasks:v1:a)
    ^-  json
    %-  pairs
    %+  turn  ~(tap by all)
    |=  [who=@p ts=tasks:v1:a]
    [(scot %p who) (tasks ts)]
  ++  update
    |=  =update:v1:a
    ^-  json
    ?-  -.update
        %tasks
      (frond 'tasks' (ship-tasks tasks.update))
    ::
        %set
      %+  frond  'set'
      %-  pairs
      :~  ['ship' s+(scot %p ship.update)]
          ['id' s+id.update]
          ['task' (task task.update)]
      ==
    ::
        %del
      %+  frond  'del'
      %-  pairs
      :~  ['ship' s+(scot %p ship.update)]
          ['id' s+id.update]
      ==
    ::
        %gone
      (frond 'gone' (frond 'ship' s+(scot %p ship.update)))
    ==
  --
--
