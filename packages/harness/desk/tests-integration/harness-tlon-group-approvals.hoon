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
  ^-  state-8:t
  =/  s=state-8:t  *state-8:t
  =.  owner-initialized.s  1
  =.  activity-through.s  ~2026.9.9
  =.  policy.s  [& `~nec ~ %mentions (silt ~[~wes]) ~ (silt ~[~bus]) ~]
  s
::  ~dev's request for .club, opened at .start
::
++  asked
  ^-  state-8:t
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
::  The groups' records on the ship: .club's preview, which a decline
::  leaves, and an invite to each group in .held from its ship
::
++  invites
  |=  held=(list [=flag:g who=@p])
  ^-  foreigns:v8:g
  =/  =preview:v8:g  *preview:v8:g
  =.  title.meta.preview  'Club'
  =/  base=foreigns:v8:g  (my ~[[club `foreign:v8:g`[~ ~ `preview ~ ~]]])
  %+  roll  held
  |:  [[flag=*flag:g who=*@p] foreigns=base]
  =/  =invite:v8:g  *invite:v8:g
  =.  invite  invite(flag flag, from who, preview preview, valid &)
  =/  had  (~(gut by foreigns) flag `foreign:v8:g`[~ ~ `preview ~ ~])
  (~(put by foreigns) flag had(invites [invite invites.had]))
::  ~dev's invite to .club, on the ship
::
++  dev-invite  `(list [flag:g @p])`~[[club ~dev]]
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
::  The ship's agents, with the invites in .held on the ship
::
++  scries
  |=  [events=stream:v10:a held=(list [flag:g @p])]
  |=  =path
  ^-  (unit vase)
  ?:  ?=([%gu @ %contacts @ %$ ~] path)  `!>(|)
  ?:  ?=([%gu @ %groups @ %$ ~] path)  `!>(&)
  ?:  ?=([%gu @ %steward @ %$ ~] path)  `!>(|)
  ?:  ?=([%gu @ %channels @ %v4 %chat %'~lux' %test ~] path)  `!>(&)
  ?:  ?=([%gu @ %chat @ %dm @ ~] path)  `!>(|)
  ?:  ?=([%gx @ %groups @ %v1 %foreigns %noun ~] path)  `!>((invites held))
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
  |=  [saved=state-8:t now=@da events=stream:v10:a held=(list [flag:g @p])]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (set-bowl %*(. *bowl our ~zod, src ~zod, now now, eny (shax 'groups')))
  ;<  ~  bind:m  head-connected
  ;<  ~  bind:m  (set-scry-gate (scries events held))
  ;<  *  bind:m  (do-load adapter `!>(saved))
  head-connected
::  Load .saved at .now, then deliver .events through Activity catch-up,
::  with ~dev's invite to .club on the ship
::
++  admit
  |=  [saved=state-8:t now=@da events=(list [@da incoming-event:v8:a])]
  (admit-held saved now events dev-invite)
::  As +admit, with the invites in .held on the ship
::
++  admit-held
  |=  $:  saved=state-8:t  now=@da  events=(list [@da incoming-event:v8:a])
          held=(list [flag:g @p])
      ==
  =/  m  (mare ,[(list card) state-8:t])
  ^-  form:m
  ;<  ~  bind:m  (boot saved now (stream events) held)
  ;<  caz=(list card)  bind:m  (do-agent /activity [~zod %activity] [%watch-ack ~])
  ;<  =vase  bind:m  get-save
  (pure:m caz !<(state-8:t vase))
::  %groups' acknowledgement, with .ack, of the one join or decline in .caz,
::  while the invites in .held are on the ship
::
++  ack-groups
  |=  [caz=(list card) ack=(unit tang) held=(list [flag:g @p])]
  =/  m  (mare ,[(list card) state-8:t])
  ^-  form:m
  =/  wires
    %+  murn  caz
    |=  c=card
    ?.  ?=([%pass * %agent [@ %groups] %poke ?(%group-join %invite-decline) *] c)  ~
    `p.c
  ?>  ?=([* ~] wires)
  ;<  ~  bind:m  (set-scry-gate (scries *stream:v10:a held))
  ;<  out=(list card)  bind:m  (do-agent i.wires [~zod %groups] [%poke-ack ack])
  ;<  =vase  bind:m  get-save
  (pure:m out !<(state-8:t vase))
::  %chat's acknowledgement of the one block in .caz
::
++  ack-block
  |=  caz=(list card)
  (ack-block-with caz ~)
::  %chat's acknowledgement, with .ack, of the one block in .caz
::
++  ack-block-with
  |=  [caz=(list card) ack=(unit tang)]
  =/  m  (mare ,[(list card) state-8:t])
  ^-  form:m
  =/  wires
    %+  murn  caz
    |=  c=card
    ?.  ?=([%pass * %agent [@ %chat] %poke %chat-block-ship *] c)  ~
    `p.c
  ?>  ?=([* ~] wires)
  ;<  out=(list card)  bind:m  (do-agent i.wires [~zod %chat] [%poke-ack ack])
  ;<  =vase  bind:m  get-save
  (pure:m out !<(state-8:t vase))
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
  |=  [s=state-8:t kind=@t]
  ^-  @ud
  (lent (skim notices.s |=(n=notice:t =(kind kind.n))))
++  requests
  |=  s=state-8:t
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
  ;<  [caz=(list card) s=state-8:t]  bind:m
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
  ;<  [* s=state-8:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (invite ~dev)]])
  ;<  ~  bind:m  (ex-equal !>((lent (requests s))) !>(1))
  ;<  [caz=(list card) w=state-8:t]  bind:m
    %:  admit-held  s  later
      :~  [~2026.9.10..00.06.00 (invite ~dev)]
          [~2026.9.10..00.07.00 (invite ~bus)]
      ==
      ~[[club ~dev] [club ~bus]]
    ==
  ;<  ~  bind:m  (ex-equal !>((sent caz)) !>(`(list [@p @t @t])`~))
  ;<  ~  bind:m  (ex-equal !>((joins caz)) !>(`(list flag:g)`~))
  (ex-equal !>(approvals.w) !>(approvals.s))
++  test-an-invite-from-the-owner-or-a-ship-on-the-ship-wide-list-joins-without-a-card
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-8:t]  bind:m
    (admit-held fixture start ~[[~2026.9.9..12.00.00 (invite ~wes)]] ~[[club ~wes]])
  ;<  ~  bind:m  (ex-equal !>((joins caz)) !>(`(list flag:g)`~[club]))
  ;<  ~  bind:m  (ex-equal !>((sent caz)) !>(`(list [@p @t @t])`~))
  ;<  ~  bind:m  (ex-equal !>(approvals.s) !>(*approvals:t))
  ;<  [caz=(list card) s=state-8:t]  bind:m
    (admit-held fixture start ~[[~2026.9.9..12.00.00 (invite ~nec)]] ~[[club ~nec]])
  ;<  ~  bind:m  (ex-equal !>((joins caz)) !>(`(list flag:g)`~[club]))
  (ex-equal !>(approvals.s) !>(*approvals:t))
::  The owner's and ~wes's invites are reported, but the ship holds only
::  ~dev's, or none: the bot joins nothing, through another ship's invite
::  or a public group.
::
++  test-a-trusted-invite-no-longer-on-the-ship-joins-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  events
    :~  [~2026.9.9..12.00.00 (invite ~wes)]
        [~2026.9.9..12.00.01 (invite ~nec)]
    ==
  ;<  [caz=(list card) s=state-8:t]  bind:m  (admit-held fixture start events dev-invite)
  ;<  ~  bind:m  (ex-equal !>((joins caz)) !>(`(list flag:g)`~))
  ;<  [caz=(list card) s=state-8:t]  bind:m  (admit-held fixture start events ~)
  ;<  ~  bind:m  (ex-equal !>((joins caz)) !>(`(list flag:g)`~))
  (ex-equal !>(approvals.s) !>(*approvals:t))
::  ~bus's invite is reported, but the ship holds only ~dev's: no request
::  opens, so no card names ~bus for an invite it did not send.
::
++  test-an-invite-no-longer-on-the-ship-opens-no-request
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-8:t]  bind:m
    (admit fixture start ~[[~2026.9.9..12.00.00 (invite ~bus)]])
  ;<  ~  bind:m  (ex-equal !>(approvals.s) !>(*approvals:t))
  ;<  ~  bind:m  (ex-equal !>((sent caz)) !>(`(list [@p @t @t])`~))
  (ex-equal !>((joins caz)) !>(`(list flag:g)`~))
++  test-an-invite-from-a-blocked-ship-or-a-comet-opens-no-request
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-8:t]  bind:m
    %:  admit-held  fixture  start
      :~  [~2026.9.9..12.00.00 (invite ~bel)]
          [~2026.9.9..12.00.01 (invite comet)]
      ==
      ~[[club ~bel] [club comet]]
    ==
  ;<  ~  bind:m  (ex-equal !>(approvals.s) !>(*approvals:t))
  ;<  ~  bind:m  (ex-equal !>((sent caz)) !>(`(list [@p @t @t])`~))
  (ex-equal !>((joins caz)) !>(`(list flag:g)`~))
::  The request closes and the owner is told once %groups has the join.
::  Allowing stores no grant, so after the join neither the inviter nor
::  another member of the group is answered in its channel: each mention
::  opens a request of its own instead.
::
++  test-allow-joins-the-group-and-gives-the-inviter-and-the-members-no-access
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-8:t]  bind:m
    (admit asked later ~[[told (said ~nec '/allow g0001' told)]])
  ;<  ~  bind:m  (ex-equal !>((joins caz)) !>(`(list flag:g)`~[club]))
  ;<  ~  bind:m  (ex-equal !>(by-id.approvals.s) !>(by-id.approvals:asked))
  ;<  ~  bind:m  (ex-equal !>((answered caz)) !>(`(list [@t @t])`~))
  ;<  [out=(list card) s=state-8:t]  bind:m  (ack-groups caz ~ ~)
  ;<  ~  bind:m  (ex-equal !>(approvals.s) !>(*approvals:t))
  ;<  ~  bind:m  (ex-equal !>(policy.s) !>(policy:asked))
  ;<  ~  bind:m  (ex-equal !>((turned out)) !>(|))
  ;<  ~  bind:m  (ex-equal !>((kinds s 'approval-allowed')) !>(1))
  ;<  ~  bind:m
    %+  ex-equal  !>((answered out))
    !>  ^-  (list [@t @t])
    ~[['dm/~nec' (rap 3 'Approved group invite from ~dev to ' label '. Joining group...' ~)]]
  =/  next  ~2026.9.10..00.20.00
  ;<  [caz=(list card) w=state-8:t]  bind:m
    %^  admit  s  (add next ~s1)
    :~  [next (mention ~dev next)]
        [(add next ~s1) (mention ~bus (add next ~s1))]
    ==
  ;<  ~  bind:m  (ex-equal !>((turned caz)) !>(|))
  ;<  ~  bind:m  (ex-equal !>(jobs.w) !>(jobs.s))
  %+  ex-equal
    !>((silt (turn (requests w) |=(=approval:t [who topic]:approval))))
  !>((silt `(list [@p topic:t])`~[[~dev %place `room-nest] [~bus %place `room-nest]]))
::  The request stays open and takes the same command again.
::
++  test-a-refused-join-leaves-the-request-open-and-tells-the-owner
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-8:t]  bind:m
    (admit asked later ~[[told (said ~nec '/allow g0001' told)]])
  ;<  [out=(list card) w=state-8:t]  bind:m  (ack-groups caz `~[leaf+"no"] dev-invite)
  ;<  ~  bind:m  (ex-equal !>(approvals.w) !>(approvals:asked))
  ;<  ~  bind:m  (ex-equal !>((kinds w 'approval-join-failed')) !>(1))
  ;<  ~  bind:m  (ex-equal !>((kinds w 'approval-allowed')) !>(0))
  ;<  ~  bind:m
    %+  ex-equal  !>((answered out))
    !>  ^-  (list [@t @t])
    ~[['dm/~nec' 'Could not join ~lux/club: invite accept failed. Request stays pending, try again.']]
  ;<  [caz=(list card) *]  bind:m
    (admit w later ~[[(add told ~s1) (said ~nec '/allow g0001' (add told ~s1))]])
  (ex-equal !>((joins caz)) !>(`(list flag:g)`~[club]))
::  A reject sent, a second answer before %groups has the decline runs
::  nothing; the owner is told the first is under way.
::
++  test-a-request-whose-answer-is-in-flight-takes-no-other-answer
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-8:t]  bind:m
    %^  admit  asked  later
    :~  [told (said ~nec '/reject g0001' told)]
        [(add told ~s1) (said ~nec '/allow g0001' (add told ~s1))]
        [(add told ~s2) (said ~nec '/ban g0001' (add told ~s2))]
    ==
  ;<  ~  bind:m  (ex-equal !>((turn (declines caz) tail)) !>(`(list flag:g)`~[club]))
  ;<  ~  bind:m  (ex-equal !>((joins caz)) !>(`(list flag:g)`~))
  ;<  ~  bind:m  (ex-equal !>((blocks caz)) !>(`(list @p)`~))
  ;<  ~  bind:m
    %+  ex-equal  !>((answered caz))
    !>  ^-  (list [@t @t])
    :~  ['dm/~nec' 'Request #g0001 is already being answered; wait for its result.']
        ['dm/~nec' 'Request #g0001 is already being answered; wait for its result.']
    ==
  ;<  [out=(list card) w=state-8:t]  bind:m  (ack-groups caz ~ ~)
  ;<  ~  bind:m  (ex-equal !>(approvals.w) !>(*approvals:t))
  (ex-equal !>((kinds w 'approval-rejected')) !>(1))
::  Nothing changes until %groups has the decline.
::
++  test-reject-declines-the-invite-and-closes-the-request
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-8:t]  bind:m
    (admit asked later ~[[told (said ~nec '/reject g0001' told)]])
  ;<  ~  bind:m  (ex-equal !>((turn (declines caz) tail)) !>(`(list flag:g)`~[club]))
  ;<  ~  bind:m  (ex-equal !>(by-id.approvals.s) !>(by-id.approvals:asked))
  ;<  ~  bind:m  (ex-equal !>((answered caz)) !>(`(list [@t @t])`~))
  ;<  [out=(list card) w=state-8:t]  bind:m  (ack-groups caz ~ ~)
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
  ;<  [caz=(list card) s=state-8:t]  bind:m
    (admit asked later ~[[told (said ~nec '/reject g0001' told)]])
  ;<  [out=(list card) w=state-8:t]  bind:m  (ack-groups caz `~[leaf+"no"] dev-invite)
  ;<  ~  bind:m  (ex-equal !>(approvals.w) !>(approvals:asked))
  ;<  ~  bind:m  (ex-equal !>((kinds w 'approval-decline-failed')) !>(1))
  ;<  ~  bind:m  (ex-equal !>((kinds w 'approval-rejected')) !>(0))
  %+  ex-equal  !>((answered out))
  !>  ^-  (list [@t @t])
  ~[['dm/~nec' 'Could not decline ~lux/club: invite decline failed. Request stays pending, try again.']]
::  ~dev also holds a DM grant, which the ban takes back once %chat has the
::  block; the request closes once %groups has the decline.
::
++  test-ban-blocks-the-ship-removes-its-dm-grant-and-closes-on-the-declines-ack
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  asked
  =.  dm-grants.policy.saved  (~(put in dm-grants.policy.saved) ~dev)
  ;<  [caz=(list card) s=state-8:t]  bind:m
    (admit saved later ~[[told (said ~nec '/ban g0001' told)]])
  ;<  ~  bind:m  (ex-equal !>((blocks caz)) !>(`(list @p)`~[~dev]))
  ;<  ~  bind:m  (ex-equal !>(by-id.approvals.s) !>(by-id.approvals.saved))
  ;<  [out=(list card) w=state-8:t]  bind:m  (ack-block caz)
  ;<  ~  bind:m  (ex-equal !>((turn (declines out) tail)) !>(`(list flag:g)`~[club]))
  ;<  ~  bind:m  (ex-equal !>(dm-grants.policy.w) !>((silt ~[~bus])))
  ;<  ~  bind:m  (ex-equal !>(by-id.approvals.w) !>(by-id.approvals.saved))
  ;<  ~  bind:m  (ex-equal !>((answered out)) !>(`(list [@t @t])`~))
  ;<  [out=(list card) w=state-8:t]  bind:m  (ack-groups out ~ ~)
  ;<  ~  bind:m  (ex-equal !>(approvals.w) !>(*approvals:t))
  ;<  ~  bind:m  (ex-equal !>((joins out)) !>(`(list flag:g)`~))
  ;<  ~  bind:m  (ex-equal !>((kinds w 'approval-banned')) !>(1))
  %+  ex-equal  !>((answered out))
  !>(`(list [@t @t])`~[['dm/~nec' 'Blocked ~dev. They will no longer be able to contact the bot.']])
::  ~dev is blocked, but %groups refuses the decline with the invite still
::  on the ship: the request stays open, and a second ban, finding ~dev
::  blocked, sends no block and declines again.
::
++  test-a-refused-decline-after-a-ban-leaves-the-request-open-and-a-second-ban-declines-again
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-8:t]  bind:m
    (admit asked later ~[[told (said ~nec '/ban g0001' told)]])
  ;<  [out=(list card) *]  bind:m  (ack-block caz)
  ;<  [out=(list card) w=state-8:t]  bind:m  (ack-groups out `~[leaf+"no"] dev-invite)
  ;<  ~  bind:m  (ex-equal !>(approvals.w) !>(approvals:asked))
  ;<  ~  bind:m  (ex-equal !>((kinds w 'approval-decline-failed')) !>(1))
  ;<  ~  bind:m  (ex-equal !>((kinds w 'approval-banned')) !>(0))
  ;<  ~  bind:m
    %+  ex-equal  !>((answered out))
    !>  ^-  (list [@t @t])
    ~[['dm/~nec' 'Blocked ~dev, but could not submit the decline for ~lux/club. Request stays pending, try again.']]
  ::  %chat now blocks ~dev, as the fixture's ~bel.
  =/  again  (add told ~s1)
  ;<  ~  bind:m  (boot w later (stream ~[[again (said ~nec '/ban g0001' again)]]) dev-invite)
  ;<  ~  bind:m
    %-  set-scry-gate
    |=  =path
    ?:  ?=([%gx @ %chat @ %blocked %ships ~] path)  `!>((silt ~[~bel ~dev]))
    ((scries (stream ~[[again (said ~nec '/ban g0001' again)]]) dev-invite) path)
  ;<  caz=(list card)  bind:m  (do-agent /activity [~zod %activity] [%watch-ack ~])
  ;<  ~  bind:m  (ex-equal !>((blocks caz)) !>(`(list @p)`~))
  ;<  ~  bind:m  (ex-equal !>((turn (declines caz) tail)) !>(`(list flag:g)`~[club]))
  ;<  [out=(list card) u=state-8:t]  bind:m  (ack-groups caz ~ ~)
  ;<  ~  bind:m  (ex-equal !>(approvals.u) !>(*approvals:t))
  %+  ex-equal  !>((answered out))
  !>(`(list [@t @t])`~[['dm/~nec' 'Blocked ~dev. They will no longer be able to contact the bot.']])
::  ~dev also invited the bot to .den, with no request: the ban declines
::  every invite of ~dev's on the ship.
::
++  test-ban-declines-every-invite-of-the-ships-on-the-ship
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  den  `flag:g`[~lux %den]
  =/  held  `(list [flag:g @p])`~[[club ~dev] [den ~dev] [[~lux %other] ~bus]]
  ;<  [caz=(list card) s=state-8:t]  bind:m
    (admit-held asked later ~[[told (said ~nec '/ban g0001' told)]] held)
  ;<  [out=(list card) *]  bind:m  (ack-block caz)
  %+  ex-equal  !>((silt (turn (declines out) tail)))
  !>((silt `(list flag:g)`~[club den]))
::  As a reject does, expiry declines the invite, then the inviter's next
::  invite opens a new request with a new card.
::
++  test-a-group-request-expires-after-48-hours-and-declines-its-invite
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  due  (add start ~h48)
  ;<  ~  bind:m  (boot asked due *stream:v10:a dev-invite)
  ;<  ~  bind:m
    %-  jab-bowl
    |=(b=bowl b(wex (~(put by wex.b) [/activity ~zod %activity] [& /v4])))
  ;<  caz=(list card)  bind:m  (do-arvo /poll [%behn %wake ~])
  ;<  =vase  bind:m  get-save
  =/  w  !<(state-8:t vase)
  ;<  ~  bind:m  (ex-equal !>(approvals.w) !>(*approvals:t))
  ;<  ~  bind:m  (ex-equal !>((kinds w 'approval-expired')) !>(1))
  ;<  ~  bind:m  (ex-equal !>((turn (declines caz) tail)) !>(`(list flag:g)`~[club]))
  ;<  [out=(list card) *]  bind:m  (ack-groups caz ~ ~)
  ;<  ~  bind:m  (ex-equal !>((answered out)) !>(`(list [@t @t])`~))
  =/  again  (add due ~m5)
  ;<  [caz=(list card) u=state-8:t]  bind:m  (admit w (add again ~s1) ~[[again (invite ~dev)]])
  ;<  ~  bind:m  (ex-equal !>((requests u)) !>(`(list approval:t)`~[[~dev [%group club] (add again ~s1)]]))
  (ex-equal !>((lent (sent caz))) !>(1))
::  The request is gone, so the owner, who could no longer reject it, is
::  told the invite stays.
::
++  test-a-refused-decline-on-expiry-tells-the-owner
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  due  (add start ~h48)
  ;<  ~  bind:m  (boot asked due *stream:v10:a dev-invite)
  ;<  ~  bind:m
    %-  jab-bowl
    |=(b=bowl b(wex (~(put by wex.b) [/activity ~zod %activity] [& /v4])))
  ;<  caz=(list card)  bind:m  (do-arvo /poll [%behn %wake ~])
  ;<  [out=(list card) w=state-8:t]  bind:m  (ack-groups caz `~[leaf+"no"] dev-invite)
  ;<  ~  bind:m  (ex-equal !>(approvals.w) !>(*approvals:t))
  ;<  ~  bind:m  (ex-equal !>((kinds w 'approval-decline-failed')) !>(1))
  %+  ex-equal  !>((answered out))
  !>  ^-  (list [@t @t])
  :~  :-  'dm/~nec'
      'Could not decline ~lux/club after its request expired: invite decline failed. The invite stays on the ship.'
  ==
::  ~bus also invited the bot to .club, whose request is ~dev's. Banning
::  ~bus from its DM request leaves .club's invites alone: %groups would
::  decline ~dev's with them.
::
++  test-a-ban-declines-no-group-another-ship-also-invited-the-bot-to
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  asked
  =.  approvals.saved  (open:ask approvals.saved 'd0001' [~bus [%place ~] start])
  =/  held  `(list [flag:g @p])`~[[club ~dev] [club ~bus]]
  ;<  [caz=(list card) s=state-8:t]  bind:m
    (admit-held saved later ~[[told (said ~nec '/ban d0001' told)]] held)
  ;<  [out=(list card) w=state-8:t]  bind:m  (ack-block caz)
  ;<  ~  bind:m  (ex-equal !>((declines out)) !>(`(list [wire flag:g])`~))
  (ex-equal !>(~(key by by-id.approvals.w)) !>((silt ~['g0001'])))
::  ~dev's request closed and its id went to ~wes's, in flight, while the
::  block was on its way: %chat's acknowledgement bans ~dev, and leaves
::  ~wes's request open and in flight.
::
++  test-a-block-acknowledged-after-its-requests-id-went-to-another-leaves-that-one
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  den  `flag:g`[~lux %den]
  ;<  [caz=(list card) s=state-8:t]  bind:m
    (admit asked later ~[[told (said ~nec '/ban g0001' told)]])
  =/  moved  s(approvals (open:ask (close:ask approvals.s 'g0001') 'g0001' [~wes [%group den] later]))
  =.  busy.approvals.moved  (silt ~['g0001'])
  ;<  ~  bind:m  (boot moved later *stream:v10:a ~)
  ;<  [out=(list card) w=state-8:t]  bind:m  (ack-block caz)
  ;<  ~  bind:m  (ex-equal !>(approvals.w) !>(approvals.moved))
  ;<  ~  bind:m  (ex-equal !>((declines out)) !>(`(list [wire flag:g])`~))
  %+  ex-equal  !>((answered out))
  !>(`(list [@t @t])`~[['dm/~nec' 'Blocked ~dev. They will no longer be able to contact the bot.']])
::  As above, %chat refuses the block: ~wes's request stays in flight.
::
++  test-a-block-refused-after-its-requests-id-went-to-another-leaves-that-one-in-flight
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  den  `flag:g`[~lux %den]
  ;<  [caz=(list card) s=state-8:t]  bind:m
    (admit asked later ~[[told (said ~nec '/ban g0001' told)]])
  =/  moved  s(approvals (open:ask (close:ask approvals.s 'g0001') 'g0001' [~wes [%group den] later]))
  =.  busy.approvals.moved  (silt ~['g0001'])
  ;<  ~  bind:m  (boot moved later *stream:v10:a ~)
  ;<  [out=(list card) w=state-8:t]  bind:m  (ack-block-with caz `~[leaf+"no"])
  (ex-equal !>(approvals.w) !>(approvals.moved))
::  ~dev withdrew its invite before the owner tapped Allow: nothing is
::  joined, the request closes and the owner is told.
::
++  test-allow-after-the-invite-was-withdrawn-joins-nothing-and-says-so
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-8:t]  bind:m
    (admit-held asked later ~[[told (said ~nec '/allow g0001' told)]] ~)
  ;<  ~  bind:m  (ex-equal !>((joins caz)) !>(`(list flag:g)`~))
  ;<  ~  bind:m  (ex-equal !>(approvals.s) !>(*approvals:t))
  ;<  ~  bind:m  (ex-equal !>((kinds s 'approval-invite-gone')) !>(1))
  %+  ex-equal  !>((answered caz))
  !>  ^-  (list [@t @t])
  :~  :-  'dm/~nec'
      (rap 3 'The group invite from ~dev to ' label ' is no longer on the ship; nothing to join.' ~)
  ==
::  A request in flight is still open: /pending lists it, and a bare
::  command counts it among the open ones.
::
++  test-pending-lists-a-request-in-flight-and-a-bare-command-counts-it
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  asked
  =.  approvals.saved  (open:ask approvals.saved 'd0001' [~bus [%place ~] (add start ~m1)])
  =.  busy.approvals.saved  (silt ~['g0001'])
  ;<  [caz=(list card) s=state-8:t]  bind:m
    %^  admit  saved  later
    :~  [told (said ~nec '/pending' told)]
        [(add told ~s1) (said ~nec '/reject' (add told ~s1))]
    ==
  ;<  ~  bind:m  (ex-equal !>(approvals.s) !>(approvals.saved))
  %+  ex-equal  !>((answered caz))
  !>  ^-  (list [@t @t])
  :~  :-  'dm/~nec'
      %+  rap  3
      :~  'Pending requests (2):'
          '\0a  #g0001 - Group invite from ~dev to '  label
          '\0a  #d0001 - DM from ~bus'
          '\0aUse /allow, /reject, or /ban with the ID.'
      ==
    ::
      :-  'dm/~nec'
      %+  rap  3
      :~  'More than one approval is pending. Send the command again with an ID:'
          '\0ag0001 ~dev ~lux/club'
          '\0ad0001 ~bus dm/~bus'
      ==
  ==
::  ~bus also invited the bot to .club, whose request is ~dev's. A ban from
::  .club's own card blocks ~dev and closes its request, but declines no
::  invite, which would take ~bus's too: a request opens for ~bus instead,
::  and the owner gets its card.
::
++  test-a-ban-from-the-group-card-with-another-inviter-asks-for-that-one
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  held  `(list [flag:g @p])`~[[club ~dev] [club ~bus]]
  ;<  [caz=(list card) s=state-8:t]  bind:m
    (admit-held asked later ~[[told (said ~nec '/ban g0001' told)]] held)
  ;<  ~  bind:m  (ex-equal !>((blocks caz)) !>(`(list @p)`~[~dev]))
  ;<  [out=(list card) w=state-8:t]  bind:m  (ack-block caz)
  ;<  ~  bind:m  (ex-equal !>((declines out)) !>(`(list [wire flag:g])`~))
  ;<  ~  bind:m  (ex-equal !>((requests w)) !>(`(list approval:t)`~[[~bus [%group club] later]]))
  ;<  ~  bind:m  (ex-equal !>(busy.approvals.w) !>(`(set @t)`~))
  =/  cards  (sent out)
  ?>  ?=([* ~] cards)
  ;<  ~  bind:m
    (ex-equal !>(text.i.cards) !>((cat 3 'Group invite request from ~bus for ' label)))
  %+  ex-equal  !>((answered out))
  !>(`(list [@t @t])`~[['dm/~nec' 'Blocked ~dev. They will no longer be able to contact the bot.']])
++  test-pending-lists-a-group-request
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [caz=(list card) s=state-8:t]  bind:m
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
