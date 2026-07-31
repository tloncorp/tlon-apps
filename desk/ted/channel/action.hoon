::  channel-action: poke %channels with a v7 channel action
::
::    exposes the %channels action poke over spider's json api, for
::    callers that can't hold an eyre channel open:
::    /spider/groups/channel-action/channel-action/json
::
::    %channels accepts every action mark version it has ever shipped,
::    so the action is poked through as-is. only .sent is filled in:
::    it's the client id %channels dedupes posts on, and an http caller
::    has no way to pick one.
::
/-  spider, cv=channels-ver
/+  io=strandio
=,  strand=strand:spider
::
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=+  !<(arg=(unit a-channels:v7:cv) arg)
?~  arg  (pure:m !>(~))
;<  =bowl:strand  bind:m  get-bowl:io
=/  action  u.arg
=?  action  ?=([%channel ^ %post %add *] action)
  action(sent.essay.c-post.a-channel now.bowl)
;<  ~  bind:m  (poke:io [our.bowl %channels] channel-action+!>(action))
(pure:m !>(~))
