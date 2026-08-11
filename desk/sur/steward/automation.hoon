::  steward automation module: mirrored OpenClaw task definitions
::
|%
::  $cron-schedule: the supported OpenClaw schedule variants. OpenClaw uses
::  integer milliseconds at the boundary; the Hoon representation stores dates
::  and durations in their native atom types.
::
+$  cron-schedule
  $%  [%cron expr=(unit @t) tz=(unit @t) stagger=(unit @dr)]
      [%at at=(unit @da)]
      [%every every=(unit @dr) anchor=(unit @da)]
  ==
::  $cron-payload: the definition fields of an OpenClaw task payload.
::
+$  cron-payload
  $:  kind=(unit @t)
      text=(unit @t)
  ==
::  $task: the supported definition-only subset of
::  PluginHookGatewayCronJob. The OpenClaw ID is stored separately as the map
::  key. Runtime job state and execution history are not represented.
::
+$  task
  $:  agent-id=(unit @t)
      name=(unit @t)
      description=(unit @t)
      enabled=(unit ?)
      schedule=(unit cron-schedule)
      session-target=(unit @t)
      wake-mode=(unit @t)
      payload=(unit cron-payload)
      created-at=(unit @da)
      updated-at=(unit @da)
  ==
::  $identified-task: an inbound task paired with its OpenClaw ID.
::
+$  identified-task
  $:  id=@t
      =task
  ==
::  $state: the latest complete task projection, keyed by OpenClaw task ID.
::
+$  state
  $:  tasks=(map @t task)
  ==
::  $action: inbound automation actions from the local harness.
::
::    %project: atomically replace the complete task projection.
::
+$  action
  $%  [%project tasks=(list identified-task)]
  ==
::  $task-map: the ID-keyed task map returned by the automation scry.
::
+$  task-map  (map @t task)
++  v1  .
--
