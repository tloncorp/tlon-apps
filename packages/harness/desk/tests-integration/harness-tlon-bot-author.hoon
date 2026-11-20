::  Full adapter, synthetic scries only; no emitted cards are executed.
::  Admission records whether a channel message's own author has a bot profile.
::  -test /=harness=/tests-integration/harness-tlon-bot-author
/-  t=harness-tlon, hh=harness-hand, a=activity-ver, dv=channels-ver
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
--
