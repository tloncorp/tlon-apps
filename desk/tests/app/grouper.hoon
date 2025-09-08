/-  reel, gv=groups-ver, c=chat, ch=channels, meta, story
/+  *test-agent, test
/=  grouper-agent  /app/grouper
|%
++  dap  %grouper-test
++  provider  ~loshut-lonreg
++  group-invite-meta
  ^~
  ^-  metadata:reel
  :-  %group-0
  %-  my
  :~  ['inviterUserId' '~sampel-palnet']
      ['inviterNickname' 'Sampel Palnet']
      ['inviterAvatarImage' 'https://sampel-palnet.arvo.network/avatar.png']
      ['invitedGroupTitle' 'Sunrise']
      ['invitedGroupDescription' '']
      ['invitedGroupId' '~sampel-palnet/sunrise']
      ['invitedGroupIconImageUrl' 'https://sampel-palnet.arvo.network/sunrise.jpg']
      ['bite-type' '2']
  ==
++  personal-invite-meta
  ^~
  ^-  metadata:reel
  :-  %group-0
  %-  my
  :~  ['inviterUserId' '~sampel-palnet']
      ['inviterNickname' 'Sampel Palnet']
      ['inviterAvatarImage' 'https://sampel-palnet.arvo.network/avatar.png']
      ['inviteType' 'user']
      ['invitedGroupId' '~zod/personal-invite-link']
      ['bite-type' '2']
  ==
++  get-full-peek
  |*  [=mold =path]
  =/  m  (mare mold)
  ^-  form:m
  |=  =state
  =/  res  ((get-peek path) state)
  ?:  ?=(%| -.res)  res
  =/  peek=(unit (unit cage))
    +<.res
  ?~  peek
    |+~['invalid scry path' (spat path)]
  ?~  u.peek
    |+~['unexpected empty result at scry path' (spat path)]
  ::XX there is a compiler bug here if .q face is missing
  ::   from the peek. it compiles, but fails at runtime when
  ::   the result is dereferenced.
  ::
  &+[!<(mold q.u.u.peek) state]
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
++  scry
  |=  =path
  ^-  (unit vase)
  ?+  path  ~
    [%gu @ %groups @ %$ ~]  `!>(&)
    [%gu @ %groups @ %groups %~.~sampel-palnet %sunrise ~]  `!>(&)

  ==

::  +test-personal-bite: test personal invite bite
::  
::  when a personal bite is received by the grouper agent it issues
::  a dm invitation.
::
++  test-personal-bite
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (set-scry-gate scry)
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(our ~sampel-palnet)))
  ;<  =bowl  bind:m  get-bowl
  ;<  caz=(list card)  bind:m  (do-init dap grouper-agent)
  ;<  *  bind:m  (do-agent /bite-wire [~sampel-palnet %reel] %watch-ack ~)
  =+  joiner=~sampel-botnet
  =/  =bite:reel
    [%bite-2 ~.0v1 joiner personal-invite-meta]
  ;<  caz=(list card)  bind:m  (do-agent /bite-wire [our.bowl %reel] %fact reel-bite+!>(bite))
  =/  =id:c  [our now]:bowl
  =/  =memo:ch
    [~[[%inline ~[[%ship joiner] ' has joined the network']]] id]
  =/  =action:dm:c
    :-  joiner
    [id %add %*(. *essay:ch - memo, kind [%chat %notice ~]) ~]
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-poke /dm/(scot %p joiner)/0v1 [our.bowl %chat] chat-dm-action-1+!>(action))
    ==
  (pure:m ~)
::  +test-group-bite: test group invite bite
::
::  when a group bite is received, a dm invitation is sent, followed
::  by the group invitation, provided the group has enabled invitations.
::  
++  test-group-bite
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (set-scry-gate scry)
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(our ~sampel-palnet)))
  ;<  =bowl  bind:m  get-bowl
  ;<  caz=(list card)  bind:m  (do-init dap grouper-agent)
  ;<  *  bind:m  (do-agent /bite-wire [~sampel-palnet %reel] %watch-ack ~)
  =+  joiner=~sampel-botnet
  =/  =bite:reel
    [%bite-2 ~.0v1 joiner group-invite-meta]
  ;<  *  bind:m  (do-poke grouper-enable+!>('sunrise'))
  ;<  caz=(list card)  bind:m  (do-agent /bite-wire [our.bowl %reel] %fact reel-bite+!>(bite))
  =/  =id:c  [our now]:bowl
  =/  =memo:ch
    [~[[%inline ~[[%ship joiner] ' has joined the network']]] id]
  =/  =action:dm:c
    :-  joiner
    [id %add %*(. *essay:ch - memo, kind [%chat %notice ~]) ~]
  =/  =a-groups:v7:gv
    =/  note=story:story
      ~[inline+~['lure invite ~.0v1']]
    [%invite ~sampel-palnet^%sunrise [joiner ~ `note]]
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-poke-wire /logs)
        (ex-poke /invite [our.bowl %groups] group-action-4+!>(a-groups))
        (ex-poke /dm/(scot %p joiner)/0v1 [our.bowl %chat] chat-dm-action-1+!>(action))
    ==
  (pure:m ~)
--
