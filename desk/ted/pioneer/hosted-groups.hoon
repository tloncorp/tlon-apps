::  pioneer/hosted-groups: returns locally hosted groups & member groups
::
::    also counts invited, unjoined members!
::
::  return: [ { "flag": "~our/group-name", "count": 123 } ]
::
/-  spider, gv=groups-ver, mt=meta
/+  *strandio, gj=groups-json
=,  strand=strand:spider
=,  dejs:format
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
;<  gs=groups:v9:gv  bind:m
  %+  scry
    groups:v9:gv
  /gx/groups/v2/groups/groups-2
;<  our=@p  bind:m  get-our
%-  pure:m
!>  ^-  json
:-  %a
%+  murn  ~(tap by gs)
|=  [=flag:v9:gv group:v9:gv]
^-  (unit json)
?.  =(our p.flag)  ~
%-  some
%-  pairs:enjs:format
:~  'flag'^(flag:v9:enjs:gj flag)
    'count'^(numb:enjs:format ~(wyt by seats))
==
