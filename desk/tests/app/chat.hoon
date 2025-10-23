/-  c=chat, cv=chat-ver, ch=channels, contacts, activity
/+  *test-agent, cc=chat-conv
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
  ;<  *  bind:m  (do-poke %chat-dm-diff-1 !>(diff))
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
  ;<  caz=(list card)  bind:m  (do-poke %chat-dm-diff-1 !>(diff))
  ::  expect a notification and an unread dm
  =/  =whom:c  [%ship ~zod]
  =/  =unread:unreads:c  [now.bw 1 `[[[~zod now.bw] now.bw] 1] ~]
  =/  =unreads:c  (malt [whom unread] ~)
  =/  =essay:c
    [[~[verse] ~zod now.bw] chat+/ ~ ~]
  =/  =response:writs:c  [[~zod now.bw] %add essay 3 now.bw]
  =/  old-response-3=[whom:v3:cv response:writs:v3:cv]
    :-  whom
    %-  v3:response-writs:v5:cc
    (v5:response-writs:v6:cc response)
  =/  old-response-4=[whom:v4:cv response:writs:v4:cv]
    [whom (v4:response-writs:v6:cc response)]
  =/  old-response-5=[whom:v5:cv response:writs:v5:cv]
    [whom (v5:response-writs:v6:cc response)]
  =/  activity-action=action:activity
    [%add %dm-post [[~zod now.bw] now.bw] [%ship ~zod] ~[verse] &]
  ;<  *  bind:m  (ex-scry-result /x/unreads !>(unreads))
  :: ~&  'have unreads'
  ;<  *  bind:m
    %+  ex-cards  caz
    :~  (ex-poke /contacts/~zod [~dev %contacts] contact-action+!>([%heed ~[~zod]]))
        (ex-fact ~[/unreads] %chat-unread-update !>([whom unread]))
        (ex-poke /activity/submit [~dev %activity] activity-action+!>(activity-action))
        (ex-fact ~[/ /dm/~zod /dm/~zod/writs] writ-response+!>(old-response-3))
        (ex-fact ~[/v1 /v1/dm/~zod /v1/dm/~zod/writs] writ-response-1+!>(old-response-4))
        (ex-fact ~[/v2 /v2/dm/~zod /v2/dm/~zod/writs] writ-response-2+!>(old-response-5))
        (ex-fact ~[/v3 /v3/dm/~zod /v3/dm/~zod/writs] writ-response-3+!>([whom response]))
    ==
  ;<  *  bind:m  (wait ~s1)
  ;<  bw=bowl  bind:m  get-bowl
  =/  =unread:unreads:c  [(sub now.bw ~s1) 0 ~ ~]
  :: ~&  'marked read and notification cleared'
  ;<  caz=(list card)  bind:m  (do-poke %chat-remark-action !>([[%ship ~zod] %read ~]))
  %+  ex-cards  caz
  :~  (ex-fact ~[/unreads] %chat-unread-update !>([whom unread]))
  ==
++  scries
  |=  =path
  ^-  (unit vase)
  ?+    path  ~
    [%gu @ %activity @ %$ ~]         `!>(&)
    [%gu @ %groups @ *]           `!>(&)
    [%gx @ %groups @ %volume *]   `!>(%soft)
  ::
      [%gx @ %chat-test @ %~.~ %negotiate %status %~.~zod %chat-test *]
    `!>(%match)
  ==
++  dm-message
  |=  [author=ship =time =verse:ch]
  ^-  diff:dm:c
  =/  =essay:c
    [[~[verse] ~zod time] chat+/ ~ ~]
  [[author time] %add essay `time]
--
