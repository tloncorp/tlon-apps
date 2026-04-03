/-  gs=gateway-status, a=activity
/+  *test-agent
/=  agent  /app/gateway-status
|%
++  dap  %gateway-status
++  scries
  |=  =path
  ^-  (unit vase)
  ?+  path  ~
    [%gu @ %activity @ %$ ~]  `!>(&)
  ==
::
++  setup
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (set-scry-gate scries)
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~dev, src ~dev, now ~2024.1.1)))
  ;<  *  bind:m  (do-init dap agent)
  (pure:m ~)
::
++  configure
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (do-poke %gateway-status-action-1 !>(`action-1:gs`[%configure ~bus ~m5 ~m5]))
  (pure:m ~)
::
++  make-dm-fact
  |=  [sender=ship t=@da]
  ^-  [wire gill:gall sign:agent:gall]
  =/  =message-key:a  [[sender t] t]
  =/  =source:a  [%dm %ship sender]
  =/  =event:a  [[%dm-post message-key [%ship sender] ~[[%inline ~['hello']]] %.n] %.n %.n]
  =/  =update:a  [%add source t event]
  [/activity [~dev %activity] [%fact %activity-update-4 !>(update)]]
::
::  tests
::
++  test-init-subscribes-to-activity
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (set-scry-gate scries)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~dev, src ~dev)))
  ;<  caz=(list card)  bind:m  (do-init dap agent)
  %+  ex-cards  caz
  :~  (ex-task /activity [~dev %activity] %watch /v4)
  ==
::
++  test-configure-sets-owner
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m  (do-poke %gateway-status-action-1 !>(`action-1:gs`[%configure ~bus ~m5 ~m5]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-fact ~[/v1] %gateway-status-update-1 !>(`update-1:gs`[%status %unknown ~]))
    ==
  ;<  res=cage  bind:m  (got-peek /x/state)
  =/  st  !<(state-0:gs q.res)
  ;<  ~  bind:m  (ex-equal !>(owner.st) !>(`~bus))
  (ex-equal !>(active-window.st) !>(~m5))
::
++  test-unconfigured-ignores-everything
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m  (do-agent (make-dm-fact ~bus ~2024.1.1))
  (ex-cards caz ~)
::
++  test-lifecycle-poke-crashes-without-owner
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  (ex-fail (do-poke %gateway-status-action-1 !>(`action-1:gs`[%gateway-start 'boot-1' (add ~2024.1.1 ~m2)])))
::
++  test-owner-dm-while-down-sends-reply
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  configure
  ;<  caz=(list card)  bind:m  (do-agent (make-dm-fact ~bus ~2024.1.1))
  %+  ex-cards  caz
  :~  (ex-fact-paths ~[/v1])
      (ex-poke-wire /dm/send)
      (ex-fact-paths ~[/v1])
  ==
::
++  test-owner-dm-while-healthy-no-reply
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  configure
  =/  lease-time  (add ~2024.1.1 ~m2)
  ;<  *  bind:m  (do-poke %gateway-status-action-1 !>(`action-1:gs`[%gateway-start 'boot-1' lease-time]))
  ;<  caz=(list card)  bind:m  (do-agent (make-dm-fact ~bus ~2024.1.1))
  %+  ex-cards  caz
  :~  (ex-fact-paths ~[/v1])
  ==
::
++  test-non-owner-dm-ignored
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  configure
  ;<  caz=(list card)  bind:m  (do-agent (make-dm-fact ~zod ~2024.1.1))
  (ex-cards caz ~)
::
++  test-self-message-ignored
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  (do-poke %gateway-status-action-1 !>(`action-1:gs`[%configure ~dev ~m5 ~m5]))
  ;<  caz=(list card)  bind:m  (do-agent (make-dm-fact ~dev ~2024.1.1))
  (ex-cards caz ~)
::
++  test-cooldown-suppresses-second-reply
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  configure
  ;<  caz=(list card)  bind:m  (do-agent (make-dm-fact ~bus ~2024.1.1))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-fact-paths ~[/v1])
        (ex-poke-wire /dm/send)
        (ex-fact-paths ~[/v1])
    ==
  ;<  ~  bind:m  (wait ~s1)
  =/  t2  (add ~2024.1.1 ~s1)
  ;<  caz=(list card)  bind:m  (do-agent (make-dm-fact ~bus t2))
  %+  ex-cards  caz
  :~  (ex-fact-paths ~[/v1])
  ==
::
++  test-dedupe-same-message-key
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  configure
  ;<  caz=(list card)  bind:m  (do-agent (make-dm-fact ~bus ~2024.1.1))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-fact-paths ~[/v1])
        (ex-poke-wire /dm/send)
        (ex-fact-paths ~[/v1])
    ==
  ;<  ~  bind:m  (wait ~m6)
  ;<  caz=(list card)  bind:m  (do-agent (make-dm-fact ~bus ~2024.1.1))
  %+  ex-cards  caz
  :~  (ex-fact-paths ~[/v1])
  ==
::
++  test-gateway-stop-sets-state
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  configure
  =/  lease-time  (add ~2024.1.1 ~m2)
  ;<  *  bind:m  (do-poke %gateway-status-action-1 !>(`action-1:gs`[%gateway-start 'boot-1' lease-time]))
  ;<  *  bind:m  (do-poke %gateway-status-action-1 !>(`action-1:gs`[%gateway-stop 'test']))
  ;<  res=cage  bind:m  (got-peek /x/state)
  =/  st  !<(state-0:gs q.res)
  ;<  ~  bind:m  (ex-equal !>(status.st) !>(%down))
  (ex-equal !>(pending-restart-notice.st) !>(%.y))
::
++  test-gateway-start-clears-pending-notice
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  configure
  =/  lease-time  (add ~2024.1.1 ~m2)
  ;<  *  bind:m  (do-poke %gateway-status-action-1 !>(`action-1:gs`[%gateway-start 'boot-1' lease-time]))
  ;<  *  bind:m  (do-poke %gateway-status-action-1 !>(`action-1:gs`[%gateway-stop 'test']))
  ::  verify pending-restart-notice was set by stop
  ;<  res=cage  bind:m  (got-peek /x/state)
  =/  st  !<(state-0:gs q.res)
  ;<  ~  bind:m  (ex-equal !>(pending-restart-notice.st) !>(%.y))
  ::  restart clears pending-restart-notice
  =/  lease-time-2  (add ~2024.1.1 ~m4)
  ;<  *  bind:m  (do-poke %gateway-status-action-1 !>(`action-1:gs`[%gateway-start 'boot-2' lease-time-2]))
  ;<  res=cage  bind:m  (got-peek /x/state)
  =/  st  !<(state-0:gs q.res)
  ;<  ~  bind:m  (ex-equal !>(status.st) !>(%up))
  (ex-equal !>(pending-restart-notice.st) !>(%.n))
::
++  test-gateway-start-sets-status-up
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  configure
  =/  lease-time  (add ~2024.1.1 ~s90)
  ;<  *  bind:m  (do-poke %gateway-status-action-1 !>(`action-1:gs`[%gateway-start 'boot-1' lease-time]))
  ;<  res=cage  bind:m  (got-peek /x/state)
  =/  st  !<(state-0:gs q.res)
  ;<  ~  bind:m  (ex-equal !>(status.st) !>(%up))
  (ex-equal !>(lease-until.st) !>(`lease-time))
::
++  test-lease-expiry-precondition
  ::  verifies gateway-start leaves pending-restart-notice as %.n,
  ::  confirming that a subsequent lease-expiry transition would be
  ::  the only path that sets it to %.y in the crash scenario.
  ::  the actual post-wake state change is verified on the live ship.
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  configure
  =/  lease-time  (add ~2024.1.1 ~s90)
  ;<  *  bind:m  (do-poke %gateway-status-action-1 !>(`action-1:gs`[%gateway-start 'boot-1' lease-time]))
  ;<  res=cage  bind:m  (got-peek /x/state)
  =/  st  !<(state-0:gs q.res)
  ;<  ~  bind:m  (ex-equal !>(status.st) !>(%up))
  (ex-equal !>(pending-restart-notice.st) !>(%.n))
--
