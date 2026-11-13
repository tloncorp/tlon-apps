::  Full adapter with synthetic scries; emitted effects never execute.
::  -test /=harness=/tests-integration/harness-tlon-subscription
/-  t=harness-tlon, hh=harness-hand, ad=harness-adapter, ac=acp
/+  *test-agent, policy=harness-tlon-policy
/=  adapter  /app/harness-tlon
|%
+$  outcome  [cards=(list card) replies=(list json) saved=state-3:t]
++  fixture
  ^-  state-2:t
  =/  s=state-2:t  *state-2:t
  %=  s  owner-initialized  1  policy  [& `~zod ~ %mentions ~ ~]  activity-through  ~2026.10.1
    error  'Activity recovery failed'
  ==
::  Gall's acknowledged head subscription. Loading leaves and re-watches it;
::  the fixture keeps it acknowledged, as before.
::
++  head-connected
  %-  jab-bowl
  |=  b=bowl
  b(wex (~(put by wex.b) [/head ~zod %harness] [& /hand-events]))
::
++  activity-sub
  |=  sub=[acked=? path=path]
  %-  jab-bowl
  |=  b=bowl
  b(wex (~(put by wex.b) [/activity ~zod %activity] sub))
::
++  run
  |=  [saved=state-2:t sub=(unit [acked=? path=path]) event=?(%load %wake %kick %enable %disable)]
  =/  m  (mare ,outcome)
  =/  n  (mare ,(list card))
  ^-  form:m
  ;<  ~  bind:m  (set-bowl %*(. *bowl our ~zod, src ~zod, now ~2026.10.1..00.00.10))
  ;<  ~  bind:m  head-connected
  ::  A retry wake loads without the Activity watch; see below.
  ;<  ~  bind:m
    ?:  |(?=(~ sub) =(%wake event))  (pure:(mare ,~) ~)
    (activity-sub (need sub))
  ;<  ~  bind:m
    %-  set-scry-gate
    |=  =path
    ^-  (unit vase)
    ?:  ?=([%gu @ %contacts @ %$ ~] path)  `!>(|)
    ?:  =(%$ (rear path))  `!>(&)
    ::  Native Chat is installed and has no pending invitations.
    ?:  ?=([%gx @ %chat @ %dm %invited %ships ~] path)  `!>(~)
    ?:  (lien path |=(part=@ta =(%hand-state part)))  `!>(*state:hh)
    ::  The current Activity feed is empty; its cursor remains untouched.
    ?:  (lien path |=(part=@ta =(%activity part)))  `!>(~)
    ~
  ;<  loaded=(list card)  bind:m  (do-load adapter `!>(saved))
  ;<  ~  bind:m  head-connected
  ;<  caz=(list card)  bind:m
    ?-  event
      %load  (pure:n loaded)
      %kick  (do-agent /activity [~zod %activity] [%kick ~])
        %wake
      ::  A retry wake receives Gall's acknowledged watch while the saved
      ::  adapter still has watching=false, as after an acknowledgement crash:
      ::  Gall holds the acknowledged watch, the adapter never processed it.
      ;<  ~  bind:n  ?~(sub (pure:(mare ,~) ~) (activity-sub u.sub))
      (do-arvo /poll [%behn %wake ~])
        ?(%enable %disable)
      =/  params  (policy-json:policy policy.saved(enabled =(%enable event)))
      %+  do-poke  %noun
      !>(`request:ad`['fixture' [%n '1'] 'harness/tlon/configure' `params])
    ==
  ;<  =vase  bind:m  get-save
  (pure:m (activity-cards caz) (replies caz) !<(state-3:t vase))
++  replies
  |=  cards=(list card)
  ^-  (list json)
  %+  murn  cards
  |=  =card
  ^-  (unit json)
  ?.  ?=([%pass [%acp %send ~] %agent * %poke %acp-action-1 *] card)  ~
  =/  [pass=* wire=* agent=* who=* poke=* mark=* data=vase]  card
  =/  action  !<(action:v1:ac data)
  ?>  ?=(%send -.action)
  (de:json:html payload.action)
++  reply-policy
  |=  frames=(list json)
  ^-  json
  ?>  ?=([* ~] frames)
  =/  frame  i.frames
  ?>  ?=(%o -.frame)
  ?>  =([%n '1'] (~(got by p.frame) 'id'))
  =/  result  (~(got by p.frame) 'result')
  ?>  ?=(%o -.result)
  (~(got by p.result) 'policy')
++  activity-cards
  |=  cards=(list card)
  (skim cards |=(c=card ?=([%pass [%activity ~] %agent *] c)))
++  test-acknowledged-watch-repairs-local-flag-on-reload-and-retry
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  fixture
  ;<  reloaded=outcome  bind:m  (run fixture `[& /v4] %load)
  ;<  retried=outcome   bind:m  (run fixture `[& /v4] %wake)
  ;<  ~  bind:m  (ex-equal !>(watching.saved.reloaded) !>(&))
  ;<  ~  bind:m  (ex-equal !>(watching.saved.retried) !>(&))
  ;<  ~  bind:m  (ex-equal !>((activity-cards cards.reloaded)) !>(`(list card)`~))
  ;<  ~  bind:m  (ex-equal !>((activity-cards cards.retried)) !>(`(list card)`~))
  ;<  ~  bind:m  (ex-equal !>(error.saved.reloaded) !>(''))
  (ex-equal !>(activity-through.saved.retried) !>(activity-through.s))
++  test-pending-watch-is-not-duplicated-or-treated-as-connected
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  fixture
  ;<  out=outcome  bind:m  (run s(watching &) `[| /v4] %load)
  %+  ex-equal
    !>(&(!watching.saved.out =(~ (activity-cards cards.out)) ?=(^ wake.saved.out)))
  !>(&)
++  test-missing-watch-and-kick-create-one-watch
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  fixture
  ;<  loaded=outcome  bind:m  (run s(watching &) ~ %load)
  ;<  kicked=outcome  bind:m  (run fixture ~ %kick)
  =/  expected=(list card)  ~[[%pass /activity %agent [~zod %activity] %watch /v4]]
  %+  ex-equal
    !>  ?&  !watching.saved.loaded  =(expected (activity-cards cards.loaded))
            =(expected (activity-cards cards.kicked))
        ==
  !>(&)
++  test-enable-reuses-watch-and-disable-only-leaves
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  fixture
  ;<  enabled=outcome   bind:m  (run s(enabled.policy |) `[& /v4] %enable)
  ;<  disabled=outcome  bind:m  (run fixture `[& /v4] %disable)
  =/  expected=(list card)  ~[[%pass /activity %agent [~zod %activity] %leave ~]]
  %+  ex-equal
    !>  ?&  watching.saved.enabled  =(~ (activity-cards cards.enabled))
            !watching.saved.disabled  =(expected (activity-cards cards.disabled))
        ==
  !>(&)
++  test-disabled-reload-never-subscribes
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  s  fixture
  ;<  out=outcome  bind:m  (run s(enabled.policy |, watching &) `[& /v4] %load)
  (ex-equal !>(&(!watching.saved.out =(~ (activity-cards cards.out)))) !>(&))
::
++  test-configuration-reply-reports-the-applied-policy
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  fixture
  ;<  enabled=outcome   bind:m  (run saved(enabled.policy |) `[& /v4] %enable)
  ;<  disabled=outcome  bind:m  (run saved `[& /v4] %disable)
  ;<  ~  bind:m
    %+  ex-equal
      !>((reply-policy replies.enabled))
    !>((policy-json:policy policy.saved.enabled))
  %+  ex-equal
    !>((reply-policy replies.disabled))
  !>((policy-json:policy policy.saved.disabled))
--
