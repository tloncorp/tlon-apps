::  channel-action: send actions to %channels
::
::    HTTP endpoint for posting to a channel as this ship, used by the
::    alert bot (serverless-infra /api/sendAlertBotMessage). Takes any
::    version of the channel action mark (v7, v9, or v10) — the
::    input-mark segment of the spider url picks the json parser, e.g.
::    /spider/groups/channel-action-2/channel-action/json — and
::    upconverts older shapes before poking %channels.
::
/-  spider, cv=channels-ver
/+  io=strandio, ccv=channel-conv
=,  strand=strand:spider
::
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=/  a-channels=(unit a-channels:v10:cv)
  =/  new  ((soft (unit a-channels:v10:cv)) q.arg)
  ?^  new  u.new
  =/  mid  ((soft (unit a-channels:v9:cv)) q.arg)
  ?^  mid
    ?~  u.mid  ~
    `(v10:a-channels:v9:ccv u.u.mid)
  =/  old  ((soft (unit a-channels:v7:cv)) q.arg)
  ?~  old  ~|(%unknown-channel-action-version !!)
  ?~  u.old  ~
  `(v10:a-channels:v9:ccv (v9:a-channels:v7:ccv u.u.old))
?~  a-channels  (pure:m !>(~))
=/  action  u.a-channels
?>  ?=([%channel ^ %post %add *] action)
;<  =bowl:strand  bind:m  get-bowl:io
=.  sent.essay.c-post.a-channel.action  now.bowl
;<  ~  bind:m  (poke:io [our.bowl %channels] channel-action-2+!>(action))
(pure:m !>(~))
