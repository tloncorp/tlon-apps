/-  t=harness-tlon, h=harness
/+  *test, migrate=harness-tlon-migrate, c=harness-tlon-continuity, ask=harness-tlon-approval
|%
++  dm-to  `destination:t`[%dm ~bud ~]
++  room-to  `destination:t`[%channel [%chat ~lux %test] ~]
::  A DM's saved identity, as the old formula made it for its partner.
::
++  dm-sid  (identity:c dm-to)
::  Every field distinct from its default and from each other field of its
::  type, so a field that is dropped, emptied or swapped fails by value.
::
++  every-field
  ^-  state-2:migrate
  :*  %2
      [& `~nec ~2026.1.1 (my ~[[0v9 ['s' 0v1 0v2 ~ & %sent 2 ~]]]) 'lens-error']
      3
      &
      ~2026.1.2
      ~2026.1.3
      &
      (my ~[[[~bud dm-to] dm-sid]])
      (my ~[[dm-sid ['binding-dm' %ready]]])
      (my ~[[~bud ~2026.1.4]])
      ~2026.1.5
      (my ~[[[%chat ~lux %test] ~2026.1.6]])
      (my ~[[0v3 `upload:t`[%fetch 0v4 'key' 'image/png' 'https://u' [2 1]]]])
      ~2026.1.7
      (my ~[[0v5 `tool-receipt:t`[['s' 1 ['call' 'name' '{}']] %done 'body' ~2026.1.8]]])
      (my ~[[/presence `presence-lease:t`[~2026.1.9 (silt ~['tool'])]]])
      [& `~nec (my ~[[~bud ~[%web]]]) %all (silt ~[~dev]) (my ~[[[%chat ~lux %test] [%all &]]])]
      11
      ~2026.1.10
      (my ~[[dm-sid [~bud dm-to 4 ~[%web]]]])
      (my ~[[0v6 `job:t`[[~bud 'event' dm-to 'Hello'] dm-sid %observe '']]])
      (my ~[[0v7 `delivery:t`[1 %send %uncertain 'external']]])
      ~[`notice:t`[1 ~2026.1.11 'message' ~bud 'dm/~bud' 'event']]
      12
      (silt ~['listener'])
      &
      `~2026.1.12
      'error'
  ==
++  test-state-two-keeps-every-field-by-value
  =/  old  every-field
  =/  new  (load:migrate !>(old))
  ;:  weld
      (expect-eq !>(%8) !>(-.new))
      (expect-eq !>(*approvals:t) !>(approvals.new))
      (expect-eq !>(lens.old) !>(lens.new))
      (expect-eq !>(owner-initialized.old) !>(owner-initialized.new))
      (expect-eq !>(sibling-moon-owners.old) !>(sibling-moon-owners.new))
      (expect-eq !>(sibling-owner-after.old) !>(sibling-owner-after.new))
      (expect-eq !>(activity-through.old) !>(activity-through.new))
      (expect-eq !>(catching-up.old) !>(catching-up.new))
      (expect-eq !>((my ~[[dm-to dm-sid]])) !>(identities.new))
      (expect-eq !>(routes.old) !>(routes.new))
      (expect-eq !>(cuts.old) !>(cuts.new))
      (expect-eq !>(~) !>(place-cuts.new))
      (expect-eq !>(channel-after.old) !>(channel-after.new))
      (expect-eq !>(channel-cuts.old) !>(channel-cuts.new))
      (expect-eq !>(uploads.old) !>(uploads.new))
      (expect-eq !>(last-sent.old) !>(last-sent.new))
      (expect-eq !>(tool-receipts.old) !>(tool-receipts.new))
      (expect-eq !>(computing.old) !>(computing.new))
      %+  expect-eq
        !>(policy.old)
      !>([enabled owner trusted response allowed channels]:policy.new)
      (expect-eq !>([~ ~]) !>([dm-grants channel-grants]:policy.new))
      (expect-eq !>(epoch.old) !>(epoch.new))
      (expect-eq !>(after.old) !>(after.new))
      (expect-eq !>(`(map @t lane:t)`(my ~[[dm-sid [dm-to 4 ~[%web]]]])) !>(lanes.new))
      (expect-eq !>(jobs.old) !>(jobs.new))
      (expect-eq !>(deliveries.old) !>(deliveries.new))
      (expect-eq !>(notices.old) !>(notices.new))
      (expect-eq !>(next-notice.old) !>(next-notice.new))
      (expect-eq !>(listeners.old) !>(listeners.new))
      (expect-eq !>(watching.old) !>(watching.new))
      (expect-eq !>(wake.old) !>(wake.new))
      (expect-eq !>(error.old) !>(error.new))
  ==
::  Per-speaker channel conversations, and a DM whose saved speaker is not
::  its partner, beside a kept DM.
::
++  mixed
  ^-  state-2:migrate
  =/  old  every-field
  =/  odd-to=destination:t  [%dm ~bud `[~bud ~2026.1.1]]
  %=  old
      identities
    %-  my
    :~  [[~bud dm-to] dm-sid]
        [[~bus room-to] 'room-bus']
        [[~dev room-to] 'room-dev']
        [[~bus odd-to] 'odd']
    ==
  ::
      lanes
    %-  my
    :~  [dm-sid [~bud dm-to 4 ~[%web]]]
        ['room-bus' [~bus room-to 4 ~[%web]]]
        ['room-dev' [~dev room-to 4 ~]]
        ['odd' [~bus odd-to 4 ~]]
    ==
  ::
      routes
    %-  my
    :~  [dm-sid ['binding-dm' %ready]]
        ['room-bus' ['binding-bus' %ready]]
        ['room-dev' ['binding-dev' %fence]]
        ['odd' ['binding-odd' %ready]]
    ==
  ::
      jobs
    %-  my
    :~  [0v6 [[~bud 'event' dm-to 'Hello'] dm-sid %observe '']]
        [0v7 [[~bus 'event' room-to 'Hi'] 'room-bus' %bind '']]
        [0v8 [[~dev 'event' room-to 'Hey'] 'room-dev' %create '']]
    ==
  ==
++  test-state-two-drops-channel-identities-lanes-routes-and-jobs
  =/  old  mixed
  =/  new  (load:migrate !>(old))
  ;:  weld
      (expect-eq !>((my ~[[dm-to dm-sid]])) !>(identities.new))
      (expect-eq !>((silt ~[dm-sid])) !>(~(key by lanes.new)))
      (expect-eq !>((my ~[[dm-sid ['binding-dm' %ready]]])) !>(routes.new))
      (expect-eq !>((silt ~[0v6])) !>(~(key by jobs.new)))
      ::  Only ready routes hold bindings to retire.
      %+  expect-eq
        !>((silt ~[['room-bus' 'binding-bus'] ['odd' 'binding-odd']]))
      !>((silt (dropped:migrate !>(old))))
  ==
++  test-state-two-keeps-dm-conversations-under-their-old-ids
  =/  old  mixed
  =/  new  (load:migrate !>(old))
  ::  Admission looks a DM up by destination and would compute the same id.
  ;:  weld
      (expect-eq !>(`dm-sid) !>((~(get by identities.new) dm-to)))
      (expect-eq !>(dm-sid) !>((identity:c dm-to)))
      (expect-eq !>(`[dm-to 4 ~[%web]]) !>((~(get by lanes.new) dm-sid)))
  ==
++  test-current-state-loads-unchanged
  =/  current  (load:migrate !>(mixed))
  ;:  weld
      (expect-eq !>(current) !>((load:migrate !>(current))))
      (expect-eq !>(~) !>((dropped:migrate !>(current))))
  ==
++  test-state-zero-and-one-still-load
  =/  zero  *state-0:migrate
  =.  zero
    %=  zero  policy  [& `~nec (my ~[[~bud ~[%web]]]) |]  epoch  17  next-notice  9  identities
        (my ~[[[~bud dm-to] 'retained'] [[~bus room-to] 'room']])
    ==
  =/  one  *state-1:migrate
  =.  one
    %=  one  epoch  18  identities  (my ~[[[~bud dm-to] 'retained'] [[~bus room-to] 'room']])
        lanes  (my ~[['retained' [~bud dm-to 2 ~]] ['room' [~bus room-to 2 ~]]])
        routes  (my ~[['room' ['binding-room' %ready]]])
    ==
  =/  from-zero  (load:migrate !>(zero))
  =/  from-one  (load:migrate !>(one))
  ;:  weld
      (expect-eq !>(`policy:t`[& `~nec (my ~[[~bud ~[%web]]]) %all ~ ~ ~ ~]) !>(policy.from-zero))
      (expect-eq !>([17 9]) !>([epoch.from-zero next-notice.from-zero]))
      (expect-eq !>((my ~[[dm-to 'retained']])) !>(identities.from-zero))
      (expect-eq !>(18) !>(epoch.from-one))
      (expect-eq !>((my ~[[dm-to 'retained']])) !>(identities.from-one))
      (expect-eq !>(`(map @t lane:t)`(my ~[['retained' [dm-to 2 ~]]])) !>(lanes.from-one))
      (expect-eq !>(~[['room' 'binding-room']]) !>((dropped:migrate !>(one))))
  ==
::  The ship-wide lists and channel rules survive the upgrade that adds
::  per-place grants, and nobody holds one afterwards.
::
++  test-state-three-upgrade-keeps-ship-wide-access-and-adds-no-place-grants
  =/  three  (two-to-three:migrate every-field)
  =/  new  (load:migrate !>(three))
  ;:  weld
      (expect-eq !>(%8) !>(-.new))
      (expect !>(&(?=(^ trusted.policy.three) ?=(^ allowed.policy.three))))
      (expect !>(?=(^ channels.policy.three)))
      (expect-eq !>(trusted.policy.three) !>(trusted.policy.new))
      (expect-eq !>(allowed.policy.three) !>(allowed.policy.new))
      (expect-eq !>(channels.policy.three) !>(channels.policy.new))
      (expect-eq !>(~) !>(dm-grants.policy.new))
      (expect-eq !>(~) !>(channel-grants.policy.new))
      (expect-eq !>(~) !>(place-cuts.new))
      (expect-eq !>(cuts.three) !>(cuts.new))
      (expect-eq !>(~) !>(browser-entries.new))
      (expect-eq !>(*approvals:t) !>(approvals.new))
  ==
::  A pending browser handoff and the ship-wide access survive the upgrade
::  that adds per-place grants, which start empty.
::
++  test-state-four-upgrade-keeps-browser-entries-and-access-and-adds-no-place-grants
  =/  four=state-4:migrate  (three-to-four:migrate (two-to-three:migrate every-field))
  =.  browser-entries.four
    (my ~[[0v1 `browser-entry:t`[~2026.11.2 [%wait [%form 'http://127.0.0.1/credential-result/fixture']]]]])
  =/  new  (load:migrate !>(four))
  ;:  weld
      (expect-eq !>(%8) !>(-.new))
      (expect-eq !>(browser-entries.four) !>(browser-entries.new))
      (expect !>(&(?=(^ trusted.policy.four) ?=(^ allowed.policy.four))))
      (expect !>(?=(^ channels.policy.four)))
      %+  expect-eq
        !>(policy.four)
      !>([enabled owner trusted response allowed channels]:policy.new)
      (expect-eq !>([~ ~]) !>([dm-grants channel-grants]:policy.new))
      (expect-eq !>(~) !>(place-cuts.new))
      (expect-eq !>(cuts.four) !>(cuts.new))
      (expect-eq !>(lanes.four) !>(lanes.new))
      (expect-eq !>(~) !>((dropped:migrate !>(four))))
  ==
::  The upgrade that adds approval requests keeps every saved field, browser
::  handoffs, access and place cutoffs included, and starts with none open.
::
++  test-state-six-upgrade-keeps-every-field-and-opens-no-requests
  =/  six=state-6:migrate
    %-  five-to-six:migrate
    (four-to-five:migrate (three-to-four:migrate (two-to-three:migrate every-field)))
  =.  browser-entries.six
    (my ~[[0v1 `browser-entry:t`[~2026.11.2 [%wait [%form 'http://127.0.0.1/credential-result/fixture']]]]])
  =.  projected.automation.six  &
  =.  dm-grants.policy.six  (silt ~[~bus])
  =.  place-cuts.six  (my ~[[[~bus ~] ~2026.1.13]])
  =/  new  (load:migrate !>(six))
  ;:  weld
      (expect-eq !>(%8) !>(-.new))
      (expect-eq !>(*approvals:t) !>(approvals.new))
      (expect-eq !>(+.six) !>(+>.new))
      (expect-eq !>(~) !>((dropped:migrate !>(six))))
  ==
::  The Steward automation and the ship-wide access survive the upgrade
::  that adds per-place grants, which start empty.
::
++  test-state-five-upgrade-keeps-automation-and-access-and-adds-no-place-grants
  =/  five=state-5:migrate
    (four-to-five:migrate (three-to-four:migrate (two-to-three:migrate every-field)))
  =.  projected.automation.five  &
  =.  names.automation.five  (my ~[[0v1 [`'UTC' ~ `'Brief' ~]]])
  =/  new  (load:migrate !>(five))
  ;:  weld
      (expect-eq !>(%8) !>(-.new))
      (expect-eq !>(automation.five) !>(automation.new))
      (expect !>(&(?=(^ trusted.policy.five) ?=(^ allowed.policy.five))))
      (expect !>(?=(^ channels.policy.five)))
      %+  expect-eq
        !>(policy.five)
      !>([enabled owner trusted response allowed channels]:policy.new)
      (expect-eq !>([~ ~]) !>([dm-grants channel-grants]:policy.new))
      (expect-eq !>(~) !>(place-cuts.new))
      (expect-eq !>(cuts.five) !>(cuts.new))
      (expect-eq !>(lanes.five) !>(lanes.new))
      (expect-eq !>(~) !>((dropped:migrate !>(five))))
  ==
::
++  test-state-three-loads-with-no-pending-browser-handoff-or-automation
  =/  old=state-3:migrate  (three:migrate !>(every-field))
  =/  four  (three-to-four:migrate old)
  =/  five  (four-to-five:migrate four)
  ;:  weld
      (expect !>(=(%4 -.four)))
      (expect !>(=(~ browser-entries.four)))
      (expect !>(=(+.old +>.four)))
      (expect !>(=(%5 -.five)))
      (expect-eq !>(*automation:t) !>(automation.five))
      (expect !>(=(+.four +>.five)))
      (expect !>(=(~ browser-entries:(load:migrate !>(old)))))
      (expect-eq !>(~) !>((dropped:migrate !>(old))))
  ==
::  A saved %4 with a browser handoff pending.
::
++  pending-browser-handoff
  ^-  state-4:migrate
  =/  saved  *state-4:migrate
  =.  policy.saved  [& `~nec ~ %mentions ~ ~]
  =.  tool-receipts.saved
    %-  my
    ~[[0v1 `tool-receipt:t`[['dm' 1 ['call' 'browser_secure_entry' '{}']] %sending '' ~2026.11.1]]]
  =.  browser-entries.saved
    %-  my
    :~  :-  0v1
        ^-  browser-entry-4:migrate
        [~2026.11.2 [%wait [%form 'http://127.0.0.1/credential-result/fixture']]]
    ==
  saved
::
++  test-state-four-keeps-its-pending-browser-handoff
  =/  old  pending-browser-handoff
  =/  five  (four-to-five:migrate old)
  =/  current  (load:migrate !>(old))
  ;:  weld
      (expect !>(=(%5 -.five)))
      (expect-eq !>(*automation:t) !>(automation.five))
      (expect !>(=(+.old +>.five)))
      (expect-eq !>(browser-entries.old) !>(browser-entries.current))
      (expect-eq !>(~) !>((dropped:migrate !>(old))))
  ==
::
++  test-pending-browser-handoff-loads-unchanged
  =/  current  (load:migrate !>(pending-browser-handoff))
  =.  projected.automation.current  &
  (expect-eq !>(current) !>((load:migrate !>(current))))
::  A %7 holds only DM and channel requests; each loads as the same request
::  for its place, and none waits on %groups.
::
++  test-a-version-seven-loads-its-requests-as-place-requests
  =/  room=place:t  `[%chat ~lux %test]
  =/  old  *state-7:migrate
  =.  approvals.old
    :-  (my ~[['d0001' [~dev ~ ~2026.1.1]] ['c0001' [~dev room ~2026.1.2]]])
    (my ~[[[~dev ~] 'd0001'] [[~dev room] 'c0001']])
  =/  new  (load:migrate !>(old))
  ;:  weld
      (expect-eq !>(%8) !>(-.new))
      %+  expect-eq
        !>  ^-  approvals:t
        :+  (my ~[['d0001' [~dev [%place ~] ~2026.1.1]] ['c0001' [~dev [%place room] ~2026.1.2]]])
          (my ~[[[~dev %place ~] 'd0001'] [[~dev %place room] 'c0001']])
        ~
      !>(approvals.new)
      (expect-eq !>(+>.old) !>(+>.new))
  ==
::  A card sent on %7 carries the token %7 computed, a hash of the id and
::  the stored request; the same request on %8 has the same token.
::
++  test-a-version-seven-requests-button-token-survives-the-upgrade
  =/  room=place:t  `[%chat ~lux %test]
  =/  old  *state-7:migrate
  =.  approvals.old
    :-  (my ~[['d0001' [~dev ~ ~2026.1.1]] ['c0001' [~dev room ~2026.1.2]]])
    (my ~[[[~dev ~] 'd0001'] [[~dev room] 'c0001']])
  =/  new  (load:migrate !>(old))
  =/  token
    |=  id=@t
    :-  (sham id (~(got by by-id.approvals.old) id))
    (button-token:ask id (~(got by by-id.approvals.new) id))
  ;:  weld
      =/  [base=@uv now=@uv]  (token 'd0001')
      (expect-eq !>(base) !>(now))
      =/  [base=@uv now=@uv]  (token 'c0001')
      (expect-eq !>(base) !>(now))
  ==
--
