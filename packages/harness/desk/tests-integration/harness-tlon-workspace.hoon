::  Full adapter, synthetic scries only; no emitted cards are executed.
::  A workspace card is approved by the owner's tap, never by their words.
::  -test /=harness=/tests-integration/harness-tlon-workspace
/-  t=harness-tlon, hh=harness-hand, a=activity-ver, cv=chat-ver
/+  *test-agent, ht=harness-tools
/=  adapter  /app/harness-tlon
|%
+$  outcome  [cards=(list card) saved=state-3:t]
++  now  ~2026.10.1..00.00.10
++  message-at  ~2026.10.1..00.00.05
++  key  'workspace-plan-0123456789ab'
++  proposal
  ^-  workspace-proposal:t
  :*  ~nec  'sid'
      ['Lisbon Trip' 'Planning the May trip' ~[[%chat 'Planning' 'Day by day']] ~]
      %open  ~2026.9.30  |  ~  'The answer'  ~
  ==
++  fixture
  ^-  state-3:t
  =/  s=state-3:t  *state-3:t
  %=  s  owner-initialized  1  policy  [& `~nec ~ %mentions ~ ~]  watching  &
    activity-through  ~2026.10.1  proposals  (my ~[[key proposal]])
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
  |=  blob=(unit @t)
  ^-  (may:v7:cv writ:v7:cv)
  =/  w  *writ:v7:cv
  =/  essay  +.w
  [%& w(+ essay(blob blob))]
++  defaults
  ^-  json
  %-  pairs:enjs:format
  :~  ['url' s+'']  ['model' s+'']  ['headers' a+~]  ['system' s+'']
      ['max-context' n+'1']  ['tools' a+~]
  ==
::  .post is what local %chat holds for the message; ~ blocks that read.
++  run
  |=  [saved=state-3:t event=incoming-event:v8:a post=(unit (unit @t))]
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
    ?:  ?=([%gx @ %chat @ %v4 %dm @ %writs %writ *] path)
      ?~(post ~ `!>((writ u.post)))
    ?:  ?=([@ @ %channels *] path)  ~
    ?:  ?=([%gu @ %contacts @ %$ ~] path)  `!>(|)
    ?:  =(%$ (rear path))  `!>(&)
    ?:  ?=([%gx @ %chat @ %dm %invited %ships ~] path)  `!>(~)
    ?:  ?=([%gx @ %activity @ %v6 %all %noun ~] path)  `!>(stream)
    ?:  ?=([%gx @ %harness @ %hand-state %noun ~] path)  `!>(*state:hh)
    ?:  ?=([%gx @ %harness @ %cron-session @ %noun ~] path)  `!>(~)
    ?:  ?=([%gx @ %harness @ %sessions %json ~] path)  `!>(`json`[%a ~])
    ?:  ?=([%gx @ %harness @ %defaults %json ~] path)  `!>(defaults)
    ~
  ;<  caz=(list card)  bind:m  (do-load adapter `!>(saved))
  ;<  =vase  bind:m  get-save
  (pure:m caz !<(state-3:t vase))
++  texts
  |=  out=outcome
  ^-  (list @t)
  (turn ~(val by jobs.saved.out) |=(=job:t text.input.job))
++  status
  |=  out=outcome
  status:(~(got by proposals.saved.out) key)
++  test-create-tap-approves-the-card-and-tells-the-model
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  got=outcome  bind:m
    (run fixture (dm ~nec 'Create the "Lisbon Trip" workspace') ``receipt)
  ;<  ~  bind:m  (ex-equal !>((status got)) !>(%approved))
  =/  said  (texts got)
  ?>  ?=([@ ~] said)
  %-  ex-equal
  :_  !>([& |])
  !>  :-  (find-sub:ht 'tlon_workspace_create with proposal_id "workspace-plan-0123456789ab"' i.said)
      (find-sub:ht 'Workspace rule' i.said)
++  test-the-buttons-words-without-its-receipt-approve-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  got=outcome  bind:m
    (run fixture (dm ~nec 'Create the "Lisbon Trip" workspace') `~)
  ;<  ~  bind:m  (ex-equal !>((status got)) !>(%open))
  =/  said  (texts got)
  ?>  ?=([@ ~] said)
  (ex-equal !>((find-sub:ht 'tlon_workspace_create' i.said)) !>(|))
++  test-an-ordinary-owner-message-is-admitted-as-typed-without-reading-the-post
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  got=outcome  bind:m  (run fixture (dm ~nec 'Back to our Japan trip') ~)
  ;<  ~  bind:m  (ex-equal !>((status got)) !>(%open))
  (ex-equal !>((texts got)) !>(~['Back to our Japan trip']))
--
