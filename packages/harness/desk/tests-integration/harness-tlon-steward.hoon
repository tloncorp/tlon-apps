::  Steward's owner and gateway lease do not depend on Lens sync. Steward is
::  answered by the fixture's scries; its pokes stay in the fixture.
/-  t=harness-tlon, ad=harness-adapter, hh=harness-hand, steward, steward-gateway
/+  *test-agent
/=  adapter  /app/harness-tlon
|%
++  saved
  |=  [owner=(unit @p) lens=?]
  ^-  state-3:t
  =/  saved=state-3:t  *state-3:t
  %=  saved  owner-initialized  1  policy  [& owner ~ %mentions ~ ~]  watching  &
    activity-through  ~2026.10.1
    lens  ?.(lens *lens-sync:t [& owner ~2026.10.1 ~ ''])
  ==
::  Loads the hand, online, with Steward running or not, and returns the
::  cards of loading.
::
++  boot
  |=  [owner=(unit @p) lens=? running=?]
  =/  m  (mare ,(list card))
  ^-  form:m
  ;<  ~  bind:m  (set-bowl %*(. *bowl our ~zod, src ~zod, now ~2026.10.1..00.00.10))
  ;<  ~  bind:m
    %-  jab-bowl
    |=  b=bowl
    %=  b  wex
      %-  ~(gas by wex.b)
      :~  [[/head ~zod %harness] [& /hand-events]]
          [[/activity ~zod %activity] [& /v4]]
      ==
    ==
  ;<  ~  bind:m  (set-scry-gate (scries running))
  (do-load adapter `!>((saved owner lens)))
::
++  scries
  |=  running=?
  |=  =path
  ^-  (unit vase)
  ?:  ?=([%gu @ %steward @ %$ ~] path)  `!>(running)
  ?:  ?=([%gx @ %steward @ %v1 %gateway %status %noun ~] path)
    `!>(`[status:v1:steward-gateway (unit @da)]`[%down ~])
  ?:  ?=([%gu @ %contacts @ %$ ~] path)  `!>(|)
  ?:  =(%$ (rear path))  `!>(&)
  ?:  ?=([%gx @ %chat @ %dm %invited %ships ~] path)  `!>(~)
  ?:  (lien path |=(part=@ta =(%hand-state part)))  `!>(*state:hh)
  ?:  (lien path |=(part=@ta =(%hand-index part)))  `!>(*index:hh)
  ?:  (lien path |=(part=@ta =(%activity part)))  `!>(~)
  ~
::  The owners of the core %configure pokes to Steward among the cards.
::
++  owners
  |=  cards=(list card)
  ^-  (list @p)
  %+  murn  cards
  |=  =card
  ^-  (unit @p)
  ?.  ?=([%pass [%steward %configure ~] %agent [@ %steward] %poke %steward-action-1 *] card)
    ~
  =/  [* * * * * * data=vase]  card
  =/  action  !<(action:v1:steward data)
  ?>  ?=(%configure -.action)
  `owner.action
::
++  leases
  |=  cards=(list card)
  ^-  @ud
  %-  lent
  %+  skim  cards
  |=  =card
  ?=([%pass [%steward %lease ~] %agent [@ %steward] %poke %steward-gateway-action-1 *] card)
::
++  set-owner
  |=  [owner=(unit @p) expected=(unit @p)]
  =/  m  (mare ,(list card))
  ^-  form:m
  =/  ship  |=(who=(unit @p) ?~(who ~ [%s (scot %p u.who)]))
  =/  params=json
    %-  pairs:enjs:format
    :~  ['owner' (ship owner)]
        ['expectedOwner' (ship expected)]
        ['siblingMoonOwners' %b |]
        ['expectedSiblingMoonOwners' %b |]
    ==
  %+  do-poke  %noun
  !>(`request:ad`['fixture' [%n '1'] 'harness/tlon/owner/set' `params])
::
++  errors
  =/  m  (mare ,[@t @t])
  ^-  form:m
  ;<  =vase  bind:m  get-save
  =/  state  !<(state-3:t vase)
  (pure:m [error.state error.lens.state])
::
++  test-steward-gets-the-owner-and-lease-without-lens-sync
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  caz=(list card)  bind:m  (boot `~nec | &)
  ;<  ~  bind:m  (ex-equal !>((owners caz)) !>(~[~nec]))
  (ex-equal !>((leases caz)) !>(1))
::
++  test-a-ship-without-steward-gets-no-steward-pokes
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  caz=(list card)  bind:m  (boot `~nec & |)
  ;<  ~  bind:m  (ex-equal !>((owners caz)) !>(`(list @p)`~))
  (ex-equal !>((leases caz)) !>(0))
::
++  test-a-steward-started-after-the-hand-gets-the-owner-with-the-lease
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (boot `~nec | |)
  ;<  ~  bind:m  (set-scry-gate (scries &))
  ::  Booting watches the head again; its ack is the hand's next event.
  ;<  caz=(list card)  bind:m  (do-agent /head [~zod %harness] [%watch-ack ~])
  ;<  ~  bind:m  (ex-equal !>((owners caz)) !>(~[~nec]))
  (ex-equal !>((leases caz)) !>(1))
::
::  Steward refuses a lease while it has no owner.
::
++  test-an-ownerless-hand-gives-steward-no-owner-and-asks-for-no-lease
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  caz=(list card)  bind:m  (boot ~ | &)
  ;<  ~  bind:m  (ex-equal !>((owners caz)) !>(`(list @p)`~))
  (ex-equal !>((leases caz)) !>(0))
::  Gall hands the owner's ack back before it delivers the lease poke sent
::  behind it, so an ack that took the lease would poke Steward without end.
::
++  test-a-steward-ack-sends-steward-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (boot `~nec | &)
  ;<  *  bind:m  (do-agent /head [~zod %harness] [%watch-ack ~])
  ;<  caz=(list card)  bind:m  (do-agent /steward/configure [~zod %steward] [%poke-ack ~])
  ;<  ~  bind:m  (ex-equal !>(caz) !>(`(list card)`~))
  ;<  caz=(list card)  bind:m  (do-agent /steward/lease [~zod %steward] [%poke-ack ~])
  (ex-equal !>(caz) !>(`(list card)`~))
::
++  test-an-owner-change-reconfigures-steward-and-a-cleared-owner-sends-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (boot `~nec | &)
  ;<  caz=(list card)  bind:m  (set-owner `~bud `~nec)
  ;<  ~  bind:m  (ex-equal !>((owners caz)) !>(~[~bud]))
  ;<  caz=(list card)  bind:m  (set-owner ~ `~bud)
  (ex-equal !>((owners caz)) !>(`(list @p)`~))
::
++  test-only-lens-sync-shows-a-steward-refusal
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  refused=sign:agent:gall  [%poke-ack `~[leaf+"refused"]]
  ;<  *  bind:m  (boot `~nec | &)
  ;<  *  bind:m  (do-agent /steward/configure [~zod %steward] refused)
  ;<  quiet=[@t @t]  bind:m  errors
  ;<  ~  bind:m  (ex-equal !>(quiet) !>(['' '']))
  ;<  *  bind:m  (boot `~nec & &)
  ;<  *  bind:m  (do-agent /steward/configure [~zod %steward] refused)
  ;<  shown=[@t @t]  bind:m  errors
  %+  ex-equal  !>(shown)
  !>(['' 'Steward is unavailable on this ship. Install or update Tlon, then retry sync.'])
--
