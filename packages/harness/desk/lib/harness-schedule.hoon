::  Transport-independent schedule validation and evidence projection.
::  No Gall effects or inference. The head commits each run before dispatch.
/-  c=harness-cron, h=harness, hh=harness-hand
/+  calendar=harness-cron, reminder=harness-reminder, hl=harness
|%
::
++  maintenance-needed
  |=  [jobs=(map @uv schedule:c) wake=(unit @da) now=@da changed=?]
  ^-  ?
  ?:  changed  &
  ::  An armed deadline includes the busy-job backoff; unrelated traffic must
  ::  not turn an overdue but busy job into continuous authority polling.
  ?^  wake  (lte u.wake now)
  ::  Reloads and consumed timer wakes must re-arm active jobs. Settled jobs
  ::  alone need no timer or read-triggered sweep; effects still authorize live.
  (lien ~(val by jobs) |=(job=schedule:c =(%active state.job)))
::
++  job-value
  |=  job=schedule:c
  ^-  job:c
  :*  kind.job
      timezone.job
      destination.job
      sid.job
      run-sid.job
      expression.job
      pattern.job
      prompt.job
      tools.job
      next.job
      remaining.job
      state.job
      reason.job
      last.job
  ==
::
++  fingerprint
  |=  action=action:c
  ^-  @uvH
  (sham action)
::
++  create
  |=  [action=action:c source=binding:hh tools=(list tool-grant:h) now=@da]
  ^-  schedule:c
  ?>  ?=(%add -.action)
  ?>  enabled.source
  ?>  (lien actors.source |=(actor=@t =(actor actor.action)))
  =/  =job:c
    %*  .  *job:c
      kind  kind.action
      destination  address.source
      sid  sid.source
      run-sid  (cat 3 'schedule-' (scot %uv id.action))
      tools  tools
      state  %active
      reason  ''
      last  ~
    ==
  =.  job  (configure-job args.action job now)
  [binding.action actor.action hand.source (fingerprint action) job]
::
++  configure-job
  |=  [args=json job=job:c now=@da]
  ^-  job:c
  ::  Literal reminders keep both their exact text and source destination.
  ?:  =(%reminder kind.job)
    =/  fields=[at=@t text=@t]
      %.  args
      %-  ot:dejs:format
      ~[at+so:dejs:format text+so:dejs:format]
    ?>  ?=(%o -.args)
    =/  named  (~(get by p.args) 'destination')
    ?>  |(?=(~ named) =(u.named [%s destination.job]))
    ?>  &((gth (met 3 text.fields) 0) (lte (met 3 text.fields) 4.096))
    =/  time  (parse:reminder at.fields now)
    %*  .  job
      timezone  timezone.time
      expression  at.fields
      pattern  *pattern:c
      prompt  text.fields
      next  at.time
      remaining  1
    ==
  ::  Model work either runs once at an exact time or follows a UTC pattern.
  ?>  ?=(%o -.args)
  ?:  (~(has by p.args) 'at')
    =/  fields=[at=@t prompt=@t]
      %.  args
      %-  ot:dejs:format
      ~[at+so:dejs:format prompt+so:dejs:format]
    ?>  &((gth (met 3 prompt.fields) 0) (lte (met 3 prompt.fields) 4.096))
    =/  time  (parse:reminder at.fields now)
    %*  .  job
      timezone  timezone.time
      expression  at.fields
      pattern  *pattern:c
      prompt  prompt.fields
      next  at.time
      remaining  1
    ==
  =/  fields=[schedule=@t timezone=@t prompt=@t runs=@t]
    %.  args
    %-  ot:dejs:format
    :~  schedule+so:dejs:format
        timezone+so:dejs:format
        prompt+so:dejs:format
        runs+so:dejs:format
    ==
  ?>  =('UTC' timezone.fields)
  ?>  &((gth (met 3 prompt.fields) 0) (lte (met 3 prompt.fields) 4.096))
  =/  runs  (number:calendar runs.fields)
  ?>  &((gth runs 0) (lte runs 100))
  =/  pattern  (parse:calendar schedule.fields)
  %*  .  job
    timezone  'UTC'
    expression  schedule.fields
    pattern  pattern
    prompt  prompt.fields
    next  (need (next:calendar pattern now))
    remaining  runs
  ==
::
++  busy
  |=  [job=job:c db=state:hh]
  ^-  ?
  ::  Reservation and admission evidence can arrive separately. Keep a
  ::  reserved input busy until its observation establishes execution state.
  ?:  &(?=(^ last.job) !(~(has by observations.db) u.last.job))  &
  ?|  %+  lien  ~(val by observations.db)
      |=  observation=observation:hh
      ?&  =(run-sid.job binding.observation)
          ?=(?(%queued %running) phase.observation)
      ==
      %+  lien  ~(val by outbox.db)
      |=  publication=publication:hh
      ?&  =(run-sid.job sid.publication)
          ?=(?(%pending %claimed %uncertain) status.publication)
      ==
  ==
::
++  accessible
  |=  [job=schedule:c owner=? binding=@t actor=@t]
  ^-  ?
  |(owner &(=(binding binding.job) =(actor actor.job)))
::
++  editable
  |=  [id=@uv job=schedule:c args=json now=@da]
  ^-  schedule:c
  ::  Creation validation keeps timing future-facing. Identity, grants and
  ::  admission history remain attached to the same conversation.
  =/  source=binding:hh  [hand.job destination.job sid.job ~[actor.job] &]
  =/  next  (create [%add id binding.job actor.job kind.job args] source tools.job now)
  %*  .  next
    run-sid  run-sid.job
    last  last.job
    fingerprint  fingerprint.job
  ==
::
++  retryable
  |=  [job=job:c db=state:hh]
  ^-  ?
  ?.  ?&  =(%prompt kind.job)
          ?=(?(%active %complete) state.job)
          ?=(^ last.job)
      ==
    |
  =/  observation  (~(get by observations.db) u.last.job)
  =/  publication  (~(get by outbox.db) u.last.job)
  ?&  ?=(^ observation)
      =(run-sid.job binding.u.observation)
      =(%failed phase.u.observation)
      ?=(^ publication)
      =(%failure kind.u.publication)
      !(busy job db)
  ==
::
++  retry-session
  |=  [binding=@t session=session:h]
  ^-  ?
  =/  view  (play:hl log.session)
  ?.  ?&  ?=(^ err.view)
          ?=(~ pending.view)
          =(~ wait.view)
          =(~ (open-calls:hl items.view))
      ==
    |
  ::  The most recent input must belong to this run binding. An admission
  ::  without a matching received input cannot establish retry authority.
  =/  events  log.session
  |-
  ^-  ?
  ?~  events  |
  ?:  ?=(%input-admitted -.i.events)  |
  ?.  ?=(%input-received -.i.events)  $(events t.events)
  =/  source  source.input.i.events
  &(?=(%hand -.source) =(binding binding.source))
::
++  clearable
  |=  [job=job:c db=state:hh]
  ^-  ?
  ?.  |(=(%cancelled state.job) &(=(%complete state.job) =(0 remaining.job)))  |
  ?:  (busy job db)  |
  ?~  last.job  =(%cancelled state.job)
  =/  last  (~(get by observations.db) u.last.job)
  ?~  last  |
  =(run-sid.job binding.u.last)
::
++  advance
  |=  [job=schedule:c input=@uv now=@da]
  ^-  schedule:c
  ?>  &(=(%active state.job) (gth remaining.job 0))
  =.  job
    %*  .  job
      remaining  (dec remaining.job)
      last  `input
    ==
  ?:  =(0 remaining.job)  job(state %complete)
  =/  next  (next:calendar pattern.job now)
  ?~  next  job(state %complete)
  job(next (need next))
::
++  for-session
  |=  [jobs=(map @uv schedule:c) sid=@t]
  ^-  (unit schedule:c)
  =/  found  (skim ~(val by jobs) |=(job=schedule:c =(sid run-sid.job)))
  ?~(found ~ `i.found)
::
++  one-json
  |=  [id=@uv job=schedule:c db=state:hh]
  ^-  json
  =/  observation  ?~(last.job ~ (~(get by observations.db) u.last.job))
  =/  publication  ?~(last.job ~ (~(get by outbox.db) u.last.job))
  %-  pairs:enjs:format
  :~  ['id' %s (scot %uv id)]
      ['revision' %s (scot %uv (sham job))]
      ['sessionId' %s sid.job]
      ['runSessionId' %s run-sid.job]
      ['sourceBinding' %s binding.job]
      ['hand' %s hand.job]
      ['actor' %s actor.job]
      ['schedule' %s expression.job]
      ['kind' %s kind.job]
      ['timezone' %s timezone.job]
      ['destination' %s destination.job]
      ['prompt' %s prompt.job]
      ['next' %s (scot %da next.job)]
      ['remaining' (numb:enjs:format remaining.job)]
      ['state' %s state.job]
      ['reason' %s reason.job]
      ['lastInput' ?~(last.job ~ [%s (scot %uv u.last.job)])]
      ['execution' ?~(observation ~ [%s phase.u.observation])]
      ['delivery' ?~(publication ~ [%s status.u.publication])]
      ['evidenceAvailable' %b &]
      ['clearable' %b (clearable (job-value job) db)]
      ['retryable' %b (retryable (job-value job) db)]
  ==
::
++  list-json
  |=  [jobs=(map @uv schedule:c) db=state:hh binding=(unit @t)]
  ^-  json
  :-  %a
  %+  murn  ~(tap by jobs)
  |=  [id=@uv job=schedule:c]
  ^-  (unit json)
  ?.  ?~(binding & =(u.binding binding.job))  ~
  `(one-json id job db)
::
++  json-action
  |=  value=json
  ^-  action:c
  =,  dejs:format
  =/  id  (cu |=(s=@t (need (slaw %uv s))) so)
  %.  value
  %-  of
  :~  add+(ot ~[id+id binding+so actor+so kind+json-kind args+|=(a=json a)])
      list+(ot ~[binding+(mu so)])
      cancel+(ot ~[id+id])
      clear+(ot ~[id+id])
      edit+(ot ~[id+id revision+id args+|=(a=json a)])
      delete+(ot ~[id+id])
      retry+(ot ~[id+id input+id])
  ==
::
++  json-kind
  |=  json=json
  ^-  ?(%prompt %reminder)
  =/  value  (so:dejs:format json)
  ?>  ?=(?(%prompt %reminder) value)
  value
::
++  json-request
  =,  dejs:format
  ^-  $-(json request:c)
  (ot ~[id+so action+json-action])
--
