/-  a=activity-ver, g=groups-ver, dv=channels-ver
/+  *test, membership=harness-tlon-membership
|%
++  fixture
  ^-  group:v9:g
  =/  group  *group:v9:g
  =.  seats.group  (my ~[[~lux [(silt ~[%reader]) ~2026.9.9]]])
  =.  channels.group
    %-  my
    :~  [[%chat ~nec %main] *channel:v9:g]  [[%chat ~nec %private] *channel:v9:g]
        [[%chat ~nec %joined] *channel:v9:g]
    ==
  group(active-channels (silt ~[[%chat ~nec %joined]]))
++  readable
  |=  [who=@p nest=nest:g]
  &(=(~lux who) !=(%private q.q.nest))
++  test-only-our-own-role-change-triggers-reconciliation
  =/  event=incoming-event:v8:a  [%group-role [~nec %group] ~lux (silt ~[%reader])]
  ;:  weld
      (expect-eq !>(`(unit flag:g)`[~ ~nec %group]) !>((target:membership ~lux & event)))
      (expect-eq !>(`(unit flag:g)`~) !>((target:membership ~lux | event)))
      %+  expect-eq
        !>(`(unit flag:g)`~)
      !>((target:membership ~lux & [%group-role [~nec %group] ~bud (silt ~[%reader])]))
      %+  expect-eq
        !>(`(unit flag:g)`~)
      !>((target:membership ~lux & [%group-join [~nec %group] ~lux]))
  ==
++  test-join-only-readable-unjoined-channels
  (expect-eq !>(~[`nest:g`[%chat ~nec %main]]) !>((missing:membership ~lux fixture readable)))
++  test-notification-cannot-override-live-revocation
  (expect-eq !>(`(list nest:g)`~) !>((missing:membership ~lux fixture |=([@p nest:g] |))))
++  test-missing-or-unjoined-seat-does-not-join-public-channels
  =/  group  fixture
  ;:  weld
      (expect-eq !>(`(list nest:g)`~) !>((missing:membership ~bud group |=([@p nest:g] &))))
      %+  expect-eq
        !>(`(list nest:g)`~)
      !>((missing:membership ~lux group(seats (my ~[[~lux `seat:v9:g`[~ `@da`0]]])) readable))
  ==
++  test-repeated-notification-skips-confirmed-subscriptions
  =/  group  fixture
  =.  active-channels.group  (~(put in active-channels.group) [%chat ~nec %main])
  (expect-eq !>(`(list nest:g)`~) !>((missing:membership ~lux group readable)))
++  test-uninitialized-native-stubs-are-not-confirmed-subscriptions
  =/  channel=v-channel:v9:dv  *v-channel:v9:dv
  =/  active  (silt ~[`nest:g`[%chat ~nec %main]])
  ;:  weld
      %+  expect-eq
        !>(`(set nest:g)`~)
      !>((ready:membership active (my ~[[[%chat ~nec %main] channel]])))
      %+  expect-eq
        !>(active)
      !>((ready:membership active (my ~[[[%chat ~nec %main] channel(load.net &)]])))
  ==
++  test-built-in-and-native-app-channel-joins
  =/  =bowl:gall  *bowl:gall
  =.  our.bowl  ~lux
  =/  native  ~(. io:membership bowl)
  =/  chat  (join:native [~nec %group] [%chat ~nec %main])
  =/  notes  (join:native [~nec %group] [%notes ~nec %book])
  ;:  weld
      (expect !>(?=([%pass * %agent [@ %channels] %poke %channel-action-2 *] chat)))
      (expect !>(?=([%pass * %agent [@ %notes] %poke %group-channel-join *] notes)))
  ==
--
