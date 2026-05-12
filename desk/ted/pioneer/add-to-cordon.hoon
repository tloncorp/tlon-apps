::  pioneer/add-to-cordon: add ships to a group's pending entry list
::
::    arg (json):
::      { "flag": "~ship/group-name", "ships": ["~ship", ...] }
::
::      ships are added to the pending list (no roles), which whitelists
::      them through the group cordon.
::
::    return: ~ on success
::
/-  spider, g=groups, gv=groups-ver
/+  *strandio, gj=groups-json
=,  strand=strand:spider
=,  dejs:format
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
;<  our=@p  bind:m  get-our
=+  !<(=json arg)
=/  args=[=flag:g ships=(list ship)]
  ((ot flag+flag:dejs:gj ships+(ar (se %p)) ~) json)
=*  flag    flag.args
=/  ships   `(set ship)`(sy ships.args)
=/  =a-groups:v8:gv
  :+  %group  flag
  [%entry [%pending ships [%add ~]]]
;<  ~  bind:m  (poke [our %groups] group-action-4+!>(a-groups))
(pure:m !>(~))
