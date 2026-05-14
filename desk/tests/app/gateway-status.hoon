::  tests for %gateway-status agent
::
/-  gs=gateway-status, a=activity, av=activity-ver
/+  *test-agent
/=  agent  /app/gateway-status
|%
++  dap  %gateway-status
+$  state-1
  $:  %1
      owner=(unit ship)
      last-owner-msg=@da
      last-owner-msg-id=(unit message-key:a)
      =status:gs
      boot-id=(unit @t)
      lease-until=(unit @da)
      last-heartbeat=(unit @da)
      last-stop=(unit @da)
      last-start=(unit @da)
      pending-restart=?
      last-auto-reply=(unit @da)
      last-auto-reply-to=(unit message-key:a)
      reply-cooldown=@dr
      active-window=@dr
  ==
++  scries
  |=  =path
  ^-  (unit vase)
  ?+  path  ~
    [%gu @ %activity @ %$ ~]  `!>(&)
  ==
++  setup
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (set-scry-gate scries)
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~dev, src ~dev, now ~2024.1.1)))
  ;<  *  bind:m  (do-init dap agent)
  (pure:m ~)
++  configure
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (do-poke %gateway-status-action-1 !>(`action:v1:gs`[%configure ~bus ~m5 ~m5]))
  (pure:m ~)
++  make-dm-fact
  |=  [sender=ship t=@da]
  ^-  [wire gill:gall sign:agent:gall]
  =/  =message-key:a  [[sender t] t]
  =/  =source:a  [%dm %ship sender]
  =/  =event:a  [[%dm-post message-key [%ship sender] ~[[%inline ~['hello']]] %.n] %.n %.n]
  =/  =update:a  [%add source t event]
  [/activity [~dev %activity] [%fact %activity-update-5 !>(`update:v9:av`update)]]
++  test-init-subscribes-to-activity
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (set-scry-gate scries)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~dev, src ~dev)))
  ;<  caz=(list card)  bind:m  (do-init dap agent)
  %+  ex-cards  caz
  :~  (ex-task /activity [~dev %activity] %watch /v5)
  ==
++  test-configure-sets-owner
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m  (do-poke %gateway-status-action-1 !>(`action:v1:gs`[%configure ~bus ~m5 ~m5]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-fact ~[/v1] %gateway-status-update-1 !>(`update:v1:gs`[%status %unknown ~]))
    ==
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(owner.st) !>(`~bus))
  (ex-equal !>(active-window.st) !>(~m5))
++  test-unconfigured-ignores-everything
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m  (do-agent (make-dm-fact ~bus ~2024.1.1))
  (ex-cards caz ~)
++  test-lifecycle-poke-crashes-without-owner
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  (ex-fail (do-poke %gateway-status-action-1 !>(`action:v1:gs`[%gateway-start 'boot-1' (add ~2024.1.1 ~m2)])))
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
++  test-owner-dm-while-healthy-no-reply
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  configure
  =/  lease-time  (add ~2024.1.1 ~m2)
  ;<  *  bind:m  (do-poke %gateway-status-action-1 !>(`action:v1:gs`[%gateway-start 'boot-1' lease-time]))
  ;<  caz=(list card)  bind:m  (do-agent (make-dm-fact ~bus ~2024.1.1))
  %+  ex-cards  caz
  :~  (ex-fact-paths ~[/v1])
  ==
++  test-non-owner-dm-ignored
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  configure
  ;<  caz=(list card)  bind:m  (do-agent (make-dm-fact ~zod ~2024.1.1))
  (ex-cards caz ~)
++  test-self-message-ignored
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  (do-poke %gateway-status-action-1 !>(`action:v1:gs`[%configure ~dev ~m5 ~m5]))
  ;<  caz=(list card)  bind:m  (do-agent (make-dm-fact ~dev ~2024.1.1))
  (ex-cards caz ~)
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
++  test-gateway-stop-sets-state
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  configure
  =/  lease-time  (add ~2024.1.1 ~m2)
  ;<  *  bind:m  (do-poke %gateway-status-action-1 !>(`action:v1:gs`[%gateway-start 'boot-1' lease-time]))
  ;<  *  bind:m  (do-poke %gateway-status-action-1 !>(`action:v1:gs`[%gateway-stop 'boot-1' 'test']))
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(status.st) !>(%down))
  (ex-equal !>(pending-restart.st) !>(&))
++  test-gateway-start-clears-pending-notice
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  configure
  =/  lease-time  (add ~2024.1.1 ~m2)
  ;<  *  bind:m  (do-poke %gateway-status-action-1 !>(`action:v1:gs`[%gateway-start 'boot-1' lease-time]))
  ;<  *  bind:m  (do-poke %gateway-status-action-1 !>(`action:v1:gs`[%gateway-stop 'boot-1' 'test']))
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(pending-restart.st) !>(&))
  =/  lease-time-2  (add ~2024.1.1 ~m4)
  ;<  *  bind:m  (do-poke %gateway-status-action-1 !>(`action:v1:gs`[%gateway-start 'boot-2' lease-time-2]))
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(status.st) !>(%up))
  (ex-equal !>(pending-restart.st) !>(|))
++  test-gateway-start-sets-status-up
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  configure
  =/  lease-time  (add ~2024.1.1 ~s90)
  ;<  *  bind:m  (do-poke %gateway-status-action-1 !>(`action:v1:gs`[%gateway-start 'boot-1' lease-time]))
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(status.st) !>(%up))
  (ex-equal !>(lease-until.st) !>(`lease-time))
++  test-lease-expiry-precondition
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  configure
  =/  lease-time  (add ~2024.1.1 ~s90)
  ;<  *  bind:m  (do-poke %gateway-status-action-1 !>(`action:v1:gs`[%gateway-start 'boot-1' lease-time]))
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(status.st) !>(%up))
  (ex-equal !>(pending-restart.st) !>(|))
++  test-heartbeat-restores-up-after-expiry
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  configure
  =/  lease-time  (add ~2024.1.1 ~s90)
  ;<  *  bind:m  (do-poke %gateway-status-action-1 !>(`action:v1:gs`[%gateway-start 'boot-1' lease-time]))
  ;<  ~  bind:m  (wait ~s91)
  ;<  *  bind:m  (do-arvo /lease-check [%behn %wake ~])
  =/  new-lease  (add ~2024.1.1 ~m5)
  ;<  *  bind:m  (do-poke %gateway-status-action-1 !>(`action:v1:gs`[%gateway-heartbeat 'boot-1' new-lease]))
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(status.st) !>(%up))
  ;<  ~  bind:m  (ex-equal !>(pending-restart.st) !>(|))
  (ex-equal !>(lease-until.st) !>(`new-lease))
++  test-stale-stop-ignored
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  configure
  =/  lease-time  (add ~2024.1.1 ~m2)
  ;<  *  bind:m  (do-poke %gateway-status-action-1 !>(`action:v1:gs`[%gateway-start 'boot-1' lease-time]))
  ;<  *  bind:m  (do-poke %gateway-status-action-1 !>(`action:v1:gs`[%gateway-stop 'boot-old' 'stale']))
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(status.st) !>(%up))
  ;<  ~  bind:m  (ex-equal !>(boot-id.st) !>(`'boot-1'))
  (ex-equal !>(pending-restart.st) !>(|))
++  test-delayed-heartbeat-after-stop-ignored
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  configure
  =/  lease-time  (add ~2024.1.1 ~m2)
  ;<  *  bind:m  (do-poke %gateway-status-action-1 !>(`action:v1:gs`[%gateway-start 'boot-1' lease-time]))
  ;<  *  bind:m  (do-poke %gateway-status-action-1 !>(`action:v1:gs`[%gateway-stop 'boot-1' 'shutdown']))
  =/  new-lease  (add ~2024.1.1 ~m5)
  ;<  *  bind:m  (do-poke %gateway-status-action-1 !>(`action:v1:gs`[%gateway-heartbeat 'boot-1' new-lease]))
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-1 !<(vase q.res))
  ;<  ~  bind:m  (ex-equal !>(status.st) !>(%down))
  ;<  ~  bind:m  (ex-equal !>(boot-id.st) !>(~))
  (ex-equal !>(pending-restart.st) !>(&))
--
