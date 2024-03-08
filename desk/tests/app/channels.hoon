/-  g=groups, c=channels
/+  *test-agent
/=  channels-agent  /app/channels
|%
++  dap  %channels-test
++  server-dap  %channels-test-server
++  negotiate  /~/negotiate/inner-watch/~zod/[server-dap]
++  sub-wire  /chat/(scot %p ~zod)/test
++  negotiate-wire  (weld negotiate /chat/(scot %p ~zod)/test)
++  chk-wire  (weld negotiate-wire /checkpoint)
++  chk-path  /chat/test/checkpoint/before/100
++  the-dock  [~zod server-dap]
++  the-nest  [%chat ~zod %test]
++  the-group  [~zod %test]
++  test-checkpoint-sub
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  channel-join
  =/  retry  (weld /~/retry (weld sub-wire /checkpoint))
  (check-subscription-loop chk-wire chk-wire the-dock chk-path retry)
++  test-updates-sub
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  channel-join
  ::  get checkpoint and start updates
  =/  =cage  [%channel-checkpoint !>(*u-checkpoint:c)]
  ;<  *  bind:m  (do-agent chk-wire the-dock %fact cage)
  =/  updates-wire  (weld negotiate-wire /updates)
  ::  kicking updates retries back to checkpoint
  =/  updates-retry  (weld /~/retry (weld sub-wire /checkpoint))
  ;<  *  bind:m  (do-agent updates-wire the-dock %watch-ack ~)
  (check-subscription-loop updates-wire chk-wire the-dock chk-path updates-retry)
++  test-backlog-sub
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  channel-join
  ;<  bw=bowl  bind:m  get-bowl
  ::  get checkpoint and start updates
  =/  last-post-time  (add now.bw 1)
  =/  last-post=v-post:c
    :-  [last-post-time ~ ~]
    [0 [[~ ~dev last-post-time] %chat ~]]
  =/  posts=v-posts:c
    (gas:on-v-posts:c *v-posts:c ~[[last-post-time `last-post]])
  =/  checkpoint  *u-checkpoint:c
  =/  =cage  [%channel-checkpoint !>(checkpoint(posts posts))]
  ;<  *  bind:m  (do-agent chk-wire the-dock %fact cage)
  =/  backlog-wire  (weld negotiate-wire /backlog)
  =/  backlog-path
    %+  welp  /chat/test/checkpoint/time-range
    /(scot %da *@da)/(scot %da last-post-time)
  =/  backlog-retry  (weld /~/retry (weld sub-wire /backlog))
  ;<  *  bind:m  (do-agent backlog-wire the-dock %watch-ack ~)
  (check-subscription-loop backlog-wire backlog-wire the-dock backlog-path backlog-retry)
++  check-subscription-loop
  |=  [sub=wire resub=wire =dock =path retry-wire=wire]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  bw=bowl  bind:m  get-bowl
  =/  now=time  now.bw
  ::  kick & resubscribe with delay
  ;<  caz=(list card)  bind:m  (do-agent sub dock %kick ~)
  =/  next=time  (add now ~s30)
  ;<  *  bind:m
  (ex-cards caz (ex-arvo retry-wire %b %wait next) ~)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(now next)))
  ::  wakeup & resubscribe no delay
  ;<  caz=(list card)  bind:m  (do-arvo retry-wire %behn %wake ~)
  (ex-cards caz (ex-task resub dock %watch path) ~)
++  channel-join
  =/  m  (mare ,(list card))
  ^-  form:m
  ::  join channel
  ;<  *  bind:m  (do-init dap channels-agent)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~dev, src ~dev)))
  ;<  *  bind:m  (do-poke %channel-action !>([%channel the-nest %join the-group]))
  (do-agent chk-wire the-dock %watch-ack ~)
--