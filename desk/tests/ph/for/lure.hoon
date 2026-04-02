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
++  scry-reel-service
  |=  =ship
  =/  m  (strand @t)
  ^-  form:m
  ;<  =bowl:strand  bind:m  get-bowl
  =/  aqua-pax
    /i/(scot %p ship)/gx/(scot %p ship)/reel/(scot %da now.bowl)/v1/service/noun/noun
  =+  ;;  vic=(unit @t)
    (scry-aqua:util noun our.bowl now.bowl aqua-pax)
  (pure:m (need vic))
::
++  generate-lure-invite
  =/  m  (strand @t)
  ^-  form:m
  =+  lure-path=(stab (cat 3 '/v1/id-link/' test-group-id))
  ;<  ~  bind:m  (watch-app /~zod/reel/v1/id-link [~zod %reel] lure-path)
  ;<  ~  bind:m  (poke-app [~zod %reel] reel-describe+[test-group-id lure-link-metadata])
  ;<  kag=cage  bind:m  (wait-for-app-fact /~zod/reel/v1/id-link [~zod %reel])
  ;<  ~  bind:m  (leave-app /~zod/reel/v1/id-link [~zod %reel])
  ?>  ?=(%json p.kag)
  =+  !<(=json q.kag)
  ?>  ?=(%s -.json)
  ;<  vic=@t  bind:m  (scry-reel-service ~zod)
  =/  lure-token=@t  (rsh [3 (met 3 vic)] p.json)
  (pure:m lure-token)
::
++  ph-test-lure-link-creation
  =/  m  (strand ,~)
  ^-  form:m
  ::  host a group on ~zod and enable lure links
  ::
  ;<  ~  bind:m  create-test-group
  ;<  ~  bind:m  (poke-app [~zod %grouper] grouper-enable+test-group-id)
  ;<  token=@t  bind:m  generate-lure-invite
  ?>  (gth (met 3 token) 0)
  (pure:m ~)
::
++  ph-test-lure-group-redemption
  =/  m  (strand ,~)
  ^-  form:m
  ::  host a group on ~zod and enables lure links
  ::
  ;<  ~  bind:m  create-test-group
  ;<  ~  bind:m  (poke-app [~zod %grouper] grouper-enable+test-group-id)
  ;<  token=@t  bind:m  generate-lure-invite
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/foreigns [~bud %groups] /v1/foreigns)
  ;<  ~  bind:m  (watch-app /~bud/chat/v4 [~bud %chat] /v4)
  ::  ~bud onboards from hosting through the lure invite.
  ::
  =/  =request:http
    :*  %'POST'
        (cat 3 '/lure/' token)
        ~
        `(as-octs:mimes:html 'ship=%7Ebud')
    ==
  =/  =task:eyre
    :*  %request-local
        secure=|
        ipv4+.127.0.0.1
        request
    ==
  =/  =aqua-event
    [%event ~zod /e/aqua/eyre/request-local task]
  ;<  ~  bind:m  (send-events ~[aqua-event])
  ::  ~bud receives an dm invitation and a group invitation
  ::
  ;<  kag=cage  bind:m  (wait-for-app-fact /~bud/groups/v1/foreigns [~bud %groups])
  ~&  p.kag
  ?>  =(%foreigns-1 p.kag)
  ;<  kag=cage  bind:m  (wait-for-app-fact /~bud/chat/v4 [~bud %chat])
  ~&  p.kag
  ?>  =(%writ-response-4 p.kag)
  (pure:m ~)
--

