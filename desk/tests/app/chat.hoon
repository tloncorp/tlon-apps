/-  c=chat, ch=channels, h=hark, contacts
/+  *test-agent
/=  agent  /app/chat
|%
++  dap  %chat-test
++  test-dm-notification-clearing
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap agent)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~dev, src ~zod)))
  ;<  bw=bowl  bind:m  get-bowl
  =/  =verse:ch  [%inline ~['hi ' [%ship ~dev]]]
  =/  =diff:dm:c  (dm-message ~zod now.bw verse)
  ::  start a dm from zod
  ;<  *  bind:m  (do-poke %chat-dm-diff !>(diff))
  (pure:m ~)
  ;<  *  bind:m  (set-src ~dev)
  ::  accept the dm and set read
  ;<  *  bind:m  (do-poke %chat-dm-rsvp !>([~dev &]))
  ;<  *  bind:m  (do-poke %chat-remark-action !>([[%ship ~zod] %read ~]))
  ::  send another dm from zod with a notification
  ;<  *  bind:m  (set-src ~zod)
  ;<  caz=(list card)  bind:m  (do-poke %chat-dm-diff !>(diff))
  ::  expect a notification and an unread dm
  =/  =whom:c  [%ship ~zod]
  =/  =unread:unreads:c  [now.bw 1 `[[[~zod now.bw] now.bw] 1] ~]
  =/  =unreads:c  (malt [whom unread] ~)
  =/  =response:writs:c  [[~zod now.bw] %add [~[verse] ~zod now.bw] now.bw]
  =/  content=(list content:h)  ~[[%ship ~zod] ': ' 'hi ~dev']
  =/  =new-yarn:h  [& & [~ ~ %groups /dm/zod] content /dm/zod ~]
  ;<  *  bind:m  (ex-scry-result /x/unreads !>(unreads))
  :: ;<  *  bind:m
  %+  ex-cards  caz
    :~  (ex-poke /contacts/zod [~dev %contacts] act:mar:contacts !>([%heed ~[~zod]]))
        (ex-fact ~[/unreads] %chat-unread-update !>([whom unread]))
        (ex-poke /hark [~dev %hark] %hark-action-1 !>([%new-yarn new-yarn]))
        (ex-fact ~[/dm/zod] %writ-response !>(response))
        (ex-fact ~[/dm/zod/writs] %writ-response !>(response))
    ==
::++  test-club-notification-clearing
++  dm-message
  |=  [author=ship =time =verse:ch]
  ^-  diff:dm:c
  =/  =memo:ch  [~[verse] author time]
  [[author time] %add memo ~ ~]
--
