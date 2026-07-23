::  acp: durable Tlon Messenger bus for external agent workers
::
|%
+$  conversation
  $%  [%dm =ship]
      [%channel kind=?(%chat %diary %heap) host=ship name=term]
  ==
+$  routing
  $:  owner=ship
      allowed-dms=(set ship)
      allowed-channel-ships=(set ship)
      channels=(set [kind=?(%chat %diary %heap) host=ship name=term])
      require-channel-mention=?
      owner-listen=?
  ==
+$  request
  $:  sequence=@ud
      received=@da
      =conversation
      sender=ship
      message-id=@t
      text=@t
  ==
+$  action
  $%  [%configure =routing]
      [%reply sequence=@ud text=@t]
  ==
+$  update
  $%  [%configuration routing=(unit routing)]
      [%requests requests=(list request)]
      [%completed sequence=@ud]
      [%failed sequence=@ud reason=@t]
  ==
--
