/-  reel, gv=groups-ver, meta
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
+$  state-8  _%*(. *state-7 - %8)
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
    :~  (ex-poke /bait [provider %bait] bait-describe+!>([nonce (v1:metadata:v0:conv:reel-utils metadata)]))
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
    :~  (ex-poke /bait [provider %bait] bait-describe+!>(`[nonce:reel metadata:reel]`[nonce group-invite-meta]))
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
    :~  (ex-poke /bait [provider %bait] bait-describe+!>([nonce personal-invite-meta]))
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
        %'$og_title'^'Sato: You\'re Invited to Early Sunrise'
        %'$twitter_title'^'Sato: You\'re Invited to Early Sunrise'
    ==
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-poke /bait [provider %bait] bait-update-group+!>([~sampel-palnet^%sunrise update]))
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
        %'$og_title'^'Sato: Sampel Palnet invited you to Early Sunrise'
        %'$twitter_title'^'Sato: Sampel Palnet invited you to Early Sunrise'
    ==
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-poke /bait [provider %bait] bait-update-group+!>([~sampel-palnet^%sunrise update]))
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
    :~  (ex-poke /bait [provider %bait] bait-update-group+!>([~sampel-palnet^%sunrise update]))
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
        %'$og_title'^'Sato: Best Sampel invited you to Sunrise'
        %'$twitter_title'^'Sato: Best Sampel invited you to Sunrise'
    ==
  =/  personal-update=metadata:reel
    :-  %groups-0
    %-  ~(gas by *(map field:reel cord))
    :~  %'inviterNickname'^'Best Sampel'
        %'inviterAvatarImage'^'https://sampel-palnet.arvo.network/best-sampel.jpg'
        %'inviterColor'^'ff.0000'
        %'$og_title'^'Sato: Best Sampel Sent You an Invite'
        %'$twitter_title'^'Sato: Best Sampel Sent You an Invite'
    ==
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-poke /bait [provider %bait] bait-update+!>([~.0v2 personal-update]))
        (ex-poke /bait [provider %bait] bait-update+!>([~.0v1 group-update]))
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
::  +titled: metadata with an open-graph title
::
++  titled
  |=  [=metadata:reel title=@t]
  ^-  metadata:reel
  %=  metadata  fields
    (~(gas by fields.metadata) ~[%'$og_title'^title %'$twitter_title'^title])
  ==
::  +profile-update: expected bait update for a profile without avatar
::  or color
::
++  profile-update
  |=  [nickname=@t title=(unit @t)]
  ^-  metadata:reel
  :-  %groups-0
  %-  ~(gas by *(map field:reel cord))
  %+  weld
    ^-  (list [field:reel cord])
    :~  %'inviterNickname'^nickname
        %'inviterAvatarImage'^''
        %'inviterColor'^''
    ==
  ^-  (list [field:reel cord])
  ?~  title  ~
  ~[%'$og_title'^u.title %'$twitter_title'^u.title]
::  +ex-load-timer: expect the profile update timer within a day of .now
::
++  ex-load-timer
  |=  now=@da
  |=  car=card
  ^-  tang
  ?.  ?=([%pass [%load %profile ~] %arvo %b %wait @] car)
    (expect-eq:test !>(`card`[%pass /load/profile %arvo %b %wait now]) !>(car))
  =*  wen  +>+>+.car
  ?:  &((gte wen now) (lth wen (add now ~d1)))  ~
  ['timer outside of a day from now' >wen< ~]
::  +do-migrate-7: load a state-7 and fire the profile update timer
::
++  do-migrate-7
  |=  [=contact:t md=(map token:reel metadata:reel)]
  =/  m  (mare ,(list card))
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(our ~sampel-palnet)))
  ;<  *  bind:m  (do-init dap reel-agent)
  ;<  ~  bind:m
    %-  set-scry-gate
    |=  =(pole knot)
    ?:  ?=([%gx @ %contacts @ %v1 %self %contact-1 ~] pole)
      `!>(contact)
    (scry pole)
  =/  old=state-7
    :*  %7
        'https://tlon.network/lure/'
        provider
        contact
        md
        ~
        ~
        %-  ~(gas by *(map cord token:reel))
        %+  murn  ~(tap by md)
        |=  [=token:reel =metadata:reel]
        ?~  id=(~(get by fields.metadata) %'invitedGroupId')  ~
        `[u.id token]
        ~
    ==
  ;<  =bowl  bind:m  get-bowl
  ;<  caz=(list card)  bind:m  (do-load reel-agent `!>(old))
  ;<  ~  bind:m  (ex-cards caz (ex-load-timer now.bowl) ~)
  (do-arvo /load/profile %behn %wake ~)
::  +test-load-7-titles-nickname: v7 -> v8 retitles links
::
::  loading a state-7 schedules the profile update, which rewrites the
::  open-graph title of every group and personal link, whether or not we
::  host the group, and sends each link to the provider. links of an
::  unknown type keep their title.
::
++  test-load-7-titles-nickname
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  forest-meta=metadata:reel
    :-  %groups-0
    %-  my
    :~  [%'inviterUserId' '~sampel-palnet']
        [%'inviteType' 'group']
        [%'invitedGroupTitle' 'Forest']
        [%'invitedGroupId' '~zod/forest']
        [%'bite-type' '2']
    ==
  =/  other-meta=metadata:reel
    :-  %groups-0
    %-  my
    :~  [%'inviterUserId' '~sampel-palnet']
        [%'inviteType' 'other']
        [%'invitedGroupId' '~sampel-palnet/other']
        [%'bite-type' '2']
    ==
  =/  md=(map token:reel metadata:reel)
    %-  my
    :~  :-  ~.0v1
        (titled group-invite-meta 'Tlon Messenger: Sampel Palnet invited you to Sunrise')
        :-  ~.0v2
        (titled personal-invite-meta 'Tlon Messenger: Sampel Palnet Sent You an Invite')
        [~.0v3 forest-meta]
        [~.0v4 (titled other-meta 'Tlon Messenger: Other')]
    ==
  ;<  caz=(list card)  bind:m  (do-migrate-7 my-profile md)
  =/  group-title  'Sato: Sampel Palnet invited you to Sunrise'
  =/  personal-title  'Sato: Sampel Palnet Sent You an Invite'
  =/  forest-title  'Sato: Sampel Palnet invited you to Forest'
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-poke /bait [provider %bait] bait-update+!>([~.0v2 (profile-update 'Sampel Palnet' `personal-title)]))
        (ex-poke /bait [provider %bait] bait-update+!>([~.0v4 (profile-update 'Sampel Palnet' ~)]))
        (ex-poke /bait [provider %bait] bait-update+!>([~.0v1 (profile-update 'Sampel Palnet' `group-title)]))
        (ex-poke /bait [provider %bait] bait-update+!>([~.0v3 (profile-update 'Sampel Palnet' `forest-title)]))
    ==
  ;<  =vase  bind:m  get-save
  =+  !<(new=state-8 vase)
  =/  title
    |=  [=token:reel =field:reel]
    (~(get by fields:(~(got by our-metadata.new) token)) field)
  ;<  ~  bind:m  (ex-equal !>((title ~.0v1 %'$og_title')) !>(`group-title))
  ;<  ~  bind:m  (ex-equal !>((title ~.0v1 %'$twitter_title')) !>(`group-title))
  ;<  ~  bind:m  (ex-equal !>((title ~.0v2 %'$og_title')) !>(`personal-title))
  ;<  ~  bind:m  (ex-equal !>((title ~.0v2 %'$twitter_title')) !>(`personal-title))
  ;<  ~  bind:m  (ex-equal !>((title ~.0v3 %'$og_title')) !>(`forest-title))
  ;<  ~  bind:m  (ex-equal !>((title ~.0v3 %'$twitter_title')) !>(`forest-title))
  ;<  ~  bind:m
    (ex-equal !>((title ~.0v4 %'$og_title')) !>(`'Tlon Messenger: Other'))
  (ex-equal !>(our-profile.new) !>(my-profile))
::  +test-load-7-titles-no-nickname: v7 -> v8 retitles links
::
::  the update runs even though the profile has not changed and has no
::  nickname, avatar or color to compare.
::
++  test-load-7-titles-no-nickname
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  md=(map token:reel metadata:reel)
    %-  my
    :~  [~.0v1 (titled group-invite-meta 'Tlon Messenger: You\'re Invited to Sunrise')]
        [~.0v2 (titled personal-invite-meta 'Tlon Messenger: You\'ve Been Invited')]
    ==
  ;<  caz=(list card)  bind:m  (do-migrate-7 *contact:t md)
  =/  group-title  'Sato: You\'re Invited to Sunrise'
  =/  personal-title  'Sato: You\'ve Been Invited'
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-poke /bait [provider %bait] bait-update+!>([~.0v2 (profile-update '' `personal-title)]))
        (ex-poke /bait [provider %bait] bait-update+!>([~.0v1 (profile-update '' `group-title)]))
    ==
  ;<  =vase  bind:m  get-save
  =+  !<(new=state-8 vase)
  =/  title
    |=  [=token:reel =field:reel]
    (~(get by fields:(~(got by our-metadata.new) token)) field)
  ;<  ~  bind:m  (ex-equal !>((title ~.0v1 %'$og_title')) !>(`group-title))
  ;<  ~  bind:m  (ex-equal !>((title ~.0v1 %'$twitter_title')) !>(`group-title))
  ;<  ~  bind:m  (ex-equal !>((title ~.0v2 %'$og_title')) !>(`personal-title))
  ;<  ~  bind:m  (ex-equal !>((title ~.0v2 %'$twitter_title')) !>(`personal-title))
  (ex-equal !>(our-profile.new) !>(*contact:t))
::  +test-load-8: reloading a state-8 does not retitle links again
::
++  test-load-8
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(our ~sampel-palnet)))
  ;<  *  bind:m  (do-init dap reel-agent)
  ;<  ~  bind:m  (set-scry-gate scry)
  ;<  *  bind:m  (do-register-invite ~.0v2 personal-invite-meta)
  ;<  caz=(list card)  bind:m  (do-load reel-agent ~)
  (ex-cards caz ~)
--
