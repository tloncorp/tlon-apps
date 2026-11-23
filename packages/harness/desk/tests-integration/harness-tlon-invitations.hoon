::  Full adapter with synthetic scries; emitted effects never execute.
::  -test /=harness=/tests-integration/harness-tlon-invitations
/-  t=harness-tlon, hh=harness-hand, ad=harness-adapter
/+  *test-agent, policy=harness-tlon-policy
/=  adapter  /app/harness-tlon
|%
++  fixture
  ^-  state-2:t
  =/  s=state-2:t  *state-2:t
  s(owner-initialized 1, policy [& `~lux ~ %mentions ~ ~], activity-through ~2026.10.1)
::
++  head-connected
  %-  jab-bowl
  |=  b=bowl
  b(wex (~(put by wex.b) [/head ~zod %harness] [& /hand-events]))
::  Load with .before allowed and DM invitations from .invited pending in
::  Chat, then configure .after allowed. Returns the invitation cards the
::  load and the change emit.
::
++  configure
  |=  [invited=(set @p) before=(set @p) after=(set @p)]
  =/  m  (mare ,[loaded=(list card) configured=(list card)])
  ^-  form:m
  =/  saved  fixture
  =.  allowed.policy.saved  before
  ;<  ~  bind:m  (set-bowl %*(. *bowl our ~zod, src ~zod, now ~2026.10.1..00.00.10))
  ;<  ~  bind:m  head-connected
  ;<  ~  bind:m
    %-  set-scry-gate
    |=  =path
    ^-  (unit vase)
    ?:  ?=([%gu @ %contacts @ %$ ~] path)  `!>(|)
    ?:  =(%$ (rear path))  `!>(&)
    ?:  ?=([%gx @ %chat @ %dm %invited %ships ~] path)  `!>(invited)
    ?:  (lien path |=(part=@ta =(%hand-state part)))  `!>(*state:hh)
    ?:  (lien path |=(part=@ta =(%activity part)))  `!>(~)
    ~
  ;<  loaded=(list card)  bind:m  (do-load adapter `!>(saved))
  ;<  ~  bind:m  head-connected
  =/  params  (policy-json:policy policy.saved(allowed after))
  ;<  configured=(list card)  bind:m
    %+  do-poke  %noun
    !>(`request:ad`['fixture' [%n '1'] 'harness/tlon/configure' `params])
  (pure:m (acceptances loaded) (acceptances configured))
::
++  acceptances
  |=  cards=(list card)
  (skim cards |=(c=card ?=([%pass [%invite %dm @ ~] *] c)))
::
++  rsvp
  |=  who=@p
  ^-  card
  [%pass /invite/dm/(scot %p who) %agent [~zod %chat] %poke %chat-dm-rsvp !>([who &])]
::
++  test-granting-access-accepts-the-pending-invitation
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  out=[loaded=(list card) configured=(list card)]  bind:m
    (configure (silt ~[~nec ~bud]) ~ (silt ~[~nec]))
  ;<  ~  bind:m  (ex-equal !>(loaded.out) !>(`(list card)`~))
  (ex-equal !>(configured.out) !>(~[(rsvp ~nec)]))
++  test-invitations-from-ships-not-granted-access-stay-pending
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  out=[loaded=(list card) configured=(list card)]  bind:m
    (configure (silt ~[~bud]) ~ (silt ~[~nec]))
  ;<  ~  bind:m  (ex-equal !>(loaded.out) !>(`(list card)`~))
  (ex-equal !>(configured.out) !>(`(list card)`~))
::  Loading after an upgrade accepts invitations that a ship sent before
::  it was granted access, and the owner's.
::
++  test-load-accepts-pending-invitations-from-the-owner-and-allowed-ships
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  out=[loaded=(list card) configured=(list card)]  bind:m
    (configure (silt ~[~lux ~nec ~bud]) (silt ~[~nec]) (silt ~[~nec]))
  (ex-equal !>((silt loaded.out)) !>((silt ~[(rsvp ~lux) (rsvp ~nec)])))
--
