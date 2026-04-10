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
++  my-test-flag  ~zod^%test-group
++  my-test-group-id  '~zod/test-group'
++  my-test-group-name  'test-group'
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
  ;<  ~  bind:m  (ex-r-groups-fact ~zod my-test-flag %create)
  (pure:m ~)
++  lure-group-metadata
  ^~
  ^-  metadata:v1:r
  :-  %groups-0
  %-  my
  :~  [%'inviterUserId' '~zod']
      [%'inviterNickname' 'Aqua Zod']
      [%'inviterAvatarImage' 'https://zod.arvo.network/avatar.png']
      [%'invitedGroupTitle' 'Test Group']
      [%'invitedGroupDescription' 'Aqua test group']
      [%'invitedGroupId' my-test-group-id]
      [%'invitedGroupIconImageUrl' 'https://zod.arvo.network/sunrise.jpg']
      [%'bite-type' '2']
  ==
++  lure-personal-metadata
  ^~
  ^-  metadata:v1:r
  :-  %group-0
  %-  my
  :~  [%'inviterUserId' '~zod']
      [%'inviterNickname' 'Aqua Zod']
      [%'inviterAvatarImage' 'https://zod.arvo.network/avatar.png']
      [%'inviteType' 'user']
      [%'invitedGroupId' '']
      [%'bite-type' '2']
  ==
::
++  scry-reel-bait
  |=  =ship
  =/  m  (strand ,[@t @p])
  ^-  form:m
  ;<  =bowl:strand  bind:m  get-bowl
  =/  aqua-pax
    /gx/(scot %p ship)/reel/(scot %da now.bowl)/v1/bait/noun/noun
  ;<  [bait=(unit [vic=@t civ=@p])]  bind:m
    (scry-aqua (unit ,[vic=@t civ=@p]) ship aqua-pax)
  (pure:m (need bait))
::
++  scry-reel-service
  |=  =ship
  =/  m  (strand @t)
  ^-  form:m
  ;<  =bowl:strand  bind:m  get-bowl
  =/  aqua-pax
    /gx/(scot %p ship)/reel/(scot %da now.bowl)/v1/service/noun/noun
  ;<  vic=(unit @t)  bind:m
    (scry-aqua (unit @t) ship aqua-pax)
  (pure:m (need vic))
::
++  generate-lure-invite
  |=  =metadata:v1:r
  =/  m  (strand @t)
  ^-  form:m
  =+  lure-path=(stab (cat 3 '/v1/id-link/' my-test-group-id))
  ;<  ~  bind:m  (poke-app [~zod %reel] verb+[%volume %info])
  ;<  ~  bind:m  (watch-app /~zod/reel/v1/id-link [~zod %reel] lure-path)
  ;<  ~  bind:m  (poke-app [~zod %reel] reel-describe+[my-test-group-id metadata])
  ;<  kag=cage  bind:m  (wait-for-app-fact /~zod/reel/v1/id-link [~zod %reel])
  ;<  ~  bind:m  (leave-app /~zod/reel/v1/id-link [~zod %reel])
  ;<  ~  bind:m  (ex-equal !>(p.kag) !>(%json))
  =+  !<(=json q.kag)
  ?>  ?=(%s -.json)
  (pure:m p.json)
::
++  ph-test-lure-link-creation
  =/  m  (strand ,~)
  ^-  form:m
  ::  host a group on ~zod and enable lure links
  ::
  ;<  ~  bind:m  create-test-group
  ;<  ~  bind:m  (poke-app [~zod %grouper] grouper-enable+my-test-group-id)
  ;<  invite-link=@t  bind:m  (generate-lure-invite lure-group-metadata)
  (ex-not-equal !>(invite-link) !>(''))
::
++  eyre-authenticate
  |=  =ship
  =/  m  (strand (unit @t))
  ^-  form:m
  ;<  =bowl:strand  bind:m  get-bowl
  =/  aqua-pax
    /j/(scot %p ship)/code/(scot %da now.bowl)/(scot %p ship)/noun
  ;<  code=(unit @t)  bind:m
    (scry-aqua (unit @t) ship aqua-pax)
  =+  password=(rsh [3 1] (need code))
  =/  =request:http
    :*  %'POST'
        '/~/login'
        ~
        `(as-octs:mimes:html (crip "password={(trip password)}"))
    ==
  =/  =task:eyre
    :*  %request
        secure=|
        ipv4+.127.0.0.1
        request
    ==
  =/  =aqua-event
    [%event ship /e/aqua/eyre/request task]
  ;<  ~  bind:m  (watch-our /effect/response %aqua /effect/response)
  ;<  ~  bind:m  (send-events ~[aqua-event])
  ;<  =aqua-effect  bind:m  (take-effect /effect/response)
  ?>  =(ship who.aqua-effect)
  =*  effect  q.ufs.aqua-effect
  ?>  ?=(%response -.effect)
  ?>  ?=(%start -.http-event.effect)
  =*  headers  headers.response-header.http-event.effect
  =/  [@t cookie=@t]
    %-  head
    (skim headers |=([key=@t value=@t] ?:(=('set-cookie' key) & |)))
  =/  cookie=(unit @t)
    %+  bind  (rush cookie ;~(sfix (plus ;~(less mic prn)) (star prn)))
    crip
  (pure:m cookie)
::
++  ph-test-lure-group
  =/  m  (strand ,~)
  ^-  form:m
  ::
  ;<  ~  bind:m  (poke-app [~fen %bait] verb+[%volume %info])
  ::  host a group on ~zod and enable lure links
  ::
  ;<  ~  bind:m  create-test-group
  ;<  ~  bind:m  (poke-app [~zod %grouper] grouper-enable+my-test-group-name)
  ;<  lure-invite=@t  bind:m  (generate-lure-invite lure-group-metadata)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/foreigns [~bud %groups] /v1/foreigns)
  ;<  ~  bind:m  (watch-app /~bud/chat/v4 [~bud %chat] /v4)
  ;<  cookie=(unit @t)  bind:m  (eyre-authenticate ~fen)
  ?>  ?=(^ cookie)
  ::  ~bud onboards from hosting through the lure invite.
  ::
  =/  =purl:eyre
    (need (de-purl:html lure-invite))
  =*  pork  q.purl
  =/  lure-line=@t
    ?~  p.pork  (spat q.pork)
    (cat 3 (spat q.pork) (cat 3 '.' u.p.pork))
  =/  =request:http
    :*  %'POST'
        lure-line
        ~[['cookie' u.cookie]]
        `(as-octs:mimes:html 'ship=%7Ebud')
    ==
  =/  =task:eyre
    :*  %request
        secure=|
        ipv4+.127.0.0.1
        request
    ==
  ::  ~fen the bait provider receives the onboarding request
  ::
  =/  =aqua-event
    [%event ~fen /e/aqua/eyre/request task]
  ;<  ~  bind:m  (send-events ~[aqua-event])
  ::  ~bud receives group invites: one current and one backwards compatible
  ::
  ;<  kag=cage  bind:m  (wait-for-app-fact /~bud/groups/v1/foreigns [~bud %groups])
  ?>  =(%foreigns-1 p.kag)
  ;<  kag=cage  bind:m  (wait-for-app-fact /~bud/groups/v1/foreigns [~bud %groups])
  ?>  =(%foreigns-1 p.kag)
  ::  ~bud receives dm invite
  ::
  ;<  kag=cage  bind:m  (wait-for-app-fact /~bud/chat/v4 [~bud %chat])
  ?>  =(%writ-response-4 p.kag)
  (pure:m ~)
::
++  ph-test-lure-personal
  =/  m  (strand ,~)
  ^-  form:m
  ::
  ;<  ~  bind:m  (poke-app [~fen %bait] verb+[%volume %info])
  ;<  lure-invite=@t  bind:m  (generate-lure-invite lure-personal-metadata)
  ;<  ~  bind:m  (watch-app /~bud/chat/v4 [~bud %chat] /v4)
  ;<  cookie=(unit @t)  bind:m  (eyre-authenticate ~fen)
  ?>  ?=(^ cookie)
  ::  ~bud onboards from hosting through the lure invite.
  ::
  =/  =purl:eyre
    (need (de-purl:html lure-invite))
  =*  pork  q.purl
  =/  lure-line=@t
    ?~  p.pork  (spat q.pork)
    (cat 3 (spat q.pork) (cat 3 '.' u.p.pork))
  =/  =request:http
    :*  %'POST'
        lure-line
        ~[['cookie' u.cookie]]
        `(as-octs:mimes:html 'ship=%7Ebud')
    ==
  =/  =task:eyre
    :*  %request
        secure=|
        ipv4+.127.0.0.1
        request
    ==
  ::  ~fen the bait provider receives the onboarding request
  ::
  =/  =aqua-event
    [%event ~fen /e/aqua/eyre/request task]
  ;<  ~  bind:m  (send-events ~[aqua-event])
  ::  ~bud receives dm invite
  ::
  ;<  kag=cage  bind:m  (wait-for-app-fact /~bud/chat/v4 [~bud %chat])
  ?>  =(%writ-response-4 p.kag)
  (pure:m ~)
--

