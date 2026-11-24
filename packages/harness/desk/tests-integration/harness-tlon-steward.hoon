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
  (leased running ~)
::  Steward's gateway status reports a lease until the time given, or down.
::
++  leased
  |=  [running=? until=(unit @da)]
  |=  =path
  ^-  (unit vase)
  ?:  ?=([%gu @ %steward @ %$ ~] path)  `!>(running)
  ?:  ?=([%gx @ %steward @ %v1 %gateway %status %noun ~] path)
    `!>(`[status:v1:steward-gateway (unit @da)]`[?~(until %down %up) until])
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
::  How many times the cards watch, and leave, Steward's gateway feed.
::
++  gateway
  |=  cards=(list card)
  ^-  [watches=@ud leaves=@ud]
  =/  watch=card  [%pass /steward/gateway %agent [~zod %steward] %watch /v1/gateway]
  =/  leave=card  [%pass /steward/gateway %agent [~zod %steward] %leave ~]
  :-  (lent (skim cards |=(=card =(card watch))))
  (lent (skim cards |=(=card =(card leave))))
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
++  saved-wake
  =/  m  (mare ,(unit @da))
  ^-  form:m
  ;<  =vase  bind:m  get-save
  (pure:m wake:!<(state-3:t vase))
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
  ;<  caz=(list card)  bind:m  (boot `~nec | |)
  ;<  ~  bind:m  (ex-equal !>((gateway caz)) !>([1 0]))
  ;<  ~  bind:m  (ex-equal !>((owners caz)) !>(`(list @p)`~))
  ;<  ~  bind:m  (ex-equal !>((leases caz)) !>(0))
  ;<  caz=(list card)  bind:m  (do-agent /head [~zod %harness] [%watch-ack ~])
  ;<  ~  bind:m  (ex-equal !>((owners caz)) !>(`(list @p)`~))
  ;<  ~  bind:m  (ex-equal !>((leases caz)) !>(0))
  ;<  ~  bind:m  (set-scry-gate (scries &))
  ::  Gall replays the held watch when Steward starts; its ack is the next event.
  ;<  caz=(list card)  bind:m  (do-agent /steward/gateway [~zod %steward] [%watch-ack ~])
  ;<  ~  bind:m  (ex-equal !>((owners caz)) !>(~[~nec]))
  ;<  ~  bind:m  (ex-equal !>((leases caz)) !>(1))
  (ex-equal !>((gateway caz)) !>([0 0]))
::
++  test-the-hand-holds-one-watch-on-the-steward-gateway
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  caz=(list card)  bind:m  (boot `~nec | &)
  ;<  ~  bind:m  (ex-equal !>((gateway caz)) !>([1 0]))
  ;<  caz=(list card)  bind:m  (do-load adapter `!>((saved `~nec |)))
  ;<  ~  bind:m  (ex-equal !>((gateway caz)) !>([0 0]))
  ;<  caz=(list card)  bind:m  (do-agent /head [~zod %harness] [%watch-ack ~])
  (ex-equal !>((gateway caz)) !>([0 0]))
::
++  test-an-ownerless-hand-does-not-watch-steward-and-a-cleared-owner-leaves
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  caz=(list card)  bind:m  (boot ~ | &)
  ;<  ~  bind:m  (ex-equal !>((gateway caz)) !>([0 0]))
  ;<  *  bind:m  (boot `~nec | &)
  ;<  caz=(list card)  bind:m  (set-owner ~ `~nec)
  (ex-equal !>((gateway caz)) !>([0 1]))
::
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
::  Steward gives a gateway fact in answer to the lease poke, before Gall
::  delivers what was sent behind it, so a fact that took the lease would poke
::  Steward without end.
::
++  test-a-steward-gateway-fact-sends-steward-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (boot `~nec | &)
  ;<  *  bind:m  (do-agent /head [~zod %harness] [%watch-ack ~])
  =/  =update:v1:steward-gateway  [%status %up `~2026.10.1..00.15.10]
  =/  =cage  [%steward-gateway-update-1 !>(update)]
  ;<  caz=(list card)  bind:m  (do-agent /steward/gateway [~zod %steward] [%fact cage])
  (ex-equal !>(caz) !>(`(list card)`~))
::
++  test-a-kicked-steward-gateway-watch-is-renewed-once
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (boot `~nec | &)
  ;<  caz=(list card)  bind:m  (do-agent /steward/gateway [~zod %steward] [%kick ~])
  (ex-equal !>(caz) !>(`(list card)`~[[%pass /steward/gateway %agent [~zod %steward] %watch /v1/gateway]]))
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
::  Steward applies a lease after the event that sends it, so the renewal
::  wake is armed when its ack shows the new expiry.
::
++  test-the-lease-ack-arms-the-next-renewal
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (boot `~nec | &)
  ;<  ~  bind:m  (set-scry-gate (leased & `~2026.10.1..00.06.00))
  ;<  *  bind:m  (do-load adapter `!>((saved `~nec |)))
  ;<  *  bind:m  (do-agent /head [~zod %harness] [%watch-ack ~])
  ;<  wake=(unit @da)  bind:m  saved-wake
  ;<  ~  bind:m  (ex-equal !>(wake) !>(`(unit @da)``~2026.10.1..00.01.00))
  ;<  ~  bind:m  (wait ~s50)
  ;<  caz=(list card)  bind:m  (do-arvo /poll [%behn %wake ~])
  ;<  ~  bind:m  (ex-equal !>((leases caz)) !>(1))
  ;<  ~  bind:m  (set-scry-gate (leased & `~2026.10.1..00.16.00))
  ;<  caz=(list card)  bind:m  (do-agent /steward/lease [~zod %steward] [%poke-ack ~])
  ;<  ~  bind:m
    (ex-equal !>(caz) !>(`(list card)`~[[%pass /poll %arvo %b %wait ~2026.10.1..00.11.00]]))
  ;<  wake=(unit @da)  bind:m  saved-wake
  (ex-equal !>(wake) !>(`(unit @da)``~2026.10.1..00.11.00))
::
++  test-the-first-lease-ack-arms-its-renewal
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  caz=(list card)  bind:m  (boot `~nec | &)
  ;<  ~  bind:m  (ex-equal !>((leases caz)) !>(1))
  ::  Gall hands back the head's watch ack before Steward takes the lease.
  ;<  *  bind:m  (do-agent /head [~zod %harness] [%watch-ack ~])
  ;<  ~  bind:m  (set-scry-gate (leased & `~2026.10.1..00.15.10))
  ;<  caz=(list card)  bind:m  (do-agent /steward/lease [~zod %steward] [%poke-ack ~])
  ;<  ~  bind:m
    (ex-equal !>(caz) !>(`(list card)`~[[%pass /poll %arvo %b %wait ~2026.10.1..00.10.10]]))
  ;<  wake=(unit @da)  bind:m  saved-wake
  (ex-equal !>(wake) !>(`(unit @da)``~2026.10.1..00.10.10))
--
