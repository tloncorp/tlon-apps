::  groups subscriber unit tests
::
/-  g=groups, gv=groups-ver, meta, s=story
/+  *test, *test-agent, negotiate
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
    [%gu ship=@ %activity now=@ rest=*]  `!>(|)
  ==
++  is-negotiate-card
  |=  =card
  ?=([%pass [%~.~ %negotiate *] *] card)
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
::     ~[/server/groups/~zod/my-test-group/updates/~zod/(scot %da *@da)]
::   group-update+!>(`update:g`[time u-group])
++  go-area  /groups/(scot %p p:my-flag)/[q:my-flag]
++  fi-area  /foreigns/(scot %p p:my-flag)/[q:my-flag]
::
++  ex-c-groups
  |=  =c-groups:g
  (ex-poke (weld go-area /command/join) [~zod my-agent] group-command+!>(c-groups))
::
++  ex-foreign-response
  |=  =foreign:g
  =/  =gang:v2:gv
    %-  gang:v2:foreign:v7:gc
    (v7:foreign:v8:gc foreign)
  (ex-fact ~[/gangs/updates] gangs+!>(`gangs:v2:gv`(my my-flag^gang ~)))
::
++  heed-wire
  |=  [=gill:gall =protocol:negotiate]
  /~/negotiate/heed/(scot %p p.gill)/[q.gill]/[protocol]
::
++  ex-fact-negotiate
  |=  [=gill:gall =protocol:negotiate]
  %^  ex-task  (heed-wire gill protocol)
    gill
  [%watch /~/negotiate/version/[q.gill]]
::  +ex-cards: lib-negotiate compatible +ex-cards
::
++  ex-cards
  |=  [caz=(list card) exe=(list $-(card tang))]
  =.  caz
    %+  turn  caz
    |=  =card
    ?.  ?=([%pass [%~.~ %negotiate %inner-watch @ @ *] *] card)
      card
    ?>  ?=([%pass * %agent ^ %watch *] card)
    [%pass |5.p.card q.card]
  (^ex-cards caz exe)
::
++  do-negotiate
  |=  [=gill:gall =protocol:negotiate =version:negotiate]
  =/  m  (mare ,(list card))
  ;<  caz=(list card)  bind:m
    %^  do-agent  (heed-wire gill protocol)
      gill
    [%watch-ack ~]
  ;<  cax=(list card)  bind:m
    %^  do-agent  (heed-wire gill protocol)
      gill
    [%fact %noun !>(version)]
  (pure:m (weld caz cax))
::  +do-neg-fact: pass a sign on a negotiate inner-watch wire
::
++  do-neg-agent
  |=  [=wire =gill:gall =sign:agent:gall]
  =/  neg-wire=^wire
    (weld /~/negotiate/inner-watch/(scot %p p.gill)/[q.gill] wire)
  (do-agent neg-wire gill sign)
::
++  do-a-groups
  |=  =a-groups:g
  =/  m  (mare ,(list card))
  ^-  form:m
  ;<  ~  bind:m  (wait ~m1)
  (do-poke group-action-4+!>(`a-groups:v7:gv`a-groups))
::
++  do-a-group
  |=  =a-group:g
  =/  m  (mare ,(list card))
  ^-  form:m
  ;<  ~  bind:m  (wait ~m1)
  =/  =a-groups:g  [%group my-flag a-group]
  (do-poke group-action-4+!>(`a-groups:v7:gv`a-groups))
::
++  do-a-foreigns
  |=  =a-foreigns:g
  =/  m  (mare ,(list card))
  ^-  form:m
  ;<  ~  bind:m  (wait ~m1)
  (do-poke group-foreign-2+!>(`a-foreigns:v8:gv`a-foreigns))
::
++  do-a-foreign
  |=  =a-foreign:g
  =/  m  (mare ,(list card))
  ^-  form:m
  ;<  ~  bind:m  (wait ~m1)
  =/  =a-foreigns:g  [%foreign my-flag a-foreign]
  (do-poke group-foreign-2+!>(`a-foreigns:v8:gv`a-foreigns))
::
++  ex-r-groups
  |=  [caz=(list card) rs-groups=(list r-groups:v7:gv)]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  =bowl:gall  bind:m  get-bowl
  ;<  peek=cage  bind:m  (got-peek /x/v2/groups/~zod/my-test-group)
  =+  !<(=group:g q.peek)
  =/  actions-2=(list action:v2:gv)
    %-  zing
    %+  turn  rs-groups
    |=  =r-groups:v7:gv
    %+  turn
      (diff:v2:r-group:v7:gc r-group.r-groups [seats admissions]:group)
    |=  =diff:v2:gv
    [flag.r-groups now.bowl diff]
  %+  ex-cards  caz
  %+  welp
    %+  turn  rs-groups
    |=  =r-groups:v7:gv
    %+  ex-fact  ~[/v1/groups /v1/groups/~zod/my-test-group]
    group-response-1+!>(r-groups)
  %+  turn  actions-2
  |=  =action:v2:gv
  (ex-fact ~[/groups/ui] group-action-3+!>(action))
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
::
++  do-join-group
  =/  m  (mare (list card))
  ^-  form:m
  ;<  caz=(list card)  bind:m  (do-a-foreigns [%foreign my-flag %join ~])
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-fact-negotiate [~zod my-agent] %groups)
        (ex-poke (weld fi-area /join/public) [~zod my-agent] group-command+!>([%join my-flag ~]))
        (ex-foreign-response %*(. *foreign:g progress `%join))
    ==
  ;<  *  bind:m  (do-negotiate [~zod my-agent] %groups %1)
  ;<  caz=(list card)  bind:m
    %-  (do-as ~zod)
    %^  do-agent  (weld fi-area /join/public)
      my-flag
    [%poke-ack ~]
  ;<  ~  bind:m
    =/  =wire  (weld go-area /updates)
    =/  sub=path
      %+  weld  `path`[%server go-area]
      /updates/~dev/(scot %da *@da)
    %+  ex-cards  caz
    :~  (ex-task wire [~zod my-agent] %watch sub)
        (ex-foreign-response %*(. *foreign:g progress `%watch))
    ==
  ;<  =bowl  bind:m  get-bowl
  ;<  *  bind:m
    %^  do-neg-agent  (weld go-area /updates) 
      [~zod my-agent]
    [%watch-ack ~]
  =/  init-log=log:g
    %+  gas:log-on:g  *log:g
    ^-  (list [@da u-group:g])
    :~  now.bowl^[%create my-group]
    ==
  ;<  caz=(list card)  bind:m
    %^  do-neg-agent  (weld go-area /updates) 
      [~zod my-agent]
    [%fact group-log+!>(init-log)]
  (pure:m caz)
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
::
--
