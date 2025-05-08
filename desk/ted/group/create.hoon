::  create and preset a group
::
::  run via web at
::  https://ship/spider/groups/group-create-thread/group-create/group-ui-1
::
/-  spider
/-  g=groups, gt=groups-thread, c=channels, meta
/+  gv=groups-ver, io=strandio
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
         guest-list
     ==
  =/  =c-groups:g  [%create create-group]
  (poke:io [our.bowl %groups] group-command+!>(c-groups))
::  set metadata and cordon if the group exists
;<  ~  bind:m
  ?.  exists  (pure:n ~)
  ;<  ~  bind:n
    =/  =action:v2:g
      group-id.create^[now.bowl [%meta meta.create]]
    (poke:io [our.bowl %groups] group-action-3+!>(action))
  =/  =action:v2:g
    :+  group-id.create
      now.bowl
    [%cordon %shut %add-ships %pending guest-list.create]
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
    =/  =channel:v2:g
      :-  [title.meta description.meta '' '']:create-channel
      [now.bowl %default | ~]
    =/  =action:v2:g
      [group-id.create now.bowl %channel channel-id.create-channel %add channel]
    (poke:io [our.bowl %groups] group-action-3+!>(action))
  $(channels t.channels)
::  send out group invites
::
;<  ~  bind:m
  =+  guest-list=~(tap in guest-list.create)
  |-
  ?~  guest-list  (pure:n ~)
  =/  =invite:v5:g
    :_  i.guest-list
    [our.bowl q.group-id.create]
  ~&  invite+i.guest-list
  ;<  ~  bind:n
    (poke:io [our.bowl %groups] group-invite+!>(invite))
  $(guest-list t.guest-list)
;<  group-ui-5=group-ui:v5:g  bind:m
  %+  scry:io  group-ui:v5:g
  /gx/groups/v1/ui/groups/(scot %p p.group-id.create)/[q.group-id.create]/noun
(pure:m !>(group-ui-5))
