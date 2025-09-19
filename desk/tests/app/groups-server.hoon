::  groups unit tests
::
/-  g=groups, gv=groups-ver, meta, s=story
/+  *test, *test-negotiate-agent
/+  gc=groups-conv
/=  groups-agent  /app/groups
|%
++  my-agent  %groups
++  my-flag  `flag:g`[~zod %my-test-group]
++  my-area  `path`/groups/~zod/my-test-group
++  tick  ^~((div ~s1 (bex 16)))
::
++  my-scry-gate
  |=  =path
  ^-  (unit vase)
  ?+    path  ~
    [%gu ship=@ %activity now=@ rest=*]  `!>(|)
  ==
::
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
  ;<  *  bind:m  (do-watch (weld `path`[%server my-area] /updates/~zod/(scot %da *@da)))
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
  ;<  *  bind:m  (do-watch (weld `path`[%server my-area] /updates/~zod/(scot %da *@da)))
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
  |=  [caz=(list card) us-groups=(list u-group:v7:gv)]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  =bowl:gall  bind:m  get-bowl
  %+  ex-cards  caz
  (turn us-groups (cury ex-update now.bowl))
::
++  ex-update
  |=  [=time =u-group:v7:gv]
  %+  ex-fact
    ~[/server/groups/~zod/my-test-group/updates/~zod/(scot %da *@da)]
  group-update+!>(`update:g`[time u-group])
::
:: ++  ex-r-groups
::   |=  [caz=(list card) rs-groups=(list r-groups:v7:gv)]
::   =/  m  (mare ,~)
::   ^-  form:m
::   ;<  =bowl:gall  bind:m  get-bowl
::   ;<  peek=cage  bind:m  (got-peek /x/v2/groups/~zod/my-test-group)
::   =+  !<(=group:g q.peek)
::   =/  actions-2=(list action:v2:gv)
::     %-  zing
::     %+  turn  rs-groups
::     |=  =r-groups:v7:gv
::     %+  turn
::       (diff:v2:r-group:v7:gc r-group.r-groups [seats admissions]:group)
::     |=  =diff:v2:gv
::     [flag.r-groups now.bowl diff]
::   %+  ex-cards  caz
::   %+  welp
::     %+  turn  rs-groups
::     |=  =r-groups:v7:gv
::     %+  ex-fact  ~[/v1/groups /v1/groups/~zod/my-test-group]
::     group-response-1+!>(r-groups)
::   %+  turn  actions-2
::   |=  =action:v2:gv
::   (ex-fact ~[/groups/ui] group-action-3+!>(action))
:: ::
:: ++  ex-cards-r-groups
::   |=  $:  caz=(list card)
::           exes=(list (each $-(card tang) r-groups:v7:gv))
::       ==
::   =/  m  (mare ,~)
::   ^-  form:m
::   ::  extract group - it is needed for facts down-conversion
::   ::
::   ;<  =bowl:gall  bind:m  get-bowl
::   ;<  peek=cage  bind:m  (got-peek /x/v2/groups/~zod/my-test-group)
::   =+  !<(=group:g q.peek)
::   ::  assemble expected
::   ::
::   %+  ex-cards  caz
::   %-  flop
::   %+  roll  exes
::   |=  [exe=(each $-(card tang) r-groups:v7:gv) out=(list $-(card tang))]
::   ?:  ?=(%& -.exe)
::     ::  expected card
::     ::
::     [p.exe out]
::   ::  expected r-groups
::   ::
::   =*  r-groups  p.exe
::   =/  actions-2=(list action:v2:gv)
::     %+  turn
::       (diff:v2:r-group:v7:gc r-group.r-groups [seats admissions]:group)
::     |=  =diff:v2:gv
::     [flag.r-groups now.bowl diff]
::   %+  welp
::     %+  turn  actions-2
::     |=  =action:v2:gv
::     (ex-fact ~[/groups/ui] group-action-3+!>(action))
::   :-  %+  ex-fact  ~[/v1/groups /v1/groups/~zod/my-test-group]
::       group-response-1+!>(r-groups)
::   out
::
::  +test-c-groups-create: test group creation
::
::  group can be created. the host self-joins the group.
::  double creation is prohibited.
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
  =/  ask-path=path  (weld `path`[%server my-area] /ask/~dev)
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
  ::  a ship can ask to join the group. the request is recorded and
  ::  broadcasted.
  ::
  =/  =story:s
    [inline+['an appeal to host']~]~
  =/  ask-path=path  (weld `path`[%server my-area] /ask/~dev)
  ;<  caz=(list card)  bind:m
    ((do-as ~dev) (do-c-groups [%ask my-flag `story]))
  ;<  *  bind:m
    ((do-as ~dev) (do-watch ask-path))
  ;<  ~  bind:m
    (ex-u-groups caz [%entry %ask [%add ~dev `story]]~)
  ;<  peek=cage  bind:m  (got-peek /x/v2/groups/~zod/my-test-group)
  =+  !<(=group:g q.peek)
  ;<  ~  bind:m
    %+  ex-equal
      !>(`(unit (unit story:s))```story)
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
    :~  (ex-update now.bowl [%entry %token [%add 0v0 [personal+~dev (add now.bowl ~d365) ~]]])
        (ex-fact ~[ask-path] group-token+!>(`(unit token:g)``0v0))
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
  =/  ask-path=path  (weld `path`[%server my-area] /ask/~dev)
  ;<  caz=(list card)  bind:m
    ((do-as ~dev) (do-c-groups [%ask my-flag `story]))
  ;<  *  bind:m
    ((do-as ~dev) (do-watch ask-path))
  ;<  ~  bind:m
    (ex-u-groups caz [%entry %ask [%add ~dev `story]]~)
  ;<  peek=cage  bind:m  (got-peek /x/v2/groups/~zod/my-test-group)
  =+  !<(=group:g q.peek)
  ;<  ~  bind:m
    %+  ex-equal
      !>((~(get by requests.admissions.group) ~dev))
    !>(`(unit (unit story:s))```story)
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
::  +test-invites: test server group invitations
::
::  group server properly records invited ships in admissions.
::
::  if a ship is invited a second time, the previous invitation
::  is revoked.
::
++  test-invites
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  do-groups-init
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(eny 0v123)))
  ::  create a group with members. each member is to receive an invite.
  ::
  ;<  caz=(list card)  bind:m  (do-create-group-with-members %private ~[~dev ~fun])
  ;<  =bowl  bind:m  get-bowl
  ;<  peek=cage  bind:m  (got-peek /x/groups/(scot %p p:my-flag)/[q:my-flag]/preview)
  =+  preview=!<(preview:g q.peek)
  ;<  ~  bind:m
    =/  =invite:v8:gv
      :*  my-flag
          now.bowl
          our.bowl
          `0v123
          ~        ::  note
          preview  ::  preview
          &
      ==
    =/  dev-wire=wire
      /server/groups/(scot %p p:my-flag)/[q:my-flag]/invite/send/~dev
    =/  fun-wire=wire
      /server/groups/(scot %p p:my-flag)/[q:my-flag]/invite/send/~fun
    =/  a-foreigns-7-dev=a-foreigns:v7:gv
      [%invite (v7:invite:v8:gc invite)]
    =/  a-foreigns-8-dev=a-foreigns:v8:gv
      [%invite invite]
    =/  a-foreigns-7-fun=a-foreigns:v7:gv
      [%invite (v7:invite:v8:gc invite(token `0v124))]
    =/  a-foreigns-8-fun=a-foreigns:v8:gv
      [%invite invite(token `0v124)]
    %+  ex-cards  caz
    :~  ::
        ::  invite ~dev
        (ex-poke (snoc dev-wire %old) [~dev my-agent] group-foreign-1+!>(a-foreigns-7-dev))
        (ex-poke dev-wire [~dev my-agent] group-foreign-2+!>(a-foreigns-8-dev))
        ::
        ::  invite ~fun
        (ex-poke (snoc fun-wire %old) [~fun my-agent] group-foreign-1+!>(a-foreigns-7-fun))
        (ex-poke fun-wire [~fun my-agent] group-foreign-2+!>(a-foreigns-8-fun))
        ::
        ::  self-join and foreigns update
        (ex-poke-wire /foreigns/(scot %p p:my-flag)/[q:my-flag]/join/public)
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
  (pure:m ~)
--
