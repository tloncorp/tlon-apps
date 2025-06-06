::  groups unit tests
::
/-  g=groups, s=story
/+  *test, *test-agent
/+  gv=groups-ver
/=  groups-agent  /app/groups
|%
++  get-full-peek
  |=  =path
  =/  m  (mare ,cage)
  ^-  form:m
  |=  s=state
  =/  peek=(unit (unit cage))
    (~(on-peek agent.s bowl.s) path)
  ?.  ?=(^ peek)  |+~['invalid scry path' (spat path)]
  ?.  ?=(^ u.peek)  |+~['unexpected empty result at scry path' (spat path)]
  &+[u.u.peek s]
::
++  dap  %groups-test
++  my-flag  `flag:g`[~zod %my-test-group]
::
++  my-scry-gate
  |=  =path
  ^-  (unit vase)
  ~&  my-scry-gate+path
  ?+    path  ~
    [%gu ship=@ %activity now=@ rest=*]  `!>(|)
  ==
++  do-groups-init
  =/  m  (mare ,(list card))
  ^-  form:m
  ;<  ~  bind:m  (set-scry-gate my-scry-gate)
  (do-init dap groups-agent)
::
++  do-create-group
  =/  m  (mare ,(list card))
  ^-  form:m
  =/  =create-group:g
    :*  %my-test-group
        ['My Test Group' 'A testing group' '' '']
        %secret
        [~ ~]  ::  banned
        ~      ::  guests
    ==
  ;<  ~  bind:m  (set-src ~zod)
  ;<  ~  bind:m  (wait ~h1)
  ;<  caz=(list card)  bind:m  (do-poke group-command+!>([%create create-group]))
  (pure:m caz)
::
++  do-poke-c-group
  |=  [src=ship =c-group:g]
  =/  m  (mare ,(list card))
  ^-  form:m
  ;<  ~  bind:m  (set-src src)
  =/  =c-groups:g  [%group my-flag c-group]
  (do-poke group-command+!>(c-groups))
::
++  do-set-privacy
  |=  =privacy:g
  =/  m  (mare ,(list card))
  ^-  form:m
  (do-poke-c-group ~zod [%entry %privacy privacy])
::
++  ex-r-groups
  |=  [caz=(list card) =r-groups:v7:g]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  =bowl:gall  bind:m  get-bowl
  =/  actions-2=(list action:v2:g)
    %+  turn  (diff:v2:r-group:v7:gv r-group.r-groups)
    |=  =diff:v2:g
    [flag.r-groups now.bowl diff]
  %+  ex-cards  caz
  :-  %+  ex-fact  ~[/v1/groups /v1/groups/~zod/my-test-group]
      group-response-1+!>(r-groups)
  %+  turn  actions-2
  |=  =action:v2:g
  (ex-fact ~[/groups/ui] group-action-3+!>(action))
::  +test-c-groups-create: test group creation
::
::  group can be created. double creation is prohibited.
::
++  test-c-groups-create
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  do-groups-init
  ;<  caz=(list card)  bind:m  do-create-group
  ;<  peek=cage  bind:m  (get-full-peek /x/v2/groups/~zod/my-test-group)
  =+  !<(=group:g q.peek)
  :: ;<  ~  bind:m  (ex-r-groups caz [my-flag %create group])
  (ex-fail do-create-group)
::  +test-c-join-public: test public group join
::
::  a ship can join a public group without token. 
::  re-joining a public group is a valid, albeit vacuous, operation.
::
++  test-c-groups-join-public
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  do-groups-init
  ;<  *  bind:m  do-create-group
  ::  a ship can join a public group without a token
  ::
  ;<  caz=(list card)  bind:m  (do-set-privacy %public)
  ;<  ~  bind:m  (set-src ~dev)
  ;<  =bowl:gall  bind:m  get-bowl
  ;<  caz=(list card)  bind:m  (do-poke group-command+!>([%join my-flag ~]))
  =/  =seat:v7:g  [~ now.bowl]
  ;<  ~  bind:m  
    (ex-r-groups caz [my-flag %seat (sy ~dev ~) [%add seat]])
  ::  re-joining is a vacuous operation
  ::
  ;<  *  bind:m  (set-src ~dev)
  ;<  caz=(list card)  bind:m
    (do-poke group-command+!>([%join my-flag ~]))
  (ex-cards caz ~)
::  +test-c-groups-join-private: test private group join
::
::  a ship can join a private group only with a valid token.
::  re-joining the group with the same token fails, because
::  the token is no longer valid.
::
++  test-c-groups-join-private
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  do-groups-init
  ;<  *  bind:m  do-create-group
  ::  joining a private group without a valid token fails
  ::
  ;<  *  bind:m  (do-set-privacy %private)
  ;<  ~  bind:m  (set-src ~fed)
  ;<  *  bind:m
    (ex-fail (do-poke group-command+!>([%join my-flag ~])))
  ;<  caz=(list card)  bind:m
    =/  =c-token-add:g
      [[%personal ~dev] ~ ~ |]
    (do-poke-c-group ~zod [%entry %token %add c-token-add])
  ::  joining a private group with a valid token works
  ::
  ;<  *  bind:m  (set-src ~dev)
  ;<  caz=(list card)  bind:m
    (do-poke group-command+!>([%join my-flag `0v0]))
  ;<  =bowl  bind:m  get-bowl
  =/  =seat:v7:g  [~ now.bowl]
  ;<  ~  bind:m  
    (ex-r-groups caz [my-flag %seat (sy ~dev ~) [%add seat]])
  ::  re-joining the group with used token fails
  ::
  ;<  *  bind:m  (set-src ~dev)
  ;<  caz=(list card)  bind:m
    (ex-fail (do-poke group-command+!>([%join my-flag `0v0])))
  (pure:m ~)
::  +test-c-groups-ask: test group entry request
::
::  a ship can ask to join a group, unless he has been banned.
::  an ask to a public group is automatically approved. an ask
::  to a private group can be either approved or denied by an admin.
::  if a user is already a group member, the ask request is vacuous.
::
++  test-c-groups-ask
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  do-groups-init
  ;<  *  bind:m  do-create-group
  ::  a ship can ask to join the group
  ::
  =/  =story:s
    [inline+['a plea']~]~
  ;<  ~  bind:m  (set-src ~dev)
  ;<  caz=(list card)  bind:m
    (do-poke group-command+!>([%ask my-flag `story]))
  ;<  ~  bind:m
    (ex-r-groups caz [my-flag %entry %ask [%add ~dev `story]])
  (pure:m ~)
--
