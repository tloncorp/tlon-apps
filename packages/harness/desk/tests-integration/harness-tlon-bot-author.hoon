::  Full adapter, synthetic scries only; no emitted cards are executed.
::  Admission records whether a channel message's own author has a bot profile,
::  and a ledger refusal or a failed route setup ends its admission without
::  stopping catch-up.
::  -test /=harness=/tests-integration/harness-tlon-bot-author
/-  t=harness-tlon, hh=harness-hand, a=activity-ver, dv=channels-ver, cv=chat-ver,
    g=groups-ver, h=harness, ad=harness-adapter
/+  *test-agent, policy=harness-tlon-policy, continuity=harness-tlon-continuity,
    codec=harness-acp, hd=harness-hand
/=  adapter  /app/harness-tlon
|%
+$  outcome  [cards=(list card) saved=state-7:t]
+$  post-row  [@da (may:v9:dv post:v9:dv)]
+$  reply-row  [@da (may:v9:dv reply:v9:dv)]
::  What local %channels holds. Any other %channels read blocks the test.
+$  native
  $:  up=?
      has=?
      top=@da
      posts=(list post-row)
      replies=(unit (list reply-row))
  ==
++  now  ~2026.10.1..00.00.10
++  parent-at  ~2026.10.1..00.00.02
++  message-at  ~2026.10.1..00.00.05
++  nest  [%chat ~nec %general]
++  bot  `author:v9:dv`[~nec `'Bot' ~]
++  fixture
  ^-  state-7:t
  =/  s=state-7:t  *state-7:t
  %=  s  owner-initialized  1  policy  [& `~nec ~ %mentions ~ ~ ~ ~]  watching  &
    activity-through  ~2026.10.1
  ==
++  post-event
  |=  actor=@p
  ^-  incoming-event:v8:a
  [%post [[actor message-at] message-at] nest [~nec %home] ~[[%inline ~['hello']]] &]
++  reply-event
  ^-  incoming-event:v8:a
  :*  %reply  [[~nec message-at] message-at]  [[~nec parent-at] parent-at]
      nest  [~nec %home]  ~[[%inline ~['hello']]]  &
  ==
++  dm-event
  ^-  incoming-event:v8:a
  [%dm-post [[~nec message-at] message-at] [%ship ~nec] ~[[%inline ~['hello']]] |]
++  post
  |=  [at=@da who=author:v9:dv]
  ^-  post-row
  =/  p=post:v9:dv  *post:v9:dv
  [at %& p(id at, author who)]
++  reply
  |=  [at=@da who=author:v9:dv]
  ^-  reply-row
  =/  r=reply:v9:dv  *reply:v9:dv
  [at %& r(id at, parent-id parent-at, author who)]
++  tombstone
  |=  at=@da
  ^-  post-row
  [at %| [at bot 1 now]]
++  reply-tombstone
  |=  [at=@da who=author:v9:dv]
  ^-  reply-row
  [at %| [at who 0 now]]
++  base
  /(scot %p ~zod)/channels/(scot %da now)/v4/chat/(scot %p ~nec)/general
++  channels
  |=  [=native =path]
  ^-  (unit vase)
  ?:  =(path [%gu (scot %p ~zod) %channels (scot %da now) %$ ~])  `!>(up.native)
  ?.  up.native  ~
  ?:  =(path [%gu base])  `!>(has.native)
  ?.  has.native  ~
  =/  page  /posts/older/(scot %ud +(top.native))/1/outline/channel-posts-4
  ?:  =(path [%gx (weld base page)])
    `!>(`paged-posts:v9:dv`[(gas:on-posts:v9:dv ~ posts.native) ~ ~ 0 0])
  ?~  replies.native  ~
  =/  page
    %+  weld  base
    /posts/post/id/(scot %ud parent-at)/replies/older/(scot %ud +(message-at))/1/channel-replies-4
  ?.  =(path [%gx page])  ~
  `!>(`replies:v9:dv`(gas:on-replies:v9:dv ~ u.replies.native))
::  No read at all: every %channels path blocks.
++  unread
  ^-  (unit native)
  ~
++  defaults
  ^-  json
  %-  pairs:enjs:format
  :~  ['url' s+'']  ['model' s+'']  ['headers' a+~]  ['system' s+'']
      ['max-context' n+'1']  ['tools' a+~]
  ==
::  Our bowl at .now, with the head and Activity watches acknowledged.
++  watched
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (set-bowl %*(. *bowl our ~zod, src ~zod, now now))
  %-  jab-bowl
  |=  b=bowl
  =.  wex.b  (~(put by wex.b) [/head ~zod %harness] [& /hand-events])
  b(wex (~(put by wex.b) [/activity ~zod %activity] [& /v4]))
++  run
  |=  [saved=state-7:t event=incoming-event:v8:a native=(unit native)]
  (run-in ~ saved event native)
::  .run, with Groups holding .groups, whose channels anyone seated may read.
++  run-in
  |=  [=groups:v9:g saved=state-7:t event=incoming-event:v8:a native=(unit native)]
  =/  m  (mare ,outcome)
  ^-  form:m
  =/  =stream:v10:a
    (put:on-stream:v10:a ~ message-at [;;(incoming-event:v10:a event) | |])
  ;<  ~  bind:m  watched
  ;<  ~  bind:m
    %-  set-scry-gate
    |=  =path
    ^-  (unit vase)
    ?:  ?=([@ @ %channels *] path)  ?~(native ~ (channels u.native path))
    ?:  ?=([%gu @ %contacts @ %$ ~] path)  `!>(|)
    ::  harness-tlon-steward covers the Steward lease.
    ?:  ?=([%gu @ %steward @ %$ ~] path)  `!>(|)
    ?:  =(%$ (rear path))  `!>(&)
    ?:  ?=([%gx @ %chat @ %dm %invited %ships ~] path)  `!>(~)
    ?:  ?=([%gx @ %chat @ %blocked %ships ~] path)  `!>(`(set @p)`~)
    ?:  ?=([%gx @ %groups @ %v2 %groups %noun ~] path)  `!>(groups)
    ?:  (lien path |=(part=@ta =(%can-read part)))  `!>(|=([@p *] &))
    ?:  ?=([%gx @ %activity @ %v6 %all %noun ~] path)  `!>(stream)
    ?:  ?=([%gx @ %harness @ %hand-state %noun ~] path)  `!>(*state:hh)
    ?:  ?=([%gx @ %harness @ %cron-session @ %noun ~] path)  `!>(~)
    ?:  ?=([%gx @ %harness @ %sessions %json ~] path)  `!>(`json`[%a ~])
    ?:  ?=([%gx @ %harness @ %defaults %json ~] path)  `!>(defaults)
    ~
  ::  Loading an acknowledged Activity watch catches up on the stream.
  ;<  caz=(list card)  bind:m  (do-load adapter `!>(saved))
  ;<  =vase  bind:m  get-save
  (pure:m caz !<(state-7:t vase))
++  kinds
  |=  out=outcome
  ^-  (list @t)
  (turn notices.saved.out |=(n=notice:t kind.n))
::  Admitted with .kind, one job, and catch-up past the row.
++  admitted
  |=  [kind=@t out=(form-raw outcome)]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  got=outcome  bind:m  out
  ;<  ~  bind:m  (ex-equal !>((kinds got)) !>(`(list @t)`~[kind]))
  ;<  ~  bind:m  (ex-equal !>(~(wyt by jobs.saved.got)) !>(1))
  (ex-equal !>(activity-through.saved.got) !>(message-at))
::  Refused before admission: no notice, no new job, catch-up past the row.
++  refused
  |=  [jobs=@ud out=(form-raw outcome)]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  got=outcome  bind:m  out
  ;<  ~  bind:m  (ex-equal !>((kinds got)) !>(`(list @t)`~))
  ;<  ~  bind:m  (ex-equal !>(~(wyt by jobs.saved.got)) !>(jobs))
  (ex-equal !>(activity-through.saved.got) !>(message-at))
::
::  +run answers only what a head from before the index serves, as a reload
::  of the desk does while the adapter loads, so loading reads no index.
::
++  test-adapter-loads-and-admits-against-a-head-without-the-index
  %-  eval-mare
  %+  admitted  'message'
  (run fixture (post-event ~nec) `[& & message-at ~[(post message-at ~nec)] ~])
++  test-bot-profile-post-is-a-bot-message
  %-  eval-mare
  %+  admitted  'bot-message'
  (run fixture (post-event ~nec) `[& & message-at ~[(post message-at bot)] ~])
++  test-bare-ship-post-is-a-message
  %-  eval-mare
  %+  admitted  'message'
  (run fixture (post-event ~nec) `[& & message-at ~[(post message-at ~nec)] ~])
++  test-deleted-bot-post-keeps-its-author
  %-  eval-mare
  %+  admitted  'bot-message'
  (run fixture (post-event ~nec) `[& & message-at ~[(tombstone message-at)] ~])
++  test-bot-post-makes-the-same-job-and-route-as-a-person-post
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  bot-out=outcome  bind:m
    (run fixture (post-event ~nec) `[& & message-at ~[(post message-at bot)] ~])
  ;<  person=outcome  bind:m
    (run fixture (post-event ~nec) `[& & message-at ~[(post message-at ~nec)] ~])
  =/  same  |=(s=state-7:t s(notices ~))
  ;<  ~  bind:m  (ex-equal !>((same saved.bot-out)) !>((same saved.person)))
  (ex-equal !>(cards.bot-out) !>(cards.person))
++  test-bot-reply-under-a-person-post-is-a-bot-message
  %-  eval-mare
  %+  admitted  'bot-message'
  %^  run  fixture  reply-event
  `[& & parent-at ~[(post parent-at ~nec)] `~[(reply message-at bot)]]
++  test-person-reply-under-a-bot-post-is-a-message
  %-  eval-mare
  %+  admitted  'message'
  %^  run  fixture  reply-event
  `[& & parent-at ~[(post parent-at bot)] `~[(reply message-at ~nec)]]
++  test-deleted-reply-keeps-its-author
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m
    %+  admitted  'bot-message'
    %^  run  fixture  reply-event
    `[& & parent-at ~[(post parent-at ~nec)] `~[(reply-tombstone message-at bot)]]
  %+  admitted  'message'
  %^  run  fixture  reply-event
  `[& & parent-at ~[(post parent-at ~nec)] `~[(reply-tombstone message-at ~nec)]]
::
++  test-unreadable-message-is-admitted-as-a-message
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ::  %channels is not running.
  ;<  ~  bind:m  (admitted 'message' (run fixture (post-event ~nec) `[| & message-at ~[(post message-at bot)] ~]))
  ::  The bot left the channel.
  (admitted 'message' (run fixture (post-event ~nec) `[& | message-at ~[(post message-at bot)] ~]))
++  test-missing-post-is-a-message-whatever-its-neighbor
  %-  eval-mare
  %+  admitted  'message'
  (run fixture (post-event ~nec) `[& & message-at ~[(post parent-at bot)] ~])
++  test-missing-or-deleted-parent-is-a-message-and-reads-no-replies
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ::  The replies page would block: only the parent page is answered.
  ;<  ~  bind:m
    %+  admitted  'message'
    (run fixture reply-event `[& & parent-at ~[(post ~2026.10.1..00.00.01 bot)] ~])
  %+  admitted  'message'
  (run fixture reply-event `[& & parent-at ~[(tombstone parent-at)] ~])
++  test-missing-reply-is-a-message-whatever-its-neighbor
  %-  eval-mare
  %+  admitted  'message'
  %^  run  fixture  reply-event
  `[& & parent-at ~[(post parent-at ~nec)] `~[(reply ~2026.10.1..00.00.03 bot)]]
::
++  test-no-read-for-a-message-before-a-channel-cutoff
  %-  eval-mare
  =/  saved  fixture
  (refused 0 (run saved(channel-after now) (post-event ~nec) unread))
++  test-no-read-for-an-input-already-pending
  %-  eval-mare
  =/  event  (post-event ~nec)
  =/  rules=policy:t  policy:fixture
  =/  input=input:t  (need (normalize:policy ~zod rules event))
  =/  sid  (identity:continuity to.input)
  =/  saved  fixture
  =.  jobs.saved  (my ~[[(sham [0 input]) [input sid %bind '']]])
  =.  routes.saved  (my ~[[sid ['binding' %ready]]])
  (refused 1 (run saved event unread))
::  At the job cap, catch-up stops before the row: no read, no progress.
++  test-no-read-at-the-job-cap
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  saved  fixture
  =.  jobs.saved
    %-  malt
    %+  turn  (gulf 1 64)
    |=  n=@ud
    ^-  [@uv job:t]
    [`@uv`n [[~bus (scot %ud n) [%dm ~bus ~] 'queued'] 'elsewhere' %error '']]
  ;<  got=outcome  bind:m  (run saved (post-event ~nec) unread)
  ;<  ~  bind:m  (ex-equal !>((kinds got)) !>(`(list @t)`~))
  ;<  ~  bind:m  (ex-equal !>(~(wyt by jobs.saved.got)) !>(64))
  (ex-equal !>(activity-through.saved.got) !>(~2026.10.1))
::  ~bud may read the channel, so its post opens a request. Only then is the
::  post read, to tell whether its author is a known bot: the card to the
::  owner then names no place to tell it that the bot waits for its owner.
::
++  test-a-denied-post-is-read-when-it-opens-a-request
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  present=native  [& & message-at ~[(post message-at [~bud `'Bud bot' ~])] ~]
  ;<  got=outcome  bind:m
    (run-in (my ~[[[~nec %home] (group ~bud)]]) fixture (post-event ~bud) `present)
  ;<  ~  bind:m
    (ex-equal !>((kinds got)) !>(`(list @t)`~['approval-request' 'permission-denied']))
  ;<  ~  bind:m  (ex-equal !>(~(wyt by jobs.saved.got)) !>(0))
  =/  wires
    %+  murn  cards.got
    |=(c=card ?.(?=([%pass [%approval @ @ @ ~] *] c) ~ `p.c))
  ?>  ?=([[%approval @ @ @ ~] ~] wires)
  %+  ex-equal
    !>(;;((unit destination:t) (cue (slav %uv i.t.t.t.i.wires))))
  !>(`(unit destination:t)`~)
++  test-no-read-for-a-dm
  %-  eval-mare
  (admitted 'message' (run fixture dm-event unread))
::  Refused admissions. ~bus is allowed and has joined the group of .nest.
::
++  guest  ~bus
++  owner-dm  `destination:t`[%dm ~nec ~]
++  guest-dm  `destination:t`[%dm guest ~]
++  room  `destination:t`[%channel nest ~]
++  thread  `destination:t`[%channel nest `parent-at]
++  sentence  'I can\'t answer messages here right now.'
++  ledger-refusal  'This binding or session has reached its waiting-work limit'
++  allowed-fixture
  ^-  state-7:t
  =/  s  fixture
  s(allowed.policy (silt ~[guest]))
::  A ready conversation for .actor at .to.
++  with-lane
  |=  [s=state-7:t actor=@p to=destination:t]
  ^-  state-7:t
  =/  sid  (identity:continuity to)
  %=  s
    lanes  (~(put by lanes.s) sid [to 0 ~])
    routes  (~(put by routes.s) sid ['binding' %ready])
    identities  (~(put by identities.s) to sid)
  ==
::  .with-lane, holding job .id at .stage.
++  with-job
  |=  [s=state-7:t id=@uv actor=@p to=destination:t stage=?(%bind %observe)]
  ^-  state-7:t
  =.  s  (with-lane s actor to)
  =/  sid  (identity:continuity to)
  s(jobs (~(put by jobs.s) id [[actor (scot %uv id) to 'earlier'] sid stage '']))
::  The owner's DM is ready and holds jobs 1 to .n at .stage.
++  stuck
  |=  [n=@ud stage=?(%bind %observe)]
  ^-  state-7:t
  %+  roll  (gulf 1 n)
  |=  [k=@ud s=_allowed-fixture]
  (with-job s `@uv`k ~nec owner-dm stage)
::  The group of .nest, with .who seated.
++  group
  |=  who=@p
  ^-  group:v9:g
  =/  joined  *group:v9:g
  =.  seats.joined  (my ~[[who `seat:v9:g`[~ ~2026.9.9]]])
  joined(channels (my ~[[nest *channel:v9:g]]))
++  gate
  |=  [=stream:v10:a member=?]
  |=  =path
  ^-  (unit vase)
  ?:  ?=([@ @ %channels *] path)  ~
  ::  harness-tlon-steward covers the Steward lease.
  ?:  ?=([%gu @ %steward @ %$ ~] path)  `!>(|)
  ?:  ?=([%gu @ %contacts @ %$ ~] path)  `!>(|)
  ?:  (lien path |=(part=@ta =(%can-read part)))  `!>(|=([@p *] member))
  ?:  ?=([%gx @ %groups @ %v2 %groups %noun ~] path)  `!>((my ~[[[~nec %home] (group guest)]]))
  ?:  =(%$ (rear path))  `!>(&)
  ?:  ?=([%gx @ %chat @ %dm %invited %ships ~] path)  `!>(~)
  ?:  ?=([%gx @ %activity @ %v6 %all %noun ~] path)  `!>(stream)
  ?:  ?=([%gx @ %harness @ %hand-state %noun ~] path)  `!>(*state:hh)
  ?:  ?=([%gx @ %harness @ %hand-index %noun ~] path)  `!>(*index:hh)
  ?:  ?=([%gx @ %harness @ %cron-session @ %noun ~] path)  `!>(~)
  ?:  ?=([%gx @ %harness @ %sessions %json ~] path)  `!>(`json`[%a ~])
  ?:  ?=([%gx @ %harness @ %defaults %json ~] path)  `!>(defaults)
  ~
::  Load .saved over .rows. Gall keeps the acknowledged Activity watch;
::  loading renews the head watch, which the head then acknowledges.
++  setup
  |=  [saved=state-7:t rows=(list [@da incoming-event:v8:a])]
  (load-with saved (gate (stream-of rows) &))
++  stream-of
  |=  rows=(list [@da incoming-event:v8:a])
  ^-  stream:v10:a
  %+  gas:on-stream:v10:a  ~
  %+  turn  rows
  |=  [at=@da e=incoming-event:v8:a]
  [at [;;(incoming-event:v10:a e) | |]]
::  .setup, answering scries with .scries.
++  load-with
  |=  [saved=state-7:t scries=$-(path (unit vase))]
  =/  m  (mare ,(list card))
  ^-  form:m
  ;<  ~  bind:m  watched
  ;<  ~  bind:m  (set-scry-gate scries)
  ;<  loaded=(list card)  bind:m  (do-load adapter `!>(saved))
  ;<  head=(list card)  bind:m  (do-agent /head [~zod %harness] [%watch-ack ~])
  (pure:m (weld loaded head))
::  The head's hand ledger refuses job .id at .phase.
++  refuse
  |=  [phase=?(%bind %observe) id=@uv]
  (hand-result phase id [%| ledger-refusal])
::  The head's hand ledger answers job .id at .phase with .result.
++  hand-result
  |=  [phase=?(%bind %observe) id=@uv result=(each json @t)]
  =/  m  (mare ,(list card))
  ^-  form:m
  =/  =wire  /hand/[phase]/(scot %uv id)
  ;<  ~  bind:m
    (jab-bowl |=(b=bowl b(wex (~(put by wex.b) [wire ~zod %harness] [& /hands/x]))))
  (do-agent wire [~zod %harness] [%fact %noun !>(result)])
++  refuse-all
  |=  [phase=?(%bind %observe) ids=(list @uv)]
  =/  m  (mare ,~)
  ^-  form:m
  ?~  ids  (pure:m ~)
  ;<  *  bind:m  (refuse phase i.ids)
  (refuse-all phase t.ids)
++  saved
  =/  m  (mare ,state-7:t)
  ^-  form:m
  ;<  =vase  bind:m  get-save
  (pure:m !<(state-7:t vase))
::  Hand ledger requests among the emitted cards, in order.
++  hand-requests
  |=  caz=(list card)
  ^-  (list action:hh)
  %+  murn  caz
  |=  =card
  ^-  (unit action:hh)
  ?.  ?=([%pass * %agent * %poke %harness-hand *] card)  ~
  =/  [pass=* wire=* agent=* who=* poke=* mark=* data=vase]  card
  `act:!<(request:hh data)
::  Every poke to Chat or Channels, as [mark noun].
++  messenger-pokes
  |=  caz=(list card)
  ^-  (list [mark noun])
  %+  murn  caz
  |=  =card
  ^-  (unit [mark noun])
  ?.  ?=([%pass * %agent [* ?(%chat %channels)] %poke *] card)  ~
  =/  [pass=* wire=* agent=* who=* poke=* mark=@tas data=vase]  card
  `[mark q.data]
++  dm-notice
  |=  [who=@p sent=@da]
  ^-  [mark noun]
  =/  =memo:v9:dv  [~[[%inline ~[sentence]]] [~zod ~ ~] sent]
  :-  %chat-dm-action-2
  `action:dm:v7:cv`[who [[~zod sent] %add [memo chat+/ ~ ~] `sent]]
++  channel-notice
  |=  [actor=@p parent=(unit @da) sent=@da]
  ^-  [mark noun]
  =/  =memo:v9:dv
    [~[[%inline ~[[%ship actor] (cat 3 ' ' sentence)]]] [~zod ~ ~] sent]
  :-  %channel-action-2
  ?~  parent  `a-channels:v10:dv`[%channel nest %post %add [memo [%chat ~] ~ ~]]
  `a-channels:v10:dv`[%channel nest %post %reply u.parent %add [memo ~]]
::
++  test-a-refused-conversation-does-not-stop-other-conversations
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  t1  ~2026.10.1..00.00.05
  =/  t2  ~2026.10.1..00.00.06
  =/  rows
    :~  [t1 [%dm-post [[~nec t1] t1] [%ship ~nec] ~[[%inline ~['owner again']]] |]]
        [t2 [%dm-post [[guest t2] t2] [%ship guest] ~[[%inline ~['guest hello']]] |]]
    ==
  ;<  *  bind:m  (setup (with-lane (stuck 8 %observe) guest guest-dm) rows)
  ;<  held=state-7:t  bind:m  saved
  ;<  ~  bind:m  (ex-equal !>(activity-through.held) !>(~2026.10.1))
  ;<  ~  bind:m  (refuse-all %observe (turn (gulf 1 8) |=(k=@ud `@uv`k)))
  ;<  caz=(list card)  bind:m  (do-arvo /poll [%behn %wake ~])
  ;<  s=state-7:t  bind:m  saved
  ;<  ~  bind:m  (ex-equal !>(activity-through.s) !>(t2))
  ;<  ~  bind:m  (ex-equal !>(~(wyt by jobs.s)) !>(2))
  =/  binds
    %+  murn  (hand-requests caz)
    |=(act=action:hh ?.(?=(%bind -.act) ~ `address.config.act))
  (ex-equal !>(binds) !>(`(list @t)`~['dm/~nec' 'dm/~bus']))
++  test-a-refused-admission-tells-its-sender-once
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  before  (with-job allowed-fixture 0v1 ~nec owner-dm %observe)
  ;<  *  bind:m  (setup before(last-sent now) ~)
  ;<  caz=(list card)  bind:m  (refuse %observe 0v1)
  ;<  s=state-7:t  bind:m  saved
  ;<  ~  bind:m  (ex-equal !>((gth last-sent.s now)) !>(&))
  ;<  ~  bind:m  (ex-equal !>((messenger-pokes caz)) !>(~[(dm-notice ~nec last-sent.s)]))
  ;<  ~  bind:m  (ex-equal !>(error.s) !>(ledger-refusal))
  ;<  ~  bind:m  (ex-equal !>(jobs.s) !>(`(map @uv job:t)`~))
  (ex-equal !>((turn notices.s |=(n=notice:t kind.n))) !>(`(list @t)`~['refusal-notice']))
++  test-a-refused-channel-admission-mentions-its-sender
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  before  (with-job (with-job allowed-fixture 0v1 ~nec room %bind) 0v2 ~nec thread %bind)
  ;<  *  bind:m  (setup before ~)
  ;<  top=(list card)  bind:m  (refuse %bind 0v1)
  ;<  top-state=state-7:t  bind:m  saved
  ;<  ~  bind:m
    %+  ex-equal  !>((messenger-pokes top))
    !>(~[(channel-notice ~nec ~ last-sent.top-state)])
  ;<  reply=(list card)  bind:m  (refuse %bind 0v2)
  ;<  s=state-7:t  bind:m  saved
  ;<  ~  bind:m
    %+  ex-equal  !>((messenger-pokes reply))
    !>(~[(channel-notice ~nec `parent-at last-sent.s)])
  (ex-equal !>(jobs.s) !>(`(map @uv job:t)`~))
++  test-refusal-notices-are-rate-limited-per-sender-and-conversation
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  before
    %+  roll
      ^-  (list [@uv @p destination:t])
      :~  [0v1 ~nec room]  [0v2 ~nec room]  [0v3 guest room]  [0v4 ~nec room]
          [0v5 ~nec owner-dm]  [0v6 guest room]  [0v7 guest room]
      ==
    |=  [[id=@uv actor=@p to=destination:t] s=_allowed-fixture]
    (with-job s id actor to %observe)
  ;<  *  bind:m  (setup before ~)
  =/  at
    |=  delay=@dr
    (jab-bowl |=(b=bowl b(now (add now delay))))
  =/  posted
    |=  [id=@uv kind=@t count=@ud]
    =/  n  (mare ,~)
    ^-  form:n
    ;<  caz=(list card)  bind:n  (refuse %observe id)
    ;<  s=state-7:t  bind:n  saved
    =/  newest  (scag 1 (turn notices.s |=(n=notice:t kind.n)))
    ;<  ~  bind:n  (ex-equal !>([id newest]) !>([id ~[kind]]))
    (ex-equal !>([id (lent (messenger-pokes caz))]) !>([id count]))
  ;<  ~  bind:m  (posted 0v1 'refusal-notice' 1)
  ::  The same sender elsewhere is told.
  ;<  ~  bind:m  (posted 0v5 'refusal-notice' 1)
  ;<  ~  bind:m  (at ~m3)
  ;<  ~  bind:m  (posted 0v2 'refusal' 0)
  ::  Another speaker in the same conversation is told.
  ;<  ~  bind:m  (posted 0v3 'refusal-notice' 1)
  ::  Five minutes after the first notice, while the withheld one is newer.
  ;<  ~  bind:m  (at (add ~m5 ~s1))
  ;<  ~  bind:m  (posted 0v4 'refusal-notice' 1)
  ;<  ~  bind:m  (at ~m9)
  ;<  ~  bind:m  (set-scry-gate (gate ~ |))
  ;<  ~  bind:m  (posted 0v6 'refusal' 0)
  ;<  ~  bind:m  (set-scry-gate (gate ~ &))
  (posted 0v7 'refusal-notice' 1)
++  test-reload-after-a-refusal-sends-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (setup (with-job allowed-fixture 0v1 ~nec owner-dm %observe) ~)
  ;<  *  bind:m  (refuse %observe 0v1)
  ;<  refused=state-7:t  bind:m  saved
  ;<  caz=(list card)  bind:m  (setup refused ~)
  ;<  ~  bind:m  (ex-equal !>((hand-requests caz)) !>(`(list action:hh)`~))
  (ex-equal !>((messenger-pokes caz)) !>(`(list [mark noun])`~))
++  test-a-refusal-without-its-job-posts-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ::  Disabling the adapter already dropped job 0v1.
  ;<  *  bind:m  (setup (with-lane allowed-fixture ~nec owner-dm) ~)
  ;<  caz=(list card)  bind:m  (refuse %observe 0v1)
  ;<  s=state-7:t  bind:m  saved
  ;<  ~  bind:m  (ex-equal !>((messenger-pokes caz)) !>(`(list [mark noun])`~))
  ;<  ~  bind:m  (ex-equal !>(error.s) !>(ledger-refusal))
  (ex-equal !>(notices.s) !>(`(list notice:t)`~))
++  test-eight-unrefused-admissions-still-hold-the-cursor
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  t1  ~2026.10.1..00.00.05
  =/  rows  ~[[t1 [%dm-post [[~nec t1] t1] [%ship ~nec] ~[[%inline ~['owner again']]] |]]]
  ;<  *  bind:m  (setup (stuck 8 %observe) rows)
  ;<  s=state-7:t  bind:m  saved
  ;<  ~  bind:m  (ex-equal !>(activity-through.s) !>(~2026.10.1))
  ;<  ~  bind:m  (ex-equal !>(catching-up.s) !>(&))
  (ex-equal !>(~(wyt by jobs.s)) !>(8))
::  A ledger past 256 bindings, enabled and disabled, beside the guest DM's
::  binding. The head's replies come from this ledger, not a stand-in.
::
++  crowded
  ^-  state:hh
  =/  db  *state:hh
  =.  bindings.db
    %-  malt
    %+  turn  (gulf 1 300)
    |=  k=@ud
    ^-  [@t binding:hh]
    =/  id  (cat 3 'seeded-' (scot %ud k))
    [id ['tlon' (cat 3 'dm/' id) id ~['*'] =(0 (mod k 2))]]
  =/  sid  (identity:continuity guest-dm)
  db(bindings (~(put by bindings.db) 'binding' ['tlon' 'dm/~bus' sid ~['~bus'] &]))
++  gate-over
  |=  [=stream:v10:a ledger=state:hh]
  |=  =path
  ^-  (unit vase)
  ?:  ?=([%gx @ %harness @ %hand-state %noun ~] path)  `!>(ledger)
  ?:  ?=([%gx @ %harness @ %hand-index %noun ~] path)  `!>((reindex:hd ledger))
  ((gate stream &) path)
++  setup-over
  |=  [saved=state-7:t ledger=state:hh]
  =/  m  (mare ,(list card))
  ^-  form:m
  ;<  ~  bind:m  watched
  ;<  ~  bind:m  (set-scry-gate (gate-over ~ ledger))
  ;<  loaded=(list card)  bind:m  (do-load adapter `!>(saved))
  ;<  head=(list card)  bind:m  (do-agent /head [~zod %harness] [%watch-ack ~])
  (pure:m (weld loaded head))
::  The head applies each request to .ledger.
++  apply-all
  |=  [ledger=state:hh acts=(list action:hh)]
  ^-  state:hh
  %+  roll  acts
  |=  [act=action:hh db=_ledger]
  =/  res  (apply:hd db act now)
  ?>(?=(%& -.res) db.p.res)
::  .who's DM at .at arrives through Activity. The adapter opens its route,
::  the head accepts it, and .ledger answers the bind; the cards are the
::  adapter's answer to that result.
++  converse
  |=  [ledger=state:hh who=@p at=@da]
  =/  m  (mare ,[cards=(list card) ledger=state:hh])
  ^-  form:m
  =/  event=incoming-event:v8:a
    [%dm-post [[who at] at] [%ship who] ~[[%inline ~['hello again']]] |]
  =/  =stream:v10:a
    (put:on-stream:v10:a ~ at [;;(incoming-event:v10:a event) | |])
  =/  sid  (identity:continuity [%dm who ~])
  ;<  ~  bind:m  (set-scry-gate (gate-over stream ledger))
  ::  The head watch is renewed, as on a reload, and its ack catches up.
  ;<  ~  bind:m
    (jab-bowl |=(b=bowl b(wex (~(put by wex.b) [/head ~zod %harness] [| /hand-events]))))
  ;<  *  bind:m  (do-agent /head [~zod %harness] [%watch-ack ~])
  ;<  admitted=state-7:t  bind:m  saved
  =/  lane  (~(got by lanes.admitted) sid)
  ;<  opened=(list card)  bind:m
    (do-agent /route/[sid]/(scot %ud epoch.lane)/create [~zod %harness] [%poke-ack ~])
  =/  binds  (skim (hand-requests opened) |=(act=action:hh ?=(%bind -.act)))
  ?>  ?=([* ~] binds)
  =/  waiting  (skim ~(tap by jobs.admitted) |=([* =job:t] =(sid sid.job)))
  ?>  ?=([* ~] waiting)
  =/  =wire  /hand/bind/(scot %uv p.i.waiting)
  =/  res  (apply:hd ledger i.binds now)
  ;<  ~  bind:m
    (jab-bowl |=(b=bowl b(wex (~(put by wex.b) [wire ~zod %harness] [& /hands/x]))))
  ;<  caz=(list card)  bind:m
    %^  do-agent  wire  [~zod %harness]
    [%fact %noun !>(`(each json @t)`?:(?=(%& -.res) [%& result.p.res] [%| p.res]))]
  (pure:m caz ?:(?=(%& -.res) db.p.res ledger))
::  The bind led to one observation, on a binding other than .old, that the
::  ledger admits, and to no refusal.
++  admitted-anew
  |=  [out=[cards=(list card) ledger=state:hh] old=@t]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  s=state-7:t  bind:m  saved
  ;<  ~  bind:m  (ex-equal !>((messenger-pokes cards.out)) !>(`(list [mark noun])`~))
  ;<  ~  bind:m  (ex-equal !>(error.s) !>(''))
  ;<  ~  bind:m
    (ex-equal !>((scag 1 (turn notices.s |=(n=notice:t kind.n)))) !>(`(list @t)`~['message']))
  =/  acts  (hand-requests cards.out)
  ?>  ?=([* ~] acts)
  ?>  ?=(%observe -.i.acts)
  ;<  ~  bind:m  (ex-equal !>(=(old binding.i.acts)) !>(|))
  (ex-equal !>(-:(apply:hd ledger.out i.acts now)) !>(%&))
::  A permission change withdraws ~bus's DM route and the head disables its
::  binding. ~bus's next message binds a new one, and the owner's first DM
::  binds its own, both on a ledger past 256 bindings.
::
++  test-conversations-bind-and-are-admitted-past-256-bindings
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  start  (with-lane allowed-fixture guest guest-dm)
  =/  sid  (identity:continuity guest-dm)
  ;<  *  bind:m  (setup-over start crowded)
  =/  next  policy.start
  =.  allowed.next  ~
  =.  trusted.next  (my ~[[guest ~[%web %workspace]]])
  ;<  changed=(list card)  bind:m
    %+  do-poke  %noun
    !>(`request:ad`['fixture' [%n '1'] 'harness/tlon/configure' `(policy-json:policy next)])
  ;<  withdrawn=state-7:t  bind:m  saved
  ;<  ~  bind:m  (ex-equal !>((~(has by routes.withdrawn) sid)) !>(|))
  =/  disable  (hand-requests changed)
  ;<  ~  bind:m  (ex-equal !>(disable) !>(`(list action:hh)`~[[%enable 'binding' |]]))
  =/  ledger  (apply-all crowded disable)
  ;<  ~  bind:m  (wait ~s10)
  ;<  again=[cards=(list card) ledger=state:hh]  bind:m
    (converse ledger guest (add now ~s5))
  ;<  ~  bind:m  (admitted-anew again 'binding')
  ;<  ~  bind:m  (wait ~s10)
  ;<  first=[cards=(list card) ledger=state:hh]  bind:m
    (converse ledger.again ~nec (add now ~s15))
  (admitted-anew first 'binding')
::  Runs of bot messages. ~nec writes every message; its author form says
::  whether a bot wrote it. Both conversations start ready, so each admitted
::  message is bound at once.
::
++  bot-room
  ^-  state-7:t
  (with-lane (with-lane fixture ~nec room) ~nec thread)
++  second
  |=  n=@ud
  ^-  @da
  (add ~2026.10.1 (mul n ~s1))
++  top-row
  |=  n=@ud
  ^-  [@da incoming-event:v8:a]
  =/  at  (second n)
  [at [%post [[~nec at] at] nest [~nec %home] ~[[%inline ~['hello']]] &]]
++  thread-row
  |=  n=@ud
  ^-  [@da incoming-event:v8:a]
  =/  at  (second n)
  :-  at
  :*  %reply  [[~nec at] at]  [[~nec parent-at] parent-at]
      nest  [~nec %home]  ~[[%inline ~['hello']]]  &
  ==
++  bot-posts
  |=  ns=(list @ud)
  ^-  (list post-row)
  (turn ns |=(n=@ud (post (second n) bot)))
::  Catch up on .rows, while local %channels holds .posts and the replies
::  under .parent-at.
++  catch-up
  |=  $:  saved=state-7:t
          rows=(list [@da incoming-event:v8:a])
          posts=(list post-row)
          replies=(list reply-row)
      ==
  =/  m  (mare ,outcome)
  ^-  form:m
  =/  =stream:v10:a
    %+  gas:on-stream:v10:a  ~
    %+  turn  rows
    |=  [at=@da e=incoming-event:v8:a]
    [at [;;(incoming-event:v10:a e) | |]]
  =/  post-pages  (weld base /posts/older)
  =/  reply-pages  (weld base /posts/post/id/(scot %ud parent-at)/replies/older)
  ;<  ~  bind:m  watched
  ;<  ~  bind:m
    %-  set-scry-gate
    |=  =path
    ^-  (unit vase)
    ?:  =(path [%gu (scot %p ~zod) %channels (scot %da now) %$ ~])  `!>(&)
    ?:  =(path [%gu base])  `!>(&)
    ?.  ?=([%gx *] path)  ((gate stream &) path)
    ?:  =(post-pages (scag (lent post-pages) t.path))
      `!>(`paged-posts:v9:dv`[(gas:on-posts:v9:dv ~ posts) ~ ~ 0 0])
    ?:  =(reply-pages (scag (lent reply-pages) t.path))
      `!>(`replies:v9:dv`(gas:on-replies:v9:dv ~ replies))
    ((gate stream &) path)
  ;<  caz=(list card)  bind:m  (do-load adapter `!>(saved))
  ;<  =vase  bind:m  get-save
  (pure:m caz !<(state-7:t vase))
++  hand-kinds
  |=  out=outcome
  ^-  (list @tas)
  (turn (hand-requests cards.out) |=(act=action:hh -.act))
::
++  test-the-fourth-bot-message-in-a-row-in-a-channel-makes-no-job-or-hand-request
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  out=outcome  bind:m
    (catch-up bot-room (turn (gulf 3 6) top-row) (bot-posts (gulf 3 6)) ~)
  ;<  ~  bind:m
    %+  ex-equal  !>((kinds out))
    !>(`(list @t)`~['bot-limit' 'bot-message' 'bot-message' 'bot-message'])
  ;<  ~  bind:m  (ex-equal !>(~(wyt by jobs.saved.out)) !>(3))
  ;<  ~  bind:m  (ex-equal !>((hand-kinds out)) !>(`(list @tas)`~[%bind %bind %bind]))
  ;<  ~  bind:m  (ex-equal !>(lanes.saved.out) !>(lanes:bot-room))
  ;<  ~  bind:m  (ex-equal !>(routes.saved.out) !>(routes:bot-room))
  ;<  ~  bind:m  (ex-equal !>(identities.saved.out) !>(identities:bot-room))
  (ex-equal !>(activity-through.saved.out) !>((second 6)))
++  test-a-person-message-ends-a-bot-run
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  out=outcome  bind:m
    %:  catch-up
      bot-room
      (turn (gulf 3 8) top-row)
      (weld (bot-posts (gulf 3 6)) [(post (second 7) ~nec) (bot-posts ~[8])])
      ~
    ==
  ;<  ~  bind:m
    %+  ex-equal  !>((kinds out))
    !>  ^-  (list @t)
    ~['bot-message' 'message' 'bot-limit' 'bot-message' 'bot-message' 'bot-message']
  ;<  ~  bind:m  (ex-equal !>(~(wyt by jobs.saved.out)) !>(5))
  (ex-equal !>(activity-through.saved.out) !>((second 8)))
++  test-a-thread-bot-run-does-not-count-toward-the-channel-top-level
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  out=outcome  bind:m
    %:  catch-up
      bot-room
      (weld (turn (gulf 3 5) thread-row) ~[(top-row 6) (thread-row 7)])
      [(post parent-at ~nec) (bot-posts ~[6])]
      (turn `(list @ud)`~[3 4 5 7] |=(n=@ud (reply (second n) bot)))
    ==
  ;<  ~  bind:m
    %+  ex-equal  !>((kinds out))
    !>  ^-  (list @t)
    ~['bot-limit' 'bot-message' 'bot-message' 'bot-message' 'bot-message']
  ;<  ~  bind:m
    %+  ex-equal  !>((turn notices.saved.out |=(n=notice:t address.n)))
    !>  ^-  (list @t)
    =/  top  (address:policy room)
    =/  under  (address:policy thread)
    ~[under top under under under]
  (ex-equal !>(~(wyt by jobs.saved.out)) !>(4))
++  test-a-bot-message-whose-author-is-unreadable-is-admitted-after-a-bot-run
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ::  Local %channels lacks the fourth post.
  ;<  out=outcome  bind:m
    (catch-up bot-room (turn (gulf 3 6) top-row) (bot-posts (gulf 3 5)) ~)
  ;<  ~  bind:m
    %+  ex-equal  !>((kinds out))
    !>(`(list @t)`~['message' 'bot-message' 'bot-message' 'bot-message'])
  (ex-equal !>(~(wyt by jobs.saved.out)) !>(4))
++  test-a-bot-run-adds-one-bot-limit-notice
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  out=outcome  bind:m
    (catch-up bot-room (turn (gulf 3 7) top-row) (bot-posts (gulf 3 7)) ~)
  ;<  ~  bind:m
    %+  ex-equal  !>((kinds out))
    !>(`(list @t)`~['bot-limit' 'bot-message' 'bot-message' 'bot-message'])
  ;<  ~  bind:m  (ex-equal !>(~(wyt by jobs.saved.out)) !>(3))
  (ex-equal !>(activity-through.saved.out) !>((second 7)))
::  Route setup. The head runs and refuses a step of a conversation's
::  setup, or is stopped while it waits.
::
++  guest-sid  (identity:continuity guest-dm)
++  room-sid  (identity:continuity room)
++  dm-row
  |=  [who=@p at=@da]
  ^-  [@da incoming-event:v8:a]
  [at [%dm-post [[who at] at] [%ship who] ~[[%inline ~['hello']]] |]]
::  .gate, with the head running when .up and holding sessions .sids.
++  head-gate
  |=  [=stream:v10:a up=? sids=(list @t)]
  =/  rest  (gate stream &)
  |=  =path
  ^-  (unit vase)
  ?:  ?=([%gu @ %harness @ %$ ~] path)  `!>(up)
  ?:  ?=([%gx @ %harness @ %sessions %json ~] path)
    `!>(`json`[%a (turn sids |=(sid=@t `json`[%s sid]))])
  ?:  ?=([%gx @ %harness @ %head @ %noun ~] path)
    `!>(`[revision=@ud view=view:h next=(unit step:h)]`[0 *view:h ~])
  (rest path)
::  A conversation at .to setting up its route at .phase, with .waiting jobs.
++  setting-up
  |=  [to=destination:t phase=?(%fence %create) waiting=(list [id=@uv actor=@p])]
  ^-  state-7:t
  =/  sid  (identity:continuity to)
  =/  s  allowed-fixture
  =.  s
    %=  s
      lanes  (~(put by lanes.s) sid [to 0 ~])
      routes  (~(put by routes.s) sid ['binding' phase])
      identities  (~(put by identities.s) to sid)
    ==
  %+  roll  waiting
  |=  [[id=@uv actor=@p] s=_s]
  s(jobs (~(put by jobs.s) id [[actor (scot %uv id) to 'hello'] sid %create '']))
::  The head acknowledges conversation .sid's setup step .phase, or refuses it.
++  route-ack
  |=  [sid=@t phase=?(%fence %create %config) refused=?]
  =/  m  (mare ,(list card))
  ^-  form:m
  %^  do-agent  /route/[sid]/(scot %ud 0)/[phase]  [~zod %harness]
  [%poke-ack ?.(refused ~ `~[leaf+"refused"])]
::  Head actions among the emitted cards, as their wire and kind.
++  head-requests
  |=  caz=(list card)
  ^-  (list [path @tas])
  %+  murn  caz
  |=  =card
  ^-  (unit [path @tas])
  ?.  ?=([%pass * %agent * %poke %harness-action *] card)  ~
  =/  [pass=* wire=* agent=* who=* poke=* mark=* data=vase]  card
  `[;;(path wire) -:!<(action:h data)]
++  retry
  |=  id=@uv
  =/  m  (mare ,(list card))
  ^-  form:m
  =/  params  (pairs:enjs:format ~[['id' s+(scot %uv id)]])
  %+  do-poke  %noun
  !>(`request:ad`['fixture' [%n '1'] 'harness/tlon/admission/retry' `params])
++  settled
  %:  acp-error-card:~(. codec ~zod)
    'fixture'  [%n '1']  '-32602'
    'Admission has already settled or been revoked; refresh its state'
  ==
::  Conversation .sid has no job, lane or route, and the newest entry is .kind.
++  ended
  |=  [s=state-7:t sid=@t kind=@t]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m
    (ex-equal !>((lien ~(val by jobs.s) |=(j=job:t =(sid sid.j)))) !>(|))
  ;<  ~  bind:m
    (ex-equal !>((scag 1 (turn notices.s |=(n=notice:t kind.n)))) !>(`(list @t)`~[kind]))
  ;<  ~  bind:m  (ex-equal !>((~(has by lanes.s) sid)) !>(|))
  (ex-equal !>((~(has by routes.s) sid)) !>(|))
::  Job .id still waits for conversation .sid's setup, at .stage.
++  waiting
  |=  [s=state-7:t sid=@t id=@uv stage=@tas]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (ex-equal !>(`(unit @tas)`(bind (~(get by jobs.s) id) |=(j=job:t stage.j))) !>(`stage))
  ;<  ~  bind:m  (ex-equal !>((~(has by lanes.s) sid)) !>(&))
  (ex-equal !>((~(has by routes.s) sid)) !>(&))
::
++  test-a-conversation-whose-route-setup-failed-does-not-stop-other-conversations
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  [t1=@da t2=@da t3=@da]  [(second 5) (second 6) (second 7)]
  ;<  *  bind:m  (setup allowed-fixture ~[(dm-row guest t1) (dm-row guest t2) (dm-row ~nec t3)])
  ;<  *  bind:m  (route-ack guest-sid %create &)
  ;<  failed=state-7:t  bind:m  saved
  ;<  ~  bind:m  (ended failed guest-sid 'refusal-notice')
  ;<  ~  bind:m  (ex-equal !>(activity-through.failed) !>(t1))
  ;<  *  bind:m  (do-arvo /poll [%behn %wake ~])
  ;<  s=state-7:t  bind:m  saved
  ;<  ~  bind:m  (ex-equal !>(activity-through.s) !>(t3))
  (ex-equal !>((~(has by lanes.s) (identity:continuity owner-dm))) !>(&))
++  test-a-failed-route-setup-tells-its-sender-once
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (setup allowed-fixture ~[(dm-row guest (second 5)) (dm-row guest (second 6))])
  ;<  first=(list card)  bind:m  (route-ack guest-sid %create &)
  ;<  told=state-7:t  bind:m  saved
  ;<  ~  bind:m  (ex-equal !>((messenger-pokes first)) !>(~[(dm-notice guest last-sent.told)]))
  ;<  *  bind:m  (do-arvo /poll [%behn %wake ~])
  ;<  again=(list card)  bind:m  (route-ack guest-sid %create &)
  ;<  s=state-7:t  bind:m  saved
  ;<  ~  bind:m  (ex-equal !>((messenger-pokes again)) !>(`(list [mark noun])`~))
  (ended s guest-sid 'refusal')
++  test-a-failed-route-setup-tells-each-sender-waiting-in-a-channel
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m
    %+  load-with
      (setting-up room %create ~[[0v1 ~nec] [0v2 guest] [0v3 ~nec]])
    (head-gate ~ & ~)
  ;<  caz=(list card)  bind:m  (route-ack room-sid %create &)
  ;<  s=state-7:t  bind:m  saved
  ::  One entry per message, one notice per sender.
  ;<  ~  bind:m  (ex-equal !>((lent (messenger-pokes caz))) !>(2))
  =/  order  |=([a=[@t @p] b=[@t @p]] (aor a b))
  ;<  ~  bind:m
    %+  ex-equal
      !>((sort (turn notices.s |=(n=notice:t `[@t @p]`[kind.n actor.n])) order))
    !>((sort `(list [@t @p])`~[['refusal-notice' ~nec] ['refusal' ~nec] ['refusal-notice' guest]] order))
  ;<  ~  bind:m  (ex-equal !>(jobs.s) !>(`(map @uv job:t)`~))
  ;<  ~  bind:m  (ex-equal !>((~(has by lanes.s) room-sid)) !>(|))
  (ex-equal !>((~(has by routes.s) room-sid)) !>(|))
++  test-the-next-message-after-a-failed-route-setup-is-bound-and-observed
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  rows  ~[(dm-row guest (second 5)) (dm-row guest (second 6)) (dm-row guest (second 7))]
  ;<  *  bind:m  (setup allowed-fixture rows)
  ;<  *  bind:m  (route-ack guest-sid %create &)
  ;<  woke=(list card)  bind:m  (do-arvo /poll [%behn %wake ~])
  ;<  ~  bind:m
    %+  ex-equal  !>((head-requests woke))
    !>(`(list [path @tas])`~[[/route/[guest-sid]/(scot %ud 0)/create %new]])
  ;<  ready=(list card)  bind:m  (route-ack guest-sid %create |)
  ;<  ~  bind:m
    (ex-equal !>((turn (hand-requests ready) |=(act=action:hh `@tas`-.act))) !>(`(list @tas)`~[%bind]))
  ;<  bound=state-7:t  bind:m  saved
  =/  id  (snag 0 ~(tap in ~(key by jobs.bound)))
  ;<  observed=(list card)  bind:m  (hand-result %bind id [%& ~])
  ;<  ~  bind:m
    (ex-equal !>((turn (hand-requests observed) |=(act=action:hh `@tas`-.act))) !>(`(list @tas)`~[%observe]))
  ;<  *  bind:m  (do-arvo /poll [%behn %wake ~])
  ;<  s=state-7:t  bind:m  saved
  (ex-equal !>(activity-through.s) !>((second 7)))
++  test-a-refused-fence-ends-the-setup-and-its-retry-has-settled
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m
    (load-with (setting-up guest-dm %fence ~[[0v1 guest]]) (head-gate ~ & ~[guest-sid]))
  ;<  *  bind:m  (route-ack guest-sid %fence &)
  ;<  s=state-7:t  bind:m  saved
  ;<  ~  bind:m  (ended s guest-sid 'refusal-notice')
  ;<  caz=(list card)  bind:m  (retry 0v1)
  (ex-equal !>((lien caz |=(c=card =(c settled)))) !>(&))
++  test-a-refused-config-ends-the-setup
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m
    (load-with (setting-up guest-dm %fence ~[[0v1 guest]]) (head-gate ~ & ~[guest-sid]))
  ;<  fenced=(list card)  bind:m  (route-ack guest-sid %fence |)
  ;<  ~  bind:m
    %+  ex-equal  !>((head-requests fenced))
    !>(`(list [path @tas])`~[[/route/[guest-sid]/(scot %ud 0)/config %config]])
  ;<  *  bind:m  (route-ack guest-sid %config &)
  ;<  s=state-7:t  bind:m  saved
  (ended s guest-sid 'refusal-notice')
++  test-a-refused-create-with-an-existing-session-restarts-the-setup
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (load-with (setting-up guest-dm %create ~[[0v1 guest]]) (head-gate ~ & ~))
  ;<  ~  bind:m  (set-scry-gate (head-gate ~ & ~[guest-sid]))
  ;<  caz=(list card)  bind:m  (route-ack guest-sid %create &)
  ;<  s=state-7:t  bind:m  saved
  ;<  ~  bind:m
    %+  ex-equal  !>((head-requests caz))
    !>(`(list [path @tas])`~[[/route/[guest-sid]/(scot %ud 0)/fence %fence]])
  (waiting s guest-sid 0v1 %create)
++  test-a-setup-on-a-stopped-head-waits-and-is-bound-after-reconnect
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (load-with (setting-up guest-dm %fence ~[[0v1 guest]]) (head-gate ~ | ~))
  ;<  *  bind:m  (retry 0v1)
  ;<  stopped=state-7:t  bind:m  saved
  ;<  ~  bind:m  (waiting stopped guest-sid 0v1 %error)
  ;<  ~  bind:m  (set-scry-gate (head-gate ~ & ~))
  ;<  *  bind:m  (do-agent /head [~zod %harness] [%kick ~])
  ;<  *  bind:m  (do-agent /head [~zod %harness] [%watch-ack ~])
  ;<  caz=(list card)  bind:m  (route-ack guest-sid %create |)
  =/  binds
    %+  murn  (hand-requests caz)
    |=(act=action:hh ?.(?=(%bind -.act) ~ `address.config.act))
  (ex-equal !>(binds) !>(`(list @t)`~['dm/~bus']))
++  test-a-session-gone-after-its-fence-ends-the-setup
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m
    (load-with (setting-up guest-dm %fence ~[[0v1 guest]]) (head-gate ~ & ~[guest-sid]))
  ;<  ~  bind:m  (set-scry-gate (head-gate ~ & ~))
  ;<  *  bind:m  (route-ack guest-sid %fence |)
  ;<  s=state-7:t  bind:m  saved
  (ended s guest-sid 'refusal-notice')
++  test-a-head-stopped-after-a-fence-leaves-the-setup-waiting
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m
    (load-with (setting-up guest-dm %fence ~[[0v1 guest]]) (head-gate ~ & ~[guest-sid]))
  ;<  ~  bind:m  (set-scry-gate (head-gate ~ | ~[guest-sid]))
  ;<  *  bind:m  (route-ack guest-sid %fence |)
  ;<  s=state-7:t  bind:m  saved
  (waiting s guest-sid 0v1 %error)
--
