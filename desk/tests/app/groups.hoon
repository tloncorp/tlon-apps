/-  g=groups
/+  *test-agent
/=  groups-agent  /app/groups
|%
++  dap  %groups-test
++  the-wire  /groups/(scot %p ~zod)/test
++  updates-wire  (weld the-wire /updates)
++  the-path  (weld updates-wire /init)
++  the-dock  [~zod dap]
++  the-group  [%test 'test' '' '' '' [%open ~ ~] ~ |]
++  flag  [~zod %test]
++  retry  (weld /~/retry updates-wire)
++  test-subscription-loop
  %-  eval-mare
  =/  m  (mare ,~)
  ::  init and add group
  ;<  *  bind:m  (do-init %groups-test groups-agent)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~dev, src ~dev)))
  ;<  *  bind:m  (do-poke %group-join !>([flag &]))
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~dev, src ~zod)))
  ;<  *  bind:m  (do-agent /gangs/(scot %p ~zod)/test/join/add the-dock %poke-ack ~)
  ;<  *  bind:m  (do-agent updates-wire the-dock %watch-ack ~)
  ;<  bw=bowl  bind:m  get-bowl
  =/  now=time  now.bw
  ::  kick & resubscribe with delay
  ;<  caz=(list card)  bind:m  (do-agent updates-wire the-dock %kick ~)
  =/  next=time  (add now ~s30)
  ;<  *  bind:m
  (ex-cards caz (ex-arvo retry %b %wait next) ~)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(now next)))
  ::  wakeup & resubscribe no delay
  ;<  caz=(list card)  bind:m  (do-arvo retry %behn %wake ~)
  (ex-cards caz (ex-task updates-wire the-dock %watch the-path) ~)
++  test-unsubscribe
  %-  eval-mare
  =/  m  (mare ,~)
  ::  init and add group
  ;<  *  bind:m  (do-init %groups-test groups-agent)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~dev, src ~dev)))
  ;<  *  bind:m  (do-poke %group-join !>([flag &]))
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~dev, src ~zod)))
  ;<  *  bind:m  (do-agent /gangs/(scot %p ~zod)/test/join/add the-dock %poke-ack ~)
  ;<  *  bind:m  (do-agent updates-wire the-dock %watch-ack ~)
  ;<  bw=bowl  bind:m  get-bowl
  =/  now=time  now.bw
  ::  kick & resubscribe with delay
  ;<  caz=(list card)  bind:m  (do-agent updates-wire the-dock %kick ~)
  =/  next=time  (add now ~s30)
  ;<  caz=(list card)  bind:m  (do-poke %group-leave !>(flag))
  =/  remove-vase  !>([flag now %fleet (silt ~dev ~) %del ~])
  %+  ex-cards  caz
  :~  (ex-poke (weld the-wire /proxy) the-dock act:mar:g remove-vase)
      (ex-fact ~[/groups /groups/ui] %group-leave !>(flag))
      (ex-arvo retry %b %rest next)
      (ex-task updates-wire the-dock %leave ~)
      (ex-fact ~[/groups/ui] act:mar:g !>([flag now %del ~]))
  ==
--