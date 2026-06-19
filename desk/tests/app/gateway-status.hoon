::  tests for %gateway-status proxy agent
::
::    %gateway-status is now a thin proxy that forwards actions to %steward.
::    these tests verify the translation layer: each gateway-status action
::    must emit the correct %steward-action-1 poke(s).
::
/-  gs=gateway-status, s=steward
/+  *test-agent
/=  agent  /app/gateway-status
|%
++  dap  %gateway-status
::
++  setup
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~dev, src ~dev)))
  ;<  *  bind:m  (do-init dap agent)
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now ~2024.1.1)))
  (pure:m ~)
::
::  configure forwards TWO steward pokes: top-level owner + gateway timing
::
++  test-configure-forwards-two-steward-pokes
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m
    (do-poke %gateway-status-action-1 !>(`action:v1:gs`[%configure ~bus ~m5 ~m5]))
  %+  ex-cards  caz
  :~  %-  ex-poke
      :*  /steward/proxy
          [~dev %steward]
          %steward-action-1
          !>(`action:v1:s`[%configure ~bus])
      ==
      %-  ex-poke
      :*  /steward/proxy
          [~dev %steward]
          %steward-action-1
          !>(`action:v1:s`[%gateway %configure ~m5 ~m5])
      ==
  ==
::
::  gateway-start forwards a single wrapped steward poke
::
++  test-gateway-start-forwards-steward-poke
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  =/  lut  (add ~2024.1.1 ~m2)
  ;<  caz=(list card)  bind:m
    (do-poke %gateway-status-action-1 !>(`action:v1:gs`[%gateway-start 'boot-1' lut]))
  %+  ex-cards  caz
  :~  %-  ex-poke
      :*  /steward/proxy
          [~dev %steward]
          %steward-action-1
          !>(`action:v1:s`[%gateway %gateway-start 'boot-1' lut])
      ==
  ==
::
::  gateway-heartbeat forwards a single wrapped steward poke
::
++  test-gateway-heartbeat-forwards-steward-poke
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  =/  lut  (add ~2024.1.1 ~m2)
  ;<  caz=(list card)  bind:m
    (do-poke %gateway-status-action-1 !>(`action:v1:gs`[%gateway-heartbeat 'boot-1' lut]))
  %+  ex-cards  caz
  :~  %-  ex-poke
      :*  /steward/proxy
          [~dev %steward]
          %steward-action-1
          !>(`action:v1:s`[%gateway %gateway-heartbeat 'boot-1' lut])
      ==
  ==
::
::  gateway-stop forwards a single wrapped steward poke
::
++  test-gateway-stop-forwards-steward-poke
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m
    (do-poke %gateway-status-action-1 !>(`action:v1:gs`[%gateway-stop 'boot-1' 'shutdown']))
  %+  ex-cards  caz
  :~  %-  ex-poke
      :*  /steward/proxy
          [~dev %steward]
          %steward-action-1
          !>(`action:v1:s`[%gateway %gateway-stop 'boot-1' 'shutdown'])
      ==
  ==
--
