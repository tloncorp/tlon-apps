::  Group invite requests: an invite to a group from a ship without
::  ship-wide access opens one request for the group, and the owner is sent
::  one card for it. Full adapter, synthetic scries only; no emitted cards
::  are executed.
::  -test /=harness=/tests-integration/harness-tlon-group-approvals
/-  t=harness-tlon, g=groups-ver, a=activity-ver, hh=harness-hand,
    dv=channels-ver, cv=chat-ver
/+  *test-agent, policy-lib=harness-tlon-policy, story=harness-tlon-story,
    ask=harness-tlon-approval
/=  adapter  /app/harness-tlon
|%
++  club  `flag:g`[~lux %club]
++  room-nest  `nest:dv`[%chat ~lux %test]
++  start  ~2026.9.10
++  later  ~2026.9.10..00.10.00
++  told  ~2026.9.10..00.05.00
++  comet  `@p`(bex 100)
::  ~nec owns the bot and ~wes is on the allowed list; ~dev, ~bus and ~bel
::  have no ship-wide access, ~bus holds a DM grant, and the bot blocks ~bel.
::
++  fixture
  ^-  state-6:t
  =/  s=state-6:t  *state-6:t
  =.  owner-initialized.s  1
  =.  activity-through.s  ~2026.9.9
  =.  policy.s  [& `~nec ~ %mentions (silt ~[~wes]) ~ (silt ~[~bus]) ~]
  s
::  ~dev's request for .club, opened at .start
::
++  asked
  ^-  state-6:t
  =/  s  fixture
  s(approvals (open:ask *approvals:t 'g0001' [~dev [%group club] start]))
::  The group the bot was invited to and has joined: .room-nest, whose
::  members are ~dev and ~bus
::
++  room-group
  ^-  group:v9:g
  =/  group  *group:v9:g
  =.  seats.group
    %-  malt
    %+  turn  `(list @p)`~[~dev ~bus]
    |=(who=@p [who `seat:v9:g`[~ ~2026.9.9]])
  =/  room  *channel:v9:g
  =.  title.meta.room  'Room'
  =.  title.meta.group  'Club'
  group(channels (my ~[[room-nest room]]))
::  .club's record on the ship: its preview, and its invite while .pending,
::  as a decline leaves it
::
++  invites
  |=  pending=?
  ^-  foreigns:v8:g
  =/  =preview:v8:g  *preview:v8:g
  =.  title.meta.preview  'Club'
  =/  =invite:v8:g  *invite:v8:g
  =.  invite  invite(flag club, from ~dev, preview preview, valid &)
  (my ~[[club `foreign:v8:g`[?:(pending ~[invite] ~) ~ `preview ~ ~]]])
++  head-connected
  %-  jab-bowl
  |=  b=bowl
  b(wex (~(put by wex.b) [/head ~zod %harness] [& /hand-events]))
++  invite
  |=  who=@p
  ^-  incoming-event:v8:a
  [%group-invite club who]
++  mention
  |=  [who=@p at=@da]
  ^-  incoming-event:v8:a
  [%post [[who at] at] room-nest [~lux %club] ~[[%inline ~[[%ship ~zod] ' hello']]] &]
++  said
  |=  [who=@p text=@t at=@da]
  ^-  incoming-event:v8:a
  [%dm-post [[who at] at] [%ship who] ~[[%inline ~[text]]] |]
++  stream
  |=  events=(list [at=@da event=incoming-event:v8:a])
  ^-  stream:v10:a
  %+  roll  events
  |=  [[at=@da event=incoming-event:v8:a] =stream:v10:a]
  (put:on-stream:v10:a stream at [event | |])
::  The ship's agents, with .club's invite on the ship while .pending
::
++  scries
  |=  [events=stream:v10:a pending=?]
  |=  =path
  ^-  (unit vase)
  ?:  ?=([%gu @ %contacts @ %$ ~] path)  `!>(|)
  ?:  ?=([%gu @ %groups @ %$ ~] path)  `!>(&)
  ?:  ?=([%gu @ %steward @ %$ ~] path)  `!>(|)
  ?:  ?=([%gu @ %channels @ %v4 %chat %'~lux' %test ~] path)  `!>(&)
  ?:  ?=([%gu @ %chat @ %dm @ ~] path)  `!>(|)
  ?:  ?=([%gx @ %groups @ %v1 %foreigns %noun ~] path)  `!>((invites pending))
  ?:  (lien path |=(part=@ta =(%can-read part)))  `!>(|=([who=@p *] &))
  ?:  (lien path |=(part=@ta =(%groups part)))  `!>((my ~[[club room-group]]))
  ?:  (lien path |=(part=@ta =(%cron-session part)))  `!>(~)
  ?:  ?=([%gu @ %channels @ %v4 *] path)  `!>(|)
  ?:  =(%$ (rear path))  `!>(&)
  ?:  ?=([%gx @ %chat @ %dm %invited %ships ~] path)  `!>(`(set @p)`~)
  ?:  ?=([%gx @ %chat @ %blocked %ships ~] path)  `!>((silt ~[~bel]))
  ?:  ?=([%gx @ %activity @ %v6 %all %noun ~] path)  `!>(events)
  ?:  ?=([%gx @ %channels @ %v4 @ @ @ %posts *] path)
    `!>(*paged-posts:v9:dv)
  ?:  (lien path |=(part=@ta =(%hand-state part)))  `!>(*state:hh)
  ?:  ?=([%gx @ %harness @ %sessions %json ~] path)  `!>(`json`[%a ~])
  ~
++  boot
  |=  [saved=state-6:t now=@da events=stream:v10:a pending=?]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (set-bowl %*(. *bowl our ~zod, src ~zod, now now, eny (shax 'groups')))
  ;<  ~  bind:m  head-connected
  ;<  ~  bind:m  (set-scry-gate (scries events pending))
  ;<  *  bind:m  (do-load adapter `!>(saved))
  head-connected
::  Load .saved at .now, then deliver .events through Activity catch-up,
::  with .club's invite on the ship
::
++  admit
  |=  [saved=state-6:t now=@da events=(list [@da incoming-event:v8:a])]
  =/  m  (mare ,[(list card) state-6:t])
  ^-  form:m
  ;<  ~  bind:m  (boot saved now (stream events) &)
  ;<  caz=(list card)  bind:m  (do-agent /activity [~zod %activity] [%watch-ack ~])
  ;<  =vase  bind:m  get-save
  (pure:m caz !<(state-6:t vase))
::  %groups' acknowledgement, with .ack, of the one decline in .caz, while
::  .club's invite is on the ship if .pending
::
++  ack-decline
  |=  [caz=(list card) ack=(unit tang) pending=?]
  =/  m  (mare ,[(list card) state-6:t])
  ^-  form:m
  =/  wires  (turn (declines caz) head)
  ?>  ?=([* ~] wires)
  ;<  ~  bind:m  (set-scry-gate (scries *stream:v10:a pending))
  ;<  out=(list card)  bind:m  (do-agent i.wires [~zod %groups] [%poke-ack ack])
  ;<  =vase  bind:m  get-save
  (pure:m out !<(state-6:t vase))
::  %chat's acknowledgement of the one block in .caz
::
++  ack-block
  |=  caz=(list card)
  =/  m  (mare ,[(list card) state-6:t])
  ^-  form:m
  =/  wires
    %+  murn  caz
    |=  c=card
    ?.  ?=([%pass * %agent [@ %chat] %poke %chat-block-ship *] c)  ~
    `p.c
  ?>  ?=([* ~] wires)
  ;<  out=(list card)  bind:m  (do-agent i.wires [~zod %chat] [%poke-ack ~])
  ;<  =vase  bind:m  get-save
  (pure:m out !<(state-6:t vase))
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
::  The groups joined.
::
++  joins
  |=  caz=(list card)
  ^-  (list flag:g)
  %+  murn  caz
  |=  c=card
  ?.  ?=([%pass * %agent [@ %groups] %poke %group-join *] c)  ~
  `-:!<([flag:g ?] q.cage.task.q.c)
::  The group invites declined: their wires and groups.
::
++  declines
  |=  caz=(list card)
  ^-  (list [wire flag:g])
  %+  murn  caz
  |=  c=card
  ?.  ?=([%pass * %agent [@ %groups] %poke %invite-decline *] c)  ~
  `[p.c !<(flag:g q.cage.task.q.c)]
::  The native blocks asked of %chat.
::
++  blocks
  |=  caz=(list card)
  ^-  (list @p)
  %+  murn  caz
  |=  c=card
  ?.  ?=([%pass * %agent [@ %chat] %poke %chat-block-ship *] c)  ~
  `!<(@p q.cage.task.q.c)
::  The replies to approval commands: where they go and their text.
::
++  answered
  |=  caz=(list card)
  ^-  (list [to=@t text=@t])
  %+  murn  caz
  |=  c=card
  ?.  ?=([%pass [%approval-reply @ ~] %agent * %poke *] c)  ~
  =/  act  !<(action:dm:v7:cv q.cage.task.q.c)
  ?>  ?=(%add -.q.q.act)
  `[(address:policy-lib [%dm p.act ~]) (story-to-text:story content.essay.q.q.act)]
::  Whether any card hands the head work for a turn.
::
++  turned
  |=  caz=(list card)
  ^-  ?
  (lien caz |=(c=card ?=([%pass * %agent [@ %harness] %poke %harness-hand *] c)))
++  kinds
  |=  [s=state-6:t kind=@t]
  ^-  @ud
  (lent (skim notices.s |=(n=notice:t =(kind kind.n))))
++  requests
  |=  s=state-6:t
  ^-  (list approval:t)
  ~(val by by-id.approvals.s)
++  dig
  |=  [=json keys=(list @t)]
  ^-  ^json
  ?~  keys  json
  ?>  ?=(%o -.json)
  $(json (~(got by p.json) i.keys), keys t.keys)
::  Whether any component of the card's A2UI update says .words.
::
++  says
  |=  [blob=@t words=@t]
  ^-  ?
  =/  parsed  (need (de:json:html blob))
  ?>  ?=([%a [%o *] ~] parsed)
  =/  messages  (dig i.p.parsed ~['messages'])
  ?>  ?=([%a * * ~] messages)
  =/  parts  (dig i.t.p.messages ~['updateComponents' 'components'])
  ?>  ?=(%a -.parts)
  %+  lien  p.parts
  |=  c=json
  ?>  ?=(%o -.c)
  =(`[%s words] (~(get by p.c) 'text'))
++  label  'Club (~lux/club)'
::
++  test-a-group-invite-from-a-ship-without-ship-wide-access-sends-the-owner-one-card
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-6:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (invite ~dev)]])
  ;<  ~  bind:m  (ex-equal !>((requests s)) !>(`(list approval:t)`~[[~dev [%group club] start]]))
  ;<  ~  bind:m  (ex-equal !>((cut 3 [0 1] (head ~(tap in ~(key by by-id.approvals.s))))) !>('g'))
  ;<  ~  bind:m  (ex-equal !>((joins caz)) !>(`(list flag:g)`~))
  =/  cards  (sent caz)
  ?>  ?=([* ~] cards)
  ;<  ~  bind:m  (ex-equal !>(to.i.cards) !>(~nec))
  ;<  ~  bind:m
    (ex-equal !>(text.i.cards) !>((cat 3 'Group invite request from ~dev for ' label)))
  ;<  ~  bind:m  (ex-equal !>((says blob.i.cards 'Group invite')) !>(&))
  ;<  ~  bind:m  (ex-equal !>((says blob.i.cards 'Let the bot join Club?')) !>(&))
  ;<  ~  bind:m  (ex-equal !>((says blob.i.cards 'Inviter: ~dev')) !>(&))
  ;<  ~  bind:m  (ex-equal !>((says blob.i.cards (cat 3 'Group: ' label))) !>(&))
  (ex-equal !>((kinds s 'approval-request')) !>(1))
::  From the inviter again, then from another ship: one request per group.
::
++  test-a-second-invite-to-the-group-from-any-ship-sends-no-card
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [* s=state-6:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (invite ~dev)]])
  ;<  ~  bind:m  (ex-equal !>((lent (requests s))) !>(1))
  ;<  [caz=(list card) w=state-6:t]  bind:m
    %^  admit  s  later
    :~  [~2026.9.10..00.06.00 (invite ~dev)]
        [~2026.9.10..00.07.00 (invite ~bus)]
    ==
  ;<  ~  bind:m  (ex-equal !>((sent caz)) !>(`(list [@p @t @t])`~))
  ;<  ~  bind:m  (ex-equal !>((joins caz)) !>(`(list flag:g)`~))
  (ex-equal !>(approvals.w) !>(approvals.s))
++  test-an-invite-from-the-owner-or-a-ship-on-the-ship-wide-list-joins-without-a-card
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-6:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (invite ~wes)]])
  ;<  ~  bind:m  (ex-equal !>((joins caz)) !>(`(list flag:g)`~[club]))
  ;<  ~  bind:m  (ex-equal !>((sent caz)) !>(`(list [@p @t @t])`~))
  ;<  ~  bind:m  (ex-equal !>(approvals.s) !>(*approvals:t))
  ;<  [caz=(list card) s=state-6:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (invite ~nec)]])
  ;<  ~  bind:m  (ex-equal !>((joins caz)) !>(`(list flag:g)`~[club]))
  (ex-equal !>(approvals.s) !>(*approvals:t))
++  test-an-invite-from-a-blocked-ship-or-a-comet-opens-no-request
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-6:t]  bind:m
    %^  admit  fixture  start
    :~  [~2026.9.9..12.00.00 (invite ~bel)]
        [~2026.9.9..12.00.01 (invite comet)]
    ==
  ;<  ~  bind:m  (ex-equal !>(approvals.s) !>(*approvals:t))
  ;<  ~  bind:m  (ex-equal !>((sent caz)) !>(`(list [@p @t @t])`~))
  (ex-equal !>((joins caz)) !>(`(list flag:g)`~))
::  Allowing stores no grant, so after the join neither the inviter nor
::  another member of the group is answered in its channel: each mention
::  opens a request of its own instead.
::
++  test-allow-joins-the-group-and-gives-the-inviter-and-the-members-no-access
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-6:t]  bind:m
    (admit asked later ~[[told (said ~nec '/allow g0001' told)]])
  ;<  ~  bind:m  (ex-equal !>((joins caz)) !>(`(list flag:g)`~[club]))
  ;<  ~  bind:m  (ex-equal !>(approvals.s) !>(*approvals:t))
  ;<  ~  bind:m  (ex-equal !>(policy.s) !>(policy:asked))
  ;<  ~  bind:m  (ex-equal !>((turned caz)) !>(|))
  ;<  ~  bind:m  (ex-equal !>((kinds s 'approval-allowed')) !>(1))
  ;<  ~  bind:m
    %+  ex-equal  !>((answered caz))
    !>  ^-  (list [@t @t])
    ~[['dm/~nec' (rap 3 'Approved group invite from ~dev to ' label '. Joining group...' ~)]]
  =/  next  ~2026.9.10..00.20.00
  ;<  [caz=(list card) w=state-6:t]  bind:m
    %^  admit  s  (add next ~s1)
    :~  [next (mention ~dev next)]
        [(add next ~s1) (mention ~bus (add next ~s1))]
    ==
  ;<  ~  bind:m  (ex-equal !>((turned caz)) !>(|))
  ;<  ~  bind:m  (ex-equal !>(jobs.w) !>(jobs.s))
  %+  ex-equal
    !>((silt (turn (requests w) |=(=approval:t [who topic]:approval))))
  !>((silt `(list [@p topic:t])`~[[~dev %place `room-nest] [~bus %place `room-nest]]))
::  Nothing changes until %groups has the decline.
::
++  test-reject-declines-the-invite-and-closes-the-request
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-6:t]  bind:m
    (admit asked later ~[[told (said ~nec '/reject g0001' told)]])
  ;<  ~  bind:m  (ex-equal !>((turn (declines caz) tail)) !>(`(list flag:g)`~[club]))
  ;<  ~  bind:m  (ex-equal !>(approvals.s) !>(approvals:asked))
  ;<  ~  bind:m  (ex-equal !>((answered caz)) !>(`(list [@t @t])`~))
  ;<  [out=(list card) w=state-6:t]  bind:m  (ack-decline caz ~ |)
  ;<  ~  bind:m  (ex-equal !>(approvals.w) !>(*approvals:t))
  ;<  ~  bind:m  (ex-equal !>(policy.w) !>(policy:asked))
  ;<  ~  bind:m  (ex-equal !>((joins out)) !>(`(list flag:g)`~))
  ;<  ~  bind:m  (ex-equal !>((kinds w 'approval-rejected')) !>(1))
  %+  ex-equal  !>((answered out))
  !>(`(list [@t @t])`~[['dm/~nec' (rap 3 'Denied group invite from ~dev to ' label '.' ~)]])
::  Closed with the invite still on the ship, the request could not be asked
::  again: %groups would report no new invite.
::
++  test-a-refused-decline-leaves-the-request-open-and-tells-the-owner
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-6:t]  bind:m
    (admit asked later ~[[told (said ~nec '/reject g0001' told)]])
  ;<  [out=(list card) w=state-6:t]  bind:m  (ack-decline caz `~[leaf+"no"] &)
  ;<  ~  bind:m  (ex-equal !>(approvals.w) !>(approvals:asked))
  ;<  ~  bind:m  (ex-equal !>((kinds w 'approval-decline-failed')) !>(1))
  ;<  ~  bind:m  (ex-equal !>((kinds w 'approval-rejected')) !>(0))
  %+  ex-equal  !>((answered out))
  !>  ^-  (list [@t @t])
  ~[['dm/~nec' 'Could not decline ~lux/club: invite decline failed. Request stays pending, try again.']]
::  ~dev also holds a DM grant, which the ban takes back.
::
++  test-ban-blocks-the-ship-declines-the-invite-and-removes-its-dm-grant
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  asked
  =.  dm-grants.policy.saved  (~(put in dm-grants.policy.saved) ~dev)
  ;<  [caz=(list card) s=state-6:t]  bind:m
    (admit saved later ~[[told (said ~nec '/ban g0001' told)]])
  ;<  ~  bind:m  (ex-equal !>((blocks caz)) !>(`(list @p)`~[~dev]))
  ;<  ~  bind:m  (ex-equal !>(approvals.s) !>(approvals.saved))
  ;<  [out=(list card) w=state-6:t]  bind:m  (ack-block caz)
  ;<  ~  bind:m  (ex-equal !>(approvals.w) !>(*approvals:t))
  ;<  ~  bind:m  (ex-equal !>((turn (declines out) tail)) !>(`(list flag:g)`~[club]))
  ;<  ~  bind:m  (ex-equal !>(dm-grants.policy.w) !>((silt ~[~bus])))
  ;<  ~  bind:m  (ex-equal !>((joins out)) !>(`(list flag:g)`~))
  %+  ex-equal  !>((answered out))
  !>(`(list [@t @t])`~[['dm/~nec' 'Blocked ~dev. They will no longer be able to contact the bot.']])
::  As a reject does, expiry declines the invite, then the inviter's next
::  invite opens a new request with a new card.
::
++  test-a-group-request-expires-after-48-hours-and-declines-its-invite
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  due  (add start ~h48)
  ;<  ~  bind:m  (boot asked due *stream:v10:a &)
  ;<  ~  bind:m
    %-  jab-bowl
    |=(b=bowl b(wex (~(put by wex.b) [/activity ~zod %activity] [& /v4])))
  ;<  caz=(list card)  bind:m  (do-arvo /poll [%behn %wake ~])
  ;<  =vase  bind:m  get-save
  =/  w  !<(state-6:t vase)
  ;<  ~  bind:m  (ex-equal !>(approvals.w) !>(*approvals:t))
  ;<  ~  bind:m  (ex-equal !>((kinds w 'approval-expired')) !>(1))
  ;<  ~  bind:m  (ex-equal !>((declines caz)) !>(`(list [wire flag:g])`~[[/invite/group-decline club]]))
  =/  again  (add due ~m5)
  ;<  [caz=(list card) u=state-6:t]  bind:m  (admit w (add again ~s1) ~[[again (invite ~dev)]])
  ;<  ~  bind:m  (ex-equal !>((requests u)) !>(`(list approval:t)`~[[~dev [%group club] (add again ~s1)]]))
  (ex-equal !>((lent (sent caz))) !>(1))
++  test-pending-lists-a-group-request
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-6:t]  bind:m
    (admit asked later ~[[told (said ~nec '/pending' told)]])
  ;<  ~  bind:m  (ex-equal !>(approvals.s) !>(approvals:asked))
  %+  ex-equal  !>((answered caz))
  !>  ^-  (list [@t @t])
  :~  :-  'dm/~nec'
      %+  rap  3
      :~  'Pending requests (1):'
          '\0a  #g0001 - Group invite from ~dev to '  label
          '\0aUse /allow, /reject, or /ban with the ID.'
      ==
  ==
--
