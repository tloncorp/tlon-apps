::  pioneer/set-group-title: update a group's title (preserves other meta)
::
::    arg (json):
::      { "flag": "~ship/group-name", "title": "New Title" }
::
::    return: ~ on success
::
/-  spider, g=groups, gv=groups-ver, mt=meta
/+  *strandio, gj=groups-json
=,  strand=strand:spider
=,  dejs:format
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
;<  our=@p  bind:m  get-our
=+  !<(=json arg)
=/  args=[=flag:g title=@t]
  ((ot flag+flag:dejs:gj title+so ~) json)
=*  flag   flag.args
::  fetch current group to preserve other metadata fields
::
;<  =group:v9:gv  bind:m
  %+  scry  group:v9:gv
  /gx/groups/v2/groups/(scot %p p.flag)/[q.flag]/group-2
=/  meta=data:mt
  [title.args description.meta.group image.meta.group cover.meta.group]
=/  =a-groups:v8:gv
  [%group flag [%meta meta]]
;<  ~  bind:m  (poke [our %groups] group-action-4+!>(a-groups))
(pure:m !>(~))
