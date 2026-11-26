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
  ::  Local %channels holds none of the posts, so none is a known bot's.
  ?:  ?=([%gx @ %channels @ %v4 @ @ @ %posts *] path)
    `!>(*paged-posts:v9:dv)
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
  ?.  ?=([%pass [%approval @ @ *] %agent [@ %chat] %poke *] c)  ~
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
++  test-the-cards-buttons-send-allow-reject-and-ban-with-the-requests-id-and-token
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-7:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (mention ~dev room-nest ~2026.9.9..12.00.00)]])
  =/  id  (requested s ~dev `room-nest)
  =/  token  (scot %uv (button-token:ask id [~dev `room-nest start]))
  =/  cards  (sent caz)
  ?>  ?=([* ~] cards)
  ;<  ~  bind:m  (ex-equal !>((met 3 id)) !>(5))
  %+  ex-equal
    !>((buttons blob.i.cards))
  !>  ^-  (list [@t @t])
      :~  ['Allow' (rap 3 '/allow ' id ' ' token ~)]
          ['Reject' (rap 3 '/reject ' id ' ' token ~)]
          ['Block' (rap 3 '/ban ' id ' ' token ~)]
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
  ;<  [caz=(list card) *]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (dm ~dev ~2026.9.9..12.00.00)]])
  ;<  [* w=state-7:t]  bind:m  (ack-card caz `~[leaf+"no"])
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
::
::  The owner's approval commands
::
++  told  ~2026.9.10..00.05.00
::  ~dev's DM request and its request in .room-nest, and ~wes's in
::  .room-nest, a minute apart, ~wes's the newest
::
++  asked
  ^-  state-7:t
  =/  s  fixture
  =.  approvals.s
    =/  one  (open:ask approvals.s 'd0001' [~dev ~ start])
    =/  two  (open:ask one 'c0001' [~dev `room-nest (add start ~m1)])
    (open:ask two 'c0002' [~wes `room-nest (add start ~m2)])
  s
::  The token the card of request .id in .s sends with its buttons
::
++  token
  |=  [s=state-7:t id=@t]
  ^-  @t
  (scot %uv (button-token:ask id (~(got by by-id.approvals.s) id)))
::  A DM post from .who
::
++  said
  |=  [who=@p text=@t at=@da]
  ^-  incoming-event:v8:a
  [%dm-post [[who at] at] [%ship who] ~[[%inline ~[text]]] |]
::  A channel post from .who that mentions the bot ahead of .text
::
++  addressed
  |=  [who=@p nest=nest:dv text=@t at=@da]
  ^-  incoming-event:v8:a
  [%post [[who at] at] nest [~lux %test] ~[[%inline ~[[%ship ~zod] ' ' text]]] &]
::  As +admit, with %chat holding .invited's DM invitations
::
++  admit-invited
  |=  [saved=state-7:t now=@da events=(list [@da incoming-event:v8:a]) invited=(set @p)]
  =/  m  (mare ,[(list card) state-7:t])
  ^-  form:m
  =/  events  (stream events)
  ;<  ~  bind:m  (boot saved now events)
  ;<  ~  bind:m
    %-  set-scry-gate
    |=  =path
    ?:  ?=([%gx @ %chat @ %dm %invited %ships ~] path)  `!>(invited)
    ((scries events) path)
  ;<  caz=(list card)  bind:m  (do-agent /activity [~zod %activity] [%watch-ack ~])
  ;<  =vase  bind:m  get-save
  (pure:m caz !<(state-7:t vase))
::  Acknowledge the one block in .caz with .ack, to the running adapter
::
++  ack-block
  |=  [caz=(list card) ack=(unit tang)]
  =/  m  (mare ,[(list card) state-7:t])
  ^-  form:m
  =/  wires  (turn (blocks caz) head)
  ?>  ?=([* ~] wires)
  ;<  out=(list card)  bind:m  (do-agent i.wires [~zod %chat] [%poke-ack ack])
  ;<  =vase  bind:m  get-save
  (pure:m out !<(state-7:t vase))
::  The replies to approval commands: where they go and their text.
::
++  answered
  |=  caz=(list card)
  ^-  (list [to=@t text=@t])
  %+  murn  caz
  |=  c=card
  ?.  ?=([%pass [%approval-reply @ ~] %agent * %poke *] c)  ~
  =/  =cage  cage.task.q.c
  ?:  =(%chat-dm-action-2 p.cage)
    =/  act  !<(action:dm:v7:cv q.cage)
    ?:  ?=(%reply -.q.q.act)
      =/  in-thread  delta.q.q.act
      ?>  ?=(%add -.in-thread)
      :-  ~
      :-  (address:policy-lib [%dm p.act `p.q.act])
      (story-to-text:story content.reply-essay.in-thread)
    ?>  ?=(%add -.q.q.act)
    `[(address:policy-lib [%dm p.act ~]) (story-to-text:story content.essay.q.q.act)]
  =/  act  ;;([%channel =nest:dv %post %add [=memo:v9:dv *]] q.q.cage)
  `[(address:policy-lib [%channel nest.act ~]) (story-to-text:story content.memo.act)]
::  The native blocks asked of %chat: their wires and ships.
::
++  blocks
  |=  caz=(list card)
  ^-  (list [wire @p])
  %+  murn  caz
  |=  c=card
  ?.  ?=([%pass * %agent [@ %chat] %poke %chat-block-ship *] c)  ~
  `[p.c !<(@p q.cage.task.q.c)]
::  The DM invitations accepted.
::
++  accepted
  |=  caz=(list card)
  ^-  (list [@p ?])
  %+  murn  caz
  |=  c=card
  ?.  ?=([%pass [%invite %dm @ ~] %agent [@ %chat] %poke %chat-dm-rsvp *] c)  ~
  `!<([@p ?] q.cage.task.q.c)
::  Whether any card hands the head work for a turn.
::
++  turned
  |=  caz=(list card)
  ^-  ?
  (lien caz |=(c=card ?=([%pass * %agent [@ %harness] %poke %harness-hand *] c)))
++  channel-ships
  |=  [s=state-7:t nest=nest:dv]
  ^-  (set @p)
  (fall (~(get by channel-grants.policy.s) nest) ~)
::  The turns admitted: speaker, destination and text.
::
++  admitted
  |=  s=state-7:t
  ^-  (list [@p destination:t @t])
  %+  turn  ~(val by jobs.s)
  |=(=job:t [actor to text]:input.job)
::  ~dev's DM as local %chat holds it: .posts, each still there or deleted
::
++  dm-page
  |=  posts=(list [at=@da text=@t live=?])
  ^-  paged-writs:v7:cv
  =/  w  *writ:v7:cv
  :_  [~ ~ 0 0]
  %+  gas:on:writs:v7:cv  ~
  %+  turn  posts
  |=  [at=@da text=@t live=?]
  ^-  [@da (may:v7:cv writ:v7:cv)]
  ?.  live  [at %| [~dev at] 1 at ~dev later]
  :+  at  %&
  [-.w(id [~dev at], time at) +.w(content ~[[%inline ~[text]]], author ~dev, sent at)]
::  As +scries, with ~dev's DM holding .page and local %channels holding
::  ~dev's posts .held in .room-nest and .all-nest, each still there or
::  deleted
::
++  holding
  |=  [events=stream:v10:a page=paged-writs:v7:cv held=(list [at=@da live=?])]
  |=  =path
  ^-  (unit vase)
  ?:  ?=([%gx @ %chat @ %v4 %dm %'~dev' %writs %newest *] path)  `!>(page)
  ?:  ?=([%gu @ %channels @ %v4 %chat %'~lux' %busy ~] path)  `!>(&)
  =/  parts=(list @ta)  path
  ?.  ?=([%gx @ %channels @ %v4 %chat %'~lux' @ %posts %older @ %'1' %outline %channel-posts-4 ~] path)
    ((scries events) path)
  ::  The exclusive upper bound names the one post read.
  =/  top  (dec (slav %ud (snag 10 parts)))
  =/  blank  *post:v9:dv
  =/  posts=(list [@da (may:v9:dv post:v9:dv)])
    %+  murn  held
    |=  [at=@da live=?]
    ?.  =(at top)  ~
    ?.  live  `[at %| [at ~dev 1 later]]
    `[at %& blank(id at, author ~dev)]
  `!>(`paged-posts:v9:dv`[(gas:on-posts:v9:dv ~ posts) ~ ~ 0 0])
::  Load .saved at .now, with local state as +holding has it, and deliver
::  .events through Activity catch-up
::
++  admit-holding
  |=  $:  saved=state-7:t  now=@da  events=(list [@da incoming-event:v8:a])
          page=paged-writs:v7:cv  held=(list [at=@da live=?])
      ==
  =/  m  (mare ,[(list card) state-7:t])
  ^-  form:m
  =/  events  (stream events)
  ;<  ~  bind:m  (boot saved now events)
  ;<  ~  bind:m  (set-scry-gate (holding events page held))
  ;<  caz=(list card)  bind:m  (do-agent /activity [~zod %activity] [%watch-ack ~])
  ;<  =vase  bind:m  get-save
  (pure:m caz !<(state-7:t vase))
::  As +admit-holding, with the head's ledger holding input from the source
::  events .taken, under a binding of its own
::
++  admit-taken
  |=  $:  saved=state-7:t  now=@da  events=(list [@da incoming-event:v8:a])
          page=paged-writs:v7:cv  taken=(list @t)
      ==
  =/  m  (mare ,[(list card) state-7:t])
  ^-  form:m
  =/  events  (stream events)
  =/  hands  *state:hh
  =.  observations.hands
    %-  malt
    %+  turn  taken
    |=  event=@t
    [(sham event) ['tlon-binding-old' event '~dev' 'earlier' start %completed]]
  ;<  ~  bind:m  (boot saved now events)
  ;<  ~  bind:m
    %-  set-scry-gate
    |=  =path
    ?:  (lien path |=(part=@ta =(%hand-state part)))  `!>(hands)
    ((holding events page ~) path)
  ;<  caz=(list card)  bind:m  (do-agent /activity [~zod %activity] [%watch-ack ~])
  ;<  =vase  bind:m  get-save
  (pure:m caz !<(state-7:t vase))
::  The head sets up the route of the one job in .s and takes its input, to
::  the running adapter, which then drops the job
::
++  observed
  |=  s=state-7:t
  =/  m  (mare ,state-7:t)
  ^-  form:m
  =/  jobs  ~(tap by jobs.s)
  ?>  ?=([* ~] jobs)
  =/  [id=@uv =job:t]  i.jobs
  =/  epoch  (scot %ud epoch:(~(got by lanes.s) sid.job))
  =/  done=sign:agent:gall  [%fact %noun !>(`(each json @t)`[%& ~])]
  ;<  *  bind:m  (do-agent /route/[sid.job]/[epoch]/create [~zod %harness] [%poke-ack ~])
  ;<  *  bind:m  (do-agent /hand/bind/(scot %uv id) [~zod %harness] done)
  ;<  *  bind:m  (do-agent /hand/observe/(scot %uv id) [~zod %harness] done)
  ;<  =vase  bind:m  get-save
  (pure:m !<(state-7:t vase))
::  %chat's acknowledgement of the bot's acceptance of ~dev's invitation, to
::  the running adapter, which then catches up on the DM
::
++  ack-acceptance
  =/  m  (mare ,state-7:t)
  ^-  form:m
  ;<  *  bind:m  (do-agent /invite/dm/(scot %p ~dev) [~zod %chat] [%poke-ack ~])
  ;<  =vase  bind:m  get-save
  (pure:m !<(state-7:t vase))
++  one-at  ~2026.9.10..00.01.00
++  two-at  ~2026.9.10..00.02.00
++  three-at  ~2026.9.10..00.03.00
::  ~dev's post in .room-nest that mentions the bot
::
++  mentioned
  |=  [text=@t at=@da]
  ^-  [@da incoming-event:v8:a]
  [at (addressed ~dev room-nest text at)]
++  mention-text
  |=  text=@t
  ^-  @t
  (story-to-text:story ~[[%inline ~[[%ship ~zod] ' ' text]]])
::
++  test-allow-of-a-dm-request-grants-dm-access-only-and-accepts-the-pending-invitation
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-7:t]  bind:m
    (admit-invited asked later ~[[told (said ~nec '/allow d0001' told)]] (silt ~[~dev]))
  ;<  ~  bind:m  (ex-equal !>(dm-grants.policy.s) !>((silt ~[~bus ~dev])))
  ;<  ~  bind:m  (ex-equal !>(channel-grants.policy.s) !>(channel-grants.policy:asked))
  ;<  ~  bind:m  (ex-equal !>(~(key by by-id.approvals.s)) !>((silt ~['c0001' 'c0002'])))
  ;<  ~  bind:m  (ex-equal !>((accepted caz)) !>(`(list [@p ?])`~[[~dev &]]))
  ;<  ~  bind:m
    %+  ex-equal  !>((answered caz))
    !>  ^-  (list [@t @t])
    ~[['dm/~nec' 'Approved DM access for ~dev. They will be able to message the bot.']]
  ;<  ~  bind:m  (ex-equal !>((kinds s 'approval-allowed')) !>(1))
  ::  %chat stamps the owner's join of the DM [our now] in the same event.
  =/  stamps=(list @da)
    %+  murn  caz
    |=  c=card
    ?.  ?=([%pass [%approval-reply @ ~] %agent * %poke %chat-dm-action-2 *] c)  ~
    `q.p.q:!<(action:dm:v7:cv q.cage.task.q.c)
  ;<  ~  bind:m  (ex-equal !>((levy stamps |=(at=@da (gth at later)))) !>(&))
  (ex-equal !>(wake.s) !>(`(add start (add ~h48 ~m1))))
++  test-allow-of-a-channel-request-grants-that-channel-only
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-7:t]  bind:m
    (admit asked later ~[[told (said ~nec '/allow c0001' told)]])
  ;<  ~  bind:m  (ex-equal !>((channel-ships s room-nest)) !>((silt ~[~dev])))
  ;<  ~  bind:m  (ex-equal !>(~(wyt by channel-grants.policy.s)) !>(1))
  ;<  ~  bind:m  (ex-equal !>(dm-grants.policy.s) !>(dm-grants.policy:asked))
  ;<  ~  bind:m  (ex-equal !>(~(key by by-id.approvals.s)) !>((silt ~['d0001' 'c0002'])))
  ;<  ~  bind:m  (ex-equal !>((accepted caz)) !>(`(list [@p ?])`~))
  ;<  ~  bind:m
    %+  ex-equal  !>((answered caz))
    !>  ^-  (list [@t @t])
    :~  :-  'dm/~nec'
        'Approved ~dev for Room in Lux group (chat/~lux/test). They will be able to interact in this channel.'
    ==
  ;<  ~  bind:m  (ex-equal !>(jobs.s) !>(`(map @uv job:t)`~))
  (ex-equal !>((turned caz)) !>(|))
::  ~dev wrote once and waited. Allowed, it gets one turn, in its DM, on that
::  message. Once the head has taken it, the catch-up after %chat accepts
::  the invitation answers it no second time.
::
++  test-allow-answers-a-waiting-dm-message-once
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-7:t]  bind:m
    %:  admit-holding  asked  later  ~[[told (said ~nec '/allow d0001' told)]]
        (dm-page ~[[one-at 'may I ask?' &]])  ~
    ==
  ;<  ~  bind:m
    %+  ex-equal  !>((admitted s))
    !>(`(list [@p destination:t @t])`~[[~dev [%dm ~dev ~] 'may I ask?']])
  ;<  ~  bind:m  (ex-equal !>((kinds s 'message')) !>(1))
  ;<  done=state-7:t  bind:m  (observed s)
  ;<  ~  bind:m  (ex-equal !>(jobs.done) !>(`(map @uv job:t)`~))
  ;<  w=state-7:t  bind:m  ack-acceptance
  ;<  ~  bind:m  (ex-equal !>(jobs.w) !>(`(map @uv job:t)`~))
  (ex-equal !>((kinds w 'message')) !>(1))
::  The allow answered ~dev's DM message A; ~dev lost its access, and a
::  settings save dropped its cutoff. A new request's allow does not answer
::  A again, though nothing but the head's ledger remembers it.
::
++  test-allow-answers-no-dm-message-an-earlier-allow-answered
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  granted  policy:asked
  =.  dm-grants.granted  (~(put in dm-grants.granted) ~dev)
  =/  a  (need (normalize-owned:policy-lib ~zod granted (said ~dev 'A' one-at) |=(@p |)))
  ;<  [caz=(list card) s=state-7:t]  bind:m
    %:  admit-taken  asked  later  ~[[told (said ~nec '/allow d0001' told)]]
        (dm-page ~[[one-at 'A' &]])  ~[event.a]
    ==
  ;<  ~  bind:m  (ex-equal !>(dm-grants.policy.s) !>((silt ~[~bus ~dev])))
  (ex-equal !>((admitted s)) !>(`(list [@p destination:t @t])`~))
::  In a channel that answers every message, an unaddressed post is no
::  attempt, so it is not what an allow answers.
::
++  test-allow-in-a-channel-answering-everything-answers-the-mention-not-a-later-comment
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  asked
  =.  approvals.saved  (open:ask approvals.saved 'c0003' [~dev `all-nest start])
  ;<  [caz=(list card) s=state-7:t]  bind:m
    %:  admit-holding  saved  later
        :~  [one-at (addressed ~dev all-nest 'the question' one-at)]
            [two-at (unmentioned ~dev all-nest two-at)]
            [told (said ~nec '/allow c0003' told)]
        ==
        (dm-page ~)  ~[[one-at &] [two-at &]]
    ==
  ;<  ~  bind:m  (ex-equal !>((channel-ships s all-nest)) !>((silt ~[~dev])))
  %+  ex-equal  !>((admitted s))
  !>  ^-  (list [@p destination:t @t])
  ~[[~dev [%channel all-nest ~] (mention-text 'the question')]]
++  test-allow-answers-only-the-newest-of-three-waiting-dm-messages
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-7:t]  bind:m
    %:  admit-holding  asked  later  ~[[told (said ~nec '/allow d0001' told)]]
        (dm-page ~[[one-at 'one' &] [two-at 'two' &] [three-at 'three' &]])  ~
    ==
  ;<  ~  bind:m
    %+  ex-equal  !>((admitted s))
    !>(`(list [@p destination:t @t])`~[[~dev [%dm ~dev ~] 'three']])
  ;<  w=state-7:t  bind:m  ack-acceptance
  (ex-equal !>((admitted w)) !>((admitted s)))
++  test-allow-answers-nothing-when-the-newest-dm-message-was-deleted
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-7:t]  bind:m
    %:  admit-holding  asked  later  ~[[told (said ~nec '/allow d0001' told)]]
        (dm-page ~[[one-at 'one' &] [two-at 'two' |]])  ~
    ==
  ;<  ~  bind:m  (ex-equal !>(dm-grants.policy.s) !>((silt ~[~bus ~dev])))
  (ex-equal !>((admitted s)) !>(`(list [@p destination:t @t])`~))
::  ~dev's DM grant was taken back at .two-at. What it wrote before then was
::  past its cutoff, never an attempt of this request.
::
++  test-allow-answers-no-dm-message-from-before-the-requests-cutoff
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  asked
  =.  place-cuts.saved  (~(put by place-cuts.saved) [~dev ~] two-at)
  ;<  [caz=(list card) s=state-7:t]  bind:m
    %:  admit-holding  saved  later  ~[[told (said ~nec '/allow d0001' told)]]
        (dm-page ~[[one-at 'before' &]])  ~
    ==
  ;<  ~  bind:m  (ex-equal !>(dm-grants.policy.s) !>((silt ~[~bus ~dev])))
  (ex-equal !>((admitted s)) !>(`(list [@p destination:t @t])`~))
++  test-allow-answers-a-waiting-channel-mention-once
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-7:t]  bind:m
    %:  admit-holding  asked  later
        ~[(mentioned 'may I ask?' one-at) [told (said ~nec '/allow c0001' told)]]
        (dm-page ~)  ~[[one-at &]]
    ==
  ;<  ~  bind:m
    %+  ex-equal  !>((admitted s))
    !>  ^-  (list [@p destination:t @t])
    ~[[~dev [%channel room-nest ~] (mention-text 'may I ask?')]]
  ;<  ~  bind:m  (ex-equal !>((kinds s 'message')) !>(1))
  ;<  *  bind:m  (observed s)
  ::  Activity kicks the adapter, which watches again and catches up.
  ;<  *  bind:m  (do-agent /activity [~zod %activity] [%kick ~])
  ;<  *  bind:m  (do-agent /activity [~zod %activity] [%watch-ack ~])
  ;<  =vase  bind:m  get-save
  =/  w  !<(state-7:t vase)
  ;<  ~  bind:m  (ex-equal !>(jobs.w) !>(`(map @uv job:t)`~))
  (ex-equal !>((kinds w 'message')) !>(1))
++  test-allow-answers-only-the-newest-of-three-waiting-channel-mentions
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-7:t]  bind:m
    %:  admit-holding  asked  later
        :~  (mentioned 'one' one-at)
            (mentioned 'two' two-at)
            (mentioned 'three' three-at)
            [told (said ~nec '/allow c0001' told)]
        ==
        (dm-page ~)  ~[[one-at &] [two-at &] [three-at &]]
    ==
  %+  ex-equal  !>((admitted s))
  !>  ^-  (list [@p destination:t @t])
  ~[[~dev [%channel room-nest ~] (mention-text 'three')]]
::  Activity still holds the deleted mention; local %channels has its
::  tombstone.
::
++  test-allow-answers-nothing-when-the-newest-channel-mention-was-deleted
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-7:t]  bind:m
    %:  admit-holding  asked  later
        ~[(mentioned 'one' one-at) (mentioned 'two' two-at) [told (said ~nec '/allow c0001' told)]]
        (dm-page ~)  ~[[one-at &] [two-at |]]
    ==
  ;<  ~  bind:m  (ex-equal !>((channel-ships s room-nest)) !>((silt ~[~dev])))
  (ex-equal !>((admitted s)) !>(`(list [@p destination:t @t])`~))
::  A settings save that gives ~dev its DM accepts the invitation as an
::  allow does, but leaves what ~dev wrote before unanswered.
::
++  test-a-settings-grant-answers-no-earlier-message
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  next  policy:asked
  =.  dm-grants.next  (~(put in dm-grants.next) ~dev)
  ;<  [caz=(list card) s=state-7:t]  bind:m  (configure asked next)
  ;<  ~  bind:m  (ex-equal !>((accepted caz)) !>(`(list [@p ?])`~[[~dev &]]))
  ;<  ~  bind:m  (ex-equal !>((admitted s)) !>(`(list [@p destination:t @t])`~))
  ;<  w=state-7:t  bind:m  ack-acceptance
  (ex-equal !>((admitted w)) !>(`(list [@p destination:t @t])`~))
++  test-reject-answers-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-7:t]  bind:m
    %:  admit-holding  asked  later
        ~[(mentioned 'hello' one-at) [told (said ~nec '/reject c0001' told)]]
        (dm-page ~[[one-at 'hello' &]])  ~[[one-at &]]
    ==
  ;<  ~  bind:m  (ex-equal !>((admitted s)) !>(`(list [@p destination:t @t])`~))
  ;<  [caz=(list card) s=state-7:t]  bind:m
    %:  admit-holding  asked  later  ~[[told (said ~nec '/reject d0001' told)]]
        (dm-page ~[[one-at 'hello' &]])  ~
    ==
  (ex-equal !>((admitted s)) !>(`(list [@p destination:t @t])`~))
::  The ship can ask again: its next message opens a new request.
::
++  test-reject-of-a-dm-request-grants-nothing-and-declines-the-pending-invitation
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-7:t]  bind:m
    (admit-invited asked later ~[[told (said ~nec '/reject d0001' told)]] (silt ~[~dev]))
  ;<  ~  bind:m  (ex-equal !>(policy.s) !>(policy:asked))
  ;<  ~  bind:m  (ex-equal !>(~(key by by-id.approvals.s)) !>((silt ~['c0001' 'c0002'])))
  ;<  ~  bind:m  (ex-equal !>((declined caz)) !>(`(list [@p ?])`~[[~dev |]]))
  ;<  ~  bind:m
    %+  ex-equal  !>((answered caz))
    !>(`(list [@t @t])`~[['dm/~nec' 'Denied DM request from ~dev.']])
  ;<  ~  bind:m  (ex-equal !>((kinds s 'approval-rejected')) !>(1))
  ;<  ~  bind:m  (ex-equal !>(wake.s) !>(`(add start (add ~h48 ~m1))))
  ;<  ~  bind:m  (ex-equal !>((turned caz)) !>(|))
  =/  again  ~2026.9.10..00.20.00
  ;<  [caz=(list card) w=state-7:t]  bind:m
    (admit s (add again ~s1) ~[[again (dm ~dev again)]])
  ;<  ~  bind:m  (ex-equal !>(?=(^ (find:ask approvals.w ~dev ~))) !>(&))
  (ex-equal !>((lent (sent caz))) !>(1))
++  test-reject-of-a-channel-request-grants-nothing-and-declines-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-7:t]  bind:m
    (admit-invited asked later ~[[told (said ~nec '/reject c0001' told)]] (silt ~[~dev]))
  ;<  ~  bind:m  (ex-equal !>(policy.s) !>(policy:asked))
  ;<  ~  bind:m  (ex-equal !>(~(key by by-id.approvals.s)) !>((silt ~['d0001' 'c0002'])))
  ;<  ~  bind:m  (ex-equal !>((declined caz)) !>(`(list [@p ?])`~))
  %+  ex-equal  !>((answered caz))
  !>(`(list [@t @t])`~[['dm/~nec' 'Denied ~dev for Room in Lux group (chat/~lux/test).']])
::  ~dev already holds a DM grant and asks in two channels; ~wes's request
::  stays. Nothing is done until %chat has the block.
::
++  test-ban-blocks-the-ship-natively-closes-all-its-requests-and-removes-its-dm-grant
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  asked
  =.  dm-grants.policy.saved  (~(put in dm-grants.policy.saved) ~dev)
  =.  approvals.saved
    =/  open  (close:ask approvals.saved 'd0001')
    (open:ask open 'c0003' [~dev `all-nest start])
  ;<  [caz=(list card) s=state-7:t]  bind:m
    (admit saved later ~[[told (said ~nec '/ban c0001' told)]])
  ;<  ~  bind:m  (ex-equal !>((turn (blocks caz) tail)) !>(`(list @p)`~[~dev]))
  ;<  ~  bind:m  (ex-equal !>(approvals.s) !>(approvals.saved))
  ;<  ~  bind:m  (ex-equal !>((answered caz)) !>(`(list [@t @t])`~))
  ;<  [out=(list card) w=state-7:t]  bind:m  (ack-block caz ~)
  ;<  ~  bind:m  (ex-equal !>(~(key by by-id.approvals.w)) !>((silt ~['c0002'])))
  ;<  ~  bind:m  (ex-equal !>(dm-grants.policy.w) !>(dm-grants.policy:asked))
  ;<  ~  bind:m  (ex-equal !>(allowed.policy.w) !>(allowed.policy.saved))
  ;<  ~  bind:m
    %+  ex-equal  !>((answered out))
    !>(`(list [@t @t])`~[['dm/~nec' 'Blocked ~dev. They will no longer be able to contact the bot.']])
  ;<  ~  bind:m  (ex-equal !>((kinds w 'approval-banned')) !>(1))
  (ex-equal !>(wake.w) !>(`(add start (add ~h48 ~m2))))
++  test-ban-of-a-dm-request-declines-the-pending-invitation
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-7:t]  bind:m
    (admit asked later ~[[told (said ~nec '/ban d0001' told)]])
  ;<  ~  bind:m  (boot s later *stream:v10:a)
  ;<  ~  bind:m
    %-  set-scry-gate
    |=  =path
    ?:  ?=([%gx @ %chat @ %dm %invited %ships ~] path)  `!>((silt ~[~dev]))
    ((scries *stream:v10:a) path)
  =/  wires  (turn (blocks caz) head)
  ?>  ?=([* ~] wires)
  ;<  out=(list card)  bind:m  (do-agent i.wires [~zod %chat] [%poke-ack ~])
  ;<  =vase  bind:m  get-save
  =/  w  !<(state-7:t vase)
  ;<  ~  bind:m  (ex-equal !>(~(key by by-id.approvals.w)) !>((silt ~['c0002'])))
  (ex-equal !>((declined out)) !>(`(list [@p ?])`~[[~dev |]]))
::  Two taps on Block: both see ~dev unblocked and ask %chat to block it.
::  The first block takes; the second is refused as already blocked, which
::  is the ban the owner asked for, not a failure.
::
++  test-a-second-ban-refused-as-already-blocked-is-told-as-a-ban
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-7:t]  bind:m
    %^  admit  asked  later
    =/  tap  (rap 3 '/ban c0001 ' (token asked 'c0001') ~)
    :~  [told (said ~nec tap told)]
        [(add told ~s1) (said ~nec tap (add told ~s1))]
    ==
  =/  wires  (turn (blocks caz) head)
  ?>  ?=([* * ~] wires)
  ;<  first=(list card)  bind:m  (do-agent i.wires [~zod %chat] [%poke-ack ~])
  ;<  ~  bind:m
    %-  set-scry-gate
    |=  =path
    ?:  ?=([%gx @ %chat @ %blocked %ships ~] path)  `!>((silt ~[~bel ~dev]))
    ((scries *stream:v10:a) path)
  ;<  second=(list card)  bind:m
    (do-agent i.t.wires [~zod %chat] [%poke-ack `~[leaf+"already blocked"]])
  ;<  =vase  bind:m  get-save
  =/  w  !<(state-7:t vase)
  ;<  ~  bind:m  (ex-equal !>(~(key by by-id.approvals.w)) !>((silt ~['c0002'])))
  ;<  ~  bind:m  (ex-equal !>((kinds w 'approval-ban-failed')) !>(0))
  =/  told-banned  'Blocked ~dev. They will no longer be able to contact the bot.'
  ;<  ~  bind:m  (ex-equal !>((answered first)) !>(`(list [@t @t])`~[['dm/~nec' told-banned]]))
  (ex-equal !>((answered second)) !>(`(list [@t @t])`~[['dm/~nec' told-banned]]))
::  A request must not look handled when the ship was never blocked.
::
++  test-a-refused-block-leaves-the-request-open-and-tells-the-owner
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-7:t]  bind:m
    (admit asked later ~[[told (said ~nec '/ban c0001' told)]])
  ;<  [out=(list card) w=state-7:t]  bind:m  (ack-block caz `~[leaf+"no"])
  ;<  ~  bind:m  (ex-equal !>(approvals.w) !>(approvals:asked))
  ;<  ~  bind:m  (ex-equal !>(policy.w) !>(policy:asked))
  ;<  ~  bind:m  (ex-equal !>((declined out)) !>(`(list [@p ?])`~))
  ;<  ~  bind:m  (ex-equal !>((kinds w 'approval-ban-failed')) !>(1))
  %+  ex-equal  !>((answered out))
  !>  ^-  (list [@t @t])
  ~[['dm/~nec' 'Could not block ~dev: block failed. Request stays pending, try again.']]
::  %chat crashes on a block it already has, so none is asked for.
::
++  test-ban-of-a-ship-already-blocked-asks-no-block-and-closes-its-requests
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  asked
  =.  approvals.saved  (open:ask approvals.saved 'c0004' [~bel `room-nest start])
  ;<  [caz=(list card) s=state-7:t]  bind:m
    (admit saved later ~[[told (said ~nec '/ban c0004' told)]])
  ;<  ~  bind:m  (ex-equal !>((blocks caz)) !>(`(list [wire @p])`~))
  ;<  ~  bind:m  (ex-equal !>(approvals.s) !>(approvals:asked))
  %+  ex-equal  !>((answered caz))
  !>(`(list [@t @t])`~[['dm/~nec' 'Blocked ~bel. They will no longer be able to contact the bot.']])
::  An id no request has, one a request had before it closed, and one whose
::  request expired before the wake removed it.
::
++  test-an-unknown-closed-or-expired-id-changes-nothing-and-gets-the-unknown-id-reply
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-7:t]  bind:m
    (admit asked later ~[[told (said ~nec '/allow d9999' told)]])
  ;<  ~  bind:m  (ex-equal !>(approvals.s) !>(approvals:asked))
  ;<  ~  bind:m  (ex-equal !>(policy.s) !>(policy:asked))
  ;<  ~  bind:m
    %+  ex-equal  !>((answered caz))
    !>(`(list [@t @t])`~[['dm/~nec' 'No pending approval found for ID: #d9999']])
  ;<  ~  bind:m  (ex-equal !>((turned caz)) !>(|))
  =/  closed  asked
  =.  approvals.closed  (close:ask approvals.closed 'd0001')
  ;<  [caz=(list card) s=state-7:t]  bind:m
    (admit closed later ~[[told (said ~nec '/ban d0001' told)]])
  ;<  ~  bind:m  (ex-equal !>(approvals.s) !>(approvals.closed))
  ;<  ~  bind:m  (ex-equal !>((blocks caz)) !>(`(list [wire @p])`~))
  ;<  ~  bind:m
    %+  ex-equal  !>((answered caz))
    !>(`(list [@t @t])`~[['dm/~nec' 'No pending approval found for ID: #d0001']])
  =/  late  (add start (add ~h48 ~m3))
  ;<  [caz=(list card) s=state-7:t]  bind:m
    (admit asked (add late ~s1) ~[[late (said ~nec '/allow c0001' late)]])
  ;<  ~  bind:m  (ex-equal !>(approvals.s) !>(*approvals:t))
  ;<  ~  bind:m  (ex-equal !>(policy.s) !>(policy:asked))
  %+  ex-equal  !>((answered caz))
  !>(`(list [@t @t])`~[['dm/~nec' 'No pending approval found for ID: #c0001']])
::  A reload catches up on the owner's command waiting in Activity without
::  the expiry each other event runs first; the overdue request is found
::  as no request.
::
++  test-a-command-caught-up-on-reload-acts-on-no-overdue-request
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  late  (add start (add ~h48 ~m3))
  =/  events  (stream ~[[late (said ~nec '/allow c0001' late)]])
  ;<  ~  bind:m
    (set-bowl %*(. *bowl our ~zod, src ~zod, now (add late ~s1), eny (shax 'approvals')))
  ;<  ~  bind:m  head-connected
  ;<  ~  bind:m
    %-  jab-bowl
    |=(b=bowl b(wex (~(put by wex.b) [/activity ~zod %activity] [& /v4])))
  ;<  ~  bind:m  (set-scry-gate (scries events))
  ;<  caz=(list card)  bind:m  (do-load adapter `!>(asked))
  ;<  =vase  bind:m  get-save
  =/  s  !<(state-7:t vase)
  ;<  ~  bind:m  (ex-equal !>(policy.s) !>(policy:asked))
  ;<  ~  bind:m  (ex-equal !>((kinds s 'approval-allowed')) !>(0))
  %+  ex-equal  !>((answered caz))
  !>(`(list [@t @t])`~[['dm/~nec' 'No pending approval found for ID: #c0001']])
::  ~bus has DM access, ~ryd is trusted, ~wes has no access. None of their
::  DM commands opens a request, records an attempt or starts a turn.
::
++  test-a-command-from-a-ship-that-is-not-the-owner-changes-nothing-and-gets-no-reply
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  asked
  =.  trusted.policy.saved  (my ~[[~ryd ~[%web]]])
  ;<  [caz=(list card) s=state-7:t]  bind:m
    %^  admit  saved  later
    :~  [told (said ~bus '/allow c0001' told)]
        [(add told ~s1) (said ~wes '/ban c0002' (add told ~s1))]
        [(add told ~s2) (said ~ryd '/allow c0001' (add told ~s2))]
        [(add told ~s3) (said ~bel '/reject d0001' (add told ~s3))]
    ==
  ;<  ~  bind:m  (ex-equal !>(approvals.s) !>(approvals:asked))
  ;<  ~  bind:m  (ex-equal !>(policy.s) !>(policy.saved))
  ;<  ~  bind:m  (ex-equal !>((answered caz)) !>(`(list [@t @t])`~))
  ;<  ~  bind:m  (ex-equal !>((sent caz)) !>(~))
  ;<  ~  bind:m  (ex-equal !>((blocks caz)) !>(`(list [wire @p])`~))
  ;<  ~  bind:m  (ex-equal !>((kinds s 'permission-denied')) !>(0))
  ;<  ~  bind:m  (ex-equal !>(jobs.s) !>(`(map @uv job:t)`~))
  (ex-equal !>((turned caz)) !>(|))
::  A channel post's author is what the channel's host reports, so even the
::  owner's command there is an ordinary message: the owner's mention is
::  admitted as a turn, ~dev's is an attempt that joins its open request.
::
++  test-a-command-in-a-channel-is-an-ordinary-message-even-from-the-owner
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  events
    %-  stream
    :~  [told (addressed ~nec room-nest '/allow c0001' told)]
        [(add told ~s1) (addressed ~dev room-nest '/allow c0001' (add told ~s1))]
    ==
  ;<  ~  bind:m  (boot asked later events)
  ::  Admission reads the owner's post to tell a bot's message; it is none.
  ;<  ~  bind:m
    %-  set-scry-gate
    |=  =path
    ?:  (lien path |=(part=@ta =(%older part)))  `!>(*paged-posts:v9:dv)
    ((scries events) path)
  ;<  caz=(list card)  bind:m  (do-agent /activity [~zod %activity] [%watch-ack ~])
  ;<  =vase  bind:m  get-save
  =/  s  !<(state-7:t vase)
  ;<  ~  bind:m  (ex-equal !>(approvals.s) !>(approvals:asked))
  ;<  ~  bind:m  (ex-equal !>(policy.s) !>(policy:asked))
  ;<  ~  bind:m  (ex-equal !>((answered caz)) !>(`(list [@t @t])`~))
  ;<  ~  bind:m  (ex-equal !>((sent caz)) !>(~))
  ;<  ~  bind:m
    %+  ex-equal  !>((turn ~(val by jobs.s) |=(=job:t actor.input.job)))
    !>(`(list @p)`~[~nec])
  (ex-equal !>((kinds s 'permission-denied')) !>(1))
::  The owner's command in a DM thread is answered in that thread.
::
++  test-a-command-in-a-dm-thread-is-carried-out-and-answered-in-the-thread
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  parent  ~2026.9.10..00.01.00
  =/  event=incoming-event:v8:a
    :*  %dm-reply  [[~nec told] told]  [[~zod parent] parent]  [%ship ~nec]
        ~[[%inline ~['/reject c0001']]]  |
    ==
  ;<  [caz=(list card) s=state-7:t]  bind:m  (admit asked later ~[[told event]])
  ;<  ~  bind:m  (ex-equal !>(~(key by by-id.approvals.s)) !>((silt ~['d0001' 'c0002'])))
  ;<  ~  bind:m
    %+  ex-equal  !>((answered caz))
    !>  ^-  (list [@t @t])
    :~  :-  (address:policy-lib [%dm ~nec `[~zod parent]])
        'Denied ~dev for Room in Lux group (chat/~lux/test).'
    ==
  (ex-equal !>((turned caz)) !>(|))
::  The card's Allow button sends its text as the owner's DM post; Activity
::  reports that post as it reports a typed one.
::
++  test-a-cards-allow-button-has-the-effect-of-the-typed-command
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-7:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (mention ~dev room-nest ~2026.9.9..12.00.00)]])
  =/  cards  (sent caz)
  ?>  ?=([* ~] cards)
  =/  allow  (head (buttons blob.i.cards))
  ;<  ~  bind:m  (ex-equal !>(label.allow) !>('Allow'))
  ;<  [caz=(list card) w=state-7:t]  bind:m
    (admit s later ~[[told (said ~nec text.allow told)]])
  ;<  ~  bind:m  (ex-equal !>(approvals.w) !>(*approvals:t))
  ;<  ~  bind:m  (ex-equal !>((channel-ships w room-nest)) !>((silt ~[~dev])))
  ;<  ~  bind:m  (ex-equal !>((lent (answered caz))) !>(1))
  (ex-equal !>((turned caz)) !>(|))
::  The owner's DM post of .content, which shows a command rather than
::  giving it: nothing runs and nothing is answered.
::
++  runs-nothing
  |=  content=story:v9:dv
  =/  m  (mare ,~)
  ^-  form:m
  =/  =incoming-event:v8:a  [%dm-post [[~nec told] told] [%ship ~nec] content |]
  ;<  [caz=(list card) s=state-7:t]  bind:m  (admit asked later ~[[told incoming-event]])
  ;<  ~  bind:m  (ex-equal !>(approvals.s) !>(approvals:asked))
  ;<  ~  bind:m  (ex-equal !>(policy.s) !>(policy:asked))
  (ex-equal !>((answered caz)) !>(`(list [@t @t])`~))
++  test-a-command-in-inline-code-does-not-run
  %-  eval-mare
  (runs-nothing ~[[%inline ~[[%inline-code '/allow c0001']]]])
++  test-a-command-in-a-blockquote-does-not-run
  %-  eval-mare
  (runs-nothing ~[[%inline ~[[%blockquote ~['/allow c0001']]]]])
::  The command is outside the code block, and its text comes first.
::
++  test-a-command-beside-a-code-block-does-not-run
  %-  eval-mare
  (runs-nothing ~[[%inline ~['/allow c0001']] [%block %code 'echo' '']])
++  test-a-command-in-inline-code-in-a-heading-does-not-run
  %-  eval-mare
  (runs-nothing ~[[%block %header %h2 ~[[%inline-code '/allow c0001']]]])
++  test-a-command-in-inline-code-in-a-list-does-not-run
  %-  eval-mare
  %-  runs-nothing
  ~[[%block %listing [%list %unordered ~[[%item ~[[%inline-code '/allow c0001']]]] ~]]]
::  A stale card's button: its request closed and a later request got its
::  id, ~wes's or ~dev's own in another channel, or its id begins a longer
::  open id. None acts.
::
++  test-a-button-acts-only-on-the-request-its-card-was-made-for
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  tapped  (rap 3 '/allow c0001 ' (token asked 'c0001') ~)
  =/  recycled  asked
  =.  approvals.recycled
    (open:ask (close:ask approvals.recycled 'c0001') 'c0001' [~wes `all-nest start])
  ;<  [caz=(list card) s=state-7:t]  bind:m
    (admit recycled later ~[[told (said ~nec tapped told)]])
  ;<  ~  bind:m  (ex-equal !>(approvals.s) !>(approvals.recycled))
  ;<  ~  bind:m  (ex-equal !>(policy.s) !>(policy:asked))
  ;<  ~  bind:m
    %+  ex-equal  !>((answered caz))
    !>(`(list [@t @t])`~[['dm/~nec' 'No pending approval found for ID: #c0001']])
  =/  moved  asked
  =.  approvals.moved
    (open:ask (close:ask approvals.moved 'c0001') 'c0001' [~dev `all-nest (add start ~m6)])
  ;<  [caz=(list card) s=state-7:t]  bind:m
    (admit moved later ~[[told (said ~nec tapped told)]])
  ;<  ~  bind:m  (ex-equal !>(approvals.s) !>(approvals.moved))
  ;<  ~  bind:m  (ex-equal !>(policy.s) !>(policy:asked))
  ;<  ~  bind:m
    %+  ex-equal  !>((answered caz))
    !>(`(list [@t @t])`~[['dm/~nec' 'No pending approval found for ID: #c0001']])
  =/  extended  asked
  =.  approvals.extended
    (open:ask (close:ask approvals.extended 'c0001') 'c00011234' [~dev `room-nest start])
  ;<  [caz=(list card) s=state-7:t]  bind:m
    (admit extended later ~[[told (said ~nec (rap 3 '/ban c0001 ' (token asked 'c0001') ~) told)]])
  ;<  ~  bind:m  (ex-equal !>(approvals.s) !>(approvals.extended))
  ;<  ~  bind:m  (ex-equal !>((blocks caz)) !>(`(list [wire @p])`~))
  ;<  ~  bind:m
    %+  ex-equal  !>((answered caz))
    !>(`(list [@t @t])`~[['dm/~nec' 'No pending approval found for ID: #c0001']])
  ;<  [caz=(list card) s=state-7:t]  bind:m
    (admit extended later ~[[told (said ~nec '/reject c0001' told)]])
  (ex-equal !>(~(key by by-id.approvals.s)) !>((silt ~['d0001' 'c0002'])))
::  With several open, unlike OpenClaw, a bare command acts on none and
::  lists them; with one, it acts on that one; with none, it says so.
::
++  test-a-command-without-an-id-acts-only-on-the-only-request
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-7:t]  bind:m
    (admit asked later ~[[told (said ~nec '/allow' told)]])
  ;<  ~  bind:m  (ex-equal !>(approvals.s) !>(approvals:asked))
  ;<  ~  bind:m  (ex-equal !>(policy.s) !>(policy:asked))
  ;<  ~  bind:m
    %+  ex-equal  !>((answered caz))
    !>  ^-  (list [@t @t])
    :~  :-  'dm/~nec'
        %+  rap  3
        :~  'More than one approval is pending. Send the command again with an ID:'
            '\0ad0001 ~dev dm/~dev'
            '\0ac0001 ~dev chat/~lux/test'
            '\0ac0002 ~wes chat/~lux/test'
        ==
    ==
  =/  single  asked
  =.  approvals.single  (close:ask (close:ask approvals.single 'd0001') 'c0001')
  ;<  [caz=(list card) s=state-7:t]  bind:m
    (admit single later ~[[told (said ~nec '/reject' told)]])
  ;<  ~  bind:m  (ex-equal !>(approvals.s) !>(*approvals:t))
  ;<  ~  bind:m
    %+  ex-equal  !>((answered caz))
    !>(`(list [@t @t])`~[['dm/~nec' 'Denied ~wes for Room in Lux group (chat/~lux/test).']])
  ;<  [caz=(list card) w=state-7:t]  bind:m
    (admit fixture later ~[[told (said ~nec '/reject' told)]])
  %+  ex-equal  !>((answered caz))
  !>(`(list [@t @t])`~[['dm/~nec' 'No pending approval found.']])
::
::  The bot tells a ship whose channel mention opened a request that it waits
::  for its owner, once the owner's card is acknowledged.
::
++  waits-sent
  '~dev: I need approval from my owner, ~nec, before I can respond in this channel — I\'ve sent them the request.'
++  waits-unsent
  '~dev: I need approval from my owner, ~nec, before I can respond in this channel. I couldn\'t reach them just now — please mention me again later.'
::  The replies that tell a ship the bot waits: where they go and their text.
::
++  waiting
  |=  caz=(list card)
  ^-  (list [to=@t text=@t])
  %+  murn  caz
  |=  c=card
  ?.  ?=([%pass [%approval-waiting @ ~] %agent [@ %channels] %poke %channel-action-2 *] c)  ~
  =/  act=*  q.q.cage.task.q.c
  ?:  ?=([%channel * %post %reply *] act)
    =/  in  ;;([%channel =nest:dv %post %reply parent=@da %add [=memo:v9:dv *]] act)
    :-  ~
    :-  (address:policy-lib [%channel nest.in `parent.in])
    (story-to-text:story content.memo.in)
  =/  in  ;;([%channel =nest:dv %post %add [=memo:v9:dv *]] act)
  `[(address:policy-lib [%channel nest.in ~]) (story-to-text:story content.memo.in)]
::  %chat's acknowledgement of the one card in .caz, with .ack, to the
::  running adapter
::
++  ack-card
  |=  [caz=(list card) ack=(unit tang)]
  =/  m  (mare ,[(list card) state-7:t])
  ^-  form:m
  =/  wires
    %+  murn  caz
    |=(c=card ?.(?=([%pass [%approval @ @ *] %agent [@ %chat] *] c) ~ `p.c))
  ?>  ?=([* ~] wires)
  ;<  out=(list card)  bind:m  (do-agent i.wires [~zod %chat] [%poke-ack ack])
  ;<  =vase  bind:m  get-save
  (pure:m out !<(state-7:t vase))
::
++  test-a-first-channel-mention-without-access-is-told-the-bot-waits-for-its-owner
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-7:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (mention ~dev room-nest ~2026.9.9..12.00.00)]])
  ;<  ~  bind:m  (ex-equal !>((waiting caz)) !>(`(list [@t @t])`~))
  ;<  [out=(list card) w=state-7:t]  bind:m  (ack-card caz ~)
  ;<  ~  bind:m
    (ex-equal !>((waiting out)) !>(`(list [@t @t])`~[['chat/~lux/test' waits-sent]]))
  (ex-equal !>(approvals.w) !>(approvals.s))
::  After the denial limit, so only the open request keeps it from being
::  told again.
::
++  test-a-second-mention-while-the-request-is-open-is-told-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) *]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (mention ~dev room-nest ~2026.9.9..12.00.00)]])
  ;<  [* s=state-7:t]  bind:m  (ack-card caz ~)
  ;<  [caz=(list card) w=state-7:t]  bind:m
    (admit s later ~[[~2026.9.10..00.05.00 (mention ~dev room-nest ~2026.9.10..00.05.00)]])
  ;<  ~  bind:m  (ex-equal !>((kinds w 'permission-denied')) !>(2))
  ;<  ~  bind:m  (ex-equal !>((sent caz)) !>(~))
  (ex-equal !>((waiting caz)) !>(`(list [@t @t])`~))
++  test-a-mention-in-a-thread-is-told-in-that-thread
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) *]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (reply ~dev room-nest ~2026.9.9..12.00.00)]])
  ;<  [out=(list card) *]  bind:m  (ack-card caz ~)
  %+  ex-equal  !>((waiting out))
  =/  thread  (address:policy-lib [%channel room-nest `~2026.9.9..10.00.00])
  !>(`(list [@t @t])`~[[thread waits-sent]])
++  test-a-blocked-ship-is-told-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) *]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (mention ~bel room-nest ~2026.9.9..12.00.00)]])
  ;<  ~  bind:m  (ex-equal !>((sent caz)) !>(~))
  (ex-equal !>((waiting caz)) !>(`(list [@t @t])`~))
::  A known bot's request opens and its owner is sent the card; the bot is
::  told nothing, so two bots without access to each other cannot trade
::  replies.
::
++  test-a-known-bot-is-told-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  at  ~2026.9.9..12.00.00
  =/  events  (stream ~[[at (mention ~dev room-nest at)]])
  ;<  ~  bind:m  (boot fixture start events)
  ;<  ~  bind:m
    %-  set-scry-gate
    |=  =path
    ?.  ?=([%gx @ %channels @ %v4 %chat %'~lux' %test %posts *] path)
      ((scries events) path)
    =/  blank  *post:v9:dv
    =/  post=post:v9:dv  blank(id at, author [~dev ~ ~])
    `!>(`paged-posts:v9:dv`[(gas:on-posts:v9:dv ~ ~[[at %& post]]) ~ ~ 0 0])
  ;<  caz=(list card)  bind:m  (do-agent /activity [~zod %activity] [%watch-ack ~])
  ;<  ~  bind:m  (ex-equal !>((lent (sent caz))) !>(1))
  ;<  [out=(list card) *]  bind:m  (ack-card caz ~)
  (ex-equal !>((waiting out)) !>(`(list [@t @t])`~))
++  test-a-dm-is-told-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) *]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (dm ~dev ~2026.9.9..12.00.00)]])
  ;<  ~  bind:m  (ex-equal !>((lent (sent caz))) !>(1))
  ;<  [out=(list card) *]  bind:m  (ack-card caz ~)
  ::  Nothing is posted anywhere, by DM or in a channel.
  %+  ex-equal
    !>((lien out |=(c=card ?=([%pass * %agent [@ ?(%chat %channels)] %poke *] c))))
  !>(|)
::  The rejected card closes the request, so the next mention opens it again.
::
++  test-a-mention-whose-card-is-rejected-is-told-to-mention-the-bot-again
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) *]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (mention ~dev room-nest ~2026.9.9..12.00.00)]])
  ;<  [out=(list card) w=state-7:t]  bind:m  (ack-card caz `~[leaf+"no"])
  ;<  ~  bind:m  (ex-equal !>(approvals.w) !>(*approvals:t))
  (ex-equal !>((waiting out)) !>(`(list [@t @t])`~[['chat/~lux/test' waits-unsent]]))
++  test-a-refused-waiting-reply-leaves-the-request-open
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-7:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (mention ~dev room-nest ~2026.9.9..12.00.00)]])
  ;<  [out=(list card) *]  bind:m  (ack-card caz ~)
  =/  wires
    %+  murn  out
    |=(c=card ?.(?=([%pass [%approval-waiting @ ~] *] c) ~ `p.c))
  ?>  ?=([* ~] wires)
  ;<  *  bind:m  (do-agent i.wires [~zod %channels] [%poke-ack `~[leaf+"no"]])
  ;<  =vase  bind:m  get-save
  =/  w  !<(state-7:t vase)
  ;<  ~  bind:m  (ex-equal !>(approvals.w) !>(approvals.s))
  (ex-equal !>(=('' error.w)) !>(|))
--
