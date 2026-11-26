::  Approval requests: a ship without access that writes to the bot opens
::  one request per place, and the owner is sent one card for it. Full
::  adapter, synthetic scries only; no emitted cards are executed.
::  -test /=harness=/tests-integration/harness-tlon-approvals
/-  t=harness-tlon, ad=harness-adapter, h=harness, g=groups-ver,
    a=activity-ver, hh=harness-hand, dv=channels-ver, cv=chat-ver
/+  *test-agent, policy-lib=harness-tlon-policy, hj=harness-json,
    story=harness-tlon-story, ht=harness-tools, ask=harness-tlon-approval
/=  adapter  /app/harness-tlon
|%
++  room-nest  `nest:dv`[%chat ~lux %test]
++  off-nest  `nest:dv`[%chat ~lux %quiet]
++  open-nest  `nest:dv`[%chat ~lux %open]
++  all-nest  `nest:dv`[%chat ~lux %busy]
++  left-nest  `nest:dv`[%chat ~lux %gone]
++  start  ~2026.9.10
++  comet  `@p`(bex 100)
++  later  ~2026.9.10..00.10.00
::  ~nec owns the bot; ~bus holds its DM. ~dev and ~bel have no access, and
::  the bot blocks ~bel.
::
++  fixture
  ^-  state-7:t
  =/  s=state-7:t  *state-7:t
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
  ::  harness-tlon-steward covers the Steward lease.
  ?:  ?=([%gu @ %steward @ %$ ~] path)  `!>(|)
  ::  The bot is in .room-nest and .off-nest, and of the DMs only ~dev's and
  ::  the comet's are on the ship.
  ?:  ?=([%gu @ %channels @ %v4 %chat %'~lux' %test ~] path)  `!>(&)
  ?:  ?=([%gu @ %channels @ %v4 %chat %'~lux' %quiet ~] path)  `!>(&)
  ?:  ?=([%gu @ %chat @ %dm %'~dev' ~] path)  `!>(&)
  ?:  &(?=([%gu @ %chat @ %dm @ ~] path) =((scot %p comet) i.t.t.t.t.t.path))  `!>(&)
  ?:  ?=([%gu @ %chat @ %dm @ ~] path)  `!>(|)
  ?:  (lien path |=(part=@ta =(%can-read part)))  `!>(|=([who=@p *] &))
  ?:  (lien path |=(part=@ta =(%groups part)))  `!>((my ~[[[~lux %test] room-group]]))
  ?:  (lien path |=(part=@ta =(%cron-session part)))  `!>(~)
  ?:  ?=([%gu @ %channels @ %v4 *] path)  `!>(|)
  ?:  =(%$ (rear path))  `!>(&)
  ?:  ?=([%gx @ %chat @ %dm %invited %ships ~] path)  `!>((silt ~[~dev comet]))
  ?:  ?=([%gx @ %chat @ %blocked %ships ~] path)  `!>((silt ~[~bel]))
  ?:  ?=([%gx @ %chat @ %v4 %dm %'~dev' %writs %newest *] path)  `!>(invited)
  ?:  ?=([%gx @ %activity @ %v6 %all %noun ~] path)  `!>(events)
  ?:  (lien path |=(part=@ta =(%hand-state part)))  `!>(*state:hh)
  ?:  ?=([%gx @ %harness @ %sessions %json ~] path)  `!>(`json`[%a ~])
  ?:  ?=([%gx @ %harness @ %defaults %json ~] path)
    `!>((config-json:hj %*(. *config:h tools ~[%web])))
  ~
++  boot
  |=  [saved=state-7:t now=@da events=stream:v10:a]
  (boot-seeded saved now events (shax 'approvals'))
++  boot-seeded
  |=  [saved=state-7:t now=@da events=stream:v10:a eny=@uvJ]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (set-bowl %*(. *bowl our ~zod, src ~zod, now now, eny eny))
  ;<  ~  bind:m  head-connected
  ;<  ~  bind:m  (set-scry-gate (scries events))
  ;<  *  bind:m  (do-load adapter `!>(saved))
  head-connected
::  Load .saved at .now, then deliver .events through Activity catch-up.
::
++  admit
  |=  [saved=state-7:t now=@da events=(list [@da incoming-event:v8:a])]
  =/  m  (mare ,[(list card) state-7:t])
  ^-  form:m
  (admit-seeded saved now events (shax 'approvals'))
++  admit-seeded
  |=  [saved=state-7:t now=@da events=(list [@da incoming-event:v8:a]) eny=@uvJ]
  =/  m  (mare ,[(list card) state-7:t])
  ^-  form:m
  ;<  ~  bind:m  (boot-seeded saved now (stream events) eny)
  ;<  caz=(list card)  bind:m  (do-agent /activity [~zod %activity] [%watch-ack ~])
  ;<  =vase  bind:m  get-save
  (pure:m caz !<(state-7:t vase))
::  Load .saved at .now with %chat holding .invited's invitations, or not
::  running, and fire the maintenance wake as the only event after the load:
::  Activity is already subscribed.
::
++  wake
  |=  [saved=state-7:t now=@da invited=(unit (set @p))]
  =/  m  (mare ,[(list card) state-7:t])
  ^-  form:m
  ;<  ~  bind:m  (set-bowl %*(. *bowl our ~zod, src ~zod, now now, eny (shax 'approvals')))
  ;<  ~  bind:m  head-connected
  ;<  ~  bind:m
    %-  jab-bowl
    |=(b=bowl b(wex (~(put by wex.b) [/activity ~zod %activity] [& /v4])))
  ;<  ~  bind:m
    %-  set-scry-gate
    |=  =path
    ?:  &(?=(~ invited) ?=([%gu @ %chat @ %$ ~] path))  `!>(|)
    ?:  ?=([%gx @ %chat @ %dm %invited %ships ~] path)  ?~(invited ~ `!>(u.invited))
    ((scries *stream:v10:a) path)
  ;<  *  bind:m  (do-load adapter `!>(saved))
  ;<  ~  bind:m  head-connected
  ;<  caz=(list card)  bind:m  (do-arvo /poll [%behn %wake ~])
  ;<  =vase  bind:m  get-save
  (pure:m caz !<(state-7:t vase))
::  Load .saved, then save .next through the policy endpoint.
::
++  configure
  |=  [saved=state-7:t next=policy:t]
  =/  m  (mare ,[(list card) state-7:t])
  ^-  form:m
  ;<  ~  bind:m  (boot saved later *stream:v10:a)
  ;<  caz=(list card)  bind:m
    %+  do-poke  %noun
    !>(`request:ad`['fixture' [%n '1'] 'harness/tlon/configure' `(policy-json:policy-lib next)])
  ;<  =vase  bind:m  get-save
  (pure:m caz !<(state-7:t vase))
::  As +configure, with Activity connected, so that only requests set the
::  maintenance wake.
::
++  configure-live
  |=  [saved=state-7:t next=policy:t]
  =/  m  (mare ,state-7:t)
  ^-  form:m
  ;<  ~  bind:m  (boot saved later *stream:v10:a)
  ;<  *  bind:m  (do-agent /activity [~zod %activity] [%watch-ack ~])
  ;<  *  bind:m
    %+  do-poke  %noun
    !>(`request:ad`['fixture' [%n '1'] 'harness/tlon/configure' `(policy-json:policy-lib next)])
  ;<  =vase  bind:m  get-save
  (pure:m !<(state-7:t vase))
::  Load .saved, then hear from %channels that the bot left .nest.
::
++  leave
  |=  [saved=state-7:t nest=nest:dv]
  =/  m  (mare ,state-7:t)
  ^-  form:m
  ;<  ~  bind:m  (boot saved later *stream:v10:a)
  ;<  *  bind:m
    %^  do-agent  /publications  [~zod %channels]
    [%fact %channel-response-4 !>(`r-channels:v9:dv`[nest %leave ~])]
  ;<  =vase  bind:m  get-save
  (pure:m !<(state-7:t vase))
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
::  The notices that the queue is full: to whom and their text.
::
++  full
  |=  caz=(list card)
  ^-  (list [to=@p text=@t])
  %+  murn  caz
  |=  c=card
  ?.  ?=([%pass [%approval-full @ ~] %agent [@ %chat] %poke *] c)  ~
  =/  act  !<(action:dm:v7:cv q.cage.task.q.c)
  ?>  ?=(%add -.q.q.act)
  `[p.act (story-to-text:story content.essay.q.q.act)]
::  The DM invitations declined.
::
++  declined
  |=  caz=(list card)
  ^-  (list [@p ?])
  %+  murn  caz
  |=  c=card
  ?.  ?=([%pass [%invite %decline @ ~] %agent [@ %chat] %poke %chat-dm-rsvp *] c)  ~
  `!<([@p ?] q.cage.task.q.c)
::  Every answer to a DM invitation, by any wire.
::
++  rsvps
  |=  caz=(list card)
  ^-  (list [@p ?])
  %+  murn  caz
  |=  c=card
  ?.  ?=([%pass * %agent [@ %chat] %poke %chat-dm-rsvp *] c)  ~
  `!<([@p ?] q.cage.task.q.c)
::  +dm-effects: what the cards do to DMs, in dispatch order, each with its
::  ship: decline or accept an invitation, post a message from a tool call,
::  or change it otherwise
::
++  dm-effects
  |=  caz=(list card)
  ^-  (list [@tas @p])
  %+  murn  caz
  |=  c=card
  ?:  ?=([%pass * %agent [@ %chat] %poke %chat-dm-rsvp *] c)
    =/  [who=@p ok=?]  !<([@p ?] q.cage.task.q.c)
    `[?:(ok %accept %decline) who]
  ?.  ?=([%pass [%tlon-tool *] %agent [@ %chat] %poke %chat-dm-action-2 *] c)  ~
  =/  act  !<(action:dm:v7:cv q.cage.task.q.c)
  `[?:(?=(%add -.q.q.act) %post %other) p.act]
::  +call-tool: load .saved at .now, then run an authorized Tlon tool call
::  with .args
::
++  call-tool
  |=  [saved=state-7:t now=@da args=@t]
  =/  m  (mare ,[(list card) state-7:t])
  ^-  form:m
  =/  call=tool-call:h  ['call-1' 'tlon' args]
  ;<  ~  bind:m  (boot saved now *stream:v10:a)
  ;<  ~  bind:m
    %-  set-scry-gate
    |=  =path
    ?:  ?=([%gx @ %harness @ %tool-call *] path)
      `!>(`(unit tool-authority:ad)``[call ~])
    ((scries *stream:v10:a) path)
  ;<  caz=(list card)  bind:m
    (do-poke %harness-tool !>(`tool-request:ad`['sid' 0 call]))
  ;<  =vase  bind:m  get-save
  (pure:m caz !<(state-7:t vase))
::  .saved with .count requests in place of its own, from planets with no
::  access, each in .room-nest, opened at .at.
::
++  crowd
  |=  [saved=state-7:t count=@ud at=@da]
  ^-  state-7:t
  %=    saved
      approvals
    %+  roll  (gulf 1 count)
    |=  [n=@ud =approvals:t]
    (open:ask approvals (cat 3 'c' (crip (a-co:co n))) [`@p`(add 0x1.0000 n) `room-nest at])
  ==
::  ~dev's DM and four other channels: as many requests as a ship may hold.
::
++  busy-dev
  ^-  state-7:t
  =/  s  fixture
  =.  approvals.s
    %+  roll  (gulf 1 4)
    |=  [n=@ud =approvals:t]
    =/  nest=nest:dv  [%chat ~lux `@tas`(crip (weld "other" (a-co:co n)))]
    (open:ask approvals (cat 3 'c' (crip (a-co:co n))) [~dev `nest ~2026.9.9..12.00.00])
  s(approvals (open:ask approvals.s 'd0' [~dev ~ ~2026.9.9..12.00.00]))
::  Open requests by ship and place.
::
++  open
  |=  s=state-7:t
  ^-  (set [@p place:t])
  ~(key by by-place.approvals.s)
++  places
  |=  places=(list [@p place:t])
  ^-  (set [@p place:t])
  (silt places)
++  requested
  |=  [s=state-7:t who=@p =place:t]
  ^-  @t
  (~(got by by-place.approvals.s) [who place])
++  kinds
  |=  [s=state-7:t kind=@t]
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
  ;<  [caz=(list card) s=state-7:t]  bind:m
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
  ;<  [caz=(list card) s=state-7:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.01 [%dm-invite [%ship ~dev]]]])
  ;<  ~  bind:m  (ex-equal !>((open s)) !>((places ~[[~dev ~]])))
  =/  cards  (sent caz)
  ?>  ?=([* ~] cards)
  (ex-equal !>((says blob.i.cards 'Message: "may I ask you something?"')) !>(&))
++  test-a-channel-mention-from-a-ship-without-access-opens-one-request-and-sends-the-owner-one-card
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-7:t]  bind:m
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
  ;<  [* s=state-7:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (dm ~dev ~2026.9.9..12.00.00)]])
  ;<  [caz=(list card) w=state-7:t]  bind:m
    (admit s later ~[[~2026.9.10..00.05.00 (dm ~dev ~2026.9.10..00.05.00)]])
  ;<  ~  bind:m  (ex-equal !>((kinds w 'permission-denied')) !>(2))
  ;<  ~  bind:m  (ex-equal !>((sent caz)) !>(~))
  (ex-equal !>(approvals.w) !>(approvals.s))
++  test-the-same-ship-in-a-second-place-opens-a-second-request
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [* s=state-7:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (dm ~dev ~2026.9.9..12.00.00)]])
  ;<  [caz=(list card) w=state-7:t]  bind:m
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
  ;<  [* s=state-7:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (mention ~dev room-nest ~2026.9.9..12.00.00)]])
  ;<  [caz=(list card) w=state-7:t]  bind:m
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
  ;<  [caz=(list card) s=state-7:t]  bind:m
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
  ;<  [caz=(list card) s=state-7:t]  bind:m
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
  ;<  [* s=state-7:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (mention ~dev room-nest ~2026.9.9..12.00.00)]])
  =/  id  (requested s ~dev `room-nest)
  %+  ex-equal
    !>(approvals.s)
  !>(`approvals:t`[(my ~[[id [~dev `room-nest start]]]) (my ~[[[~dev `room-nest] id]])])
++  test-the-cards-buttons-send-allow-reject-and-ban-with-the-requests-id
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-7:t]  bind:m
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
  ;<  [caz=(list card) s=state-7:t]  bind:m
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
  ;<  [* s=state-7:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (dm ~dev ~2026.9.9..12.00.00)]])
  ;<  [* s=state-7:t]  bind:m
    (admit s later ~[[~2026.9.10..00.05.00 (mention ~dev room-nest ~2026.9.10..00.05.00)]])
  =/  dm-granted  policy.s
  =.  dm-grants.dm-granted  (~(put in dm-grants.dm-granted) ~dev)
  ;<  [* w=state-7:t]  bind:m  (configure s dm-granted)
  ;<  ~  bind:m  (ex-equal !>((open w)) !>((places ~[[~dev `room-nest]])))
  ;<  ~  bind:m  (ex-equal !>(~(key by by-id.approvals.w)) !>((sy ~[(requested s ~dev `room-nest)])))
  =/  allowed  dm-granted
  =.  allowed.allowed  (silt ~[~dev])
  ;<  [* u=state-7:t]  bind:m  (configure w allowed)
  (ex-equal !>(approvals.u) !>(*approvals:t))
::  A host that removes the channel and adds it back frees no slot: ~dev's
::  request stays through the leave, its mention after the bot joins again
::  opens nothing and sends no card, and the request expires as any other.
::
++  test-leaving-and-rejoining-a-channel-keeps-its-request-and-sends-no-second-card
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [* s=state-7:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (dm ~dev ~2026.9.9..12.00.00)]])
  ;<  [* s=state-7:t]  bind:m
    (admit s later ~[[~2026.9.10..00.05.00 (mention ~dev room-nest ~2026.9.10..00.05.00)]])
  ;<  w=state-7:t  bind:m  (leave s room-nest)
  ;<  ~  bind:m  (ex-equal !>(approvals.w) !>(approvals.s))
  ;<  [caz=(list card) u=state-7:t]  bind:m
    %^  admit  w  ~2026.9.10..00.30.00
    ~[[~2026.9.10..00.20.00 (mention ~dev room-nest ~2026.9.10..00.20.00)]]
  ;<  ~  bind:m  (ex-equal !>(approvals.u) !>(approvals.s))
  ;<  ~  bind:m  (ex-equal !>((held:ask approvals.u ~dev)) !>(2))
  ;<  ~  bind:m  (ex-equal !>((sent caz)) !>(~))
  ;<  ~  bind:m  (ex-equal !>((kinds u 'permission-denied')) !>(3))
  ;<  ~  bind:m  (ex-equal !>((kinds u 'approval-request')) !>(2))
  ;<  [* x=state-7:t]  bind:m  (wake u (add later ~h48) `~)
  ;<  ~  bind:m  (ex-equal !>((open x)) !>(`(set [@p place:t])`~))
  (ex-equal !>((kinds x 'approval-expired')) !>(2))
++  test-no-owner-or-a-disabled-adapter-opens-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  events  ~[[~2026.9.9..12.00.00 (dm ~dev ~2026.9.9..12.00.00)]]
  =/  ownerless  fixture
  =.  owner.policy.ownerless  ~
  ;<  [caz=(list card) s=state-7:t]  bind:m  (admit ownerless start events)
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
  =/  s  !<(state-7:t vase)
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
  ;<  [caz=(list card) s=state-7:t]  bind:m
    %^  admit  fixture  start
    :~  [~2026.9.9..12.00.00 (mention ~dev off-nest ~2026.9.9..12.00.00)]
        [~2026.9.9..12.00.01 (mention ~bus open-nest ~2026.9.9..12.00.01)]
    ==
  ;<  ~  bind:m  (ex-equal !>((open s)) !>(`(set [@p place:t])`~))
  ;<  ~  bind:m  (ex-equal !>((sent caz)) !>(~))
  ;<  [caz=(list card) w=state-7:t]  bind:m
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
  ;<  [caz=(list card) s=state-7:t]  bind:m
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
  ;<  [caz=(list card) s=state-7:t]  bind:m  (admit everywhere start events)
  ;<  ~  bind:m  (ex-equal !>((open s)) !>(`(set [@p place:t])`~))
  ;<  ~  bind:m  (ex-equal !>((sent caz)) !>(~))
  =/  here  fixture
  =.  channel-cuts.here  (my ~[[room-nest ~2026.9.9..13.00.00]])
  ;<  [caz=(list card) s=state-7:t]  bind:m  (admit here start events)
  ;<  ~  bind:m  (ex-equal !>((open s)) !>(`(set [@p place:t])`~))
  (ex-equal !>((sent caz)) !>(~))
::  Activity keeps the row after the bot leaves the channel.
::
++  test-a-mention-in-a-channel-the-bot-is-not-in-opens-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-7:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (mention ~dev left-nest ~2026.9.9..12.00.00)]])
  ;<  ~  bind:m  (ex-equal !>((open s)) !>(`(set [@p place:t])`~))
  ;<  ~  bind:m  (ex-equal !>((sent caz)) !>(~))
  (ex-equal !>((kinds s 'approval-request')) !>(0))
::  The host revoked ~dev's read permission before catch-up met its mention.
::
++  test-a-mention-from-a-ship-that-cannot-read-the-channel-opens-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  events  (stream ~[[~2026.9.9..12.00.00 (mention ~dev room-nest ~2026.9.9..12.00.00)]])
  ;<  ~  bind:m  (boot fixture start events)
  ;<  ~  bind:m
    %-  set-scry-gate
    |=  =path
    ?:  (lien path |=(part=@ta =(%can-read part)))  `!>(|=([who=@p *] !=(~dev who)))
    ((scries events) path)
  ;<  caz=(list card)  bind:m  (do-agent /activity [~zod %activity] [%watch-ack ~])
  ;<  =vase  bind:m  get-save
  =/  s  !<(state-7:t vase)
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
  ;<  [caz=(list card) s=state-7:t]  bind:m
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
  ;<  [caz=(list card) s=state-7:t]  bind:m  (admit fixture start ~[[at event]])
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
  ;<  [caz=(list card) s=state-7:t]  bind:m
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
  ;<  [caz=(list card) s=state-7:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (dm ~dev ~2026.9.9..12.00.00)]])
  =/  id  (requested s ~dev ~)
  ;<  ~  bind:m  (boot s start *stream:v10:a)
  ;<  *  bind:m
    %^  do-agent  /approval/[id]/(scot %da start)  [~zod %chat]
    [%poke-ack `~[leaf+"no"]]
  ;<  =vase  bind:m  get-save
  =/  w  !<(state-7:t vase)
  ;<  ~  bind:m  (ex-equal !>(approvals.w) !>(*approvals:t))
  (ex-equal !>((kinds w 'approval-card-rejected')) !>(1))
::  The second attempt is within ten minutes of the notice.
::
++  test-the-101st-request-opens-nothing-and-the-owner-gets-one-notice
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  crowded  (crowd fixture 100 ~2026.9.9..12.00.00)
  ;<  [caz=(list card) s=state-7:t]  bind:m
    (admit crowded start ~[[~2026.9.9..13.00.00 (mention ~dev room-nest ~2026.9.9..13.00.00)]])
  ;<  ~  bind:m  (ex-equal !>(approvals.s) !>(approvals.crowded))
  ;<  ~  bind:m  (ex-equal !>((sent caz)) !>(~))
  ;<  ~  bind:m
    %+  ex-equal  !>((full caz))
    !>  ^-  (list [@p @t])
    :~  :-  ~nec
        'Pending approval queue is full (100). New requests are dropped until existing ones are approved, denied, or blocked.'
    ==
  ;<  ~  bind:m  (ex-equal !>((kinds s 'approval-cap')) !>(1))
  ;<  [caz=(list card) w=state-7:t]  bind:m
    %^  admit  s  ~2026.9.10..00.09.59
    ~[[~2026.9.10..00.05.00 (mention ~wes room-nest ~2026.9.10..00.05.00)]]
  ;<  ~  bind:m  (ex-equal !>((kinds w 'permission-denied')) !>(2))
  ;<  ~  bind:m  (ex-equal !>(approvals.w) !>(approvals.crowded))
  ;<  ~  bind:m  (ex-equal !>((full caz)) !>(~))
  (ex-equal !>((kinds w 'approval-cap')) !>(1))
++  test-a-ships-sixth-place-opens-nothing-silently-until-one-of-its-requests-closes
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  busy  busy-dev
  ;<  [caz=(list card) s=state-7:t]  bind:m
    (admit busy start ~[[~2026.9.9..13.00.00 (mention ~dev room-nest ~2026.9.9..13.00.00)]])
  ;<  ~  bind:m  (ex-equal !>(approvals.s) !>(approvals.busy))
  ;<  ~  bind:m  (ex-equal !>((sent caz)) !>(~))
  ;<  ~  bind:m  (ex-equal !>((full caz)) !>(~))
  ;<  ~  bind:m  (ex-equal !>((kinds s 'approval-cap')) !>(0))
  =/  fewer  s(approvals (close:ask approvals.s 'c1'))
  ;<  [caz=(list card) w=state-7:t]  bind:m
    (admit fewer later ~[[~2026.9.10..00.05.00 (mention ~dev room-nest ~2026.9.10..00.05.00)]])
  ;<  ~  bind:m  (ex-equal !>(?=(^ (find:ask approvals.w ~dev `room-nest))) !>(&))
  (ex-equal !>((lent (sent caz))) !>(1))
++  test-a-request-expires-after-48-hours-and-one-a-second-younger-is-kept
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  fixture
  =.  approvals.saved
    =/  one  (open:ask approvals.saved 'c1' [~dev `room-nest start])
    (open:ask one 'c2' [~wes `room-nest (add start ~s1)])
  ;<  [caz=(list card) w=state-7:t]  bind:m  (wake saved (add start ~h48) `~)
  ;<  ~  bind:m  (ex-equal !>((open w)) !>((places ~[[~wes `room-nest]])))
  ;<  ~  bind:m  (ex-equal !>((kinds w 'approval-expired')) !>(1))
  (ex-equal !>(wake.w) !>(`(add start (add ~h48 ~s1))))
::  %chat would otherwise keep ~dev's invitation, and report none of its
::  later messages.
::
++  test-a-dm-requests-expiry-declines-its-still-pending-invitation
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  fixture
  =.  approvals.saved  (open:ask approvals.saved 'd1' [~dev ~ start])
  ;<  [caz=(list card) w=state-7:t]  bind:m  (wake saved (add start ~h48) `(silt ~[~dev ~wes]))
  ;<  ~  bind:m  (ex-equal !>((open w)) !>(`(set [@p place:t])`~))
  (ex-equal !>((declined caz)) !>(`(list [@p ?])`~[[~dev |]]))
::  No invitation of ~dev's, then a %chat that cannot answer.
::
++  test-a-dm-requests-expiry-declines-nothing-and-does-not-crash-when-the-invitation-is-gone
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  fixture
  =.  approvals.saved  (open:ask approvals.saved 'd1' [~dev ~ start])
  ;<  [caz=(list card) w=state-7:t]  bind:m  (wake saved (add start ~h48) `(silt ~[~wes]))
  ;<  ~  bind:m  (ex-equal !>((open w)) !>(`(set [@p place:t])`~))
  ;<  ~  bind:m  (ex-equal !>((declined caz)) !>(`(list [@p ?])`~))
  ;<  [caz=(list card) w=state-7:t]  bind:m  (wake saved (add start ~h48) ~)
  ;<  ~  bind:m  (ex-equal !>((open w)) !>(`(set [@p place:t])`~))
  ;<  ~  bind:m  (ex-equal !>((kinds w 'approval-expired')) !>(1))
  (ex-equal !>((declined caz)) !>(`(list [@p ?])`~))
++  test-a-channel-requests-expiry-declines-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  fixture
  =.  approvals.saved  (open:ask approvals.saved 'c1' [~dev `room-nest start])
  ;<  [caz=(list card) w=state-7:t]  bind:m  (wake saved (add start ~h48) `(silt ~[~dev]))
  ;<  ~  bind:m  (ex-equal !>((open w)) !>(`(set [@p place:t])`~))
  (ex-equal !>((declined caz)) !>(`(list [@p ?])`~))
::  The DM request opens first and closes first, when ~dev gains DM access.
::
++  test-the-wake-is-the-earliest-expiry-and-moves-when-that-request-closes
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [* s=state-7:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (dm ~dev ~2026.9.9..12.00.00)]])
  ;<  ~  bind:m  (ex-equal !>(wake.s) !>(`(add start ~h48)))
  ;<  [* s=state-7:t]  bind:m
    (admit s later ~[[~2026.9.10..00.05.00 (mention ~dev room-nest ~2026.9.10..00.05.00)]])
  ;<  ~  bind:m  (ex-equal !>(wake.s) !>(`(add start ~h48)))
  =/  dm-granted  policy.s
  =.  dm-grants.dm-granted  (~(put in dm-grants.dm-granted) ~dev)
  ;<  w=state-7:t  bind:m  (configure-live s dm-granted)
  ;<  ~  bind:m  (ex-equal !>((open w)) !>((places ~[[~dev `room-nest]])))
  (ex-equal !>(wake.w) !>(`(add later ~h48)))
++  test-after-expiry-the-same-ship-in-the-same-place-opens-a-new-request-with-a-new-card
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [* s=state-7:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (dm ~dev ~2026.9.9..12.00.00)]])
  =/  first  (requested s ~dev ~)
  ;<  [* w=state-7:t]  bind:m  (wake s (add start ~h48) `~)
  ;<  ~  bind:m  (ex-equal !>((open w)) !>(`(set [@p place:t])`~))
  =/  again  (add start (add ~h48 ~s30))
  ;<  [caz=(list card) u=state-7:t]  bind:m
    (admit-seeded w (add again ~s30) ~[[again (dm ~dev again)]] (shax 'again'))
  ;<  ~  bind:m  (ex-equal !>((open u)) !>((places ~[[~dev ~]])))
  ;<  ~  bind:m  (ex-equal !>(=(first (requested u ~dev ~))) !>(|))
  (ex-equal !>((lent (sent caz))) !>(1))
::  A comet is still recorded as denied.
::
++  test-a-comet-opens-no-request
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-7:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (mention comet room-nest ~2026.9.9..12.00.00)]])
  ;<  ~  bind:m  (ex-equal !>((open s)) !>(`(set [@p place:t])`~))
  ;<  ~  bind:m  (ex-equal !>((sent caz)) !>(~))
  ;<  ~  bind:m  (ex-equal !>((full caz)) !>(~))
  (ex-equal !>((kinds s 'permission-denied')) !>(1))
::  The owner gave it DM access by hand.
::
++  test-a-comet-with-access-is-admitted-to-a-turn
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  fixture
  =.  dm-grants.policy.saved  (~(put in dm-grants.policy.saved) comet)
  ;<  [* s=state-7:t]  bind:m
    (admit saved start ~[[~2026.9.9..12.00.00 (dm comet ~2026.9.9..12.00.00)]])
  ;<  ~  bind:m  (ex-equal !>(~(wyt by jobs.s)) !>(1))
  (ex-equal !>((kinds s 'permission-denied')) !>(0))
::  The reload itself sets the wake; the load does not expire anything, and
::  the wake it set does. Before the request is due, the wake is its expiry.
::  Overdue, it is a second after the load, sooner than Activity's resubscribe.
::
++  test-a-reload-keeps-open-requests-and-sets-a-wake-for-their-expiry
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [* s=state-7:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (dm ~dev ~2026.9.9..12.00.00)]])
  ;<  [* w=state-7:t]  bind:m  (admit s later ~)
  ;<  ~  bind:m  (ex-equal !>(approvals.w) !>(approvals.s))
  ;<  ~  bind:m  (ex-equal !>(wake.w) !>(`(add start ~h48)))
  =/  overdue  (add start ~h49)
  ;<  ~  bind:m  (set-bowl %*(. *bowl our ~zod, src ~zod, now overdue, eny (shax 'approvals')))
  ;<  ~  bind:m  head-connected
  ;<  ~  bind:m  (set-scry-gate (scries *stream:v10:a))
  ;<  caz=(list card)  bind:m  (do-load adapter `!>(s))
  ;<  loaded=vase  bind:m  get-save
  =/  u  !<(state-7:t loaded)
  ;<  ~  bind:m  (ex-equal !>(approvals.u) !>(approvals.s))
  ;<  ~  bind:m
    %+  ex-equal
      !>((skim caz |=(c=card ?=([%pass [%poll ~] %arvo %b %wait *] c))))
    !>(`(list card)`~[[%pass /poll %arvo %b %wait (add overdue ~s1)]])
  ;<  ~  bind:m  head-connected
  ;<  *  bind:m  (do-arvo /poll [%behn %wake ~])
  ;<  woken=vase  bind:m  get-save
  (ex-equal !>((open !<(state-7:t woken))) !>(`(set [@p place:t])`~))
::  Under steady traffic each event would move an overdue wake later; the
::  event itself expires the request. Loading alone does not.
::
++  test-an-event-after-a-requests-expiry-expires-it-without-the-wake
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  fixture
  =.  approvals.saved  (open:ask approvals.saved 'c1' [~dev `room-nest start])
  ;<  ~  bind:m  (boot saved (add start ~h48) *stream:v10:a)
  ;<  loaded=vase  bind:m  get-save
  ;<  ~  bind:m  (ex-equal !>((open !<(state-7:t loaded))) !>((places ~[[~dev `room-nest]])))
  ;<  *  bind:m  (do-agent /activity [~zod %activity] [%watch-ack ~])
  ;<  after=vase  bind:m  get-save
  =/  w  !<(state-7:t after)
  ;<  ~  bind:m  (ex-equal !>((open w)) !>(`(set [@p place:t])`~))
  (ex-equal !>((kinds w 'approval-expired')) !>(1))
::  %chat reports a pending invitation once; declined, ~dev's next message
::  invites the bot again.
::
++  test-a-first-dm-dropped-at-the-request-limit-declines-its-invitation
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  crowded  (crowd fixture 100 ~2026.9.9..12.00.00)
  ;<  [caz=(list card) s=state-7:t]  bind:m
    (admit crowded start ~[[~2026.9.9..13.00.00 [%dm-invite [%ship ~dev]]]])
  ;<  ~  bind:m  (ex-equal !>(approvals.s) !>(approvals.crowded))
  ;<  ~  bind:m  (ex-equal !>((lent (full caz))) !>(1))
  (ex-equal !>((declined caz)) !>(`(list [@p ?])`~[[~dev |]]))
++  test-a-first-dm-dropped-at-a-ships-limit-declines-its-invitation
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  busy  fixture
  =.  approvals.busy
    %+  roll  (gulf 1 5)
    |=  [n=@ud =approvals:t]
    =/  nest=nest:dv  [%chat ~lux `@tas`(crip (weld "other" (a-co:co n)))]
    (open:ask approvals (cat 3 'c' (crip (a-co:co n))) [~dev `nest ~2026.9.9..12.00.00])
  ;<  [caz=(list card) s=state-7:t]  bind:m
    (admit busy start ~[[~2026.9.9..13.00.00 [%dm-invite [%ship ~dev]]]])
  ;<  ~  bind:m  (ex-equal !>(approvals.s) !>(approvals.busy))
  ;<  ~  bind:m  (ex-equal !>((full caz)) !>(~))
  (ex-equal !>((declined caz)) !>(`(list [@p ?])`~[[~dev |]]))
::  ~dev's channel mention a second earlier uses its turn under the limit.
::
++  test-a-first-dm-dropped-by-the-denial-limit-declines-its-invitation
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-7:t]  bind:m
    %^  admit  fixture  start
    :~  [~2026.9.9..12.00.00 (mention ~dev room-nest ~2026.9.9..12.00.00)]
        [~2026.9.9..12.00.01 [%dm-invite [%ship ~dev]]]
    ==
  ;<  ~  bind:m  (ex-equal !>((open s)) !>((places ~[[~dev `room-nest]])))
  (ex-equal !>((declined caz)) !>(`(list [@p ?])`~[[~dev |]]))
::  Neither attempt could open a request: a comet's is not a limit's to
::  decline, and the repeated invitation already has its request.
::
++  test-an-invitation-that-could-open-no-request-is-not-declined-at-a-limit
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  crowded  (crowd fixture 100 ~2026.9.9..12.00.00)
  ;<  [caz=(list card) *]  bind:m
    %^  admit  crowded  start
    :~  [~2026.9.9..13.00.00 [%dm-invite [%ship comet]]]
        [~2026.9.9..13.00.01 (mention comet room-nest ~2026.9.9..13.00.01)]
        [~2026.9.9..13.00.02 [%dm-invite [%ship comet]]]
    ==
  ;<  ~  bind:m  (ex-equal !>((declined caz)) !>(`(list [@p ?])`~))
  ;<  [caz=(list card) s=state-7:t]  bind:m
    %^  admit  fixture  start
    :~  [~2026.9.9..12.00.00 [%dm-invite [%ship ~dev]]]
        [~2026.9.9..12.00.01 [%dm-invite [%ship ~dev]]]
    ==
  ;<  ~  bind:m  (ex-equal !>((open s)) !>((places ~[[~dev ~]])))
  (ex-equal !>((declined caz)) !>(`(list [@p ?])`~))
::  The owner's accept_dm, then ~dev's DM access, each accept ~dev's
::  invitation when its request is overdue. A decline after the accept would
::  be taken by %chat as leaving the accepted DM, deleting its history; one
::  before it is the expiry's.
::
++  test-accepting-an-invitation-whose-request-is-overdue-sends-no-decline-after-it
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  fixture
  =.  approvals.saved  (open:ask approvals.saved 'd1' [~dev ~ start])
  =/  due  (add start ~h48)
  ;<  [caz=(list card) s=state-7:t]  bind:m
    (call-tool saved due '{"action":"accept_dm","ship":"~dev"}')
  ;<  ~  bind:m  (ex-equal !>((open s)) !>(`(set [@p place:t])`~))
  ;<  ~  bind:m  (ex-equal !>((dm-effects caz)) !>(`(list [@tas @p])`~[[%decline ~dev] [%accept ~dev]]))
  =.  dm-grants.policy.saved  (~(put in dm-grants.policy.saved) ~dev)
  ;<  ~  bind:m  (set-bowl %*(. *bowl our ~zod, src ~zod, now due, eny (shax 'approvals')))
  ;<  ~  bind:m  head-connected
  ;<  ~  bind:m  (set-scry-gate (scries *stream:v10:a))
  ;<  loaded=(list card)  bind:m  (do-load adapter `!>(saved))
  ;<  ~  bind:m  head-connected
  ;<  woken=(list card)  bind:m  (do-arvo /poll [%behn %wake ~])
  ;<  granted=vase  bind:m  get-save
  ;<  ~  bind:m  (ex-equal !>((open !<(state-7:t granted))) !>(`(set [@p place:t])`~))
  (ex-equal !>((weld (rsvps loaded) (rsvps woken))) !>(`(list [@p ?])`~[[~dev &] [~dev &]]))
::  Before expiry, only the tool's own cleanup can close the request.
::
++  test-accepting-an-invitation-before-its-request-expires-closes-it-and-declines-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  fixture
  =.  approvals.saved  (open:ask approvals.saved 'd1' [~dev ~ start])
  ;<  [caz=(list card) s=state-7:t]  bind:m
    (call-tool saved (add start ~h1) '{"action":"accept_dm","ship":"~dev"}')
  ;<  ~  bind:m  (ex-equal !>((open s)) !>(`(set [@p place:t])`~))
  ;<  ~  bind:m  (ex-equal !>((kinds s 'approval-expired')) !>(0))
  (ex-equal !>((dm-effects caz)) !>(`(list [@tas @p])`~[[%accept ~dev]]))
::  A message into a pending DM accepts its invitation in %chat, so a decline
::  after it would delete the DM.
::
++  test-send-dm-to-a-ship-whose-request-is-overdue-leaves-no-decline-after-the-send
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  fixture
  =.  approvals.saved  (open:ask approvals.saved 'd1' [~dev ~ start])
  ;<  [caz=(list card) s=state-7:t]  bind:m
    (call-tool saved (add start ~h48) '{"action":"send_dm","ship":"~dev","text":"hello"}')
  ;<  ~  bind:m  (ex-equal !>((open s)) !>(`(set [@p place:t])`~))
  (ex-equal !>((dm-effects caz)) !>(`(list [@tas @p])`~[[%decline ~dev] [%post ~dev]]))
::  The cap declines ~dev's first invitation; ten minutes later, with a slot
::  free, ~dev's next one is a new attempt.
::
++  test-after-a-limit-declined-an-invitation-a-new-one-after-five-minutes-with-a-slot-free-opens-a-request
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  crowded  (crowd fixture 100 ~2026.9.9..12.00.00)
  ;<  [caz=(list card) s=state-7:t]  bind:m
    (admit crowded start ~[[~2026.9.9..13.00.00 [%dm-invite [%ship ~dev]]]])
  ;<  ~  bind:m  (ex-equal !>((declined caz)) !>(`(list [@p ?])`~[[~dev |]]))
  =/  fewer  s(approvals (close:ask approvals.s 'c1'))
  ;<  [caz=(list card) u=state-7:t]  bind:m
    (admit fewer later ~[[~2026.9.10..00.05.00 [%dm-invite [%ship ~dev]]]])
  ;<  ~  bind:m  (ex-equal !>((declined caz)) !>(`(list [@p ?])`~))
  ;<  ~  bind:m  (ex-equal !>(?=(^ (find:ask approvals.u ~dev ~))) !>(&))
  (ex-equal !>((lent (sent caz))) !>(1))
--
