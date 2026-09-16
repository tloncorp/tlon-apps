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
      %not-found
      %invalid
      %harness-offline
      %harness-error
      %unknown
  ==
::  $outcome: a completed workspace edit, reported by the harness
::
+$  outcome
  $%  [%updated =name]
      [%error type=action-error message=tang]
  ==
+$  response-body
  $%  [%updated =name]
      [%error type=action-error message=tang]
      [%pending status=poke-status]
  ==
+$  response  [id=request-id body=response-body]
+$  dispatch  [id=request-id =edit]
::  $incoming-request: owner-side HTTP wait and eventual result
::
+$  incoming-request
  $:  id=request-id
      bot=ship
      =edit
      http-id=(unit @ta)
      =poke-status
      result=(unit response-body)
      submitted-at=@da
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
+$  state
  $:  files=(map ship prompts)
      =requests
      =pending
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
+$  command  c-prompts
+$  u-prompts  update
++  v1  .
--
