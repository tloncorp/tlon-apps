/-  spider
/+  *strandio, *ph-io, test
=,  strand=strand:spider
|%
::  +ph-test-init: setup test strand environment
::
++  ph-test-init
  (watch-our /effect/unto %aqua /effect/unto)
:: +ph-test-shut: teardown test strand environment
::
++  ph-test-shut
  (leave-our /effect/unto %aqua)
::  +set-timeout-err: set timeout with error message
::
++  set-timeout-err
  |*  computation-result=mold
  =/  m  (strand ,computation-result)
  |=  [time=@dr error=tang computation=form:m]
  ^-  form:m
  ;<  now=@da  bind:m  get-time
  =/  when  (add now time)
  =/  =card:agent:gall
    [%pass /timeout/(scot %da when) %arvo %b %wait when]
  ;<  ~        bind:m  (send-raw-card card)
  |=  tin=strand-input:strand
  =*  loop  $
  ?:  ?&  ?=([~ %sign [%timeout @ ~] %behn %wake *] in.tin)
          =((scot %da when) i.t.wire.u.in.tin)
      ==
    `[%fail %timeout error]
  =/  c-res  (computation tin)
  ?:  ?=(%cont -.next.c-res)
    c-res(self.next ..loop(computation self.next.c-res))
  ?:  ?=(%done -.next.c-res)
    =/  =card:agent:gall
      [%pass /timeout/(scot %da when) %arvo %b %rest when]
    c-res(cards [card cards.c-res])
  c-res
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
  ?>  ?=(%watch-ack -.p.effect)
  =*  sign  p.effect
  ?^  p.sign
    (strand-fail %watch-ack u.p.sign)
  (pure:m ~)
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
  ::  note: this assumes that the marks on the virtual ship and the host match
  ::
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
::  +ex-app-fact: expect app fact on a wire with a timeout
::
++  ex-app-fact
  |=  [=wire =dock ex-fact=cage]
  =/  m  (strand ,~)
  ^-  form:m
  %^  (set-timeout-err ,~)  timeout
    :~  'ex-app-fact'
        leaf+"expected a fact from {<p.dock>}/{<q.dock>}:"
        leaf+"mark {<p.ex-fact>}"
        (sell q.ex-fact)
    ==
  ;<  fact=cage  bind:m  (wait-for-app-fact wire dock)
  ;<  ~  bind:m  
    %+  (map-err ,~)
      |=  [=term =tang]
      :-  'ex-app-fact'
      ^-  ^tang
      :-  leaf+"mark mismatch from {<p.dock>}/{<q.dock>}"
      tang
    (ex-equal !>(p.fact) !>(p.ex-fact))
  ;<  ~  bind:m  
    %+  (map-err ,~)
      |=  [=term =tang]
      :-  'ex-app-fact'
      ^-  ^tang
      :-  leaf+"fact value mismatch from {<p.dock>}/{<q.dock>}"
      tang
    (ex-equal q.fact q.ex-fact)
  (pure:m ~)
--
