/-  spider
/-  g=groups, gv=groups-ver, r=reel
/+  *ph-io, *ph-test
=,  strand=strand:spider
::
::  lure testing
::
::  ~zod is the group host. he issues a lure invite
::  by registering it with the bait provider.
::
::  ~bud is the invitee. he receives the invite
::  and onboards to the network, joining the group.
::
::  ~fen is the bait provider
::
|%
++  test-flag  ~zod^%test-group
++  test-group-id  '~zod/test-group'
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
::
++  create-test-group
  =/  m   (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~zod/groups/v1/groups [~zod %groups] /v1/groups)
  ::  ~zod hosts a group and invites ~bud
  ::
  =/  =create-group:g
    :*  %test-group
        ['My Test Group' 'My testing group' '' '']
        %secret
        [~ ~]
        ~
    ==
  ;<  ~  bind:m  (poke-app [~zod %groups] group-command+[%create create-group])
  ;<  ~  bind:m  (ex-r-groups-fact ~zod test-flag %create)
  (pure:m ~)
++  lure-link-metadata
  ^~
  ^-  metadata:v1:r
  :-  %groups-0
  %-  my
  :~  [%'inviterUserId' '~zod']
      [%'inviterNickname' 'Zod']
      [%'inviterAvatarImage' 'https://zod.arvo.network/avatar.png']
      [%'invitedGroupTitle' 'Test Group']
      [%'invitedGroupDescription' 'Aqua test group']
      [%'invitedGroupId' test-group-id]
      [%'invitedGroupIconImageUrl' 'https://zod.arvo.network/sunrise.jpg']
      [%'bite-type' '2']
  ==
::
++  ph-test-lure-link-creation
  =/  m  (strand ,~)
  ^-  form:m
  ::  host a group on ~zod and enable lure links
  ::
  ;<  ~  bind:m  create-test-group
  ;<  ~  bind:m  (poke-app [~zod %grouper] grouper-enable+test-group-id)
  ::  generate a lure link and receive it
  ::
  =+  lure-path=(stab (cat 3 '/v1/id-link/' test-group-id))
  ;<  ~  bind:m  (watch-app /~zod/reel/v1/id-link [~zod %reel] lure-path)
  ;<  ~  bind:m  (poke-app [~zod %reel] reel-describe+[test-group-id lure-link-metadata])
  ;<  kag=cage  bind:m  (wait-for-app-fact /~zod/reel/v1/id-link [~zod %reel])
  ?>  ?=(%json p.kag)
  =+  !<(=json q.kag)
  ~&  lure-link+json
  (pure:m ~)
::  +ph-test-lure-group-redemption
::
:: ++  ph-test-lure-group-redemption
::   =/  m  (strand ,~)
::   ^-  form:m
::   ::  host a group on ~zod and enable lure links
::   ::
::   ;<  ~  bind:m  create-test-group
::   ;<  ~  bind:m  (poke-app [~zod %grouper] grouper-enable+test-group-id)
::   ::  generate a lure link and receive it
::   ::
::   =+  lure-path=(stab (cat 3 '/v1/id-link/' test-group-id))
::   ;<  ~  bind:m  (watch-app /~zod/reel/v1/id-link [~zod %reel] lure-path)
::   ;<  ~  bind:m  (poke-app [~zod %reel] reel-describe+[test-group-id lure-link-metadata)
::   ;<  kag=cage  bind:m  (wait-for-app-fact /~zod/reel/v1/id-link [~zod %reel])
::   ?>  ?=(%json p.kag)
::   =+  !<(=json q.kag)
::   ~&  lure-link+json
::   ::  ~bud redeems the link
::   ::
::   (pure:m ~)
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
    :*  %test-group-id
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
  ~&  %bud-join-test-group-id
  ;<  ~  bind:m  (poke-app [~bud %groups] group-foreign-2+a-foreigns)
  ::  wait for ~bud to complete the group join
  ::
  ~&  %bud-receive-connection-update
  :: ;<  ~  bind:m  (ex-r-groups ~bud ~zod^%test-group-id [%connection &+%watch])
  ~&  %bud-receive-connection-update-2
  :: ;<  ~  bind:m  (ex-r-groups ~bud ~zod^%test-group-id [%connection &+%done])
  ~&  %bud-receive-creation-update
  ;<  ~  bind:m  (ex-r-groups-fact ~bud test-flag %create)
  ;<  =bowl:strand  bind:m  get-bowl
  :: =/  aqua-pax
  ::   /i/~bud/gx/~bud/groups/(scot %da now.bowl)/v2/groups/noun/noun
  :: =+  ;;  groups=(unit groups:v9:gv)
  ::     (scry-aqua:util noun our.bowl now.bowl aqua-pax)
  :: ~&  groups+groups
  (pure:m ~)
--

