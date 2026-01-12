/-  spider
/+  *strandio, *ph-io, test
=,  strand=strand:spider
::  .timeout: common operation timeout
|%
::  +ph-test-init: initialize aqua test strand 
::
++  ph-test-init
  =/  m  (strand ,~)
  (watch-our /effect/unto %aqua /effect/unto)
:: +ph-end: shutdown aqua test strand
::
++  ph-test-shut
  =/  m  (strand ,~)
  (leave-our /effect/unto %aqua)
::
++  take-effect
  |=  =wire
  =/  m  (strand aqua-effect)
  ^-  form:m
  ;<  res=^cage  bind:m  (take-fact wire)
  ?>  ?=(%aqua-effect p.res)
  =+  !<(=aqua-effect q.res)
  (pure:m aqua-effect)
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
  (pure:m ~)
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
--
