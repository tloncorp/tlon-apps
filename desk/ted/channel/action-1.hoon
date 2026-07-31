::  channel-action-1: poke %channels with a v9 channel action
::
::    see /ted/channel/action for the general shape. this one takes the
::    %channel-action-1 mark:
::    /spider/groups/channel-action-1/channel-action-1/json
::
/-  spider, cv=channels-ver
/+  io=strandio
=,  strand=strand:spider
::
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=+  !<(arg=(unit a-channels:v9:cv) arg)
?~  arg  (pure:m !>(~))
;<  =bowl:strand  bind:m  get-bowl:io
=/  action  u.arg
=?  action  ?=([%channel ^ %post %add *] action)
  action(sent.essay.c-post.a-channel now.bowl)
;<  ~  bind:m  (poke:io [our.bowl %channels] channel-action-1+!>(action))
(pure:m !>(~))
