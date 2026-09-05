::  steward automation module: mirrored OpenClaw task definitions, and the
::  owner-initiated edit loop that changes them
::
::    the module follows the ACUR split used by channels, groups, and notes:
::    - a-automation  local-only actions: the harness's projection and
::                    finalize pokes, and a client's edit
::    - c-automation  owner → bot commands, checked against the owner
::    - u-automation  canonical task state, bot → owner → client
::    - response      the per-request terminal, mirroring %notes v1
::
|%
::  $cron-schedule: the supported OpenClaw schedule variants; OpenClaw uses
::  integer milliseconds at the boundary, while the Hoon representation stores
::  dates and durations in their native atom types
::
+$  cron-schedule
  $%  [%cron expr=(unit @t) tz=(unit @t) stagger=(unit @dr)]
      [%at at=(unit @da)]
      [%every every=(unit @dr) anchor=(unit @da)]
  ==
+$  task-payload
  $:  kind=(unit @t)
      message=(unit @t)
  ==
::  $task: the supported definition-only PluginHookGatewayCronJob subset; the ID
::  from OpenClaw is stored separately as the map key. runtime job state and
::  execution history are not represented
::
+$  task
  $:  agent-id=(unit @t)
      name=(unit @t)
      description=(unit @t)
      enabled=(unit ?)
      schedule=(unit cron-schedule)
      session-target=(unit @t)
      wake-mode=(unit @t)
      payload=(unit task-payload)
      created-at=(unit @da)
      updated-at=(unit @da)
  ==
+$  identified-task
  $:  id=@t
      =task
  ==
::  $tasks: task map keyed task ID
::
+$  tasks  (map @t task)
::
::  edit loop
::
::  $request-id: correlates one edit with its terminal response across
::  every hop. minted from entropy when a client supplies none
::
+$  request-id   @uv
+$  poke-status  ?(%sending %acked %nacked)
::  $action-error: enumerated failure modes returned as data, never as a
::  crash, so the client can tell them apart
::
::    %not-authorized   the bot refused the owner's per-request watch
::    %not-found        the harness found no task with the given id
::    %invalid          the harness rejected the edit before applying it
::    %harness-offline  no harness is subscribed to the bot's feed
::    %harness-error    the harness's cron service threw on apply
::    %unknown          the command poke was nacked
::
+$  action-error
  $?  %not-authorized
      %not-found
      %invalid
      %harness-offline
      %harness-error
      %unknown
  ==
::  $edit: the verb. every $task field is optional, so %update carries a
::  patch in the same shape as a stored task
::
+$  edit
  $%  [%create =task]
      [%update id=@t =task]
      [%delete id=@t]
  ==
::  $response-body: the terminal outcome of one edit. %created carries
::  the job id the harness assigned; %pending closes a held wait while
::  the request stays open for its late answer
::
+$  response-body
  $%  [%created id=@t]
      [%updated id=@t]
      [%deleted id=@t]
      [%error type=action-error message=tang]
      [%pending status=poke-status]
  ==
+$  response  [id=request-id body=response-body]
::  $dispatch: a pending command handed to the harness on the bot's
::  /v1/automation/harness feed
::
+$  dispatch  [id=request-id =edit]
::  $incoming-request: owner-side record of one in-flight edit. http-id
::  non-null means an Eyre POST is held open awaiting the terminal
::  response. final-at is set once result is terminal; the sweep uses it
::
+$  incoming-request
  $:  id=request-id
      bot=ship
      http-id=(unit @ta)
      =poke-status
      result=(unit response-body)
      final-at=(unit @da)
      fetched=?
  ==
+$  requests  (map request-id incoming-request)
::  $pending-command: bot-side record of a command handed to the harness
::  and not yet finalized. bounded only by the sweep
::
+$  pending-command
  $:  id=request-id
      requester=ship
      =edit
      sent-at=@da
  ==
+$  pending  (map request-id pending-command)
::  $state: per-ship task state (the local projection under the local
::  ship's key, mirrored remote bots under theirs), plus the edit loop's
::  request records on each side
::
+$  state
  $:  tasks=(map ship tasks)
      =requests
      =pending
  ==
::  $a-automation: local-only actions, src == our on every variant
::
::    %project:   the harness atomically replaces the complete task projection
::    %edit:      a client asks its owner ship to edit one of .bot's tasks
::    %finalize:  the harness reports the outcome of a dispatched command
::
+$  a-automation
  $%  [%project tasks=(list identified-task)]
      [%edit =request-id bot=ship =edit]
      [%finalize =request-id body=response-body]
  ==
::  $c-automation: owner → bot, src must be the configured owner
::
+$  c-automation
  $%  [%edit =request-id =edit]
  ==
::  $update: the single automation feed; every variant names the ship
::  whose entry it touches, and %tasks is always the complete
::  ship-keyed state. %gone: entry removed (distinct from an empty
::  entry, which means synced with zero tasks)
::
+$  update
  $%  [%tasks tasks=(map ship tasks)]
      [%set =ship id=@t =task]
      [%del =ship id=@t]
      [%gone =ship]
  ==
+$  u-automation  update
+$  r-automation  u-automation
::  aliases
::
+$  action   a-automation
+$  command  c-automation
++  v1  .
--
