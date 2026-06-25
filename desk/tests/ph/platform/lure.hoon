/-  spider
/-  c=chat, g=groups, gv=groups-ver, r=reel, t=contacts
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
::  ~loshut-lonreg is the bait provider
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
      [%'invitedGroupId' '~zod/personal-invite-link']
      [%'bite-type' '2']
  ==
++  nickname-profile
  |=  nickname=@t
  ^-  contact:t
  %-  ~(gas by *(map @tas value:t))
  :~  [%nickname text+nickname]
  ==
::
++  poke-app-event
  |=  [=dock =page]
  ^-  aqua-event
  =/  =task:gall
    [%deal [p.dock p.dock /aqua] q.dock %raw-poke page]
  [%event p.dock /g/aqua/deal task]
::
++  scry-reel-bait
  |=  her=ship
  =/  m  (strand ,[vic=cord civ=ship])
  ^-  form:m
  ;<  now=@da  bind:m  get-time
  ;<  bait=(unit [vic=cord civ=ship])  bind:m
    %^  scry-aqua  (unit ,[vic=cord civ=ship])
      her
    /gx/(scot %p her)/reel/(scot %da now)/v1/bait/noun
  (pure:m (need bait))
::
++  generate-lure-invite
  |=  =metadata:v1:r
  =/  m  (strand @t)
  ^-  form:m
  =+  group-id=(~(got by fields.metadata) %'invitedGroupId')
  =+  lure-path=(stab (cat 3 '/v1/id-link/' group-id))
  ;<  ~  bind:m  (poke-app [~zod %reel] verb+[%volume %info])
  ;<  ~  bind:m  (watch-app /~zod/reel/v1/id-link [~zod %reel] lure-path)
  ;<  ~  bind:m  (poke-app [~zod %reel] reel-describe+[group-id metadata])
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
    /j/(scot %p ship)/code/(scot %da now.bowl)/(scot %p ship)
  ;<  code=(unit @p)  bind:m
    (scry-aqua (unit @p) ship aqua-pax)
  =+  password=(rsh [3 1] (scot %p (need code)))
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
++  redeem-lure-invite
  |=  [=ship cookie=@t lure-invite=@t]
  =/  m  (strand ,~)
  ^-  form:m
  =/  =purl:eyre
    (need (de-purl:html lure-invite))
  =*  pork  q.purl
  =/  lure-line=@t
    ?~  p.pork  (spat q.pork)
    (cat 3 (spat q.pork) (cat 3 '.' u.p.pork))
  =/  =request:http
    :*  %'POST'
        lure-line
        ~[['cookie' cookie]]
        `(as-octs:mimes:html (cat 3 'ship=%7E' (rsh [3 1] (scot %p ship))))
    ==
  =/  =task:eyre
    :*  %request
        secure=|
        ipv4+.127.0.0.1
        request
    ==
  ::  ~loshut-lonreg the bait provider receives the onboarding request
  ::
  =/  =aqua-event
    [%event ~loshut-lonreg /e/aqua/eyre/request task]
  (send-events ~[aqua-event])
++  ph-test-lure-group
  =/  m  (strand ,~)
  ^-  form:m
  ::
  ;<  ~  bind:m  (poke-app [~loshut-lonreg %bait] verb+[%volume %info])
  ::  host a group on ~zod and enable lure links
  ::
  ;<  ~  bind:m  create-test-group
  ;<  ~  bind:m  (poke-app [~zod %grouper] grouper-enable+my-test-group-name)
  ;<  lure-invite=@t  bind:m  (generate-lure-invite lure-group-metadata)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/foreigns [~bud %groups] /v1/foreigns)
  ;<  ~  bind:m  (watch-app /~bud/chat/v4 [~bud %chat] /v4)
  ;<  cookie=(unit @t)  bind:m  (eyre-authenticate ~loshut-lonreg)
  ?>  ?=(^ cookie)
  ::  ~bud onboards from hosting through the lure invite.
  ::
  ;<  ~  bind:m  (redeem-lure-invite ~bud u.cookie lure-invite)
  ::  ~bud receives group invites: one current and one backwards compatible
  ::
  ;<  ~  bind:m
    %^  (ex-app-fact-match foreigns:v8:gv)  /~bud/groups/v1/foreigns
      [~bud %groups]
    :-  %foreigns-1
    |=  =foreigns:v8:gv
    =+  far=(~(got by foreigns) my-test-flag)
    ?>  ?=(^ invites.far)
    ;<  ~  bind:m
      (ex-equal !>((lent invites.far)) !>(1))
    (ex-equal !>(from.i.invites.far) !>(~zod))
  ::  ~bud receives dm invite
  ::
  ;<  kag=cage  bind:m  (wait-for-app-fact /~bud/chat/v4 [~bud %chat])
  ?>  =(%writ-response-4 p.kag)
  (pure:m ~)
::
++  ph-test-lure-personal
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (poke-app [~loshut-lonreg %bait] verb+[%volume %info])
  ;<  lure-invite=@t  bind:m  (generate-lure-invite lure-personal-metadata)
  ;<  ~  bind:m  (watch-app /~bud/chat/v4 [~bud %chat] /v4)
  ;<  cookie=(unit @t)  bind:m  (eyre-authenticate ~loshut-lonreg)
  ?>  ?=(^ cookie)
  ::  ~bud onboards from hosting through the lure invite.
  ::
  ;<  ~  bind:m  (redeem-lure-invite ~bud u.cookie lure-invite)
  ::  ~bud receives dm invite from ~zod
  ::
  ;<  ~  bind:m
    %^  (ex-app-fact-match ,[=whom:c resp=response:writs:c])  /~bud/chat/v4
      [~bud %chat]
    :-  %writ-response-4
    |=  [=whom:c resp=response:writs:c]
    ;<  ~  bind:m
      (ex-equal !>(whom) !>(`whom:c`[%ship ~zod]))
    (ex-equal !>(-.response.resp) !>(%add))
  (pure:m ~)
::  +ph-test-lure-race-group: check group metadata update race condition
::
::  scenario
::
::  ~zod hosts a group and starts creating a lure invite. before the bait
::  provider confirms the lure token, ~zod updates the group title. this
::  triggers an update to be sent out to the provider, causing the invite
::  metadata to be updated.
::
++  ph-test-lure-race-group
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  create-test-group
  ;<  ~  bind:m  (watch-app /~zod/reel/v1/id-link [~zod %reel] /v1/id-link/~zod/test-group)
  =/  describe-event=aqua-event
    (poke-app-event [~zod %reel] reel-describe+[my-test-group-id lure-group-metadata])
  =/  =c-groups:g
    [%group my-test-flag [%meta ['Racing Group' 'Fast racing' '' '']]]
  =/  group-meta-event=aqua-event
    (poke-app-event [~zod %groups] group-command+c-groups)
  ;<  ~  bind:m  (send-events ~[describe-event group-meta-event])
  ;<  [vic=cord civ=ship]  bind:m  (scry-reel-bait ~zod)
  ;<  =json  bind:m  (wait-for-app-fact-value json /~zod/reel/v1/id-link [~zod %reel])
  ?>  ?=(%s -.json)
  =/  token=token:r  (rsh [3 (met 3 vic)] p.json)
  ;<  ~  bind:m  (sleep ~s3)
  ;<  =bowl:strand  bind:m  get-bowl
  =/  aqua-pax
    /gx/~loshut-lonreg/bait/(scot %da now.bowl)/[token]/metadata/noun
  ;<  metadata=(unit metadata:v1:r)  bind:m
    (scry-aqua (unit metadata:v1:r) ~loshut-lonreg aqua-pax)
  =/  metadata=metadata:v1:r  (need metadata)
  ;<  ~  bind:m
    (ex-equal !>((~(get by fields.metadata) %'invitedGroupTitle')) !>(`'Racing Group'))
  ;<  ~  bind:m
    (ex-equal !>((~(get by fields.metadata) %'invitedGroupDescription')) !>(`'Fast racing'))
  (pure:m ~)
::  +ph-test-lure-race-profile: check profile update race condition
::
::  scenario
::
::  ~zod hosts a group and starts creating a lure invite. before the bait
::  provider confirms the lure token, ~zod updates his profile nickname,
::  marking the outstanding lure invite as modified. when confirmation
::  arrives, ~zod sends out an update to the bait provider.
::
++  ph-test-lure-race-profile
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  create-test-group
  ;<  ~  bind:m  (watch-app /~zod/reel/v1/id-link [~zod %reel] /v1/id-link/~zod/test-group)
  =/  describe-event=aqua-event
    (poke-app-event [~zod %reel] reel-describe+[my-test-group-id lure-group-metadata])
  =/  profile-event=aqua-event
    (poke-app-event [~zod %contacts] contact-action-1+[%self (nickname-profile 'Racing Driver')])
  ;<  ~  bind:m  (send-events ~[describe-event profile-event])
  ;<  [vic=cord civ=ship]  bind:m  (scry-reel-bait ~zod)
  ;<  =json  bind:m  (wait-for-app-fact-value json /~zod/reel/v1/id-link [~zod %reel])
  ?>  ?=(%s -.json)
  =/  token=token:r  (rsh [3 (met 3 vic)] p.json)
  ;<  ~  bind:m  (sleep ~s3)
  ;<  =bowl:strand  bind:m  get-bowl
  =/  aqua-pax
    /gx/~loshut-lonreg/bait/(scot %da now.bowl)/[token]/metadata/noun
  ;<  metadata=(unit metadata:v1:r)  bind:m
    (scry-aqua (unit metadata:v1:r) ~loshut-lonreg aqua-pax)
  =/  metadata=metadata:v1:r  (need metadata)
  ;<  ~  bind:m
    (ex-equal !>((~(get by fields.metadata) %'inviterNickname')) !>(`'Racing Driver'))
  (pure:m ~)
--

