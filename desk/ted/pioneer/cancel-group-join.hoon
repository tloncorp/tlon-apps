::  pioneer/cancel-group-join: cancel a pending group join
::
::    arg (json):
::      { "flag": "~ship/group-name" }
::
::    return: ~ on success
::
/-  spider, g=groups
/+  *strandio, gj=groups-json
=,  strand=strand:spider
=,  dejs:format
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
;<  our=@p  bind:m  get-our
=+  !<(=json arg)
=/  =flag:g
  ((ot flag+flag:dejs:gj ~) json)
;<  ~  bind:m  (poke [our %groups] group-cancel+!>(flag))
(pure:m !>(~))
