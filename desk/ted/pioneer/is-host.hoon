::  pioneer/is-host: check whether we host a given group
::
::    arg (json):
::      { "flag": "~ship/group-name" }
::
::    return:
::      json: true|false
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
=/  =flag:g  ((ot flag+flag:dejs:gj ~) json)
;<  host=?  bind:m
  =/  m  (strand ,?)
  ?.  =(our p.flag)  (pure:m |)
  (scry ? /gu/groups/groups/(scot %p p.flag)/[q.flag])
(pure:m !>(b+host))
