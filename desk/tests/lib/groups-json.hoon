::  groups-json unit tests
::
::    covers the %set-order pins action JSON parsing added in TLON-5948. the
::    wire payload is `{"pins": {"set-order": ["<id>", ...]}}`; each entry is a
::    whom, parsed via `(ar whom)`. exercises all four pinnable id shapes the
::    frontend can send through the same `ui-action:dejs:gj` parser the real
::    JSON poke hits: group, pinned group channel, DM, and club/group DM.
::
/-  u=ui, gv=groups-ver
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
::  +parse-a-groups: run a real JSON string through the parser the
::  %group-action-5 poke hits
::
++  parse-a-groups
  |=  body=@t
  ^-  a-groups:v11:gv
  (a-groups:v11:dejs:gj (need (de:json:html body)))
::  +test-a-groups-dejs-blob: the group blob parses, and null clears it
::
++  test-a-groups-dejs-blob
  ;:  weld
    %+  expect-eq
      !>  `a-groups:v11:gv`[%group [~zod %group] %blob `'opaque-payload']
    !>  %-  parse-a-groups
        '{"group":{"flag":"~zod/group","a-group":{"blob":"opaque-payload"}}}'
  ::
    %+  expect-eq
      !>  `a-groups:v11:gv`[%group [~zod %group] %blob ~]
    !>  (parse-a-groups '{"group":{"flag":"~zod/group","a-group":{"blob":null}}}')
  ==
::  +test-a-groups-dejs-non-blob: every action the client used to send at
::  %group-action-4 still parses now that they all ride %group-action-5
::
++  test-a-groups-dejs-non-blob
  ;:  weld
    %+  expect-eq
      !>  `a-groups:v11:gv`[%group [~zod %group] %meta 'T' 'D' 'I' 'C']
    !>  %-  parse-a-groups
        '{"group":{"flag":"~zod/group","a-group":{"meta":{"title":"T","description":"D","image":"I","cover":"C"}}}}'
  ::
    %+  expect-eq
      !>  `a-groups:v11:gv`[%group [~zod %group] %delete ~]
    !>  (parse-a-groups '{"group":{"flag":"~zod/group","a-group":{"delete":null}}}')
  ::
    %+  expect-eq
      !>  `a-groups:v11:gv`[%group [~zod %group] %entry %privacy %public]
    !>  %-  parse-a-groups
        '{"group":{"flag":"~zod/group","a-group":{"entry":{"privacy":"public"}}}}'
  ::
    %+  expect-eq
      !>  `a-groups:v11:gv`[%leave [~zod %group]]
    !>  (parse-a-groups '{"leave":"~zod/group"}')
  ==
--
