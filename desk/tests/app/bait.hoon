/-  reel
/+  *test-agent, test
/=  bait-agent  /app/bait
|%
+$  state-2
  $:  %2
      token-metadata=(map token:reel metadata:v0:reel)
  ==
+$  state-3
  $:  %3
      token-metadata=(map token:reel metadata:v1:reel)
      stable-id=(jug cord token:reel)
      branch-secret=@t
  ==
++  dap  %bait-test
++  group-invite-meta
  ^~
  ^-  metadata:v1:reel
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
  ^-  metadata:v1:reel
  :-  %group-0
  %-  my
  :~  [%'inviterUserId' '~sampel-palnet']
      [%'inviterNickname' 'Sampel Palnet']
      [%'inviterAvatarImage' 'https://sampel-palnet.arvo.network/avatar.png']
      [%'inviteType' 'user']
      [%'invitedGroupId' '']
      [%'bite-type' '2']
  ==
++  do-bait-describe
  |=  [id=@uv =metadata:reel]
  =/  m  (mare ,(list card))
  ^-  form:m
  ;<  *  bind:m  (jab-bowl |=(=bowl bowl(eny id)))
  ;<  caz=(list card)  bind:m  (do-poke bait-describe+!>([~.123 metadata]))
  (pure:m caz)
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
++  get-metadata
  |=  id=@uv
  (get-full-peek metadata:reel /x/(scot %uv id)/metadata)
++  get-metadata-field
  |=  [id=@uv =field:reel]
  =/  m  (mare (unit @t))
  ^-  form:m
  ;<  =metadata:reel  bind:m  (get-metadata id)
  (pure:m (~(get by fields.metadata) field))
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
  ?.  =(wire p.car)              fail
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
::  +test-migration-2-to-3: test v2 -> v3 migration
::
::  the v3 migration introduces a stable-id index in the bait agent.
::  this index maps group ids to a set of associated lure invites to
::  facilitate quick lookup when a group metadata are updated.
::
++  test-migration-2-to-3
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  =state-2
    :-  %2
    ^-  (map token:reel metadata:v0:reel)
    %-    my
    :~  :-  ~.0v1 
        ^-  metadata:v0:reel
        :-  %group-0
        %-  my
        :~  'invitedGroupTitle'^'Sunrise' 
            'invitedGroupId'^'~sampel-palnet/sunrise'
            'inviterName'^'~sampel-palnet'
        ==
      ::
        :-  ~.0v2
        ^-  metadata:v0:reel
        :-  %group-0
        %-  my
        :~  'title'^'Sunrise' 
            'group'^'~sampel-palnet/sunrise'
            'inviterName'^'~palfed-samnet'
        ==
      ::
        :-  ~.0v3  
        ^-  metadata:v0:reel
        :-  %group-0
        %-  my
        :~  'inviterUserId'^'~sampel-palnet' 
            'invitedGroupId'^'~zod/personal-invite-link'
            'inviterName'^'~sampel-palnet'
            'inviteType'^'user'
        ==
        
    ==
  ;<  *  bind:m  (do-init dap bait-agent)
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(eny 0v123)))
  ;<  caz=(list card)  bind:m  (do-load bait-agent `!>(state-2))
  ::  the ~sampel-palnet/sunrise group is indexed with two invites.
  ::  the personal invite has not been indexed.
  ::
  ;<  save=vase  bind:m  get-save
  =+  !<(state=state-3 save)
  ;<  ~  bind:m
    %+  ex-equal  
      !>((~(get by stable-id.state) '~sampel-palnet/sunrise'))
    !>(`(unit (set token:reel))`[~ (sy ~.0v1 ~.0v2 ~)])
  ;<  ~  bind:m
    %+  ex-equal  
      !>((~(get by stable-id.state) '~zod/personal-invite-link'))
    !>(`(unit (set token:reel))`~)
  ::  the 0v3 invite has the 'invitedGroupId' field set – it was migrated
  ::  from the old 'group' field
  ::
  ;<  group=(unit @t)  bind:m  (get-metadata-field 0v2 %'invitedGroupId')
  ;<  ~  bind:m  (ex-equal !>(group) !>(`'~sampel-palnet/sunrise'))
  ;<  title=(unit @t)  bind:m  (get-metadata-field 0v2 %'invitedGroupTitle')
  ;<  ~  bind:m  (ex-equal !>(title) !>(`'Sunrise'))
  (pure:m ~)
::  +test-bait-describe: test lure invite registration
::  
::  a lure invite with metadata can be registered in the bait agent.
::  
::  if it is a group invite, a new entry is created in the stable-id
::  index. 
::
::  if it is a personal invite, no entry in the stable-id index
::  is created.
::
++  test-bait-describe
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (do-init dap bait-agent)
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(eny 0v123)))
  ::  a group invite can be registered in the bait agent.
  ::
  =+  nonce=~.0v123.nonce
  ;<  *  bind:m  (set-src ~dev)
  ;<  caz=(list card)  bind:m  (do-poke bait-describe+!>([nonce group-invite-meta]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-poke /confirm/[nonce] [~dev %reel] reel-confirmation+!>([nonce ~.0v123]))
    ==
  ::  a personal invite with metadata can be registered in the bait agent.
  ::
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(eny 0v456)))
  ;<  caz=(list card)  bind:m  (do-poke bait-describe+!>([nonce personal-invite-meta]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-poke /confirm/[nonce] [~dev %reel] reel-confirmation+!>([nonce ~.0v456]))
    ==
  ::  the group invite is recorded in the stable-id index, while
  ::  the personal invite is not recorded.
  ::
  ;<  save=vase  bind:m  get-save
  =+  !<(state=state-3 save)
  ;<  ~  bind:m
    %+  ex-equal  !>(`(unit (set token:reel))`[~ (sy ~.0v123 ~)])
    !>((~(get by stable-id.state) '~sampel-palnet/sunrise'))
  ;<  ~  bind:m
    %+  ex-equal  !>(`(unit (set token:reel))`~)
    !>((~(get by stable-id.state) '~zod/personal-invite-link'))
  (pure:m ~)
::  +test-bait-update: test lure invite update
::
::  a group lure invite can be updated by anyone with the token.
::  ordinary group members do not update the associated invites.
::
::  the group updates all associated lure using the
::  %bait-update-group poke.
::
++  test-bait-update
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (do-init dap bait-agent)
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(eny 0v123)))
  ;<  *  bind:m  (do-bait-describe 0v1 group-invite-meta)
  ;<  *  bind:m  (do-bait-describe 0v2 group-invite-meta)
  ;<  *  bind:m  (do-bait-describe 0v3 group-invite-meta)
  ::  a group lure invite can be updated by anyone with the token.
  ::  ordinary group members do not update the associated invites.
  ::  the provider will also trigger the -bait-update thread.
  ::
  =/  =metadata:reel
    ^-  metadata:reel
    :-  %group-0
    %-  my
    :~  [%'invitedGroupTitle' 'Early Sunrise']
    ==
  ;<  ~  bind:m  (set-src ~sampel-botnet)
  ;<  caz=(list card)  bind:m  (do-poke bait-update+!>([~.0v1 metadata]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-arvo-wire /branch/0v1)
    ==
  ;<  title=(unit @t)  bind:m  (get-metadata-field 0v1 %'invitedGroupTitle')
  ;<  ~  bind:m  (ex-equal !>(title) !>(`'Early Sunrise'))
  ;<  title=(unit @t)  bind:m  (get-metadata-field 0v2 %'invitedGroupTitle')
  ;<  ~  bind:m  (ex-equal !>(title) !>(`'Sunrise'))
  ;<  title=(unit @t)  bind:m  (get-metadata-field 0v3 %'invitedGroupTitle')
  ;<  ~  bind:m  (ex-equal !>(title) !>(`'Sunrise'))
  ::  the group host automatically updates all associated lure invites,
  ::  also triggering branch.io metadata update.
  ::
  ;<  ~  bind:m  (set-src ~sampel-palnet)
  ;<  caz=(list card)  bind:m  
    (do-poke bait-update-group+!>([~sampel-palnet^%sunrise metadata]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-arvo-wire /branch/0v2)
        (ex-arvo-wire /branch/0v1)
        (ex-arvo-wire /branch/0v3)
    ==
  ;<  title=(unit @t)  bind:m  (get-metadata-field 0v2 %'invitedGroupTitle')
  ;<  ~  bind:m  (ex-equal !>(title) !>(`'Early Sunrise'))
  ;<  title=(unit @t)  bind:m  (get-metadata-field 0v3 %'invitedGroupTitle')
  ;<  ~  bind:m  (ex-equal !>(title) !>(`'Early Sunrise'))
  (pure:m ~)
::  +test-invite-post
::
::  a post request from hosting triggers the bait provider
::  to generate a bite.
::
::  the bait provider sends a %reel-bite poke to the inviter.
::  it also sends back an http response.
::
++  test-invite-post
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (do-init dap bait-agent)
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(eny 0v123)))
  ;<  *  bind:m  (do-bait-describe 0v1 group-invite-meta)
  =/  =request:http
    :*  %'POST'
        '/lure/0v1'
        ~
        `(as-octs:mimes:html 'ship=%7Esampel-botnet')
    ==
  =/  =inbound-request:eyre
    :*  authenticated=|
        secure=&
        ipv4+.127.0.0.1
        request
    ==
  ;<  caz=(list card)  bind:m  
    (do-poke handle-http-request+!>([~.0vabc inbound-request]))
  =/  =bite:reel
    [%bite-2 ~.0v1 ~sampel-botnet group-invite-meta]
  %+  %*(. ex-cards drop-logs |)  caz
  :~  (ex-poke-wire /logs)
      (ex-poke /bite [~sampel-palnet %reel] reel-bite+!>(bite))
      (ex-fact-paths ~[/http-response/0vabc])
      (ex-fact-paths ~[/http-response/0vabc])
      (ex-kick ~[/http-response/0vabc] ~)
  ==
--
