/-  h=harness, hh=harness-hand
/+  *test, hd=harness-hand
|%
++  fixture
  ^-  state:hh
  =/  db=state:hh  *state:hh
  =.  observations.db
    %-  my
    :~  [0v1 ['source' 'one' 'actor' 'first' ~2026.9.10 %completed]]
        [0v2 ['source' 'two' 'actor' 'second' ~2026.9.10..00.00.01 %completed]]
        [0v3 ['source' 'three' 'actor' 'third' ~2026.9.10 %completed]]
    ==
  =.  outbox.db
    %-  my
    :~  [0v1 [0v1 'source' 'one-hand' 'room' 'source' %reply 'first' %pending '' '' ~]]
        [0v2 [0v2 'source' 'one-hand' 'room' 'source' %reply 'second' %pending '' '' ~]]
        [0v3 [0v3 'source' 'one-hand' 'room' 'source' %reply 'third' %pending '' '' ~]]
    ==
  db
++  test-order-is-admission-time-with-deterministic-ties
  =/  pending  (pending-publications:hd fixture 'one-hand')
  %+  expect-eq
    !>(`(list input-id:h)`~[0v1 0v3 0v2])
  !>((turn pending |=([id=input-id:h pub=publication:hh] id)))
++  test-only-this-hands-pending-work-is-selected
  =/  db  fixture
  =/  first  (~(got by outbox.db) 0v1)
  =/  second  (~(got by outbox.db) 0v2)
  =.  outbox.db  (~(put by outbox.db) 0v1 first(status %delivered))
  =.  outbox.db  (~(put by outbox.db) 0v2 second(hand 'another-hand'))
  =/  before  db
  =/  pending  (pending-publications:hd db 'one-hand')
  ;:  weld
      %+  expect-eq
        !>(`(list input-id:h)`~[0v3])
      !>((turn pending |=([id=input-id:h pub=publication:hh] id)))
      (expect-eq !>(before) !>(db))
  ==
++  test-missing-admission-is-not-runnable
  =/  db  fixture
  %+  expect-eq
    !>(`(list [input-id:h publication:hh])`~)
  !>((pending-publications:hd db(observations ~) 'one-hand'))
++  test-claims-uncertainty-failures-and-abandonment-are-not-retried
  =/  db  fixture
  =/  pub  (~(got by outbox.db) 0v1)
  %-  zing
  %+  turn  `(list delivery-state:hh)`~[%claimed %uncertain %failed %abandoned %delivered]
  |=  status=delivery-state:hh
  =/  pending  (pending-publications:hd db(outbox (my ~[[0v1 pub(status status)]])) 'one-hand')
  (expect-eq !>(`(list [input-id:h publication:hh])`~) !>(pending))
--
