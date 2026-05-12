::  pioneer/post-chat-message: post a plain-text message to a chat channel
::
::    arg (json):
::      { "nest": "chat/~host/channel-name", "text": "..." }
::
::    pokes the channel's host (%channels-server) so this works for both
::    locally-hosted and remote channels we participate in.
::
::    return: ~ on success
::
/-  spider, c=channels
/+  *strandio, cj=channel-json
=,  strand=strand:spider
=,  dejs:format
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
;<  =bowl:spider  bind:m  get-bowl
=+  !<(=json arg)
=/  args=[=nest:c text=@t]
  ((ot nest+nest:dejs:cj text+so ~) json)
=*  nest  nest.args
?>  ?=(%chat kind.nest)
=/  =memo:c  [[[%inline text.args ~] ~] our.bowl now.bowl]
=/  =essay:c  [memo /chat ~ ~]
=/  =c-channels:c
  [%channel nest [%post [%add essay]]]
;<  ~  bind:m
  (poke [ship.nest %channels-server] channel-command+!>(c-channels))
(pure:m !>(~))
