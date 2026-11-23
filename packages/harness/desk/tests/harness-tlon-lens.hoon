/-  t=harness-tlon, hh=harness-hand
/+  *test, lens=harness-tlon-lens, migration=harness-tlon-migrate, clock=harness-tlon-clock
|%
++  field
  |=  [value=json key=@t]
  ^-  json
  ?>  ?=(%o -.value)
  (~(got by p.value) key)
::
++  test-owner-envelope-retains-the-shared-run-content
  =/  base  (pairs:enjs:format ~[['lensId' %s '0v1'] ['context' %s 'private context']])
  =/  =observation:hh  ['binding' 'event' '~bud' 'Question' ~2026.10.2 %completed]
  =/  envelope  (payload:lens base [%dm ~bud ~] observation ~2026.10.2)
  =/  report  (field envelope 'lens')
  ;:  weld
      (expect-eq !>(`json`[%n '1']) !>((field envelope 'schemaVersion')))
      (expect-eq !>(`json`[%s 'private context']) !>((field report 'context')))
      (expect-eq !>(`json`[%s 'dm']) !>((field report 'chatType')))
      (expect-eq !>(`json`[%s '~bud']) !>((field (field report 'triggerDetails') 'conversationId')))
  ==
::
++  test-pointer-contains-only-identity-and-preserves-work-controls
  =/  encoded  (pointer:lens ~nec 0v1 `'[{"type":"tlon-a2ui","version":1}]')
  =/  parsed  (need (de:json:html encoded))
  ?>  ?=([%a [* * ~]] parsed)
  =/  pointer  i.p.parsed
  ?>  ?=(%o -.pointer)
  ;:  weld
      (expect-eq !>(`json`[%s 'tlon-context-lens']) !>((field pointer 'type')))
      (expect-eq !>(`json`[%s '0v1']) !>((field pointer 'lensId')))
      (expect-eq !>(`json`[%s '~nec']) !>((field pointer 'botShip')))
      (expect-eq !>(4) !>(~(wyt by p.pointer)))
      (expect-eq !>(`json`[%s 'tlon-a2ui']) !>((field i.t.p.parsed 'type')))
  ==
::
++  test-state-migration-preserves-policy-and-delivery-with-sync-off
  =/  saved  *state-1:migration
  =.  policy.saved  [& `~bud ~ %mentions ~ ~]
  =.  deliveries.saved  (my ~[[0v1 `delivery:t`[2 %send %uncertain 'external']]])
  =/  current  (load:migration !>(saved))
  ;:  weld
      (expect-eq !>(policy.saved) !>(policy.current))
      (expect-eq !>(deliveries.saved) !>(deliveries.current))
      (expect !>(!enabled.lens.current))
      (expect-eq !>(current) !>((load:migration !>(current))))
  ==
::
++  test-sync-recovery-has-a-bounded-maintenance-deadline
  =/  state  *state-2:t
  =.  policy.state  [& `~bud ~ %mentions ~ ~]
  =.  watching.state  &
  =.  lens.state  [& `~bud ~2026.10.1 ~ '']
  =.  records.lens.state
    (my ~[[0v1 `lens-record:t`['sid' 0v1 0v1 ~ | %sending 1 `~2026.10.2..00.00.30]]])
  ;:  weld
      (expect-eq !>(`(unit @da)`[~ ~2026.10.2..00.00.30]) !>((deadline:clock ~2026.10.2 state)))
      %+  expect-eq
        !>(`(unit @da)`~)
      !>((deadline:clock ~2026.10.2 state(lens lens.state(enabled |))))
  ==
--
