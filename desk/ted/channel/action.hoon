::  channel-action: send actions to %channels
::
::    HTTP endpoint for posting to a channel as this ship, used by the
::    alert bot (serverless-infra /api/sendAlertBotMessage). Takes a
::    %channel-action mark (json or noun) and pokes our %channels.
::
/-  spider, cv=channels-ver
/+  io=strandio
=,  strand=strand:spider
::
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=+  !<(arg-a-channels=(unit a-channels:v7:cv) arg)
?~  arg-a-channels  (pure:m !>(~))
=*  a-channels  u.arg-a-channels
?>  ?=([%channel ^ %post %add *] a-channels)
;<  =bowl:strand  bind:m  get-bowl:io
=.  sent.essay.c-post.a-channel.a-channels  now.bowl
;<  ~  bind:m  (poke:io [our.bowl %channels] channel-action+!>(a-channels))
(pure:m !>(~))
