::  groups-json unit tests
::
::    covers the %set-order pins action JSON parsing added in TLON-5948. the
::    wire payload is `{"pins": {"set-order": ["<id>", ...]}}`; each entry is a
::    whom, parsed via `(ar whom)`. exercises all four pinnable id shapes the
::    frontend can send through the same `ui-action:dejs:gj` parser the real
::    JSON poke hits: group, pinned group channel, DM, and club/group DM.
::
/-  u=ui
/+  *test, gj=groups-json
|%
::  +parse-set-order: run a real JSON string through the client-facing parser
::
++  parse-set-order
  |=  body=@t
  ^-  action:u
  (ui-action:dejs:gj (need (de:json:html body)))
::  +test-set-order-dejs-all-id-shapes: the four wire id shapes parse to the
::  matching whom variants, in order: group flag (`~zod/group`), pinned group
::  channel nest (`chat/~zod/group`), DM ship (`~bus`), and club id (`0v123`).
::
++  test-set-order-dejs-all-id-shapes
  =/  expected=action:u
    :+  %pins  %set-order
    :~  [%group ~zod %group]
        [%channel %chat ~zod %group]
        [%chat %ship ~bus]
        [%chat %club 0v123]
    ==
  %+  expect-eq
    !>  expected
  !>  %-  parse-set-order
      '{"pins":{"set-order":["~zod/group","chat/~zod/group","~bus","0v123"]}}'
::  +test-set-order-dejs-single-channel: a single pinned group channel round-
::  trips on its own (the id shape most likely to regress vs. a bare group flag).
::
++  test-set-order-dejs-single-channel
  %+  expect-eq
    !>  `action:u`[%pins %set-order ~[[%channel %chat ~zod %group]]]
  !>  (parse-set-order '{"pins":{"set-order":["chat/~zod/group"]}}')
::  +test-set-order-dejs-empty: an empty order parses to an empty list (the
::  handler treats this as a no-op).
::
++  test-set-order-dejs-empty
  %+  expect-eq
    !>  `action:u`[%pins %set-order ~]
  !>  (parse-set-order '{"pins":{"set-order":[]}}')
--
