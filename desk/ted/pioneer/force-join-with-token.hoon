::  pioneer/force-join-with-token: join a private group with an invite token
::
::    arg (json):
::      { "flag": "~ship/group-name", "token": "0v..." }
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
=/  args=[=flag:g tok=@uv]
  ((ot flag+flag:dejs:gj token+(se %uv) ~) json)
=/  =c-groups:g  [%join flag.args `tok.args]
;<  ~  bind:m  (poke [our %groups] group-command+!>(c-groups))
(pure:m !>(~))
