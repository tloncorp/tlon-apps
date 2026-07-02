/-  spider
/+  *strandio, *ph-io, test
=,  strand=strand:spider
=+  timeout=~s45
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
  ^-  form:m
  %^  (set-timeout-err ,cage)  timeout
    :~  'wait-for-app-fact'
        leaf+"expected a fact from {<our>}/{<dap>}"
        leaf+"on wire {<wire>}"
    ==
  ;<  =bowl:strand  bind:m  get-bowl
  |-
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
::  +wait-for-app-fact: receive a gall fact from a virtual ship and unpack it
::
++  wait-for-app-fact-value
  |*  [=mold =wire [our=ship dap=term]]
  =/  m  (strand mold)
  ^-  form:m
  %^  (set-timeout-err mold)  timeout
    :~  'wait-for-app-fact-value'
        leaf+"expected a fact from {<our>}/{<dap>}"
        leaf+"on wire {<wire>}"
    ==
  ;<  =bowl:strand  bind:m  get-bowl
  |-
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
  (pure:m !<(mold vase))
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
::  +ex-app-fact: expect app fact on a wire
::
++  ex-app-fact
  |=  [=wire =dock ex-fact=cage]
  =/  m  (strand ,~)
  ^-  form:m
  %^  (set-timeout-err ,~)  timeout
    :~  'ex-app-fact'
        leaf+"expected a fact from {<p.dock>}/{<q.dock>}"
        leaf+"on wire {<wire>}"
        leaf+"with mark {<p.ex-fact>}:"
        (sell q.ex-fact)
    ==
  ;<  fact=cage  bind:m  (wait-for-app-fact wire dock)
  ;<  ~  bind:m
    %+  (map-err ,~)
      |=  [=term =tang]
      :-  'ex-app-fact'
      ^-  ^tang
      :*  leaf+"expected a mark from {<p.dock>}/{<q.dock>}"
          leaf+"on wire {<wire>}:"
          tang
      ==
    (ex-equal !>(p.fact) !>(p.ex-fact))
  ;<  ~  bind:m
    %+  (map-err ,~)
      |=  [=term =tang]
      :-  'ex-app-fact'
      ^-  ^tang
      :*  leaf+"expected a fact value from {<p.dock>}/{<q.dock>}"
          leaf+"on wire {<wire>}:"
          tang
      ==
    (ex-equal q.fact q.ex-fact)
  (pure:m ~)
::  +ex-app-fact-mark: expect app fact with a given mark on a wire
::
++  ex-app-fact-mark
  |=  [=wire =dock =mark]
  =/  m  (strand ,~)
  ^-  form:m
  %^  (set-timeout-err ,~)  timeout
    :~  'ex-app-fact-mark'
        leaf+"expected a fact from {<p.dock>}/{<q.dock>}"
        leaf+"on wire {<wire>}"
        leaf+"with mark {<mark>}."
    ==
  ;<  fact=cage  bind:m  (wait-for-app-fact wire dock)
  %+  (map-err ,~)
    |=  [=term =tang]
    :-  'ex-app-fact-mark'
    ^-  ^tang
    :*  leaf+"expected a mark from {<p.dock>}/{<q.dock>}"
        leaf+"on wire {<wire>}:"
        tang
    ==
  (ex-equal !>(p.fact) !>(mark))
::  +ex-app-fact-match: expect a matching app fact on a wire
::
++  ex-app-fact-match
  |*  =mold
  =/  m  (strand ,~)
  |=  [=wire =dock =mark ex-match=$-(mold form:m)]
  ^-  form:m
  %^  (set-timeout-err ,~)  timeout
    :~  'ex-app-fact-match'
        leaf+"expected a fact match from {<p.dock>}/{<q.dock>}"
        leaf+"on wire {<wire>}"
        leaf+"with mark {<mark>}."
    ==
  ;<  fact=cage  bind:m  (wait-for-app-fact wire dock)
  ;<  ~  bind:m
    %+  (map-err ,~)
      |=  [=term =tang]
      :-  'ex-app-fact-match'
      ^-  ^tang
      :*  leaf+"expected a mark from {<p.dock>}/{<q.dock>}"
          leaf+"on wire {<wire>}:"
          tang
      ==
    (ex-equal !>(p.fact) !>(mark))
  %+  (map-err ,~)
    |=  [=term =tang]
    :-  'ex-app-fact-match'
    ^-  ^tang
    :*  leaf+"expected a matching fact from {<p.dock>}/{<q.dock>}"
        leaf+"on wire {<wire>}"
        leaf+"with mark {<mark>}:"
        tang
    ==
  (ex-match !<(mold q.fact))
--
