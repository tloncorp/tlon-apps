/-  ui
/+  *test-agent
/=  agent  /app/groups-ui
|%
++  dap  %groups-ui-test
++  test-scry-v0-init
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap agent)
  :: ;<  =cage  bind:m  (get-full-peek /x/init)
  :: ;<  ~  bind:m  (ex-equal !>(p.cage) !>(%ui-init))
  :: =+  !<(=init-0:ui q.cage)
  (pure:m ~)
--
