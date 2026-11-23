::  Steward's automation module, played by the Tlon hand: the owner's Tlon
::  schedules as Steward tasks, and a Steward edit as head schedule actions.
::  Pure; the hand sends the actions and the answers.
/-  t=harness-tlon, cr=harness-cron, sa=steward-automation
/+  p=harness-tlon-policy, calendar=harness-cron, reminder=harness-reminder,
    zones=harness-zones
|%
+$  refusal  [type=action-error:v1:sa message=@t]
::  +owned: a schedule Steward mirrors, the owner's own on the Tlon hand.
::  Other hands' schedules and other actors' never leave Harness.
::
++  owned
  |=  [job=schedule:cr owner=@p]
  ^-  ?
  &(=('tlon' hand.job) =((scot %p owner) actor.job))
::
::  +once: a job that runs at one instant; recurring jobs always have a
::  pattern, since a cron field cannot be empty
::
++  once
  |=  job=schedule:cr
  ^-  ?
  =(*pattern:cr pattern.job)
::
++  project
  |=  [schedules=(map @uv schedule:cr) names=(map @uv task-names:t) owner=@p]
  ^-  (list identified-task:v1:sa)
  %+  sort
    %+  murn  ~(tap by schedules)
    |=  [id=@uv job=schedule:cr]
    ^-  (unit identified-task:v1:sa)
    ?.  (owned job owner)  ~
    `[(scot %uv id) (task job (~(gut by names) id *task-names:t))]
  |=([a=identified-task:v1:sa b=identified-task:v1:sa] (aor id.a id.b))
::
::  +task: what Steward may know of a schedule. Tool grants, fingerprints and
::  run bookkeeping have no task field and stay out. A cancelled or finished
::  job is still a task, shown disabled, so the owner can see and delete it.
::
++  task
  |=  [job=schedule:cr names=task-names:t]
  ^-  task:v1:sa
  :*  agent-id=~
      name=?^(name.names name.names (title prompt.job))
      description=description.names
      enabled=`=(%active state.job)
      schedule=`?:((once job) [%at `next.job] [%cron `expression.job `(fall zone.names timezone.job) ~])
      session-target=~
      wake-mode=~
      ::  A reminder publishes its text without inference. Of OpenClaw's
      ::  kinds that is closest to a system event, not an agent turn.
      payload=`[`?:(=(%reminder kind.job) 'systemEvent' 'agentTurn') `prompt.job ~]
      delivery=`[`%announce `'tlon' `(target destination.job) ~ ~]
      created-at=~
      updated-at=~
  ==
::
::  +title: a job's first line, for a job that has no name
::
++  title
  |=  prompt=@t
  ^-  (unit @t)
  =/  chars  (strip (trip prompt))
  =/  line  (scag (fall (find "\0a" chars) (lent chars)) chars)
  =/  cut=tape  (flop (strip (flop (tufa (scag 64 (tuba line))))))
  ?~(cut ~ `(crip cut))
::
++  strip
  |=  chars=tape
  ^-  tape
  ?~  chars  ~
  ?:  (lte i.chars ' ')  $(chars t.chars)
  chars
::
::  +target: a Tlon address as a task's delivery.to, the form Messenger
::  writes: a ship for a DM, a nest for a channel, either without a thread
::
++  target
  |=  address=@t
  ^-  @t
  =/  parts  (split:calendar address '/')
  ?:  =('dm' (snag 0 parts))  (snag 1 parts)
  (rap 3 (snag 0 parts) '/' (snag 1 parts) '/' (snag 2 parts) ~)
::
::  +conversation: a delivery.to back to a top-level destination
::
++  conversation
  |=  to=@t
  ^-  (unit destination:t)
  =/  parts  (split:calendar to '/')
  ?:  ?=([@ ~] parts)
    (bind (slaw %p i.parts) |=(who=@p [%dm who ~]))
  ?:  ?=([%dm @ ~] parts)
    (bind (slaw %p i.t.parts) |=(who=@p [%dm who ~]))
  ?.  ?=([@ @ @ ~] parts)  ~
  =/  host  (slaw %p i.t.parts)
  ?~  host  ~
  ?.  ((sane %tas) i.t.t.parts)  ~
  =/  name  (@tas i.t.t.parts)
  ?+  i.parts  ~
    %chat   `[%channel [%chat u.host name] ~]
    %heap   `[%channel [%heap u.host name] ~]
    %diary  `[%channel [%diary u.host name] ~]
  ==
::
::  +deliver: where a task's delivery sends its runs. The hand posts only
::  into Tlon conversations, the owner's DM unless the task names another.
::
++  deliver
  |=  [delivery=(unit delivery:v1:sa) owner=@p]
  ^-  (each destination:t @t)
  =/  dm=destination:t  [%dm owner ~]
  ?~  delivery  [%& dm]
  =/  d  u.delivery
  ?:  =(`%webhook mode.d)  [%| 'webhook delivery is not supported; deliver to a Tlon conversation']
  ?^  failure-destination.d  [%| 'a separate failure destination is not supported']
  ?:  =(`%none mode.d)  [%& dm]
  ?.  |(?=(~ channel.d) =(`'tlon' channel.d))  [%| 'only Tlon delivery is supported']
  ?~  to.d  [%| 'delivery.to is required']
  =/  found  (conversation u.to.d)
  ?~  found  [%| (cat 3 'delivery.to is not a ship or channel: ' u.to.d)]
  ?:  &(?=(%dm -.u.found) !=(owner who.u.found))
    [%| 'a task delivers only to the owner\'s DM or a channel']
  [%& u.found]
::
::  +timing: a Steward schedule as head job arguments, with the zone name
::  to keep when the job's offset came from the zone table
::
++  timing
  |=  [schedule=cron-schedule:v1:sa reminder=? message=@t runs=@ud]
  ^-  (each [args=json zone=(unit @t)] @t)
  =/  text-key  ?:(reminder 'text' 'prompt')
  ?-  -.schedule
      %every
    [%| 'every schedules are not supported; use a cron expression or a time']
  ::
      %at
    ?~  at.schedule  [%| 'schedule.at is required']
    :+  %&
      (pairs:enjs:format ~[['at' %s (stamp u.at.schedule)] [text-key %s message]])
    ~
  ::
      %cron
    ?:  reminder  [%| 'a reminder runs once; give it a time, not a cron expression']
    ?~  expr.schedule  [%| 'schedule.expr is required']
    =/  zone  (offset tz.schedule)
    ?:  ?=(%| -.zone)  [%| p.zone]
    :+  %&
      %-  pairs:enjs:format
      :~  ['schedule' %s u.expr.schedule]
          ['timezone' %s offset.p.zone]
          [text-key %s message]
          ['runs' %s (crip (a-co:co runs))]
      ==
    name.p.zone
  ==
::
::  +offset: the scheduler's timezone for a task's tz, and the zone name to
::  remember when it came from the table. Absent means UTC; an offset the
::  scheduler takes passes through, as projection shows one.
::
++  offset
  |=  tz=(unit @t)
  ^-  (each [offset=@t name=(unit @t)] @t)
  ?~  tz  [%& 'UTC' ~]
  ?:  =('UTC' u.tz)  [%& 'UTC' ~]
  =/  zone  (offset:zones u.tz)
  ?^  zone  [%& u.zone tz]
  =/  fixed  (mule |.((offset:reminder u.tz)))
  ?:  ?=(%& -.fixed)  [%& u.tz ~]
  [%| (cat 3 'unknown timezone: ' u.tz)]
::
::  +stamp: an instant as RFC3339 UTC, to the second
::
++  stamp
  |=  at=@da
  ^-  @t
  =/  =date  (yore at)
  =/  pad
    |=  number=@ud
    ^-  tape
    ?:  (lth number 10)  "0{(a-co:co number)}"
    (a-co:co number)
  %-  crip
  "{(a-co:co y.date)}-{(pad m.date)}-{(pad d.t.date)}T{(pad h.t.date)}:{(pad m.t.date)}:{(pad s.t.date)}Z"
::
::  +runs: a recurring job's budget for an edit. Messenger sends none, so a
::  new job takes the scheduler's most and an edited one keeps what is left.
::
++  runs
  |=  job=schedule:cr
  ^-  @ud
  ?:(=(0 remaining.job) 100 remaining.job)
::
::  +plan: a Steward edit as the head actions that apply it, or the answer
::  that refuses it. .binding names the head binding of the owner's
::  conversation at a destination, if the hand has one.
::
++  plan
  |=  $:  =edit:v1:sa
          request=@uv
          owner=@p
          schedules=(map @uv schedule:cr)
          names=(map @uv task-names:t)
          binding=$-(destination:t (unit @t))
      ==
  ^-  (each task-edit:t refusal)
  =/  invalid  |=(message=@t `(each task-edit:t refusal)`[%| %invalid message])
  ?:  ?=(%create -.edit)
    =/  task  task.edit
    ?~  schedule.task  (invalid 'schedule is required')
    ?~  payload.task  (invalid 'payload.message is required')
    ?~  message.u.payload.task  (invalid 'payload.message is required')
    ?.  |(?=(~ kind.u.payload.task) =(`'agentTurn' kind.u.payload.task))
      (invalid 'payload.kind must be agentTurn')
    ?^  tools-allow.u.payload.task  (invalid 'a tool allow-list is not supported')
    =/  to  (deliver delivery.task owner)
    ?:  ?=(%| -.to)  (invalid p.to)
    =/  source  (binding p.to)
    ?~  source
      %-  invalid
      (cat 3 'the bot has no conversation with its owner at ' (target (address:p p.to)))
    =/  timed  (timing u.schedule.task | u.message.u.payload.task 100)
    ?:  ?=(%| -.timed)  (invalid p.timed)
    =/  add=action:cr  [%add request u.source (scot %p owner) %prompt args.p.timed]
    :*  %&
        ?:(=(`| enabled.task) ~[add [%cancel request]] ~[add])
        [%created (scot %uv request)]
        `[request zone.p.timed name.task description.task]
    ==
  =/  id=@t
    ?-  -.edit
      %update  id.edit
      %delete  id.edit
      %test    id.edit
    ==
  =/  key  (slaw %uv id)
  =/  job  ?~(key ~ (~(get by schedules) u.key))
  ?.  &(?=(^ key) ?=(^ job) (owned u.job owner))
    [%| %not-found (cat 3 'no task ' id)]
  ?-  -.edit
    %delete  [%& ~[[%delete u.key]] [%deleted id] ~]
    %test    (invalid 'test runs are not supported by this harness yet')
  ::
      %update
    =/  task  task.edit
    =/  reminder  =(%reminder kind.u.job)
    =/  kept  (~(gut by names) u.key *task-names:t)
    ?:  &(=(`& enabled.task) !=(%active state.u.job))
      (invalid 'a paused task cannot be resumed; create it again')
    ?:  ?&  ?=(^ payload.task)
            ?|  ?=(^ tools-allow.u.payload.task)
                ?&  ?=(^ kind.u.payload.task)
                    !=(u.kind.u.payload.task ?:(reminder 'systemEvent' 'agentTurn'))
        ==  ==  ==
      (invalid 'the payload kind or tool allow-list cannot change')
    =/  moved=(unit @t)
      ?~  delivery.task  ~
      =/  to  (deliver delivery.task owner)
      ?:  ?=(%| -.to)  `p.to
      ?:  =((target (address:p p.to)) (target destination.u.job))  ~
      `'a task cannot move to another conversation; delete it and create a new one'
    ?^  moved  (invalid u.moved)
    =/  message  ?~(payload.task ~ message.u.payload.task)
    =/  text  (fall message prompt.u.job)
    =/  text-key  ?:(reminder 'text' 'prompt')
    =/  retimed=(each (unit [args=json zone=(unit @t)]) @t)
      ?^  schedule.task
        =/  timed  (timing u.schedule.task reminder text (runs u.job))
        ?:(?=(%| -.timed) [%| p.timed] [%& `p.timed])
      ?~  message  [%& ~]
      ::  A new message alone goes back with the schedule as the head
      ::  stored it.
      :+  %&  ~
      :_  zone.kept
      %-  pairs:enjs:format
      ?:  (once u.job)
        ~[['at' %s expression.u.job] [text-key %s text]]
      :~  ['schedule' %s expression.u.job]
          ['timezone' %s timezone.u.job]
          [text-key %s text]
          ['runs' %s (crip (a-co:co (runs u.job)))]
      ==
    ?:  ?=(%| -.retimed)  (invalid p.retimed)
    =/  steps=(list action:cr)
      %+  weld
        ^-  (list action:cr)
        ?~  p.retimed  ~
        ~[[%edit u.key (sham u.job) args.u.p.retimed]]
      ^-  (list action:cr)
      ?.  &(=(`| enabled.task) =(%active state.u.job))  ~
      ~[[%cancel u.key]]
    :*  %&
        steps
        [%updated id]
        :+  ~  u.key
        :+  ?~(p.retimed zone.kept zone.u.p.retimed)
          ?~(name.task name.kept name.task)
        ?~(description.task description.kept description.task)
    ==
  ==
--
