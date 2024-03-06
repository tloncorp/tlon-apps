::  test-agent: testing harness for agents
::
::    this library helps you write tests for agents in the monadic ;< style.
::    the general concept is that an agent and its bowl are continuously
::    "passed forward" as you perform operations on them.
::
::    the bowl is partially managed for you by the library: when the agent
::    emits %watch or %leave cards, outgoing subscriptions in wex.bowl are
::    updated. likewise for %watch-ack and %kick calls to +on-agent. incoming
::    subscriptions in sup.bowl are updated in response to %kick cards and
::    calls to +on-watch and +on-leave.
::
::    an example test arm, which initializes an agent and pokes it, might look
::    something like this (assuming /+ *test-agent):
::
::    ++  test-example
::      %-  eval-mare
::      =/  m  (mare ,~)
::      ^-  form:m
::      ;<  ~                bind:m  (set-scry-gate |=(path `%some-noun))
::      ;<  caz=(list card)  bind:m  (do-init %my-agent-name my-agent-core)
::      ;<  ~                bind:m  (ex-cards caz ~)
::      ;<  ~                bind:m  (set-src ~dev)
::      ;<  caz=(list card)  bind:m  (do-poke %noun !>(123))
::      (ex-cards caz (ex-fact [/echo]~ %noun !>([~dev 123])) ~)
::
/+  test
!.
::
=/  drop-verb=?  &
::
|%
::  voodoo basics
::
+$  agent  $+(agent agent:gall)
+$  bowl   $+(bowl bowl:gall)
+$  card   $+(card card:agent:gall)
::
+$  state       [=agent =bowl scry=$-(path (unit *))]   ::  passed continuously
++  form-raw    |$  [a]  $-(state (output-raw a))       ::  continuation
++  output-raw  |$  [a]  (each [out=a =state] tang)     ::  continue or fail
::
++  mare
  |*  a=mold
  |%
  ++  output  (output-raw a)
  ++  form  (form-raw a)
  ++  pure
    |=  arg=a
    ^-  form
    |=  =state
    [%& arg state]
  ::
  ++  bind
    |*  b=mold
    |=  [m-b=(form-raw b) fun=$-(b form)]
    ^-  form
    |=  =state
    =/  b-res=(output-raw b)  (m-b state)
    ?-  -.b-res
      %&  ((fun out.p.b-res) state.p.b-res)
      %|  [%| p.b-res]
    ==
  --
::
++  eval-mare
  =/  m  (mare ,~)
  |=  f=form:m
  ^-  tang
  =/  res  (f *state)
  ?-(-.res %& ~, %| p.res)
::
::  internal transformations (you shouldn't be calling these directly)
::
++  play-cards
  |=  [=bowl cards=(list card)]
  ^+  bowl
  ?~  cards  bowl
  =*  card  i.cards
  =*  next  $(cards t.cards)
  ?+  card  next
      [%pass * %agent * ?(%watch %watch-as %leave) *]
    =-  =.(wex.bowl - next)
    =/  key=[=wire =gill:gall]  [p [ship name]:q]:card
    ?:  ?=(%leave -.task.q.card)
      (~(del by wex.bowl) key)
    ?.  (lien ~(tap by wex.bowl) |=([k=[wire gill:gall] *] =(k key)))
      =;  =path
        (~(put by wex.bowl) key [| path])
      ?-  -.task.q.card
        %watch     path.task.q.card
        %watch-as  path.task.q.card
      ==
    ~_  'subscribe wire not unique'  ::TODO  maybe integrate the test tang instead?
    ~|  key
    !!
  ::
      [%give %kick *]
    =-  =.(sup.bowl - next)
    %+  roll  paths.p.card
    |=  [=path =_sup.bowl]
    %-  ~(gas by *bitt:gall)
    %+  skip  ~(tap by sup)
    |=  [duct s=ship p=^path]
    &(=(p path) |(?=(~ ship.p.card) =(s u.ship.p.card)))
  ==
::
++  play-sign
  |=  [=bowl =wire =gill:gall =sign:agent:gall]
  ^+  bowl
  =.  src.bowl  p.gill
  ?:  ?=(%poke-ack -.sign)  bowl
  =;  =_wex.bowl  bowl(wex wex)
  ?.  (~(has by wex.bowl) [wire gill])
    ~_  leaf+"missing subscription, got %{(trip -.sign)} on {(spud wire)}"
    !!
  ?+  sign  wex.bowl
      ?([%watch-ack ~ *] [%kick ~])
    (~(del by wex.bowl) [wire gill])
  ::
      [%watch-ack ~]
    %+  ~(jab by wex.bowl)  [wire gill]
    |=  [ack=? =path]
    ~_  'duplicate watch-ack'
    ?<(ack [& path])
  ==
::
++  do
  |=  call=$-(state [(list card) agent:gall])
  =/  m  (mare ,(list card))
  ^-  form:m
  |=  s=state
  =;  result=(each [(list card) agent:gall] (list tank))
    ?:  ?=(%| -.result)
      |+p.result  ::TODO  maybe flop the trace?
    =^  c  agent.s  p.result
    =.  bowl.s  (play-cards bowl.s c)
    &+[c s]
  =/  res=toon
    %+  mock  [. !=((call s))]
    |=  p=^
    ~&  p
    ^-  (unit (unit))
    ~&  %a
    =/  res=(unit *)  (scry.s ;;(path +.p))
    ~&  %b
    ?~(res ~ ``u.res)
  ~&  %c
  ?-  -.res
    %0  :-  %&
        ::NOTE  we would ;;, but it's too slow.
        ::      we pretend it's a vase instead.
        !<  [(list card) agent:gall]
        [-:!>(*[(list card) agent:gall]) p.res]
    %1  |+~['blocking on scry' >;;(path p.res)<]
    %2  |+p.res
  ==
::
::  managed agent lifecycle
::
++  do-init
  |=  [dap=term =agent]
  =/  m  (mare ,(list card))
  ^-  form:m
  |=  s=state
  =.  bowl.s  %*(. *bowl dap dap, our our.bowl.s, src our.bowl.s)
  ::TODO  wrap in +do call so we can scry
  =^  c  agent.s  ~(on-init agent bowl.s)
  &+[c s]
::
++  do-load
  |=  =agent
  ::TODO  temporarily make scry a crashing gate,
  ::      to protect against scry-on-load implementations.
  %-  do
  |=  s=state
  (~(on-load agent bowl.s) ~(on-save agent.s bowl.s))
::
++  do-poke
  |=  [=mark =vase]
  %-  do
  |=  s=state
  (~(on-poke agent.s bowl.s) mark vase)
::
++  do-watch
  |=  =path
  =/  m  (mare ,(list card))
  ^-  form:m
  |=  s=state
  =.  sup.bowl.s
    =/  =duct  [%test-sub (scot %p src.bowl.s) path]~
    ~_  leaf+"sub on {(spud path)} already made by {(scow %p src.bowl.s)}"
    ?<  (~(has by sup.bowl.s) duct)
    (~(put by sup.bowl.s) duct [src.bowl.s path])
  %.  s  %-  do
  |=  s=state
  (~(on-watch agent.s bowl.s) path)
::
++  do-leave
  |=  =path
  =/  m  (mare ,(list card))
  ^-  form:m
  |=  s=state
  =.  sup.bowl.s
    =/  =duct  [%test-sub (scot %p src.bowl.s) path]~
    ~_  leaf+"sub on {(spud path)} not yet made by {(scow %p src.bowl.s)}"
    ?>  (~(has by sup.bowl.s) duct)
    (~(del by sup.bowl.s) duct [src.bowl.s path])
  %.  s  %-  do
  |=  s=state
  (~(on-leave agent.s bowl.s) path)
::
++  do-agent
  |=  [=wire =gill:gall =sign:agent:gall]
  =/  m  (mare ,(list card))
  ^-  form:m
  |=  s=state
  =.  bowl.s  (play-sign bowl.s wire gill sign)
  %.  s  %-  do
  |=  s=state
  (~(on-agent agent.s bowl.s) wire sign)
::
++  do-arvo
  |=  [=wire sign=sign-arvo]
  %-  do
  |=  s=state
  (~(on-arvo agent.s bowl.s) wire sign)
::
++  do-fail
  |=  [=term =tang]
  %-  do
  |=  s=state
  (~(on-fail agent.s bowl.s) term tang)
::
::  data extraction
::
++  get-save
  =/  m  (mare ,vase)
  ^-  form:m
  |=  s=state
  &+[~(on-save agent.s bowl.s) s]
::
++  get-peek
  |=  =path
  =/  m  (mare ,(unit (unit cage)))
  ^-  form:m
  |=  s=state
  &+[(~(on-peek agent.s bowl.s) path) s]
::
++  get-agent
  =/  m  (mare agent)
  ^-  form:m
  |=  s=state
  &+[agent.s s]
::
++  get-bowl
  =/  m  (mare bowl)
  ^-  form:m
  |=  s=state
  &+[bowl.s s]
::
::  bowl modification
::
++  jab-bowl
  |=  f=$-(bowl:gall bowl)
  =/  m  (mare ,~)
  ^-  form:m
  |=  s=state
  &+[~ s(bowl (f bowl.s))]
::
++  set-bowl
  |=(b=bowl (jab-bowl |=(* b)))
::
++  set-src
  |=  src=ship
  %-  jab-bowl
  |=(b=bowl b(src src))
::
++  wait
  |=  d=@dr
  %-  jab-bowl
  |=(b=bowl b(now (add now.b d)))
::
++  set-scry-gate
  |=  gate=$-(path (unit *))
  =/  m  (mare ,~)
  ^-  form:m
  |=  s=state
  &+[~ s(scry gate)]
::
::  testing utilities
::
++  ex-equal
  |=  [actual=vase expected=vase]  ::NOTE  reverse order from /lib/test
  =/  m  (mare ,~)
  ^-  form:m
  |=  s=state
  =/  =tang  (expect-eq:test expected actual)
  ?~(tang &+[~ s] |+tang)
::
++  ex-crash-in-do
  |=  form=(form-raw ,(list card))
  =/  m  (mare ,~)
  ^-  form:m
  |=  =state
  =/  res  (form state)
  ?-(-.res %| &+[~ state], %& |+['expected crash, but succeeded']~)
::
++  ex-cards
  |=  [caz=(list card) exes=(list $-(card tang))]
  =?  caz  drop-verb
    ::  remove cards unconditionally emitted by /lib/verb
    ::
    %+  skip  caz
    |=  =card
    ?=([%give %fact [[%verb %events ~] ~] *] card)
  =/  m  (mare ,~)
  ^-  form:m
  |=  s=state
  =;  =tang
    ?~(tang &+[~ s] |+tang)
  |-  ^-  tang
  ?~  exes
    ?~  caz
      ~
    ['got more cards than expected' >caz< ~]
  ?~  caz
    ['expected more cards than got' ~]
  %+  weld
    (i.exes i.caz)
  $(exes t.exes, caz t.caz)
::
++  ex-card
  |=  caw=card
  |=  cav=card
  (expect-eq:test !>(caw) !>(cav))
::
++  ex-fact
  |=  [paths=(list path) =mark =vase]
  |=  car=card
  ^-  tang
  =*  nope
    %-  expect-eq:test
    [!>(`card`[%give %fact paths mark vase]) !>(`card`car)]
  ?.  ?=([%give %fact *] car)  nope
  ?.  =(paths paths.p.car)     nope
  ?.  =(mark p.cage.p.car)     nope
  =/  =tang  (expect-eq:test vase q.cage.p.car)
  ?~  tang  ~
  ['in %fact vase,' tang]
::
++  ex-poke
  |=  [=wire =gill:gall =mark =vase]
  |=  car=card
  ^-  tang
  =*  nope
    %-  expect-eq:test
    [!>(`card`[%pass wire %agent gill %poke mark vase]) !>(`card`car)]
  ?.  ?=([%pass * %agent * %poke *] car)  nope
  ?.  =(wire p.car)              nope
  ?.  =(gill [ship name]:q.car)  nope
  ?.  =(mark p.cage.task.q.car)  nope
  =/  =tang  (expect-eq:test vase q.cage.task.q.car)
  ?~  tang  ~
  ['in %poke vase on ,' tang]
::
++  ex-task
  |=  [=wire =gill:gall =task:agent:gall]
  (ex-card %pass wire %agent gill task)
::
++  ex-arvo
  |=  [=wire note=note-arvo]
  (ex-card %pass wire %arvo note)
++  ex-scry-result
  |=  [=path =vase]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  res=(unit (unit cage))  bind:m  (get-peek path)
  (ex-equal q:(need (need res)) vase)
::
--
