::  Full adapter, synthetic scries only; no emitted cards are executed.
::  Admission records whether a channel message's own author has a bot profile,
::  and a ledger refusal ends its admission without stopping catch-up.
::  -test /=harness=/tests-integration/harness-tlon-bot-author
/-  t=harness-tlon, hh=harness-hand, a=activity-ver, dv=channels-ver, cv=chat-ver,
    g=groups-ver
/+  *test-agent, policy=harness-tlon-policy, continuity=harness-tlon-continuity
/=  adapter  /app/harness-tlon
|%
+$  outcome  [cards=(list card) saved=state-2:t]
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
  ^-  state-2:t
  =/  s=state-2:t  *state-2:t
  %=  s  owner-initialized  1  policy  [& `~nec ~ %mentions ~ ~]  watching  &
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
++  run
  |=  [saved=state-2:t event=incoming-event:v8:a native=(unit native)]
  =/  m  (mare ,outcome)
  ^-  form:m
  =/  =stream:v10:a
    (put:on-stream:v10:a ~ message-at [;;(incoming-event:v10:a event) | |])
  ;<  ~  bind:m  (set-bowl %*(. *bowl our ~zod, src ~zod, now now))
  ;<  ~  bind:m
    %-  jab-bowl
    |=  b=bowl
    =.  wex.b  (~(put by wex.b) [/head ~zod %harness] [& /hand-events])
    b(wex (~(put by wex.b) [/activity ~zod %activity] [& /v4]))
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
    ?:  ?=([%gx @ %activity @ %v6 %all %noun ~] path)  `!>(stream)
    ?:  ?=([%gx @ %harness @ %hand-state %noun ~] path)  `!>(*state:hh)
    ?:  ?=([%gx @ %harness @ %cron-session @ %noun ~] path)  `!>(~)
    ?:  ?=([%gx @ %harness @ %sessions %json ~] path)  `!>(`json`[%a ~])
    ?:  ?=([%gx @ %harness @ %defaults %json ~] path)  `!>(defaults)
    ~
  ::  Loading an acknowledged Activity watch catches up on the stream.
  ;<  caz=(list card)  bind:m  (do-load adapter `!>(saved))
  ;<  =vase  bind:m  get-save
  (pure:m caz !<(state-2:t vase))
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
  =/  same  |=(s=state-2:t s(notices ~))
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
  =/  sid  (identity:continuity actor.input to.input)
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
++  test-no-read-for-a-denied-post
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  got=outcome  bind:m  (run fixture (post-event ~bud) unread)
  ;<  ~  bind:m  (ex-equal !>((kinds got)) !>(`(list @t)`~['permission-denied']))
  (ex-equal !>(~(wyt by jobs.saved.got)) !>(0))
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
++  ledger-refusal  'Binding ledger capacity reached; export and rotate its binding'
++  allowed-fixture
  ^-  state-2:t
  =/  s  fixture
  s(allowed.policy (silt ~[guest]))
::  A ready conversation for .actor at .to.
++  with-lane
  |=  [s=state-2:t actor=@p to=destination:t]
  ^-  state-2:t
  =/  sid  (identity:continuity actor to)
  %=  s
    lanes  (~(put by lanes.s) sid [actor to 0 ~])
    routes  (~(put by routes.s) sid ['binding' %ready])
    identities  (~(put by identities.s) [actor to] sid)
  ==
::  .with-lane, holding job .id at .stage.
++  with-job
  |=  [s=state-2:t id=@uv actor=@p to=destination:t stage=?(%bind %observe)]
  ^-  state-2:t
  =.  s  (with-lane s actor to)
  =/  sid  (identity:continuity actor to)
  s(jobs (~(put by jobs.s) id [[actor (scot %uv id) to 'earlier'] sid stage '']))
::  The owner's DM is ready and holds jobs 1 to .n at .stage.
++  stuck
  |=  [n=@ud stage=?(%bind %observe)]
  ^-  state-2:t
  %+  roll  (gulf 1 n)
  |=  [k=@ud s=_allowed-fixture]
  (with-job s `@uv`k ~nec owner-dm stage)
++  group
  ^-  group:v9:g
  =/  joined  *group:v9:g
  =.  seats.joined  (my ~[[guest `seat:v9:g`[~ ~2026.9.9]]])
  joined(channels (my ~[[nest *channel:v9:g]]))
++  gate
  |=  [=stream:v10:a member=?]
  |=  =path
  ^-  (unit vase)
  ?:  ?=([@ @ %channels *] path)  ~
  ?:  ?=([%gu @ %contacts @ %$ ~] path)  `!>(|)
  ?:  (lien path |=(part=@ta =(%can-read part)))  `!>(|=([@p *] member))
  ?:  ?=([%gx @ %groups @ %v2 %groups %noun ~] path)  `!>((my ~[[[~nec %home] group]]))
  ?:  =(%$ (rear path))  `!>(&)
  ?:  ?=([%gx @ %chat @ %dm %invited %ships ~] path)  `!>(~)
  ?:  ?=([%gx @ %activity @ %v6 %all %noun ~] path)  `!>(stream)
  ?:  ?=([%gx @ %harness @ %hand-state %noun ~] path)  `!>(*state:hh)
  ?:  ?=([%gx @ %harness @ %cron-session @ %noun ~] path)  `!>(~)
  ?:  ?=([%gx @ %harness @ %sessions %json ~] path)  `!>(`json`[%a ~])
  ?:  ?=([%gx @ %harness @ %defaults %json ~] path)  `!>(defaults)
  ~
::  Load .saved over .rows. Gall keeps the acknowledged Activity watch;
::  loading renews the head watch, which the head then acknowledges.
++  setup
  |=  [saved=state-2:t rows=(list [@da incoming-event:v8:a])]
  =/  m  (mare ,(list card))
  ^-  form:m
  =/  =stream:v10:a
    %+  gas:on-stream:v10:a  ~
    %+  turn  rows
    |=  [at=@da e=incoming-event:v8:a]
    [at [;;(incoming-event:v10:a e) | |]]
  ;<  ~  bind:m  (set-bowl %*(. *bowl our ~zod, src ~zod, now now))
  ;<  ~  bind:m
    %-  jab-bowl
    |=  b=bowl
    =.  wex.b  (~(put by wex.b) [/head ~zod %harness] [& /hand-events])
    b(wex (~(put by wex.b) [/activity ~zod %activity] [& /v4]))
  ;<  ~  bind:m  (set-scry-gate (gate stream &))
  ;<  loaded=(list card)  bind:m  (do-load adapter `!>(saved))
  ;<  head=(list card)  bind:m  (do-agent /head [~zod %harness] [%watch-ack ~])
  (pure:m (weld loaded head))
::  The head's hand ledger refuses job .id at .phase.
++  refuse
  |=  [phase=?(%bind %observe) id=@uv]
  =/  m  (mare ,(list card))
  ^-  form:m
  =/  =wire  /hand/[phase]/(scot %uv id)
  ;<  ~  bind:m
    (jab-bowl |=(b=bowl b(wex (~(put by wex.b) [wire ~zod %harness] [& /hands/x]))))
  (do-agent wire [~zod %harness] [%fact %noun !>(`(each json @t)`[%| ledger-refusal])])
++  refuse-all
  |=  [phase=?(%bind %observe) ids=(list @uv)]
  =/  m  (mare ,~)
  ^-  form:m
  ?~  ids  (pure:m ~)
  ;<  *  bind:m  (refuse phase i.ids)
  (refuse-all phase t.ids)
++  saved
  =/  m  (mare ,state-2:t)
  ^-  form:m
  ;<  =vase  bind:m  get-save
  (pure:m !<(state-2:t vase))
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
  ;<  held=state-2:t  bind:m  saved
  ;<  ~  bind:m  (ex-equal !>(activity-through.held) !>(~2026.10.1))
  ;<  ~  bind:m  (refuse-all %observe (turn (gulf 1 8) |=(k=@ud `@uv`k)))
  ;<  caz=(list card)  bind:m  (do-arvo /poll [%behn %wake ~])
  ;<  s=state-2:t  bind:m  saved
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
  ;<  s=state-2:t  bind:m  saved
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
  ;<  top-state=state-2:t  bind:m  saved
  ;<  ~  bind:m
    %+  ex-equal  !>((messenger-pokes top))
    !>(~[(channel-notice ~nec ~ last-sent.top-state)])
  ;<  reply=(list card)  bind:m  (refuse %bind 0v2)
  ;<  s=state-2:t  bind:m  saved
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
    ;<  s=state-2:t  bind:n  saved
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
  ;<  refused=state-2:t  bind:m  saved
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
  ;<  s=state-2:t  bind:m  saved
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
  ;<  s=state-2:t  bind:m  saved
  ;<  ~  bind:m  (ex-equal !>(activity-through.s) !>(~2026.10.1))
  ;<  ~  bind:m  (ex-equal !>(catching-up.s) !>(&))
  (ex-equal !>(~(wyt by jobs.s)) !>(8))
--
