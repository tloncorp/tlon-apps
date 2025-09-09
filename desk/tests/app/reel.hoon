/-  reel, gv=groups-ver, meta
/+  *test-agent, test, s=subscriber, t=contacts
/=  reel-agent  /app/reel
|%
+$  state-5
  $:  %5
      vic=@t
      civ=ship
      our-profile=contact:t
      our-metadata=(map token:reel metadata:reel)
      open-link-requests=(set (pair ship cord))
      open-describes=(set token:reel)
      stable-id=(map cord token:reel)
      =^subs:s
  ==
++  dap  %reel-test
++  provider  ~loshut-lonreg
++  group-invite-meta
  ^~
  ^-  metadata:reel
  :-  %group-0
  %-  my
  :~  [%'inviterUserId' '~sampel-palnet']
      [%'inviterNickname' 'Sampel Palnet']
      [%'inviterAvatarImage' 'https://sampel-palnet.arvo.network/avatar.png']
      [%'invitedGroupTitle' 'Sunrise']
      [%'invitedGroupDescription' '']
      [%'invitedGroupId' '~sampel-palnet/sunrise']
      [%'invitedGroupIconImageUrl' 'https://sampel-palnet.arvo.network/sunrise.jpg']
      [%'bite-type' '2']
  ==
++  personal-invite-meta
  ^~
  ^-  metadata:reel
  :-  %group-0
  %-  my
  :~  [%'inviterUserId' '~sampel-palnet']
      [%'inviterNickname' 'Sampel Palnet']
      [%'inviterAvatarImage' 'https://sampel-palnet.arvo.network/avatar.png']
      [%'inviteType' 'user']
      [%'invitedGroupId' '~zod/personal-invite-link']
      [%'bite-type' '2']
  ==
++  do-register-invite
  |=  [=token:reel =metadata:reel]
  =/  m  (mare ,(list card))
  ^-  form:m
  =+  nonce=(scot %da ~2025.9.3)
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(now ~2025.9.3)))
  ;<  ~  bind:m   (set-src ~sampel-palnet)
  =+  id=(~(got by fields.metadata) %'invitedGroupId')
  ;<  caz=(list card)  bind:m  (do-poke reel-describe+!>([id metadata]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-poke /describe [provider %bait] bait-describe+!>([nonce metadata]))
    ==
  ;<  *  bind:m  (set-src provider)
  ;<  caz=(list card)  bind:m  (do-poke reel-confirmation+!>([nonce token]))
  (pure:m caz)
++  get-full-peek
  |*  [=mold =path]
  =/  m  (mare mold)
  ^-  form:m
  |=  =state
  =/  res  ((get-peek path) state)
  ?:  ?=(%| -.res)  res
  =/  peek  out.p.res
  ?~  peek
    |+~['invalid scry path' (spat path)]
  ?~  u.peek
    |+~['unexpected empty result at scry path' (spat path)]
  &+[!<(mold q.u.u.peek) state]
++  get-metadata
  |=  id=@uv
  (get-full-peek metadata:reel /x/(scot %uv id)/metadata)
++  get-metadata-field
  |=  [id=@uv =field:reel]
  =/  m  (mare (unit @t))
  ^-  form:m
  ;<  =metadata:reel  bind:m  (get-metadata id)
  (pure:m (~(get by fields.metadata) field))
::  +ex-poke-wire: assert poke wire
::
++  ex-poke-wire
  |=  =wire
  |=  car=card
  ^-  tang
  =*  fail
    %-  expect-eq:test
    [!>(`card`[%pass wire %agent *gill:gall %poke *mark *vase]) !>(`card`car)]
  ?.  ?=([%pass * %agent * %poke *] car)  fail
  ?.  =(wire p.car)  fail
  ~
::  +ex-kick: expect a kick
::
++  ex-kick
  |=  [paths=(list path) ship=(unit ship)]
  |=  car=card
  ^-  tang
  =*  fail
    %+  expect-eq:test  !>(`card`car)
    !>(`card`[%give %kick paths ship])
  ?.  ?=([%give %kick *] car)  fail
  ?.  =(paths paths.p.car)     fail
  ?.  =(ship ship.p.car)       fail
  ~
::  +ex-fact-paths: expect a fact with paths
::
++  ex-fact-paths
  |=  paths=(list path)
  |=  car=card
  ^-  tang
  =*  fail
    %+  expect-eq:test  !>(`card`car)
    !>(`card`[%give %fact paths *mark *vase])
  ?.  ?=([%give %fact *] car)  fail
  ?.  =(paths paths.p.car)     fail
  ~
::  +test-reel-describe: lure invite registration
::  
::  a lure invite with metadata can be requested from the reel agent.
::  
::  the reel agent registers the invite upon hearing a confirmation
::  from the bait provider.
::
++  test-reel-describe
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (do-init dap reel-agent)
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(now ~2025.9.3, our ~sampel-palnet)))
  ::  a group invite can be requested from reel
  ::
  =+  nonce=(scot %da ~2025.9.3)
  ;<  ~  bind:m   (set-src ~sampel-palnet)
  ;<  caz=(list card)  bind:m  (do-poke reel-describe+!>(['~sampel-palnet/sunrise' group-invite-meta]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-poke /describe [provider %bait] bait-describe+!>([nonce group-invite-meta]))
    ==
  ::  when the agent receives a confirmation, it registers the group invite
  ::  link locally.
  ::
  =+  token=~.0v1
  ;<  *  bind:m  (set-src provider)
  ;<  *  bind:m  (do-poke reel-confirmation+!>([nonce ~.0v1]))
  ;<  =vase  bind:m  get-save
  ;<  =metadata:reel  bind:m  (get-full-peek metadata:reel /x/v1/metadata/~sampel-palnet/sunrise)
  ;<  ~  bind:m
    (ex-equal !>(metadata) !>(group-invite-meta))
  ::  a personal group invite can be requested from reel
  ::
  =+  nonce=(scot %da ~2025.9.3)
  ;<  ~  bind:m   (set-src ~sampel-palnet)
  ;<  caz=(list card)  bind:m  (do-poke reel-describe+!>(['~zod/personal-invite-link' personal-invite-meta]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-poke /describe [provider %bait] bait-describe+!>([nonce personal-invite-meta]))
    ==
  ::  when the agent receives a confirmation, it registers the personal invite
  ::  link locally.
  ::
  =+  token=~.0v2
  ;<  *  bind:m  (set-src provider)
  ;<  *  bind:m  (do-poke reel-confirmation+!>([nonce ~.0v2]))
  ;<  =metadata:reel  bind:m  (get-full-peek metadata:reel /x/v1/metadata/~zod/personal-invite-link)
  ;<  ~  bind:m
    (ex-equal !>(metadata) !>(personal-invite-meta))
  (pure:m ~)
::  +test-groups-update: group metadata update
::
::  a group lure invite metadata are updated by the group host
::  when the group metadata changes.
::
::  when a group is deleted, the group host signals this by setting
::  appropiate field in the link metadata.
::
++  test-groups-update
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(our ~sampel-palnet)))
  ;<  caz=(list card)  bind:m  (do-init dap reel-agent)
  ;<  *  bind:m  (do-agent /groups [~sampel-palnet %groups] %watch-ack ~)
  ;<  *  bind:m  (do-register-invite ~.0v1 group-invite-meta)
  ;<  =metadata:reel  bind:m  
    (get-full-peek metadata:reel /x/v1/metadata/~sampel-palnet/sunrise)
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get by fields.metadata) %'invitedGroupTitle'))
    !>(`'Sunrise')
  ::  when the agent receives group metadata update, it asks the
  ::  provider to update the invite link, and also updates its local
  ::  invite.
  ::
  =/  =r-groups:v7:gv
    =/  =data:meta
      :*  'Early Sunrise' 
          'Sunrise, sunset.' 
          'https://sampel-palnet.arvo.network/early-sunrise.jpg'
          ''
      ==
    [~sampel-palnet^%sunrise %meta data]
  ;<  caz=(list card)  bind:m  
    (do-agent /groups [~sampel-palnet %groups] %fact group-response-1+!>(r-groups))
  =/  update=metadata:reel
    :-  %groups-0
    %-  ~(gas by *(map field:reel cord))
    :~  %'invitedGroupTitle'^'Early Sunrise'
        %'invitedGroupDescription'^'Sunrise, sunset.'
        %'invitedGroupIconImageUrl'^'https://sampel-palnet.arvo.network/early-sunrise.jpg'
    ==
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-poke /update/group [provider %bait] bait-update-group+!>([~sampel-palnet^%sunrise update]))
    ==
  ;<  =metadata:reel  bind:m  
    (get-full-peek metadata:reel /x/v1/metadata/~sampel-palnet/sunrise)
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get by fields.metadata) %'invitedGroupTitle'))
    !>(`'Early Sunrise')
  ;<  =metadata:reel  bind:m  
    (get-full-peek metadata:reel /x/v1/metadata/~sampel-palnet/sunrise)
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get by fields.metadata) %'invitedGroupDescription'))
    !>(`'Sunrise, sunset.')
  ::  when a group is deleted, the group host updates the provider with
  ::  invitedGroupDeleted set to true.
  ::
  =/  =r-groups:v7:gv
    [~sampel-palnet^%sunrise %delete ~]
  ;<  caz=(list card)  bind:m  
    (do-agent /groups [~sampel-palnet %groups] %fact group-response-1+!>(r-groups))
  =/  update=metadata:reel
    :-  %groups-0
    %-  ~(gas by *(map field:reel cord))
    :~  %'invitedGroupDeleted'^'true'
    ==
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-poke /update/group [provider %bait] bait-update-group+!>([~sampel-palnet^%sunrise update]))
    ==
  ;<  =metadata:reel  bind:m  
    (get-full-peek metadata:reel /x/v1/metadata/~sampel-palnet/sunrise)
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get by fields.metadata) %'invitedGroupDeleted'))
    !>(`'true')
  (pure:m ~)
::  +test-contacts-update: user profile update
::
::  both group and personal lure invites are updated 
::  when the user profile metadata changes.
::
::  if no relevant profile fields has been affected, no updates are
::  emitted.
::
++  test-contacts-update
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(our ~sampel-palnet)))
  ;<  caz=(list card)  bind:m  (do-init dap reel-agent)
  ;<  *  bind:m  (do-agent /contacts [~sampel-palnet %contacts] %watch-ack ~)
  ;<  *  bind:m  (do-register-invite ~.0v1 group-invite-meta)
  ;<  *  bind:m  (do-register-invite ~.0v2 personal-invite-meta)
  ;<  =metadata:reel  bind:m  
    (get-full-peek metadata:reel /x/v1/metadata/~sampel-palnet/sunrise)
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get by fields.metadata) %'inviterNickname'))
    !>(`'Sampel Palnet')
  ;<  =metadata:reel  bind:m  
    (get-full-peek metadata:reel /x/v1/metadata/~zod/personal-invite-link)
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get by fields.metadata) %'inviterNickname'))
    !>(`'Sampel Palnet')
  ::  when the agent receives profile metadata update, it asks the
  ::  provider to update the invite link, and also updates its local
  ::  invites.
  ::
  =/  =response:t
    =/  =contact:t
      %-  my
      :~  %nickname^text+'Best Sampel'
          %avatar^look+'https://sampel-palnet.arvo.network/best-sampel.jpg'
          %color^tint+0xff.0000
      ==
    [%self contact]
  ;<  caz=(list card)  bind:m  
    (do-agent /contacts [~sampel-palnet %contacts] %fact contact-response-0+!>(response))
  =/  update=metadata:reel
    :-  %groups-0
    %-  ~(gas by *(map field:reel cord))
    :~  %'inviterNickname'^'Best Sampel'
        %'inviterAvatarImage'^'https://sampel-palnet.arvo.network/best-sampel.jpg'
        %'inviterColor'^'ff.0000'
    ==
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-poke /update/profile [provider %bait] bait-update+!>([~.0v1 update]))
        (ex-poke /update/profile [provider %bait] bait-update+!>([~.0v2 update]))
    ==
  ::  verify that the local personal group invite has been updated
  ::
  ;<  =metadata:reel  bind:m  
    (get-full-peek metadata:reel /x/v1/metadata/~sampel-palnet/sunrise)
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get by fields.metadata) %'inviterNickname'))
    !>(`'Best Sampel')
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get by fields.metadata) %'inviterAvatarImage'))
    !>(`'https://sampel-palnet.arvo.network/best-sampel.jpg')
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get by fields.metadata) %'inviterColor'))
    !>(`'ff.0000')
  ::  verify that the local group invite has been updated
  ::
  ;<  =metadata:reel  bind:m  
    (get-full-peek metadata:reel /x/v1/metadata/~sampel-palnet/sunrise)
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get by fields.metadata) %'inviterNickname'))
    !>(`'Best Sampel')
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get by fields.metadata) %'inviterAvatarImage'))
    !>(`'https://sampel-palnet.arvo.network/best-sampel.jpg')
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get by fields.metadata) %'inviterColor'))
    !>(`'ff.0000')
  ::  verify that unrelated profile updates do not trigger an update
  ::
  =/  =response:t
    =/  =contact:t
      %-  my
      :~  %nickname^text+'Best Sampel'
          %avatar^look+'https://sampel-palnet.arvo.network/best-sampel.jpg'
          %color^tint+0xff.0000
          %groups^set+(sy flag+[~sampel-botnet^%my-group] ~)
      ==
    [%self contact]
  ;<  caz=(list card)  bind:m  
    (do-agent /contacts [~sampel-palnet %contacts] %fact contact-response-0+!>(response))
  ;<  ~  bind:m
    (ex-cards caz ~)
  (pure:m ~)
--
