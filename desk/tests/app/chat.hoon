/-  c=chat, ch=channels, h=hark, contacts
/+  *test-agent
/=  agent  /app/chat
|%
++  dap  %chat-test
++  test-dm-notification-clearing
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap agent)
  ;<  *  bind:m  (set-scry-gate scries)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~dev, src ~zod)))
  ;<  bw=bowl  bind:m  get-bowl
  =/  =verse:ch  [%inline ~['hi ' [%ship ~dev]]]
  =/  =diff:dm:c  (dm-message ~zod now.bw verse)
  ::  start a dm from zod
  :: ~&  'starting dm from zod'
  ;<  *  bind:m  (do-poke %chat-dm-diff !>(diff))
  ;<  *  bind:m  (set-src ~dev)
  ::  accept the dm and set read
  :: ~&  'accepting dm from zod'
  ;<  *  bind:m  (wait ~s1)
  ;<  bw=bowl  bind:m  get-bowl
  ;<  *  bind:m  (do-poke %chat-dm-rsvp !>([~zod &]))
  ;<  *  bind:m  (do-poke %chat-remark-action !>([[%ship ~zod] %read ~]))
  ::  send another dm from zod with a notification
  ;<  *  bind:m  (set-src ~zod)
  :: ~&  'sending dm from zod with notification'
  ;<  *  bind:m  (wait ~s1)
  ;<  bw=bowl  bind:m  get-bowl
  =/  =diff:dm:c  (dm-message ~zod now.bw verse)
  ;<  caz=(list card)  bind:m  (do-poke %chat-dm-diff !>(diff))
  ::  expect a notification and an unread dm
  =/  =whom:c  [%ship ~zod]
  =/  =unread:unreads:c  [now.bw 1 `[[[~zod now.bw] now.bw] 1] ~]
  =/  =unreads:c  (malt [whom unread] ~)
  =/  =response:writs:c  [[~zod now.bw] %add [~[verse] ~zod now.bw] now.bw]
  =/  =new-yarn:h  [& & rope content /dm/~zod ~]
  ;<  *  bind:m  (ex-scry-result /x/unreads !>(unreads))
  :: ~&  'have unreads'
  ;<  *  bind:m
    %+  ex-cards  caz
    :~  (ex-poke /contacts/~zod [~dev %contacts] act:mar:contacts !>([%heed ~[~zod]]))
        (ex-fact ~[/unreads] %chat-unread-update !>([whom unread]))
        (ex-poke /hark [~dev %hark] %hark-action-1 !>([%new-yarn new-yarn]))
        (ex-fact ~[/dm/~zod] %writ-response !>([[%ship ~zod] response]))
        (ex-fact ~[/dm/~zod/writs] %writ-response !>([[%ship ~zod] response]))
    ==
  ;<  *  bind:m  (wait ~s1)
  ;<  bw=bowl  bind:m  get-bowl
  =/  =unread:unreads:c  [(sub now.bw ~s1) 0 ~ ~]
  :: ~&  'marked read and notification cleared'
  ;<  caz=(list card)  bind:m  (do-poke %chat-remark-action !>([[%ship ~zod] %read ~]))
  %+  ex-cards  caz
  :~  (ex-poke /hark [~dev %hark] %hark-action-1 !>([%saw-rope rope]))
      (ex-fact ~[/unreads] %chat-unread-update !>([whom unread]))
  ==
::++  test-club-notification-clearing
++  scries
  |=  =path
  ^-  (unit vase)
  ?+  path  ~
    [%gu @ %groups @ *]           `!>(%.y)
    [%gx @ %groups @ %volume *]   `!>(%soft)
    [%gx @ %hark @ *]             `!>(carpet)
  ==
++  rope  `rope:h`[~ ~ %groups /dm/~zod]
++  content  `(list content:h)`~[[%ship ~zod] ': ' 'hi ~dev']
++  carpet
  =/  =yarn:h  [0v0 rope *time content /dm/~zod ~]
  ^-  carpet:h
  :*  [%desk %groups]
      (malt ~[[0v0 yarn]])
      (malt ~[[rope (silt ~[0v0])]])
      0
  ==
++  dm-message
  |=  [author=ship =time =verse:ch]
  ^-  diff:dm:c
  =/  =memo:ch  [~[verse] author time]
  [[author time] %add memo ~ ~]
--
