::  groups unit tests
::
/-  g=groups, gv=groups-ver, meta, s=story
/+  *test, *test-negotiate-agent
/+  gc=groups-conv
/=  groups-agent  /app/groups
|%
++  my-agent  %groups
++  my-flag  `flag:g`[~zod %my-test-group]
++  go-area  `path`/groups/~zod/my-test-group
++  se-area  `path`/server/groups/~zod/my-test-group
++  tick  ^~((div ~s1 (bex 16)))
::
++  my-scry-gate
  |=  =path
  ^-  (unit vase)
  ?+    path  ~
    [%gu ship=@ %activity now=@ rest=*]  `!>(|)
    [%gx ship=@ %groups now=@ %~.~ %negotiate %status *]  `!>(%match)
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
++  do-groups-init
  =/  m  (mare ,(list card))
  ^-  form:m
  ;<  ~  bind:m  (set-scry-gate my-scry-gate)
  (do-init my-agent groups-agent)
::
++  do-create-group
  |=  =privacy:g
  =/  m  (mare ,(list card))
  ^-  form:m
  =/  =create-group:g
    :*  %my-test-group
        ['My Test Group' 'A testing group' '' '']
        privacy
        [~ ~]  ::  banned
        ~      ::  members
    ==
  ;<  ~  bind:m  (set-src ~zod)
  ;<  ~  bind:m  (wait ~h1)  :: prevent default creation time
  ;<  caz=(list card)  bind:m  (do-poke group-command+!>([%create create-group]))
  ::  self-join the group
  ::
  ;<  *  bind:m  (do-poke group-command+!>([%join my-flag ~]))
  ;<  *  bind:m  (do-watch (weld se-area /updates/~zod/(scot %da *@da)))
  ;<  =bowl:gall  bind:m  get-bowl
  (pure:m caz)
::
++  do-create-group-with-members
  |=  [=privacy:g members=(list ship)]
  =/  m  (mare ,(list card))
  ^-  form:m
  =/  =create-group:g
    :*  %my-test-group
        ['My Test Group' 'A testing group' '' '']
        privacy
        [~ ~]  ::  banned
        (malt (turn members |=(=ship ship^~)))
    ==
  ;<  ~  bind:m  (set-src ~zod)
  ;<  ~  bind:m  (wait ~h1)  :: prevent default creation time
  ;<  caz=(list card)  bind:m  (do-poke group-command+!>([%create create-group]))
  ::  self-join the group
  ::
  ;<  *  bind:m  (do-poke group-command+!>([%join my-flag ~]))
  ;<  *  bind:m  (do-watch (weld se-area /updates/~zod/(scot %da *@da)))
  ;<  =bowl:gall  bind:m  get-bowl
  (pure:m caz)
::
++  do-c-groups
  |=  =c-groups:g
  =/  m  (mare ,(list card))
  ^-  form:m
  ;<  ~  bind:m  (wait ~m1)
  (do-poke group-command+!>(c-groups))
::
++  do-c-group
  |=  =c-group:g
  =/  m  (mare ,(list card))
  ^-  form:m
  ;<  ~  bind:m  (wait ~m1)
  =/  =c-groups:g  [%group my-flag c-group]
  (do-poke group-command+!>(c-groups))
::
++  do-set-privacy
  |=  =privacy:g
  =/  m  (mare ,(list card))
  ^-  form:m
  ((do-as ~zod) (do-c-group [%entry %privacy privacy]))
::
++  do-join-group
  |=  =ship
  =/  m  (mare ,(list card))
  ^-  form:m
  ;<  ~  bind:m  (set-src ship)
  ;<  =bowl:gall  bind:m  get-bowl
  ;<  caz=(list card)  bind:m  (do-poke group-command+!>([%join my-flag ~]))
  (pure:m caz)
::
::
++  ex-u-groups
  |=  [caz=(list card) us-groups=(list u-group:v9:gv)]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  =bowl:gall  bind:m  get-bowl
  %+  ex-cards  caz
  (turn us-groups (cury ex-update now.bowl))
::
++  ex-update
  |=  [=time =u-group:v9:gv]
  %+  ex-fact
    ~[/server/groups/~zod/my-test-group/updates/~zod/(scot %da *@da)]
  group-update+!>(`update:g`[time u-group])
::
++  ex-arvo-token-expire
  |=  [token=@uv expiry=@da]
  (ex-arvo (weld se-area /tokens/(scot %uv token)/expire) %b %wait expiry)
::
++  test-c-groups-create
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  do-groups-init
  ;<  caz=(list card)  bind:m  (do-create-group %secret)
  ;<  peek=cage  bind:m  (got-peek /x/v2/groups/~zod/my-test-group)
  =+  !<(=group:g q.peek)
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  %^    ex-poke
            /foreigns/~zod/my-test-group/join/public
          [~zod my-agent]
        group-command+!>(`c-groups:g`[%join my-flag ~])
      ::
        (ex-fact-paths ~[/v1/foreigns])
        (ex-fact-paths ~[/gangs/updates])
    ==
  (ex-fail (do-create-group %secret))
::  +test-c-join-public: test public group join
::
::  a ship can join a public group without a token.
::  re-joining a public group is a valid, albeit vacuous, operation.
::
++  test-c-groups-join-public
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  do-groups-init
  ;<  *  bind:m  (do-create-group %public)
  ::  a ship can join a public group without a token
  ::
  ;<  caz=(list card)  bind:m  ((do-as ~dev) (do-c-groups [%join my-flag ~]))
  ;<  =bowl:gall  bind:m  get-bowl
  =/  =seat:v7:gv  [~ now.bowl]
  ;<  ~  bind:m
    (ex-u-groups caz [%seat (sy ~dev ~) %add seat]~)
  ::  re-joining is a vacuous operation
  ::
  ;<  caz=(list card)  bind:m
    ((do-as ~dev) (do-c-groups [%join my-flag ~]))
  (ex-cards caz ~)
::  +test-c-groups-join-private: test private group join
::
::  a ship can join a private group only with a valid token.
::  re-joining the group with the same token fails, because
::  the token is expired.
::
++  test-c-groups-join-private
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  do-groups-init
  ;<  *  bind:m  (do-create-group %private)
  ;<  *  bind:m  (jab-bowl |=(=bowl bowl(eny 0v123)))
  ::  joining a private group without a valid token fails
  ::
  ;<  *  bind:m
    (ex-fail ((do-as ~fed) (do-c-groups [%join my-flag ~])))
  ;<  caz=(list card)  bind:m
    =/  =c-token-add:g
      [[%personal ~dev] ~ ~ |]
    ::  the token generated is going to be 0v0, as we haven't
    ::  set entropy.
    ::
    ((do-as ~zod) (do-c-group [%entry %token %add c-token-add]))
  ::  a private group can be joined with a valid token
  ::
  ;<  caz=(list card)  bind:m
    ((do-as ~dev) (do-c-groups [%join my-flag `0v123]))
  ;<  =bowl  bind:m  get-bowl
  =/  =seat:v7:gv  [~ now.bowl]
  ;<  ~  bind:m
    (ex-u-groups caz [%seat (sy ~dev ~) [%add seat]]~)
  ::  trying to reuse the token fails
  ::
  ;<  caz=(list card)  bind:m
    (ex-fail ((do-as ~fed) (do-c-groups [%join my-flag `0v123])))
  ::  as does using a non-existent token
  ::
  ;<  caz=(list card)  bind:m
    (ex-fail ((do-as ~fed) (do-c-groups [%join my-flag `0v321])))
  (pure:m ~)
::  +test-c-groups-ask-public: test public group ask request
::
::  a ship can ask to join a group, unless he has been banned.
::  an ask to a public group is automatically approved.
::
++  test-c-groups-ask-public
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  do-groups-init
  ;<  *  bind:m  (do-create-group %public)
  =/  =story:s
    [inline+['an appeal to host']~]~
  ;<  ~  bind:m  (set-src ~dev)
  ::  a ship can ask to join a public group: it first pokes, then
  ::  watches for the incoming token
  ::
  ;<  *  bind:m
    (do-poke group-command+!>([%ask my-flag `story]))
  ::  one man's path is another man's wire
  =/  ask-path=path  (weld se-area /ask/~dev)
  ;<  caz=(list card)  bind:m
    ((do-as ~dev) (do-watch ask-path))
  ::  the request is immediately approved and an (empty) invite
  ::  token is sent.
  ::
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-fact ~ group-token+!>(~))
        (ex-card [%give %kick ~ ~])
    ==
  ::  a banned ship can't ask to join the group
  ::
  ;<  *  bind:m  ((do-as ~zod) (do-c-group [%entry %ban %add-ships (sy ~fed ~)]))
  ;<  ~  bind:m  (set-src ~fed)
  ;<  ~  bind:m
    (ex-fail (do-poke group-command+!>([%ask my-flag `story])))
  ;<  ~  bind:m
    (ex-fail (do-watch ask-path))
  (pure:m ~)
::  +test-c-groups-ask-private: test private group ask request
::
::  an ask to a private group can be either approved or denied by an admin.
::
++  test-c-groups-ask-private
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  do-groups-init
  ;<  *  bind:m  (do-create-group %private)
  ;<  *  bind:m  (jab-bowl |=(=bowl bowl(eny 0v123)))
  ::  a ship can ask to join the group. the request is recorded and
  ::  broadcasted.
  ::
  =/  =story:s
    [inline+['an appeal to host']~]~
  =/  ask-path=path  (weld se-area /ask/~dev)
  ;<  caz=(list card)  bind:m
    ((do-as ~dev) (do-c-groups [%ask my-flag `story]))
  ;<  *  bind:m
    ((do-as ~dev) (do-watch ask-path))
  ;<  =bowl  bind:m  get-bowl
  ;<  ~  bind:m
    (ex-u-groups caz [%entry %ask [%add ~dev now.bowl `story]]~)
  ;<  peek=cage  bind:m  (got-peek /x/v2/groups/~zod/my-test-group)
  =+  !<(=group:g q.peek)
  ;<  ~  bind:m
    %+  ex-equal
      !>(`(unit [at=@da (unit story:s)])``[now.bowl `story])
    !>((~(get by requests.admissions.group) ~dev))
  ::  an admin can approve or deny the request
  ::
  ;<  caz=(list card)  bind:m
    ((do-as ~zod) (do-c-group [%entry %ask (sy ~dev ~) %approve]))
  ::  when a request is approved, the host generates a new token and
  ::  sends it to the requester. the request is then deleted from the
  ::  record.
  ::
  ;<  =bowl:gall  bind:m  get-bowl
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-arvo-token-expire 0v123 (add now.bowl ~d365))
        (ex-update now.bowl [%entry %token [%add 0v123 [personal+~dev (add now.bowl ~d365) ~]]])
        (ex-fact ~[ask-path] group-token+!>(`(unit token:g)``0v123))
        (ex-card [%give %kick ~[ask-path] ~])
        (ex-update (add now.bowl tick) [%entry %ask %del (sy ~dev ~)])
    ==
  ::  an ask request originating from a banned ship fails
  ::
  ;<  *  bind:m  ((do-as ~zod) (do-c-group [%entry %ban %add-ships (sy ~fed ~)]))
  ;<  ~  bind:m  (set-src ~fed)
  ;<  ~  bind:m
    (ex-fail (do-poke group-command+!>([%ask my-flag `story])))
  (pure:m ~)
::  +test-c-groups-leave: test group leave poke
::
::  if a ship is a group member, she can issue a %leave poke.
::  the group host then deletes her seat.
::
::  if a ship is asking to join the group, she can rescind this request
::  by sending a %leave poke. the group host then deletes the request
::  and kicks the ask subscription.
::
::  TODO if a ship is in the pending list, she can signal invite rejection
::  by sending a %leave poke. the group host then deleted her from the
::  pending list.
::
++  test-c-groups-leave
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  do-groups-init
  ;<  *  bind:m  (do-create-group %public)
  ::  a ship can join a public group without a token
  ::
  ;<  caz=(list card)  bind:m  ((do-as ~dev) (do-c-groups [%join my-flag ~]))
  ;<  =bowl:gall  bind:m  get-bowl
  =/  =seat:v7:gv  [~ now.bowl]
  ;<  ~  bind:m
    (ex-u-groups caz [%seat (sy ~dev ~) [%add seat]]~)
  ::  leaving the group then deletes the seat
  ::
  ;<  caz=(list card)  bind:m
    ((do-as ~dev) (do-c-groups [%leave my-flag]))
  ;<  ~  bind:m
    (ex-u-groups caz [%seat (sy ~dev ~) [%del ~]]~)
  ::  a ship can ask to join the private group. the request is recorded and
  ::  broadcasted, but no other updates are emitted.
  ::
  ;<  *  bind:m  (do-set-privacy %private)
  =/  =story:s
    [inline+['an appeal to host']~]~
  =/  ask-path=path  (weld se-area /ask/~dev)
  ;<  caz=(list card)  bind:m
    ((do-as ~dev) (do-c-groups [%ask my-flag `story]))
  ;<  *  bind:m
    ((do-as ~dev) (do-watch ask-path))
  ;<  =bowl:gall  bind:m  get-bowl
  ;<  ~  bind:m
    (ex-u-groups caz [%entry %ask [%add ~dev now.bowl `story]]~)
  ;<  peek=cage  bind:m  (got-peek /x/v2/groups/~zod/my-test-group)
  =+  !<(=group:g q.peek)
  ;<  ~  bind:m
    %+  ex-equal
      !>((~(get by requests.admissions.group) ~dev))
    !>(`(unit [at=@da (unit story:s)])``[now.bowl `story])
  ::  a ship can rescind the ask request by issuing a leave poke.
  ::  the group host delets the request and kicks the subscription.
  ::
  ;<  caz=(list card)  bind:m
    ((do-as ~dev) (do-c-groups [%leave my-flag]))
  ;<  =bowl:gall  bind:m  get-bowl
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-update now.bowl [%entry %ask %del (sy ~dev ~)])
        (ex-card [%give %kick ~[ask-path] ~])
    ==
  (pure:m ~)
::  +test-c-group-meta: test group meta update
::
::  group meta data can only be updated by an admin.
::
++  test-c-group-meta
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  do-groups-init
  ;<  *  bind:m  (do-create-group %public)
  ::  update the group meta data as the host
  ::
  =/  meta=data:meta:g
    ['New Title' 'New description' '' '']
  ;<  caz=(list card)  bind:m
    ((do-as ~zod) (do-c-group [%meta meta]))
  ;<  peek=cage  bind:m  (got-peek /x/v2/groups/~zod/my-test-group)
  =+  !<(=group:g q.peek)
  ;<  ~  bind:m
    (ex-equal !>(meta.group) !>(meta))
  ;<  ~  bind:m
    (ex-u-groups caz [%meta meta]~)
  ::  non-admin members can't update metadata
  ::
  ;<  *  bind:m  (do-join-group ~dev)
  ;<  ~  bind:m  (ex-fail ((do-as ~dev) (do-c-group [%meta meta])))
  ::  non-members can't update metadata
  ;<  ~  bind:m  (ex-fail ((do-as ~fed) (do-c-group [%meta meta])))
  (pure:m ~)
::  +test-c-group-entry-privacy: test group privacy update
::
::  group privacy can only be updated by a group host or an admin.
::
++  test-c-group-entry-privacy
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  do-groups-init
  ;<  *  bind:m  (do-create-group %public)
  ::  the group host can update the group privacy
  ::
  ;<  caz=(list card)  bind:m
    ((do-as ~zod) (do-c-group [%entry %privacy %secret]))
  ;<  ~  bind:m
    (ex-u-groups caz [%entry %privacy %secret]~)
  ;<  peek=cage  bind:m  (got-peek /x/v2/groups/~zod/my-test-group)
  =+  !<(=group:g q.peek)
  ;<  ~  bind:m
    (ex-equal !>(privacy.admissions.group) !>(%secret))
  ::  a non-member, or ordinary group member can't update the group privacy
  ::
  ;<  *  bind:m
    ((do-as ~zod) (do-c-group [%entry %privacy %public]))
  ;<  *  bind:m
    (ex-fail ((do-as ~dev) (do-c-group [%entry %privacy %secret])))
  ;<  *  bind:m
    (do-join-group ~dev)
  ;<  *  bind:m
    (ex-fail ((do-as ~dev) (do-c-group [%entry %privacy %secret])))
  ::  an admin member can update the group privacy
  ::
  ;<  *  bind:m
    ((do-as ~zod) (do-c-group [%seat (sy ~dev ~) %add-roles (sy %admin ~)]))
  ;<  *  bind:m
    ((do-as ~dev) (do-c-group [%entry %privacy %secret]))
  ;<  peek=cage  bind:m  (got-peek /x/v2/groups/~zod/my-test-group)
  =+  !<(=group:g q.peek)
  ;<  ~  bind:m
    (ex-equal !>(privacy.admissions.group) !>(%secret))
  (pure:m ~)
::  +test-c-entry-ban: test ship banning
::
::  when a ship is banned, it is kicked from the group.
::
::  its ask request is denied.
::
::  it is removed from the pending list.
::
::  the invite and an associated personal token are revoked.
::
++  test-c-entry-ban
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  do-groups-init
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(eny 0v123)))
  ::  create a private group with members. ~dev is sent an invite.
  ::
  ;<  caz=(list card)  bind:m  (do-create-group-with-members %private ~[~dev])
  ::  we ban ~dev. the invite and the corresponding token are revoked.
  ::
  ;<  caz=(list card)  bind:m  (do-c-group [%entry %ban %add-ships (sy ~dev ~)])
  ;<  =bowl:gall  bind:m  get-bowl
  ;<  =invite:v8:gv  bind:m  (get-invite `0v123)
  ;<  ~  bind:m
    =/  dev-revoke-wire=wire  (weld se-area /invite/revoke/~dev)
    %+  ex-cards  caz
    :~  (ex-update now.bowl [%seat (sy ~dev ~) %del ~])
        ::
        ::  revoke group invitation and delete the token
        (ex-poke dev-revoke-wire [~dev my-agent] group-foreign-2+!>([%revoke my-flag `0v123]))
        (ex-update (add now.bowl tick) [%entry %token %del 0v123])
      ::
        (ex-update (add now.bowl (mul tick 2)) [%entry %ban %add-ships (sy ~dev ~)])
    ==
  ::  ~fun requests to join the group. it is then banned, and its ask
  ::  request is denied.
  ::
  =/  =story:s
    [inline+['an appeal to host']~]~
  =/  ask-path=path  (weld se-area /ask/~fun)
  ;<  caz=(list card)  bind:m
    ((do-as ~fun) (do-c-groups [%ask my-flag `story]))
  ;<  *  bind:m
    ((do-as ~fun) (do-watch ask-path))
  ;<  =^bowl  bind:m  get-bowl
  ;<  ~  bind:m
    (ex-u-groups caz [%entry %ask [%add ~fun now.bowl `story]]~)
  ::
  ;<  caz=(list card)  bind:m  (do-c-group [%entry %ban %add-ships (sy ~fun ~)])
  ;<  =bowl:gall  bind:m  get-bowl
  =/  reject-wire=wire  (weld se-area /ask/reject/~fun)
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-poke reject-wire [~fun %groups] group-foreign-2+!>([%reject my-flag]))
        (ex-card [%give %kick ~[ask-path] ~])
        (ex-update now.bowl [%entry %ask %del (sy ~fun ~)])
        (ex-update (add now.bowl tick) [%entry %ban %add-ships (sy ~fun ~)])
    ==
  ::  ~nec is added to the pending list and is then banned.
  ::  the invite and the token are revoked.
  ::
  ;<  caz=(list card)  bind:m
    (do-c-group [%entry %pending (sy ~nec ~) %add ~])
  ;<  =bowl:gall  bind:m  get-bowl
  ;<  =invite:v8:gv  bind:m  (get-invite `0v123)
  ;<  ~  bind:m
    =/  nec-wire=wire  (weld se-area /invite/send/~nec)
    =/  a-foreigns-7=a-foreigns:v7:gv
      [%invite (v7:invite:v8:gc invite)]
    =/  a-foreigns-8=a-foreigns:v8:gv
      [%invite invite]
    =/  =token-meta:g
      [[%personal ~nec] (add now.bowl ~d365) ~]
    %+  ex-cards  caz
    :~  ::
        ::  generate new token
        (ex-arvo-token-expire 0v123 expiry.token-meta)
        (ex-update now.bowl [%entry %token %add 0v123 token-meta])
        ::
        ::  invite ~nec
        (ex-poke (snoc nec-wire %old) [~nec my-agent] group-foreign-1+!>(a-foreigns-7))
        (ex-poke nec-wire [~nec my-agent] group-foreign-2+!>(a-foreigns-8))
        ::
        ::  entry update
        (ex-update (add now.bowl tick) [%entry %pending %add (sy ~nec ~) ~])
    ==
  ;<  caz=(list card)  bind:m  (do-c-group [%entry %ban %add-ships (sy ~nec ~)])
  ;<  =bowl:gall  bind:m  get-bowl
  ;<  =invite:v8:gv  bind:m  (get-invite `0v123)
  ;<  ~  bind:m
    =/  nec-revoke-wire=wire  (weld se-area /invite/revoke/~nec)
    %+  ex-cards  caz
    :~  ::
        ::  revoke group invitation and delete the token
        (ex-poke nec-revoke-wire [~nec my-agent] group-foreign-2+!>([%revoke my-flag `0v123]))
        (ex-update now.bowl [%entry %token %del 0v123])
      ::
        (ex-update (add now.bowl tick) [%entry %pending %del (sy ~nec ~)])
        (ex-update (add now.bowl (mul tick 2)) [%entry %ban %add-ships (sy ~nec ~)])
    ==
  (pure:m ~)
::  +test-private-invites: test private group invitations
::
::  group server properly records invited ships in admissions.
::
::  if a ship is invited a second time, the previous invitation
::  is revoked.
::
++  test-private-invites
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  do-groups-init
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(eny 0v123)))
  ::  create a group with members. each member is to receive an invite.
  ::
  ;<  caz=(list card)  bind:m  (do-create-group-with-members %private ~[~dev ~fun])
  ;<  =bowl  bind:m  get-bowl
  ;<  =invite:v8:gv  bind:m  (get-invite `0v123)
  ;<  ~  bind:m
    =/  dev-wire=wire  (weld se-area /invite/send/~dev)
    =/  fun-wire=wire  (weld se-area /invite/send/~fun)
    =/  a-foreigns-7-dev=a-foreigns:v7:gv
      [%invite (v7:invite:v8:gc invite)]
    =/  a-foreigns-8-dev=a-foreigns:v8:gv
      [%invite invite]
    =/  a-foreigns-7-fun=a-foreigns:v7:gv
      [%invite (v7:invite:v8:gc invite(token `0v124))]
    =/  a-foreigns-8-fun=a-foreigns:v8:gv
      [%invite invite(token `0v124)]
    =+  expiry=(add now.bowl ~d365)
    %+  ex-cards  caz
    :~  ::
        ::  invite ~dev
        (ex-arvo-token-expire 0v123 expiry)
        (ex-poke (snoc dev-wire %old) [~dev my-agent] group-foreign-1+!>(a-foreigns-7-dev))
        (ex-poke dev-wire [~dev my-agent] group-foreign-2+!>(a-foreigns-8-dev))
        ::
        ::  invite ~fun
        (ex-arvo-token-expire 0v124 expiry)
        (ex-poke (snoc fun-wire %old) [~fun my-agent] group-foreign-1+!>(a-foreigns-7-fun))
        (ex-poke fun-wire [~fun my-agent] group-foreign-2+!>(a-foreigns-8-fun))
        ::
        ::  self-join and foreigns update
        (ex-poke-wire /foreigns/(scot %p p:my-flag)/[q:my-flag]/join/public)
        (ex-fact-paths ~[/v1/foreigns])
        (ex-fact-paths ~[/gangs/updates])
    ==
  ::TODO implement a +get-scry, +got-scry to return
  ::     typed values.
  ::
  ;<  peek=cage  bind:m
    (got-peek /x/v2/groups/(scot %p p:my-flag)/[q:my-flag])
  =+  group=!<(group:g q.peek)
  ::  verify records on the invited list
  ::
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get by invited.admissions.group) ~dev))
    !>(`[now.bowl `0v123])
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get by invited.admissions.group) ~fun))
    !>(`[now.bowl `0v124])
  ::  repeat the invite, make sure the previous invitation is revoked
  ::  and the invited list updated.
  ::
  ;<  caz=(list card)  bind:m
    (do-c-group [%entry %pending (sy ~fun ~) %add ~])
  ;<  =^bowl  bind:m  get-bowl
  ;<  =invite:v8:gv  bind:m  (get-invite `0v125)
  ;<  ~  bind:m
    =/  fun-wire=wire  (weld se-area /invite/send/~fun)
    =/  fun-revoke-wire=wire  (weld se-area /invite/revoke/~fun)
    =/  a-foreigns-7-fun=a-foreigns:v7:gv
      [%invite (v7:invite:v8:gc invite)]
    =/  a-foreigns-8-fun=a-foreigns:v8:gv
      [%invite invite]
    =/  =token-meta:g
      [[%personal ~fun] (add now.bowl ~d365) ~]
    %+  ex-cards  caz
    :~  ::
        ::  generate new token
        (ex-arvo-token-expire 0v125 expiry.token-meta)
        (ex-update now.bowl [%entry %token %add 0v125 token-meta])
        ::
        ::  revoke previous invitation
        (ex-poke fun-revoke-wire [~fun my-agent] group-foreign-2+!>([%revoke my-flag `0v124]))
        (ex-update (add now.bowl tick) [%entry %token %del 0v124])
        ::
        ::  invite ~fun
        (ex-poke (snoc fun-wire %old) [~fun my-agent] group-foreign-1+!>(a-foreigns-7-fun))
        (ex-poke fun-wire [~fun my-agent] group-foreign-2+!>(a-foreigns-8-fun))
        ::
        ::  entry update
        (ex-update (add now.bowl (mul tick 2)) [%entry %pending %add (sy ~fun ~) ~])
    ==
  (pure:m ~)
::  +test-public-invites: test public group invitations
::
::  group server properly records invited ships in admissions.
::
::  if a ship is invited a second time, the previous invitation
::  is revoked.
::
++  test-public-invites
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  do-groups-init
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(eny 0v123)))
  ::  create a group with members. each member is to receive an invite.
  ::
  ;<  caz=(list card)  bind:m  (do-create-group-with-members %public ~[~dev ~fun])
  ;<  =bowl  bind:m  get-bowl
  ;<  =invite:v8:gv  bind:m  (get-invite ~)
  ;<  ~  bind:m
    =/  dev-wire=wire  (weld se-area /invite/send/~dev)
    =/  fun-wire=wire  (weld se-area /invite/send/~fun)
    =/  a-foreigns-7=a-foreigns:v7:gv
      [%invite (v7:invite:v8:gc invite)]
    =/  a-foreigns-8=a-foreigns:v8:gv
      [%invite invite]
    %+  ex-cards  caz
    :~  ::
        ::  invite ~dev
        (ex-poke (snoc dev-wire %old) [~dev my-agent] group-foreign-1+!>(a-foreigns-7))
        (ex-poke dev-wire [~dev my-agent] group-foreign-2+!>(a-foreigns-8))
        ::
        ::  invite ~fun
        (ex-poke (snoc fun-wire %old) [~fun my-agent] group-foreign-1+!>(a-foreigns-7))
        (ex-poke fun-wire [~fun my-agent] group-foreign-2+!>(a-foreigns-8))
        ::
        ::  self-join and foreigns update
        (ex-poke-wire /foreigns/(scot %p p:my-flag)/[q:my-flag]/join/public)
        (ex-fact-paths ~[/v1/foreigns])
        (ex-fact-paths ~[/gangs/updates])
    ==
  ::TODO implement a +get-scry, +got-scry to return
  ::     typed values.
  ::
  ;<  peek=cage  bind:m
    (got-peek /x/v2/groups/(scot %p p:my-flag)/[q:my-flag])
  =+  group=!<(group:g q.peek)
  ::  verify records on the invited list
  ::
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get by invited.admissions.group) ~dev))
    !>(`[now.bowl ~])
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get by invited.admissions.group) ~fun))
    !>(`[now.bowl ~])
  ::  repeat the invite, make sure the previous invitation is revoked
  ::  and the invited list updated.
  ::
  ;<  caz=(list card)  bind:m
    (do-c-group [%entry %pending (sy ~fun ~) %add ~])
  ;<  =^bowl  bind:m  get-bowl
  ;<  =invite:v8:gv  bind:m  (get-invite ~)
  ;<  ~  bind:m
    =/  fun-wire=wire  (weld se-area /invite/send/~fun)
    =/  fun-revoke-wire=wire  (weld se-area /invite/revoke/~fun)
    =/  a-foreigns-7-fun=a-foreigns:v7:gv
      [%invite (v7:invite:v8:gc invite)]
    =/  a-foreigns-8-fun=a-foreigns:v8:gv
      [%invite invite]
    =/  =token-meta:g
      [[%personal ~fun] (add now.bowl ~d365) ~]
    %+  ex-cards  caz
    :~  ::
        ::  revoke previous invitation
        (ex-poke fun-revoke-wire [~fun my-agent] group-foreign-2+!>([%revoke my-flag ~]))
        ::
        ::  invite ~fun
        (ex-poke (snoc fun-wire %old) [~fun my-agent] group-foreign-1+!>(a-foreigns-7-fun))
        (ex-poke fun-wire [~fun my-agent] group-foreign-2+!>(a-foreigns-8-fun))
        ::
        ::  entry update
        (ex-update now.bowl [%entry %pending %add (sy ~fun ~) ~])
    ==
  ;<  peek=cage  bind:m
    (got-peek /x/v2/groups/(scot %p p:my-flag)/[q:my-flag])
  =+  group=!<(group:g q.peek)
  ::  verify records on the invited list
  ::
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get by invited.admissions.group) ~fun))
    !>(`[now.bowl ~])
  (pure:m ~)
::  +test-invites-banned: test invite revocation for banned ships
::
++  test-invites-banned
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  do-groups-init
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(eny 0v123)))
  ::  create a group with members. each member is to receive an invite.
  ::
  ;<  caz=(list card)  bind:m  (do-create-group-with-members %private ~[~dev])
  ;<  =bowl  bind:m  get-bowl
  ;<  =invite:v8:gv  bind:m  (get-invite `0v123)
  ;<  ~  bind:m
    =/  dev-wire=wire  (weld se-area /invite/send/~dev)
    =/  a-foreigns-7-dev=a-foreigns:v7:gv
      [%invite (v7:invite:v8:gc invite)]
    =/  a-foreigns-8-dev=a-foreigns:v8:gv
      [%invite invite]
    %+  ex-cards  caz
    :~  ::
        ::  invite ~dev
        (ex-arvo-token-expire 0v123 (add now.bowl ~d365))
        (ex-poke (snoc dev-wire %old) [~dev my-agent] group-foreign-1+!>(a-foreigns-7-dev))
        (ex-poke dev-wire [~dev my-agent] group-foreign-2+!>(a-foreigns-8-dev))
        ::
        ::  self-join and foreigns update
        (ex-poke-wire /foreigns/(scot %p p:my-flag)/[q:my-flag]/join/public)
        (ex-fact-paths ~[/v1/foreigns])
        (ex-fact-paths ~[/gangs/updates])
    ==
  ::TODO implement a +get-scry, +got-scry to return
  ::     typed values.
  ::
  ;<  peek=cage  bind:m
    (got-peek /x/v2/groups/(scot %p p:my-flag)/[q:my-flag])
  =+  group=!<(group:g q.peek)
  ::  verify records on the invited list
  ::
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get by invited.admissions.group) ~dev))
    !>(`[now.bowl `0v123])
  ::  ban ~dev and verify the invite is revoked, and the token deleted
  ::
  ;<  caz=(list card)  bind:m
    (do-c-group [%entry %ban %add-ships (sy ~dev ~)])
  ;<  =^bowl  bind:m  get-bowl
  ;<  ~  bind:m
    =/  dev-revoke-wire=wire  (weld se-area /invite/revoke/~dev)
    %+  ex-cards  caz
    :~  (ex-update now.bowl [%seat (sy ~dev ~) %del ~])
        ::
        ::  revoke previous invitation
        (ex-poke dev-revoke-wire [~dev my-agent] group-foreign-2+!>([%revoke my-flag `0v123]))
        (ex-update (add now.bowl tick) [%entry %token %del 0v123])
      ::
        (ex-update (add now.bowl (mul tick 2)) [%entry %ban %add-ships (sy ~dev ~)])
    ==
  ::  verify records on the invited list
  ::
  ;<  peek=cage  bind:m
    (got-peek /x/v2/groups/(scot %p p:my-flag)/[q:my-flag])
  =+  group=!<(group:g q.peek)
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get by invited.admissions.group) ~dev))
    !>(~)
  (pure:m ~)
::  +test-invites-deleted-token: test invites are revoked when a token is deleted
::
++  test-invites-deleted-token
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  do-groups-init
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(eny 0v123)))
  ::  create a group with members. each member is to receive an invite.
  ::
  ;<  caz=(list card)  bind:m  (do-create-group-with-members %private ~[~dev])
  ;<  =bowl  bind:m  get-bowl
  ;<  =invite:v8:gv  bind:m  (get-invite `0v123)
  ;<  ~  bind:m
    =/  dev-wire=wire  (weld se-area /invite/send/~dev)
    =/  a-foreigns-7-dev=a-foreigns:v7:gv
      [%invite (v7:invite:v8:gc invite)]
    =/  a-foreigns-8-dev=a-foreigns:v8:gv
      [%invite invite]
    %+  ex-cards  caz
    :~  ::
        ::  invite ~dev
        (ex-arvo-token-expire 0v123 (add now.bowl ~d365))
        (ex-poke (snoc dev-wire %old) [~dev my-agent] group-foreign-1+!>(a-foreigns-7-dev))
        (ex-poke dev-wire [~dev my-agent] group-foreign-2+!>(a-foreigns-8-dev))
        ::
        ::  self-join and foreigns update
        (ex-poke-wire /foreigns/(scot %p p:my-flag)/[q:my-flag]/join/public)
        (ex-fact-paths ~[/v1/foreigns])
        (ex-fact-paths ~[/gangs/updates])
    ==
  ::TODO implement a +get-scry, +got-scry to return
  ::     typed values.
  ::
  ;<  peek=cage  bind:m
    (got-peek /x/v2/groups/(scot %p p:my-flag)/[q:my-flag])
  =+  group=!<(group:g q.peek)
  ::  verify records on the invited list
  ::
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get by invited.admissions.group) ~dev))
    !>(`[now.bowl `0v123])
  ::  delete token and verify the invitation is revoked
  ::
  ;<  caz=(list card)  bind:m
    (do-c-group [%entry %token %del 0v123])
  ;<  =^bowl  bind:m  get-bowl
  ;<  ~  bind:m
    =/  dev-revoke-wire=wire  (weld se-area /invite/revoke/~dev)
    %+  ex-cards  caz
    :~  ::
        ::  revoke previous invitation
        (ex-poke dev-revoke-wire [~dev my-agent] group-foreign-2+!>([%revoke my-flag `0v123]))
        (ex-update now.bowl [%entry %token %del 0v123])
      ::
    ==
  ::  verify records on the invited list
  ::
  ;<  peek=cage  bind:m
    (got-peek /x/v2/groups/(scot %p p:my-flag)/[q:my-flag])
  =+  group=!<(group:g q.peek)
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get by invited.admissions.group) ~dev))
    !>(~)
  (pure:m ~)
::  +test-invites-expired: test expired invites are revoked
::
::  when a token expires, it is deleted, and any associated invitations revoked.
::
++  test-invites-expired
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  do-groups-init
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(eny 0v123)))
  ::  create a group with members. each member is to receive an invite.
  ::
  ;<  caz=(list card)  bind:m  (do-create-group-with-members %private ~[~dev])
  ;<  =bowl  bind:m  get-bowl
  ;<  =invite:v8:gv  bind:m  (get-invite `0v123)
  ;<  ~  bind:m
    =/  dev-wire=wire  (weld se-area /invite/send/~dev)
    =/  a-foreigns-7-dev=a-foreigns:v7:gv
      [%invite (v7:invite:v8:gc invite)]
    =/  a-foreigns-8-dev=a-foreigns:v8:gv
      [%invite invite]
    %+  ex-cards  caz
    :~  ::
        ::  invite ~dev
        (ex-arvo-token-expire 0v123 (add now.bowl ~d365))
        (ex-poke (snoc dev-wire %old) [~dev my-agent] group-foreign-1+!>(a-foreigns-7-dev))
        (ex-poke dev-wire [~dev my-agent] group-foreign-2+!>(a-foreigns-8-dev))
        ::
        ::  self-join and foreigns update
        (ex-poke-wire /foreigns/(scot %p p:my-flag)/[q:my-flag]/join/public)
        (ex-fact-paths ~[/v1/foreigns])
        (ex-fact-paths ~[/gangs/updates])
    ==
  ::TODO implement a +get-scry, +got-scry to return
  ::     typed values.
  ::
  ;<  peek=cage  bind:m
    (got-peek /x/v2/groups/(scot %p p:my-flag)/[q:my-flag])
  =+  group=!<(group:g q.peek)
  ::  verify records on the invited list
  ::
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get by invited.admissions.group) ~dev))
    !>(`[now.bowl `0v123])
  ::  wait until token expires, and verify it is deleted and
  ::  the invite revoked.
  ::
  ;<  *  bind:m  (wait ~d365)
  ;<  caz=(list card)  bind:m  (do-arvo (weld se-area /tokens/0v123/expire) [%behn %wake ~])
  ;<  =^bowl  bind:m  get-bowl
  ;<  ~  bind:m
    =/  dev-revoke-wire=wire  (weld se-area /invite/revoke/~dev)
    %+  ex-cards  caz
    :~  ::
        ::  revoke previous invitation
        (ex-poke dev-revoke-wire [~dev my-agent] group-foreign-2+!>([%revoke my-flag `0v123]))
        (ex-update now.bowl [%entry %token %del 0v123])
      ::
    ==
  ::  verify records on the invited list
  ::
  ;<  peek=cage  bind:m
    (got-peek /x/v2/groups/(scot %p p:my-flag)/[q:my-flag])
  =+  group=!<(group:g q.peek)
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get by invited.admissions.group) ~dev))
    !>(~)
  (pure:m ~)
::  +test-invites-group-deleted: test invites are revoked when the group is deleted
::
++  test-invites-group-deleted
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  do-groups-init
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(eny 0v123)))
  ::  create a group with members. each member is to receive an invite.
  ::
  ;<  caz=(list card)  bind:m  (do-create-group-with-members %private ~[~dev ~fun])
  ;<  =bowl  bind:m  get-bowl
  ;<  =invite:v8:gv  bind:m  (get-invite `0v123)
  ;<  ~  bind:m
    =/  dev-wire=wire  (weld se-area /invite/send/~dev)
    =/  fun-wire=wire  (weld se-area /invite/send/~fun)
    =/  a-foreigns-7-dev=a-foreigns:v7:gv
      [%invite (v7:invite:v8:gc invite)]
    =/  a-foreigns-8-dev=a-foreigns:v8:gv
      [%invite invite]
    =/  a-foreigns-7-fun=a-foreigns:v7:gv
      [%invite (v7:invite:v8:gc invite(token `0v124))]
    =/  a-foreigns-8-fun=a-foreigns:v8:gv
      [%invite invite(token `0v124)]
    =+  expiry=(add now.bowl ~d365)
    %+  ex-cards  caz
    :~  ::
        ::  invite ~dev
        (ex-arvo-token-expire 0v123 expiry)
        (ex-poke (snoc dev-wire %old) [~dev my-agent] group-foreign-1+!>(a-foreigns-7-dev))
        (ex-poke dev-wire [~dev my-agent] group-foreign-2+!>(a-foreigns-8-dev))
        ::
        ::  invite ~fun
        (ex-arvo-token-expire 0v124 expiry)
        (ex-poke (snoc fun-wire %old) [~fun my-agent] group-foreign-1+!>(a-foreigns-7-fun))
        (ex-poke fun-wire [~fun my-agent] group-foreign-2+!>(a-foreigns-8-fun))
        ::
        ::  self-join and foreigns update
        (ex-poke-wire /foreigns/(scot %p p:my-flag)/[q:my-flag]/join/public)
        (ex-fact-paths ~[/v1/foreigns])
        (ex-fact-paths ~[/gangs/updates])
    ==
  ::TODO implement a +get-scry, +got-scry to return
  ::     typed values.
  ::
  ;<  peek=cage  bind:m
    (got-peek /x/v2/groups/(scot %p p:my-flag)/[q:my-flag])
  =+  group=!<(group:g q.peek)
  ::  verify records on the invited list
  ::
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get by invited.admissions.group) ~dev))
    !>(`[now.bowl `0v123])
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get by invited.admissions.group) ~fun))
    !>(`[now.bowl `0v124])
  ::  delete the group and verify the invites are revoked
  ::
  ;<  caz=(list card)  bind:m
    (do-c-group [%delete ~])
  ;<  =bowl:gall  bind:m  get-bowl
  ;<  ~  bind:m
    =/  revoke-wire=wire  (weld se-area /invite/revoke)
    %+  ex-cards  caz
    :~  (ex-poke (snoc revoke-wire ~.~dev) [~dev my-agent] group-foreign-2+!>([%revoke my-flag `0v123]))
        (ex-poke (snoc revoke-wire ~.~fun) [~fun my-agent] group-foreign-2+!>([%revoke my-flag `0v124]))
        (ex-update now.bowl [%delete ~])
        (ex-fact-paths ~[/v1/groups /v1/groups/(scot %p p:my-flag)/[q:my-flag]])
        (ex-fact-paths ~[/groups/ui])
        (ex-task (weld go-area /updates) [~zod my-agent] %leave ~)
    ==
  (pure:m ~)
--
