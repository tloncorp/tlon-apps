/-  spider, g=groups, gv=groups-ver
/+  *ph-io, *ph-test
=,  strand=strand:spider
|%
++  my-test-flag  ~zod^%my-test-group
::  +ex-r-groups: expect group response
::
++  ex-r-groups
  |=  [=ship =r-groups:v10:gv]
  =/  m  (strand ,~)
  ^-  form:m
  ;<  kag=cage  bind:m  (wait-for-app-fact /(scot %p ship)/groups/v1/groups [ship %groups])
  ?>  =(%group-response-1 p.kag)
  =+  !<(rep=r-groups:v10:gv q.kag)
  ;<  ~  bind:m  (ex-equal !>(flag.rep) !>(flag.r-groups))
  ;<  ~  bind:m  (ex-equal !>(r-group.rep) !>(r-group.r-groups))
  (pure:m ~)
::  +ex-r-groups-fact: expect group response fact
::
++  ex-r-groups-fact
  |=  [=ship =flag:gv tag=@tas]
  =/  m  (strand ,~)
  ^-  form:m
  ;<  kag=cage  bind:m  (wait-for-app-fact /(scot %p ship)/groups/v1/groups [ship %groups])
  ?>  =(%group-response-1 p.kag)
  =+  !<(rep=r-groups:v10:gv q.kag)
  ;<  ~  bind:m  (ex-equal !>(flag.rep) !>(flag))
  ;<  ~  bind:m  (ex-equal !>(`@tas`-.r-group.rep) !>(tag))
  (pure:m ~)
::  +ex-r-groups-meta: expect group metadata response fact
::
++  ex-r-groups-meta
  |=  [=ship =flag:gv meta=data:meta:g]
  =/  m  (strand ,~)
  ^-  form:m
  ;<  kag=cage  bind:m  (wait-for-app-fact /(scot %p ship)/groups/v1/groups [ship %groups])
  ?>  =(%group-response-1 p.kag)
  =+  !<(rep=r-groups:v10:gv q.kag)
  ;<  ~  bind:m  (ex-equal !>(flag.rep) !>(flag))
  ?>  ?=(%meta -.r-group.rep)
  ;<  ~  bind:m  (ex-equal !>(meta.r-group.rep) !>(meta))
  (pure:m ~)
::  +scry-test-group: scry group state from a virtual ship
::
++  scry-test-group
  |=  =ship
  =/  m  (strand group:g)
  ^-  form:m
  ;<  =bowl:strand  bind:m  get-bowl
  =/  aqua-pax
    /gx/(scot %p ship)/groups/(scot %da now.bowl)/v2/groups/~zod/my-test-group/group-2
  ;<  group=(unit group:v9:gv)  bind:m
    (scry-aqua (unit group:v9:gv) ship aqua-pax)
  (pure:m `group:g`(need group))
::  +ph-test-group-join: test group joins
::
::  scenario
::
::  ~zod hosts a group and sends an invitation to ~bud.
::  ~bud receives the invitation and joins the group successfully,
::  receiving the group creation fact.
::
++  ph-test-group-join
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/groups [~bud %groups] /v1/groups)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/foreigns [~bud %groups] /v1/foreigns)
  ::  ~zod hosts a group and invites ~bud
  ::
  =/  =create-group:g
    :*  %my-test-group
        ['My Test Group' 'My testing group' '' '']
        %secret
        [~ ~]
        (my ~bud^~ ~)
    ==
  ;<  ~  bind:m  (poke-app [~zod %groups] group-command+[%create create-group])
  ::  ~bud joins the group using received invite token
  ::
  ;<  kag=cage  bind:m  (wait-for-app-fact /~bud/groups/v1/foreigns [~bud %groups])
  ?>  =(%foreigns-1 p.kag)
  =+  !<(=foreigns:v8:gv q.kag)
  =+  foreign=(~(got by foreigns) my-test-flag)
  ?>  ?=(^ invites.foreign)
  =/  =a-foreigns:v8:gv
    [%foreign my-test-flag %join token.i.invites.foreign]
  ;<  ~  bind:m  (poke-app [~bud %groups] group-foreign-2+a-foreigns)
  ;<  ~  bind:m  (ex-r-groups-fact ~bud ~zod^%my-test-group %create)
  (pure:m ~)
::  +ph-test-admin-group-meta: test admin group metadata update
::
::  scenario
::
::  ~zod hosts a group and invites ~bud as an admin. ~bud joins the group.
::  after joining, ~bud issues a metadata update from their own ship. we
::  verify that the host applies the metadata update, and that the same
::  metadata update propagates back to ~bud.
::
++  ph-test-admin-group-meta
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~zod/groups/v1/groups [~zod %groups] /v1/groups)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/groups [~bud %groups] /v1/groups)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/foreigns [~bud %groups] /v1/foreigns)
  ::  ~zod hosts a group and invites ~bud with the %admin role.
  ::
  =/  =create-group:g
    :*  %my-test-group
        ['My Test Group' 'My testing group' '' '']
        %secret
        [~ ~]
        (my ~bud^(sy %admin ~) ~)
    ==
  ;<  ~  bind:m  (poke-app [~zod %groups] group-command+[%create create-group])
  ;<  ~  bind:m  (ex-r-groups-fact ~zod my-test-flag %create)
  ::  ~bud joins the group using the received invite token.
  ::
  ;<  kag=cage  bind:m  (wait-for-app-fact /~bud/groups/v1/foreigns [~bud %groups])
  ?>  =(%foreigns-1 p.kag)
  =+  !<(=foreigns:v8:gv q.kag)
  =+  foreign=(~(got by foreigns) my-test-flag)
  ?>  ?=(^ invites.foreign)
  =/  =a-foreigns:v8:gv
    [%foreign my-test-flag %join token.i.invites.foreign]
  ;<  ~  bind:m  (poke-app [~bud %groups] group-foreign-2+a-foreigns)
  ;<  ~  bind:m  (ex-r-groups-fact ~bud my-test-flag %create)
  ::  ~bud updates group metadata as an admin. the host applies the
  ::  update and the response propagates back to ~bud.
  ::
  =/  meta=data:meta:g
    ['New Test Group' 'New testing group description' '#112233' '#445566']
  =/  =a-groups:v8:gv
    [%group my-test-flag [%meta meta]]
  ;<  ~  bind:m  (poke-app [~bud %groups] group-action-4+a-groups)
  ;<  ~  bind:m  (ex-r-groups-meta ~zod my-test-flag meta)
  ;<  group=group:g  bind:m  (scry-test-group ~zod)
  ;<  ~  bind:m  (ex-equal !>(meta.group) !>(meta))
  ;<  ~  bind:m  (ex-r-groups-meta ~bud my-test-flag meta)
  (pure:m ~)
--

