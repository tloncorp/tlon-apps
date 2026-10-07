/-  reel, gv=groups-ver, meta, c=chat, cv=chat-ver, ch=channels, story
/+  *test-agent, test, s=subscriber, t=contacts, reel-utils=reel
/=  reel-agent  /app/reel
|%
+$  state-7
  $:  %7
      vic=@t
      civ=ship
      our-profile=contact:t
      our-metadata=(map token:reel metadata:reel)
      open-link-requests=(set (pair ship cord))
      open-describes=(map token:reel ?)
      stable-id=(map cord token:reel)
      =^subs:s
  ==
+$  state-8
  $:  %8
      vic=@t
      civ=ship
      our-profile=contact:t
      our-metadata=(map token:reel metadata:reel)
      open-link-requests=(set (pair ship cord))
      open-describes=(map token:reel ?)
      stable-id=(map cord token:reel)
      =^subs:s
      enabled-groups=(set cord)
      served=(map token:reel metadata:reel)
      served-ids=(jug cord token:reel)
      branch-secret=@t
  ==
++  dap  %reel-test
++  provider  ~loshut-lonreg
++  group-invite-meta
  ^~
  ^-  metadata:reel
  :-  %groups-0
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
  :-  %groups-0
  %-  my
  :~  [%'inviterUserId' '~sampel-palnet']
      [%'inviterNickname' 'Sampel Palnet']
      [%'inviterAvatarImage' 'https://sampel-palnet.arvo.network/avatar.png']
      [%'inviteType' 'user']
      [%'invitedGroupId' '~zod/personal-invite-link']
      [%'bite-type' '2']
  ==
++  my-profile
  ^-  contact:t
  %-  ~(gas by *contact:t)
  :~  %nickname^text+'Sampel Palnet'
  ==
::
++  scry
  |=  =(pole knot)
  ?+  pole  ~|(`path`pole !!)
    [%gu @ %groups @ %groups host=@ term=@ ~]
      `!>(&)
  ::
    [%gx @ %groups @ %v2 %groups host=@ term=@ %group-2 ~]
      `!>(*group:v9:gv)
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
    :~  (ex-poke /bait [provider %reel] bait-describe+!>([nonce (v1:metadata:v0:conv:reel-utils metadata)]))
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
  ;<  ~  bind:m  (set-scry-gate scry)
  ::  a group invite can be requested from reel
  ::
  =/  =nonce:reel  (scot %da ~2025.9.3)
  ;<  ~  bind:m   (set-src ~sampel-palnet)
  ;<  caz=(list card)  bind:m  (do-poke reel-describe+!>(['~sampel-palnet/sunrise' group-invite-meta]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-poke /bait [provider %reel] bait-describe+!>(`[nonce:reel metadata:reel]`[nonce group-invite-meta]))
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
    :~  (ex-poke /bait [provider %reel] bait-describe+!>([nonce personal-invite-meta]))
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
  ;<  ~  bind:m  (set-scry-gate scry)
  ;<  *  bind:m  (do-agent /contacts [~sampel-palnet %contacts] %watch-ack ~)
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
  =/  =r-groups:v9:gv
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
        %'$og_title'^'Tlon Messenger: You\'re Invited to Early Sunrise'
        %'$twitter_title'^'Tlon Messenger: You\'re Invited to Early Sunrise'
    ==
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-poke /bait [provider %reel] bait-update-group+!>([~sampel-palnet^%sunrise update]))
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
  ::  test open-graph metadata update
  ::
  ;<  *  bind:m
    (do-agent /contacts [~sampel-palnet %contacts] %fact contact-response-0+!>([%self my-profile]))
  =/  =r-groups:v9:gv
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
        %'$og_title'^'Tlon Messenger: Sampel Palnet invited you to Early Sunrise'
        %'$twitter_title'^'Tlon Messenger: Sampel Palnet invited you to Early Sunrise'
    ==
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-poke /bait [provider %reel] bait-update-group+!>([~sampel-palnet^%sunrise update]))
    ==
  ::  when a group is deleted, the group host updates the provider with
  ::  invitedGroupDeleted set to true.
  ::
  =/  =r-groups:v9:gv
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
    :~  (ex-poke /bait [provider %reel] bait-update-group+!>([~sampel-palnet^%sunrise update]))
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
  ;<  ~  bind:m  (set-scry-gate scry)
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
  =/  group-update=metadata:reel
    :-  %groups-0
    %-  ~(gas by *(map field:reel cord))
    :~  %'inviterNickname'^'Best Sampel'
        %'inviterAvatarImage'^'https://sampel-palnet.arvo.network/best-sampel.jpg'
        %'inviterColor'^'ff.0000'
        %'$og_title'^'Tlon Messenger: Best Sampel invited you to Sunrise'
        %'$twitter_title'^'Tlon Messenger: Best Sampel invited you to Sunrise'
    ==
  =/  personal-update=metadata:reel
    :-  %groups-0
    %-  ~(gas by *(map field:reel cord))
    :~  %'inviterNickname'^'Best Sampel'
        %'inviterAvatarImage'^'https://sampel-palnet.arvo.network/best-sampel.jpg'
        %'inviterColor'^'ff.0000'
        %'$og_title'^'Tlon Messenger: Best Sampel Sent You an Invite'
        %'$twitter_title'^'Tlon Messenger: Best Sampel Sent You an Invite'
    ==
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-poke /bait [provider %reel] bait-update+!>([~.0v2 personal-update]))
        (ex-poke /bait [provider %reel] bait-update+!>([~.0v1 group-update]))
    ==
  ::  verify that the personal invite has been updated locally
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
  ::  verify that the group invite has been updated locally
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
::  +bite-scry: %groups is running and hosts ~sampel-palnet/sunrise
::
++  bite-scry
  |=  =(pole knot)
  ^-  (unit vase)
  ?+  pole  ~
    [%gu @ * @ %$ ~]  `!>(&)
    [%gu @ * @ %groups %~.~sampel-palnet %sunrise ~]  `!>(&)
  ==
::  +bite-dm: the DM a redeemed bite sends the joiner
::
++  bite-dm
  |=  [=bowl joiner=ship]
  ^-  cage
  =/  =id:c  [our now]:bowl
  =/  =memo:ch
    [~[[%inline ~[[%ship joiner] ' has joined the network']]] id]
  =/  =action:dm:v7:cv
    :-  joiner
    [id %add %*(. *essay:ch - memo, kind [%chat %notice ~]) ~]
  chat-dm-action-2+!>(action)
::  +ex-arvo-wire: assert arvo note wire
::
++  ex-arvo-wire
  |=  =wire
  |=  car=card
  ^-  tang
  =*  fail
    %-  expect-eq:test
    [!>(`card`[%pass wire %arvo *note-arvo]) !>(`card`car)]
  ?.  ?=([%pass * %arvo *] car)  fail
  ?.  =(wire p.car)              fail
  ~
++  get-served-field
  |=  [=token:reel =field:reel]
  =/  m  (mare (unit @t))
  ^-  form:m
  ;<  =metadata:reel  bind:m
    (get-full-peek metadata:reel /x/v1/served/[token])
  (pure:m (~(get by fields.metadata) field))
::  +test-load-7-to-8: absorbing %grouper and %bait
::
::  state-7 loads into state-8 with the new roles empty, rebinds /lure
::  and schedules the eyre binding takeover for a later event.
::
++  test-load-7-to-8
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (do-init dap reel-agent)
  =/  old=state-7
    [%7 'https://tlon.network/lure/' provider *contact:t ~ ~ ~ ~ ~]
  ;<  caz=(list card)  bind:m  (do-load reel-agent `!>(old))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-arvo-wire /eyre/connect)
        (ex-arvo-wire /takeover)
    ==
  ;<  save=vase  bind:m  get-save
  =+  !<(new=state-8 save)
  ;<  ~  bind:m  (ex-equal !>(civ.new) !>(provider))
  ;<  ~  bind:m  (ex-equal !>(enabled-groups.new) !>(*(set cord)))
  (ex-equal !>(served.new) !>(*(map token:reel metadata:reel)))
::  +test-import: %grouper and %bait hand over their old state
::
++  test-import
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(our ~sampel-palnet)))
  ;<  *  bind:m  (do-init dap reel-agent)
  ;<  ~  bind:m  (set-src ~sampel-palnet)
  ;<  *  bind:m
    (do-poke %noun !>([%import-grouper (sy 'sunrise' ~)]))
  ;<  *  bind:m
    %+  do-poke  %noun
    !>([%import-bait (my [~.0v1 group-invite-meta] ~) (my ['~sampel-palnet/sunrise' (sy ~.0v1 ~)] ~) 'secret'])
  ;<  save=vase  bind:m  get-save
  =+  !<(new=state-8 save)
  ;<  ~  bind:m  (ex-equal !>(enabled-groups.new) !>((sy 'sunrise' ~)))
  ;<  ~  bind:m  (ex-equal !>(branch-secret.new) !>('secret'))
  ;<  title=(unit @t)  bind:m  (get-served-field ~.0v1 %'invitedGroupTitle')
  ;<  ~  bind:m  (ex-equal !>(title) !>(`'Sunrise'))
  ::  imports only come from our own agents
  ::
  ;<  ~  bind:m  (set-src ~dev)
  (ex-fail (do-poke %noun !>([%import-grouper (sy 'evil' ~)])))
::  +test-personal-bite: redeeming a personal invite
::
::  a bite from the provider for a personal link sends the joiner a DM.
::
++  test-personal-bite
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (set-scry-gate bite-scry)
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(our ~sampel-palnet)))
  ;<  =bowl  bind:m  get-bowl
  ;<  *  bind:m  (do-init dap reel-agent)
  =+  joiner=~sampel-botnet
  =/  =bite:reel  [%bite-2 ~.0v1 joiner personal-invite-meta]
  ;<  ~  bind:m  (set-src provider)
  ;<  caz=(list card)  bind:m  (do-poke reel-bite+!>(bite))
  %+  ex-cards  caz
  :~  (ex-fact-paths ~[/bites])
      (ex-poke /dm/(scot %p joiner)/0v1 [our.bowl %chat] (bite-dm bowl joiner))
  ==
::  +test-group-bite: redeeming a group invite
::
::  a group bite sends the DM and then a group invite, once lure joins
::  are enabled for the group. only the provider may send bites, and
::  only we may enable a group.
::
++  test-group-bite
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (set-scry-gate bite-scry)
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(our ~sampel-palnet)))
  ;<  =bowl  bind:m  get-bowl
  ;<  *  bind:m  (do-init dap reel-agent)
  =+  joiner=~sampel-botnet
  =/  =bite:reel  [%bite-2 ~.0v1 joiner group-invite-meta]
  ;<  ~  bind:m  (ex-fail ((do-as ~dev) (do-poke grouper-enable+!>('sunrise'))))
  ;<  ~  bind:m  (set-src ~sampel-palnet)
  ;<  *  bind:m  (do-poke grouper-enable+!>('sunrise'))
  ;<  ~  bind:m  (ex-fail ((do-as ~dev) (do-poke reel-bite+!>(bite))))
  ;<  ~  bind:m  (set-src provider)
  ;<  caz=(list card)  bind:m  (do-poke reel-bite+!>(bite))
  =/  =a-groups:v8:gv
    =/  note=story:story
      ~[inline+~['lure invite ~.0v1']]
    [%invite ~sampel-palnet^%sunrise (sy joiner ~) [~ `note]]
  %+  %*(. ex-cards drop-logs |)  caz
  :~  (ex-fact-paths ~[/bites])
      (ex-poke-wire /logs)
      (ex-poke /invite [our.bowl %groups] group-action-4+!>(a-groups))
      (ex-poke /dm/(scot %p joiner)/0v1 [our.bowl %chat] (bite-dm bowl joiner))
  ==
::  +test-serve-describe: registering a link as provider
::
::  a group link is indexed by group id; a personal link is not.
::
++  test-serve-describe
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (do-init dap reel-agent)
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(eny 0v123)))
  =+  nonce=~.0v123.nonce
  ;<  *  bind:m  (set-src ~dev)
  ;<  caz=(list card)  bind:m  (do-poke bait-describe+!>([nonce group-invite-meta]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-poke /confirm/[nonce] [~dev %reel] reel-confirmation+!>([nonce ~.0v123]))
    ==
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(eny 0v456)))
  ;<  caz=(list card)  bind:m  (do-poke bait-describe+!>([nonce personal-invite-meta]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-poke /confirm/[nonce] [~dev %reel] reel-confirmation+!>([nonce ~.0v456]))
    ==
  ;<  save=vase  bind:m  get-save
  =+  !<(new=state-8 save)
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get by served-ids.new) '~sampel-palnet/sunrise'))
    !>(`(unit (set token:reel))`[~ (sy ~.0v123 ~)])
  %+  ex-equal  !>((~(get by served-ids.new) '~zod/personal-invite-link'))
  !>(`(unit (set token:reel))`~)
::  +test-serve-update: updating served links
::
::  anyone with the token can update one link. the group host updates
::  every link for the group, refreshing branch.io for each.
::
++  test-serve-update
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (do-init dap reel-agent)
  ;<  ~  bind:m  (set-src ~dev)
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(eny 0v1)))
  ;<  *  bind:m  (do-poke bait-describe+!>([~.n1 group-invite-meta]))
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(eny 0v2)))
  ;<  *  bind:m  (do-poke bait-describe+!>([~.n2 group-invite-meta]))
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(eny 0v3)))
  ;<  *  bind:m  (do-poke bait-describe+!>([~.n3 group-invite-meta]))
  =/  =metadata:reel
    [%group-0 (my [%'invitedGroupTitle' 'Early Sunrise'] ~)]
  ;<  ~  bind:m  (set-src ~sampel-botnet)
  ;<  caz=(list card)  bind:m  (do-poke bait-update+!>([~.0v1 metadata]))
  ;<  ~  bind:m  (ex-cards caz ~[(ex-arvo-wire /branch/0v1)])
  ;<  title=(unit @t)  bind:m  (get-served-field ~.0v1 %'invitedGroupTitle')
  ;<  ~  bind:m  (ex-equal !>(title) !>(`'Early Sunrise'))
  ;<  title=(unit @t)  bind:m  (get-served-field ~.0v2 %'invitedGroupTitle')
  ;<  ~  bind:m  (ex-equal !>(title) !>(`'Sunrise'))
  ::  a non-host cannot update the group's links
  ::
  ;<  caz=(list card)  bind:m
    (do-poke bait-update-group+!>([~sampel-palnet^%sunrise metadata]))
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  ~  bind:m  (set-src ~sampel-palnet)
  ;<  caz=(list card)  bind:m
    (do-poke bait-update-group+!>([~sampel-palnet^%sunrise metadata]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-arvo-wire /branch/0v2)
        (ex-arvo-wire /branch/0v1)
        (ex-arvo-wire /branch/0v3)
    ==
  ;<  title=(unit @t)  bind:m  (get-served-field ~.0v3 %'invitedGroupTitle')
  (ex-equal !>(title) !>(`'Early Sunrise'))
::  +test-serve-post: redeeming a link over HTTP
::
::  a POST naming the joiner sends a bite to the inviter and answers
::  the request. eyre may watch for the response as a guest.
::
++  test-serve-post
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (do-init dap reel-agent)
  ;<  ~  bind:m  (set-src ~dev)
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(eny 0v1)))
  ;<  *  bind:m  (do-poke bait-describe+!>([~.n1 group-invite-meta]))
  ;<  *  bind:m  ((do-as ~sampel-botnet-dozzod-dozzod) (do-watch /http-response/0vabc))
  =/  =request:http
    :*  %'POST'
        '/lure/0v1'
        ~
        `(as-octs:mimes:html 'ship=%7Esampel-botnet')
    ==
  =/  =inbound-request:eyre
    [authenticated=| secure=& ipv4+.127.0.0.1 request]
  ;<  =bowl  bind:m  get-bowl
  ;<  ~  bind:m  (set-src our.bowl)
  ;<  caz=(list card)  bind:m
    (do-poke handle-http-request+!>([~.0vabc inbound-request]))
  =/  =bite:reel  [%bite-2 ~.0v1 ~sampel-botnet group-invite-meta]
  %+  %*(. ex-cards drop-logs |)  caz
  :~  (ex-poke-wire /logs)
      (ex-poke /bite [~sampel-palnet %reel] reel-bite+!>(bite))
      (ex-fact-paths ~[/http-response/0vabc])
      (ex-fact-paths ~[/http-response/0vabc])
      (ex-kick ~[/http-response/0vabc] ~)
  ==
--
