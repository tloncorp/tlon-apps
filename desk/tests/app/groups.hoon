::  groups subscriber unit tests
::
/-  g=groups, gv=groups-ver, cv=channels-ver, meta, s=story
/+  *test, *test-negotiate-agent
/+  gc=groups-conv
/=  groups-agent  /app/groups
|%
::NOTE  do not adjust agent name, as this will break lib-negotiate.
::
++  my-agent  %groups
++  my-flag  `flag:g`[~zod %my-test-group]
++  my-area  `path`/groups/~zod/my-test-group
++  my-group
  ^-  group:g
  :*  meta=[title='My Test Group' description='A testing group' image='' cover='']
    ::
      blob=~
    ::
      ^=  admissions
      :*  privacy=%public
          banned=[ships=~ ranks=~]
          pending=~
          requests=~
          tokens=~
          referrals=~
          invited=~
      ==
    ::
      seats=[n=[p=~zod q=[roles=[n=%admin l=~ r=~] joined=~2000.1.1]] l=~ r=~]
    ::
      ^=  roles
      :-
      :-  p=%admin
          :_  ~
          :*  title='Admin'
              description='Admins can add and remove channels and edit metadata'
              image=''
              cover=''
          ==
      [~ ~]
    ::
      admins=[n=%admin l=~ r=~]
    ::
      channels=~
    ::
      active-channels=~
    ::
      ^=  sections
      :-  :-  p=%default
          :-  meta=[title='Sectionless' description='' image='' cover='']
              order=~
      [~ ~]
    ::
      section-order=[i=%default t=~]
    ::
      flagged-content=~
  ==
++  tick  ^~((div ~s1 (bex 16)))
::
++  my-scry-gate
  |=  =path
  ^-  (unit vase)
  ?+    path  ~
    [%gu ship=@ %activity now=@ rest=*]         `!>(|)
    [%gx ship=@ %chat now=@ %blocked %ships ~]  `!>(~)
  ::
      [%gx ship=@ %groups now=@ %~.~ %negotiate %status ship=@ agent=@ %noun ~]
    `!>(%match)
  ==
++  do-groups-init
  =/  m  (mare ,(list card))
  ^-  form:m
  ;<  ~  bind:m  (set-scry-gate my-scry-gate)
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(our ~dev)))
  (do-init my-agent groups-agent)
:: ++  ex-res
::   |=  [caz=(list card) us-groups=(list u-group:v7:gv)]
::   =/  m  (mare ,~)
::   ^-  form:m
::   ;<  =bowl:gall  bind:m  get-bowl
::   %+  ex-cards  caz
::   (turn us-groups (cury ex-update now.bowl))
::
:: ++  ex-update
::   |=  [=time =u-group:v7:gv]
::   %+  ex-fact
::     ~[/server/groups/~zod/my-test-group/updates/~zod/(scot:h136 %da *@da)]
::   group-update+!>(`update:g`[time u-group])
++  go-area  /groups/(scot %p p:my-flag)/[q:my-flag]
++  fi-area  /foreigns/(scot %p p:my-flag)/[q:my-flag]
::
++  ex-c-group
  |=  =c-group:g
  (ex-poke (weld go-area /command/[-.c-group]) [~zod my-agent] group-command+!>([%group my-flag c-group]))
::
++  ex-gang-response
  |=  =foreign:g
  =/  =gang:v2:gv
    %-  gang:v2:foreign:v7:gc
    (v7:foreign:v10:gc foreign)
  (ex-fact ~[/gangs/updates] gangs+!>(`gangs:v2:gv`(my my-flag^gang ~)))
::
++  ex-foreign-response
  |=  =foreign:g
  =/  foreign-8  (v8:foreign:v10:gc foreign)
  (ex-fact ~[/v1/foreigns] foreigns-1+!>(`foreigns:v8:gv`(my my-flag^foreign-8 ~)))
::
++  do-a-groups
  |=  =a-groups:g
  =/  m  (mare ,(list card))
  ^-  form:m
  ;<  ~  bind:m  (wait ~m1)
  (do-poke group-action-5+!>(`a-groups:v11:gv`a-groups))
::
++  do-a-group
  |=  =a-group:g
  =/  m  (mare ,(list card))
  ^-  form:m
  ;<  ~  bind:m  (wait ~m1)
  =/  =a-groups:g  [%group my-flag a-group]
  (do-poke group-action-5+!>(`a-groups:v11:gv`a-groups))
::
++  do-a-foreigns
  |=  =a-foreigns:g
  =/  m  (mare ,(list card))
  ^-  form:m
  ;<  ~  bind:m  (wait ~m1)
  (do-poke group-foreign-2+!>(`a-foreigns:v9:gv`a-foreigns))
::
++  do-a-foreign
  |=  =a-foreign:g
  =/  m  (mare ,(list card))
  ^-  form:m
  ;<  ~  bind:m  (wait ~m1)
  =/  =a-foreigns:g  [%foreign my-flag a-foreign]
  (do-poke group-foreign-2+!>(`a-foreigns:v9:gv`a-foreigns))
::
++  ex-r-groups
  |=  [caz=(list card) rs-groups=(list r-groups:g)]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  =bowl:gall  bind:m  get-bowl
  ;<  peek=cage  bind:m  (got-peek /x/v3/groups/~zod/my-test-group)
  =+  !<(=group:g q.peek)
  %+  ex-cards  caz
  %-  zing
  %+  turn  rs-groups
  |=  =r-groups:g
  ^-  (list $-(card tang))
  =/  r-group-10=(unit r-group:v10:gv)
    (v10:r-group:v11:gc r-group.r-groups)
  =/  r-group-9=(unit r-group:v9:gv)
    (v9:r-group:v11:gc r-group.r-groups)
  =/  actions-2=(list action:v2:gv)
    ?~  r-group-9  ~
    %+  turn
      (diff:v2:r-group:v9:gc u.r-group-9 [seats admissions]:group)
    |=  =diff:v2:gv
    [flag.r-groups now.bowl diff]
  ;:  welp
    :_  ~
    %+  ex-fact  ~[/v3/groups /v3/groups/~zod/my-test-group]
    group-response-3+!>(`r-groups:v11:gv`r-groups)
  ::
    ?~  r-group-10  ~
    :_  ~
    %+  ex-fact  ~[/v2/groups /v2/groups/~zod/my-test-group]
    group-response-2+!>(`r-groups:v10:gv`[flag.r-groups u.r-group-10])
  ::
    ?~  r-group-9  ~
    :_  ~
    %+  ex-fact  ~[/v1/groups /v1/groups/~zod/my-test-group]
    group-response-1+!>(`r-groups:v9:gv`[flag.r-groups u.r-group-9])
  ::
    %+  turn  actions-2
    |=  =action:v2:gv
    (ex-fact ~[/groups/ui] group-action-3+!>(action))
  ==
::
++  ex-cards-r-groups
  |=  $:  caz=(list card)
          exes=(list (each $-(card tang) r-groups:g))
      ==
  =/  m  (mare ,~)
  ^-  form:m
  ::  extract group - it is needed for facts down-conversion
  ::
  ;<  =bowl:gall  bind:m  get-bowl
  ;<  peek=cage  bind:m  (got-peek /x/v3/groups/~zod/my-test-group)
  =+  !<(=group:g q.peek)
  ::  assemble expected
  ::
  %+  ex-cards  caz
  %-  flop
  %+  roll  exes
  |=  [exe=(each $-(card tang) r-groups:g) out=(list $-(card tang))]
  ?:  ?=(%& -.exe)
    ::  expected card
    ::
    [p.exe out]
  ::  expected r-groups
  ::
  =*  r-groups  p.exe
  =/  r-group-10=(unit r-group:v10:gv)
    (v10:r-group:v11:gc r-group.r-groups)
  =/  r-group-9=(unit r-group:v9:gv)
    (v9:r-group:v11:gc r-group.r-groups)
  =/  actions-2=(list action:v2:gv)
    ?~  r-group-9  ~
    %+  turn
      (diff:v2:r-group:v9:gc u.r-group-9 [seats admissions]:group)
    |=  =diff:v2:gv
    [flag.r-groups now.bowl diff]
  ;:  welp
    %+  turn  actions-2
    |=  =action:v2:gv
    (ex-fact ~[/groups/ui] group-action-3+!>(action))
  ::
    ?~  r-group-9  ~
    :_  ~
    %+  ex-fact  ~[/v1/groups /v1/groups/~zod/my-test-group]
    group-response-1+!>(`r-groups:v9:gv`[flag.r-groups u.r-group-9])
  ::
    ?~  r-group-10  ~
    :_  ~
    %+  ex-fact  ~[/v2/groups /v2/groups/~zod/my-test-group]
    group-response-2+!>(`r-groups:v10:gv`[flag.r-groups u.r-group-10])
  ::
    :_  out
    %+  ex-fact  ~[/v3/groups /v3/groups/~zod/my-test-group]
    group-response-3+!>(`r-groups:v11:gv`r-groups)
  ==
::
++  get-invite
  |=  tok=(unit token:g)
  =/  m  (mare ,invite:v8:gv)
  ^-  form:m
  ;<  =bowl  bind:m  get-bowl
  ;<  peek=cage  bind:m  (got-peek /x/groups/(scot %p p:my-flag)/[q:my-flag]/preview)
  =+  preview=!<(preview:g q.peek)
  =/  =invite:v8:gv
    :*  my-flag
        now.bowl
        our.bowl
        tok
        ~        ::  note
        preview  ::  preview
        &
    ==
  (pure:m invite)
::
++  do-join-group  (do-join-this-group my-group)
::
++  do-join-this-group
  |=  =group:g
  =/  m  (mare (list card))
  ^-  form:m
  ;<  caz=(list card)  bind:m  (do-a-foreigns [%foreign my-flag %join ~])
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-poke (weld fi-area /join/public) [~zod my-agent] group-command+!>([%join my-flag ~]))
        (ex-foreign-response %*(. *foreign:g progress `%join))
        (ex-gang-response %*(. *foreign:g progress `%join))
    ==
  ;<  caz=(list card)  bind:m
    %-  (do-as ~zod)
    %^  do-agent  (weld fi-area /join/public)
      my-flag
    [%poke-ack ~]
  ;<  ~  bind:m
    =/  =wire  (weld go-area /updates)
    =/  sub=path
      %+  weld  `path`[%server go-area]
      /updates/~dev/(scot:h136 %da *@da)
    %+  ex-cards  caz
    :~  (ex-task wire [~zod my-agent] %watch sub)
        (ex-foreign-response %*(. *foreign:g progress `%watch))
        (ex-gang-response %*(. *foreign:g progress `%watch))
    ==
  ;<  =bowl  bind:m  get-bowl
  ;<  *  bind:m
    %^  do-agent  (weld go-area /updates)
      [~zod my-agent]
    [%watch-ack ~]
  =/  init-log=log:g
    %+  gas:log-on:g  *log:g
    ^-  (list [@da u-group:g])
    :~  now.bowl^[%create group]
    ==
  ;<  caz=(list card)  bind:m
    %^  do-agent  (weld go-area /updates)
      [~zod my-agent]
    [%fact group-log+!>(init-log)]
  (pure:m caz)
::
::  +test-can-write-resolves-for-a-non-member: a ship holding no seat must
::  make this scry resolve to ~, not to no-such-path.
::
::  Both readers of it use .^ and then ?~ on a unit -- lib/channel-utils
::  +can-write, and %buckets +group-can-write. A scry that resolves to nothing
::  does not hand them ~, it crashes the event. So answering [~ ~] here meant
::  a stranger or an ex-member writing to any channel took the event down
::  instead of being denied.
::
++  test-can-write-resolves-for-a-non-member
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  do-groups-init
  ;<  *  bind:m  do-join-group
  ::  the group's only seat is ~zod, so ~fun holds none
  ;<  stranger=cage  bind:m
    (got-peek /x/v2/groups/~zod/my-test-group/channels/chat/~zod/general/can-write/~fun)
  ;<  seated=cage  bind:m
    (got-peek /x/v2/groups/~zod/my-test-group/channels/chat/~zod/general/can-write/~zod)
  =/  perms
    |=  caz=cage
    ^-  (unit [admin=? roles=(set role-id:v7:gv)])
    !<((unit [admin=? roles=(set role-id:v7:gv)]) q.caz)
  =/  absent  (perms stranger)
  =/  present  (perms seated)
  (ex-equal !>([absent ?~(present | admin.u.present)]) !>([~ &]))
::
++  test-join-group
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  do-groups-init
  ;<  caz=(list card)  bind:m  do-join-group
  ;<  ~  bind:m
    %+  ex-r-groups  caz
    :~  [my-flag %create my-group]
    ==
  (pure:m ~)
::  +test-light-scries-count-every-seat: the init and changes scries
::  truncate a big group's seats, but still report its full member count
::
::  +drop-seats keeps ours and 14 others. The changes scries built their
::  group-ui from that light group, and the init scries' recount read the
::  light group too (the group-ui's own .group face shadowed the full one),
::  so a group of 20 reported 15.
::
++  test-light-scries-count-every-seat
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  =group:g  my-group
  =.  seats.group
    %-  ~(gas by seats.group)
    %+  turn  (gulf 1 19)
    |=(i=@ [`ship`i [~ ~2000.1.1]])
  ;<  *  bind:m  do-groups-init
  ;<  *  bind:m  (do-join-this-group group)
  =/  since=@ta  (scot %da *@da)
  ;<  in-2=cage  bind:m  (got-peek /x/v2/init)
  ;<  in-3=cage  bind:m  (got-peek /x/v3/init)
  ;<  in-4=cage  bind:m  (got-peek /x/v4/init)
  ;<  ch-1=cage  bind:m  (got-peek /x/v1/changes/[since])
  ;<  ch-2=cage  bind:m  (got-peek /x/v2/changes/[since])
  ;<  ch-3=cage  bind:m  (got-peek /x/v3/changes/[since])
  =/  init-2
    %.  my-flag
    %~  got  by
    -:!<([(map flag:v7:gv group-ui:v7:gv) foreigns:v8:gv] q.in-2)
  =/  init-3
    %.  my-flag
    %~  got  by
    -:!<([(map flag:v9:gv group-ui:v9:gv) foreigns:v8:gv] q.in-3)
  =/  init-4
    %.  my-flag
    %~  got  by
    -:!<([(map flag:v11:gv group-ui:v11:gv) foreigns:v8:gv] q.in-4)
  =/  ui-1  (~(got by !<((map flag:v5:gv group-ui:v5:gv) q.ch-1)) my-flag)
  =/  ui-2  (~(got by !<((map flag:v9:gv group-ui:v9:gv) q.ch-2)) my-flag)
  =/  ui-3  (~(got by !<((map flag:v11:gv group-ui:v11:gv) q.ch-3)) my-flag)
  ::  the seats are still dropped; only the count covers them all
  ::
  ;<  ~  bind:m
    %+  ex-equal
      !>([~(wyt by seats.group.init-4) ~(wyt by seats.group.ui-3)])
    !>([15 15])
  %+  ex-equal
    !>  :*  init-2=member-count.init-2
            init-3=member-count.init-3
            init-4=member-count.init-4
            changes-1=count.ui-1
            changes-2=member-count.ui-2
            changes-3=member-count.ui-3
        ==
  !>([init-2=20 init-3=20 init-4=20 changes-1=20 changes-2=20 changes-3=20])
::  +initial-nest: a channel the test group arrives with
::
++  initial-nest  ^-(nest:g [%chat ~zod %general])
::
++  set-channels-joined
  |=  joined=?
  %-  set-scry-gate
  |=  =path
  ?:  ?=([%gu @ %channels @ *] path)  `!>(joined)
  (my-scry-gate path)
::
++  do-channels-response
  |=  =r-channel:v7:cv
  %^  do-agent  /channels
    [~dev %channels]
  =/  =r-channels:v7:cv  [[%chat ~zod %general] r-channel]
  [%fact channel-response-2+!>(r-channels)]
::  +do-join-initial-channel: join a group that arrives with
::  +initial-nest, which %channels then joins
::
++  do-join-initial-channel
  =/  m  (mare ,~)
  ^-  form:m
  =/  =channel:g
    :*  meta=[title='General' description='' image='' cover='']
        added=~2000.1.1
        section=%default
        readers=~
        join=&
    ==
  =/  =group:g  my-group
  ;<  *  bind:m  do-groups-init
  ;<  ~  bind:m  (set-channels-joined |)
  ;<  *  bind:m
    (do-join-this-group group(channels (my initial-nest^channel ~)))
  ;<  *  bind:m  (do-channels-response %join my-flag)
  (set-channels-joined &)
::
++  ex-left-initial-channel
  |=  caz=(list card)
  %+  ex-cards  caz
  :~  %+  ex-fact  ~[/v2/groups]
      group-response-2+!>(`r-groups:v10:gv`[my-flag %active-channel initial-nest |])
    ::
      %+  ex-fact  ~[/v3/groups]
      group-response-3+!>(`r-groups:v11:gv`[my-flag %active-channel initial-nest |])
  ==
::  +test-leave-initial-channel: leaving a channel the group arrived with
::  takes it out of .active-channels and tells subscribers so.
::
::  Such a channel was only ever indexed when added after the join, so
::  %channels' %leave for it was dropped: %groups kept it active, and a
::  client's next init marked the channel joined again.
::
++  test-leave-initial-channel
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  do-join-initial-channel
  ;<  caz=(list card)  bind:m  (do-channels-response %leave ~)
  (ex-left-initial-channel caz)
::  +test-leave-initial-channel-after-reload: a group joined before its
::  initial channels were indexed has them indexed on reload.
::
++  test-leave-initial-channel-after-reload
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  do-join-initial-channel
  ::  drop the index, as a ship that joined before the fix has it
  ::
  ;<  save=vase  bind:m  get-save
  =.  save
    ;:  slop
      (slot 2 save)  ::  lib discipline
      (slot 6 save)  ::  lib negotiate
      (slap (slot 7 save) (ream '.(channels-index ~)'))
    ==
  ;<  *  bind:m  (do-load groups-agent `save)
  ;<  *  bind:m  (do-arvo /load/active-channels %behn %wake ~)
  ;<  caz=(list card)  bind:m  (do-channels-response %leave ~)
  (ex-left-initial-channel caz)
::  +test-a-foreigns-revoke: test invite revocation
::
++  test-a-foreigns-revoke
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  do-groups-init
  ::  receive a public and a private group invitation from ~fun
  ::
  ;<  =bowl:gall  bind:m  get-bowl
  =/  public=invite:v8:gv
    :*  ~nec^%nec-public
        now.bowl
        ~fun
        ~               ::  token
        ~               ::  note
        *preview:v8:gv  ::  preview
        &
    ==
  =/  private=invite:v8:gv
    :*  ~nec^%nec-private
        now.bowl
        ~fun
        `0v123          ::  token
        ~               ::  note
        *preview:v8:gv  ::  preview
        &
    ==
  ;<  *  bind:m
    %-  (do-as ~fun)
    (do-poke group-foreign-2+!>([%invite public]))
  ;<  *  bind:m
    %-  (do-as ~fun)
    (do-poke group-foreign-2+!>([%invite private]))
  ;<  ~  bind:m
    ;<  peek=cage  bind:m  (got-peek /x/v1/foreigns/~nec/nec-public)
    =+  foreign=!<(foreign:v8:gv q.peek)
    %+  ex-equal  !>(invites.foreign)
    !>(~[public])
  ;<  ~  bind:m
    ;<  peek=cage  bind:m  (got-peek /x/v1/foreigns/~nec/nec-private)
    =+  foreign=!<(foreign:v8:gv q.peek)
    %+  ex-equal  !>(invites.foreign)
    !>(~[private])
  ::  verify that the invitations can't be revoked by a third-party
  ::
  ;<  *  bind:m
    %-  (do-as ~fed)
    (do-poke group-foreign-2+!>([%revoke ~nec^%nec-public ~]))
  ;<  ~  bind:m
    ;<  peek=cage  bind:m  (got-peek /x/v1/foreigns/~nec/nec-public)
    =+  foreign=!<(foreign:v8:gv q.peek)
    %+  ex-equal  !>(invites.foreign)
    !>(~[public])
  ;<  *  bind:m
    %-  (do-as ~fed)
    (do-poke group-foreign-2+!>([%revoke ~nec^%nec-private `0v123]))
  ;<  ~  bind:m
    ;<  peek=cage  bind:m  (got-peek /x/v1/foreigns/~nec/nec-private)
    =+  foreign=!<(foreign:v8:gv q.peek)
    %+  ex-equal  !>(invites.foreign)
    !>(~[private])
  ::  verify that the invitations can be revoked by the inviter
  ::
  ;<  *  bind:m
    %-  (do-as ~fun)
    (do-poke group-foreign-2+!>([%revoke ~nec^%nec-public ~]))
  ;<  ~  bind:m
    ;<  peek=cage  bind:m  (got-peek /x/v1/foreigns/~nec/nec-public)
    =+  foreign=!<(foreign:v8:gv q.peek)
    %+  ex-equal  !>(invites.foreign)
    !>(~[public(valid |)])
  ;<  *  bind:m
    %-  (do-as ~fun)
    (do-poke group-foreign-2+!>([%revoke ~nec^%nec-private `0v123]))
  ;<  ~  bind:m
    ;<  peek=cage  bind:m  (got-peek /x/v1/foreigns/~nec/nec-private)
    =+  foreign=!<(foreign:v8:gv q.peek)
    %+  ex-equal  !>(invites.foreign)
    !>(~[private(valid |)])
  (pure:m ~)
::  +test-public-invites: test public group invitations
::
::  a group member can send an invite to a public group
::  without requiring a token.
::
::  the invitee is recorded on the invited list.
::
::  when another invite is sent to the same ship,
::  the previous invite is revoked first.
::
++  test-public-invites
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  do-groups-init
  ;<  *  bind:m  do-join-group
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(src ~dev)))
  ::  invite ~fun to a public group
  ::
  ;<  caz=(list card)  bind:m
    (do-a-groups [%invite my-flag (sy ~fun ~) ~ ~])
  ::  verify invite is sent
  ::
  ;<  =bowl  bind:m  get-bowl
  ;<  peek=cage  bind:m  (got-peek /x/groups/(scot %p p:my-flag)/[q:my-flag]/preview)
  =+  preview=!<(preview:g q.peek)
  ;<  ~  bind:m
    =/  =invite:v8:gv
      :*  my-flag
          now.bowl
          our.bowl
          ~        ::  token
          ~        ::  note
          preview  ::  preview
          &
      ==
    =/  a-foreigns-7-fun=a-foreigns:v7:gv
      [%invite (v7:invite:v8:gc invite)]
    =/  a-foreigns-8-fun=a-foreigns:v8:gv
      [%invite invite]
    %+  ex-cards  caz
    :~  (ex-poke (weld go-area /invite/send/~fun) [~fun my-agent] group-foreign-2+!>(a-foreigns-8-fun))
    ==
  ::  verify the invitee is recorded on the invited list
  ::
  ;<  peek=cage  bind:m
    (got-peek /x/v3/groups/(scot %p p:my-flag)/[q:my-flag])
  =+  group=!<(group:g q.peek)
  ::  verify records on the invited list
  ::
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get by invited.admissions.group) ~fun))
    !>(`[now.bowl ~])
  ::  repeat the invite
  ::
  ;<  caz=(list card)  bind:m
    (do-a-groups [%invite my-flag (sy ~fun ~) ~ ~])
  ;<  =^bowl  bind:m  get-bowl
  ;<  peek=cage  bind:m  (got-peek /x/groups/(scot %p p:my-flag)/[q:my-flag]/preview)
  =+  preview=!<(preview:g q.peek)
  ;<  ~  bind:m
    =/  =invite:v8:gv
      :*  my-flag
          now.bowl
          our.bowl
          ~        ::  token
          ~        ::  note
          preview  ::  preview
          &
      ==
    =/  a-foreigns-7-fun=a-foreigns:v7:gv
      [%invite (v7:invite:v8:gc invite(time now.bowl))]
    =/  a-foreigns-8-fun=a-foreigns:v8:gv
      [%invite invite(time now.bowl)]
    %+  ex-cards  caz
    :~  (ex-poke (weld go-area /invite/revoke/~fun) [~fun my-agent] group-foreign-2+!>([%revoke my-flag ~]))
        (ex-poke (weld go-area /invite/send/~fun) [~fun my-agent] group-foreign-2+!>(a-foreigns-8-fun))
    ==
  ::  verify records on the invited list
  ::
  ;<  peek=cage  bind:m
    (got-peek /x/v3/groups/(scot %p p:my-flag)/[q:my-flag])
  =+  group=!<(group:g q.peek)
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get by invited.admissions.group) ~fun))
    !>(`[now.bowl ~])
  (pure:m ~)
::  +test-private-invites: test private group invitations
::
::  an admin group member can send an invite.
::
::  the invitee is recorded on the invited list.
::
::  when another invite is sent to the same ship,
::  the previous invite is revoked first.
::
++  test-private-invites
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  do-groups-init
  ;<  *  bind:m  do-join-group
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(src ~dev)))
  ;<  =bowl:gall  bind:m  get-bowl
  ;<  *  bind:m
    =/  =update:g
      [now.bowl %entry %privacy %private]
    (do-agent (weld go-area /updates) [~zod my-agent] %fact group-update+!>(update))
  ::  invite ~fun to a private group
  ::
  ;<  *  bind:m  ((do-as ~dev) (do-a-groups [%invite my-flag (sy ~fun ~) ~ ~]))
  ::  receive generated token
  ::
  ;<  *  bind:m
    =/  =update:g
      [now.bowl %entry %token %add 0v123 [personal+~fun (add now.bowl ~d365) ~]]
    (do-agent (weld go-area /updates) [~zod my-agent] %fact group-update+!>(update))
  ;<  caz=(list card)  bind:m
    (do-agent (weld go-area /invite/~fun/token) [~zod my-agent] %fact group-token+!>(`0v123))
  ;<  *  bind:m
    (do-agent (weld go-area /invite/~fun/token) [~zod my-agent] %kick ~)
  ::  verify invites are sent
  ::
  ;<  =bowl:gall  bind:m  get-bowl
  ;<  =invite:g  bind:m  (get-invite `0v123)
  ;<  ~  bind:m
    =/  a-foreigns-7-fun=a-foreigns:v7:gv
      [%invite (v7:invite:v8:gc invite)]
    =/  a-foreigns-8-fun=a-foreigns:v8:gv
      [%invite invite]
    %+  ex-cards  caz
    :~  (ex-poke (weld go-area /invite/send/~fun) [~fun my-agent] group-foreign-2+!>(a-foreigns-8-fun))
    ==
  ::  verify the invitee is recorded on the invited list
  ::
  ;<  peek=cage  bind:m
    (got-peek /x/v3/groups/(scot %p p:my-flag)/[q:my-flag])
  =+  group=!<(group:g q.peek)
  ::  verify records on the invited list
  ::
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get by invited.admissions.group) ~fun))
    !>(`[now.bowl `0v123])
  ::  repeat the invite
  ::
  ;<  *  bind:m
    =/  =update:g
      [now.bowl %entry %token %add 0v123 [personal+~fun (add now.bowl ~d365) ~]]
    (do-agent (weld go-area /updates) [~zod my-agent] %fact group-update+!>(update))
  ;<  *  bind:m  ((do-as ~dev) (do-a-groups [%invite my-flag (sy ~fun ~) ~ ~]))
  ;<  caz=(list card)  bind:m
    (do-agent (weld go-area /invite/~fun/token) [~zod my-agent] %fact group-token+!>(`0v125))
  ;<  *  bind:m
    (do-agent (weld go-area /invite/~fun/token) [~zod my-agent] %kick ~)
  ;<  =bowl:gall  bind:m  get-bowl
  ;<  =invite:g  bind:m  (get-invite `0v125)
  ;<  ~  bind:m
    =/  a-foreigns-7-fun=a-foreigns:v7:gv
      [%invite (v7:invite:v8:gc invite)]
    =/  a-foreigns-8-fun=a-foreigns:v8:gv
      [%invite invite]
    %+  ex-cards  caz
    :~  (ex-poke (weld go-area /invite/revoke/~fun) [~fun my-agent] group-foreign-2+!>([%revoke my-flag `0v123]))
        (ex-c-group %entry %token %del 0v123)
        (ex-poke (weld go-area /invite/send/~fun) [~fun my-agent] group-foreign-2+!>(a-foreigns-8-fun))
    ==
  ::  verify records on the invited list
  ::
  ;<  peek=cage  bind:m
    (got-peek /x/v3/groups/(scot %p p:my-flag)/[q:my-flag])
  =+  group=!<(group:g q.peek)
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get by invited.admissions.group) ~fun))
    !>(`[now.bowl `0v125])
  (pure:m ~)
::  +test-invites-banned: test invite revocation for banned ships
::
++  test-invites-banned
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  do-groups-init
  ;<  *  bind:m  do-join-group
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(src ~dev)))
  ;<  =bowl:gall  bind:m  get-bowl
  ;<  *  bind:m
    =/  =update:g
      [now.bowl %entry %privacy %private]
    (do-agent (weld go-area /updates) [~zod my-agent] %fact group-update+!>(update))
  ::  invite ~fun to a private group
  ::
  ;<  *  bind:m  ((do-as ~dev) (do-a-groups [%invite my-flag (sy ~fun ~) ~ ~]))
  ::  receive generated token
  ::
  ;<  *  bind:m
    =/  =update:g
      [now.bowl %entry %token %add 0v123 [personal+~fun (add now.bowl ~d365) ~]]
    (do-agent (weld go-area /updates) [~zod my-agent] %fact group-update+!>(update))
  ;<  caz=(list card)  bind:m
    (do-agent (weld go-area /invite/~fun/token) [~zod my-agent] %fact group-token+!>(`0v123))
  ;<  *  bind:m
    (do-agent (weld go-area /invite/~fun/token) [~zod my-agent] %kick ~)
  ::  verify invites are sent
  ::
  ;<  =bowl:gall  bind:m  get-bowl
  ;<  =invite:g  bind:m  (get-invite `0v123)
  ;<  ~  bind:m
    =/  a-foreigns-7-fun=a-foreigns:v7:gv
      [%invite (v7:invite:v8:gc invite)]
    =/  a-foreigns-8-fun=a-foreigns:v8:gv
      [%invite invite]
    %+  ex-cards  caz
    :~  (ex-poke (weld go-area /invite/send/~fun) [~fun my-agent] group-foreign-2+!>(a-foreigns-8-fun))
    ==
  ::  ban ~fun. verify the invitation is revoked and the token deleted.
  ::
  ;<  caz=(list card)  bind:m
    =/  =update:g
      [now.bowl %entry %ban %add-ships (sy ~fun ~)]
    (do-agent (weld go-area /updates) [~zod my-agent] %fact group-update+!>(update))
  ;<  ~  bind:m
    %+  ex-cards-r-groups  caz
    :~  |+[my-flag [%entry %ban %add-ships (sy ~fun ~)]]
        &+(ex-poke (weld go-area /invite/revoke/~fun) [~fun my-agent] group-foreign-2+!>([%revoke my-flag `0v123]))
        &+(ex-c-group %entry %token %del 0v123)
    ==
  ::  verify records on the invited list
  ::
  ;<  peek=cage  bind:m
    (got-peek /x/v3/groups/(scot %p p:my-flag)/[q:my-flag])
  =+  group=!<(group:g q.peek)
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get by invited.admissions.group) ~fun))
    !>(~)
  (pure:m ~)
::  +test-invites-deleted-token: test invites are revoked when a token is deleted
::
++  test-invites-deleted-token
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  do-groups-init
  ;<  *  bind:m  do-join-group
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(src ~dev)))
  ;<  =bowl:gall  bind:m  get-bowl
  ;<  *  bind:m
    =/  =update:g
      [now.bowl %entry %privacy %private]
    (do-agent (weld go-area /updates) [~zod my-agent] %fact group-update+!>(update))
  ::  invite ~fun to a private group
  ::
  ;<  *  bind:m  ((do-as ~dev) (do-a-groups [%invite my-flag (sy ~fun ~) ~ ~]))
  ::  receive generated token
  ::
  ;<  *  bind:m
    =/  =update:g
      [now.bowl %entry %token %add 0v123 [personal+~fun (add now.bowl ~d365) ~]]
    (do-agent (weld go-area /updates) [~zod my-agent] %fact group-update+!>(update))
  ;<  caz=(list card)  bind:m
    (do-agent (weld go-area /invite/~fun/token) [~zod my-agent] %fact group-token+!>(`0v123))
  ;<  *  bind:m
    (do-agent (weld go-area /invite/~fun/token) [~zod my-agent] %kick ~)
  ::  verify invites are sent
  ::
  ;<  =bowl:gall  bind:m  get-bowl
  ;<  =invite:g  bind:m  (get-invite `0v123)
  ;<  ~  bind:m
    =/  a-foreigns-7-fun=a-foreigns:v7:gv
      [%invite (v7:invite:v8:gc invite)]
    =/  a-foreigns-8-fun=a-foreigns:v8:gv
      [%invite invite]
    %+  ex-cards  caz
    :~  (ex-poke (weld go-area /invite/send/~fun) [~fun my-agent] group-foreign-2+!>(a-foreigns-8-fun))
    ==
  ::  token is deleted. verify the invitation is revoked and the token deleted.
  ::
  ;<  caz=(list card)  bind:m
    =/  =update:g
      [now.bowl %entry %token %del 0v123]
    (do-agent (weld go-area /updates) [~zod my-agent] %fact group-update+!>(update))
  ;<  ~  bind:m
    %+  ex-cards-r-groups  caz
    :~  |+[my-flag [%entry %token %del 0v123]]
        &+(ex-poke (weld go-area /invite/revoke/~fun) [~fun my-agent] group-foreign-2+!>([%revoke my-flag `0v123]))
    ==
  ::  verify records on the invited list
  ::
  ;<  peek=cage  bind:m
    (got-peek /x/v3/groups/(scot %p p:my-flag)/[q:my-flag])
  =+  group=!<(group:g q.peek)
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get by invited.admissions.group) ~fun))
    !>(~)
  (pure:m ~)
::  +test-invites-group-deleted: test that invites are revoked when a group is deleted
::
++  test-invites-group-deleted
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  do-groups-init
  ;<  *  bind:m  do-join-group
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(src ~dev)))
  ;<  =bowl:gall  bind:m  get-bowl
  ;<  *  bind:m
    =/  =update:g
      [now.bowl %entry %privacy %private]
    (do-agent (weld go-area /updates) [~zod my-agent] %fact group-update+!>(update))
  ::  invite ~fun to a private group
  ::
  ;<  *  bind:m  ((do-as ~dev) (do-a-groups [%invite my-flag (sy ~fun ~) ~ ~]))
  ::  receive generated token
  ::
  ;<  *  bind:m
    =/  =update:g
      [now.bowl %entry %token %add 0v123 [personal+~fun (add now.bowl ~d365) ~]]
    (do-agent (weld go-area /updates) [~zod my-agent] %fact group-update+!>(update))
  ;<  caz=(list card)  bind:m
    (do-agent (weld go-area /invite/~fun/token) [~zod my-agent] %fact group-token+!>(`0v123))
  ;<  *  bind:m
    (do-agent (weld go-area /invite/~fun/token) [~zod my-agent] %kick ~)
  ::  verify invites are sent
  ::
  ;<  =bowl:gall  bind:m  get-bowl
  ;<  =invite:g  bind:m  (get-invite `0v123)
  ;<  ~  bind:m
    =/  a-foreigns-7-fun=a-foreigns:v7:gv
      [%invite (v7:invite:v8:gc invite)]
    =/  a-foreigns-8-fun=a-foreigns:v8:gv
      [%invite invite]
    %+  ex-cards  caz
    :~  (ex-poke (weld go-area /invite/send/~fun) [~fun my-agent] group-foreign-2+!>(a-foreigns-8-fun))
    ==
  ::  group is deleted. verify the invitation is revoked.
  ::
  ;<  caz=(list card)  bind:m
    =/  =update:g
      [now.bowl %delete ~]
    (do-agent (weld go-area /updates) [~zod my-agent] %fact group-update+!>(update))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-poke (weld go-area /invite/revoke/~fun) [~fun my-agent] group-foreign-2+!>([%revoke my-flag `0v123]))
        (ex-fact-paths ~[/v3/groups /v3/groups/(scot %p p:my-flag)/[q:my-flag]])
        (ex-fact-paths ~[/v2/groups /v2/groups/(scot %p p:my-flag)/[q:my-flag]])
        (ex-fact-paths ~[/v1/groups /v1/groups/(scot %p p:my-flag)/[q:my-flag]])
        (ex-fact-paths ~[/groups/ui])
        (ex-task (weld go-area /updates) [~zod my-agent] %leave ~)
    ==
  (pure:m ~)
::  +big-group: +my-group with 20 more seats, the first 3 holding %admin
::
++  big-group
  ^-  group:g
  =/  =group:g  my-group
  %=    group
      seats
    %-  ~(gas by seats.group)
    %+  turn  (gulf 1 20)
    |=  i=@
    ^-  [ship seat:g]
    :-  ;;(ship i)
    :_  ~2000.1.1
    ?:((lte i 3) (sy %admin ~) ~)
  ==
::
::  +big-pages: every page after .after, following .next
::
++  big-pages
  |=  [base=path after=(unit ship)]
  =/  m  (mare ,(list seats-page:v11:gv))
  ^-  form:m
  ;<  =cage  bind:m
    (got-peek ?~(after base (snoc base (scot %p u.after))))
  =+  page=!<(seats-page:v11:gv q.cage)
  ?~  next.page  (pure:m ~[page])
  ;<  rest=(list seats-page:v11:gv)  bind:m  (big-pages base next.page)
  (pure:m [page rest])
::
::  +test-seats-pages-walk-the-roster: following .next from the first
::  page visits every seat once, in ship order
::
++  test-seats-pages-walk-the-roster
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  do-groups-init
  ;<  *  bind:m  (do-join-this-group big-group)
  ;<  pages=(list seats-page:v11:gv)  bind:m
    (big-pages /x/v3/groups/~zod/my-test-group/seats/page/8 ~)
  =/  walked=(list [=ship =seat:g])  (zing (turn pages |=(seats-page:v11:gv seats)))
  ;<  ~  bind:m
    %+  ex-equal
      !>  :-  sizes=(turn pages |=(seats-page:v11:gv (lent seats)))
          totals=(turn pages |=(seats-page:v11:gv total))
    !>([sizes=~[8 8 5] totals=~[21 21 21]])
  ;<  ~  bind:m
    %+  ex-equal  !>((turn walked head))
    !>((sort ~(tap in ~(key by seats:big-group)) lth))
  (ex-equal !>((malt walked)) !>(seats:big-group))
::
::  +test-seats-role-page: a role page holds only that role's holders
::
++  test-seats-role-page
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  do-groups-init
  ;<  *  bind:m  (do-join-this-group big-group)
  ;<  =cage  bind:m
    (got-peek /x/v3/groups/~zod/my-test-group/seats/role/admin/page/10)
  =+  page=!<(seats-page:v11:gv q.cage)
  %+  ex-equal
    !>([total.page (turn seats.page head) next.page])
  !>([4 ~[~zod ~nec ~bud ~wes] ~])
::
::  +test-light-group: the light group drops seats like init does, but
::  counts every seat
::
++  test-light-group
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  do-groups-init
  ;<  *  bind:m  (do-join-this-group big-group)
  ;<  light=cage  bind:m
    (got-peek /x/v3/ui/groups/~zod/my-test-group/light)
  ;<  full=cage  bind:m
    (got-peek /x/v3/ui/groups/~zod/my-test-group)
  =+  light-ui=!<(group-ui:v11:gv q.light)
  =+  full-ui=!<(group-ui:v11:gv q.full)
  %+  ex-equal
    !>  :*  light-seats=~(wyt by seats.group.light-ui)
            light-count=member-count.light-ui
            full-seats=~(wyt by seats.group.full-ui)
            full-count=member-count.full-ui
        ==
  !>([light-seats=15 light-count=21 full-seats=21 full-count=21])
--
