::  create and preset a group
::
::  run via web at
::  TODO modify spider to expose a new /v1 endpoint with a
::  /thread/input/output syntax.
::
::  https://ship/spider/groups/group-create-thread/group-create/group-ui-1
::
/-  spider
/-  g=groups, gv=groups-ver, gt=groups-thread, c=channels, meta
/+  io=strandio
::  keep warm
/=  in-mark  /mar/group/create-thread
::
=,  strand=strand:spider
^-  thread:spider
::
|=  arg=vase
=/  m  (strand ,vase)
=*  n  (strand ,~)
^-  form:m
=+  !<(arg=(unit create-group:gt) arg)
?>  ?=(^ arg)
=*  create  u.arg
=*  channels  channels.create
;<  =bowl:spider  bind:m  get-bowl:io
?>  =(p.group-id.create our.bowl)
~&  %thread-run
;<  exists=?  bind:m
  (scry:io ? /gu/groups/groups/(scot %p p.group-id.create)/[q.group-id.create])
~&  group+[group-id.create exists=exists]
::  create the group if it does not exist
::
;<  ~  bind:m
  ?:  exists  (pure:n ~)
   =/  =create-group:g
     =,  create
     :*  q.group-id
         meta
         %secret     ::  privacy
         [~ ~]       ::  banned
         ::  members
         ::
         %-  ~(gas by *(jug ship role-id:g))
         %+  turn  ~(tap in guests)
         |=(=ship ship^~)
     ==
  =/  =c-groups:g  [%create create-group]
  (poke:io [our.bowl %groups] group-command+!>(c-groups))
::  set metadata and cordon if the group exists
;<  ~  bind:m
  ?.  exists  (pure:n ~)
  ;<  ~  bind:n
    =/  =action:v2:gv
      group-id.create^[now.bowl [%meta meta.create]]
    (poke:io [our.bowl %groups] group-action-3+!>(action))
  =/  =action:v2:gv
    :+  group-id.create
      now.bowl
    [%cordon %shut %add-ships %pending guests.create]
  (poke:io [our.bowl %groups] group-action-3+!>(action))
;<  ~  bind:m
  |-
  ?~  channels  (pure:n ~)
  =*  create-channel  i.channels
  =/  nest-path=path
    =,  create-channel
    /[kind.channel-id]/(scot %p ship.channel-id)/[name.channel-id]
  ;<  exists=?  bind:n
    (scry:io ? (weld /gu/channels/v1 nest-path))
  ~&  channel+[channel-id.create-channel exists=exists]
  ::  create the channel if it does not exist
  ::
  ;<  ~  bind:n
    ?:  exists  (pure:n ~)
    =/  =create-channel:c
      =,  create-channel
      :*  kind.channel-id
          name.channel-id
          group-id.create
          title.meta
          description.meta
          ~
          ~
      ==
    =/  =a-channels:c  [%create create-channel]
    (poke:io [our.bowl %channels] channel-action+!>(a-channels))
  ::  register the channel with %groups
  ;<  ~  bind:n
    =/  =channel:v2:gv
      :-  [title.meta description.meta '' '']:create-channel
      [now.bowl %default | ~]
    =/  =action:v2:gv
      [group-id.create now.bowl %channel channel-id.create-channel %add channel]
    (poke:io [our.bowl %groups] group-action-3+!>(action))
  $(channels t.channels)
::  send out group invites
::
;<  ~  bind:m
  =+  guests=~(tap in guests.create)
  |-
  ?~  guests  (pure:n ~)
  =/  =invite:v2:gv
    :_  i.guests
    [our.bowl q.group-id.create]
  ~&  invite+i.guests
  ;<  ~  bind:n
    (poke:io [our.bowl %groups] group-invite+!>(invite))
  $(guests t.guests)
;<  group-ui-5=group-ui:v5:gv  bind:m
  %+  scry:io  group-ui:v5:gv
  /gx/groups/v1/ui/groups/(scot %p p.group-id.create)/[q.group-id.create]/noun
(pure:m !>(group-ui-5))
