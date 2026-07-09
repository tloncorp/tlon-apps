::  pioneer/get-channels: list all channels this ship participates in
::
::    arg (json): {} (any payload accepted; ignored)
::
::    return:
::      json: serialized channels-5 (channels:v10:cv)
::
/-  spider, gv=groups-ver
/+  *strandio
=,  strand=strand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
;<  =groups:v9:gv  bind:m
  (scry groups:v9:gv /gx/groups/v2/groups/groups-2)
::  split by channel host
::
=/  hosts=(jug ship flag:v9:gv)
  %+  roll  ~(tap by groups)
  |=  [[=flag:v9:gv =group:v9:gv] hosts=(jug ship flag:v9:gv)]
  %+  roll  ~(tap by channels.group)
  |=  [[=nest:v9:gv *] =_hosts]
  ?.  ?=(%chat p.nest)  hosts
  (~(put ju hosts) p.q.nest flag)
::
%-  pure:m
!>  ^-  json
=,  enjs:format
%-  pairs
^-  (list (pair @t json))
%+  turn  ~(tap by hosts)
|=  [host=@p gs=(set flag:v9:gv)]
:-  `@t`(scot %p host)
^-  json
%-  pairs
^-  (list (pair @t json))
%+  turn  ~(tap by gs)
|=  =flag:v9:gv
=/  =group:v9:gv  (~(got by groups) flag)
:-  q.flag
^-  json
%-  pairs
^-  (list (pair @t json))
:-  'title'^s+title.meta.group
:_  ~
:-  'channels'
%-  pairs
^-  (list (pair @t json))
%+  murn  ~(tap by channels.group)
|=  [=nest:v9:gv =channel:v9:gv]
^-  (unit (pair @t json))
?.  ?=(%chat p.nest)  ~
?.  =(host p.q.nest)    ~
(some q.q.nest s+title.meta.channel)
