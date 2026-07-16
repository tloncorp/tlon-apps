::  channel-action: send actions to %channels
::
::    HTTP endpoint for posting to a channel as this ship, used by the
::    alert bot (serverless-infra /api/sendAlertBotMessage). Takes any
::    version of the channel action mark — the input-mark segment of the
::    spider url picks the json parser, e.g.
::    /spider/groups/channel-action-2/channel-action/json — and
::    dispatches on the shape received, newest first.
::
/-  spider, cv=channels-ver
/+  io=strandio
=,  strand=strand:spider
::
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
;<  =bowl:strand  bind:m  get-bowl:io
=/  new  ((soft (unit a-channels:v10:cv)) q.arg)
?^  new
  ?~  u.new  (pure:m !>(~))
  =/  a-channels  u.u.new
  ?>  ?=([%channel ^ %post %add *] a-channels)
  =.  sent.essay.c-post.a-channel.a-channels  now.bowl
  ;<  ~  bind:m  (poke:io [our.bowl %channels] channel-action-2+!>(a-channels))
  (pure:m !>(~))
=/  old  ((soft (unit a-channels:v7:cv)) q.arg)
?~  old  ~|(%unknown-channel-action-version !!)
?~  u.old  (pure:m !>(~))
=/  a-channels  u.u.old
?>  ?=([%channel ^ %post %add *] a-channels)
=.  sent.essay.c-post.a-channel.a-channels  now.bowl
;<  ~  bind:m  (poke:io [our.bowl %channels] channel-action+!>(a-channels))
(pure:m !>(~))
