::  tests for %notify push capability gating
::
::    A push we send is a push the device has to display: iOS cannot suppress
::    an alert once APNs has delivered it. So %notify withholds a push whose
::    event kind requires a capability that any live device has not declared.
::    The decision is all-or-nothing per ship, matching the provider, which
::    addresses by identity and fans out to every binding the ship has.
::
::    No kind is gated yet (+gated-kinds is empty), so these drive the
::    predicate itself through the /x/push-eligible scry.
::
/-  *notify, av=activity-ver
/+  *test-agent
/=  agent  /app/notify
|%
++  dap       %notify
++  provider  ~bus
++  service   %tlon
::
++  setup
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~dev, src ~dev, now ~2024.1.1)))
  ;<  *  bind:m  (do-init dap agent)
  (pure:m ~)
::
::  +register: a device announcing its push token and what it can render
::
++  register
  |=  [address=@t caps=push-caps]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m
    %+  do-poke  %notify-client-action
    !>  ^-  client-action
    [%connect-provider-with-binding provider service address 'apn' caps]
  (pure:m ~)
::
++  eligible
  |=  cap=@ta
  =/  m  (mare ,?)
  ^-  form:m
  ;<  =cage  bind:m  (got-peek /x/push-eligible/[cap])
  (pure:m !<(? q.cage))
::
::  a ship with no registered device blocks nothing. there is nowhere to push
::  in the first place, and we must not let an empty fleet read as "unable"
::
++  test-no-devices-are-eligible
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ok=?  bind:m  (eligible ~.react)
  (ex-equal !>(ok) !>(&))
::
::  an app build old enough to predate capabilities registers without any,
::  which is exactly how it reports that it cannot render a gated kind
::
++  test-device-without-capability-blocks
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (register 'tok-old' ~)
  ;<  ok=?  bind:m  (eligible ~.react)
  (ex-equal !>(ok) !>(|))
::
++  test-device-with-capability-is-eligible
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (register 'tok-new' (silt ~['react']))
  ;<  ok=?  bind:m  (eligible ~.react)
  (ex-equal !>(ok) !>(&))
::
::  a capability the device did not declare is still withheld from it
::
++  test-unrelated-capability-blocks
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (register 'tok-new' (silt ~['react']))
  ;<  ok=?  bind:m  (eligible ~.flag)
  (ex-equal !>(ok) !>(|))
::
::  one phone on an old build withholds the push from the new one too, since
::  the provider fans out by identity and cannot address them separately
::
++  test-mixed-fleet-blocks
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (register 'tok-new' (silt ~['react']))
  ;<  ~  bind:m  (register 'tok-old' ~)
  ;<  ok=?  bind:m  (eligible ~.react)
  (ex-equal !>(ok) !>(|))
::
::  re-registering the same token replaces its capabilities, so a device that
::  updates its app stops blocking as soon as it launches
::
++  test-reregistration-replaces-capabilities
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (register 'tok' ~)
  ;<  ~  bind:m  (register 'tok' (silt ~['react']))
  ;<  ok=?  bind:m  (eligible ~.react)
  (ex-equal !>(ok) !>(&))
::
::  every launch re-registers, so a registration this old is a token that
::  rotated away or a device that is gone. it must stop pinning the gate shut
::
++  test-stale-device-is-ignored
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (register 'tok-old' ~)
  ;<  ok=?  bind:m  (eligible ~.react)
  ;<  ~  bind:m  (ex-equal !>(ok) !>(|))
  ;<  ~  bind:m  (wait ~d31)
  ;<  ok=?  bind:m  (eligible ~.react)
  (ex-equal !>(ok) !>(&))
::
::  a device that keeps launching keeps counting, however old its token is
::
++  test-refreshed-device-still-blocks
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (register 'tok-old' ~)
  ;<  ~  bind:m  (wait ~d20)
  ;<  ~  bind:m  (register 'tok-old' ~)
  ;<  ~  bind:m  (wait ~d20)
  ;<  ok=?  bind:m  (eligible ~.react)
  (ex-equal !>(ok) !>(|))
::
::  registration is the only point the map grows, so it is where aged-out
::  entries get dropped rather than accumulating one per token rotation
::
++  test-registration-prunes-stale-devices
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (register 'tok-old' ~)
  ;<  ~  bind:m  (wait ~d31)
  ;<  ~  bind:m  (register 'tok-new' (silt ~['react']))
  ;<  =cage  bind:m  (got-peek /x/client-state)
  =+  !<([* devices=(map @t [caps=(set @t) last=@da])] q.cage)
  (ex-equal !>(~(key by devices)) !>((silt ~['tok-new'])))
::
::  with no kind gated, an event still produces its provider fact — even for a
::  device that declared nothing. this is the property that makes the mechanism
::  safe to land: an empty +gated-kinds leaves push behavior exactly as it was
::
++  test-ungated-event-still-pushes
  =/  sub=path  /v1/notify/(scot %p ~dev)/[service]
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (register 'tok-old' ~)
  ;<  ~  bind:m
    %-  set-scry-gate
    |=  =path
    ^-  (unit vase)
    ?.  ?=([%gx *] path)  ~
    `!>(*activity:v10:av)
  ;<  *  bind:m  ((do-as provider) (do-watch sub))
  =/  =time-id:av  `@da`~2024.1.2
  =/  ev=event:v10:av  [[%group-join [~dev %test] ~bus] & |]
  ;<  caz=(list card)  bind:m
    (do-agent /activity [~dev %activity] [%fact %activity-event-2 !>([time-id ev])])
  %+  ex-cards  caz
  :~  %+  ex-fact  ~[sub]
      [%notify-update-1 !>(`update`[0 `@`time-id %notify ~])]
  ==
--
