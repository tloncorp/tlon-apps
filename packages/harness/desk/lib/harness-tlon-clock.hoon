::  Maintenance and bounded Activity catch-up only. Publication retries never
::  create timers: native head invalidations and receipts drive delivery.
/-  t=harness-tlon
|%
::
++  deadline
  |=  [now=@da state=state-2:t]
  ^-  (unit @da)
  =/  presence-deadlines=(list @da)
    ?.  enabled.policy.state  ~
    %+  turn  ~(val by computing.state)
    |=  lease=presence-lease:t
    (add at.lease ~s10)
  =/  tool-deadlines=(list @da)
    %+  murn  ~(val by tool-receipts.state)
    |=  receipt=tool-receipt:t
    ?.  =(%sending stage.receipt)  ~
    `(add at.receipt ~m1)
  =/  times  (weld presence-deadlines tool-deadlines)
  =?  times  &(enabled.policy.state enabled.lens.state)
    %+  weld  times
    %+  murn  ~(val by records.lens.state)
    |=  record=lens-record:t
    next.record
  =?  times  &(enabled.policy.state !watching.state)  [(add now ~s2) times]
  =?  times  &(enabled.policy.state catching-up.state)  [(add now ~s1) times]
  ?~  times  ~
  =/  earliest=@da
    =/  least  i.times
    =/  rest  t.times
    |-
    ?~  rest  least
    $(least (min least i.rest), rest t.rest)
  ::  Overdue work gets a fresh wake, at least one second from now.
  `(max (add now ~s1) earliest)
--
