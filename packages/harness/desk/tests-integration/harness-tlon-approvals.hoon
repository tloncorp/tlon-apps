::  Approval requests: a ship without access that writes to the bot opens
::  one request per place, and the owner is sent one card for it. Full
::  adapter, synthetic scries only; no emitted cards are executed.
::  -test /=harness=/tests-integration/harness-tlon-approvals
/-  t=harness-tlon, ad=harness-adapter, h=harness, g=groups-ver,
    a=activity-ver, hh=harness-hand, dv=channels-ver, cv=chat-ver
/+  *test-agent, policy-lib=harness-tlon-policy, hj=harness-json,
    story=harness-tlon-story, ht=harness-tools
/=  adapter  /app/harness-tlon
|%
++  room-nest  `nest:dv`[%chat ~lux %test]
++  off-nest  `nest:dv`[%chat ~lux %quiet]
++  open-nest  `nest:dv`[%chat ~lux %open]
++  all-nest  `nest:dv`[%chat ~lux %busy]
++  left-nest  `nest:dv`[%chat ~lux %gone]
++  start  ~2026.9.10
++  later  ~2026.9.10..00.10.00
::  ~nec owns the bot; ~bus holds its DM. ~dev and ~bel have no access, and
::  the bot blocks ~bel.
::
++  fixture
  ^-  state-5:t
  =/  s=state-5:t  *state-5:t
  =.  owner-initialized.s  1
  =.  activity-through.s  ~2026.9.9
  =.  policy.s
    :*  &  `~nec  ~  %mentions  ~
        %-  my
        :~  [room-nest [%mentions |]]
            [off-nest [%off |]]
            [open-nest [%mentions &]]
            [all-nest [%all |]]
        ==
        (silt ~[~bus])
        ~
    ==
  s
++  room-group
  ^-  group:v9:g
  =/  group  *group:v9:g
  =.  seats.group
    %-  malt
    %+  turn  `(list @p)`~[~bus ~dev ~bel]
    |=(who=@p [who `seat:v9:g`[~ ~2026.9.9]])
  =/  room  *channel:v9:g
  =.  title.meta.room  'Room'
  =.  title.meta.group  'Lux group'
  %=  group
    channels
      %-  my
      :~  [room-nest room]
          [off-nest *channel:v9:g]
          [open-nest *channel:v9:g]
          [all-nest *channel:v9:g]
      ==
  ==
++  head-connected
  %-  jab-bowl
  |=  b=bowl
  b(wex (~(put by wex.b) [/head ~zod %harness] [& /hand-events]))
++  mention
  |=  [who=@p nest=nest:dv at=@da]
  ^-  incoming-event:v8:a
  [%post [[who at] at] nest [~lux %test] ~[[%inline ~['hello there']]] &]
++  unmentioned
  |=  [who=@p nest=nest:dv at=@da]
  ^-  incoming-event:v8:a
  [%post [[who at] at] nest [~lux %test] ~[[%inline ~['just chatting']]] |]
::  A reply in the thread of the bot's own post, which addresses the bot.
::
++  reply
  |=  [who=@p nest=nest:dv at=@da]
  ^-  incoming-event:v8:a
  =/  parent  ~2026.9.9..10.00.00
  [%reply [[who at] at] [[~zod parent] parent] nest [~lux %test] ~[[%inline ~['and also']]] |]
++  dm
  |=  [who=@p at=@da]
  ^-  incoming-event:v8:a
  [%dm-post [[who at] at] [%ship who] ~[[%inline ~['hello from a stranger']]] |]
::  ~dev's pending invitation, as local %chat holds it
::
++  invited
  ^-  paged-writs:v7:cv
  =/  w  *writ:v7:cv
  =/  at  ~2026.9.9..12.00.00
  =/  =writ:v7:cv
    [-.w(id [~dev at], time at) +.w(content ~[[%inline ~['may I ask you something?']]], author ~dev, sent at)]
  :_  [~ ~ 0 0]
  (gas:on:writs:v7:cv ~ ~[[at %& writ]])
++  stream
  |=  events=(list [at=@da event=incoming-event:v8:a])
  ^-  stream:v10:a
  %+  roll  events
  |=  [[at=@da event=incoming-event:v8:a] =stream:v10:a]
  (put:on-stream:v10:a stream at [event | |])
++  scries
  |=  events=stream:v10:a
  |=  =path
  ^-  (unit vase)
  ?:  ?=([%gu @ %contacts @ %$ ~] path)  `!>(|)
  ?:  ?=([%gu @ %groups @ %$ ~] path)  `!>(&)
  ::  The bot is in .room-nest and .off-nest, and of the DMs only ~dev's is
  ::  on the ship.
  ?:  ?=([%gu @ %channels @ %v4 %chat %'~lux' %test ~] path)  `!>(&)
  ?:  ?=([%gu @ %channels @ %v4 %chat %'~lux' %quiet ~] path)  `!>(&)
  ?:  ?=([%gu @ %chat @ %dm %'~dev' ~] path)  `!>(&)
  ?:  ?=([%gu @ %chat @ %dm @ ~] path)  `!>(|)
  ?:  (lien path |=(part=@ta =(%can-read part)))  `!>(|=([who=@p *] &))
  ?:  (lien path |=(part=@ta =(%groups part)))  `!>((my ~[[[~lux %test] room-group]]))
  ?:  (lien path |=(part=@ta =(%cron-session part)))  `!>(~)
  ?:  ?=([%gu @ %channels @ %v4 *] path)  `!>(|)
  ?:  =(%$ (rear path))  `!>(&)
  ?:  ?=([%gx @ %chat @ %dm %invited %ships ~] path)  `!>(~)
  ?:  ?=([%gx @ %chat @ %blocked %ships ~] path)  `!>((silt ~[~bel]))
  ?:  ?=([%gx @ %chat @ %v4 %dm %'~dev' %writs %newest *] path)  `!>(invited)
  ?:  ?=([%gx @ %activity @ %v6 %all %noun ~] path)  `!>(events)
  ?:  (lien path |=(part=@ta =(%hand-state part)))  `!>(*state:hh)
  ?:  ?=([%gx @ %harness @ %sessions %json ~] path)  `!>(`json`[%a ~])
  ?:  ?=([%gx @ %harness @ %defaults %json ~] path)
    `!>((config-json:hj %*(. *config:h tools ~[%web])))
  ~
++  boot
  |=  [saved=state-5:t now=@da events=stream:v10:a]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (set-bowl %*(. *bowl our ~zod, src ~zod, now now, eny (shax 'approvals')))
  ;<  ~  bind:m  head-connected
  ;<  ~  bind:m  (set-scry-gate (scries events))
  ;<  *  bind:m  (do-load adapter `!>(saved))
  head-connected
::  Load .saved at .now, then deliver .events through Activity catch-up.
::
++  admit
  |=  [saved=state-5:t now=@da events=(list [@da incoming-event:v8:a])]
  =/  m  (mare ,[(list card) state-5:t])
  ^-  form:m
  ;<  ~  bind:m  (boot saved now (stream events))
  ;<  caz=(list card)  bind:m  (do-agent /activity [~zod %activity] [%watch-ack ~])
  ;<  =vase  bind:m  get-save
  (pure:m caz !<(state-5:t vase))
::  Load .saved, then save .next through the policy endpoint.
::
++  configure
  |=  [saved=state-5:t next=policy:t]
  =/  m  (mare ,[(list card) state-5:t])
  ^-  form:m
  ;<  ~  bind:m  (boot saved later *stream:v10:a)
  ;<  caz=(list card)  bind:m
    %+  do-poke  %noun
    !>(`request:ad`['fixture' [%n '1'] 'harness/tlon/configure' `(policy-json:policy-lib next)])
  ;<  =vase  bind:m  get-save
  (pure:m caz !<(state-5:t vase))
::  Load .saved, then hear from %channels that the bot left .nest.
::
++  leave
  |=  [saved=state-5:t nest=nest:dv]
  =/  m  (mare ,state-5:t)
  ^-  form:m
  ;<  ~  bind:m  (boot saved later *stream:v10:a)
  ;<  *  bind:m
    %^  do-agent  /publications  [~zod %channels]
    [%fact %channel-response-4 !>(`r-channels:v9:dv`[nest %leave ~])]
  ;<  =vase  bind:m  get-save
  (pure:m !<(state-5:t vase))
::  The cards sent: to whom, their text and their blob.
::
++  sent
  |=  caz=(list card)
  ^-  (list [to=@p text=@t blob=@t])
  %+  murn  caz
  |=  c=card
  ?.  ?=([%pass [%approval @ @ ~] %agent [@ %chat] %poke *] c)  ~
  =/  act  !<(action:dm:v7:cv q.cage.task.q.c)
  ?>  ?=(%add -.q.q.act)
  `[p.act (story-to-text:story content.essay.q.q.act) (need blob.essay.q.q.act)]
::  Open requests by ship and place.
::
++  open
  |=  s=state-5:t
  ^-  (set [@p place:t])
  ~(key by by-place.approvals.s)
++  places
  |=  places=(list [@p place:t])
  ^-  (set [@p place:t])
  (silt places)
++  requested
  |=  [s=state-5:t who=@p =place:t]
  ^-  @t
  (~(got by by-place.approvals.s) [who place])
++  kinds
  |=  [s=state-5:t kind=@t]
  ^-  @ud
  (lent (skim notices.s |=(n=notice:t =(kind kind.n))))
++  dig
  |=  [=json keys=(list @t)]
  ^-  ^json
  ?~  keys  json
  ?>  ?=(%o -.json)
  $(json (~(got by p.json) i.keys), keys t.keys)
::  The card's components, from its A2UI update message.
::
++  components
  |=  blob=@t
  ^-  (list json)
  =/  parsed  (need (de:json:html blob))
  ?>  ?=([%a [%o *] ~] parsed)
  =/  messages  (dig i.p.parsed ~['messages'])
  ?>  ?=([%a * * ~] messages)
  =/  parts  (dig i.t.p.messages ~['updateComponents' 'components'])
  ?>  ?=(%a -.parts)
  p.parts
::  Each button's label and the text it sends.
::
++  buttons
  |=  blob=@t
  ^-  (list [label=@t text=@t])
  =/  all  (components blob)
  =/  text
    |=  id=json
    ^-  @t
    =/  found
      (skim all |=(c=json =(id (dig c ~['id']))))
    ?>  ?=([* ~] found)
    (so:dejs:format (dig i.found ~['text']))
  %+  murn  all
  |=  c=json
  ?.  =([%s 'Button'] (dig c ~['component']))  ~
  :-  ~
  :-  (text (dig c ~['child']))
  (so:dejs:format (dig c ~['action' 'event' 'context' 'text']))
::  Whether any component's text is .words.
::
++  says
  |=  [blob=@t words=@t]
  ^-  ?
  %+  lien  (components blob)
  |=  c=json
  ?>  ?=(%o -.c)
  =(`[%s words] (~(get by p.c) 'text'))
::
++  test-a-dm-from-a-ship-without-access-opens-one-request-and-sends-the-owner-one-card
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-5:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (dm ~dev ~2026.9.9..12.00.00)]])
  ;<  ~  bind:m  (ex-equal !>((open s)) !>((places ~[[~dev ~]])))
  =/  cards  (sent caz)
  ?>  ?=([* ~] cards)
  ;<  ~  bind:m  (ex-equal !>(to.i.cards) !>(~nec))
  ;<  ~  bind:m  (ex-equal !>(text.i.cards) !>('DM request from ~dev'))
  ;<  ~  bind:m  (ex-equal !>((says blob.i.cards 'Allow ~dev to DM the bot?')) !>(&))
  ;<  ~  bind:m
    (ex-equal !>((says blob.i.cards 'Message: "hello from a stranger"')) !>(&))
  ;<  ~  bind:m  (ex-equal !>((kinds s 'approval-request')) !>(1))
  (ex-equal !>((kinds s 'permission-denied')) !>(1))
::  %chat reports a pending invitation once; its message is read from the
::  ship for the card.
::
++  test-a-dm-invitation-opens-a-request-whose-card-previews-the-invited-message
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-5:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.01 [%dm-invite [%ship ~dev]]]])
  ;<  ~  bind:m  (ex-equal !>((open s)) !>((places ~[[~dev ~]])))
  =/  cards  (sent caz)
  ?>  ?=([* ~] cards)
  (ex-equal !>((says blob.i.cards 'Message: "may I ask you something?"')) !>(&))
++  test-a-channel-mention-from-a-ship-without-access-opens-one-request-and-sends-the-owner-one-card
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-5:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (mention ~dev room-nest ~2026.9.9..12.00.00)]])
  ;<  ~  bind:m  (ex-equal !>((open s)) !>((places ~[[~dev `room-nest]])))
  =/  cards  (sent caz)
  ?>  ?=([* ~] cards)
  ;<  ~  bind:m  (ex-equal !>(to.i.cards) !>(~nec))
  ;<  ~  bind:m  (ex-equal !>(text.i.cards) !>('Channel mention request from ~dev'))
  ;<  ~  bind:m
    (ex-equal !>((says blob.i.cards 'Let the bot reply to ~dev in Room?')) !>(&))
  ;<  ~  bind:m  (ex-equal !>((says blob.i.cards 'Channel: Room')) !>(&))
  (ex-equal !>((says blob.i.cards 'Group: Lux group')) !>(&))
::  The second message comes after the denial limit has passed, so only the
::  open request stops a second card.
::
++  test-a-second-message-in-the-same-place-joins-the-open-request
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [* s=state-5:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (dm ~dev ~2026.9.9..12.00.00)]])
  ;<  [caz=(list card) w=state-5:t]  bind:m
    (admit s later ~[[~2026.9.10..00.05.00 (dm ~dev ~2026.9.10..00.05.00)]])
  ;<  ~  bind:m  (ex-equal !>((kinds w 'permission-denied')) !>(2))
  ;<  ~  bind:m  (ex-equal !>((sent caz)) !>(~))
  (ex-equal !>(approvals.w) !>(approvals.s))
++  test-the-same-ship-in-a-second-place-opens-a-second-request
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [* s=state-5:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (dm ~dev ~2026.9.9..12.00.00)]])
  ;<  [caz=(list card) w=state-5:t]  bind:m
    (admit s later ~[[~2026.9.10..00.05.00 (mention ~dev room-nest ~2026.9.10..00.05.00)]])
  ;<  ~  bind:m  (ex-equal !>((open w)) !>((places ~[[~dev ~] [~dev `room-nest]])))
  ;<  ~  bind:m  (ex-equal !>((lent (sent caz))) !>(1))
  =/  dm-id  (requested w ~dev ~)
  =/  room-id  (requested w ~dev `room-nest)
  ;<  ~  bind:m  (ex-equal !>(=(dm-id room-id)) !>(|))
  (ex-equal !>([(cut 3 [0 1] dm-id) (cut 3 [0 1] room-id)]) !>(['d' 'c']))
++  test-a-thread-reply-joins-its-channels-request
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [* s=state-5:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (mention ~dev room-nest ~2026.9.9..12.00.00)]])
  ;<  [caz=(list card) w=state-5:t]  bind:m
    (admit s later ~[[~2026.9.10..00.05.00 (reply ~dev room-nest ~2026.9.10..00.05.00)]])
  ;<  ~  bind:m  (ex-equal !>((kinds w 'permission-denied')) !>(2))
  ;<  ~  bind:m  (ex-equal !>((sent caz)) !>(~))
  (ex-equal !>(approvals.w) !>(approvals.s))
::  Not even in a channel that answers every message.
::
++  test-an-unmentioned-channel-post-opens-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-5:t]  bind:m
    %^  admit  fixture  start
    :~  [~2026.9.9..12.00.00 (unmentioned ~dev room-nest ~2026.9.9..12.00.00)]
        [~2026.9.9..12.00.01 (unmentioned ~dev all-nest ~2026.9.9..12.00.01)]
    ==
  ;<  ~  bind:m  (ex-equal !>((open s)) !>(`(set [@p place:t])`~))
  ;<  ~  bind:m  (ex-equal !>((sent caz)) !>(~))
  (ex-equal !>((kinds s 'permission-denied')) !>(0))
++  test-a-blocked-ship-opens-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-5:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (mention ~bel room-nest ~2026.9.9..12.00.00)]])
  ;<  ~  bind:m  (ex-equal !>((open s)) !>(`(set [@p place:t])`~))
  ;<  ~  bind:m  (ex-equal !>((sent caz)) !>(~))
  (ex-equal !>((kinds s 'approval-request')) !>(0))
::  The stored request is the ship, the place and the time it opened, under
::  its id: nothing of the message.
::
++  test-the-request-stores-no-message-text-or-id
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [* s=state-5:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (mention ~dev room-nest ~2026.9.9..12.00.00)]])
  =/  id  (requested s ~dev `room-nest)
  %+  ex-equal
    !>(approvals.s)
  !>(`approvals:t`[(my ~[[id [~dev `room-nest start]]]) (my ~[[[~dev `room-nest] id]])])
++  test-the-cards-buttons-send-allow-reject-and-ban-with-the-requests-id
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-5:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (mention ~dev room-nest ~2026.9.9..12.00.00)]])
  =/  id  (requested s ~dev `room-nest)
  =/  cards  (sent caz)
  ?>  ?=([* ~] cards)
  ;<  ~  bind:m  (ex-equal !>((met 3 id)) !>(5))
  %+  ex-equal
    !>((buttons blob.i.cards))
  !>  ^-  (list [@t @t])
      :~  ['Allow' (cat 3 '/allow ' id)]
          ['Reject' (cat 3 '/reject ' id)]
          ['Block' (cat 3 '/ban ' id)]
      ==
++  test-a-message-from-a-ship-without-access-is-never-admitted-as-a-turn
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-5:t]  bind:m
    %^  admit  fixture  start
    :~  [~2026.9.9..12.00.00 (dm ~dev ~2026.9.9..12.00.00)]
        [~2026.9.9..12.00.01 (mention ~dev room-nest ~2026.9.9..12.00.01)]
        [~2026.9.9..12.00.02 (reply ~dev room-nest ~2026.9.9..12.00.02)]
    ==
  ;<  ~  bind:m  (ex-equal !>(jobs.s) !>(`(map @uv job:t)`~))
  ;<  ~  bind:m  (ex-equal !>(lanes.s) !>(`(map @t lane:t)`~))
  %+  ex-equal
    !>  %+  lien  caz
        |=(c=card ?=([%pass * %agent [@ %harness] %poke %harness-hand *] c))
  !>(|)
::  A ship's DM grant closes its DM request; ship-wide access closes the
::  rest.
::
++  test-a-request-closes-when-its-ship-gains-access-there
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [* s=state-5:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (dm ~dev ~2026.9.9..12.00.00)]])
  ;<  [* s=state-5:t]  bind:m
    (admit s later ~[[~2026.9.10..00.05.00 (mention ~dev room-nest ~2026.9.10..00.05.00)]])
  =/  dm-granted  policy.s
  =.  dm-grants.dm-granted  (~(put in dm-grants.dm-granted) ~dev)
  ;<  [* w=state-5:t]  bind:m  (configure s dm-granted)
  ;<  ~  bind:m  (ex-equal !>((open w)) !>((places ~[[~dev `room-nest]])))
  ;<  ~  bind:m  (ex-equal !>(~(key by by-id.approvals.w)) !>((sy ~[(requested s ~dev `room-nest)])))
  =/  allowed  dm-granted
  =.  allowed.allowed  (silt ~[~dev])
  ;<  [* u=state-5:t]  bind:m  (configure w allowed)
  (ex-equal !>(approvals.u) !>(*approvals:t))
++  test-leaving-a-channel-closes-its-requests
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [* s=state-5:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (dm ~dev ~2026.9.9..12.00.00)]])
  ;<  [* s=state-5:t]  bind:m
    (admit s later ~[[~2026.9.10..00.05.00 (mention ~dev room-nest ~2026.9.10..00.05.00)]])
  ;<  w=state-5:t  bind:m  (leave s room-nest)
  ;<  ~  bind:m  (ex-equal !>((open w)) !>((places ~[[~dev ~]])))
  (ex-equal !>(~(key by by-id.approvals.w)) !>((sy ~[(requested s ~dev ~)])))
++  test-no-owner-or-a-disabled-adapter-opens-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  events  ~[[~2026.9.9..12.00.00 (dm ~dev ~2026.9.9..12.00.00)]]
  =/  ownerless  fixture
  =.  owner.policy.ownerless  ~
  ;<  [caz=(list card) s=state-5:t]  bind:m  (admit ownerless start events)
  ;<  ~  bind:m  (ex-equal !>((open s)) !>(`(set [@p place:t])`~))
  ;<  ~  bind:m  (ex-equal !>((sent caz)) !>(~))
  ::  A disabled hand does not subscribe; hand it the acknowledgement anyway.
  =/  disabled  fixture
  =.  enabled.policy.disabled  |
  ;<  ~  bind:m  (boot disabled start (stream events))
  ;<  ~  bind:m
    %-  jab-bowl
    |=(b=bowl b(wex (~(put by wex.b) [/activity ~zod %activity] [| /v4])))
  ;<  caz=(list card)  bind:m  (do-agent /activity [~zod %activity] [%watch-ack ~])
  ;<  =vase  bind:m  get-save
  =/  s  !<(state-5:t vase)
  ;<  ~  bind:m  (ex-equal !>((open s)) !>(`(set [@p place:t])`~))
  ;<  ~  bind:m  (ex-equal !>((sent caz)) !>(~))
  (ex-equal !>((kinds s 'permission-denied')) !>(0))
::  A channel that answers nobody opens none; an open channel answers the
::  ship instead.
::
++  test-an-off-or-open-channel-opens-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-5:t]  bind:m
    %^  admit  fixture  start
    :~  [~2026.9.9..12.00.00 (mention ~dev off-nest ~2026.9.9..12.00.00)]
        [~2026.9.9..12.00.01 (mention ~bus open-nest ~2026.9.9..12.00.01)]
    ==
  ;<  ~  bind:m  (ex-equal !>((open s)) !>(`(set [@p place:t])`~))
  ;<  ~  bind:m  (ex-equal !>((sent caz)) !>(~))
  ;<  [caz=(list card) w=state-5:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (mention ~dev open-nest ~2026.9.9..12.00.00)]])
  ;<  ~  bind:m  (ex-equal !>((open w)) !>(`(set [@p place:t])`~))
  ;<  ~  bind:m  (ex-equal !>((sent caz)) !>(~))
  (ex-equal !>(~(wyt by jobs.w)) !>(1))
::  ~dev lost access at 13:00; catch-up meets its mention from noon.
::
++  test-catch-up-opens-no-request-for-a-post-before-the-cutoff
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  fixture
  =.  cuts.saved  (my ~[[~dev ~2026.9.9..13.00.00]])
  ;<  [caz=(list card) s=state-5:t]  bind:m
    (admit saved start ~[[~2026.9.9..12.00.00 (mention ~dev room-nest ~2026.9.9..12.00.00)]])
  ;<  ~  bind:m  (ex-equal !>((open s)) !>(`(set [@p place:t])`~))
  (ex-equal !>((sent caz)) !>(~))
::  The channel's policy changed at 13:00, once for every channel and once
::  for .room-nest alone; catch-up meets mentions from before each.
::
++  test-catch-up-opens-no-request-for-a-mention-before-a-channel-policy-change
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  events  ~[[~2026.9.9..12.00.00 (mention ~dev room-nest ~2026.9.9..12.00.00)]]
  =/  everywhere  fixture
  =.  channel-after.everywhere  ~2026.9.9..13.00.00
  ;<  [caz=(list card) s=state-5:t]  bind:m  (admit everywhere start events)
  ;<  ~  bind:m  (ex-equal !>((open s)) !>(`(set [@p place:t])`~))
  ;<  ~  bind:m  (ex-equal !>((sent caz)) !>(~))
  =/  here  fixture
  =.  channel-cuts.here  (my ~[[room-nest ~2026.9.9..13.00.00]])
  ;<  [caz=(list card) s=state-5:t]  bind:m  (admit here start events)
  ;<  ~  bind:m  (ex-equal !>((open s)) !>(`(set [@p place:t])`~))
  (ex-equal !>((sent caz)) !>(~))
::  Activity keeps the row after the bot leaves the channel.
::
++  test-a-mention-in-a-channel-the-bot-is-not-in-opens-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-5:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (mention ~dev left-nest ~2026.9.9..12.00.00)]])
  ;<  ~  bind:m  (ex-equal !>((open s)) !>(`(set [@p place:t])`~))
  ;<  ~  bind:m  (ex-equal !>((sent caz)) !>(~))
  (ex-equal !>((kinds s 'approval-request')) !>(0))
::  ~wes's invitation was declined, so %chat no longer has the DM, though
::  Activity keeps the invitation; reading its messages would crash the event.
::
++  test-an-invitation-whose-dm-is-gone-opens-nothing-and-does-not-crash
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-5:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.01 [%dm-invite [%ship ~wes]]]])
  ;<  ~  bind:m  (ex-equal !>((open s)) !>(`(set [@p place:t])`~))
  ;<  ~  bind:m  (ex-equal !>((sent caz)) !>(~))
  (ex-equal !>(activity-through.s) !>(~2026.9.9..12.00.01))
::  ~dev is answered in the open channel; a mention whose text is too long to
::  admit is still not an attempt from a ship without access.
::
++  test-a-ship-with-access-never-opens-a-request
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  long=@t  (crip (reap 70.000 'a'))
  =/  at  ~2026.9.9..12.00.00
  =/  event=incoming-event:v8:a
    [%post [[~dev at] at] open-nest [~lux %test] ~[[%inline ~[long]]] &]
  ;<  [caz=(list card) s=state-5:t]  bind:m  (admit fixture start ~[[at event]])
  ;<  ~  bind:m  (ex-equal !>(~(wyt by jobs.s)) !>(0))
  ;<  ~  bind:m  (ex-equal !>((open s)) !>(`(set [@p place:t])`~))
  ;<  ~  bind:m  (ex-equal !>((sent caz)) !>(~))
  (ex-equal !>((kinds s 'permission-denied')) !>(0))
::  Within the denial limit a ship's attempt in a second place opens nothing;
::  its next attempt there may.
::
++  test-the-denial-limit-holds-back-a-new-request
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-5:t]  bind:m
    %^  admit  fixture  start
    :~  [~2026.9.9..12.00.00 (dm ~dev ~2026.9.9..12.00.00)]
        [~2026.9.9..12.00.01 (mention ~dev room-nest ~2026.9.9..12.00.01)]
    ==
  ;<  ~  bind:m  (ex-equal !>((open s)) !>((places ~[[~dev ~]])))
  (ex-equal !>((lent (sent caz))) !>(1))
++  test-a-rejected-card-closes-its-request
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-5:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (dm ~dev ~2026.9.9..12.00.00)]])
  =/  id  (requested s ~dev ~)
  ;<  ~  bind:m  (boot s start *stream:v10:a)
  ;<  *  bind:m
    %^  do-agent  /approval/[id]/(scot %da start)  [~zod %chat]
    [%poke-ack `~[leaf+"no"]]
  ;<  =vase  bind:m  get-save
  =/  w  !<(state-5:t vase)
  ;<  ~  bind:m  (ex-equal !>(approvals.w) !>(*approvals:t))
  (ex-equal !>((kinds w 'approval-card-rejected')) !>(1))
--
