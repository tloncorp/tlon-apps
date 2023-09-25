::  negotiate: tests for hands-off version negotiation
::
/+  *test, libn=negotiate
!:
::
=/  dummy-agent=agent:gall
  |_  =bowl:gall
  +*  this  .
  ++  on-init
    ^-  (quip card:agent:gall agent:gall)
    [~ this]
  ::
  ++  on-save
    ^-  vase
    !>(%dummy-state)
  ::
  ++  on-load
    |~  old-state=vase
    ^-  (quip card:agent:gall agent:gall)
    =+  !<(%dummy-state old-state)
    [~ this]
  ::
  ++  on-poke
    |~  =cage
    ^-  (quip card:agent:gall agent:gall)
    ?+  p.cage  !!
      %emit-cards  [!<((list card:agent:gall) q.cage) this]
      %emit-bowl   [[%give %fact ~ %bowl !>(bowl)]~ this]
    ==
  ::
  ++  on-agent
    |~  [=wire sign:agent:gall]
    ?<  ?=([%~.~ %negotiate *] wire)
    [~ this]
  ::
  ++  on-watch  |~(path !!)
  ++  on-leave  |~(path !!)
  ++  on-peek   |~(path !!)
  ++  on-arvo   |~([wire =sign-arvo] !!)
  ++  on-fail   |~([term tang] !!)
  --
=/  test-agent=agent:gall  dummy-agent
::
|%
+$  libargs
  $:  notify=?
      our-versions=(map protocol:libn version:libn)
      =our=config:libn
  ==
::
+$  libstate
  $:  %0
      ours=(map protocol:libn version:libn)
      know=config:libn
      heed=(map [gill:gall protocol:libn] (unit version:libn))
      want=(map gill:gall (map wire path))
  ==
::
++  form-raw
  |$  [a]
  $-(state (output-raw a))
::
::TODO  an even better version of these tests would also pass the bowl forward,
::      and modify it based on cards emitted and calls made to +on-agent
++  state  _test-agent
::
++  output-raw
  |$  [a]
  (each [out=a =state] tang)
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
::
++  ex-equal
  |=  [actual=vase expected=vase]  ::  /!\
  =/  m  (mare ,~)
  ^-  form:m
  |=  =state
  =/  =tang  (expect-eq expected actual)
  ?^  tang  |+tang
  &+[~ state]
::
++  ex-crash
  |=  =(trap)
  =/  m  (mare ,~)
  ^-  form:m
  |=  =state
  =+  res=(mule trap)
  ?-(-.res %| &+[~ state], %& |+['expected crash, but succeeded']~)
::
++  expect-cards
  |=  [caz=(list card) exes=(list $-(card tang))]
  =.  caz  (remove-verb-cards caz)
  =/  m  (mare ,~)
  ^-  form:m
  |=  =state
  =/  =tang
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
  ?~  tang
    [%& ~ state]
  [%| tang]
::
++  remove-verb-cards
  |=  =(list card)
  %+  skip  list
  |=  =card
  ?=([%give %fact [[%verb %events ~] ~] *] card)
::
++  ex
  |=  caw=card
  |=  cav=card
  (expect-eq !>(caw) !>(cav))
::
++  ex-fact
  |=  [paths=(list path) =mark =vase]
  |=  car=card
  ^-  tang
  =*  nope  (expect-eq !>(`card`[%give %fact paths mark vase]) !>(`card`car))
  ?.  ?=([%give %fact *] car)  nope
  ?.  =(paths paths.p.car)     nope
  ?.  =(mark p.cage.p.car)     nope
  =/  =tang  (expect-eq vase q.cage.p.car)
  ?~  tang  ~
  ['in %fact vase,' tang]
::
++  ex-poke
  |=  [=wire =gill:gall =mark =vase]
  |=  car=card
  ^-  tang
  =*  nope  (expect-eq !>(`card`[%pass wire %agent gill %poke mark vase]) !>(`card`car))
  ?.  ?=([%pass * %agent * %poke *] car)  nope
  ?.  =(wire p.car)              nope
  ?.  =(gill [ship name]:q.car)  nope
  ?.  =(mark p.cage.task.q.car)  nope
  =/  =tang  (expect-eq vase q.cage.task.q.car)
  ?~  tang  ~
  ['in %poke vase,' tang]
::
++  ex-task
  |=  [=wire =gill:gall =task:agent:gall]
  (ex %pass wire %agent gill task)
::
++  ex-inner-watch
  |=  [=wire =gill:gall =path]
  =.  wire  [%~.~ %negotiate %inner-watch (scot %p p.gill) q.gill wire]
  (ex-task wire gill %watch path)
::
++  ex-inner-leave
  |=  [=wire =gill:gall]
  =.  wire  [%~.~ %negotiate %inner-watch (scot %p p.gill) q.gill wire]
  (ex-task wire gill %leave ~)
::
++  ex-negotiate
  |=  [=gill:gall prot=protocol:libn]
  %+  ex-task
    /~/negotiate/heed/(scot %p p.gill)/[q.gill]/[prot]
  [gill %watch /~/negotiate/version/[prot]]
::
++  ex-notify
  |=  [=gill:gall match=?]
  %^  ex-poke  /~/negotiate/notify
    [~zod %negotiate-test]
  [%negotiate-notification !>([match gill])]
::
::
++  eval-mare
  =/  m  (mare ,~)
  |=  computation=form:m
  ^-  tang
  =/  res  (computation dummy-agent)
  ?-  -.res
    %&  ~
    %|  p.res
  ==
::
++  ez-bowl
  %*(. *bowl:gall dap %negotiate-test)
::
+$  card  $+(card card:agent:gall)
--
::
=/  testbowl=bowl:gall  ez-bowl
::
|%
++  get-lib-state
  =/  m  (mare ,libstate)
  ^-  form:m
  |=  =agent:gall
  &+[s:!<([[%negotiate s=libstate] vase] ~(on-save agent testbowl)) agent]
::
++  ex-scry-result
  |=  [=path =vase]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  res=(unit (unit cage))  bind:m  (perform-scry path)
  (ex-equal q:(need (need res)) vase)
::
++  perform-scry
  |=  =path
  =/  m  (mare ,(unit (unit cage)))
  ^-  form:m
  |=  =agent:gall
  &+[(~(on-peek agent testbowl) path) agent]
::
++  perform-hear-version
  |=  [=gill:gall =protocol:libn =version:libn]
  %-  perform-call
  |=  =agent:gall
  %+  ~(on-agent agent testbowl)
    /~/negotiate/heed/(scot %p p.gill)/[q.gill]/[protocol]
  [%fact %noun !>(version)]
::
++  perform-cards
  |=  caz=(list card)
  %-  perform-call
  |=  =agent:gall
  (~(on-poke agent testbowl) %emit-cards !>(caz))
::
++  perform-call
  |=  call=$-(agent:gall [(list card) agent:gall])
  =/  m  (mare ,(list card))
  ^-  form:m
  |=  =agent:gall
  &+(call agent)
::
++  perform-wrap
  |=  args=libargs
  =/  m  (mare ,~)
  ^-  form:m
  |=  =agent:gall
  &+[~ ((agent:libn args) agent)]
::
++  perform-upgrade
  |=  args=libargs
  =/  m  (mare ,(list card))
  ^-  form:m
  |=  =agent:gall
  :-  %&
  ^-  (quip card agent:gall)
  %.  ~(on-save agent testbowl)
  ~(on-load ((agent:libn args) dummy-agent) testbowl)
::
++  perform-init-clean
  |=  args=libargs
  =/  m  (mare ,(list card))
  ^-  form:m
  ;<  ~  bind:m  |=(* &+[~ dummy-agent])
  ;<  ~  bind:m  (perform-wrap args)
  ;<  caz=(list card)  bind:m
    |=(=agent:gall &+~(on-init agent testbowl))
  (pure:m caz)
::
::
++  test-init-clean
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  caz=(list card)  bind:m
    (perform-init-clean | ~ ~)
  ;<  *  bind:m  get-lib-state
  (expect-cards caz ~)
::
++  test-load-dirty
  %-  eval-mare
  =/  m  (mare ,~)
  ::  library gets initialized with versioning requirements,
  ::  while to-be-versioned subs are already live
  ::
  ;<  ~  bind:m
    %-  perform-wrap
    :+  |  ~
    [[%hard [%prot^%vers ~ ~]] ~ ~]
  ;<  caz=(list card)  bind:m
    %-  perform-call
    |=  =agent:gall
    ^-  (quip card agent:gall)
    =;  =bowl:gall
      (~(on-load agent bowl) on-save:agent)
    %*  .  *bowl:gall
        wex
      %-  ~(gas by *boat:gall)
      :~  [[/keep ~zod %easy] [| /path]]
          [[/kill ~zod %hard] [| /path]]
      ==
    ==
  ::  must start negotiation and kill the affected sub
  ::
  ;<  ~  bind:m
    %+  expect-cards  caz
    :~  (ex-negotiate [~zod %hard] %prot)
        (ex-task /kill [~zod %hard] %leave ~)
    ==
  ::  must track our already-desired subscriptions
  ::
  ;<  state=libstate  bind:m  get-lib-state
  %+  ex-equal  !>(want.state)
  !>  %-  ~(gas by *(map gill:gall (map wire path)))
  :~  [[~zod %easy] [/keep^/path ~ ~]]
      [[~zod %hard] [/kill^/path ~ ~]]
  ==
::
++  test-hold-watch
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m
    (perform-init-clean | ~ [[%hard [%prot^%vers ~ ~]] ~ ~])
  ;<  caz=(list card)  bind:m
    (perform-cards [%pass /wire1 %agent [~zod %hard] %watch /path1] ~)
  ::  must not emit the watch, initiate negotiation instead
  ::
  ;<  ~  bind:m
    (expect-cards caz (ex-negotiate [~zod %hard] %prot) ~)
  ::  must not initiate negotiation twice
  ::
  ;<  caz=(list card)  bind:m
    (perform-cards [%pass /wire2 %agent [~zod %hard] %watch /path2] ~)
  ;<  ~  bind:m  (expect-cards caz ~)
  ::  must have tracked the watches
  ::
  ;<  state=libstate  bind:m  get-lib-state
  %+  ex-equal  !>(want.state)
  !>  ^-  (map gill:gall (map wire path))
  :_  [~ ~]
  :-  [~zod %hard]
  %-  ~(gas by *(map wire path))
  :~  [/wire1 /path1]
      [/wire2 /path2]
  ==
::
++  test-pass-watch
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m
    (perform-init-clean | ~ [[%hard [%prot^%vers ~ ~]] ~ ~])
  ;<  caz=(list card)  bind:m
    (perform-cards [%pass /wire %agent [~zod %easy] %watch /path] ~)
  ::  must let the watch go through
  ::
  ;<  ~  bind:m
    (expect-cards caz (ex-inner-watch /wire [~zod %easy] /path) ~)
  ::  must have tracked the watch
  ::
  ;<  state=libstate  bind:m  get-lib-state
  %+  ex-equal  !>(want.state)
  !>  ^-  (map gill:gall (map wire path))
  [[~zod %easy]^[/wire^/path ~ ~] ~ ~]
::
++  test-avoid-self-tracking
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (perform-init-clean | ~ ~)
  ;<  *  bind:m  (perform-cards [%pass /wire %agent [~zod %hard] %watch /path] ~)
  =/  outer-wire=wire  /~/negotiate/inner-watch/~zod/hard/wire
  =.  wex.testbowl  (~(put by wex.testbowl) [outer-wire ~zod %hard] [| /path])
  ;<  *  bind:m  (perform-upgrade | ~ ~)
  ::  inflate must not have tracked the "wrapped" lib-generated sub
  ::
  ;<  state=libstate  bind:m  get-lib-state
  %+  ex-equal  !>(want.state)
  !>  ^-  (map gill:gall (map wire path))
  [[~zod %hard]^[/wire^/path ~ ~] ~ ~]
::
++  test-handle-inner-kick-and-nack
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (perform-init-clean | ~ ~)
  ;<  *  bind:m  (perform-cards [%pass /wire %agent [~zod %easy] %watch /path] ~)
  =/  outer-wire=wire  /~/negotiate/inner-watch/~zod/easy/wire
  ::  if kicked, we must "lose" the sub
  ::
  ;<  *  bind:m
    %-  perform-call
    |=  =agent:gall
    (~(on-agent agent testbowl) outer-wire %kick ~)
  ;<  state=libstate  bind:m
    get-lib-state
  ;<  ~  bind:m
    (ex-equal !>(want.state) !>(~))
  ::  if nacked, we must "lose" the sub
  ::
  ;<  *  bind:m
    (perform-cards [%pass /wire %agent [~zod %easy] %watch /path] ~)
  ;<  *  bind:m
    %-  perform-call
    |=  =agent:gall
    (~(on-agent agent testbowl) outer-wire %watch-ack `~)
  ;<  state=libstate  bind:m
    get-lib-state
  (ex-equal !>(want.state) !>(~))
::
++  test-start-negotiate
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m
    (perform-init-clean | ~ [[%hard [%prot^%vers ~ ~]] ~ ~])
  ;<  caz=(list card)  bind:m
    (perform-cards (initiate:libn ~zod %hard) ~)
  (expect-cards caz (ex-negotiate [~zod %hard] %prot) ~)
::
++  test-crash-poke
  %-  eval-mare
  =/  m  (mare ,~)
  =/  poke=card  [%pass /wire %agent [~zod %hard] %poke %noun !>(~)]
  ;<  *  bind:m  (perform-init-clean | ~ [[%hard [%prot^%vers ~ ~]] ~ ~])
  ::  if we don't match, trying to poke must crash
  ::
  ;<  ~  bind:m
    =/  m  (mare ,~)
    ^-  form:m
    |=  =agent:gall
    =/  res
      (mule |.((~(on-poke agent testbowl) %emit-cards !>([poke]~))))
    ?-(-.res %| &+[~ agent], %& |+['expected crash, but succeeded']~)
  ::  once we do, poking is fine
  ::
  ;<  *  bind:m  (perform-cards (initiate:libn ~zod %hard) ~)
  ;<  *  bind:m  (perform-hear-version [~zod %hard] %prot %vers)
  ;<  caz=(list card)  bind:m
    (perform-cards poke ~)
  (expect-cards caz (ex poke) ~)
::
++  test-heed-watch-kick
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m
    (perform-init-clean & ~ [%hard^[%prot^%vers ~ ~] ~ ~])
  ;<  *  bind:m
    %-  perform-cards
    :~  (initiate:libn ~zod %hard)
        [%pass /wire %agent [~zod %hard] %watch /path]
    ==
  =/  outer-wire=wire  /~/negotiate/inner-watch/~zod/hard/wire
  =.  wex.testbowl  (~(put by wex.testbowl) [outer-wire ~zod %hard] [| /path])
  ;<  *  bind:m
    (perform-hear-version [~zod %hard] %prot %vers)
  ::  on kick, we wait a brief moment
  ::
  ;<  caz=(list card)  bind:m
    %-  perform-call
    |=  =agent:gall
    (~(on-agent agent testbowl) /~/negotiate/heed/~zod/hard/prot %kick ~)
  =/  =wire  /~/negotiate/retry/watch/heed/~zod/hard/prot
  =/  wait
    [%pass wire %arvo %b %wait time=(add *@da ~s15)]
  ;<  ~  bind:m
    (expect-cards caz (ex wait) ~)
  ::  after brief timeout, retry the watch
  ::
  ;<  caz=(list card)  bind:m
    %-  perform-call
    |=  =agent:gall
    (~(on-arvo agent testbowl) wire [%behn %wake ~])
  ;<  ~  bind:m
    (expect-cards caz (ex-negotiate [~zod %hard] %prot) ~)
  ::  on watch-nack, we wait longer, and drop the known version
  ::
  ;<  caz=(list card)  bind:m
    %-  perform-call
    |=  =agent:gall
    (~(on-agent agent testbowl) /~/negotiate/heed/~zod/hard/prot %watch-ack `['err']~)
  ;<  ~  bind:m
    %+  expect-cards  caz
    :~  (ex wait(time (add *@da ~m30)))
        (ex-inner-leave /wire ~zod %hard)
        (ex-notify [~zod %hard] |)
    ==
  ::  after the long timeout, try again
  ::
  ;<  caz=(list card)  bind:m
    %-  perform-call
    |=  =agent:gall
    (~(on-arvo agent testbowl) wire [%behn %wake ~])
  (expect-cards caz (ex-negotiate [~zod %hard] %prot) ~)
::
++  test-hear-version
  %-  eval-mare
  =/  m  (mare ,~)
  =/  =config:libn
    :_  [~ ~]
    :-  %hard
    %-  ~(gas by *(map protocol:libn version:libn))
    :~  [%prot1 %vers1]
        [%prot2 %vers2]
    ==
  ;<  *  bind:m
    (perform-init-clean | ~ config)
  ;<  caz=(list card)  bind:m
    (perform-cards [%pass /wire %agent [~zod %hard] %watch /path] ~)
  ::  when only one version matches, nothing changes
  ::
  ;<  caz=(list card)  bind:m
    (perform-hear-version [~zod %hard] %prot1 %vers1)
  ;<  ~  bind:m
    (expect-cards caz ~)
  ::  once both versions match, should re-establish subs
  ::
  ;<  caz=(list card)  bind:m
    (perform-hear-version [~zod %hard] %prot2 %vers2)
  ;<  ~  bind:m
    (expect-cards caz (ex-inner-watch /wire [~zod %hard] /path) ~)
  =/  outer-wire=wire  /~/negotiate/inner-watch/~zod/hard/wire
  =.  wex.testbowl  (~(put by wex.testbowl) [outer-wire ~zod %hard] [| /path])
  ::  when versions stop matching, should rescind subs
  ::
  ;<  caz=(list card)  bind:m
    (perform-hear-version [~zod %hard] %prot2 %miss)
  ;<  ~  bind:m
    (expect-cards caz (ex-inner-leave /wire ~zod %hard) ~)
  =.  wex.testbowl
    (~(del by wex.testbowl) [outer-wire ~zod %hard])
  ::  with notify flag set, these changes must additionally send a poke
  ::
  ;<  caz=(list card)  bind:m
    (perform-upgrade & ~ config)
  ;<  ~  bind:m  (expect-cards caz ~)
  ;<  caz=(list card)  bind:m
    (perform-hear-version [~zod %hard] %prot2 %vers2)
  ;<  ~  bind:m
    %+  expect-cards  caz
    :~  (ex-inner-watch /wire [~zod %hard] /path)
        (ex-notify [~zod %hard] &)
    ==
  =.  wex.testbowl
    (~(put by wex.testbowl) [outer-wire ~zod %hard] [| /path])
  ::
  ;<  caz=(list card)  bind:m
    (perform-hear-version [~zod %hard] %prot2 %miss)
  %+  expect-cards  caz
  :~  (ex-inner-leave /wire ~zod %hard)
      (ex-notify [~zod %hard] |)
  ==
::
++  test-change-config
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m
    (perform-init-clean | ~ ~)
  ::
  =/  =config:libn
    :_  [~ ~]
    :-  %hard
    %-  ~(gas by *(map protocol:libn version:libn))
    :~  [%prot1 %vers1]
        [%prot2 %vers2]
    ==
  ::
  ;<  caz=(list card)  bind:m
    (perform-cards [%pass /wire %agent [~zod %hard] %watch /path] ~)
  =/  outer-wire=wire  /~/negotiate/inner-watch/~zod/hard/wire
  =.  wex.testbowl  (~(put by wex.testbowl) [outer-wire ~zod %hard] [| /path])
  ::  when we impose version requirements, existing subs must be rescinded,
  ::  and we must start negotiation for them
  ::
  ;<  caz=(list card)  bind:m
    (perform-upgrade | ~ config)
  ;<  ~  bind:m
    %+  expect-cards  caz
    :~  (ex-negotiate [~zod %hard] %prot1)
        (ex-negotiate [~zod %hard] %prot2)
        (ex-inner-leave /wire ~zod %hard)
    ==
  =.  wex.testbowl  (~(del by wex.testbowl) [outer-wire ~zod %hard])
  ::  when we relax requirements, subs must be re-established
  ::
  ;<  caz=(list card)  bind:m
    (perform-upgrade | ~ ~)
  ;<  ~  bind:m
    (expect-cards caz (ex-inner-watch /wire [~zod %hard] /path) ~)
  =.  wex.testbowl  (~(put by wex.testbowl) [outer-wire ~zod %hard] [| /path])
  ::  with notify flag set, these changes must additionally send a poke
  ::
  ;<  caz=(list card)  bind:m
    (perform-upgrade & ~ config)
  ;<  ~  bind:m
    %+  expect-cards  caz
    :~  (ex-notify [~zod %hard] |)
        (ex-inner-leave /wire ~zod %hard)
    ==
  =.  wex.testbowl  (~(del by wex.testbowl) [outer-wire ~zod %hard])
  ::
  ;<  caz=(list card)  bind:m
    (perform-upgrade & ~ ~)
  %+  expect-cards  caz
  :~  (ex-notify [~zod %hard] &)
      (ex-inner-watch /wire [~zod %hard] /path)
  ==
::
++  test-version-watch-fact
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m
    (perform-init-clean | [[%prot %1] ~ ~] ~)
  ;<  caz=(list card)  bind:m
    %-  perform-call
    |=  =agent:gall
    (~(on-watch agent testbowl) /~/negotiate/version/prot)
  (expect-cards caz (ex-fact ~ %noun !>(`*`%1)) ~)
::
++  test-version-change-fact
  %-  eval-mare
  =/  m  (mare ,~)
  =+  ^=  versions
    %-  ~(gas by *(map protocol:libn version:libn))
    :~  [%prot1 %0]
        [%prot2 %a]
    ==
  ;<  *  bind:m
    (perform-init-clean | versions ~)
  =.  versions
    (~(put by versions) %prot1 %1)
  ;<  caz=(list card)  bind:m
    (perform-upgrade | versions ~)
  ::  should give fact only for the changed version
  ::
  (expect-cards caz (ex-fact [/~/negotiate/version/prot1]~ %noun !>(`*`%1)) ~)
::
++  test-notify-during-config-change
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m
    (perform-init-clean | ~ ~)
  ::
  ;<  caz=(list card)  bind:m
    (perform-cards [%pass /wire %agent [~zod %hard] %watch /path] ~)
  =.  wex.testbowl  (~(put by wex.testbowl) [/wire ~zod %hard] [| /path])
  ::  when we impose version requirements, existing subs must be rescinded,
  ::  and we must start negotiation for them, notifying about any gills
  ::  that were affected
  ::
  ;<  caz=(list card)  bind:m
    (perform-upgrade & ~ [[%hard %prot^%vers ~ ~] ~ ~])
  %+  expect-cards  caz
  :~  (ex-notify [~zod %hard] |)
      (ex-negotiate [~zod %hard] %prot)
      (ex-task /wire [~zod %hard] %leave ~)
  ==
::
++  test-status-scry
  %-  eval-mare
  =/  m  (mare ,~)
  =/  prots=(map protocol:libn version:libn)
    [%prot1^%vers ~ ~]
  =/  =path
    /x/~/negotiate/status/~zod/hard
  ::
  ;<  *  bind:m  (perform-init-clean | ~ [[%hard prots] ~ ~])
  ::  gills without requirements must report as matching
  ::
  ;<  ~  bind:m  (ex-scry-result /x/~/negotiate/status/~zod/easy !>(%match))
  ::  gills with requirements, but unnegotiated, must report as unmet
  ::
  ;<  ~  bind:m  (ex-scry-result path !>(%unmet))
  ::  if we've started negotiation for all protocols, we are %await-ing
  ::
  ;<  *  bind:m  (perform-cards (initiate:libn ~zod %hard) ~)
  ;<  ~  bind:m  (ex-scry-result path !>(%await))
  ::  if another protocol gets added, we are %unmet again
  ::
  =.     prots   (~(put by prots) %prot2 %vers)
  ;<  *  bind:m  (perform-upgrade | ~ [[%hard prots] ~ ~])
  ;<  ~  bind:m  (ex-scry-result path !>(%unmet))
  ::  even if we have some matching results, we are still %await-ing
  ::
  ;<  *  bind:m  (perform-cards (initiate:libn ~zod %hard) ~)
  ;<  *  bind:m  (perform-hear-version [~zod %hard] %prot1 %vers)
  ;<  ~  bind:m  (ex-scry-result path !>(%await))
  ::  if even one mismatches, we're fully %clash-ing
  ::
  ;<  *  bind:m  (perform-hear-version [~zod %hard] %prot2 %miss)
  ;<  ~  bind:m  (ex-scry-result path !>(%clash))
  ::  only if all protocols for a given dude match, do we actually %match
  ::
  ;<  *  bind:m  (perform-hear-version [~zod %hard] %prot2 %vers)
  ;<  ~  bind:m  (ex-scry-result path !>(%match))
  (pure:m ~)
::
++  test-fake-bowl
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (perform-init-clean | ~ [[%hard [%prot^%vers ~ ~]] ~ ~])
  ;<  *  bind:m  (perform-cards [%pass /wire %agent [~zod %hard] %watch /path] ~)
  ;<  *  bind:m  (perform-cards [%pass /wire %agent [~zod %easy] %watch /path] ~)
  ::  must pretend to the inner agent that the sub was established,
  ::  and that library-internal subs don't exist
  ::
  =.  wex.testbowl
    %-  ~(gas by wex.testbowl)
    :~  :-  [/~/negotiate/heed/~zod/hard/prot ~zod %hard]
        [| /~/negotiate/~zod/hard/prot]
      ::
        :-  [/~/negotiate/inner-watch/~zod/easy/wire ~zod %easy]
        [& /path]
    ==
  ;<  caz=(list card)  bind:m
    %-  perform-call
    |=  =agent:gall
    (~(on-poke agent testbowl) %emit-bowl !>(~))
  =.  caz  (remove-verb-cards caz)
  ?>  ?=([[%give %fact ~ %bowl *] ~] caz)
  =+  !<(=bowl:gall q.cage.p.i.caz)
  %+  ex-equal  !>(wex.bowl)
  !>  %-  ~(gas by *boat:gall)
  :~  [/wire ~zod %hard]^[| /path]
      [/wire ~zod %easy]^[& /path]
  ==
--
