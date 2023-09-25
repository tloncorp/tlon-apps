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
  $:  %0
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
--
::
|%
++  get-lib-state
  =/  m  (mare ,libstate)
  ^-  form:m
  ;<  state=vase  bind:m  get-save
  (pure:m o:!<([[%negotiate o=libstate] vase] state))
::
++  ex-scry-result
  |=  [=path =vase]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  res=(unit (unit cage))  bind:m  (get-peek path)
  (ex-equal q:(need (need res)) vase)
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
    :~  [%pass /keep %agent [~zod %easy] %watch /path]
        [%pass /kill %agent [~zod %hard] %watch /path]
    ==
  ::  library gets initialized with versioning requirements,
  ::  while to-be-versioned subs are already live
  ::
  ;<  caz=(list card)  bind:m
    (perform-upgrade | ~ [[%hard [%prot^%vers ~ ~]] ~ ~])
  ::  must start negotiation and kill the affected sub
  ::
  ;<  ~  bind:m
    %+  ex-cards  caz
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
++  test-avoid-self-tracking
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (perform-init-clean | ~ ~)
  ;<  *  bind:m  (perform-cards [%pass /wire %agent [~zod %hard] %watch /path] ~)
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
    (do-agent outer-wire [~zod %easy] %kick ~)
  ;<  state=libstate  bind:m
    get-lib-state
  ;<  ~  bind:m
    (ex-equal !>(want.state) !>(~))
  ::  if nacked, we must "lose" the sub
  ::
  ;<  *  bind:m
    (perform-cards [%pass /wire %agent [~zod %easy] %watch /path] ~)
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
  ::  if we don't match, trying to poke must crash
  ::
  ;<  ~  bind:m
    (ex-crash (do-poke %emit-cards !>([poke]~)))
  ::  once we do, poking is fine
  ::
  ;<  *  bind:m  (perform-cards (initiate:libn ~zod %hard) ~)
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
        [%pass /wire %agent [~zod %hard] %watch /path]
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
    :~  (ex-card wait(time (add *@da ~m30)))
        (ex-inner-leave /wire ~zod %hard)
        (ex-notify [~zod %hard] |)
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
  ;<  caz=(list card)  bind:m
    (perform-cards [%pass /wire %agent [~zod %hard] %watch /path] ~)
  ::  when only one version matches, nothing changes
  ::
  ;<  caz=(list card)  bind:m
    (perform-hear-version [~zod %hard] %prot1 %vers1)
  ;<  ~  bind:m
    (ex-cards caz ~)
  ::  once both versions match, should re-establish subs
  ::
  ;<  caz=(list card)  bind:m
    (perform-hear-version [~zod %hard] %prot2 %vers2)
  ;<  ~  bind:m
    (ex-cards caz (ex-inner-watch /wire [~zod %hard] /path) ~)
  ::  when versions stop matching, should rescind subs
  ::
  ;<  caz=(list card)  bind:m
    (perform-hear-version [~zod %hard] %prot2 %miss)
  ;<  ~  bind:m
    (ex-cards caz (ex-inner-leave /wire ~zod %hard) ~)
  ::  with notify flag set, these changes must additionally send a poke
  ::
  ;<  caz=(list card)  bind:m
    (perform-upgrade & ~ config)
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  caz=(list card)  bind:m
    (perform-hear-version [~zod %hard] %prot2 %vers2)
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-inner-watch /wire [~zod %hard] /path)
        (ex-notify [~zod %hard] &)
    ==
  ::
  ;<  caz=(list card)  bind:m
    (perform-hear-version [~zod %hard] %prot2 %miss)
  %+  ex-cards  caz
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
  ::  when we impose version requirements, existing subs must be rescinded,
  ::  and we must start negotiation for them
  ::
  ;<  caz=(list card)  bind:m
    (perform-upgrade | ~ config)
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-negotiate [~zod %hard] %prot1)
        (ex-negotiate [~zod %hard] %prot2)
        (ex-inner-leave /wire ~zod %hard)
    ==
  ::  when we relax requirements, subs must be re-established
  ::
  ;<  caz=(list card)  bind:m
    (perform-upgrade | ~ ~)
  ;<  ~  bind:m
    (ex-cards caz (ex-inner-watch /wire [~zod %hard] /path) ~)
  ::  with notify flag set, these changes must additionally send a poke
  ::
  ;<  caz=(list card)  bind:m
    (perform-upgrade & ~ config)
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-notify [~zod %hard] |)
        (ex-inner-leave /wire ~zod %hard)
    ==
  ::
  ;<  caz=(list card)  bind:m
    (perform-upgrade & ~ ~)
  %+  ex-cards  caz
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
    (perform-cards [%pass /wire %agent [~zod %hard] %watch /path] ~)
  ::  when we impose version requirements, existing subs must be rescinded,
  ::  and we must start negotiation for them, notifying about any gills
  ::  that were affected
  ::
  ;<  caz=(list card)  bind:m
    (perform-upgrade & ~ [[%hard %prot^%vers ~ ~] ~ ~])
  %+  ex-cards  caz
  :~  (ex-notify [~zod %hard] |)
      (ex-negotiate [~zod %hard] %prot)
      (ex-inner-leave /wire ~zod %hard)
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
  ;<  *  bind:m  (do-agent /~/negotiate/inner-watch/~zod/easy/wire [~zod %easy] %watch-ack ~)
  ::  must pretend to the inner agent that the sub was established,
  ::  and that library-internal subs don't exist
  ::
  ;<  caz=(list card)  bind:m
    (do-poke %emit-bowl !>(~))
  :: =.  caz  (remove-verb-cards caz)
  ?>  ?=([* [%give %fact ~ %bowl *] ~] caz)
  =+  !<(=bowl:gall q.cage.p.i.t.caz)
  %+  ex-equal  !>(wex.bowl)
  !>  %-  ~(gas by *boat:gall)
  :~  [/wire ~zod %hard]^[| /path]
      [/wire ~zod %easy]^[& /path]
  ==
--
