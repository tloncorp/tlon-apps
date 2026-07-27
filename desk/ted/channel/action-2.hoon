::  channel-action-2: send actions to %channels
::
::    thread for posting to a channel as this ship, used by the
::    alert bot and typically invoked through eyre's spider api.
::    takes the v10 channel action (%channel-action-2 mark).
::
/-  spider, cv=channels-ver
/+  io=strandio
=,  strand=strand:spider
::
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=+  !<(arg=(unit a-channels:v10:cv) arg)
?~  arg  (pure:m !>(~))
=/  action  u.arg
?>  ?=([%channel ^ %post %add *] action)
;<  =bowl:strand  bind:m  get-bowl:io
=.  sent.essay.c-post.a-channel.action  now.bowl
;<  ~  bind:m  (poke:io [our.bowl %channels] channel-action-2+!>(action))
(pure:m !>(~))
