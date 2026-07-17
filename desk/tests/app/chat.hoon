/-  c=chat, cv=chat-ver, ch=channels, contacts, activity
/+  *test-agent, cc=chat-conv
/=  agent  /app/chat
|%
++  dap  %chat-test
::  ~doznec-sampel-palnet is a real moon sponsored by ~sampel-palnet.
++  moon  ~doznec-sampel-palnet
++  owner  ~sampel-palnet
::  a dm-message with a correctly-authored essay (unlike +dm-message,
::  which hardcodes ~zod as the author)
++  vouched-message
  |=  [author=ship =time =verse:ch]
  ^-  diff:dm:c
  [[author time] %add [[~[verse] author time] chat+/ ~ ~] `time]
::  the five writ-response facts +di-give-writs-diff emits for an %add
++  ex-writ-facts
  |=  [author=ship =time =verse:ch seq=@ud]
  ^-  (list $-(card tang))
  =/  =whom:c  [%ship moon]
  =/  =essay:c  [[~[verse] author time] chat+/ ~ ~]
  =/  =response:writs:c  [[author time] %add essay seq time]
  =/  old-response-3=[whom:v3:cv response:writs:v3:cv]
    :-  whom
    %-  v3:response-writs:v5:cc
    (v5:response-writs:v7:cc response)
  =/  old-response-4=[whom:v4:cv response:writs:v4:cv]
    [whom (v4:response-writs:v7:cc response)]
  =/  old-response-5=[whom:v5:cv response:writs:v5:cv]
    [whom (v5:response-writs:v7:cc response)]
  =/  old-response-6=[whom:c response:writs:v6:cv]
    [whom (v6:response-writs:v7:cc response)]
  =/  mp=@ta  (scot %p moon)
  :~  (ex-fact ~[/ /dm/[mp] /dm/[mp]/writs] writ-response+!>(old-response-3))
      (ex-fact ~[/v1 /v1/dm/[mp] /v1/dm/[mp]/writs] writ-response-1+!>(old-response-4))
      (ex-fact ~[/v2 /v2/dm/[mp] /v2/dm/[mp]/writs] writ-response-2+!>(old-response-5))
      (ex-fact ~[/v3 /v3/dm/[mp] /v3/dm/[mp]/writs] writ-response-3+!>(old-response-6))
      (ex-fact ~[/v4 /v4/dm/[mp] /v4/dm/[mp]/writs] writ-response-4+!>([whom response]))
  ==
::  the single writ-response fact +di-give-writs-diff emits for a bot dm we
::  host: on the moon's per-identity firehose, keyed by the counterparty
++  ex-bot-fact
  |=  [bot=ship who=ship author=ship =time =verse:ch seq=@ud]
  ^-  $-(card tang)
  =/  =whom:c  [%ship who]
  =/  =essay:c  [[~[verse] author time] chat+/ ~ ~]
  =/  =response:writs:c  [[author time] %add essay seq time]
  (ex-fact ~[/v4/vouched/(scot %p bot)] writ-response-4+!>([whom response]))
::  the writ +di-ingest-diff stores for a bot dm we host, as it appears from a
::  newest/1 paged scry of the bot's inbox
++  bot-inbox-newest
  |=  [author=ship =time =verse:ch]
  ^-  paged-writs:v7:cv
  =/  =writ:c
    :-  [[author time] 1 time ~ ~ [0 ~ ~]]
    [[~[verse] author time] chat+/ ~ ~]
  =/  =writs:c  (gas:on:writs:c *writs:c ~[[time &+writ]])
  [writs ~ ~ 1 1]
::  a human DMs a bot moon: the conversation is a normal dm keyed by the
::  moon (normal facts), with delivery routed to the moon's host. a
::  follow-up send through the plain dm-action path routes the same way.
++  test-vouched-dm-human-send
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap agent)
  ;<  *  bind:m  (set-scry-gate scries)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~bus, src ~bus)))
  ;<  bw=bowl  bind:m  get-bowl
  =/  =verse:ch  [%inline ~['hi bot']]
  =/  =diff:dm:c  (vouched-message ~bus now.bw verse)
  ;<  caz=(list card)  bind:m
    %+  do-poke  %chat-dm-vouched-action-2
    !>(`vouched-action:dm:c`[moon moon diff])
  ;<  ~  bind:m
    %+  ex-cards  caz
    %+  welp  (ex-writ-facts ~bus now.bw verse 1)
    :~  %+  ex-poke  /dm/(scot %p moon)/proxy/diff
        [[owner dap] chat-dm-vouched-diff-2+!>(`vouched-diff:dm:c`[moon diff])]
    ==
  ::  a second message through the PLAIN dm path still routes to the host
  ::
  ;<  *  bind:m  (wait ~s1)
  ;<  bw=bowl  bind:m  get-bowl
  =/  diff-2=diff:dm:c  (vouched-message ~bus now.bw verse)
  ;<  caz=(list card)  bind:m
    (do-poke %chat-dm-action-2 !>(`action:dm:c`[moon diff-2]))
  =/  =whom:c  [%ship moon]
  %+  ex-cards  caz
  %+  welp
    ::  recency moved, so this send updates the unread summary
    :~  (ex-fact ~[/unreads] %chat-unread-update !>([whom [now.bw 0 ~ ~]]))
    ==
  %+  welp  (ex-writ-facts ~bus now.bw verse 2)
  :~  %+  ex-poke  /dm/(scot %p moon)/proxy/diff
      [[owner dap] chat-dm-vouched-diff-2+!>(`vouched-diff:dm:c`[moon diff-2])]
  ==
::  the moon's OWN host can also DM its bot as a human: even though we
::  sponsor the moon, a message addressed to the moon itself is stored as a
::  normal dm and routed to the host (ourselves), not mistaken for a relay.
++  test-vouched-dm-host-self-send
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap agent)
  ;<  *  bind:m  (set-scry-gate scries)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our owner, src owner)))
  ;<  bw=bowl  bind:m  get-bowl
  =/  =verse:ch  [%inline ~['hi my own bot']]
  =/  =diff:dm:c  (vouched-message owner now.bw verse)
  ;<  caz=(list card)  bind:m
    %+  do-poke  %chat-dm-vouched-action-2
    !>(`vouched-action:dm:c`[moon moon diff])
  %+  ex-cards  caz
  %+  welp  (ex-writ-facts owner now.bw verse 1)
  :~  %+  ex-poke  /dm/(scot %p moon)/proxy/diff
      [[owner dap] chat-dm-vouched-diff-2+!>(`vouched-diff:dm:c`[moon diff])]
  ==
::  the host relays its bot's outbound message to the human AND stores it in
::  the bot's own inbox (keyed by [moon, human]), giving it on the moon's
::  firehose; the stored writ is scryable by the bot runner.
++  test-vouched-dm-host-relay-outbound
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap agent)
  ;<  *  bind:m  (set-scry-gate scries)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our owner, src owner)))
  ;<  bw=bowl  bind:m  get-bowl
  =/  =verse:ch  [%inline ~['hi from bot']]
  =/  =diff:dm:c  (vouched-message moon now.bw verse)
  ;<  caz=(list card)  bind:m
    %+  do-poke  %chat-dm-vouched-action-2
    !>(`vouched-action:dm:c`[moon ~bus diff])
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  %+  ex-poke  /vouched-dm/(scot %p moon)/(scot %p ~bus)
        [[~bus dap] chat-dm-vouched-diff-2+!>(`vouched-diff:dm:c`[moon diff])]
        (ex-bot-fact moon ~bus moon now.bw verse 1)
    ==
  %+  ex-scry-result
    /x/v4/vouched/(scot %p moon)/dm/(scot %p ~bus)/writs/newest/(scot %ud 1)/light
  !>((bot-inbox-newest moon now.bw verse))
::  the host stores an inbound vouched dm in the bot's inbox (keyed by
::  [moon, human]) and gives it on the moon's firehose; the stored writ is
::  scryable by the bot runner. (also mirrored on the legacy /vouched-dm
::  stream during the transition.)
++  test-vouched-dm-host-relay-inbound
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap agent)
  ;<  *  bind:m  (set-scry-gate scries)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our owner, src ~bus)))
  ;<  bw=bowl  bind:m  get-bowl
  =/  =verse:ch  [%inline ~['hi bot']]
  =/  =diff:dm:c  (vouched-message ~bus now.bw verse)
  ;<  caz=(list card)  bind:m
    %+  do-poke  %chat-dm-vouched-diff-2
    !>(`vouched-diff:dm:c`[moon diff])
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  %^    ex-fact
          ~[/vouched-dm]
        %chat-dm-vouched-diff-2
      !>(`vouched-diff:dm:c`[moon diff])
        (ex-bot-fact moon ~bus ~bus now.bw verse 1)
    ==
  %+  ex-scry-result
    /x/v4/vouched/(scot %p moon)/dm/(scot %p ~bus)/writs/newest/(scot %ud 1)/light
  !>((bot-inbox-newest ~bus now.bw verse))
::  a bot-initiated dm arrives as a normal dm invite keyed by the moon
++  test-vouched-dm-human-receive
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap agent)
  ;<  *  bind:m  (set-scry-gate scries)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~bus, src owner)))
  ;<  bw=bowl  bind:m  get-bowl
  =/  =verse:ch  [%inline ~['hi human']]
  =/  =diff:dm:c  (vouched-message moon now.bw verse)
  ;<  caz=(list card)  bind:m
    %+  do-poke  %chat-dm-vouched-diff-2
    !>(`vouched-diff:dm:c`[moon diff])
  =/  invite-action=action:activity  [%add %dm-invite [%ship moon]]
  %+  ex-cards  caz
  %+  welp
    :~  (ex-poke /activity/submit [~bus %activity] activity-action-1+!>(invite-action))
        (ex-fact ~[/ /dm/invited /v1 /v2 /v3] ships+!>(`(set ship)`(silt ~[moon])))
    ==
  (ex-writ-facts moon now.bw verse 1)
::  a vouched diff from a ship that does not sponsor the moon is rejected
++  test-vouched-dm-rejects-unvouched
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap agent)
  ;<  *  bind:m  (set-scry-gate scries)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~bus, src ~ten)))
  ;<  bw=bowl  bind:m  get-bowl
  =/  =diff:dm:c  (vouched-message moon now.bw [%inline ~['spoof']])
  %-  ex-fail
  (do-poke %chat-dm-vouched-diff-2 !>(`vouched-diff:dm:c`[moon diff]))
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
  ;<  *  bind:m  (do-poke %chat-dm-diff-2 !>(diff))
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
  ;<  caz=(list card)  bind:m  (do-poke %chat-dm-diff-2 !>(diff))
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
    (v5:response-writs:v7:cc response)
  =/  old-response-4=[whom:v4:cv response:writs:v4:cv]
    [whom (v4:response-writs:v7:cc response)]
  =/  old-response-5=[whom:v5:cv response:writs:v5:cv]
    [whom (v5:response-writs:v7:cc response)]
  =/  old-response-6=[whom:v6:cv response:writs:v6:cv]
    [whom (v6:response-writs:v7:cc response)]
  =/  activity-action=action:activity
    [%add %dm-post [[~zod now.bw] now.bw] [%ship ~zod] ~[verse] &]
  ;<  *  bind:m  (ex-scry-result /x/unreads !>(unreads))
  :: ~&  'have unreads'
  ;<  *  bind:m
    %+  ex-cards  caz
    :~  (ex-poke /contacts/~zod [~dev %contacts] contact-action-1+!>([%meet ~[~zod]]))
        (ex-fact ~[/unreads] %chat-unread-update !>([whom unread]))
        (ex-poke /activity/submit [~dev %activity] activity-action-1+!>(activity-action))
        (ex-fact ~[/ /dm/~zod /dm/~zod/writs] writ-response+!>(old-response-3))
        (ex-fact ~[/v1 /v1/dm/~zod /v1/dm/~zod/writs] writ-response-1+!>(old-response-4))
        (ex-fact ~[/v2 /v2/dm/~zod /v2/dm/~zod/writs] writ-response-2+!>(old-response-5))
        (ex-fact ~[/v3 /v3/dm/~zod /v3/dm/~zod/writs] writ-response-3+!>(old-response-6))
        (ex-fact ~[/v4 /v4/dm/~zod /v4/dm/~zod/writs] writ-response-4+!>([whom response]))
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
