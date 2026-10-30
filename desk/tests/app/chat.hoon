/-  c=chat, cv=chat-ver, ch=channels, contacts, av=activity-ver, meta
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
  =/  activity-action=action:v9:av
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
  ;<  *  bind:m  (set-src ~dev)
  ;<  caz=(list card)  bind:m  (do-poke %chat-remark-action !>([[%ship ~zod] %read ~]))
  %+  ex-cards  caz
  :~  (ex-fact ~[/unreads] %chat-unread-update !>([whom unread]))
  ==
::  a dm we start ourselves (as %grouper does for the reciprocal dm when
::  a personal invite is redeemed) never touches /dm/invited, so the only
::  way a /v4 subscriber learns the dm exists is the %chat-dm-status fact.
::
++  test-dm-status-facts-for-dm-we-start
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap agent)
  ;<  *  bind:m  (set-scry-gate scries)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~dev, src ~dev)))
  ;<  bw=bowl  bind:m  get-bowl
  =/  =verse:ch  [%inline ~['hi']]
  ::  we start the dm: it's %inviting until ~zod accepts
  =/  =action:dm:c  [~zod (dm-message-from ~dev now.bw verse)]
  ;<  caz=(list card)  bind:m  (do-poke %chat-dm-action-2 !>(action))
  ;<  *  bind:m  (ex-dm-status caz [~zod `%inviting] ~)
  ::  ~zod accepts
  ;<  *  bind:m  (set-src ~zod)
  ;<  caz=(list card)  bind:m  (do-poke %chat-dm-rsvp !>([~zod &]))
  ;<  *  bind:m  (ex-dm-status caz [~zod `%done] ~)
  ::  a message in an existing dm doesn't re-announce it
  ;<  *  bind:m  (wait ~s1)
  ;<  bw=bowl  bind:m  get-bowl
  =/  =diff:dm:c  (dm-message ~zod now.bw verse)
  ;<  caz=(list card)  bind:m  (do-poke %chat-dm-diff-2 !>(diff))
  ;<  *  bind:m  (ex-dm-status caz ~)
  ::  we archive it
  ;<  *  bind:m  (set-src ~dev)
  ;<  caz=(list card)  bind:m  (do-poke %chat-dm-archive !>(~zod))
  (ex-dm-status caz [~zod `%archive] ~)
::
++  test-dm-status-facts-for-dm-we-receive
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap agent)
  ;<  *  bind:m  (set-scry-gate scries)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~dev, src ~zod)))
  ;<  bw=bowl  bind:m  get-bowl
  =/  =verse:ch  [%inline ~['hi']]
  ::  ~zod starts a dm with us: it's a pending invite
  =/  =diff:dm:c  (dm-message ~zod now.bw verse)
  ;<  caz=(list card)  bind:m  (do-poke %chat-dm-diff-2 !>(diff))
  ;<  *  bind:m  (ex-dm-status caz [~zod `%invited] ~)
  ::  we decline: the dm is gone
  ;<  *  bind:m  (set-src ~dev)
  ;<  caz=(list card)  bind:m  (do-poke %chat-dm-rsvp !>([~zod |]))
  ;<  *  bind:m  (ex-dm-status caz [~zod ~] ~)
  ::  ~zod tries again and this time we accept
  ;<  *  bind:m  (set-src ~zod)
  ;<  *  bind:m  (wait ~s1)
  ;<  bw=bowl  bind:m  get-bowl
  =/  =diff:dm:c  (dm-message ~zod now.bw verse)
  ;<  caz=(list card)  bind:m  (do-poke %chat-dm-diff-2 !>(diff))
  ;<  *  bind:m  (ex-dm-status caz [~zod `%invited] ~)
  ;<  *  bind:m  (set-src ~dev)
  ;<  caz=(list card)  bind:m  (do-poke %chat-dm-rsvp !>([~zod &]))
  (ex-dm-status caz [~zod `%done] ~)
::  each subscription path gets club actions with the mark it declares. the
::  client watches /v4, and waits there for the %meta action of a rename.
::
++  test-club-action-facts
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap agent)
  ;<  *  bind:m  (set-scry-gate scries)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~dev, src ~dev)))
  =/  =create:club:c  [0v1 (sy ~zod ~)]
  ;<  caz=(list card)  bind:m  (do-poke %chat-club-create !>(create))
  =/  marks=(list mark)
    ~[%chat-club-action %chat-club-action-1 %chat-club-action-2]
  =/  facts=(list [(list path) mark])
    %+  murn  caz
    |=  =card
    ?.  ?=([%give %fact *] card)  ~
    ?~  (find ~[p.cage.p.card] marks)  ~
    `[paths p.cage]:p.card
  =/  exes=(list [(list path) mark])
    :~  [~[/ /clubs] %chat-club-action]
        [~[/v1 /v1/clubs /v2 /v2/clubs] %chat-club-action-1]
        [~[/v3 /v3/clubs] %chat-club-action-1]
        [~[/v4 /v4/clubs] %chat-club-action-2]
    ==
  (ex-equal !>(facts) !>(exes))
::  club actions are gossiped, so we take them from any member of the
::  club, whoever wrote them, but never from a ship outside it.
::
++  test-club-writ-from-non-member
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap agent)
  ;<  *  bind:m  (set-scry-gate scries)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~dev, src ~dev)))
  =/  =create:club:c  [0v1 (sy ~zod ~)]
  ;<  *  bind:m  (do-poke %chat-club-create !>(create))
  ;<  bw=bowl  bind:m  get-bowl
  =/  =verse:ch  [%inline ~['hi']]
  ::  ~bus is not in the club
  ;<  *  bind:m  (set-src ~bus)
  =/  =action:club:c  [0v1 0v10 %writ (dm-message-from ~bus now.bw verse)]
  ;<  *  bind:m  (ex-fail (do-poke %chat-club-action-2 !>(action)))
  ::  ~zod is invited, so it may post
  ;<  *  bind:m  (set-src ~zod)
  =/  =action:club:c  [0v1 0v11 %writ (dm-message-from ~zod now.bw verse)]
  ;<  caz=(list card)  bind:m  (do-poke %chat-club-action-2 !>(action))
  ;<  *  bind:m  (ex-post caz [~zod now.bw] ~[verse])
  ::  and forward a message we created
  =/  =action:club:c
    [0v1 0v12 %writ (dm-message-from ~dev (add now.bw ~s1) verse)]
  ;<  caz=(list card)  bind:m  (do-poke %chat-club-action-2 !>(action))
  (ex-post caz [~dev (add now.bw ~s1)] ~[verse])
::  we only learn of a club through an %init that invites us, sent by a
::  ship in the club.
::
++  test-club-init-from-non-member
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap agent)
  ;<  *  bind:m  (set-scry-gate scries)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~dev, src ~bus)))
  ;<  bw=bowl  bind:m  get-bowl
  =/  =verse:ch  [%inline ~['hi']]
  =/  init=action:club:c  [0v2 0v10 %init (sy ~zod ~) (sy ~dev ~) *data:meta]
  ::  ~bus is not in the club it claims to invite us to
  ;<  *  bind:m  (ex-fail (do-poke %chat-club-action-2 !>(init)))
  ::  ~zod can't invite only others
  ;<  *  bind:m  (set-src ~zod)
  =/  other=action:club:c  [0v2 0v11 %init (sy ~zod ~) (sy ~nec ~) *data:meta]
  ;<  *  bind:m  (ex-fail (do-poke %chat-club-action-2 !>(other)))
  ::  nor post to a club we don't know yet
  =/  =action:club:c  [0v2 0v12 %writ (dm-message-from ~zod now.bw verse)]
  ;<  *  bind:m  (ex-fail (do-poke %chat-club-action-2 !>(action)))
  ::  once ~zod invites us, it can post
  ;<  *  bind:m  (do-poke %chat-club-action-2 !>(init))
  ;<  caz=(list card)  bind:m  (do-poke %chat-club-action-2 !>(action))
  (ex-post caz [~zod now.bw] ~[verse])
::  we may hold a club entry with no crew yet, left by an action that
::  reached us before the club's %init. that %init must still get in.
::
++  test-club-init-for-empty-entry
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap agent)
  ;<  *  bind:m  (set-scry-gate scries)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~dev, src ~dev)))
  ;<  bw=bowl  bind:m  get-bowl
  =/  =verse:ch  [%inline ~['hi']]
  ::  a writ for a club we don't know leaves an entry with an empty crew
  =/  =action:club:c  [0v3 0v10 %writ (dm-message-from ~dev now.bw verse)]
  ;<  *  bind:m  (do-poke %chat-club-action-2 !>(action))
  ;<  peek=(unit (unit cage))  bind:m  (get-peek /x/clubs)
  =/  clubs  ;;((map id:club:c *) q.q:(need (need peek)))
  ;<  *  bind:m  (ex-equal !>((~(has by clubs) 0v3)) !>(&))
  ::  ~bus still can't post there
  ;<  *  bind:m  (set-src ~bus)
  =/  =action:club:c  [0v3 0v11 %writ (dm-message-from ~bus now.bw verse)]
  ;<  *  bind:m  (ex-fail (do-poke %chat-club-action-2 !>(action)))
  ::  but ~zod's %init gets in, and then ~zod can post
  ;<  *  bind:m  (set-src ~zod)
  =/  init=action:club:c  [0v3 0v12 %init (sy ~zod ~) (sy ~dev ~) *data:meta]
  ;<  *  bind:m  (do-poke %chat-club-action-2 !>(init))
  =/  =action:club:c  [0v3 0v13 %writ (dm-message-from ~zod now.bw verse)]
  ;<  caz=(list card)  bind:m  (do-poke %chat-club-action-2 !>(action))
  (ex-post caz [~zod now.bw] ~[verse])
::  creating clubs and marking chats read are for our own client only
::
++  test-club-create-from-self-only
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap agent)
  ;<  *  bind:m  (set-scry-gate scries)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~dev, src ~dev)))
  =/  =create:club:c  [0v1 (sy ~zod ~)]
  ;<  *  bind:m  (do-poke %chat-club-create !>(create))
  ::  ~bus can't recreate it with itself in it
  ;<  *  bind:m  (set-src ~bus)
  =/  =create:club:c  [0v1 (sy ~bus ~)]
  ;<  *  bind:m  (ex-fail (do-poke %chat-club-create !>(create)))
  ;<  peek=(unit (unit cage))  bind:m  (get-peek /x/clubs)
  =/  clubs  ;;((map id:club:c crew:club:c) q.q:(need (need peek)))
  =/  =crew:club:c  (~(got by clubs) 0v1)
  (ex-equal !>([team hive]:crew) !>([(sy ~dev ~) (sy ~zod ~)]))
::
++  test-remark-action-from-self-only
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap agent)
  ;<  *  bind:m  (set-scry-gate scries)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~dev, src ~dev)))
  =/  =create:club:c  [0v1 (sy ~zod ~)]
  ;<  *  bind:m  (do-poke %chat-club-create !>(create))
  =/  act=remark-action:c  [[%club 0v1] %read ~]
  ;<  *  bind:m  (set-src ~bus)
  ;<  *  bind:m  (ex-fail (do-poke %chat-remark-action !>(act)))
  ;<  *  bind:m  (set-src ~dev)
  ;<  *  bind:m  (do-poke %chat-remark-action !>(act))
  (pure:m ~)
::  a dm partner can only send us its own messages and reactions
::
++  test-dm-diff-author
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap agent)
  ;<  *  bind:m  (set-scry-gate scries)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~dev, src ~zod)))
  ;<  bw=bowl  bind:m  get-bowl
  =/  =verse:ch  [%inline ~['hi']]
  ::  ~zod can't post as ~bus
  =/  =diff:dm:c  (dm-message-from ~bus now.bw verse)
  ;<  *  bind:m  (ex-fail (do-poke %chat-dm-diff-2 !>(diff)))
  ::  not even under its own message id
  =/  =essay:c  [[~[verse] ~bus now.bw] chat+/ ~ ~]
  =/  =diff:dm:c  [[~zod now.bw] %add essay ~]
  ;<  *  bind:m  (ex-fail (do-poke %chat-dm-diff-2 !>(diff)))
  ::  its own message goes through
  =/  =diff:dm:c  (dm-message-from ~zod now.bw verse)
  ;<  caz=(list card)  bind:m  (do-poke %chat-dm-diff-2 !>(diff))
  ;<  *  bind:m  (ex-post caz [~zod now.bw] ~[verse])
  ::  ~zod can't react as ~bus, but can react as itself
  =/  =diff:dm:c  [[~zod now.bw] %add-react ~bus 'x']
  ;<  *  bind:m  (ex-fail (do-poke %chat-dm-diff-2 !>(diff)))
  =/  =diff:dm:c  [[~zod now.bw] %add-react ~zod 'x']
  ;<  caz=(list card)  bind:m  (do-poke %chat-dm-diff-2 !>(diff))
  %^  ex-response  caz  [~zod now.bw]
  |=(d=response-delta:writs:c =(d [%add-react ~zod 'x']))
::  a reply's parent may be ours: the reply id is what names the sender
::
++  test-dm-reply-author
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap agent)
  ;<  *  bind:m  (set-scry-gate scries)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~dev, src ~dev)))
  ;<  bw=bowl  bind:m  get-bowl
  =/  =verse:ch  [%inline ~['hi']]
  =/  top=@da  now.bw
  =/  =action:dm:c  [~zod (dm-message-from ~dev top verse)]
  ;<  *  bind:m  (do-poke %chat-dm-action-2 !>(action))
  ;<  *  bind:m  (set-src ~zod)
  ;<  *  bind:m  (wait ~s1)
  ;<  bw=bowl  bind:m  get-bowl
  ::  ~zod can't delete our message, or our reaction to it
  =/  =diff:dm:c  [[~dev top] %del ~]
  ;<  *  bind:m  (ex-fail (do-poke %chat-dm-diff-2 !>(diff)))
  =/  =diff:dm:c  [[~dev top] %del-react ~dev]
  ;<  *  bind:m  (ex-fail (do-poke %chat-dm-diff-2 !>(diff)))
  ::  nor a reply that isn't its own
  =/  =diff:dm:c  [[~dev top] %reply [~dev now.bw] ~ %del ~]
  ;<  *  bind:m  (ex-fail (do-poke %chat-dm-diff-2 !>(diff)))
  ::  ~zod can't reply as ~bus
  =/  =diff:dm:c
    [[~dev top] %reply [~bus now.bw] ~ %add [[~[verse] ~bus now.bw] ~] ~]
  ;<  *  bind:m  (ex-fail (do-poke %chat-dm-diff-2 !>(diff)))
  ::  not even under its own reply id
  =/  =diff:dm:c
    [[~dev top] %reply [~zod now.bw] ~ %add [[~[verse] ~bus now.bw] ~] ~]
  ;<  *  bind:m  (ex-fail (do-poke %chat-dm-diff-2 !>(diff)))
  ::  but can reply to our message as itself
  =/  =diff:dm:c
    [[~dev top] %reply [~zod now.bw] ~ %add [[~[verse] ~zod now.bw] ~] ~]
  ;<  caz=(list card)  bind:m  (do-poke %chat-dm-diff-2 !>(diff))
  %^  ex-response  caz  [~dev top]
  |=  d=response-delta:writs:c
  ?&  ?=([%reply * * %add *] d)
      =([~zod now.bw] id.d)
      =(~[verse] content.reply-essay.delta.d)
      =(~zod author.reply-essay.delta.d)
  ==
::  +ex-response: .caz gives a %writ-response-4 for .id that .ok accepts
::
++  ex-response
  |=  [caz=(list card) =id:c ok=$-(response-delta:writs:c ?)]
  =/  m  (mare ,~)
  ^-  form:m
  %+  ex-equal
    !>  %+  lien  caz
        |=  =card
        ?.  ?=([%give %fact * %writ-response-4 *] card)  |
        =+  !<([=whom:c =response:writs:c] q.cage.p.card)
        &(=(id id.response) (ok response.response))
  !>(&)
::  +ex-post: .caz gives the top-level post .id with .content
::
++  ex-post
  |=  [caz=(list card) =id:c content=story:ch]
  %^  ex-response  caz  id
  |=  d=response-delta:writs:c
  &(?=(%add -.d) =(content content.essay.d) =(p.id author.essay.d))
::  +ex-dm-status: the %chat-dm-status facts in .caz are exactly .exes
::
++  ex-dm-status
  |=  [caz=(list card) exes=(list status:dm:c)]
  =/  m  (mare ,~)
  ^-  form:m
  %+  ex-cards
    %+  skim  caz
    |=(=card ?=([%give %fact * %chat-dm-status *] card))
  %+  turn  exes
  |=  =status:dm:c
  (ex-fact ~[/v4] %chat-dm-status !>(status))
::
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
::  +dm-message-from: like +dm-message, but .author also writes the essay
::
++  dm-message-from
  |=  [author=ship =time =verse:ch]
  ^-  diff:dm:c
  =/  =essay:c
    [[~[verse] author time] chat+/ ~ ~]
  [[author time] %add essay ~]
--
