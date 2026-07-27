::  channel-action-1: send actions to %channels
::
::    thread for posting to a channel as this ship, used by the
::    alert bot and typically invoked through eyre's spider api.
::    takes the v9 channel action (%channel-action-1 mark) and
::    upconverts it before poking %channels.
::
/-  spider, cv=channels-ver
/+  io=strandio, ccv=channel-conv
=,  strand=strand:spider
::
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=+  !<(arg=(unit a-channels:v9:cv) arg)
?~  arg  (pure:m !>(~))
=/  action  (v10:a-channels:v9:ccv u.arg)
?>  ?=([%channel ^ %post %add *] action)
;<  =bowl:strand  bind:m  get-bowl:io
=.  sent.essay.c-post.a-channel.action  now.bowl
;<  ~  bind:m  (poke:io [our.bowl %channels] channel-action-2+!>(action))
(pure:m !>(~))
