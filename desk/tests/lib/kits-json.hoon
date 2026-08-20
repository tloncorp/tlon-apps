::  tests for kits-json
::
::    the JSON boundary was untested, and that is precisely where a bug hid:
::    %kits' install action grew an `agent` field, the decoder was written to
::    match, and every install still recorded the installer — because the
::    agent tests poke a vase directly (`!>`) and never exercise dejs.
::
/-  k=kits
/+  *test, j=kits-json
|%
++  probe-json
  ^-  json
  %-  need
  %-  de:json:html
  '''
  {"install":{"id":"meal-plan","name":"probe","meta":{"title":"t","description":"d","image":"","cover":""},"agent":"~bus"}}
  '''
::
++  test-install-decodes-the-agent
  =/  act=action:v1:k  (action:dejs:j probe-json)
  ?>  ?=(%install -.act)
  %+  expect-eq
    !>  `(unit @p)``~bus
  !>  agent.act
::
++  test-install-decodes-a-null-agent-as-none
  =/  jon=json
    %-  need
    %-  de:json:html
    '''
    {"install":{"id":"meal-plan","name":"probe","meta":{"title":"t","description":"d","image":"","cover":""},"agent":null}}
    '''
  =/  act=action:v1:k  (action:dejs:j jon)
  ?>  ?=(%install -.act)
  %+  expect-eq
    !>  `(unit @p)`~
  !>  agent.act
--
