::  pioneer/make-admin: add ships to an admin role in a group
::
::    arg (json):
::      { "flag":  "~ship/group-name",
::        "ships": ["~ship", ...],
::        "role":  "admin"           // optional, defaults to %admin
::      }
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
=/  args=[=flag:g ships=(list ship) role=(unit @tas)]
  %.  json
  %-  ot
  :~  flag+flag:dejs:gj
      ships+(ar (se %p))
      role+(mu (se %tas))
  ==
=*  flag    flag.args
=/  ships   `(set ship)`(sy ships.args)
=/  role    `role-id:g`(fall role.args %admin)
=/  =a-groups:v8:gv
  :+  %group  flag
  [%seat ships [%add-roles (sy role ~)]]
;<  ~  bind:m  (poke [our %groups] group-action-4+!>(a-groups))
(pure:m !>(~))
