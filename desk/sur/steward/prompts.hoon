::  steward prompts: workspace projection and owner edit protocol
::
|%
+$  name  @t
+$  prompts  (map name text=@t)
+$  request-id  @uv
+$  poke-status  ?(%sending %acked %nacked)
+$  edit  [%set =name text=@t]
+$  action-error
  $?  %not-authorized
      %invalid
      %harness-offline
      %harness-error
      %unknown
  ==
::  $outcome: a completed workspace edit, reported by the harness
::
+$  outcome
  $%  [%updated =name]
      [%error =action-error message=tang]
  ==
+$  response-body
  $%  [%updated =name]
      [%error =action-error message=tang]
      [%pending status=poke-status]
  ==
+$  response  [id=request-id body=response-body]
::  $dispatch: .requester is the owner that authorized the command. a
::  (re)subscribing harness is replayed only the current owner's
::  unanswered commands, but a dispatch already sent can still reach a
::  harness after the bot was re-pointed at a new owner; the harness
::  compares .requester with its own configured owner and refuses a
::  mismatch
::
+$  dispatch  [id=request-id requester=ship =edit]
::  $incoming-request: owner-side HTTP wait and eventual result
::
+$  incoming-request
  $:  id=request-id
      bot=ship
      =edit
      http-id=(unit @ta)
      =poke-status
      result=(unit response-body)
      final-at=(unit @da)
      fetched=?
  ==
+$  requests  (map request-id incoming-request)
::  $pending-command: bot-side dispatch, retained for reconnect replay
::
+$  pending-command
  $:  id=request-id
      requester=ship
      =edit
      sent-at=@da
      result=(unit outcome)
  ==
+$  pending  (map request-id pending-command)
::  $state: only projections write .files; edits write request records
::
::    .rewatch: per trusted bot whose files watch was nacked, the count of
::    consecutive nacks and when the armed retry wakes. a wake for any
::    other time is stale and ignored. cleared by a positive watch-ack or
::    an untrust
::    .sweep: when the armed cleanup timer wakes, as in automation
::
+$  state
  $:  files=(map ship prompts)
      =requests
      =pending
      rewatch=(map ship [attempt=@ud wake=@da])
      sweep=@da
  ==
+$  a-prompts
  $%  [%project =prompts]
      [%edit =request-id bot=ship =edit]
      [%finalize =request-id body=outcome]
  ==
+$  c-prompts
  $%  [%edit =request-id =edit]
  ==
+$  update
  $%  [%files files=(map ship prompts)]
      [%set =ship =name text=@t]
      [%del =ship =name]
      [%gone =ship]
  ==
+$  action  a-prompts
++  v1  .
--
