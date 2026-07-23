::  acp: generic durable transport for Agent Client Protocol connections
::
|%
+$  connection-id  @t
+$  peer  ?(%client %agent)
+$  message
  $:  sequence=@ud
      sent=@da
      payload=@t
  ==
+$  connection
  $:  open=?
      opened=@da
      closed=(unit [at=@da reason=@t])
      next-to-client=@ud
      next-to-agent=@ud
      to-client=(map @ud message)
      to-agent=(map @ud message)
  ==
::  %send's target is the peer that should receive the JSON-RPC envelope.
::  %ack is cumulative for that target's queue.
+$  action
  $%  [%open connection=connection-id]
      [%send connection=connection-id target=peer payload=@t]
      [%ack connection=connection-id target=peer through=@ud]
      [%close connection=connection-id reason=@t]
      [%drop connection=connection-id]
  ==
+$  update
  $%  [%connection connection=connection-id open=? reason=(unit @t)]
      [%messages connection=connection-id target=peer messages=(list message)]
  ==
++  v1  .
--
