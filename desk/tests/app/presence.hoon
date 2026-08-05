/-  *presence
/+  *test-agent
/=  agent  /app/presence
|%
++  dap  %presence
++  owner  ~sampel-palnet
++  moon  ~digmeb-raltyp-sampel-palnet
++  moon-context  /dm/(scot %p moon)
++  moon-key  [moon-context moon %computing]
++  setup
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our owner, src owner, now ~2026.5.20)))
  ;<  *  bind:m  (do-init dap agent)
  (pure:m ~)
++  test-delegated-set-forwards-with-owner-disclose-and-timing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  =bowl:gall  bind:m  get-bowl
  =/  act=action-1
    [%set *(set ship) moon-key `~m1 *display]
  =/  cmd=command-1
    [%set (sy owner ~) moon-key [now.bowl `~m1] *display]
  ;<  caz=(list card)  bind:m
    (do-poke %presence-delegated-action-1 !>(`action-1`act))
  %+  ex-cards  caz
  :~  (ex-poke [%context moon-context] [owner %presence] %presence-command-1 !>(`command-1`cmd))
  ==
++  test-delegated-clear-forwards
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  =/  act=action-1  [%clear moon-key]
  =/  cmd=command-1  [%clear moon-key]
  ;<  caz=(list card)  bind:m
    (do-poke %presence-delegated-action-1 !>(`action-1`act))
  %+  ex-cards  caz
  :~  (ex-poke [%context moon-context] [owner %presence] %presence-command-1 !>(`command-1`cmd))
  ==
++  test-delegated-command-set-succeeds
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  =bowl:gall  bind:m  get-bowl
  =/  cmd=command-1
    [%set (sy owner ~) moon-key [now.bowl `~m1] *display]
  ;<  caz=(list card)  bind:m
    (do-poke %presence-command-1 !>(`command-1`cmd))
  %+  ex-cards  caz
  :~  (ex-fact ~[/v1] %presence-response-1 !>(`response-1`[%here moon-key [now.bowl `~m1] *display]))
      (ex-arvo [%expire (scot %p moon) %computing moon-context] %b %wait (add now.bowl ~m1))
  ==
++  test-delegated-command-clear-succeeds
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  =bowl:gall  bind:m  get-bowl
  =/  set-command=command-1
    [%set (sy owner ~) moon-key [now.bowl `~m1] *display]
  ;<  *  bind:m
    (do-poke %presence-command-1 !>(`command-1`set-command))
  =/  clear-command=command-1
    [%clear moon-key]
  ;<  caz=(list card)  bind:m
    (do-poke %presence-command-1 !>(`command-1`clear-command))
  %+  ex-cards  caz
  :~  (ex-arvo [%expire (scot %p moon) %computing moon-context] %b %rest (add now.bowl ~m1))
      (ex-fact ~[/v1] %presence-response-1 !>(`response-1`[%gone moon-key]))
  ==
++  test-delegated-rejects-remote-src
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  =/  act=action-1
    [%set *(set ship) moon-key `~m1 *display]
  (ex-fail ((do-as ~zod) (do-poke %presence-delegated-action-1 !>(`action-1`act))))
++  test-delegated-rejects-non-owned-moon
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  =/  bad-key=key  [/dm/~zod ~zod %computing]
  =/  act=action-1
    [%set *(set ship) bad-key `~m1 *display]
  (ex-fail (do-poke %presence-delegated-action-1 !>(`action-1`act)))
++  test-delegated-rejects-non-dm-context
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  =/  bad-key=key
    [/channel/chat/~sampel-palnet/general moon %computing]
  =/  act=action-1
    [%set *(set ship) bad-key `~m1 *display]
  (ex-fail (do-poke %presence-delegated-action-1 !>(`action-1`act)))
++  test-delegated-rejects-mismatched-dm-context
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  =/  bad-key=key
    [/dm/~zod moon %computing]
  =/  act=action-1
    [%set *(set ship) bad-key `~m1 *display]
  (ex-fail (do-poke %presence-delegated-action-1 !>(`action-1`act)))
++  test-delegated-rejects-nuke
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  =/  act=action-1  [%nuke moon-context]
  (ex-fail (do-poke %presence-delegated-action-1 !>(`action-1`act)))
++  test-presence-action-self-path-still-forwards
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  =bowl:gall  bind:m  get-bowl
  =/  self-key=key  [moon-context owner %typing]
  =/  act=action-1
    [%set *(set ship) self-key `~s30 *display]
  =/  cmd=command-1
    [%set *(set ship) self-key [now.bowl `~s30] *display]
  ;<  caz=(list card)  bind:m
    (do-poke %presence-action-1 !>(`action-1`act))
  %+  ex-cards  caz
  :~  (ex-poke [%context moon-context] [owner %presence] %presence-command-1 !>(`command-1`cmd))
  ==
--
