::  pioneer/get-channels: list all channels this ship participates in
::
::    arg (json): {} (any payload accepted; ignored)
::
::    return:
::      json: serialized channels-5 (channels:v10:cv)
::
/-  spider, c=channels, cv=channels-ver
/+  *strandio, cj=channel-json
=,  strand=strand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
;<  =channels:v10:cv  bind:m
  (scry channels:v10:cv /gx/channels/v5/channels/channels-5)
(pure:m !>((channels:v10:enjs:cj channels)))
