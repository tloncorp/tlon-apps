::  Admission budgets bound new messages without pruning queued envelopes.
::  Both directions count toward global capacity; acknowledgements free space.
/-  ac=acp
|%
++  usage
  |=  queue=(map @ud message:v1:ac)
  ^-  [count=@ud bytes=@ud]
  %+  roll  ~(val by queue)
  |=  [message=message:v1:ac total=[count=@ud bytes=@ud]]
  [+(count.total) (add bytes.total (met 3 payload.message))]
++  room
  |=  $:  connections=(map connection-id:v1:ac connection:v1:ac)
          id=connection-id:v1:ac
          target=peer:v1:ac
          payload=@t
      ==
  ^-  ?
  =/  connection  (~(got by connections) id)
  =/  local  (usage ?:(=(target %client) to-client.connection to-agent.connection))
  =/  size  (met 3 payload)
  ?.  &((lth count.local 1.024) (lte (add size bytes.local) 4.194.304))  |
  =/  total
    %+  roll  ~(val by connections)
    |=  [connection=connection:v1:ac total=[count=@ud bytes=@ud]]
    =/  client  (usage to-client.connection)
    =/  agent  (usage to-agent.connection)
    :-  :(add count.total count.client count.agent)
    :(add bytes.total bytes.client bytes.agent)
  &((lth count.total 8.192) (lte (add size bytes.total) 16.777.216))
--
