::  Full adapter acknowledgement handling; emitted Messenger cards never run.
/-  t=harness-tlon, hh=harness-hand
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
  =/  saved=state-2:t  *state-2:t
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
  (pure:m deliveries:!<(state-2:t vase) (receipts caz))
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
--
