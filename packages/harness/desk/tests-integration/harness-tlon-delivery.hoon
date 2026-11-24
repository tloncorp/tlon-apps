::  Full adapter acknowledgement handling; emitted Messenger cards never run.
/-  t=harness-tlon, hh=harness-hand, g=groups-ver
/+  *test-agent
/=  adapter  /app/harness-tlon
|%
::  Hand ledger receipts among the emitted cards, in order.
::
++  receipts
  |=  cards=(list card)
  ^-  (list action:hh)
  %+  murn  cards
  |=  =card
  ^-  (unit action:hh)
  ?.  ?=([%pass * %agent * %poke %harness-hand *] card)  ~
  =/  [pass=* wire=* agent=* who=* poke=* mark=* data=vase]  card
  =/  request  !<(request:hh data)
  `act.request
::
++  acknowledge
  |=  [address=@t attempt=@ud rejected=?]
  =/  m  (mare ,[deliveries=(map @uv delivery:t) receipts=(list action:hh)])
  ^-  form:m
  =/  saved=state-3:t  *state-3:t
  =.  saved
    %=  saved  owner-initialized  1  enabled.policy  |  deliveries
        (my ~[[0v1 [7 %send %uncertain 'external']]])
    ==
  =/  ledger=state:hh  *state:hh
  =.  outbox.ledger
    %-  my
    :~  :*  0v1
            :*  0v1  'binding'  'tlon'  address  'conversation'  %reply  'Hello'  %claimed
                'harness-tlon'  'external'  ~
            ==
        ==
    ==
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now ~2026.10.1)))
  ;<  ~  bind:m
    %-  set-scry-gate
    |=  =path
    ^-  (unit vase)
    ?:  (lien path |=(part=@ta =(%hand-state part)))  `!>(ledger)
    `!>(|)
  ;<  *  bind:m  (do-load adapter `!>(saved))
  ::  DMs go to Chat, channel posts to Channels; either acknowledges the poke.
  =/  =gill:gall  [~zod ?:(=('dm/' (cut 3 [0 3] address)) %chat %channels)]
  ;<  caz=(list card)  bind:m
    %^  do-agent  /publish/0v1/(scot %ud attempt)  gill
    [%poke-ack ?:(rejected `~ ~)]
  ;<  =vase  bind:m  get-save
  (pure:m deliveries:!<(state-3:t vase) (receipts caz))
::
++  test-channel-ack-waits-for-host-confirmation
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  result=[deliveries=(map @uv delivery:t) receipts=(list action:hh)]  bind:m
    (acknowledge 'chat/~zod/channel' 7 |)
  ;<  ~  bind:m
    %+  ex-equal
      !>((~(got by deliveries.result) 0v1))
    !>(`delivery:t`[7 %send %uncertain 'external'])
  (ex-equal !>(receipts.result) !>(~))
::
++  test-dm-ack-and-rejection-record-only-the-current-attempt
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  accepted=[deliveries=(map @uv delivery:t) receipts=(list action:hh)]  bind:m
    (acknowledge 'dm/~nec' 7 |)
  ;<  rejected=[deliveries=(map @uv delivery:t) receipts=(list action:hh)]  bind:m
    (acknowledge 'chat/~zod/channel' 7 &)
  ;<  stale=[deliveries=(map @uv delivery:t) receipts=(list action:hh)]  bind:m
    (acknowledge 'dm/~nec' 6 |)
  ;<  ~  bind:m
    %+  ex-equal
      !>((~(got by deliveries.accepted) 0v1))
    !>(`delivery:t`[7 %receipt %delivered 'external'])
  ;<  ~  bind:m
    %+  ex-equal
      !>((~(got by deliveries.rejected) 0v1))
    !>(`delivery:t`[7 %receipt %failed 'external'])
  ;<  ~  bind:m
    %+  ex-equal
      !>(receipts.accepted)
    !>(`(list action:hh)`~[[%receipt-at 'tlon' 0v1 'harness-tlon' 7 %delivered 'external']])
  ;<  ~  bind:m
    %+  ex-equal
      !>(receipts.rejected)
    !>(`(list action:hh)`~[[%receipt-at 'tlon' 0v1 'harness-tlon' 7 %failed 'external']])
  ;<  ~  bind:m
    %+  ex-equal
      !>((~(got by deliveries.stale) 0v1))
    !>(`delivery:t`[7 %send %uncertain 'external'])
  (ex-equal !>(receipts.stale) !>(`(list action:hh)`~))
::  A claimed reply to ~bus in a channel conversation the owner opened.
::  ~bus asked at .asked under .policy, with authority cutoffs .cuts.
::  Produces whether the adapter sent it to Messenger, and its receipts.
::
++  claim
  |=  [policy=policy:t cuts=(map @p @da) asked=@da]
  (claim-by ~zod ~bus policy cuts *@da asked)
::  +claim on ship .our, for speaker .who, with sibling cutoff .siblings.
::
++  claim-by
  |=  [our=@p who=@p policy=policy:t cuts=(map @p @da) siblings=@da asked=@da]
  =/  m  (mare ,[sent=? receipts=(list action:hh)])
  ^-  form:m
  =/  to=destination:t  [%channel [%chat ~lux %test] ~]
  =/  saved=state-3:t  *state-3:t
  =.  saved
    %=  saved
      owner-initialized  1
      policy  policy
      cuts  cuts
      sibling-owner-after  siblings
      lanes  (my ~[['room' [to 1 ~[%web]]]])
      routes  (my ~[['room' ['binding' %ready]]])
      deliveries  (my ~[[0v1 [0 %claim %uncertain '']]])
    ==
  =/  ledger=state:hh  *state:hh
  =.  observations.ledger
    (my ~[[0v1 ['binding' 'event' (scot %p who) 'hello' asked %completed]]])
  =.  outbox.ledger
    %-  my
    :~  :*  0v1
            :*  0v1  'binding'  'tlon'  'chat/~lux/test'  'room'  %reply  'Hi'  %claimed
                'harness-tlon'  ''  ~
            ==
        ==
    ==
  ;<  ~  bind:m  (set-bowl %*(. *bowl our our, src our, now ~2026.10.1))
  ;<  ~  bind:m
    %-  set-scry-gate
    |=  =path
    ^-  (unit vase)
    ?:  ?=([%gu @ %contacts @ %$ ~] path)  `!>(|)
    ::  Jael names each ship's parent.
    ?:  ?=([%j @ %sein @ @ ~] path)  `!>(`@p`(end 5 (slav %p i.t.t.t.t.path)))
    ?:  (lien path |=(part=@ta =(%hand-state part)))  `!>(ledger)
    ::  .who has joined the group of chat/~lux/test and may read it.
    ?:  (lien path |=(part=@ta =(%can-read part)))  `!>(|=([reader=@p *] =(who reader)))
    ?:  (lien path |=(part=@ta =(%groups part)))  `!>((my ~[[[~lux %test] (room-group who)]]))
    ?:  ?=([%gx @ %chat @ %dm %invited %ships ~] path)  `!>(~)
    ?:  =(%$ (rear path))  `!>(&)
    ~
  ;<  *  bind:m  (do-load adapter `!>(saved))
  ;<  ~  bind:m
    %-  jab-bowl
    |=  b=bowl
    =.  wex.b  (~(put by wex.b) [/publications our %channels] [& /v2])
    ::  The claim's result arrives on its own watch of the head.
    b(wex (~(put by wex.b) [/hand/claim/0v1 our %harness] [& /hands/tlon-claim-0v1]))
  =/  acquired=json
    (pairs:enjs:format ~[['acquired' %b &] ['attempt' (numb:enjs:format 0)]])
  ;<  caz=(list card)  bind:m
    (do-agent /hand/claim/0v1 [our %harness] [%fact %noun !>(`(each json @t)`[%& acquired])])
  =/  sent
    %+  lien  caz
    |=(=card ?=([%pass [%publish *] %agent [* %channels] %poke *] card))
  (pure:m sent (receipts caz))
::
++  room-group
  |=  who=@p
  ^-  group:v9:g
  =/  group  *group:v9:g
  =.  seats.group  (my ~[[who `seat:v9:g`[~ ~2026.9.9]]])
  group(channels (my ~[[[%chat ~lux %test] *channel:v9:g]]))
++  bus-trusted
  ^-  policy:t
  [& `~nec (my ~[[~bus ~[%web]]]) %all ~ ~]
++  failed
  ^-  (list action:hh)
  ~[[%receipt-at 'tlon' 0v1 'harness-tlon' 0 %failed '']]
++  test-reply-to-a-speaker-revoked-mid-turn-is-not-published
  %-  eval-mare
  =/  n  (mare ,~)
  ^-  form:n
  =/  policy  bus-trusted
  ;<  granted=[sent=? receipts=(list action:hh)]  bind:n
    (claim policy ~ ~2026.9.30)
  ::  The owner removed ~bus after it asked; the room's own actor is unchanged.
  ;<  revoked=[sent=? receipts=(list action:hh)]  bind:n
    (claim policy(trusted ~) (my ~[[~bus ~2026.9.30..01.00.00]]) ~2026.9.30)
  ;<  ~  bind:n  (ex-equal !>(granted) !>([& `(list action:hh)`~]))
  (ex-equal !>(revoked) !>([| failed]))
++  test-stale-reply-is-not-published-after-regrant
  %-  eval-mare
  =/  n  (mare ,~)
  ^-  form:n
  ::  ~bus is granted again, after the turn it asked in.
  ;<  stale=[sent=? receipts=(list action:hh)]  bind:n
    (claim bus-trusted (my ~[[~bus ~2026.9.30..01.00.00]]) ~2026.9.30)
  ;<  fresh=[sent=? receipts=(list action:hh)]  bind:n
    (claim bus-trusted (my ~[[~bus ~2026.9.30..01.00.00]]) ~2026.9.30..02.00.00)
  ;<  ~  bind:n  (ex-equal !>(stale) !>([| failed]))
  (ex-equal !>(fresh) !>([& `(list action:hh)`~]))
::  A sibling moon's owner asked with owner authority; sibling ownership was
::  then turned off. The sibling is still trusted in the channel, but a reply
::  from before the change is not sent.
::
++  test-sibling-reply-from-before-sibling-ownership-ended-is-not-published
  %-  eval-mare
  =/  n  (mare ,~)
  ^-  form:n
  =/  parent=@p  ~sampel-palnet
  =/  our=@p  (add parent (bex 32))
  =/  sibling=@p  (add parent (bex 33))
  =/  policy=policy:t  [& `~nec (my ~[[sibling ~[%web]]]) %all ~ ~]
  =/  ended  ~2026.9.30..01.00.00
  ;<  stale=[sent=? receipts=(list action:hh)]  bind:n
    (claim-by our sibling policy ~ ended ~2026.9.30)
  ;<  fresh=[sent=? receipts=(list action:hh)]  bind:n
    (claim-by our sibling policy ~ ended ~2026.9.30..02.00.00)
  ;<  ~  bind:n  (ex-equal !>(stale) !>([| failed]))
  (ex-equal !>(fresh) !>([& `(list action:hh)`~]))
::
++  test-an-accepted-observe-posts-no-notice
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  to=destination:t  [%dm ~nec ~]
  =/  saved=state-3:t  *state-3:t
  =.  saved
    %=  saved  owner-initialized  1  policy  [& `~nec ~ %mentions ~ ~]
        lanes  (my ~[['conversation' [to 0 ~]]])
        routes  (my ~[['conversation' ['binding' %ready]]])
        jobs  (my ~[[0v1 [[~nec 'event' to 'Hello'] 'conversation' %observe '']]])
    ==
  =/  =wire  /hand/observe/0v1
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now ~2026.10.1)))
  ;<  ~  bind:m
    %-  set-scry-gate
    |=  =path
    ^-  (unit vase)
    ?:  (lien path |=(part=@ta =(%hand-state part)))  `!>(*state:hh)
    `!>(|)
  ;<  *  bind:m  (do-load adapter `!>(saved))
  ;<  ~  bind:m
    (jab-bowl |=(b=bowl b(wex (~(put by wex.b) [wire ~zod %harness] [& /hands/x]))))
  ;<  caz=(list card)  bind:m
    (do-agent wire [~zod %harness] [%fact %noun !>(`(each json @t)`[%& [%o ~]])])
  ;<  =vase  bind:m  get-save
  =/  s  !<(state-3:t vase)
  ;<  ~  bind:m  (ex-equal !>(jobs.s) !>(`(map @uv job:t)`~))
  ;<  ~  bind:m
    %+  ex-equal
      !>((skim caz |=(=card ?=([%pass * %agent [* ?(%chat %channels)] %poke *] card))))
    !>(`(list card)`~)
  (ex-equal !>(notices.s) !>(`(list notice:t)`~))
--
