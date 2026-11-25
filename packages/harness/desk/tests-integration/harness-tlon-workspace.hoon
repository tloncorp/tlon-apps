::  Full adapter, synthetic scries only; no emitted cards are executed.
::  A workspace card is approved by the owner's tap, never by their words,
::  and the DM it is read from holds the card and the tap.
::  -test /=harness=/tests-integration/harness-tlon-workspace
/-  t=harness-tlon, hh=harness-hand, a=activity-ver, cv=chat-ver
/+  *test-agent, wp=harness-tlon-workspace-plan, ht=harness-tools
/=  adapter  /app/harness-tlon
|%
+$  outcome  [cards=(list card) saved=state-5:t]
++  now  ~2026.10.1..00.00.10
++  card-at  ~2026.10.1..00.00.02
++  message-at  ~2026.10.1..00.00.05
++  key  'workspace-plan-0123456789ab'
++  sample
  ^-  plan:wp
  ['Lisbon Trip' 'Planning the May trip' ~[[%chat 'Planning' 'Day by day']] ~]
++  fixture
  ^-  state-5:t
  =/  s=state-5:t  *state-5:t
  %=  s  owner-initialized  1  policy  [& `~nec ~ %mentions ~ ~]  watching  &
    activity-through  ~2026.10.1
  ==
++  dm
  |=  [who=@p text=@t]
  ^-  incoming-event:v8:a
  [%dm-post [[who message-at] message-at] [%ship who] ~[[%inline ~[text]]] |]
++  receipt
  ^-  @t
  %-  en:json:html
  :-  %a
  :~  %-  pairs:enjs:format
      :~  ['type' %s 'tlon-a2ui-selection']
          ['version' %n '1']
          ['surfaceId' %s key]
          ['componentId' %s 'create']
      ==
  ==
++  writ
  |=  [who=@p at=@da text=@t blob=(unit @t)]
  ^-  writ:v7:cv
  =/  w  *writ:v7:cv
  =/  essay  +.w
  =/  seal  -.w
  [seal(id [who at], time at) essay(content ~[[%inline ~[text]]], author who, sent at, blob blob)]
::  The DM: the bot's card, then the owner's message, whose blob is .tap
++  page
  |=  [text=@t tap=(unit @t)]
  ^-  paged-writs:v7:cv
  :_  [~ ~ 0 0]
  %+  gas:on:writs:v7:cv  ~
  :~  [card-at %& (writ ~zod card-at 'New workspace' `(blob:wp key sample))]
      [message-at %& (writ ~nec message-at text tap)]
  ==
++  defaults
  ^-  json
  %-  pairs:enjs:format
  :~  ['url' s+'']  ['model' s+'']  ['headers' a+~]  ['system' s+'']
      ['max-context' n+'1']  ['tools' a+~]
  ==
::  .dm is what local %chat holds; ~ blocks every DM read.
++  run
  |=  [event=incoming-event:v8:a dm=(unit paged-writs:v7:cv)]
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
    ?:  ?=([%gx @ %chat @ %v4 %dm @ %writs %newest *] path)
      ?~(dm ~ `!>(u.dm))
    ?:  ?=([%gx @ %chat @ %v4 %dm @ %writs %writ *] path)
      ?~  dm  ~
      `!>((got:on:writs:v7:cv writs.u.dm message-at))
    ?:  ?=([@ @ %channels *] path)  ~
    ?:  ?=([%gu @ %steward @ %$ ~] path)  `!>(|)
    ?:  ?=([%gu @ %contacts @ %$ ~] path)  `!>(|)
    ?:  =(%$ (rear path))  `!>(&)
    ?:  ?=([%gx @ %chat @ %dm %invited %ships ~] path)  `!>(~)
    ?:  ?=([%gx @ %activity @ %v6 %all %noun ~] path)  `!>(stream)
    ?:  ?=([%gx @ %harness @ %hand-state %noun ~] path)  `!>(*state:hh)
    ?:  ?=([%gx @ %harness @ %cron-session @ %noun ~] path)  `!>(~)
    ?:  ?=([%gx @ %harness @ %sessions %json ~] path)  `!>(`json`[%a ~])
    ?:  ?=([%gx @ %harness @ %defaults %json ~] path)  `!>(defaults)
    ~
  ;<  caz=(list card)  bind:m  (do-load adapter `!>(fixture))
  ;<  =vase  bind:m  get-save
  (pure:m caz !<(state-5:t vase))
++  texts
  |=  out=outcome
  ^-  (list @t)
  (turn ~(val by jobs.saved.out) |=(=job:t text.input.job))
++  words  'Create the "Lisbon Trip" workspace'
++  test-create-tap-tells-the-model-to-create
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  got=outcome  bind:m  (run (dm ~nec words) `(page words `receipt))
  =/  said  (texts got)
  ?>  ?=([@ ~] said)
  %+  ex-equal
    !>(&)
  !>((find-sub:ht 'tlon_workspace_create with proposal_id "workspace-plan-0123456789ab"' i.said))
++  test-the-buttons-words-without-its-receipt-approve-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  got=outcome  bind:m  (run (dm ~nec words) `(page words ~))
  (ex-equal !>((texts got)) !>(~[words]))
++  test-an-ordinary-owner-message-is-admitted-as-typed-without-reading-the-dm
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  got=outcome  bind:m  (run (dm ~nec 'Back to our Japan trip') ~)
  (ex-equal !>((texts got)) !>(~['Back to our Japan trip']))
++  test-a-command-reaches-the-head-as-typed
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  got=outcome  bind:m  (run (dm ~nec '/work tasks') ~)
  (ex-equal !>((texts got)) !>(~['/work tasks']))
--
