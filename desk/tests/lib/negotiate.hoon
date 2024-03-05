::  negotiate: tests for hands-off version negotiation
::
/+  *test-agent, libn=negotiate
!:
::
|%
+$  libargs
  $:  notify=?
      our-versions=(map protocol:libn version:libn)
      =our=config:libn
  ==
::
+$  libstate
  $:  %1
      ours=(map protocol:libn version:libn)
      know=config:libn
      heed=(map [gill:gall protocol:libn] (unit version:libn))
      want=(map gill:gall (map wire path))
  ==
::
++  dummy-agent
  ^-  agent
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
    |~  [=wire =sign:agent:gall]
    ?<  ?=([%~.~ %negotiate *] wire)
    :_  this
    ?.  ?=(%kick -.sign)  ~
    ::  on-kick, try to resubscribe. important for some tests.
    ::  if an extended wire was provided, change it, so we can recognize the
    ::  inner-agent re-established a subscription.
    ::
    ?.  ?=([@ *] wire)  ~
    =?  wire  ?=([@ *] t.wire)
      wire(i.t +(i.t.wire))
    ::  we were kicked, so the subscription must not be in the bowl anymore
    ::
    ?<  (~(has by wex.bowl) wire [src.bowl i.wire])
    [%pass wire %agent [src.bowl i.wire] %watch wire]~
  ::
  ++  on-watch  |~(path !!)
  ++  on-leave  |~(path !!)
  ++  on-peek   |~(path !!)
  ++  on-arvo   |~([wire =sign-arvo] !!)
  ++  on-fail   |~([term tang] !!)
  --
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
++  ex-notifications
  |=  inner=?
  |=  [=gill:gall match=?]
  ^-  (list $-(card tang))
  :+  (ex-notify-outer gill match)
    (ex-notify-json gill match)
  ?.  inner  ~
  [(ex-notify-inner gill match)]~
::
++  ex-notify-inner
  |=  [=gill:gall match=?]
  %^  ex-poke  /~/negotiate/notify
    [~zod %negotiate-test]
  [%negotiate-notification !>([match gill])]
::
++  ex-notify-outer
  |=  [=gill:gall match=?]
  %^  ex-fact  [/~/negotiate/notify]~
    %negotiate-notification
  !>([match gill])
::
++  ex-notify-json
  |=  [=gill:gall match=?]
  %^  ex-fact  [/~/negotiate/notify/json]~
    %json
  =/  git=@t  (rap 3 (scot %p p.gill) '/' q.gill ~)
  !>(`json`o+(~(gas by *(map @t json)) 'match'^b+match 'gill'^s+git ~))
::
--
::
|%
++  get-lib-state
  =/  m  (mare ,libstate)
  ^-  form:m
  ;<  state=vase  bind:m  get-save
  (pure:m o:!<([[%negotiate o=libstate] vase] state))
::
++  perform-hear-version
  |=  [=gill:gall =protocol:libn =version:libn]
  %+  do-agent
    /~/negotiate/heed/(scot %p p.gill)/[q.gill]/[protocol]
  [gill %fact %noun !>(version)]
::
++  perform-cards
  |=  caz=(list card)
  (do-poke %emit-cards !>(caz))
::
++  perform-call  do
::
++  perform-upgrade
  |=  args=libargs
  (do-load ((agent:libn args) dummy-agent))
::
++  perform-init-clean
  |=  args=libargs
  (do-init %negotiate-test ((agent:libn args) dummy-agent))
::
::
++  test-init-clean
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  caz=(list card)  bind:m
    (perform-init-clean | ~ ~)
  ;<  *  bind:m  get-lib-state
  (ex-cards caz ~)
::
++  test-load-dirty
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init %negotiate-test dummy-agent)
  ;<  *  bind:m
    %-  perform-cards
    :~  [%pass /easy/1 %agent [~zod %easy] %watch /easy/1]
        [%pass /hard/1 %agent [~zod %hard] %watch /hard/1]
    ==
  ::  library gets initialized with versioning requirements,
  ::  while to-be-versioned subs are already live
  ::
  ;<  caz=(list card)  bind:m
    (perform-upgrade | ~ [[%hard [%prot^%vers ~ ~]] ~ ~])
  ::  library will kick subs, which will cause the inner agent to re-subscribe.
  ::  the easy sub will go through, wrapped. the hard sub will trigger a
  ::  negotiation.
  ::
  =/  easy-outer=wire
    /~/negotiate/inner-watch/~zod/easy/easy/2
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-task /easy/1 [~zod %easy] %leave ~)
        (ex-task easy-outer [~zod %easy] %watch /easy/2)
        (ex-task /hard/1 [~zod %hard] %leave ~)
        (ex-negotiate [~zod %hard] %prot)
    ==
  ::  must track our already-desired subscriptions
  ::
  ;<  state=libstate  bind:m  get-lib-state
  ;<  ~  bind:m
    %+  ex-equal  !>(want.state)
    !>  %-  ~(gas by *(map gill:gall (map wire path)))
    :~  [[~zod %easy] [/easy/2^/easy/2 ~ ~]]
        [[~zod %hard] [/hard/2^/hard/2 ~ ~]]
    ==
  ::  must be able to process a kick for the re-established sub
  ::
  ;<  *  bind:m
    (do-agent easy-outer [~zod %easy] %kick ~)
  (pure:m ~)
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
    (ex-cards caz (ex-negotiate [~zod %hard] %prot) ~)
  ::  must not initiate negotiation twice
  ::
  ;<  caz=(list card)  bind:m
    (perform-cards [%pass /wire2 %agent [~zod %hard] %watch /path2] ~)
  ;<  ~  bind:m  (ex-cards caz ~)
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
    (ex-cards caz (ex-inner-watch /wire [~zod %easy] /path) ~)
  ::  must have tracked the watch
  ::
  ;<  state=libstate  bind:m  get-lib-state
  %+  ex-equal  !>(want.state)
  !>  ^-  (map gill:gall (map wire path))
  [[~zod %easy]^[/wire^/path ~ ~] ~ ~]
::
++  test-no-self-negotiation
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m
    (perform-init-clean | ~ [[%negotiate-test [%prot^%vers ~ ~]] ~ ~])
  =/  poke=card
    [%pass /wire %agent [~zod %negotiate-test] %poke %noun !>(~)]
  ;<  caz=(list card)  bind:m
    %-  perform-cards
    :~  [%pass /wire %agent [~zod %negotiate-test] %watch /path]
        poke
    ==
  ::  must emit the watch, allow the poke, and not do negotiation
  ::
  %+  ex-cards  caz
  :~  (ex-inner-watch /wire [~zod %negotiate-test] /path)
      (ex-card poke)
  ==
::
++  test-avoid-self-tracking
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (perform-init-clean | ~ ~)
  ;<  *  bind:m  (perform-cards [%pass /wire %agent [~zod %easy] %watch /path] ~)
  ;<  *  bind:m  (perform-upgrade | ~ ~)
  ::  inflate must not have tracked the "wrapped" lib-generated sub
  ::
  ;<  state=libstate  bind:m  get-lib-state
  %+  ex-equal  !>(want.state)
  !>  ^-  (map gill:gall (map wire path))
  [[~zod %easy]^[/wire^/path ~ ~] ~ ~]
::
++  test-handle-inner-kick-and-nack
  %-  eval-mare
  =/  m  (mare ,~)
  ::NOTE  that we use the empty wire here, so the inner agent doesn't re-sub
  ;<  *  bind:m  (perform-init-clean | ~ ~)
  ;<  *  bind:m  (perform-cards [%pass / %agent [~zod %easy] %watch /path] ~)
  =/  outer-wire=wire  /~/negotiate/inner-watch/~zod/easy
  ::  if kicked, we must "lose" the sub
  ::
  ;<  *  bind:m
    (do-agent outer-wire [~zod %easy] %kick ~)
  ;<  state=libstate  bind:m
    get-lib-state
  ;<  ~  bind:m
    (ex-equal !>(want.state) !>(~))
  ::  if nacked, we must "lose" the sub
  ::
  ;<  *  bind:m
    (perform-cards [%pass / %agent [~zod %easy] %watch /path] ~)
  ;<  *  bind:m
    (do-agent outer-wire [~zod %easy] %watch-ack `['err']~)
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
  (ex-cards caz (ex-negotiate [~zod %hard] %prot) ~)
::
++  test-crash-poke
  %-  eval-mare
  =/  m  (mare ,~)
  =/  poke=card  [%pass /wire %agent [~zod %hard] %poke %noun !>(~)]
  ;<  *  bind:m  (perform-init-clean | ~ [[%hard [%prot^%vers ~ ~]] ~ ~])
  ::  if we don't know whether we match, pokes must be let through,
  ::  and negotiation must be started
  ::
  ;<  caz=(list card)  bind:m  (do-poke %emit-cards !>([poke]~))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-card poke)
        (ex-negotiate [~zod %hard] %prot)
    ==
  ::  if we know for sure we don't match, sending a poke must crash
  ::
  ;<  *  bind:m  (perform-hear-version [~zod %hard] %prot %miss)
  ;<  ~  bind:m  (ex-crash (do-poke %emit-cards !>([poke]~)))
  ::  once we do exactly match, poking is fine again
  ::
  ;<  *  bind:m  (perform-hear-version [~zod %hard] %prot %vers)
  ;<  caz=(list card)  bind:m
    (perform-cards poke ~)
  (ex-cards caz (ex-card poke) ~)
::
++  test-heed-watch-kick
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m
    (perform-init-clean & ~ [%hard^[%prot^%vers ~ ~] ~ ~])
  ;<  *  bind:m
    %-  perform-cards
    :~  (initiate:libn ~zod %hard)
        [%pass /hard %agent [~zod %hard] %watch /hard]
    ==
  ;<  *  bind:m
    (perform-hear-version [~zod %hard] %prot %vers)
  ::  on kick, we wait a brief moment
  ::
  ;<  caz=(list card)  bind:m
    (do-agent /~/negotiate/heed/~zod/hard/prot [~zod %hard] %kick ~)
  =/  =wire  /~/negotiate/retry/watch/heed/~zod/hard/prot
  =/  wait
    [%pass wire %arvo %b %wait time=(add *@da ~s15)]
  ;<  ~  bind:m
    (ex-cards caz (ex-card wait) ~)
  ::  after brief timeout, retry the watch
  ::
  ;<  caz=(list card)  bind:m
    (do-arvo wire [%behn %wake ~])
  ;<  ~  bind:m
    (ex-cards caz (ex-negotiate [~zod %hard] %prot) ~)
  ::  on watch-nack, we wait longer, and drop the known version
  ::
  ;<  caz=(list card)  bind:m
    (do-agent /~/negotiate/heed/~zod/hard/prot [~zod %hard] %watch-ack `['err']~)
  ;<  ~  bind:m
    %+  ex-cards  caz
    :*  (ex-card wait(time (add *@da ~m30)))
        (ex-inner-leave /hard ~zod %hard)
        ((ex-notifications &) [~zod %hard] |)
    ==
  ::  after the long timeout, try again
  ::
  ;<  caz=(list card)  bind:m
    (do-arvo wire [%behn %wake ~])
  (ex-cards caz (ex-negotiate [~zod %hard] %prot) ~)
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
  ::  holds the subscription, as tested in +test-hold-watch
  ::
  ;<  caz=(list card)  bind:m
    (perform-cards [%pass /hard/1 %agent [~zod %hard] %watch /hard/1] ~)
  ::  when only one version matches, nothing changes
  ::
  ;<  caz=(list card)  bind:m
    (perform-hear-version [~zod %hard] %prot1 %vers1)
  ;<  ~  bind:m
    (ex-cards caz ~)
  ::  once both versions match, should establish desired subs
  ::
  ;<  caz=(list card)  bind:m
    (perform-hear-version [~zod %hard] %prot2 %vers2)
  ;<  ~  bind:m
    %+  ex-cards  caz
    :-  (ex-inner-watch /hard/1 [~zod %hard] /hard/1)
    ((ex-notifications |) [~zod %hard] &)
  ::  when versions stop matching, should rescind subs
  ::
  ;<  caz=(list card)  bind:m
    (perform-hear-version [~zod %hard] %prot2 %miss)
  ;<  ~  bind:m
    %+  ex-cards  caz
    :-  (ex-inner-leave /hard/1 ~zod %hard)
    ((ex-notifications |) [~zod %hard] |)
  ::  inner agent will have tried re-subscribing in response to the kick
  ::
  ;<  state=libstate  bind:m
    get-lib-state
  ;<  ~  bind:m
    %+  ex-equal  !>(want.state)
    !>  ^-  (map gill:gall (map wire path))
    [[[~zod %hard] [[/hard/2 /hard/2] ~ ~]] ~ ~]
  ::  with notify flag set, these changes must additionally send a poke
  ::
  ;<  caz=(list card)  bind:m
    (perform-upgrade & ~ config)
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  caz=(list card)  bind:m
    (perform-hear-version [~zod %hard] %prot2 %vers2)
  ;<  ~  bind:m
    %+  ex-cards  caz
    :*  (ex-inner-watch /hard/2 [~zod %hard] /hard/2)
        ((ex-notifications &) [~zod %hard] &)
    ==
  ::
  ;<  caz=(list card)  bind:m
    (perform-hear-version [~zod %hard] %prot2 %miss)
  %+  ex-cards  caz
  :*  (ex-inner-leave /hard/2 ~zod %hard)
      ((ex-notifications &) [~zod %hard] |)
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
    (perform-cards [%pass /hard/1 %agent [~zod %hard] %watch /hard/1] ~)
  ::  when we impose version requirements, existing subs must be rescinded,
  ::  and we must start negotiation for them
  ::
  ;<  caz=(list card)  bind:m
    (perform-upgrade | ~ config)
  ;<  ~  bind:m
    %+  ex-cards  caz
    %+  welp
      :-  (ex-inner-leave /hard/1 ~zod %hard)
      ((ex-notifications |) [~zod %hard] |)
    :~  (ex-negotiate [~zod %hard] %prot1)
        (ex-negotiate [~zod %hard] %prot2)
    ==
  ::  when we relax requirements, subs must be re-established
  ::
  ;<  caz=(list card)  bind:m
    (perform-upgrade | ~ ~)
  ;<  ~  bind:m
    %+  ex-cards  caz
    %+  snoc
      ((ex-notifications |) [~zod %hard] &)
    (ex-inner-watch /hard/2 [~zod %hard] /hard/2)
  ::  with notify flag set, these changes must additionally send a poke
  ::
  ;<  caz=(list card)  bind:m
    (perform-upgrade & ~ config)
  ;<  ~  bind:m
    %+  ex-cards  caz
    :-  (ex-inner-leave /hard/2 ~zod %hard)
    ((ex-notifications &) [~zod %hard] |)
  ::
  ;<  caz=(list card)  bind:m
    (perform-upgrade & ~ ~)
  %+  ex-cards  caz
  %+  snoc
    ((ex-notifications &) [~zod %hard] &)
  (ex-inner-watch /hard/3 [~zod %hard] /hard/3)
::
++  test-version-watch-fact
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m
    (perform-init-clean | [[%prot %1] ~ ~] ~)
  ;<  caz=(list card)  bind:m
    (do-watch /~/negotiate/version/prot)
  (ex-cards caz (ex-fact ~ %noun !>(`*`%1)) ~)
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
  (ex-cards caz (ex-fact [/~/negotiate/version/prot1]~ %noun !>(`*`%1)) ~)
::
++  test-notify-during-config-change
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m
    (perform-init-clean | ~ ~)
  ::
  ;<  caz=(list card)  bind:m
    (perform-cards [%pass /hard %agent [~zod %hard] %watch /hard] ~)
  ::  when we impose version requirements, existing subs must be rescinded,
  ::  and we must start negotiation for them, notifying about any gills
  ::  that were affected
  ::
  ;<  caz=(list card)  bind:m
    (perform-upgrade & ~ [[%hard %prot^%vers ~ ~] ~ ~])
  %+  ex-cards  caz
  %+  snoc
    ^-  (list $-(card tang))
    :-  (ex-inner-leave /hard ~zod %hard)
    ((ex-notifications &) [~zod %hard] |)
  (ex-negotiate [~zod %hard] %prot)
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
  ;<  *  bind:m  (do-agent /~/negotiate/inner-watch/~zod/easy/wire [~zod %easy] %watch-ack ~)
  ::  must pretend to the inner agent that the sub was established,
  ::  and that library-internal subs don't exist
  ::
  ;<  caz=(list card)  bind:m
    (do-poke %emit-bowl !>(~))
  ?>  ?=([[%give %fact ~ %bowl *] ~] caz)
  =+  !<(=bowl:gall q.cage.p.i.caz)
  %+  ex-equal  !>(wex.bowl)
  !>  %-  ~(gas by *boat:gall)
  :~  [/wire ~zod %hard]^[| /path]
      [/wire ~zod %easy]^[& /path]
  ==
--
