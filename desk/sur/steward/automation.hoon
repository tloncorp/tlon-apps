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
::  $state: per-ship task projections, each an ID-keyed task map: the
::  local projection lives under the local ship's key, mirrored remote
::  bots under theirs
::
+$  state
  $:  mirror=(map ship (map @t task))
  ==
::  $action: inbound automation actions from the local harness
::
::    %project: atomically replace the complete task projection
::
+$  action
  $%  [%project tasks=(list identified-task)]
  ==
::  $update: projection-feed facts; attribution is the subscription
::  source, never a payload field
::
+$  update
  $%  [%tasks tasks=(map @t task)]
      [%set id=@t =task]
      [%del id=@t]
  ==
::  $mirror-update: client-feed facts; one feed carries many bots, so
::  each update names its bot. %gone: entry removed on untrust
::  (distinct from an empty %tasks snapshot)
::
+$  mirror-update
  $%  [%tasks bot=ship tasks=(map @t task)]
      [%set bot=ship id=@t =task]
      [%del bot=ship id=@t]
      [%gone bot=ship]
  ==
::  $task-map: the ID-keyed task map returned by the automation scry
::
+$  task-map  (map @t task)
::  $mirror-map: the ship-keyed mirror returned by the mirror scry
::
+$  mirror-map  (map ship task-map)
++  v1  .
--
