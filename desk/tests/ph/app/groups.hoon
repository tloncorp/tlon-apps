/-  spider, g=groups, gv=groups-ver
/+  *ph-io, *ph-test
=,  strand=strand:spider
=>
|%
--
|%
++  test-flag  ~zod^%my-test-group
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
::  +ph-test-group-join: test group joins
::
::  scenario
::
::  ~zod hosts a group. ~bud joins the group. we verify
::  that the subscription lifecycle follows through %watch, and then %done.
::  finally, the group creation response is received.
::
++  ph-test-group-join
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~zod/groups/v1/groups [~zod %groups] /v1/groups)
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
  =+  foreign=(~(got by foreigns) test-flag)
  ?>  ?=(^ invites.foreign)
  =/  =a-foreigns:v8:gv
    [%foreign test-flag %join token.i.invites.foreign]
  ;<  ~  bind:m  (poke-app [~bud %groups] group-foreign-2+a-foreigns)
  ::  wait for ~bud to complete the group join
  ::
  :: ~&  %bud-receive-connection-update
  :: ;<  ~  bind:m  (ex-r-groups ~bud ~zod^%my-test-group [%connection &+%watch])
  :: ~&  %bud-receive-connection-update-2
  :: ;<  ~  bind:m  (ex-r-groups ~bud ~zod^%my-test-group [%connection &+%done])
  ~&  %bud-receive-creation-update
  ;<  ~  bind:m  (ex-r-groups-fact ~bud ~zod^%my-test-group %create)
  ;<  =bowl:strand  bind:m  get-bowl
  :: =/  aqua-pax
  ::   /i/~bud/gx/~bud/groups/(scot %da now.bowl)/v2/groups/noun/noun
  :: =+  ;;  groups=(unit groups:v9:gv)
  ::     (scry-aqua:util noun our.bowl now.bowl aqua-pax)
  :: ~&  groups+groups
  (pure:m ~)
::  +ph-test-group-conn-not-found: test missing group connection update
::
::  scenario
::
::  ~zod hosts a group. ~bud joins the group and then suspends his
::  subscription. ~zod deletes the group. ~bud revives his subscription
::  and receives a %not-found connection error.
::
:: ++  ph-test-group-conn-not-found
::   =/  m  (strand ,~)
::   ^-  form:m
::   ;<  ~  bind:m  ph-test-group-join
::   ;<  ~  bind:m  (poke-app [~bud %groups] group-suspend+[test-flag &])
::   :: ;<  ~  bind:m  (ex-r-groups ~bud test-flag [%connection &+%suspend])
::   ;<  ~  bind:m  (poke-app [~zod %groups] group-command+[%group test-flag %delete ~])
::   :: ;<  ~  bind:m  (poke-app [~bud %groups] group-suspend+[test-flag |])
::   :: ;<  ~  bind:m  (ex-r-groups ~bud test-flag [%connection &+%watch])
::   :: ;<  ~  bind:m  (ex-r-groups ~bud test-flag [%connection &+%done])
::   :: ;<  ~  bind:m  (ex-r-groups ~bud test-flag [%connection |+%not-found])
::   (pure:m ~)
--

