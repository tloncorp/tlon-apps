::  steward automation module: mirrored OpenClaw task definitions
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
::  $task-payload: the definition fields of an OpenClaw task payload
::
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
::  $identified-task: an inbound task paired with its OpenClaw ID
::
+$  identified-task
  $:  id=@t
      =task
  ==
::  $tasks: one ship's task map, keyed by OpenClaw task ID
::
+$  tasks  (map @t task)
::  $state: per-ship task state: the local projection lives under the
::  local ship's key, mirrored remote bots under theirs
::
+$  state
  $:  tasks=(map ship tasks)
  ==
::  $action: inbound automation actions from the local harness
::
::    %project: atomically replace the complete task projection
::
+$  action
  $%  [%project tasks=(list identified-task)]
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
++  v1  .
--
