::  pioneer/is-member: check whether we are a member of (or host of) a group
::
::    arg (json):
::      { "flag": "~ship/group-name" }
::
::    return:
::      json: { "host": true|false, "member": true|false }
::
::    "host" is true when we are the group's host ship.
::    "member" is true when the group is locally tracked (host or done-joined).
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
=/  =flag:g  ((ot flag+flag:dejs:gj ~) json)
::  host: we are the host ship and the group exists locally
::
;<  host=?  bind:m
  =/  m  (strand ,?)
  ?.  =(our p.flag)  (pure:m |)
  (scry ? /gu/groups/groups/(scot %p p.flag)/[q.flag])
::  member: either host, or a foreign with progress=%done
::
;<  member=?  bind:m
  =/  m  (strand ,?)
  ?:  host  (pure:m &)
  ;<  =foreigns:v8:gv  bind:m
    (scry foreigns:v8:gv /gx/groups/v1/foreigns/foreigns-1)
  =/  far=(unit foreign:v8:gv)  (~(get by foreigns) flag)
  ?~  far  (pure:m |)
  =*  prog  progress.u.far
  (pure:m ?=([~ %done] prog))
=/  out=^json
  %-  pairs:enjs:format
  :~  host+b+host
      member+b+member
  ==
(pure:m !>(out))
