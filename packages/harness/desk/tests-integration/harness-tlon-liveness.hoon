::  Native readiness updates the public badge; all effects stay in the fixture.
/-  t=harness-tlon, ct=contacts, hh=harness-hand, ad=harness-adapter
/+  *test-agent, policy=harness-tlon-policy
/=  adapter  /app/harness-tlon
|%
::  Gall's head subscription, acknowledged when .head. Loading leaves and
::  re-watches it; the fixture keeps Gall's answer, as before.
::
++  head-sub
  |=  head=?
  %-  jab-bowl
  |=  b=bowl
  b(wex (~(put by wex.b) [/head ~zod %harness] [head /hand-events]))
::  Badge patches among the emitted cards, in order.
::
++  badges
  |=  cards=(list card)
  ^-  (list contact:ct)
  %+  murn  cards
  |=  =card
  ^-  (unit contact:ct)
  ?.  ?=([%pass [%liveness ~] %agent * %poke %contact-action-1 *] card)  ~
  =/  [pass=* wire=* agent=* who=* poke=* mark=* data=vase]  card
  =/  action  !<(action:ct data)
  ?>  ?=(%self -.action)
  `+.action
::
++  run
  |=  $:  enabled=?  head=?  contact=(unit contact:ct)
          event=?(%load %disable %enable %kick %recover %nack)
      ==
  =/  m  (mare ,(list contact:ct))
  =/  n  (mare ,(list card))
  ^-  form:m
  =/  saved=state-2:t  *state-2:t
  =.  saved
    %=  saved  owner-initialized  1  policy  [enabled `~zod ~ %mentions ~ ~]  watching  &
      activity-through  ~2026.10.1
    ==
  ;<  ~  bind:m  (set-bowl %*(. *bowl our ~zod, src ~zod, now ~2026.10.1..00.00.10))
  ;<  ~  bind:m  (head-sub head)
  ::  The Activity watch is acknowledged, except that recovery needs Gall's
  ::  acknowledgement still to arrive.
  ;<  ~  bind:m
    %-  jab-bowl
    |=  b=bowl
    b(wex (~(put by wex.b) [/activity ~zod %activity] [!=(%recover event) /v4]))
  ;<  ~  bind:m
    %-  set-scry-gate
    |=  =path
    ^-  (unit vase)
    ?:  ?=([%gu @ %contacts @ %$ ~] path)  `!>(?=(^ contact))
    ?:  =(%$ (rear path))  `!>(&)
    ?:  ?=([%gx @ %contacts @ %v1 %self %contact-1 ~] path)
      ?~(contact ~ `!>(u.contact))
    ?:  ?=([%gx @ %chat @ %dm %invited %ships ~] path)  `!>(~)
    ?:  (lien path |=(part=@ta =(%hand-state part)))  `!>(*state:hh)
    ?:  (lien path |=(part=@ta =(%activity part)))  `!>(~)
    ~
  ;<  loaded=(list card)  bind:m  (do-load adapter `!>(saved))
  ;<  ~  bind:m  (head-sub head)
  ;<  caz=(list card)  bind:m
    ?-  event
      %load     (pure:n loaded)
      %kick     (do-agent /activity [~zod %activity] [%kick ~])
      %recover  (do-agent /activity [~zod %activity] [%watch-ack ~])
      %nack     (do-agent /liveness [~zod %contacts] [%poke-ack `~])
        ?(%enable %disable)
      =/  params  (policy-json:policy policy.saved(enabled =(%enable event)))
      %+  do-poke  %noun
      !>(`request:ad`['fixture' [%n '1'] 'harness/tlon/configure' `params])
    ==
  (pure:m (badges caz))
::
++  expect-badges
  |=  [expected=(list contact:ct) actual=(form-raw (list contact:ct))]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  got=(list contact:ct)  bind:m  actual
  (ex-equal !>(got) !>(expected))
++  online
  (my ~[[%bot-liveness [%text '{"v":1,"state":"online"}']]])
++  offline
  (my ~[[%bot-liveness [%text '{"v":1,"state":"offline"}']]])
++  test-reload-repairs-offline-badge-and-current-badge-is-quiet
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (expect-badges ~[online] (run & & `offline %load))
  (expect-badges ~ (run & & `online %load))
++  test-disabled-or-disconnected-hand-is-offline
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (expect-badges ~[offline] (run | & `online %load))
  ;<  ~  bind:m  (expect-badges ~[offline] (run & | `online %load))
  ;<  ~  bind:m  (expect-badges ~[offline] (run & & `online %kick))
  (expect-badges ~[online] (run & & `offline %recover))
++  test-enable-and-disable-update-liveness
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (expect-badges ~[online] (run | & `offline %enable))
  (expect-badges ~[offline] (run & & `online %disable))
++  test-unavailable-contacts-and-nacks-do-not-loop-or-block-the-hand
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (expect-badges ~ (run & & ~ %load))
  (expect-badges ~ (run & & `offline %nack))
--
