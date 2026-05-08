/-  spider, c=contacts
/+  *ph-io, *ph-test
=,  strand=strand:spider
|%
++  test-profile
  ^-  contact:c
  %-  ~(gas by *(map @tas value:c))
  :~  [%nickname text+'Zod Test']
      [%bio text+'A test profile broadcast over aqua']
      [%status text+'testing contacts']
      [%color tint+0xff.0000]
  ==
++  typed-profile
  ^-  contact:c
  %-  ~(gas by *(map @tas value:c))
  :~  [%nickname text+'Zod Typed']
      [%bio text+'Testing every contact value type']
      [%status text+'typing contacts']
      [%color tint+0xff.0000]
      [%avatar look+'https://example.com/avatar.png']
      [%cover look+'https://example.com/cover.png']
      [%favorite-number numb+42]
      [%birthday date+~2026.1.1]
      [%friend ship+~bud]
      [%home-group flag+~zod^%home-group]
      [%favourite-colors set+(sy tint+0xff.0000 tint+0x0 ~)]
  ==
::  +ph-test-profile-broadcast: test profile updates broadcast to met peers
::
::  scenario
::
::  ~bud meets ~zod and subscribes to ~zod's contact profile.
::  ~zod updates his profile with several fields, then ~bud receives a
::  peer update containing the new profile.
::
++  ph-test-profile-broadcast
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~bud/contacts/v1/news [~bud %contacts] /v1/news)
  ::  ~bud meets ~zod and receives ~zod's initial empty profile.
  ::
  ;<  ~  bind:m  (poke-app [~bud %contacts] contact-action-1+[%meet ~[~zod]])
  ;<  pay=cage  bind:m  (wait-for-app-fact /~bud/contacts/v1/news [~bud %contacts])
  ?>  =(%contact-response-0 p.pay)
  =+  !<(res=response:c q.pay)
  ?>  ?=(%peer -.res)
  ;<  ~  bind:m  (ex-equal !>(who.res) !>(~zod))
  ::  ~zod updates his public profile, then ~bud receives the broadcast.
  ::
  ;<  ~  bind:m  (poke-app [~zod %contacts] contact-action-1+[%self test-profile])
  ;<  pay=cage  bind:m  (wait-for-app-fact /~bud/contacts/v1/news [~bud %contacts])
  ?>  =(%contact-response-0 p.pay)
  =+  !<(res=response:c q.pay)
  ?>  ?=(%peer -.res)
  ;<  ~  bind:m  (ex-equal !>(who.res) !>(~zod))
  ;<  ~  bind:m  (ex-equal !>(con.res) !>(test-profile))
  (pure:m ~)
::  +ph-test-profile-field-types: test profile field value types
::
::  scenario
::
::  ~zod starts with an empty contact profile.
::  ~zod updates his profile with fields covering every contact value type,
::  then publishes the updated profile to local subscribers.
::
++  ph-test-profile-field-types
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~zod/contacts/v1/contact [~zod %contacts] /v1/contact)
  ;<  pay=cage  bind:m  (wait-for-app-fact /~zod/contacts/v1/contact [~zod %contacts])
  ?>  =(%contact-update-1 p.pay)
  =+  !<(upd=update:c q.pay)
  ?>  ?=(%full -.upd)
  ;<  ~  bind:m  (ex-equal !>(con.upd) !>(*contact:c))
  ;<  ~  bind:m  (watch-app /~zod/contacts/v1/news [~zod %contacts] /v1/news)
  ::  ~zod sets every contact value type and receives the local response.
  ::
  ;<  ~  bind:m  (poke-app [~zod %contacts] contact-action-1+[%self typed-profile])
  ;<  pay=cage  bind:m  (wait-for-app-fact /~zod/contacts/v1/news [~zod %contacts])
  ?>  =(%contact-response-0 p.pay)
  =+  !<(res=response:c q.pay)
  ?>  ?=(%self -.res)
  ;<  ~  bind:m  (ex-equal !>(con.res) !>(typed-profile))
  ::  ~zod then publishes his full updated profile to contact subscribers.
  ::
  ;<  pay=cage  bind:m  (wait-for-app-fact /~zod/contacts/v1/contact [~zod %contacts])
  ?>  =(%contact-update-1 p.pay)
  =+  !<(upd=update:c q.pay)
  ?>  ?=(%full -.upd)
  ;<  ~  bind:m  (ex-equal !>(con.upd) !>(typed-profile))
  (pure:m ~)
--
