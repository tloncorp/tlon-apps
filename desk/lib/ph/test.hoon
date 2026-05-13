/-  spider
/+  *strandio, *ph-io, test
=,  strand=strand:spider
=+  timeout=~s15
|%
::  +ph-test-init: setup test strand environment
::
++  ph-test-init
  (watch-our /effect/unto %aqua /effect/unto)
:: +ph-test-shut: teardown test strand environment
::
++  ph-test-shut
  (leave-our /effect/unto %aqua)
::  +take-effect: receive aqua effect on a .wire
::
++  take-effect
  |=  =wire
  =/  m  (strand aqua-effect)
  ^-  form:m
  ;<  res=^cage  bind:m  (take-fact wire)
  ?>  ?=(%aqua-effect p.res)
  =+  !<(=aqua-effect q.res)
  (pure:m aqua-effect)
::  +poke-app: poke a gall agent on a virtual ship
::
::  .dock: target virtual ship and agent
::  .page: poke payload
::
::  note that the poke is a $page, not a $vase.
::  this is because pokes to virtual ships are injected
::  into arvo, and thus need to pass through an untyped interface.
::
++  poke-app
  |=  [=dock =page]
  =/  m  (strand ,~)
  ^-  form:m
  =/  =task:gall
    [%deal [p.dock p.dock /aqua] q.dock %raw-poke page]
  =/  =aqua-event
    [%event p.dock /g/aqua/deal task]
  ;<  ~  bind:m  (send-events ~[aqua-event])
  ;<  =aqua-effect  bind:m  (take-effect /effect/unto)
  ?>  =(p.dock who.aqua-effect)
  =*  effect  q.ufs.aqua-effect
  ?>  ?=(%unto -.effect)
  ?>  ?=(%poke-ack -.p.effect)
  =*  sign  p.effect
  ?^  p.sign
    (strand-fail %poke-ack u.p.sign)
  (pure:m ~)
::  +watch-app: watch a gall subscription to a virtual ship
::
::  the resulting facts are received as aqua effects.
::  see +wait-for-app-fact.
::
++  watch-app
  |=  [=wire =dock =path]
  =/  m  (strand ,~)
  ^-  form:m
  =/  =task:gall
    [%deal [p.dock p.dock /aqua] q.dock %watch path]
  =/  =aqua-event
    [%event p.dock [%g wire] task]
  ;<  ~  bind:m  (send-events ~[aqua-event])
  ;<  res=^cage  bind:m  (take-fact /effect/unto)
  ::
  ?>  ?=(%aqua-effect p.res)
  =+  !<(=aqua-effect q.res)
  ?>  =(p.dock who.aqua-effect)
  =*  effect  q.ufs.aqua-effect
  ?>  ?=(%unto -.effect)
  ?>  ?=(%watch-ack -.p.effect)
  =*  sign  p.effect
  ?^  p.sign
    (strand-fail %watch-ack u.p.sign)
  (pure:m ~)
::  +leave-app: leave a gall subscription to a virtual ship
::
++  leave-app
  |=  [=wire =dock]
  =/  m  (strand ,~)
  ^-  form:m
  =/  =task:gall
    [%deal [p.dock p.dock /aqua] q.dock %leave ~]
  =/  =aqua-event
    [%event p.dock [%g wire] task]
  ;<  ~  bind:m  (send-events ~[aqua-event])
  (pure:m ~)
::  +wait-for-app-fact: receive a gall fact from a virtual ship
::
++  wait-for-app-fact
  |=  [=wire [our=ship dap=term]]
  =/  m  (strand cage)
  ;<  =bowl:strand  bind:m  get-bowl
  |-  ^-  form:m
  =*  loop  $
  ;<  =^cage  bind:m  (take-fact /effect/unto)
  ?>  ?=(%aqua-effect p.cage)
  =+  !<(=aqua-effect q.cage)
  =/  [from=^ship =unix-effect]  aqua-effect
  ?.  =(from our)  loop
  ?.  =(wire p.unix-effect)  loop
  ?.  ?=([%unto %raw-fact *] q.unix-effect)  loop
  =*  mark  mark.p.q.unix-effect
  =+  .^(=dais:clay %cb /(scot %p our.bowl)/groups/(scot %da now.bowl)/[mark])
  =/  =vase  (vale:dais noun.p.q.unix-effect)
  (pure:m [mark vase])
::  +ex-equal: expect .actual to be equal to .expected
::
++  ex-equal
  |=  [actual=vase expected=vase]
  =/  m  (strand ,~)
  ^-  form:m
  |=  tin=strand-input:strand
  =/  =tang  (expect-eq:test expected actual)
  ?~  tang
    `[%done ~]
  `[%fail %ex-equal tang]
::  +ex-not-equal: expect .actual not to be equal to .expected
::
++  ex-not-equal
  |=  [actual=vase expected=vase]
  =/  m  (strand ,~)
  ^-  form:m
  |=  tin=strand-input:strand
  =/  =tang  (expect-not-eq:test expected actual)
  ?~  tang
    `[%fail %ex-not-equal tang]
  `[%done ~]
--
