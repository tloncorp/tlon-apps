::  Full adapter acknowledgement handling; emitted Messenger cards never run.
/-  h=harness, t=harness-tlon, hh=harness-hand, g=groups-ver, cr=harness-cron, steward-lens
/+  *test-agent, tp=harness-tlon-policy, hd=harness-hand
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
  =/  saved=state-5:t  *state-5:t
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
  (pure:m deliveries:!<(state-5:t vase) (receipts caz))
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
  =/  saved=state-5:t  *state-5:t
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
  =/  saved=state-5:t  *state-5:t
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
  =/  s  !<(state-5:t vase)
  ;<  ~  bind:m  (ex-equal !>(jobs.s) !>(`(map @uv job:t)`~))
  ;<  ~  bind:m
    %+  ex-equal
      !>((skim caz |=(=card ?=([%pass * %agent [* ?(%chat %channels)] %poke *] card))))
    !>(`(list card)`~)
  (ex-equal !>(notices.s) !>(`(list notice:t)`~))
::  Silence. The owner (~nec) said something the bot (~zod) answers with
::  .body; the bot holds the claim on that reply at attempt 1. Only for a
::  channel message heard without a mention, outside a schedule, a failure
::  notice, or a reply whose text is empty or exactly NO_REPLY, is left
::  unsent, by abandoning the claim. A later reply to the room, 0v2, waits
::  behind it.
::
++  heard  'unaddressed/0v1'
++  quiet-reason  'The bot chose not to reply.'
++  failed-reason  'The run failed on a message that did not mention the bot.'
++  provider-error
  'The model provider rejected the request format or options. The owner can inspect the session details and check model compatibility.'
++  thread  `destination:t`[%channel [%chat ~lux %test] `~2026.9.30]
++  room  `destination:t`[%channel [%chat ~lux %test] ~]
+$  said  [to=destination:t event=@t kind=?(%reply %failure %cancelled) body=@t]
+$  claimed  [sent=? acts=(list action:hh) saved=state-5:t]
++  quiet-now  ~2026.10.1..00.01.00
++  run-of
  |=  kind=?(%prompt %reminder)
  ^-  schedule:cr
  =/  s  *schedule:cr
  s(binding 'binding', actor '~nec', hand 'tlon', kind kind, sid 'room', run-sid 'run')
::  The pending reply, by a scheduled run when .scheduled, and the later one.
::
++  pending-ledger
  |=  [=said scheduled=?]
  ^-  state:hh
  =/  [binding=@t sid=@t]  ?:(scheduled ['run' 'run'] ['binding' 'room'])
  =/  address  (address:tp to.said)
  =/  later  (address:tp room)
  =/  =phase:hh
    ?-  kind.said
      %reply  %completed
      %failure  %failed
      %cancelled  %cancelled
    ==
  =/  db  *state:hh
  %=  db
      bindings
    %-  my
    :~  [binding ['tlon' address sid ~['*'] &]]
        ['binding' ['tlon' later 'room' ~['*'] &]]
    ==
      observations
    %-  my
    :~  [0v1 [binding event.said '~nec' 'hello' ~2026.10.1 phase]]
        [0v2 ['binding' '0v2' '~nec' 'again' ~2026.10.1..00.00.30 %completed]]
    ==
      outbox
    %-  my
    :~  [0v1 [0v1 binding 'tlon' address sid kind.said body.said %pending '' '' ~]]
        [0v2 [0v2 'binding' 'tlon' later 'room' %reply 'Later answer' %pending '' '' ~]]
    ==
  ==
::  The head applies .act to .db, as it would answer the adapter.
::
++  applied
  |=  [db=state:hh act=action:hh]
  ^-  [db=state:hh result=(each json @t)]
  =/  res  (apply:hd db act quiet-now)
  ?:  ?=(%| -.res)  [db [%| p.res]]
  [db.p.res [%& result.p.res]]
++  quiet-gate
  |=  [ledger=state:hh scheduled=(unit schedule:cr)]
  |=  =path
  ^-  (unit vase)
  ?:  ?=([%gu @ %contacts @ %$ ~] path)  `!>(|)
  ?:  ?=([%gu @ %steward @ %$ ~] path)  `!>(|)
  ?:  ?=([%gu @ %activity @ %$ ~] path)  `!>(|)
  ?:  ?=([%j @ %sein @ @ ~] path)  `!>(`@p`(end 5 (slav %p i.t.t.t.t.path)))
  ?:  ?=([%gx @ %harness @ %hand-state %noun ~] path)  `!>(ledger)
  ?:  ?=([%gx @ %harness @ %hand-index %noun ~] path)  `!>((reindex:hd ledger))
  ?:  ?=([%gx @ %harness @ %cron-session @ %noun ~] path)
    `!>(`(unit schedule:cr)`?:(=('run' (snag 5 `(list @ta)`path)) scheduled ~))
  ?:  ?=([%gx @ %harness @ %cron-authority @ %noun ~] path)  `!>(&)
  ?:  ?=([%gx @ %harness @ %work-card @ %noun ~] path)  `!>(`(unit @t)`~)
  ?:  ?=([%gx @ %harness @ %sessions %json ~] path)  `!>(`json`[%a ~])
  ::  Context Lens reads these when it is on.
  ?:  ?=([%gx @ %harness @ %head @ %noun ~] path)
    `!>(`[revision=@ud view=view:h next=(unit step:h)]`[0 *view:h ~])
  ?:  ?=([%gx @ %harness @ %run @ @ %noun ~] path)  `!>(`(unit json)`[~ [%o ~]])
  ?:  (lien path |=(part=@ta =(%can-read part)))  `!>(|=([reader=@p *] =(~nec reader)))
  ?:  (lien path |=(part=@ta =(%groups part)))  `!>((my ~[[[~lux %test] (room-group ~nec)]]))
  ?:  ?=([%gx @ %chat @ %dm %invited %ships ~] path)  `!>(~)
  ?:  =(%$ (rear path))  `!>(&)
  ~
::  The head and channel publication watches are up.
::
++  connected
  %-  jab-bowl
  |=  b=bowl
  =.  wex.b  (~(put by wex.b) [/publications ~zod %channels] [& /v3])
  b(wex (~(put by wex.b) [/head ~zod %harness] [& /hand-events]))
++  quiet-saved
  |=  to=destination:t
  ^-  state-5:t
  =/  s  *state-5:t
  %=  s
    owner-initialized  1
    policy  [& `~nec ~ %mentions ~ ~]
    lanes  (my ~[['room' [to 1 ~]]])
    routes  (my ~[['room' ['binding' %ready]]])
    deliveries  (my ~[[0v1 [0 %claim %uncertain '']]])
  ==
++  hand-result
  |=  [=wire result=(each json @t)]
  (do-agent wire [~zod %harness] [%fact %noun !>(result)])
++  head-fact  (do-agent /head [~zod %harness] [%fact %noun !>(~)])
++  published
  |=  caz=(list card)
  ^-  ?
  (lien caz |=(=card ?=([%pass [%publish *] %agent * %poke *] card)))
++  saved
  =/  m  (mare ,state-5:t)
  ^-  form:m
  ;<  =vase  bind:m  get-save
  (pure:m !<(state-5:t vase))
::  The head grants the claim on .said's reply and the adapter takes the
::  result. Produces the ledger after the claim.
::
++  claim-said
  |=  [=said scheduled=(unit schedule:cr)]
  =/  m  (mare ,[db=state:hh out=claimed])
  ^-  form:m
  =/  [db=state:hh claim=(each json @t)]
    (applied (pending-ledger said ?=(^ scheduled)) [%claim 'tlon' 0v1 'harness-tlon'])
  ;<  ~  bind:m  (set-bowl %*(. *bowl our ~zod, src ~zod, now quiet-now))
  ;<  ~  bind:m  (set-scry-gate (quiet-gate db scheduled))
  ;<  *  bind:m  (do-load adapter `!>((quiet-saved to.said)))
  ;<  ~  bind:m  connected
  ;<  ~  bind:m
    %-  jab-bowl
    |=(b=bowl b(wex (~(put by wex.b) [/hand/claim/0v1 ~zod %harness] [& /hands/tlon-claim-0v1])))
  ;<  caz=(list card)  bind:m  (hand-result /hand/claim/0v1 claim)
  ;<  s=state-5:t  bind:m  saved
  (pure:m db [(published caz) (receipts caz) s])
++  abandoned-as
  |=  reason=@t
  `action:hh`[%resolve 'tlon' 0v1 1 %abandoned '' reason]
++  abandonment  (abandoned-as quiet-reason)
::  The reply was left unsent: the claim is being abandoned at its attempt.
::
++  ex-silent
  |=  out=claimed
  (ex-left out quiet-reason)
++  ex-left
  |=  [out=claimed reason=@t]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (ex-equal !>(sent.out) !>(|))
  ;<  ~  bind:m  (ex-equal !>(acts.out) !>(`(list action:hh)`~[(abandoned-as reason)]))
  %+  ex-equal  !>(deliveries.saved.out)
  !>(`(map @uv delivery:t)`(my ~[[0v1 [1 %claim %uncertain 'no-reply']]]))
++  ex-sent
  |=  out=claimed
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (ex-equal !>(sent.out) !>(&))
  (ex-equal !>(acts.out) !>(`(list action:hh)`~))
::  A head fact claims the later reply, which is sent, and no entry for the
::  settled one remains. .caz answered the step that settled it.
::
++  later-delivered
  |=  [caz=(list card) db=state:hh]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m
    %+  ex-equal  !>((receipts caz))
    !>(`(list action:hh)`~[[%claim 'tlon' 0v2 'harness-tlon']])
  =/  [taken=state:hh claim=(each json @t)]  (applied db [%claim 'tlon' 0v2 'harness-tlon'])
  ;<  ~  bind:m  (set-scry-gate (quiet-gate taken ~))
  ;<  ~  bind:m  connected
  ;<  sent=(list card)  bind:m  (hand-result /hand/claim/0v2 claim)
  ;<  s=state-5:t  bind:m  saved
  ;<  ~  bind:m  (ex-equal !>((published sent)) !>(&))
  (ex-equal !>(~(key by deliveries.s)) !>((silt ~[0v2])))
::
++  test-an-unaddressed-channel-reply-of-no-reply-or-nothing-is-left-unsent
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  silent
    |=  [to=destination:t body=@t]
    =/  n  (mare ,~)
    ^-  form:n
    ;<  [* out=claimed]  bind:n  (claim-said [to heard %reply body] ~)
    (ex-silent out)
  ;<  ~  bind:m  (silent room 'NO_REPLY')
  ;<  ~  bind:m  (silent room '  NO_REPLY\0a')
  ;<  ~  bind:m  (silent room '')
  ;<  ~  bind:m  (silent room ' \0a\09 ')
  ;<  ~  bind:m  (silent thread 'NO_REPLY')
  (silent thread '')
++  test-an-unaddressed-reply-with-more-than-no-reply-is-published
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [* out=claimed]  bind:m  (claim-said [room heard %reply 'NO_REPLY and more'] ~)
  (ex-sent out)
::  A mention, a DM, a scheduled run, a reminder, a task reply and a Lens
::  retry are always answered. The DM and the scheduled run carry the
::  unaddressed prefix so that only their lane or schedule decides.
::
++  test-addressed-dm-and-scheduled-replies-are-published-whatever-their-text
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  sent
    |=  [=said scheduled=(unit schedule:cr)]
    =/  n  (mare ,~)
    ^-  form:n
    ;<  [* out=claimed]  bind:n  (claim-said said scheduled)
    (ex-sent out)
  =/  dm  `destination:t`[%dm ~nec ~]
  =/  dm-thread  `destination:t`[%dm ~nec `[~nec ~2026.9.30]]
  ;<  ~  bind:m  (sent [room '0v1' %reply 'NO_REPLY'] ~)
  ;<  ~  bind:m  (sent [room '0v1' %reply ''] ~)
  ;<  ~  bind:m  (sent [thread '0v1' %reply 'NO_REPLY'] ~)
  ;<  ~  bind:m  (sent [dm heard %reply 'NO_REPLY'] ~)
  ;<  ~  bind:m  (sent [dm heard %reply ''] ~)
  ;<  ~  bind:m  (sent [dm-thread heard %reply 'NO_REPLY'] ~)
  ;<  ~  bind:m  (sent [room heard %reply 'NO_REPLY'] `(run-of %prompt))
  ;<  ~  bind:m  (sent [room 'cron/0v1/~2026.10.1' %reply ''] `(run-of %reminder))
  ;<  ~  bind:m  (sent [room 'work-reply/0v1' %reply 'NO_REPLY'] ~)
  (sent [room 'lens-retry/0v1' %reply 'NO_REPLY'] ~)
::  A failure notice for a channel message heard without a mention is left
::  unsent whatever its text, with its own reason.
::
++  test-an-unaddressed-channel-failure-is-left-unsent-and-a-later-reply-is-delivered
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [* threaded=claimed]  bind:m  (claim-said [thread heard %failure provider-error] ~)
  ;<  ~  bind:m  (ex-left threaded failed-reason)
  ;<  [db=state:hh out=claimed]  bind:m  (claim-said [room heard %failure provider-error] ~)
  ;<  ~  bind:m  (ex-left out failed-reason)
  =/  [abandoned=state:hh result=(each json @t)]  (applied db (abandoned-as failed-reason))
  ;<  ~  bind:m  (set-scry-gate (quiet-gate abandoned ~))
  ;<  caz=(list card)  bind:m  (hand-result /hand/resolve/0v1 result)
  (later-delivered caz abandoned)
::  Recovery picks the reason from the publication again.
::
++  test-a-reload-before-a-failure-abandonment-commits-sends-it-again-with-its-reason
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [db=state:hh out=claimed]  bind:m  (claim-said [room heard %failure provider-error] ~)
  ;<  caz=(list card)  bind:m  (reload saved.out db)
  ;<  ~  bind:m
    (ex-equal !>((receipts caz)) !>(`(list action:hh)`~[(abandoned-as failed-reason)]))
  (ex-equal !>((published caz)) !>(|))
::  A failure for a mention, a DM, a scheduled run and a Lens retry is
::  posted; so is a cancellation, even for a message heard without a mention.
::
++  test-addressed-dm-scheduled-and-retried-failures-and-cancellations-are-published
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  sent
    |=  [=said scheduled=(unit schedule:cr)]
    =/  n  (mare ,~)
    ^-  form:n
    ;<  [* out=claimed]  bind:n  (claim-said said scheduled)
    (ex-sent out)
  ;<  ~  bind:m  (sent [room '0v1' %failure provider-error] ~)
  ;<  ~  bind:m  (sent [[%dm ~nec ~] heard %failure provider-error] ~)
  ;<  ~  bind:m  (sent [room heard %failure provider-error] `(run-of %prompt))
  ;<  ~  bind:m  (sent [room 'lens-retry/0v1' %failure provider-error] ~)
  (sent [room heard %cancelled 'Work was cancelled.'] ~)
::  The owner can retry an abandoned failure from Context Lens: the retry is
::  a fresh event, admitted again, and its reply is posted.
::
++  test-a-lens-retry-of-an-abandoned-failure-is-admitted-and-its-reply-delivered
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [db=state:hh out=claimed]  bind:m  (claim-said [room heard %failure provider-error] ~)
  ::  Without the later reply, the retry's answer is the next for the room.
  =/  abandoned  db:(applied db (abandoned-as failed-reason))
  =.  outbox.abandoned  (~(del by outbox.abandoned) 0v2)
  =/  s  saved.out
  ;<  *  bind:m  (reload s(lens [& `~nec `@da`0 ~ '']) abandoned)
  ;<  ~  bind:m  connected
  ;<  caz=(list card)  bind:m
    %^  do-agent  /lens/events  [~zod %steward]
    [%fact %steward-lens-update-1 !>(`update:v1:steward-lens`[%retry-requested '0v1' ~nec])]
  =/  retry  `action:hh`[%observe 'binding' 'lens-retry/0v1' '~nec' 'hello']
  ;<  ~  bind:m  (ex-equal !>((receipts caz)) !>(`(list action:hh)`~[retry]))
  =/  id  (input-id:hd 'binding' 'lens-retry/0v1')
  =/  answered
    %^  finish:hd  (start:hd db:(applied abandoned retry) 'room' id)  'room'
    [%reply 'Retried answer']
  ;<  ~  bind:m  (set-scry-gate (quiet-gate answered ~))
  ;<  claims=(list card)  bind:m  head-fact
  ;<  ~  bind:m
    %+  ex-equal  !>((receipts claims))
    !>(`(list action:hh)`~[[%claim 'tlon' id 'harness-tlon']])
  =/  [taken=state:hh claim=(each json @t)]  (applied answered [%claim 'tlon' id 'harness-tlon'])
  ;<  ~  bind:m  (set-scry-gate (quiet-gate taken ~))
  ;<  sent=(list card)  bind:m  (hand-result /hand/claim/(scot %uv id) claim)
  (ex-equal !>((published sent)) !>(&))
::  Every head fact reconciles; only recovery sends an abandonment again.
::
++  test-head-facts-before-the-abandonment-result-send-it-once
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [db=state:hh out=claimed]  bind:m  (claim-said [room heard %reply 'NO_REPLY'] ~)
  ;<  ~  bind:m  (ex-silent out)
  ;<  first=(list card)  bind:m  head-fact
  ;<  second=(list card)  bind:m  head-fact
  ;<  s=state-5:t  bind:m  saved
  ;<  ~  bind:m  (ex-equal !>((receipts (weld first second))) !>(`(list action:hh)`~))
  ;<  ~  bind:m  (ex-equal !>((published (weld first second))) !>(|))
  ;<  ~  bind:m  (ex-equal !>(deliveries.s) !>(deliveries.saved.out))
  =/  [abandoned=state:hh result=(each json @t)]  (applied db abandonment)
  ;<  ~  bind:m  (set-scry-gate (quiet-gate abandoned ~))
  ;<  caz=(list card)  bind:m  (hand-result /hand/resolve/0v1 result)
  (later-delivered caz abandoned)
++  test-a-lost-abandonment-result-is-settled-by-the-next-head-fact
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [db=state:hh *]  bind:m  (claim-said [room heard %reply 'NO_REPLY'] ~)
  =/  abandoned  db:(applied db abandonment)
  ;<  ~  bind:m  (set-scry-gate (quiet-gate abandoned ~))
  ;<  caz=(list card)  bind:m  head-fact
  ;<  ~  bind:m  (ex-equal !>((published caz)) !>(|))
  (later-delivered caz abandoned)
::  The adapter reloads, and the head's watch is acknowledged again.
::
++  reload
  |=  [s=state-5:t db=state:hh]
  =/  m  (mare ,(list card))
  ^-  form:m
  ;<  ~  bind:m  (set-scry-gate (quiet-gate db ~))
  ;<  loaded=(list card)  bind:m  (do-load adapter `!>(s))
  ;<  *  bind:m  (do-agent /publications [~zod %channels] [%watch-ack ~])
  ;<  acked=(list card)  bind:m  (do-agent /head [~zod %harness] [%watch-ack ~])
  (pure:m (weld loaded acked))
++  test-a-reload-before-the-abandonment-commits-sends-it-again
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [db=state:hh out=claimed]  bind:m  (claim-said [room heard %reply 'NO_REPLY'] ~)
  ;<  caz=(list card)  bind:m  (reload saved.out db)
  ;<  ~  bind:m  (ex-equal !>((receipts caz)) !>(`(list action:hh)`~[abandonment]))
  ;<  ~  bind:m  (ex-equal !>((published caz)) !>(|))
  =/  [abandoned=state:hh result=(each json @t)]  (applied db abandonment)
  ;<  ~  bind:m  (set-scry-gate (quiet-gate abandoned ~))
  ;<  done=(list card)  bind:m  (hand-result /hand/resolve/0v1 result)
  (later-delivered done abandoned)
++  test-a-reload-after-the-abandonment-commits-publishes-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [db=state:hh out=claimed]  bind:m  (claim-said [room heard %reply 'NO_REPLY'] ~)
  =/  abandoned  db:(applied db abandonment)
  ;<  caz=(list card)  bind:m  (reload saved.out abandoned)
  ;<  ~  bind:m  (ex-equal !>((published caz)) !>(|))
  (later-delivered caz abandoned)
::  The ledger checks the attempt before whether the publication is
::  terminal, so a repeated abandonment is refused as stale; the adapter
::  reads the publication instead of the reason.
::
++  test-a-refused-abandonment-of-a-terminal-publication-sets-no-error
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [db=state:hh *]  bind:m  (claim-said [room heard %reply 'NO_REPLY'] ~)
  =/  abandoned  db:(applied db abandonment)
  =/  refused  result:(applied abandoned abandonment)
  ;<  ~  bind:m  (ex-equal !>(?=(%| -.refused)) !>(&))
  ;<  ~  bind:m  (set-scry-gate (quiet-gate abandoned ~))
  ;<  caz=(list card)  bind:m  (hand-result /hand/resolve/0v1 refused)
  ;<  s=state-5:t  bind:m  saved
  ;<  ~  bind:m  (ex-equal !>(error.s) !>(''))
  ;<  ~  bind:m  (ex-equal !>((published caz)) !>(|))
  (later-delivered caz abandoned)
::  A refusal changes nothing in the ledger, so no head fact would follow:
::  the adapter sends the abandonment again at once and reports the error.
::
++  test-a-refused-abandonment-of-a-claimed-publication-is-retried
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [db=state:hh *]  bind:m  (claim-said [room heard %reply 'NO_REPLY'] ~)
  =/  reason  'Wrong hand or stale recovery attempt'
  ;<  caz=(list card)  bind:m  (hand-result /hand/resolve/0v1 [%| reason])
  ;<  s=state-5:t  bind:m  saved
  ;<  ~  bind:m  (ex-equal !>((receipts caz)) !>(`(list action:hh)`~[abandonment]))
  ;<  ~  bind:m  (ex-equal !>((published caz)) !>(|))
  ;<  ~  bind:m  (ex-equal !>(error.s) !>(reason))
  =/  [abandoned=state:hh result=(each json @t)]  (applied db abandonment)
  ;<  ~  bind:m  (set-scry-gate (quiet-gate abandoned ~))
  ;<  done=(list card)  bind:m  (hand-result /hand/resolve/0v1 result)
  ;<  ~  bind:m  (later-delivered done abandoned)
  ;<  after=state-5:t  bind:m  saved
  (ex-equal !>(error.after) !>(reason))
++  test-a-late-claim-result-does-not-reopen-a-reply-being-abandoned
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  [db=state:hh out=claimed]  bind:m  (claim-said [room heard %reply 'NO_REPLY'] ~)
  =/  again  result:(applied db [%claim 'tlon' 0v1 'harness-tlon'])
  ;<  ~  bind:m
    %-  jab-bowl
    |=(b=bowl b(wex (~(put by wex.b) [/hand/claim/0v1 ~zod %harness] [& /hands/tlon-claim-0v1])))
  ;<  caz=(list card)  bind:m  (hand-result /hand/claim/0v1 again)
  ;<  s=state-5:t  bind:m  saved
  ;<  ~  bind:m  (ex-equal !>((receipts caz)) !>(`(list action:hh)`~))
  ;<  ~  bind:m  (ex-equal !>((published caz)) !>(|))
  (ex-equal !>(deliveries.s) !>(deliveries.saved.out))
--
